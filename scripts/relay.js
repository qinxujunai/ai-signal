#!/usr/bin/env node
// AI Signal — keep tomorrow's alarm set.
//
// GitHub's cron starts only 3–5 of the 22 daily ticks, and on 2026-11-03 none before 10:12. So the cron is no longer
// the only thing that wakes the daily run. Once today's issue is out, the run that sent it asks for tomorrow's run in
// advance: a workflow_dispatch of daily.yml in "relay" mode whose first job waits in an environment (WAKE_ENV) with a
// wait timer. A job waiting on a timer holds no runner and no concurrency lock (measured 2026-11-07: runner null while
// waiting, started 4 s after the timer). When the timer ends, about 08:10 the next morning, the run claims the day like
// a scheduled one and waits for 09:35 and 10:00. The cron entries stay as a backup, and between 10:00 and 11:30 any run
// that sees today's issue out, or sends it, sets one if none is set, so the chain repairs itself.
//
//   node relay.js arm --issue-out true|false [--mode now|relay] [--for-day YYYY-MM-DD] [--dry-run true|false]

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { beijingDate, beijingTomorrow, inWindow } from './clock.js';

// The environment's wait timer (repository Settings → Environments) is 1330 minutes = 22 h 10 min: an alarm set at
// 10:00 goes off at 08:10 the next morning, 85 minutes before the issue is edited and 110 before it is sent.
export const WAKE_ENV = 'daily-wake';
// Only set it while that timer still lands before the issue is due: set at 11:30 it would go off at 09:40.
export const ARM_WINDOW = ['10:00', '11:30'];
export const relayTitle = (day) => `relay for ${day}`;
const OPEN = new Set(['queued', 'pending', 'requested', 'waiting', 'in_progress']);

// Pure decision: should this run set tomorrow's alarm?
export function armDecision({ now = new Date(), dryRun = false, mode = 'now', forDay = '', issueOut = false, existing = [] } = {}) {
  const today = beijingDate(now);
  const tomorrow = beijingTomorrow(now);
  // An alarm that goes off on the wrong day (a misconfigured timer) must not set another one: that would loop.
  if (mode === 'relay' && forDay !== today) {
    return { arm: false, reason: `this relay run is for ${forDay || 'no day'} but today is ${today}: the alarm went off at the wrong time, so it sets nothing` };
  }
  if (!inWindow(...ARM_WINDOW, now)) return { arm: false, reason: `outside the ${ARM_WINDOW.join('–')} Beijing window` };
  if (!issueOut) return { arm: false, reason: "today's issue is not out" };
  if (existing.some((r) => r.displayTitle === relayTitle(tomorrow) && OPEN.has(r.status))) return { arm: false, reason: `already set for ${tomorrow}` };
  if (dryRun) return { arm: false, wouldArm: true, forDay: tomorrow, reason: `rehearsal: would set the alarm for ${tomorrow}` };
  return { arm: true, forDay: tomorrow, reason: `set the alarm for ${tomorrow}` };
}

// RELAY_WORKFLOW and RELAY_WAKE only exist so the whole chain can be rehearsed on a throwaway workflow.
const WORKFLOW = process.env.RELAY_WORKFLOW || 'daily.yml';
const WAKE = process.env.RELAY_WAKE || WAKE_ENV;
const gh = (args) => execFileSync('gh', args, { encoding: 'utf8' });
const listRuns = () => JSON.parse(gh(['run', 'list', '--workflow', WORKFLOW, '--event', 'workflow_dispatch', '--limit', '50', '--json', 'displayTitle,status']));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The options of `relay.js arm`. Empty values (a scheduled run has no inputs) mean the defaults.
export function parseArmArgs(args) {
  const opt = (name) => { const i = args.indexOf(`--${name}`); return i === -1 ? '' : String(args[i + 1] ?? ''); };
  return {
    now: opt('now') ? new Date(opt('now')) : new Date(), // --now is for rehearsals
    dryRun: opt('dry-run') === 'true',
    mode: opt('mode') || 'now',
    forDay: opt('for-day'),
    issueOut: opt('issue-out') === 'true',
  };
}

// What the check after a dispatch sees: 'waiting' (on its timer: a working alarm), 'missing', or the run's status. A run
// already queued or in progress has no timer to wait on: the environment lost it, and the alarm would wake at once.
export function alarmState(runs, day) {
  const run = runs.find((r) => r.displayTitle === relayTitle(day) && OPEN.has(r.status));
  return run ? run.status : 'missing';
}

async function main(argv) {
  const [cmd, ...rest] = argv;
  if (cmd !== 'arm') {
    console.error('usage: relay.js arm --issue-out true|false [--mode now|relay] [--for-day YYYY-MM-DD] [--dry-run true|false] [--now ISO-time]');
    return 2;
  }
  const d = armDecision({ ...parseArmArgs(rest), existing: listRuns() });
  console.log(`[ai-signal] relay: ${d.reason}`);
  if (!d.arm) return 0;
  gh(['workflow', 'run', WORKFLOW, '-f', 'mode=relay', '-f', `wake=${WAKE}`, '-f', `for_day=${d.forDay}`]);
  // A dispatch that returned is not yet a run that exists, and a run is only an alarm while it waits on its timer.
  let state = 'missing';
  for (let i = 0; i < 8 && state !== 'waiting'; i++) {
    await sleep(3000);
    state = alarmState(listRuns(), d.forDay);
  }
  if (state === 'waiting') {
    console.log(`[ai-signal] relay: the alarm for ${d.forDay} is set`);
    return 0;
  }
  console.error(state === 'missing'
    ? `::warning::relay: asked for ${d.forDay}'s run but it did not show up; the cron backup still covers the day`
    : `::warning::relay: ${d.forDay}'s run is ${state}, not waiting on a timer: check the wait timer of environment ${WAKE}; the cron backup still covers the day`);
  return 1;
}

// Any failure (gh missing, the API down) ends as a warning in the log; the workflow step is continue-on-error.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exit(await main(process.argv.slice(2)).catch((e) => {
    console.error(`::warning::relay: ${String(e?.message ?? e).split('\n')[0]}; the cron backup still covers the day`);
    return 1;
  }));
}
