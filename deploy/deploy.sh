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
# The live site keeps serving apps/web/.next while this runs, so the new build
# goes into a clean side folder and replaces it only once it has succeeded.
# Deleting .next first (as this script used to) meant a failed build left the
# running site pointing at chunk files that no longer existed: every page
# failed with ChunkLoadError and showed "Application error".
# Clean, so pages are built from the content and plans the migrations and seed
# just wrote, not Next's cached copy of an earlier build's API data.
WEB=apps/web
rm -rf "$WEB/.next-build"
( set -a; . "$PV_ENV_DIR/web.env"; set +a; NEXT_DIST_DIR=.next-build NEXT_TELEMETRY_DISABLED=1 npm run build -w @pv/web ) || {
  rm -rf "$WEB/.next-build"
  echo "!! The web build failed. The site is still running the previous build." >&2
  exit 1
}
# Browsers holding a page from the previous build still ask for its chunks, so
# carry those over (never overwriting the new build's files). Content-hashed
# names make this safe; files from builds over a week old are dropped.
if [ -d "$WEB/.next/static" ]; then
  cp -a -n "$WEB/.next/static/." "$WEB/.next-build/static/" 2>/dev/null || true
  find "$WEB/.next-build/static" -type f -mtime +7 -delete 2>/dev/null || true
fi

echo "==> Switching to the new build and restarting the web app"
rm -rf "$WEB/.next-old"
[ -d "$WEB/.next" ] && mv "$WEB/.next" "$WEB/.next-old"
mv "$WEB/.next-build" "$WEB/.next"
pm2c startOrReload deploy/ecosystem.config.cjs --only pv-web --update-env
pm2c save

echo "==> Health check"
if ! wait_for "http://127.0.0.1:$WEB_PORT/"; then
  if [ -d "$WEB/.next-old" ]; then
    echo "!! The new build did not start; putting the previous one back" >&2
    rm -rf "$WEB/.next-failed"
    mv "$WEB/.next" "$WEB/.next-failed"
    mv "$WEB/.next-old" "$WEB/.next"
    pm2c startOrReload deploy/ecosystem.config.cjs --only pv-web --update-env
    wait_for "http://127.0.0.1:$WEB_PORT/" || true
  fi
  exit 1
fi
rm -rf "$WEB/.next-old"
curl -fsS "http://127.0.0.1:$API_PORT/api/health" && echo
echo "web ok on 127.0.0.1:$WEB_PORT"
