import { available } from './exercises.ts';
import type {
  Exercise, Experience, Explanation, Goal, Muscle, PlannedDay, PlannedExercise, Profile, Program, SplitId,
} from './types.ts';

export const MUSCLES: Muscle[] = ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes', 'biceps', 'triceps', 'calves'];

const UPPER: Muscle[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps'];
const LOWER: Muscle[] = ['quads', 'hamstrings', 'glutes', 'calves'];
const PUSH: Muscle[] = ['chest', 'shoulders', 'triceps'];
const PULL: Muscle[] = ['back', 'biceps'];

// One cycle of each split; repeated to fill the week.
const SPLIT_CYCLE: Record<SplitId, { name: string; muscles: Muscle[] }[]> = {
  full_body: [{ name: 'Full body', muscles: MUSCLES }],
  upper_lower: [{ name: 'Upper', muscles: UPPER }, { name: 'Lower', muscles: LOWER }],
  ppl: [{ name: 'Push', muscles: PUSH }, { name: 'Pull', muscles: PULL }, { name: 'Legs', muscles: LOWER }],
  ulppl: [
    { name: 'Upper', muscles: UPPER }, { name: 'Lower', muscles: LOWER },
    { name: 'Push', muscles: PUSH }, { name: 'Pull', muscles: PULL }, { name: 'Legs', muscles: LOWER },
  ],
};

export const SPLIT_NAMES: Record<SplitId, string> = {
  full_body: 'Full body', upper_lower: 'Upper / lower', ppl: 'Push / pull / legs', ulppl: 'Upper / lower / push / pull / legs',
};

// Day counts each split supports.
export const SPLIT_DAYS: Record<SplitId, number[]> = {
  full_body: [2, 3, 4], upper_lower: [2, 4], ppl: [3, 6], ulppl: [5],
};

export const REST_WHY: Explanation = {
  text: 'Rest about 90 seconds on single-joint lifts and 2.5 minutes on big compound lifts. Resting over 60 seconds showed a small growth benefit with little difference past 90 seconds; for heavy compounds, 3 minutes beat 1 minute for strength and size in trained men.',
  label: 'principle',
  refIds: ['rest', 'rest_long'],
};

export function recommendSplit(days: number): SplitId {
  if (days <= 3) return 'full_body';
  if (days === 4) return 'upper_lower';
  if (days === 5) return 'ulppl';
  return 'ppl';
}

// PRD starting volume: beginner 6-10, intermediate 10-16, advanced 12-20 sets/muscle/week.
const BASE_WEEKLY_SETS: Record<Experience, number> = { beginner: 8, intermediate: 12, advanced: 14 };
const MINUTES_PER_SET = 3; // working set + rest; RepProof rule

export function repRange(goal: Goal, compound: boolean): [number, number] {
  if (!compound) return [8, 12];
  if (goal === 'strength') return [5, 8];
  if (goal === 'both') return [6, 8];
  return [6, 10];
}

function rirTarget(experience: Experience): number {
  return experience === 'beginner' ? 3 : 2;
}

export function buildProgram(profile: Profile, split: SplitId = recommendSplit(profile.days)): Program {
  const cycle = SPLIT_CYCLE[split];
  const dayTemplates = Array.from({ length: profile.days }, (_, i) => cycle[i % cycle.length]);
  const explanations: Explanation[] = [];

  explanations.push({
    text: `${SPLIT_NAMES[split]} over ${profile.days} days. When weekly sets are equal, how often you train a muscle made no meaningful difference to growth across 25 studies, so the split is about fitting your schedule.`,
    label: 'direct',
    refIds: ['frequency_meta', 'frequency_2v3', 'frequency_3v6'],
  });

  // 1. Volume allocator. Sets are handed out one at a time, rotating through muscles; each set goes
  // to the least-loaded session that trains that muscle. Busy days fill first and quieter days
  // (e.g. Pull in a 5-day split) absorb the rest, until each muscle hits the target or sessions are full.
  const pool = available(profile.setup, profile.avoid);
  const trainable = MUSCLES.filter((m) => pool.some((e) => e.muscle === m));
  const base = BASE_WEEKLY_SETS[profile.experience];
  const sessionCap = Math.floor(profile.sessionMinutes / MINUTES_PER_SET);
  // At most 2 exercises x 5 sets per muscle per session; fewer when the pool has one exercise.
  const perSessionMax = (m: Muscle) => 5 * Math.min(2, pool.filter((e) => e.muscle === m).length);
  const alloc: Partial<Record<Muscle, number>>[] = dayTemplates.map(() => ({}));
  const load = dayTemplates.map(() => 0);
  const given = Object.fromEntries(trainable.map((m) => [m, 0])) as Record<Muscle, number>;
  for (let progress = true; progress;) {
    progress = false;
    for (const m of trainable) {
      if (given[m] >= base) continue;
      let best = -1;
      dayTemplates.forEach((d, i) => {
        if (!d.muscles.includes(m) || load[i] >= sessionCap || (alloc[i][m] ?? 0) >= perSessionMax(m)) return;
        const better = best === -1 || load[i] < load[best]
          || (load[i] === load[best] && (alloc[i][m] ?? 0) < (alloc[best][m] ?? 0));
        if (better) best = i;
      });
      if (best === -1) continue;
      alloc[best][m] = (alloc[best][m] ?? 0) + 1;
      load[best]++;
      given[m]++;
      progress = true;
    }
  }
  const weeklySets: Partial<Record<Muscle, number>> = {};
  for (const m of trainable) if (given[m]) weeklySets[m] = given[m];

  explanations.push({
    text: `Starting at about ${base} hard sets per muscle per week for your experience level. More weekly sets tends to mean more growth, but no study has found one best number, so the exact start is our choice.`,
    label: 'principle',
    refIds: ['volume_dose'],
  });
  const counts = Object.values(weeklySets) as number[];
  const low = Math.min(...counts);
  const high = Math.max(...counts);
  if (low < base) {
    explanations.push({
      text: `Trimmed to ${low === high ? low : `${low}-${high}`} sets per muscle so each session fits in ${profile.sessionMinutes} minutes (about ${MINUTES_PER_SET} minutes per set including rest).`,
      label: 'rule',
      refIds: [],
    });
  }
  const skipped = MUSCLES.filter((m) => !weeklySets[m]);
  if (skipped.length) {
    explanations.push({
      text: `No exercise left for ${skipped.join(', ')} with your equipment and the movements you avoid, so they are not in the plan.`,
      label: 'rule',
      refIds: [],
    });
  }

  // 2. Split distributor + 3. exercise selector
  const seen: Partial<Record<Muscle, number>> = {};
  const days: PlannedDay[] = dayTemplates.map((t, dayIndex) => {
    const picked: { ex: Exercise; sets: number }[] = [];
    for (const m of t.muscles) {
      const perDay = alloc[dayIndex][m] ?? 0;
      if (!perDay) continue;
      const nth = seen[m] ?? 0;
      seen[m] = nth + 1;
      const candidates = rankCandidates(pool.filter((e) => e.muscle === m), profile.experience);
      const count = perDay > 4 && candidates.length > 1 ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const ex = candidates[(nth * count + k) % candidates.length];
        picked.push({ ex, sets: Math.ceil(perDay / count) - (k === 1 && perDay % 2 ? 1 : 0) });
      }
    }
    picked.sort((a, b) => Number(b.ex.compound) - Number(a.ex.compound));
    const exercises: PlannedExercise[] = picked.map(({ ex, sets }) => {
      const [repMin, repMax] = repRange(profile.goal, ex.compound);
      return { exerciseId: ex.id, sets, repMin, repMax, rirTarget: rirTarget(profile.experience) };
    });
    return { name: t.name, exercises };
  });
  // "Full body A", "Full body B"... when a day name repeats in the week
  const names = days.map((d) => d.name);
  days.forEach((d, i) => {
    const same = names.filter((n) => n === names[i]).length;
    if (same > 1) d.name = `${names[i]} ${'ABCDEF'[names.slice(0, i).filter((n) => n === names[i]).length]}`;
  });

  explanations.push({
    text: profile.goal === 'muscle'
      ? 'Reps mostly 6 to 12. Muscle grows similarly across light and heavy loads, so the range is about practicality: heavy enough to track, light enough to recover.'
      : 'Heavier sets (5 to 8 reps) on the big lifts. Muscle grows across a wide range of loads, but heavier loads build more max strength.',
    label: 'principle',
    refIds: ['load_meta'],
  });
  explanations.push({
    text: `Sets stop about ${rirTarget(profile.experience)} reps short of failure. Going to failure was not needed for strength or size gains on average; trained lifters saw a small extra benefit, so the target is our trade-off between results and recovery.`,
    label: 'principle',
    refIds: ['failure'],
  });
  explanations.push({
    text: 'Guessing reps left is imperfect, but it gets more accurate with heavier loads and closer to failure. Trained lifters were off by under one rep on average on the bench press.',
    label: 'principle',
    refIds: ['rir_accuracy', 'rir_bench'],
  });
  explanations.push(REST_WHY);

  return { split, weeklySets, days, explanations };
}

// Beginners get easier lifts first; otherwise library order (compounds lead).
function rankCandidates(list: Exercise[], experience: Experience): Exercise[] {
  if (experience !== 'beginner') return list;
  return [...list].sort((a, b) => Number(a.difficulty === 3) - Number(b.difficulty === 3));
}
