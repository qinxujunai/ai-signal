#!/usr/bin/env node
// AI Signal — Beijing-time clock for the daily run.
//
// GitHub's scheduler can start a job hours late (09:41 ran at 14:32 on 2026-10-22), so the workflow is
// scheduled from 04:07 on; the first run to start waits here until 09:35, builds the issue, then waits
// until 10:00:00 to send.
//
//   node clock.js until 09:35            print milliseconds until that Beijing time today (0 if past)
//   node clock.js wait 10:00             sleep until that Beijing time today (returns at once if past)
//   node clock.js reachable 09:35 320    exit 0 if that time is at most N minutes away (or already past)
//   node clock.js today                  print today's Beijing date, YYYY-MM-DD

const TZ = 'Asia/Shanghai';

export function beijingDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

// Milliseconds from `now` until HH:MM:00 Beijing time on the same Beijing day; 0 if it has passed.
export function msUntil(hhmm, now = new Date()) {
  const [h, m] = String(hhmm).split(':').map(Number);
  if (!(h >= 0 && h < 24 && m >= 0 && m < 60)) throw new Error(`bad time "${hhmm}", expected HH:MM`);
  // Beijing has no daylight saving: UTC+8 all year.
  const [y, mo, d] = beijingDate(now).split('-').map(Number);
  const target = Date.UTC(y, mo - 1, d, h - 8, m, 0, 0);
  return Math.max(0, target - now.getTime());
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitUntil(hhmm) {
  // Sleep in slices so a long wait stays accurate to the second.
  for (let left = msUntil(hhmm); left > 0; left = msUntil(hhmm)) await sleep(Math.min(left, 60_000));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, time, minutes] = process.argv.slice(2);
  if (cmd === 'until') console.log(msUntil(time));
  else if (cmd === 'today') console.log(beijingDate());
  else if (cmd === 'reachable') process.exit(msUntil(time) <= Number(minutes) * 60_000 ? 0 : 1);
  else if (cmd === 'wait') {
    const ms = msUntil(time);
    console.error(`[ai-signal] waiting ${Math.round(ms / 60000)} min until ${time} Beijing`);
    await waitUntil(time);
    console.error(`[ai-signal] ${time} Beijing: go (${new Date().toISOString()})`);
  } else {
    console.error('usage: clock.js until|wait|reachable|today …');
    process.exit(2);
  }
}
