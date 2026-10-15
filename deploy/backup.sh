#!/usr/bin/env bash
# Nightly backup: database dump + uploaded media, kept for 14 days.
# Copy the files somewhere off this server too (S3/R2/B2 with rclone, or similar).
#
# Env files: $PV_ENV_DIR, else ~/.purple-voice (CloudPanel), else /etc/purple-voice.
# Destination: $PV_BACKUP_DIR, else ~/backups/purple-voice (CloudPanel) or
# /var/backups/purple-voice.
set -euo pipefail

if [ -f "$HOME/.purple-voice/api.env" ]; then
  PV_ENV_DIR="${PV_ENV_DIR:-$HOME/.purple-voice}"
  DEST="${PV_BACKUP_DIR:-$HOME/backups/purple-voice}"
else
  PV_ENV_DIR="${PV_ENV_DIR:-/etc/purple-voice}"
  DEST="${PV_BACKUP_DIR:-/var/backups/purple-voice}"
fi
STAMP=$(date +%Y-%m-%d_%H%M)
set -a; . "$PV_ENV_DIR/api.env"; set +a

mkdir -p "$DEST"
pg_dump --format=custom --no-owner "${DATABASE_URL%%\?*}" > "$DEST/db_$STAMP.dump"
if [ "${STORAGE_DRIVER:-local}" = local ]; then
  tar -czf "$DEST/uploads_$STAMP.tar.gz" -C "$(dirname "$STORAGE_LOCAL_PATH")" "$(basename "$STORAGE_LOCAL_PATH")"
fi
find "$DEST" -type f -name '*_*' -mtime +14 -delete
echo "$(date -Is) backup ok: $DEST/db_$STAMP.dump"
