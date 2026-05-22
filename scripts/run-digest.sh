#!/usr/bin/env bash
# ── AI Signal · Cross-platform scheduling script ──────────────────
# Works on: native Linux, macOS, WSL, Git Bash
# Auto-detects environment — no hardcoded user paths.
#
# Usage:
#   run-digest.sh [generate|send|full]
#   generate  — fetch feeds + LLM remix → draft HTML
#   send      — send draft (generates first if missing)
#   full      — generate + send in one shot (default)
# ──────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Resolve PROJECT_ROOT ──────────────────────────────────────────
# 1. If run from project repo (scripts/run-digest.sh → parent has package.json)
# 2. If deployed copy (~/.ai-signal/run-digest.sh → reads .project-root marker)
_resolve_project_root() {
  local dir
  # Try BASH_SOURCE first (works when run directly from repo)
  dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [ -f "$dir/package.json" ]; then echo "$dir"; return; fi
  if [ -f "$dir/../package.json" ]; then echo "$(cd "$dir/.." && pwd)"; return; fi

  # Try .project-root marker (written by install scripts)
  local marker="$dir/.project-root"
  if [ -f "$marker" ]; then
    local root
    root="$(cat "$marker")"
    if [ -f "$root/package.json" ]; then echo "$root"; return; fi
  fi

  # Fallback: walk up from script dir looking for package.json
  dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/package.json" ]; then echo "$dir"; return; fi
    dir="$(cd "$dir/.." && pwd)"
  done

  echo "ERROR: Cannot locate project root (package.json). Set AI_SIGNAL_HOME." >&2
  exit 1
}

PROJECT_ROOT="${AI_SIGNAL_HOME:-$(_resolve_project_root)}"
SCRIPTS="$PROJECT_ROOT/scripts"

# ── Config directory ──────────────────────────────────────────────
CONFIG_DIR="$HOME/.ai-signal"
mkdir -p "$CONFIG_DIR/drafts" "$CONFIG_DIR/tmp"

# ── Detect Node.js ────────────────────────────────────────────────
_find_node() {
  # System PATH (Linux, macOS, WSL with native Node)
  if command -v node &>/dev/null; then
    echo "node"; return
  fi
  # Windows node.exe via WSL
  for candidate in \
    "/mnt/c/Program Files/nodejs/node.exe" \
    "/mnt/d/Apps/Dev/NodeJS/node.exe" \
    "$HOME/AppData/Roaming/nvm/*/node.exe"; do
    if [ -x "$candidate" ] 2>/dev/null || [ -f "$candidate" ]; then
      echo "$candidate"; return
    fi
  done
  # NVM
  if [ -d "$HOME/.nvm" ]; then
    export NVM_DIR="$HOME/.nvm"
    # shellcheck disable=SC1091
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" 2>/dev/null
    if command -v node &>/dev/null; then echo "node"; return; fi
  fi
  echo ""
}

NODE_BIN="$(_find_node)"
if [ -z "$NODE_BIN" ]; then
  echo "ERROR: Node.js not found. Install from https://nodejs.org" >&2
  exit 1
fi

# ── Logging ────────────────────────────────────────────────────────
TODAY=$(date +%F)
LOG="$CONFIG_DIR/cron.log"
ERR="$CONFIG_DIR/cron-errors.log"
DRAFT="$CONFIG_DIR/drafts/$TODAY.html"
FEED="$CONFIG_DIR/tmp/feed.json"

log() { echo "[$(date '+%F %H:%M:%S')] $1" >> "$LOG"; }

# ── Pipeline ───────────────────────────────────────────────────────
do_prepare() {
  cd "$SCRIPTS"
  "$NODE_BIN" prepare-digest.js --out "$FEED" 2>/dev/null
}

do_remix() {
  cd "$SCRIPTS"
  "$NODE_BIN" remix-digest.js --file "$FEED" --out "$DRAFT" 2>>"$ERR"
}

do_send() {
  cd "$SCRIPTS"
  "$NODE_BIN" deliver.js --file "$DRAFT" --force 2>&1
}

# ── Commands ──────────────────────────────────────────────────────
generate() {
  log "GENERATE start"

  # Clean old drafts (>7 days) - keep more for fallback
  find "$CONFIG_DIR/drafts" -name "*.html" -mtime +7 -delete 2>/dev/null || true

  # Skip if draft exists and is <4 hours old
  if [ -f "$DRAFT" ]; then
    local age
    age=$(( $(date +%s) - $(stat -c %Y "$DRAFT" 2>/dev/null || stat -f %m "$DRAFT" 2>/dev/null || echo 0) ))
    if [ "$age" -lt 14400 ]; then
      log "SKIP: draft exists (${age}s old)"
      exit 0
    fi
  fi

  if do_prepare && do_remix && [ -s "$DRAFT" ]; then
    log "GENERATE ok"
  else
    log "GENERATE FAIL"
    rm -f "$DRAFT"
    exit 1
  fi
}

send() {
  log "SEND start"

  # Generate first if no draft
  if [ ! -f "$DRAFT" ]; then
    log "No draft, generating..."
    do_prepare && do_remix || { log "SEND FAIL: generate failed"; exit 1; }
  fi

  do_send >> "$LOG"
  log "SEND done"
}

full() {
  log "FULL start"
  do_prepare && do_remix && do_send >> "$LOG"
  log "FULL done"
}

# ── Entry ─────────────────────────────────────────────────────────
case "${1:-full}" in
  generate) generate ;;
  send)     send ;;
  full)     full ;;
  *)        echo "Usage: $0 [generate|send|full]" >&2; exit 1 ;;
esac
