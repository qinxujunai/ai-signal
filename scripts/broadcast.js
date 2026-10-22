#!/usr/bin/env node
// AI Signal — sends the day's email to subscribers through Buttondown (https://buttondown.com).
// Runs after the owner's copy has gone out. Without BUTTONDOWN_API_KEY it does nothing. A failure is
// reported as a warning and never fails the run: the issue still gets published.
//
//   node broadcast.js --file email.html

import { readFile } from 'fs/promises';
import { buttondownEmail } from './email.js';

const key = process.env.BUTTONDOWN_API_KEY;
const file = process.argv[process.argv.indexOf('--file') + 1];

async function main() {
  if (!key) { console.log('Buttondown: no API key, skipped'); return; }
  const email = buttondownEmail(await readFile(file, 'utf-8'));
  const res = await fetch('https://api.buttondown.com/v1/emails', {
    method: 'POST',
    headers: {
      Authorization: `Token ${key}`,
      'Content-Type': 'application/json',
      // Buttondown asks API keys to confirm once that they really mean to send, not draft.
      'X-Buttondown-Live-Dangerously': 'true',
    },
    body: JSON.stringify(email),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  console.log(`Buttondown: queued for subscribers (${email.subject})`);
}

main().catch((err) => console.log(`::warning::Buttondown send failed: ${err.message}`));
