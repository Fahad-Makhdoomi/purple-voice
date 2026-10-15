#!/usr/bin/env bash
# Nightly backup: database dump + uploaded media, kept for 14 days.
# Copy the files somewhere off this server too (S3/R2/B2 with rclone, or similar).
set -euo pipefail
DEST=/var/backups/purple-voice
STAMP=$(date +%Y-%m-%d_%H%M)
set -a; . /etc/purple-voice/api.env; set +a

mkdir -p "$DEST"
pg_dump --format=custom --no-owner "${DATABASE_URL%%\?*}" > "$DEST/db_$STAMP.dump"
tar -czf "$DEST/uploads_$STAMP.tar.gz" -C "$(dirname "$STORAGE_LOCAL_PATH")" "$(basename "$STORAGE_LOCAL_PATH")"
find "$DEST" -type f -mtime +14 -delete
echo "$(date -Is) backup ok: $DEST/db_$STAMP.dump"
