#!/usr/bin/env bash
# Puts origin/main live on the VPS by hand, from any machine whose SSH key
# can log in as root (DEPLOYMENT.md § "Deploying by hand from a workstation"):
#   bash deploy/push-live.sh            # deploy origin/main
#   bash deploy/push-live.sh <commit>   # deploy (or roll back to) a commit on origin
#
# The server has no git checkout yet, so this ships a `git archive` of the
# commit: back up the database, unpack over ~/purple-voice (env files,
# uploads and backups live elsewhere and are untouched), then run
# deploy/deploy.sh as the site user (install, build, migrate, reload, health
# check). Only committed, pushed code is deployed — never local edits.
set -euo pipefail

HOST="${PV_DEPLOY_HOST:-root@62.72.57.2}"
SITE_USER="${PV_SITE_USER:-purplerocket-voice}"
SITE_URL="${PV_SITE_URL:-https://voice.purplerocket.co}"
REF="${1:-origin/main}"

cd "$(git rev-parse --show-toplevel)"
git fetch -q origin
SHA="$(git rev-parse --verify "$REF^{commit}")"
if [ -z "$(git branch -r --contains "$SHA" 2>/dev/null)" ]; then
  echo "!! $SHA is not on any branch of origin. Push it first; only pushed code goes live." >&2
  exit 1
fi
echo "==> Deploying $(git log -1 --format='%h %s' "$SHA") to $SITE_URL"

TARBALL="$(mktemp -t pv-deploy-XXXXXX.tar.gz)"
trap 'rm -f "$TARBALL"' EXIT
git archive --format=tar.gz -o "$TARBALL" "$SHA"
scp -q -o BatchMode=yes "$TARBALL" "$HOST:/tmp/pv-deploy.tar.gz"

# One deploy at a time: the server-side lock is shared with auto-deploys.
ssh -o BatchMode=yes -o ServerAliveInterval=30 "$HOST" bash -s -- "$SITE_USER" "$SHA" <<'REMOTE'
set -euo pipefail
SITE_USER="$1"; SHA="$2"
H="$(getent passwd "$SITE_USER" | cut -d: -f6)"
as_site() { sudo -iu "$SITE_USER" bash -lc "$1"; }
exec 9>"$H/.purple-voice/deploy.lock" && chown "$SITE_USER" "$H/.purple-voice/deploy.lock"
flock -w 2400 9 || { echo "!! another deploy is running" >&2; exit 75; }
echo "==> Backing up the database"
as_site "bash ~/purple-voice/deploy/backup.sh" | tail -1
echo "==> Unpacking $SHA"
tar -xzf /tmp/pv-deploy.tar.gz -C "$H/purple-voice"
chown -R "$SITE_USER:$SITE_USER" "$H/purple-voice"
rm -f /tmp/pv-deploy.tar.gz
echo "$SHA" > "$H/purple-voice/.deployed-commit"
as_site "cd ~/purple-voice && ./deploy/deploy.sh main 9>&-"
REMOTE

echo "==> Checking $SITE_URL"
curl -fsS "$SITE_URL/api/health" && echo
echo "==> Live: $(git log -1 --format='%h %s' "$SHA")"
