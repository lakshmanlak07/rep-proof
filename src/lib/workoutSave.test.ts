// Workout completion: value checks, optional sets, failure messages, double taps and retry. Run with `npm test`.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { once, parseReps, parseWeight, prepareSave, saveFailure } from './workoutSave.ts';

const item = (sets: { weight: string; reps: string; rir: string; done: boolean }[]) => ({ exerciseId: 'bb_bench', name: 'Bench', sets, suggestion: { weight: 60, reps: 8 } });
const row = (weight: string, reps: string, done = true, rir = '2') => ({ weight, reps, rir, done });

test('completes once required data is logged; unlogged sets are optional', () => {
  const r = prepareSave([item([row('60', '8'), row('60', '7'), row('', '8', false)])]);
  assert.deepEqual(r.problems, []);
  assert.equal(r.sets.length, 2);
  assert.equal(r.left, 1);
  assert.deepEqual(r.sets.map((x) => x.setIndex), [0, 1]);
});

test('values the database would refuse are caught before saving, not retried forever', () => {
  assert.equal(parseWeight('62,5'), 62.5, 'comma decimal');
  assert.equal(parseWeight('2500'), null);
  assert.equal(parseReps('8.5'), null, 'reps are whole numbers');
  assert.equal(parseReps('201'), null);
  const bad = prepareSave([item([row('60', '8.5'), row('abc', '8')])]);
  assert.equal(bad.problems.length, 2);
  assert.match(bad.problems[0], /Bench, set 1: reps/);
  assert.equal(prepareSave([item([row('60', '8', false)])]).problems[0], 'Log at least one set to finish, or discard the workout.');
});

test('failure messages say what went wrong', () => {
  assert.match(saveFailure({ code: '22P02' }), /refused/);
  assert.match(saveFailure({ code: 'P0001' }), /later/);
  assert.match(saveFailure(new TypeError('Failed to fetch')), /connection.*kept on this phone/);
});

test('double taps save once; a failed save can be retried', async () => {
  const lock = { current: false };
  let calls = 0;
  let release!: () => void;
  const slow = () => new Promise<void>((r) => { calls++; release = r; });
  const first = once(lock, slow);
  assert.equal(await once(lock, slow), false, 'second tap ignored while saving');
  release();
  assert.equal(await first, true);
  assert.equal(calls, 1);
  await assert.rejects(once(lock, async () => { throw new Error('offline'); }));
  assert.equal(lock.current, false, 'lock released after failure');
  assert.equal(await once(lock, async () => { calls++; }), true, 'retry runs');
});
