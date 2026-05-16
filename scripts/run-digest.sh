#!/bin/bash
export HOME=/root
NODE="/mnt/d/Apps/Dev/NodeJS/node.exe"
DIR="/mnt/c/Users/25752/.claude/skills/ai-signal/scripts"
LOG="/root/.ai-signal/cron.log"
ERR="/root/.ai-signal/cron-errors.log"
TMP="/root/.ai-signal/tmp"
mkdir -p "$TMP" "$(dirname "$LOG")"
cd "$DIR" || exit 1
echo "=== Digest run: $(date) ===" >> "$LOG"
"$NODE" prepare-digest.js --out "$TMP/feed.json" 2>/dev/null && \
"$NODE" remix-digest.js --file "$TMP/feed.json" --out "$TMP/digest.html" 2>>"$ERR" && \
"$NODE" deliver.js --file "$TMP/digest.html" --force 2>&1 >> "$LOG"
echo "--- done ---" >> "$LOG"
