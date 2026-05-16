#!/bin/bash
export HOME=/root
NODE="/mnt/d/Apps/Dev/NodeJS/node.exe"
DIR="/mnt/c/Users/25752/.claude/skills/ai-signal/scripts"
LOG="/root/.ai-signal/cron.log"
ERR="/root/.ai-signal/cron-errors.log"
mkdir -p "$(dirname "$LOG")"
cd "$DIR" || exit 1
echo "=== Digest run: $(date) ===" >> "$LOG"
"$NODE" prepare-digest.js 2>/dev/null | "$NODE" remix-digest.js 2>>"$ERR" | "$NODE" deliver.js 2>&1 >> "$LOG"
echo "--- done ---" >> "$LOG"
