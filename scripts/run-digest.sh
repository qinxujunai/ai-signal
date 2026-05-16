#!/bin/bash
export HOME=/root
NODE="/mnt/d/Apps/Dev/NodeJS/node.exe"
DIR="/mnt/c/Users/25752/.claude/skills/follow-builders/scripts"
cd "$DIR" || exit 1
echo "=== Digest run: $(date) ===" >> /root/.follow-builders/cron.log
"$NODE" prepare-digest.js 2>/dev/null | "$NODE" remix-digest.js 2>>/root/.follow-builders/cron-errors.log | "$NODE" deliver.js 2>&1 >> /root/.follow-builders/cron.log
echo "--- done ---" >> /root/.follow-builders/cron.log
