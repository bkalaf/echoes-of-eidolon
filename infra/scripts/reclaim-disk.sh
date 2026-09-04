#!/usr/bin/env bash
set -Eeuo pipefail

# Reclaims the "highest" and "high" priority tiers from the workstation disk
# audit: stale Codex log/update/temp data, and package/OS caches.
#
# Deliberately out of scope, because these need an owner decision rather than a
# script: ~/Downloads, recovered-backup-* archives, Docker reclaimables, and the
# simulator SQLite acceptance/migration outputs (governed evidence, not caches).
#
# Linux only: relies on du -sb, numfmt, and mapfile.

apply=false
codex_stale_days=7

usage() {
  echo "Usage: reclaim-disk.sh [--apply] [--stale-days <n>]" >&2
  echo "  Reports reclaimable space without deleting unless --apply is given." >&2
  echo "  --stale-days <n> keeps Codex updater workspaces modified within the" >&2
  echo "  last n days (default 7). Anything under 24h is always kept." >&2
}

while (($# > 0)); do
  case "$1" in
    --apply)
      apply=true
      shift
      ;;
    --dry-run)
      apply=false
      shift
      ;;
    --stale-days)
      codex_stale_days="${2:-}"
      shift 2
      ;;
    *)
      usage
      exit 2
      ;;
  esac
done

if [[ ! "$codex_stale_days" =~ ^[0-9]+$ ]]; then
  echo "Stale-day threshold must be a non-negative integer." >&2
  exit 2
fi

sudo_if_needed=()
if ((EUID != 0)); then
  if ! command -v sudo >/dev/null 2>&1; then
    echo "Root privileges or sudo are required for the apt and snap tiers." >&2
    exit 2
  fi
  sudo_if_needed=(sudo)
fi

if ! $apply; then
  echo ">>> DRY RUN - nothing will be deleted. Re-run with --apply."
  echo
fi

reclaimed_bytes=0

size_of() {
  local bytes
  bytes="$(du -sb "$1" 2>/dev/null | cut -f1)" || bytes=""
  echo "${bytes:-0}"
}

human() {
  numfmt --to=iec --suffix=B "${1:-0}" 2>/dev/null || echo "${1:-0}B"
}

note() {
  reclaimed_bytes=$((reclaimed_bytes + $1))
  printf '  %-10s %s\n' "$(human "$1")" "$2"
}

# Removes a path outright. Used for directories that are safe to rebuild.
zap() {
  local path="$1" label="$2" bytes
  [[ -e "$path" ]] || return 0
  bytes="$(size_of "$path")"
  ((bytes > 0)) || return 0
  note "$bytes" "$path ($label)"
  if $apply && ! rm -rf -- "$path"; then
    echo "    Failed to remove $path" >&2
  fi
}

# Truncates rather than unlinks: if the writing process still holds the file
# open, unlinking frees nothing until that process exits, whereas truncating
# releases the blocks immediately.
truncate_log() {
  local path="$1" bytes
  [[ -f "$path" ]] || return 0
  bytes="$(size_of "$path")"
  ((bytes > 0)) || return 0
  note "$bytes" "$path (truncate, may be open)"
  if $apply && ! : >"$path"; then
    echo "    Failed to truncate $path" >&2
  fi
}

echo "=============================================================="
echo " HIGHEST - stale Codex log, update, and temp data"
echo "=============================================================="

# Codex roots are discovered rather than hardcoded: the layout differs between
# the desktop bundle, the CLI, and the updater.
mapfile -t codex_roots < <(
  for candidate in \
    "$HOME/.codex" \
    "$HOME/.config/codex" \
    "$HOME/.cache/codex" \
    "$HOME/.local/share/codex" \
    "$HOME/.local/state/codex"; do
    [[ -d "$candidate" ]] && echo "$candidate"
  done
)

if ((${#codex_roots[@]} == 0)); then
  echo "  No Codex directories found; skipping this tier."
else
  printf '  Root: %s\n' "${codex_roots[@]}"
  echo

  while IFS= read -r -d '' logfile; do
    truncate_log "$logfile"
  done < <(
    find "${codex_roots[@]}" -type f \
      \( -name 'launcher.log' -o -name '*.log' -o -name '*.log.[0-9]*' \) \
      -size +10M -print0 2>/dev/null
  )

  # -mtime +n matches strictly more than n*24h, so an in-flight update is never
  # pulled out from under the updater even at --stale-days 0.
  while IFS= read -r -d '' workspace; do
    zap "$workspace" "updater workspace"
  done < <(
    find "${codex_roots[@]}" -maxdepth 3 -type d \
      \( -name 'update*' -o -name '*updater*' -o -name 'pending*' \
      -o -name 'staging' -o -name 'downloads' \) \
      -mtime "+$codex_stale_days" -print0 2>/dev/null
  )

  while IFS= read -r -d '' scratch; do
    zap "$scratch" "temp"
  done < <(
    find "${codex_roots[@]}" -maxdepth 3 -type d \
      \( -name 'tmp' -o -name 'temp' -o -name 'cache' -o -name 'Cache' \) \
      -print0 2>/dev/null
  )
fi

echo
echo "=============================================================="
echo " HIGH - package and OS caches"
echo "=============================================================="

if command -v apt-get >/dev/null 2>&1; then
  apt_bytes="$(size_of /var/cache/apt/archives)"
  if ((apt_bytes > 1048576)); then
    note "$apt_bytes" "apt archives"
    $apply && "${sudo_if_needed[@]}" apt-get clean
  fi
fi

# npm and yarn are cleaned through their own tooling so the cache index stays
# consistent with the content-addressed store.
if command -v npm >/dev/null 2>&1; then
  npm_cache_dir="$(npm config get cache 2>/dev/null || true)"
  npm_bytes="$(size_of "${npm_cache_dir:-/nonexistent}")"
  if ((npm_bytes > 1048576)); then
    note "$npm_bytes" "npm cache ($npm_cache_dir)"
    $apply && npm cache clean --force
  fi
fi

if command -v yarn >/dev/null 2>&1; then
  yarn_cache_dir="$(yarn cache dir 2>/dev/null || true)"
  yarn_bytes="$(size_of "${yarn_cache_dir:-/nonexistent}")"
  if ((yarn_bytes > 1048576)); then
    note "$yarn_bytes" "yarn cache ($yarn_cache_dir)"
    $apply && yarn cache clean >/dev/null
  fi
fi

# Gradle build and daemon caches only; wrapper distributions and init scripts
# stay so existing builds keep working.
zap "$HOME/.gradle/caches" "gradle build cache"
zap "$HOME/.gradle/daemon" "gradle daemon logs"

if command -v snap >/dev/null 2>&1; then
  while read -r snap_name snap_revision; do
    [[ -n "$snap_name" ]] || continue
    snap_bytes="$(size_of "/var/lib/snapd/snaps/${snap_name}_${snap_revision}.snap")"
    note "$snap_bytes" "snap $snap_name revision $snap_revision (disabled)"
    $apply && "${sudo_if_needed[@]}" snap remove "$snap_name" --revision="$snap_revision"
  done < <(snap list --all 2>/dev/null | awk '/disabled/ {print $1, $3}')
fi

echo
echo "=============================================================="
if $apply; then
  printf ' Reclaimed %s.\n' "$(human "$reclaimed_bytes")"
else
  printf ' Would reclaim %s. Re-run with --apply to delete.\n' "$(human "$reclaimed_bytes")"
fi
echo "=============================================================="
