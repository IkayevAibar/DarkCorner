#!/usr/bin/env bash
# Nightly database dump, run by deploy/darkcorner-backup.timer. Keeps the newest 14.
# Copy them off the box now and then; a backup on the same disk is only half a backup.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
DEST=${BACKUP_DIR:-$ROOT/backups/daily}
LOG=${BACKUP_LOG:-/var/log/darkcorner-backup.log}
KEEP_DB=${BACKUP_KEEP_DB:-14}
PG=${POSTGRES_CONTAINER:-dc-postgres}

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG"; }

mkdir -p "$DEST"
STAMP=$(date -u '+%Y%m%d-%H%M%S')
FILE="$DEST/darkcorner-db_$STAMP.sql.gz"

docker exec "$PG" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' | gzip -9 > "$FILE"

# A young database is small, but an empty dump means something went wrong.
BYTES=$(stat -c%s "$FILE")
if [ "$BYTES" -lt 1000 ]; then
  log "FAILED: database dump is only $BYTES bytes; removed"
  rm -f "$FILE"
  exit 1
fi
gzip -t "$FILE"
log "backed up $(basename "$FILE") ($BYTES bytes)"

ls -1t "$DEST"/darkcorner-db_*.sql.gz 2>/dev/null | tail -n +"$((KEEP_DB + 1))" | while read -r old; do
  [ -n "$old" ] || continue
  rm -f "$old"
  log "pruned $(basename "$old")"
done
