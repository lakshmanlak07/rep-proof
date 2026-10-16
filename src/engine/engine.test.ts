/// <reference types="node" />
// Run: npm test   (Node's built-in runner; strips types natively)
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EXERCISE_BY_ID, SETUP_EQUIPMENT, substitutes } from './exercises.ts';
import { buildProgram, exerciseMinutes, MUSCLES, recommendSplit, SPLIT_DAYS } from './plan.ts';
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
              assert.ok(e.sets >= 1 && e.sets <= 3, `${ex.id} has ${e.sets} sets (founder rule: 1-3)`);
              // default effort: earlier sets ~2 in reserve, last set to failure (beginners 1 short)
              assert.equal(e.rirTarget, 2);
              assert.equal(e.lastSetRir, experience === 'beginner' ? 1 : 0);
              assert.ok(e.repMin >= 5 && e.repMax <= 15);
            }
            const minutes = d.exercises.reduce((n, e) => n + exerciseMinutes(e.sets), 0);
            const floor = d.exercises.length * exerciseMinutes(1); // every exercise at 1 set is the minimum
            assert.ok(minutes <= Math.max(floor, sessionMinutes), `${days}d ${sessionMinutes}min ${d.name}: ${minutes} min`);
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

test('sets per exercise: 3 for weak points, 1 for strong points, 2 otherwise; trimmed to fit time', () => {
  const p = buildProgram({ ...base, sessionMinutes: 120, weak: ['chest', 'biceps'], strong: ['quads'] });
  const setsOf = (m: string) => [...new Set(p.days.flatMap((d) => d.exercises).filter((e) => EXERCISE_BY_ID[e.exerciseId].muscle === m).map((e) => e.sets))];
  assert.deepEqual(setsOf('chest'), [3]);
  assert.deepEqual(setsOf('biceps'), [3]);
  assert.deepEqual(setsOf('quads'), [1]);
  assert.deepEqual(setsOf('back'), [2]);
  assert.deepEqual(p.emphasis, { weak: ['chest', 'biceps'], strong: ['quads'] });
  // a muscle in both lists counts as weak
  assert.deepEqual(buildProgram({ ...base, weak: ['back'], strong: ['back'] }).emphasis, { weak: ['back'], strong: [] });

  const short = buildProgram({ ...base, days: 2, sessionMinutes: 30, weak: ['chest'] });
  assert.ok(short.explanations.some((e) => e.text.startsWith('Some sets were cut')));
  const chest = short.days[0].exercises.find((e) => EXERCISE_BY_ID[e.exerciseId].muscle === 'chest')!;
  const others = short.days[0].exercises.filter((e) => EXERCISE_BY_ID[e.exerciseId].muscle !== 'chest');
  assert.ok(others.every((e) => e.sets <= chest.sets), 'weak points keep their sets longest');
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
  const deload = adjustForDay({ ...up, sets: 3 }, 60, { badDay: false, deload: true });
  assert.deepEqual([deload.weight, deload.sets], [60, 2]);
  assert.equal(adjustForDay({ ...up, sets: 1 }, 60, { badDay: true, deload: false }).sets, 1); // never below 1
});

test('one warm-up set per exercise at about 80% for 5 reps', () => {
  assert.deepEqual(warmup(100, 'kg'), { weight: 80, reps: 5 });
  assert.deepEqual(warmup(135, 'lb'), { weight: 110, reps: 5 });
  assert.equal(warmup(20, 'kg', true).weight, 20); // barbell: never below the empty bar
  assert.equal(warmup(20, 'kg').weight, 15); // dumbbells/machines can go lighter
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

test('nutrition targets', async () => {
  const { targets } = await import('./nutrition.ts');
  const base = { bodyweight: 80, unit: 'kg' as const, heightCm: 180, age: 30, sex: 'male' as const, days: 4, phase: 'maintain' as const };
  const m = targets(base);
  // resting = 800 + 1125 - 150 + 5 = 1780; x1.55 = 2759 -> 2760
  assert.equal(m.calories, 2760);
  assert.equal(m.protein, 128);
  assert.ok(Math.abs(m.protein * 4 + m.fat * 9 + m.carbs * 4 - m.calories) < 15);
  assert.equal(targets({ ...base, phase: 'cut' }).calories, 2210);
  assert.ok(targets({ ...base, sex: null }).calories < m.calories);
  assert.equal(targets({ ...base, unit: 'lb', bodyweight: 176.37 }).protein, 128);
  for (const e of m.explanations) for (const r of e.refIds) assert.ok(REFERENCES[r]);
});

test('suggestion kinds and pins', async () => {
  const { applyPins } = await import('./progression.ts');
  assert.equal(suggest(bench, [], 'intermediate', 'kg').kind, 'calibrate');
  assert.equal(suggest(bench, [sets(3, 60, 5), sets(3, 60, 4)], 'intermediate', 'kg').kind, 'drop');
  assert.equal(suggest(bench, [sets(3, 60, 10)], 'intermediate', 'kg').kind, 'up');
  const pinned = applyPins(suggest(bench, [sets(3, 60, 8)], 'intermediate', 'kg'), { ...bench, pinnedSets: 2, pinnedReps: 10 });
  assert.deepEqual([pinned.sets, pinned.reps, pinned.weight], [2, 10, 60]);
  // founder rule: a pin can never push past 3 working sets
  assert.equal(applyPins(suggest(bench, [sets(3, 60, 8)], 'intermediate', 'kg'), { ...bench, pinnedSets: 4 }).sets, 3);
  assert.ok(pinned.explanation.text.includes('pinned'));
});

test('cooldown, missed sessions, deload offer', async () => {
  const { cooldown, isMissed, deloadOffer } = await import('./session.ts');
  assert.equal(cooldown(['chest', 'chest', 'back', 'quads', 'calves', 'biceps']).length, 4);
  assert.ok(!isMissed(null, 3));
  assert.ok(!isMissed(4, 3) && isMissed(5, 3));
  assert.ok(!isMissed(3, 6) && isMissed(4, 6));
  const bad = { sleep: 1, soreness: 2, energy: 2 };
  assert.equal(deloadOffer([{ checkin: bad, perfDrops: 1 }, { checkin: null, perfDrops: 0 }]), null);
  assert.ok(deloadOffer([{ checkin: bad, perfDrops: 1 }, { checkin: bad, perfDrops: 1 }]));
  assert.equal(deloadOffer([{ checkin: bad, perfDrops: 0 }, { checkin: bad, perfDrops: 1 }]), null);
});

test('every reference is complete and every cited id exists', async () => {
  const { NUTRITION_CARDS } = await import('./nutrition.ts');
  const { WARMUP_WHY } = await import('./progression.ts');
  const { REST_WHY } = await import('./plan.ts');
  for (const r of Object.values(REFERENCES)) {
    assert.match(r.doi, /^10\.\d{4,}\//, `${r.id} DOI`);
    assert.match(r.pmid, /^\d+$/, `${r.id} PMID`);
    assert.ok(r.citation && r.type && r.population && r.finding, `${r.id} fields`);
  }
  const cited = [WARMUP_WHY, REST_WHY, ...NUTRITION_CARDS.map((c) => c.explanation)].flatMap((e) => e.refIds);
  for (const id of cited) assert.ok(REFERENCES[id], `unknown ref ${id}`);
  // RepProof rules never carry a citation that claims to support them, except the surplus review that says "unknown"
  for (const c of NUTRITION_CARDS) if (c.explanation.label === 'rule') assert.deepEqual(c.explanation.refIds.filter((r) => r !== 'surplus'), []);
});

test('science library: real references, honest tiers, cautions and debates', async () => {
  const { TOPICS, TIERS, CAUTIONS, DEBATES, PRINCIPLES } = await import('./science.ts');
  for (const topic of TOPICS) {
    // only a Tier 3 rule may stand without a study; Tier 1 and 2 must cite one
    if (topic.label !== 'rule') assert.ok(topic.refIds.length, `${topic.title} has no studies`);
    for (const id of topic.refIds) assert.ok(REFERENCES[id], `${topic.title}: unknown ref ${id}`);
  }
  assert.deepEqual(new Set(TOPICS.map((x) => x.label)), new Set(['direct', 'principle', 'rule']));
  assert.deepEqual(TIERS.map((x) => x.label), ['direct', 'principle', 'rule']);
  assert.ok(CAUTIONS.length >= 8 && DEBATES.length > 0 && PRINCIPLES.length === 8);
});

test('pinned reps become the target: hitting them adds weight, never reads as a miss', async () => {
  const { applyPins } = await import('./progression.ts');
  const pinned = { ...bench, pinnedReps: 5 };
  const hit = applyPins(suggest(pinned, [sets(3, 100, 5)], 'intermediate', 'kg'), pinned);
  assert.deepEqual([hit.kind, hit.weight, hit.reps], ['up', 102.5, 5]);
  const miss = suggest(pinned, [sets(3, 100, 4), sets(3, 100, 4)], 'intermediate', 'kg');
  assert.equal(miss.kind, 'drop');
});

test('Open Food Facts products convert to foods', async () => {
  const { fromOff, dedupe } = await import('../lib/off.ts');
  const nutella = fromOff({ code: '3017620422003', product_name: 'Nutella', brands: 'Nutella, Ferrero',
    nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, fat_100g: 30.9, carbohydrates_100g: 57.5 } });
  assert.deepEqual(nutella, { id: '3017620422003', source: 'off', name: 'Nutella', brand: 'Nutella', servingGrams: null,
    per100: { kcal: 539, protein: 6.3, fat: 30.9, carbs: 57.5 } });
  // kJ only -> kcal; brand as array (search API); serving in grams kept
  const kj = fromOff({ code: '1', product_name: 'Oats', brands: ['Quaker'], serving_quantity: 40, nutriments: { energy_100g: 1569, proteins_100g: 13 } });
  assert.equal(kj?.per100.kcal, 375);
  assert.equal(kj?.brand, 'Quaker');
  assert.equal(kj?.servingGrams, 40);
  // unusable entries dropped
  assert.equal(fromOff({ code: '2', product_name: 'Water', nutriments: {} }), null);
  assert.equal(fromOff({ code: '3', nutriments: { proteins_100g: 5 } }), null);
  assert.equal(fromOff(undefined), null);
  assert.equal(dedupe([nutella!, { ...nutella!, id: 'x' }, kj!]).length, 2);
});

test('home stats: week dots, streak, new bests', async () => {
  const { weekDots, streakWeeks, newBests } = await import('../lib/stats.ts');
  const now = new Date(2026, 9, 7, 12); // Wednesday 7 Oct 2026, local time
  const at = (y: number, m: number, d: number) => new Date(y, m, d, 18).toISOString();
  assert.deepEqual(weekDots([at(2026, 9, 5), at(2026, 9, 7), at(2026, 9, 4)], now), [true, false, true, false, false, false, false]);

  // this week + 2 previous weeks; a gap before that
  assert.equal(streakWeeks([at(2026, 9, 6), at(2026, 8, 29), at(2026, 8, 22), at(2026, 8, 8)], now), 3);
  // nothing yet this week: streak still counts from last week
  assert.equal(streakWeeks([at(2026, 8, 29), at(2026, 8, 22)], now), 2);
  assert.equal(streakWeeks([], now), 0);

  const s = (exercise_id: string, weight: number, workout_id: string, created_at: string) => ({ exercise_id, weight, workout_id, created_at });
  const bests = newBests([
    s('bb_bench', 60, 'w1', at(2026, 8, 20)), s('bb_bench', 62.5, 'w1', at(2026, 8, 20)),
    s('bb_bench', 65, 'w2', at(2026, 9, 1)), s('bb_squat', 100, 'w2', at(2026, 9, 1)),
    s('bb_bench', 65, 'w3', at(2026, 9, 5)), // equal, not a new best
  ], 30, now);
  assert.deepEqual(bests.map((b) => [b.exerciseId, b.weight, b.previous]), [['bb_bench', 65, 62.5]]); // first squat session does not count
});

test('dates: a logged day (YYYY-MM-DD) shows as that calendar day in every time zone', async () => {
  const { shortDate } = await import('../lib/stats.ts');
  const day = new Date(2026, 9, 8).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  assert.equal(shortDate('2026-10-08'), day); // new Date('2026-10-08') would be UTC midnight: the 7th west of Greenwich
  assert.equal(shortDate(new Date(2026, 9, 8, 18).toISOString()), day);
});

test('consistency ignores the weeks before the account existed', async () => {
  const { adherence } = await import('../lib/stats.ts');
  const now = new Date(2026, 9, 7, 12); // Wednesday 7 Oct 2026
  const at = (y: number, m: number, d: number) => new Date(y, m, d, 18).toISOString();
  // Joined Thursday 24 Sep, 3 planned a week: 1 in the partial first week, 3 last week, 1 so far this week.
  const done = [at(2026, 8, 25), at(2026, 8, 28), at(2026, 8, 30), at(2026, 9, 2), at(2026, 9, 6)];
  const a = adherence(done, 3, 8, now, at(2026, 8, 24));
  assert.equal(a.pct, 100); // only last week is a full counted week; the partial first week and this week are not met yet
  assert.equal(a.span, 3); // first week, last week, this week
  assert.equal(a.activeWeeks, 3);
  // Without a start date every one of the 8 weeks counts, as before: 4 of 21 over the 7 full weeks.
  assert.equal(adherence(done, 3, 8, now).pct, 19);
  assert.equal(adherence(done, 3, 8, now).span, 8);
  // A brand-new account mid-way through its first week has no counted week yet (the screen shows no percentage).
  const fresh = adherence([at(2026, 9, 6)], 3, 8, now, at(2026, 9, 5));
  assert.equal(fresh.counted, 0);
  assert.equal(fresh.span, 1);
});

test('plans record the engine version that built them', () => {
  assert.equal(buildProgram(base).version, 7);
});

test('effort styles set per-set reps-in-reserve targets', async () => {
  const { effortTargets } = await import('./plan.ts');
  assert.deepEqual(effortTargets('last_failure', 'intermediate'), { rir: 2, last: 0 });
  assert.deepEqual(effortTargets('last_failure', 'beginner'), { rir: 2, last: 1 });
  assert.deepEqual(effortTargets('rir', 'advanced'), { rir: 2, last: 1 });
  assert.deepEqual(effortTargets('failure', 'beginner'), { rir: 0, last: 0 }); // explicit choice wins
  const p = buildProgram({ ...base, effort: 'rir' });
  assert.equal(p.effort, 'rir');
  assert.ok(p.days.flatMap((d) => d.exercises).every((e) => e.rirTarget === 2 && e.lastSetRir === 1));
});

test('progression judges each set against its own target', () => {
  const plan = { ...bench, rirTarget: 2, lastSetRir: 0 };
  // set 1 at 2 in reserve, last set at 0: exactly on plan -> normal step
  const onPlan = suggest(plan, [[{ weight: 60, reps: 10, rir: 2 }, { weight: 60, reps: 10, rir: 0 }]], 'intermediate', 'kg');
  assert.deepEqual([onPlan.kind, onPlan.weight], ['up', 62.5]);
  // both sets 2-3 more in reserve than planned -> too easy, double step
  const easy = suggest(plan, [[{ weight: 60, reps: 10, rir: 4 }, { weight: 60, reps: 10, rir: 3 }]], 'intermediate', 'kg');
  assert.deepEqual([easy.kind, easy.weight], ['up', 65]);
  // first set ground to failure when it should have stopped 2 short -> hold
  const ground = suggest(plan, [[{ weight: 60, reps: 8, rir: 0 }, { weight: 60, reps: 8, rir: 0 }]], 'intermediate', 'kg');
  assert.equal(ground.kind, 'hold');
  assert.ok(ground.explanation.text.includes('set 1'));
});

test('decision engine answers the next-step questions', async () => {
  const { decide, applySetChange, programAdvice } = await import('./decisions.ts');
  const plan = { exerciseId: 'bb_bench', sets: 2, repMin: 6, repMax: 10, rirTarget: 2, lastSetRir: 0 };
  const sess = (w: number, r: number, rir = 0) => [{ weight: w, reps: r, rir: 2 + rir }, { weight: w, reps: r, rir }];
  const good = { sleep: 4, soreness: 4, energy: 4 };
  const bad = { sleep: 1, soreness: 2, energy: 2 };
  const swapTo = { id: 'db_bench', name: 'Dumbbell bench press' };

  assert.equal(decide({ plan, sessions: [sess(60, 8), sess(60, 7)], checkins: [good], swapTo }).kind, 'too_new');
  // new best this session -> progressing
  assert.equal(decide({ plan, sessions: [sess(62.5, 8), sess(60, 9), sess(60, 8)], checkins: [good, good], swapTo }).kind, 'progressing');
  // two sessions without beating the earlier best, recovery fine -> add a set
  const add = decide({ plan, sessions: [sess(60, 8), sess(60, 8), sess(60, 9)], checkins: [good, good], swapTo });
  assert.deepEqual([add.kind, add.setsDelta], ['add_set', 1]);
  // same stall with rough check-ins -> recover, no extra set
  assert.equal(decide({ plan, sessions: [sess(60, 8), sess(60, 8), sess(60, 9)], checkins: [bad, good], swapTo }).kind, 'hold_recover');
  // falling two sessions in a row + rough check-ins -> one set fewer
  const less = decide({ plan, sessions: [sess(60, 6), sess(60, 7), sess(60, 8)], checkins: [bad, bad], swapTo });
  assert.deepEqual([less.kind, less.setsDelta], ['remove_set', -1]);
  // at 3 sets and stuck 4 sessions -> suggest a swap, never a 4th set
  const at3 = { ...plan, sets: 3 };
  const swap = decide({ plan: at3, sessions: [sess(60, 8), sess(60, 8), sess(60, 8), sess(60, 8), sess(60, 9)], checkins: [good, good], swapTo });
  assert.deepEqual([swap.kind, swap.swapTo, swap.setsDelta], ['swap', 'db_bench', 0]);
  assert.equal(decide({ plan: at3, sessions: [sess(60, 8), sess(60, 8), sess(60, 9)], checkins: [good], swapTo }).kind, 'hold_stalled');
  // pinned sets never change
  assert.equal(decide({ plan: { ...plan, pinnedSets: 2 }, sessions: [sess(60, 8), sess(60, 8), sess(60, 9)], checkins: [good], swapTo }).setsDelta, 0);
  // consistently far from target effort -> train closer to failure
  const easy = decide({ plan, sessions: [sess(62.5, 8, 3), sess(60, 8, 3), sess(57.5, 8, 3)], checkins: [good], swapTo });
  assert.equal(easy.kind, 'push_closer');

  assert.equal(applySetChange({ ...plan, sets: 3 }, 1).sets, 3); // cap 3
  assert.equal(applySetChange({ ...plan, sets: 1 }, -1).sets, 1); // floor 1
  assert.equal(applySetChange({ ...plan, pinnedSets: 2 }, 1).sets, 2);
  assert.ok(programAdvice([add, add, swap, less]));
  assert.equal(programAdvice([add]), null);
});

test('exercise selection quality: compound mains, no repeated movement, every muscle weekly', () => {
  for (const setup of ['commercial', 'home'] as const)
    for (const days of [2, 3, 4, 5, 6])
      for (const sessionMinutes of [30, 45, 60, 90]) {
        const p = buildProgram({ ...base, setup, days, sessionMinutes });
        // every muscle the equipment allows is trained at least once a week
        for (const m of MUSCLES) if (setup === 'commercial') assert.ok(p.weeklySets[m], `${setup} ${days}d ${sessionMinutes}min: no ${m}`);
        for (const d of p.days) {
          const ex = d.exercises.map((e) => EXERCISE_BY_ID[e.exerciseId]);
          for (const m of MUSCLES) {
            const mine = ex.filter((e) => e.muscle === m);
            if (m === 'biceps' || m === 'triceps') continue;
            assert.equal(new Set(mine.map((e) => e.pattern)).size, mine.length, `${d.name}: repeated ${m} movement`);
          }
          if (d.name.startsWith('Pull')) assert.ok(ex.some((e) => e.pattern === 'rear_delt'), `${d.name}: no rear delts`);
        }
      }
});

test('exercise library: 200+, unique, complete, staples cover every muscle', async () => {
  const { EXERCISES } = await import('./exercises.ts');
  assert.ok(EXERCISES.length >= 200, `${EXERCISES.length} exercises`);
  assert.equal(new Set(EXERCISES.map((e) => e.id)).size, EXERCISES.length, 'duplicate id');
  for (const e of EXERCISES) {
    assert.ok(e.cues.length >= 3 && e.name, `${e.id} incomplete`);
    assert.ok(e.equipment.every((q) => SETUP_EQUIPMENT.commercial.includes(q)), `${e.id} uses equipment no gym setup has`);
  }
  for (const setup of ['commercial', 'home'] as const)
    for (const m of MUSCLES)
      assert.ok(EXERCISES.some((e) => e.staple !== false && e.muscle === m && e.equipment.every((q) => SETUP_EQUIPMENT[setup].includes(q))), `${setup}: no staple for ${m}`);
});

test('security: user-facing errors never echo server text', async () => {
  const { friendlyError, friendlyAuthError } = await import('../lib/errors.ts');
  const leak = 'duplicate key value violates unique constraint "workouts_client_id" on table public.workouts';
  for (const msg of [friendlyError({ code: '23505', message: leak }), friendlyError(new Error(leak)), friendlyError(undefined)]) {
    assert.ok(!/constraint|table|public\.|key value/i.test(msg), msg);
  }
  assert.match(friendlyError({ code: 'P0001', message: 'rate limit exceeded' }), /too often/);
  // no account-existence hint on sign-up or sign-in failures
  const taken = friendlyAuthError({ message: 'User already registered' });
  const wrong = friendlyAuthError({ message: 'Invalid login credentials' });
  assert.equal(taken, wrong);
  assert.ok(!/already|registered|exists/i.test(taken));
  assert.match(friendlyAuthError({ message: 'Too many requests', status: 429 }), /Too many attempts/);
});

test('coverage "regions": every region of each muscle on every day it is trained; sets go to 1 before a region is dropped', () => {
  const name = (id: string) => EXERCISE_BY_ID[id].name;
  for (const setup of ['commercial', 'home'] as const) {
    for (const sessionMinutes of [30, 45, 60, 90]) {
      const p = buildProgram({ experience: 'intermediate', goal: 'muscle', setup, days: 4, sessionMinutes, unit: 'kg', avoid: [], coverage: 'regions' }, 'upper_lower');
      assert.equal(p.coverage, 'regions');
      const upper = p.days[0].exercises.map((e) => EXERCISE_BY_ID[e.exerciseId]);
      const chest = upper.filter((e) => e.muscle === 'chest');
      if (sessionMinutes >= 45) {
        // upper chest (incline) and mid/lower chest both trained the same day
        assert.ok(chest.some((e) => e.id.includes('incline')) && chest.some((e) => !e.id.includes('incline')), `${setup} ${sessionMinutes}: ${chest.map((e) => name(e.id))}`);
        assert.ok(upper.some((e) => e.id.includes('overhead') && e.muscle === 'triceps'), `${setup} ${sessionMinutes}: no overhead triceps`);
        for (const pat of ['lateral_raise', 'rear_delt', 'vertical_push']) assert.ok(upper.some((e) => e.pattern === pat), `${setup} ${sessionMinutes}: no ${pat}`);
      }
      // a region is only dropped once every set is already down to 1
      const full = buildProgram({ experience: 'intermediate', goal: 'muscle', setup, days: 4, sessionMinutes: 999, unit: 'kg', avoid: [], coverage: 'regions' }, 'upper_lower');
      p.days.forEach((d, i) => {
        if (d.exercises.length < full.days[i].exercises.length) assert.ok(d.exercises.every((e) => e.sets === 1), `${setup} ${sessionMinutes} ${d.name}: region dropped before sets`);
      });
    }
  }
  // Default and older plans are unchanged: one main exercise per muscle.
  const one = buildProgram({ experience: 'intermediate', goal: 'muscle', setup: 'commercial', days: 4, sessionMinutes: 45, unit: 'kg', avoid: [] }, 'upper_lower');
  assert.equal(one.coverage, 'muscle');
  assert.ok(one.days[0].exercises.length <= 8);
  // Pull days keep their rear-delt-only shoulders.
  const ppl = buildProgram({ experience: 'intermediate', goal: 'muscle', setup: 'commercial', days: 3, sessionMinutes: 90, unit: 'kg', avoid: [], coverage: 'regions' }, 'ppl');
  assert.ok(ppl.days[1].exercises.map((e) => EXERCISE_BY_ID[e.exerciseId]).filter((e) => e.muscle === 'shoulders').every((e) => e.pattern === 'rear_delt'));
});

test('history rows newest-first (save_workout timestamps each set) still give sets in the order they were done', async () => {
  const { sessionsFromRows } = await import('./session.ts');
  const { suggest } = await import('./progression.ts');
  // One session, 3 sets of 8 at 60 kg: 2, 2 in reserve, last set to failure. Newest first = last set first.
  const rows = [
    { workout_id: 'w2', weight: '60', reps: 8, rir: 0, set_index: 2 },
    { workout_id: 'w2', weight: '60', reps: 8, rir: 2, set_index: 1 },
    { workout_id: 'w2', weight: '60', reps: 8, rir: 2, set_index: 0 },
    { workout_id: 'w1', weight: '57.5', reps: 8, rir: 0, set_index: 1 },
    { workout_id: 'w1', weight: '57.5', reps: 8, rir: 2, set_index: 0 },
  ];
  const s = sessionsFromRows(rows, 6);
  assert.deepEqual(s[0].map((x) => x.rir), [2, 2, 0]);
  assert.equal(s[0][0].weight, 60);
  assert.equal(s.length, 2);
  assert.equal(sessionsFromRows(rows, 1).length, 1);
  // The failure set is the planned last set: not an overshoot, so no "hold".
  const plan = { exerciseId: 'bb_bench', sets: 3, repMin: 6, repMax: 10, rirTarget: 2, lastSetRir: 0 };
  assert.notEqual(suggest(plan, s, 'intermediate', 'kg').kind, 'hold');
});

test('swap alternatives leave out exercises already in the workout', () => {
  const all = substitutes('bb_bench', 'commercial', []);
  assert.ok(all.some((e) => e.id === 'db_bench'));
  const left = substitutes('bb_bench', 'commercial', [], ['bb_bench', 'db_bench']);
  assert.ok(left.length > 0 && left.every((e) => e.id !== 'db_bench' && e.id !== 'bb_bench'));
});

test('week dots count calendar days, also in a daylight-saving fall-back week', async () => {
  const tz = process.env.TZ;
  process.env.TZ = 'America/New_York'; // DST ends Sun Nov 1 2026: that week is 169 hours long
  try {
    const { weekDots } = await import('../lib/stats.ts');
    const now = new Date(2026, 10, 1, 23, 50); // Sun Nov 1, 23:50 local
    const late = new Date(2026, 10, 1, 23, 30).toISOString(); // Sunday 23:30, inside the extra hour of the week
    const monday = new Date(2026, 9, 26, 7, 0).toISOString();
    assert.deepEqual(weekDots([late, monday], now), [true, false, false, false, false, false, true]);
  } finally {
    if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz;
  }
});

test('a performance drop lands on the plate grid and holds below one step', async () => {
  const { suggest } = await import('./progression.ts');
  const plan = { exerciseId: 'bb_bench', sets: 2, repMin: 8, repMax: 12, rirTarget: 2 };
  const low = (w: number) => [{ weight: w, reps: 5, rir: 0 }, { weight: w, reps: 5, rir: 0 }];
  for (const w of [61, 57.3, 22.6, 100.1]) {
    const s = suggest(plan, [low(w), low(w)], 'intermediate', 'kg');
    assert.equal(s.kind, 'drop');
    assert.equal(Math.round(s.weight! * 1000) % 2500, 0, `${w} -> ${s.weight}`);
    assert.ok(s.weight! < w);
  }
  assert.equal(suggest(plan, [low(2.6), low(2.6)], 'intermediate', 'kg').kind, 'hold'); // never "lift 0.1 kg"
});

test('streak survives the week after a daylight-saving change', async () => {
  const { streakWeeks } = await import('../lib/stats.ts');
  // NY: DST ends Sun Nov 1 2026. Workouts in the two weeks before; "now" is Monday Nov 2 with none yet this week.
  const done = [new Date(2026, 9, 21, 18).toISOString(), new Date(2026, 9, 28, 18).toISOString()];
  const tzOffsetChanges = new Date(2026, 9, 26).getTimezoneOffset() !== new Date(2026, 10, 2).getTimezoneOffset();
  assert.equal(streakWeeks(done, new Date(2026, 10, 2, 9)), 2, `host DST change: ${tzOffsetChanges}`);
});
