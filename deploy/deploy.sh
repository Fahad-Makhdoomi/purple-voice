#!/usr/bin/env bash
# Build and (re)start Purple Voice from this checkout. Run as the app user:
#   ./deploy/deploy.sh [git-ref]      branch, tag or commit SHA; default main
# Safe to run repeatedly; migrations are applied before the new code starts.
# Pushes to main run this automatically through deploy/remote-deploy.sh.
#
# Env files: $PV_ENV_DIR, else ~/.purple-voice (CloudPanel), else /etc/purple-voice.
# Without a .git directory (code uploaded as a tarball) the fetch step is skipped.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${PV_ENV_DIR:-}" ]; then
  if [ -f "$HOME/.purple-voice/api.env" ]; then PV_ENV_DIR="$HOME/.purple-voice"; else PV_ENV_DIR=/etc/purple-voice; fi
fi
export PV_ENV_DIR
[ -r "$PV_ENV_DIR/api.env" ] && [ -r "$PV_ENV_DIR/web.env" ] || {
  echo "!! $PV_ENV_DIR/api.env and web.env not found or not readable (see DEPLOYMENT.md § 2)" >&2
  exit 1
}

# PM2 gets a clean environment: each process loads only its own env file, so
# API secrets never reach the Next.js process.
pm2c() { env -i HOME="$HOME" PATH="$PATH" USER="$(id -un)" PV_ENV_DIR="$PV_ENV_DIR" pm2 "$@"; }

wait_for() {
  for _ in $(seq 1 45); do curl -fsS -o /dev/null "$1" 2>/dev/null && return 0; sleep 1; done
  echo "!! $1 did not respond. Check: pm2 logs --lines 50" >&2
  return 1
}

REF="${1:-main}"
case "$REF" in -*) echo "!! '$REF' is not a branch, tag or commit" >&2; exit 1 ;; esac
if [ -d .git ] && [ "${PV_DEPLOY_SYNCED:-}" != "$REF" ]; then
  # The server always matches origin exactly: a branch is reset to its remote copy
  # (so force-pushes deploy too), a tag or commit is checked out detached, and edits
  # to tracked files on the server are discarded. Ignored files (node_modules,
  # builds) stay.
  echo "==> Fetching $REF"
  git fetch --prune --tags --force origin
  if git show-ref -q --verify "refs/remotes/origin/$REF"; then
    TARGET="origin/$REF"
  else
    TARGET="$REF"
    git rev-parse -q --verify "$REF^{commit}" >/dev/null || {
      echo "!! No branch, tag or commit called '$REF' in origin" >&2
      exit 1
    }
    # Only code on one of this repository's branches or tags: GitHub also serves
    # unmerged pull requests (forks included) by SHA, and those were never reviewed.
    if [ -z "$(git for-each-ref --count=1 --contains "$REF" refs/remotes/origin refs/tags)" ]; then
      echo "!! $REF is not on any branch or tag of origin. Only merged or tagged code is deployed." >&2
      exit 1
    fi
  fi
  # A rollback to before auto-deploy existed would delete the script the CI key runs.
  if grep -qs 'deploy/remote-deploy.sh' "$HOME/.ssh/authorized_keys" &&
    ! git cat-file -e "$TARGET:deploy/remote-deploy.sh" 2>/dev/null; then
    echo "!! $REF predates automatic deploys (no deploy/remote-deploy.sh); deploying it would break them." >&2
    exit 1
  fi
  if [ "$TARGET" = "$REF" ]; then
    git checkout -q -f --detach "$REF"
  else
    git checkout -q -f -B "$REF" "$TARGET"
  fi
  echo "==> Deploying $(git log -1 --format='%h %s')"
  # Carry on with the deploy.sh of the commit just checked out, not this copy of it.
  export PV_DEPLOY_SYNCED="$REF"
  exec bash ./deploy/deploy.sh "$REF"
elif [ ! -d .git ]; then
  echo "==> No .git directory: deploying the files as they are"
fi

echo "==> Installing dependencies"
npm ci --include=dev --no-audit --no-fund

echo "==> Checking static images (WebP, no duplicates)"
npm run images:check -w @pv/web

echo "==> Building the API"
set -a; . "$PV_ENV_DIR/api.env"; set +a
API_PORT="${API_PORT:-4000}"
WEB_PORT="$(sed -n 's/^PORT=//p' "$PV_ENV_DIR/web.env" | tr -d '"' | tail -1)"
WEB_PORT="${WEB_PORT:-3000}"
npm run build -w @pv/shared
npm run build -w @pv/api

echo "==> Applying database migrations"
npm run db:deploy

echo "==> Seeding plans and the first super admin (idempotent)"
SEED_DEMO=false npm run db:seed

echo "==> Restarting the API and worker"
pm2c startOrReload deploy/ecosystem.config.cjs --only pv-api,pv-worker --update-env
wait_for "http://127.0.0.1:$API_PORT/api/health"

echo "==> Building the web app (static pages render from the running API)"
# Next keeps fetched API data between builds; drop it so pages are built from the
# content and plans the migrations and seed just wrote, not an hour-old copy.
rm -rf apps/web/.next/cache/fetch-cache
( set -a; . "$PV_ENV_DIR/web.env"; set +a; NEXT_TELEMETRY_DISABLED=1 npm run build -w @pv/web )

echo "==> Restarting the web app"
pm2c startOrReload deploy/ecosystem.config.cjs --only pv-web --update-env
pm2c save

echo "==> Health check"
wait_for "http://127.0.0.1:$WEB_PORT/"
curl -fsS "http://127.0.0.1:$API_PORT/api/health" && echo
echo "web ok on 127.0.0.1:$WEB_PORT"
