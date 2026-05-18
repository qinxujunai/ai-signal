#!/bin/bash
export HOME=/root
NODE="/mnt/d/Apps/Dev/NodeJS/node.exe"
SCRIPTS="/mnt/c/Users/25752/Desktop/ai-signal/scripts"
DATA_DIR="/root/.ai-signal"
DRAFT_DIR="$DATA_DIR/drafts"
LOG="$DATA_DIR/cron.log"
ERR="$DATA_DIR/cron-errors.log"
TMP="$DATA_DIR/tmp"
mkdir -p "$DRAFT_DIR" "$TMP" "$(dirname "$LOG")"
STAGE="${1:-full}"
TODAY=$(date +%F)
DRAFT="$DRAFT_DIR/$TODAY.html"
WIN_SCRIPTS=$(wslpath -w "$SCRIPTS")
WIN_TMP=$(wslpath -w "$TMP")
WIN_DRAFT=$(wslpath -w "$DRAFT")
log() { echo "=== [$TODAY $(date +%H:%M:%S)] $1 ===" >> "$LOG"; }
generate() {
  log "GENERATE start"
  cd "$SCRIPTS" || { log "ERROR: cannot cd"; exit 1; }
  find "$DRAFT_DIR" -name "*.html" -mtime +1 -delete 2>/dev/null
  if [ -f "$DRAFT" ]; then
    age=$(( $(date +%s) - $(stat -c %Y "$DRAFT" 2>/dev/null || echo 0) ))
    if [ "$age" -lt 14400 ]; then log "SKIP: draft exists"; exit 0; fi
  fi
  "$NODE" prepare-digest.js --out "$WIN_TMP/feed.json" 2>/dev/null && \
  "$NODE" remix-digest.js --file "$WIN_TMP/feed.json" --out "$WIN_DRAFT" 2>>"$ERR"
  if [ -s "$DRAFT" ]; then log "GENERATE ok"; else log "GENERATE FAIL"; rm -f "$DRAFT"; exit 1; fi
}
send() {
  log "SEND start"
  cd "$SCRIPTS" || { log "ERROR: cannot cd"; exit 1; }
  if [ ! -f "$DRAFT" ]; then log "SEND FAIL: no draft"; exit 1; fi
  RESULT=$("$NODE" deliver.js --file "$WIN_DRAFT" --force 2>&1)
  echo "$RESULT" >> "$LOG"
  log "SEND done"
}
case "$STAGE" in
  generate) generate ;;
  send) send ;;
  *)
    log "FULL start"
    cd "$SCRIPTS" || { log "ERROR: cannot cd"; exit 1; }
    "$NODE" prepare-digest.js --out "$WIN_TMP/feed.json" 2>/dev/null && \
    "$NODE" remix-digest.js --file "$WIN_TMP/feed.json" --out "$WIN_TMP/digest.html" 2>>"$ERR" && \
    "$NODE" deliver.js --file "$WIN_TMP/digest.html" --force 2>&1 >> "$LOG"
    log "FULL done"
    ;;
esac
