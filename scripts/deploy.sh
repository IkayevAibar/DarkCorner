#!/usr/bin/env bash
# Pulls the newest commit of the checked-out branch and rebuilds what changed.
# Run every two minutes by deploy/darkcorner-deploy.timer; `--force` rebuilds everything.
#
# Mirrors the other ugolok projects' deploy.sh. Pause deploys with a note:
#   echo "fixing something by hand" > /opt/darkcorner/.deploy-pause
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
BRANCH=$(git rev-parse --abbrev-ref HEAD)
LOG=${DEPLOY_LOG:-/var/log/darkcorner-deploy.log}
FORCE=${1:-}

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG"; }

if [ -f "$ROOT/.deploy-pause" ]; then
  WHY=$(head -c 200 "$ROOT/.deploy-pause" | tr -d '\n')
  log "paused${WHY:+ — $WHY}"
  exit 0
fi

exec 9>"$ROOT/.deploy.lock"
flock -n 9 || { echo "another deploy is running"; exit 0; }

if [ "$FORCE" = "--force" ]; then
  log "forced rebuild at $(git rev-parse --short HEAD)"
  CHANGED=$(git ls-files)
else
  if ! git fetch --quiet origin "$BRANCH" 2>>"$LOG"; then
    log "cannot reach origin — leaving the running version alone"
    exit 0
  fi
  OLD=$(git rev-parse HEAD)
  NEW=$(git rev-parse "origin/$BRANCH")
  [ "$OLD" = "$NEW" ] && exit 0
  log "deploying $BRANCH ${OLD:0:7} -> ${NEW:0:7}"
  git reset --hard --quiet "origin/$BRANCH"
  CHANGED=$(git diff --name-only "$OLD" "$NEW")
fi

touched() { printf '%s\n' "$CHANGED" | grep -q "^$1"; }

# A migration is about to run: keep a dump from just before it (not on the very
# first deploy, when there is no database yet).
DB_RUNNING=$(docker inspect -f '{{.State.Running}}' dc-postgres 2>/dev/null || echo false)
if touched apps/api/prisma/migrations && [ "$DB_RUNNING" = "true" ]; then
  mkdir -p "$ROOT/backups"
  DUMP="$ROOT/backups/db-$(date -u '+%Y%m%d-%H%M%S')-premigration.sql.gz"
  # umask only here: the checkout and the images built from it must stay readable.
  if (umask 077; docker exec dc-postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' | gzip -9 > "$DUMP") \
     && [ "$(stat -c%s "$DUMP")" -ge 1000 ]; then
    log "pre-migration dump: $(basename "$DUMP")"
    ls -1t "$ROOT"/backups/db-*-premigration.sql.gz | tail -n +11 | xargs -r rm -f
  else
    rm -f "$DUMP"
    log "FAILED: pre-migration dump failed — not deploying a migration without one"
    exit 1
  fi
fi

REBUILD=()
add() { case " ${REBUILD[*]-} " in *" $1 "*) ;; *) REBUILD+=("$1");; esac; }
if touched packages/ || touched package-lock.json || touched package.json \
   || touched tsconfig.base.json || touched 'docker-compose\.yml'; then
  add api; add web
fi
touched apps/api && add api
touched apps/web && add web

if [ ${#REBUILD[@]} -eq 0 ]; then
  log "nothing to rebuild"
  exit 0
fi

log "rebuilding: ${REBUILD[*]}"
if ! docker compose up -d --build "${REBUILD[@]}" >>"$LOG" 2>&1; then
  log "FAILED: could not build ${REBUILD[*]} — see the compose output above"
  exit 1
fi

for _ in $(seq 1 45); do
  STATUS=$(docker inspect -f '{{.State.Health.Status}}' dc-api 2>/dev/null || echo missing)
  case "$STATUS" in
    healthy) log "deployed: ${REBUILD[*]}"; exit 0 ;;
    missing) log "FAILED: no container named dc-api"; exit 1 ;;
  esac
  sleep 2
done
log "FAILED: dc-api never became healthy after rebuilding ${REBUILD[*]}"
docker compose logs --tail 40 api >>"$LOG" 2>&1
exit 1
