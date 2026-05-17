#!/bin/bash
# AI Signal — Two-stage digest runner
# Stage "generate": fetch feed + LLM curate → save HTML draft
# Stage "send":     deliver pre-generated draft
#
# Usage:
#   run-digest.sh generate   (run at ~09:45, saves draft)
#   run-digest.sh send       (run at 10:00, sends email)
#   run-digest.sh            (default: generate + send in one shot)

export HOME=/root

NODE="/mnt/d/Apps/Dev/NodeJS/node.exe"
SCRIPTS="/mnt/c/Users/25752/Desktop/ai-signal/scripts"
DATA_DIR="/root/.ai-signal"
DRAFT_DIR="$DATA_DIR/drafts"
LOG="$DATA_DIR/cron.log"
ERR="$DATA_DIR/cron-errors.log"

mkdir -p "$DRAFT_DIR" "$(dirname "$LOG")"

STAGE="${1:-full}"
TODAY=$(date +%F)
DRAFT="$DRAFT_DIR/$TODAY.html"

log() { echo "=== [$TODAY $(date +%H:%M:%S)] $1 ===" >> "$LOG"; }

# ── Generate stage ───────────────────────────────────────────────────────
generate() {
  log "GENERATE start"
  cd "$SCRIPTS" || { log "ERROR: cannot cd to $SCRIPTS"; exit 1; }

  # Remove stale draft from previous days
  find "$DRAFT_DIR" -name "*.html" -mtime +1 -delete 2>/dev/null

  # Check cooldown: skip if draft already exists and is recent (< 4 hours)
  if [ -f "$DRAFT" ]; then
    age=$(( $(date +%s) - $(stat -c %Y "$DRAFT" 2>/dev/null || echo 0) ) )
    if [ "$age" -lt 14400 ]; then
      log "SKIP: draft exists (${age}s old), skipping generate"
      exit 0
    fi
  fi

  "$NODE" prepare-digest.js 2>/dev/null \
    | "$NODE" remix-digest.js 2>>"$ERR" \
    > "$DRAFT"

  if [ -s "$DRAFT" ]; then
    log "GENERATE ok → $DRAFT ($(wc -c < "$DRAFT") bytes)"
  else
    log "GENERATE FAIL: empty draft"
    rm -f "$DRAFT"
    exit 1
  fi
}

# ── Send stage ───────────────────────────────────────────────────────────
send() {
  log "SEND start"
  cd "$SCRIPTS" || { log "ERROR: cannot cd to $SCRIPTS"; exit 1; }

  if [ ! -f "$DRAFT" ]; then
    log "SEND FAIL: no draft at $DRAFT — run 'generate' first"
    exit 1
  fi

  # Convert WSL path to Windows path (Node.js is a Windows binary)
  WIN_DRAFT=$(wslpath -w "$DRAFT" 2>/dev/null || echo "$DRAFT")

  RESULT=$("$NODE" deliver.js --file "$WIN_DRAFT" 2>&1)
  echo "$RESULT" >> "$LOG"
  log "SEND done: $RESULT"
}

# ── Main ─────────────────────────────────────────────────────────────────
case "$STAGE" in
  generate)
    generate
    ;;
  send)
    send
    ;;
  *)
    # Full pipeline (backward compat): generate + send in one shot
    log "FULL start"
    cd "$SCRIPTS" || { log "ERROR: cannot cd to $SCRIPTS"; exit 1; }
    "$NODE" prepare-digest.js 2>/dev/null \
      | "$NODE" remix-digest.js 2>>"$ERR" \
      | "$NODE" deliver.js 2>&1 >> "$LOG"
    log "FULL done"
    ;;
esac
