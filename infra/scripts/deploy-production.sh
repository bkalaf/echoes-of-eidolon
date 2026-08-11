#!/usr/bin/env bash
set -Eeuo pipefail

deployment_env_file="/etc/eidolon/deployment.env"
target_revision=""
dry_run=false

usage() {
  echo "Usage: deploy-production.sh --revision <40-character commit> [--dry-run] [--env-file <absolute path>]" >&2
}

while (($# > 0)); do
  case "$1" in
    --revision)
      target_revision="${2:-}"
      shift 2
      ;;
    --dry-run)
      dry_run=true
      shift
      ;;
    --env-file)
      deployment_env_file="${2:-}"
      shift 2
      ;;
    *)
      usage
      exit 2
      ;;
  esac
done

if [[ ! "$target_revision" =~ ^[0-9a-f]{40}$ ]]; then
  echo "An explicitly authorized exact 40-character revision is required." >&2
  exit 2
fi
if [[ "$deployment_env_file" != /* || ! -f "$deployment_env_file" ]]; then
  echo "Deployment environment file must be an existing absolute file." >&2
  exit 2
fi

set -a
# shellcheck source=/dev/null
source "$deployment_env_file"
set +a

required_names=(
  DATABASE_URL
  POSTGRES_DB
  POSTGRES_PASSWORD
  POSTGRES_USER
  EIDOLON_BACKUP_DIR
  EIDOLON_COMPOSE_FILE
  EIDOLON_DEPLOYMENT_LOCK_FILE
  EIDOLON_DEPLOYMENT_RECORD_FILE
  EIDOLON_HEALTHCHECK_URL
  EIDOLON_REPOSITORY_DIR
  EIDOLON_SYSTEMD_SERVICE
)
for required_name in "${required_names[@]}"; do
  if [[ -z "${!required_name:-}" ]]; then
    echo "Missing deployment setting: $required_name" >&2
    exit 2
  fi
done

absolute_paths=(
  "$EIDOLON_BACKUP_DIR"
  "$EIDOLON_COMPOSE_FILE"
  "$EIDOLON_DEPLOYMENT_LOCK_FILE"
  "$EIDOLON_DEPLOYMENT_RECORD_FILE"
  "$EIDOLON_REPOSITORY_DIR"
)
for absolute_path in "${absolute_paths[@]}"; do
  if [[ "$absolute_path" != /* ]]; then
    echo "Deployment filesystem settings must be absolute." >&2
    exit 2
  fi
done

if [[ ! -d "$EIDOLON_REPOSITORY_DIR/.git" ]]; then
  echo "EIDOLON_REPOSITORY_DIR is not a Git repository." >&2
  exit 2
fi
if [[ ! -f "$EIDOLON_COMPOSE_FILE" ]]; then
  echo "EIDOLON_COMPOSE_FILE does not exist." >&2
  exit 2
fi
if [[ ! -d "$EIDOLON_BACKUP_DIR" || -L "$EIDOLON_BACKUP_DIR" || ! -w "$EIDOLON_BACKUP_DIR" ]]; then
  echo "EIDOLON_BACKUP_DIR must be a writable non-symlink directory." >&2
  exit 2
fi
if [[ "$EIDOLON_HEALTHCHECK_URL" != http://* && "$EIDOLON_HEALTHCHECK_URL" != https://* ]]; then
  echo "EIDOLON_HEALTHCHECK_URL must be HTTP or HTTPS." >&2
  exit 2
fi

git_in_repo() {
  git -C "$EIDOLON_REPOSITORY_DIR" "$@"
}

if [[ -n "$(git_in_repo status --porcelain --untracked-files=normal)" ]]; then
  echo "Production repository must be clean before deployment." >&2
  exit 2
fi
if ! git_in_repo cat-file -e "${target_revision}^{commit}"; then
  echo "Authorized revision is not available as a commit." >&2
  exit 2
fi

previous_revision="$(git_in_repo rev-parse HEAD)"

if $dry_run; then
  cat <<EOF
DRY RUN: preflight passed
revision: $target_revision
plan: checkout exact revision
plan: pnpm install --frozen-lockfile
plan: pnpm lint
plan: pnpm typecheck
plan: pnpm test
plan: pnpm test:integration
plan: pnpm test:e2e
plan: pnpm build
plan: docker compose up PostgreSQL
plan: pg_dump before migration
plan: prisma migrate deploy
plan: restart systemd web service
plan: verify HTTP health
plan: record redacted deployment result
rollback: application revision $previous_revision after failed promotion health
database rollback: manual from the recorded backup and an approved recovery plan
EOF
  exit 0
fi

exec 9>"$EIDOLON_DEPLOYMENT_LOCK_FILE"
if ! flock -n 9; then
  echo "Another deployment holds the serialized deployment lock." >&2
  exit 1
fi

run_unlocked() {
  "$@" 9>&-
}

checked_out_target=false
promotion_started=false
deployment_succeeded=false

rollback_application() {
  if ! $checked_out_target || $deployment_succeeded; then
    return
  fi
  echo "Deployment failed; attempting application revision rollback." >&2
  run_unlocked git -C "$EIDOLON_REPOSITORY_DIR" checkout --detach "$previous_revision" || return
  run_unlocked pnpm --dir "$EIDOLON_REPOSITORY_DIR" install --frozen-lockfile || return
  run_unlocked pnpm --dir "$EIDOLON_REPOSITORY_DIR" build || return
  if $promotion_started; then
    run_unlocked systemctl restart "$EIDOLON_SYSTEMD_SERVICE" || true
  fi
}
trap rollback_application EXIT

run_unlocked git -C "$EIDOLON_REPOSITORY_DIR" checkout --detach "$target_revision"
checked_out_target=true
run_unlocked pnpm --dir "$EIDOLON_REPOSITORY_DIR" install --frozen-lockfile
run_unlocked pnpm --dir "$EIDOLON_REPOSITORY_DIR" lint
run_unlocked pnpm --dir "$EIDOLON_REPOSITORY_DIR" typecheck
run_unlocked pnpm --dir "$EIDOLON_REPOSITORY_DIR" test
run_unlocked pnpm --dir "$EIDOLON_REPOSITORY_DIR" test:integration
run_unlocked pnpm --dir "$EIDOLON_REPOSITORY_DIR" test:e2e
run_unlocked pnpm --dir "$EIDOLON_REPOSITORY_DIR" build

run_unlocked docker compose -f "$EIDOLON_COMPOSE_FILE" up -d --wait postgres

TZ=UTC printf -v backup_timestamp '%(%Y%m%dT%H%M%SZ)T' -1
backup_path="$EIDOLON_BACKUP_DIR/${backup_timestamp}_${target_revision}.dump"
run_unlocked docker compose -f "$EIDOLON_COMPOSE_FILE" exec -T postgres \
  pg_dump --format=custom --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" >"$backup_path"
if [[ ! -s "$backup_path" ]]; then
  echo "Pre-migration backup was not created." >&2
  exit 1
fi

run_unlocked pnpm --dir "$EIDOLON_REPOSITORY_DIR" --filter @echoes/web db:migrate
promotion_started=true
run_unlocked systemctl restart "$EIDOLON_SYSTEMD_SERVICE"
run_unlocked curl --fail --silent --show-error --max-time 20 "$EIDOLON_HEALTHCHECK_URL" >/dev/null

TZ=UTC printf -v record_timestamp '%(%Y-%m-%dT%H:%M:%SZ)T' -1
backup_name="${backup_path##*/}"
record_line="$record_timestamp revision=$target_revision status=healthy backup=$backup_name"
run_unlocked sh -c 'umask 077; printf "%s\n" "$1" >> "$2"' sh "$record_line" "$EIDOLON_DEPLOYMENT_RECORD_FILE"
deployment_succeeded=true
trap - EXIT
echo "Deployment completed at revision $target_revision."
