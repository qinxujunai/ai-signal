import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beijingTomorrow, inWindow } from '../clock.js';
import { armDecision, relayTitle, parseArmArgs, alarmState, WAKE_ENV, ARM_WINDOW } from '../relay.js';

// A moment given in Beijing time.
const at = (hhmm, day = '2026-11-07') => new Date(`${day}T${hhmm}:00+08:00`);

test('clock: tomorrow in Beijing, and a time window', () => {
  assert.equal(beijingTomorrow(at('07:30')), '2026-11-08');
  assert.equal(beijingTomorrow(at('23:59')), '2026-11-08');
  assert.equal(beijingTomorrow(at('12:00', '2026-10-31')), '2026-11-01', 'month end');
  assert.equal(beijingTomorrow(at('12:00', '2026-12-31')), '2027-01-01', 'year end');
  // 23:30 UTC on the 6th is already the morning of the 7th in Beijing.
  assert.equal(beijingTomorrow(new Date('2026-11-06T23:30:00Z')), '2026-11-08');
  assert.equal(inWindow('10:00', '11:30', at('09:59')), false);
  assert.equal(inWindow('10:00', '11:30', new Date('2026-11-07T10:00:00+08:00')), true, 'start is inclusive');
  assert.equal(inWindow('10:00', '11:30', at('11:29')), true);
  assert.equal(inWindow('10:00', '11:30', at('11:30')), false, 'end is exclusive');
});

const out = { issueOut: true, existing: [] };

test('relay: the run that has just sent the issue arms tomorrow\'s alarm', () => {
  const d = armDecision({ now: at('10:00'), mode: 'now', ...out });
  assert.equal(d.arm, true);
  assert.equal(d.forDay, '2026-11-08');
  assert.equal(armDecision({ now: at('10:20'), mode: 'now', ...out }).arm, true, 'a run that sent late but inside the window still arms');
  assert.equal(WAKE_ENV, 'daily-wake');
  assert.deepEqual(ARM_WINDOW, ['10:00', '11:30']);
});

test('relay: no alarm outside the window, before the issue is out, in a rehearsal, or when one is already set', () => {
  assert.match(armDecision({ now: at('09:50'), ...out }).reason, /window/, 'before 10:00 nothing has been sent yet');
  assert.equal(armDecision({ now: at('11:30'), ...out }).arm, false, 'after the window the alarm would go off too late for 10:00');
  assert.equal(armDecision({ now: at('15:00'), ...out }).arm, false, 'a late backup run in the afternoon does not arm');
  assert.match(armDecision({ now: at('10:05'), issueOut: false, existing: [] }).reason, /not out/);
  const dry = armDecision({ now: at('10:05'), dryRun: true, ...out });
  assert.equal(dry.arm, false);
  assert.equal(dry.wouldArm, true, 'a rehearsal says what it would do and does nothing');
  const set = [{ displayTitle: relayTitle('2026-11-08'), status: 'waiting' }];
  assert.match(armDecision({ now: at('10:05'), issueOut: true, existing: set }).reason, /already/, 'one alarm per day, never two');
  for (const status of ['queued', 'pending', 'in_progress', 'requested']) {
    assert.equal(armDecision({ now: at('10:05'), issueOut: true, existing: [{ displayTitle: relayTitle('2026-11-08'), status }] }).arm, false, `${status} counts as set`);
  }
  assert.equal(armDecision({ now: at('10:05'), issueOut: true, existing: [{ displayTitle: relayTitle('2026-11-08'), status: 'completed' }] }).arm, true, 'a finished run does not count');
  assert.equal(armDecision({ now: at('10:05'), issueOut: true, existing: [{ displayTitle: relayTitle('2026-11-09'), status: 'waiting' }, { displayTitle: 'AI Signal 2026-11-07', status: 'waiting' }] }).arm, true, 'other days and other runs do not count');
});

test('relay: an alarm that goes off on the wrong day never sets another (no loop if a timer is misconfigured)', () => {
  // Armed for the 8th but woke up on the 7th at 10:01, as if the environment had no wait timer.
  const early = armDecision({ now: at('10:01'), mode: 'relay', forDay: '2026-11-08', ...out });
  assert.equal(early.arm, false);
  assert.match(early.reason, /wrong time/);
  // Woke up a day late.
  assert.equal(armDecision({ now: at('10:01', '2026-11-09'), mode: 'relay', forDay: '2026-11-08', ...out }).arm, false);
  // Woke up on its own day: it is the run that sends today's issue, so it arms the next one.
  const right = armDecision({ now: at('10:01', '2026-11-08'), mode: 'relay', forDay: '2026-11-08', ...out });
  assert.equal(right.arm, true);
  assert.equal(right.forDay, '2026-11-09');
});

test('relay: the run title is what the next run looks for', () => {
  assert.equal(relayTitle('2026-11-08'), 'relay for 2026-11-08');
});

test('relay: the command lines the workflow passes', () => {
  // A scheduled run has no inputs, so every value is empty: a plain run.
  const plain = parseArmArgs(['--issue-out', 'true', '--mode', '', '--for-day', '', '--dry-run', '']);
  assert.equal(plain.mode, 'now');
  assert.equal(plain.forDay, '');
  assert.equal(plain.dryRun, false);
  assert.equal(plain.issueOut, true);
  assert.ok(plain.now instanceof Date && !Number.isNaN(plain.now.getTime()));
  const relay = parseArmArgs(['--issue-out', 'false', '--mode', 'relay', '--for-day', '2026-11-08', '--dry-run', 'true', '--now', '2026-11-08T10:01:00+08:00']);
  assert.deepEqual([relay.mode, relay.forDay, relay.dryRun, relay.issueOut, relay.now.toISOString()], ['relay', '2026-11-08', true, false, '2026-11-08T02:01:00.000Z']);
  // A manual run that sent inside the window sets tomorrow's alarm too (it is often the run that repairs a broken chain).
  assert.equal(armDecision({ ...parseArmArgs(['--issue-out', 'true', '--mode', 'now', '--for-day', '', '--dry-run', 'false', '--now', '2026-11-07T10:20:00+08:00']), existing: [] }).arm, true);
});

test('relay: after a dispatch, only a run waiting on its timer counts as a working alarm', () => {
  const t = relayTitle('2026-11-08');
  assert.equal(alarmState([{ displayTitle: t, status: 'waiting' }], '2026-11-08'), 'waiting');
  assert.equal(alarmState([{ displayTitle: t, status: 'in_progress' }], '2026-11-08'), 'in_progress', 'started at once: the environment lost its wait timer');
  assert.equal(alarmState([{ displayTitle: t, status: 'completed' }], '2026-11-08'), 'missing');
  assert.equal(alarmState([{ displayTitle: relayTitle('2026-11-09'), status: 'waiting' }], '2026-11-08'), 'missing');
  assert.equal(alarmState([], '2026-11-08'), 'missing');
});
