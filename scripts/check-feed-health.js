#!/usr/bin/env node
// Feed health monitor — checks if feed JSON is stale.
// If the feed hasn't been updated in N hours, outputs a warning.
// Pipe to deliver.js to send alert email if configured.

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const NEW_DIR = join(homedir(), '.ai-signal');
const LEGACY_DIR = join(homedir(), '.follow-builders');
const USER_DIR = existsSync(NEW_DIR) ? NEW_DIR : LEGACY_DIR;

const MAX_HOURS = 36; // Alert if feed older than this

async function checkHealth() {
  // Try to fetch the feed header only (lightweight)
  const urls = [
    'https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-x.json',
    'https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-podcasts.json'
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (!res.ok) {
        console.error(`⚠️ Feed unreachable: ${url} (HTTP ${res.status})`);
        continue;
      }
      // Check last-modified header
      const lastMod = res.headers.get('last-modified');
      if (lastMod) {
        const age = (Date.now() - new Date(lastMod).getTime()) / (1000 * 60 * 60);
        if (age > MAX_HOURS) {
          console.log(`⚠️ Feed may be stale: ${url.split('/').pop()} last updated ${age.toFixed(0)} hours ago`);
        } else {
          console.log(`✓ Feed healthy: ${url.split('/').pop()} updated ${age.toFixed(1)}h ago`);
        }
      }
    } catch (e) {
      console.error(`⚠️ Cannot reach feed: ${e.message}`);
    }
  }
}

checkHealth();
