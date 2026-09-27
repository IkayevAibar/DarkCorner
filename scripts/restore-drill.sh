#!/usr/bin/env bash
# Backup restore drill (docs/launch.md, week 6): restores the newest nightly dump
# into a scratch database next to the real one, counts what came back, and drops
# it. The live database is never touched. Run on the server from /opt/darkcorner.
set -euo pipefail
cd "$(dirname "$0")/.."
PG=${POSTGRES_CONTAINER:-dc-postgres}
DRILL=darkcorner_drill

LATEST=$(ls -1t backups/daily/darkcorner-db_*.sql.gz 2>/dev/null | head -n 1 || true)
if [ -z "$LATEST" ]; then
  echo "No backups in backups/daily yet: run scripts/backup.sh first." >&2
  exit 1
fi
echo "Restoring $(basename "$LATEST") into the scratch database $DRILL..."

docker exec "$PG" sh -c "dropdb -U \"\$POSTGRES_USER\" --if-exists $DRILL && createdb -U \"\$POSTGRES_USER\" $DRILL"
trap 'docker exec "$PG" sh -c "dropdb -U \"\$POSTGRES_USER\" --if-exists $DRILL" >/dev/null 2>&1 || true' EXIT

gunzip -c "$LATEST" | docker exec -i "$PG" sh -c "psql -q -v ON_ERROR_STOP=1 -U \"\$POSTGRES_USER\" -d $DRILL" >/dev/null

docker exec "$PG" sh -c "psql -U \"\$POSTGRES_USER\" -d $DRILL -c '
  SELECT (SELECT count(*) FROM \"Player\") AS players,
         (SELECT count(*) FROM \"Hero\") AS heroes,
         (SELECT count(*) FROM \"Item\") AS items,
         (SELECT count(*) FROM \"Season\") AS seasons,
         (SELECT count(*) FROM \"_prisma_migrations\") AS migrations;'"

echo "Restore drill passed: the backup restores cleanly. (The scratch database is dropped on exit.)"
