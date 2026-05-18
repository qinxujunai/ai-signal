#!/bin/bash
export HOME=/root
NODE="/mnt/d/Apps/Dev/NodeJS/node.exe"
SCRIPTS="/mnt/c/Users/25752/Desktop/ai-signal/scripts"
WIN_DATA="C:\\Users\\25752\\.ai-signal"
WIN_TMP="$WIN_DATA\\tmp"
WIN_DRAFT_DIR="$WIN_DATA\\drafts"
LOG="/root/.ai-signal/cron.log"
ERR="/root/.ai-signal/cron-errors.log"
TODAY=$(date +%F)
WIN_DRAFT="$WIN_DRAFT_DIR\\$TODAY.html"
WSL_DRAFT="/mnt/c/Users/25752/.ai-signal/drafts/$TODAY.html"
mkdir -p "/mnt/c/Users/25752/.ai-signal/drafts" "/mnt/c/Users/25752/.ai-signal/tmp" "$(dirname "$LOG")"
log() { echo "=== [$TODAY $(date +%H:%M:%S)] $1 ===" >> "$LOG"; }
generate() {
  log "GENERATE start"
  cd "$SCRIPTS" || { log "ERROR: cannot cd"; exit 1; }
  find "/mnt/c/Users/25752/.ai-signal/drafts" -name "*.html" -mtime +1 -delete 2>/dev/null
  if [ -f "$WSL_DRAFT" ]; then
    age=$(( $(date +%s) - $(stat -c %Y "$WSL_DRAFT" 2>/dev/null || echo 0) ))
    if [ "$age" -lt 14400 ]; then log "SKIP: draft exists"; exit 0; fi
  fi
  "$NODE" prepare-digest.js --out "$WIN_TMP\\feed.json" 2>/dev/null && \
  "$NODE" remix-digest.js --file "$WIN_TMP\\feed.json" --out "$WIN_DRAFT" 2>>"$ERR"
  if [ -s "$WSL_DRAFT" ]; then log "GENERATE ok"; else log "GENERATE FAIL"; rm -f "$WSL_DRAFT"; exit 1; fi
}
send() {
  log "SEND start"
  cd "$SCRIPTS" || { log "ERROR: cannot cd"; exit 1; }
  if [ ! -f "$WSL_DRAFT" ]; then
    log "No draft, emergency generate..."
    "$NODE" prepare-digest.js --out "$WIN_TMP\\feed.json" 2>/dev/null && \
    "$NODE" remix-digest.js --file "$WIN_TMP\\feed.json" --out "$WIN_DRAFT" 2>>"$ERR"
    if [ ! -s "$WSL_DRAFT" ]; then log "SEND FAIL: emergency generate failed"; exit 1; fi
  fi
  RESULT=$("$NODE" deliver.js --file "$WIN_DRAFT" --force 2>&1)
  echo "$RESULT" >> "$LOG"
  log "SEND done"
}
case "${1:-full}" in
  generate) generate ;;
  send) send ;;
  *)
    log "FULL start"
    cd "$SCRIPTS" || { log "ERROR: cannot cd"; exit 1; }
    "$NODE" prepare-digest.js --out "$WIN_TMP\\feed.json" 2>/dev/null && \
    "$NODE" remix-digest.js --file "$WIN_TMP\\feed.json" --out "$WIN_TMP\\digest.html" 2>>"$ERR" && \
    "$NODE" deliver.js --file "$WIN_TMP\\digest.html" --force 2>&1 >> "$LOG"
    log "FULL done"
    ;;
esac
