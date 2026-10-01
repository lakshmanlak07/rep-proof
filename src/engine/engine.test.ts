// Run: npm test   (Node's built-in runner; strips types natively)
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EXERCISE_BY_ID, SETUP_EQUIPMENT, substitutes } from './exercises.ts';
import { buildProgram, MUSCLES, recommendSplit, SPLIT_DAYS } from './plan.ts';
import { adjustForDay, isBadDay, suggest, warmup } from './progression.ts';
import { REFERENCES } from './references.ts';
import type { LoggedSet, PlannedExercise, Profile } from './types.ts';

const base: Profile = {
  experience: 'intermediate', goal: 'muscle', setup: 'commercial', days: 4, sessionMinutes: 75, unit: 'kg', avoid: [],
};
const sets = (n: number, weight: number, reps: number, rir: number | null = 2): LoggedSet[] =>
  Array.from({ length: n }, () => ({ weight, reps, rir }));
const bench: PlannedExercise = { exerciseId: 'bb_bench', sets: 3, repMin: 6, repMax: 10, rirTarget: 2 };

test('recommended split by days', () => {
  assert.deepEqual([2, 3, 4, 5, 6].map(recommendSplit), ['full_body', 'full_body', 'upper_lower', 'ulppl', 'ppl']);
  for (const d of [2, 3, 4, 5, 6]) assert.ok(SPLIT_DAYS[recommendSplit(d)].includes(d));
});

test('every profile combination builds a valid program', () => {
  for (const experience of ['beginner', 'intermediate', 'advanced'] as const)
    for (const setup of ['commercial', 'home'] as const)
      for (const days of [2, 3, 4, 5, 6])
        for (const sessionMinutes of [30, 45, 60, 90]) {
          const p = buildProgram({ ...base, experience, setup, days, sessionMinutes });
          assert.equal(p.days.length, days);
          for (const d of p.days) {
            assert.ok(d.exercises.length > 0, `${setup} ${days}d has an empty day`);
            for (const e of d.exercises) {
              const ex = EXERCISE_BY_ID[e.exerciseId];
              assert.ok(ex.equipment.every((q) => SETUP_EQUIPMENT[setup].includes(q)), `${ex.id} not available at ${setup}`);
              assert.ok(e.sets >= 1 && e.sets <= 5, `${ex.id} has ${e.sets} sets`);
              assert.ok(e.repMin >= 5 && e.repMax <= 12);
            }
            const ids = d.exercises.map((e) => e.exerciseId);
            assert.equal(new Set(ids).size, ids.length, 'duplicate exercise in one day');
          }
          for (const ex of p.explanations) for (const r of ex.refIds) assert.ok(REFERENCES[r], `unknown ref ${r}`);
        }
});

test('weekly sets per muscle match the planned sets', () => {
  const p = buildProgram(base);
  for (const m of MUSCLES) {
    const planned = p.days.flatMap((d) => d.exercises).filter((e) => EXERCISE_BY_ID[e.exerciseId].muscle === m).reduce((a, e) => a + e.sets, 0);
    assert.equal(planned, p.weeklySets[m], m);
  }
});

test('volume starts at the experience default and is trimmed to fit short sessions', () => {
  assert.equal(buildProgram({ ...base, sessionMinutes: 120 }).weeklySets.chest, 12);
  assert.equal(buildProgram({ ...base, experience: 'beginner', sessionMinutes: 120 }).weeklySets.chest, 8);
  const short = buildProgram({ ...base, days: 2, sessionMinutes: 30 });
  assert.ok(short.weeklySets.chest! < 12);
  assert.ok(short.explanations.some((e) => e.text.startsWith('Trimmed')));
});

test('avoided patterns never appear, and the plan explains a missing muscle', () => {
  const p = buildProgram({ ...base, avoid: ['squat', 'lunge', 'vertical_push'] });
  const patterns = p.days.flatMap((d) => d.exercises).map((e) => EXERCISE_BY_ID[e.exerciseId].pattern);
  assert.ok(!patterns.includes('squat') && !patterns.includes('lunge') && !patterns.includes('vertical_push'));

  const home = buildProgram({ ...base, setup: 'home', avoid: ['calf_raise'] });
  assert.equal(home.weeklySets.calves, undefined);
  assert.ok(home.explanations.some((e) => e.text.includes('calves')));
});

test('substitutes match muscle, pattern and equipment', () => {
  const subs = substitutes('bb_bench', 'home', []);
  assert.ok(subs.length > 0);
  for (const s of subs) {
    assert.equal(s.muscle, 'chest');
    assert.equal(s.pattern, 'horizontal_push');
    assert.ok(s.equipment.every((q) => SETUP_EQUIPMENT.home.includes(q)));
  }
  // leg curl has no same-pattern twin at home: falls back to same muscle
  assert.ok(substitutes('leg_curl', 'home', []).every((s) => s.muscle === 'hamstrings'));
});

test('progression rules', () => {
  assert.equal(suggest(bench, [], 'intermediate', 'kg').weight, null); // calibrate

  const top = suggest(bench, [sets(3, 60, 10)], 'intermediate', 'kg');
  assert.deepEqual([top.weight, top.reps], [62.5, 6]);

  const easy = suggest(bench, [sets(3, 60, 10, 4)], 'intermediate', 'kg');
  assert.equal(easy.weight, 65);
  assert.equal(easy.explanation.label, 'direct');

  const beginnerEasy = suggest(bench, [sets(3, 60, 10, 4)], 'beginner', 'kg');
  assert.equal(beginnerEasy.weight, 62.5); // RIR adjustments are intermediate+ only

  const mid = suggest(bench, [sets(3, 60, 8)], 'intermediate', 'kg');
  assert.deepEqual([mid.weight, mid.reps], [60, 9]);

  const grind = suggest(bench, [sets(3, 60, 8, 0)], 'intermediate', 'kg');
  assert.deepEqual([grind.weight, grind.reps], [60, 8]);

  const oneBad = suggest(bench, [sets(3, 60, 5)], 'intermediate', 'kg');
  assert.equal(oneBad.weight, 60);

  const twoBad = suggest(bench, [sets(3, 60, 5), sets(3, 60, 4)], 'intermediate', 'kg');
  assert.equal(twoBad.weight, 57.5);

  const lb = suggest(bench, [sets(3, 135, 10)], 'intermediate', 'lb');
  assert.equal(lb.weight, 140);

  const noRir = suggest(bench, [sets(3, 60, 10, null)], 'beginner', 'kg');
  assert.equal(noRir.weight, 62.5);
});

test('bad day and deload never raise load and cut sets', () => {
  assert.ok(isBadDay({ sleep: 1, soreness: 5, energy: 5 }));
  assert.ok(isBadDay({ sleep: 2, soreness: 3, energy: 2 }));
  assert.ok(!isBadDay({ sleep: 3, soreness: 3, energy: 3 }));

  const up = suggest(bench, [sets(3, 60, 10)], 'intermediate', 'kg');
  const bad = adjustForDay(up, 60, { badDay: true, deload: false });
  assert.deepEqual([bad.weight, bad.sets], [60, 2]);
  const deload = adjustForDay({ ...up, sets: 5 }, 60, { badDay: false, deload: true });
  assert.deepEqual([deload.weight, deload.sets], [60, 3]);
});

test('warm-up ramp', () => {
  assert.deepEqual(warmup(100, 'kg'), [{ weight: 20, reps: 10 }, { weight: 50, reps: 5 }, { weight: 75, reps: 3 }]);
  assert.equal(warmup(30, 'kg')[1].weight, 20); // never below the bar
});

test('simulated lifter over 8 weeks progresses and recovers from a bad patch', () => {
  // Strength gain: can do 1 more rep per week at a given weight; weeks 4-5 are a bad patch (2 fewer reps).
  let history: LoggedSet[][] = [];
  let weight = 60;
  const capacityAt = (w: number, week: number) => Math.floor(10 + week - (w - 60) / 2.5 * 2) - (week === 4 || week === 5 ? 5 : 0);
  for (let week = 0; week < 8; week++) {
    for (let session = 0; session < 2; session++) {
      const s = suggest(bench, history, 'intermediate', 'kg');
      weight = s.weight ?? weight;
      const reps = Math.max(1, Math.min(capacityAt(weight, week), s.reps + (s.reps < bench.repMax ? 1 : 0), bench.repMax));
      history = [sets(3, weight, reps), ...history];
      assert.ok(weight > 0 && weight < 120, `weight drifted to ${weight}`);
    }
  }
  assert.ok(weight > 60, `no progress after 8 weeks: ${weight}`);
});
