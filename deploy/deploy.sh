#!/usr/bin/env bash
# Build and (re)start Purple Voice from the current checkout. Run as the app user
# from the repo root:   ./deploy/deploy.sh [git-ref]
# Safe to run repeatedly; migrations are applied before the new code starts.
set -euo pipefail
cd "$(dirname "$0")/.."

REF="${1:-main}"
echo "==> Fetching $REF"
git fetch --prune origin
git checkout -q "$REF"
git pull --ff-only origin "$REF" || true

echo "==> Installing dependencies"
npm ci --no-audit --no-fund

echo "==> Checking static images (WebP, no duplicates)"
npm run images:check -w @pv/web

echo "==> Building"
set -a; . /etc/purple-voice/api.env; set +a
npm run build -w @pv/shared
npm run build -w @pv/api
npm run db:deploy
( set -a; . /etc/purple-voice/web.env; set +a; npm run build -w @pv/web )

echo "==> Seeding plans and first super admin (idempotent)"
SEED_DEMO=false npm run db:seed

echo "==> Restarting processes"
pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save

echo "==> Health check"
sleep 3
curl -fsS http://127.0.0.1:4000/api/health && echo
curl -fsS -o /dev/null -w "web %{http_code}\n" http://127.0.0.1:3000/
