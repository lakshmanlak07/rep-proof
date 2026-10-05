import { available, EXERCISE_BY_ID } from './exercises.ts';
import type {
  Effort, Exercise, Experience, Explanation, Goal, Muscle, PlannedDay, PlannedExercise, Profile, Program, SplitId,
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

export const MUSCLE_NAMES: Record<Muscle, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', quads: 'Quads', hamstrings: 'Hamstrings',
  glutes: 'Glutes', biceps: 'Biceps', triceps: 'Triceps', calves: 'Calves',
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

// Bump when plan rules change; saved plans from older versions are rebuilt automatically.
// 2 = founder model: 1-3 sets, warm-up every exercise, weak/strong points.
// 3 = effort styles (default: last set to failure, others 1-3 in reserve), isolation reps 10-15.
// 4 = sessions filled with second movements up to the time limit (max 8 exercises).
export const ENGINE_VERSION = 4;

// Muscles that get a second movement first when a session has time (weak points always come before these).
const SECOND_PRIORITY: Muscle[] = ['back', 'chest', 'quads', 'hamstrings', 'glutes', 'shoulders', 'biceps', 'triceps', 'calves'];
const MAX_EXERCISES = 8;

// Founder rule (2026-10-04): 1-3 working sets per exercise, never more.
// 3 for weak points that need emphasis, 1 for strong points, 2 for everything else.
export const MAX_SETS = 3;
export function setsFor(m: Muscle, profile: Pick<Profile, 'weak' | 'strong'>): number {
  if (profile.weak?.includes(m)) return 3;
  if (profile.strong?.includes(m)) return 1;
  return 2;
}

// Session time model (RepProof rule): warm-up set ~1.5 min, each working set to failure + rest ~3 min.
const WARMUP_MINUTES = 1.5;
const MINUTES_PER_SET = 3;
export const exerciseMinutes = (sets: number) => WARMUP_MINUTES + sets * MINUTES_PER_SET;

export function repRange(goal: Goal, compound: boolean): [number, number] {
  if (!compound) return [10, 15]; // broad ranges work when sets are hard; isolation sits higher
  if (goal === 'strength') return [5, 8];
  if (goal === 'both') return [6, 8];
  return [6, 10];
}

export const EFFORT_NAMES: Record<Effort, { label: string; hint: string }> = {
  last_failure: { label: 'Last set to failure', hint: 'Earlier sets stop about 2 reps short; the last set goes all the way' },
  rir: { label: 'All sets 1-3 reps short', hint: 'Never to failure; least fatigue' },
  failure: { label: 'Every set to failure', hint: 'Most effort per set; most fatigue' },
};

/** Reps-in-reserve targets for an effort style. Beginners on the default stop 1 short on the last set too (safety call). */
export function effortTargets(effort: Effort, experience: Experience): { rir: number; last: number } {
  if (effort === 'failure') return { rir: 0, last: 0 };
  if (effort === 'rir') return { rir: 2, last: 1 };
  return { rir: 2, last: experience === 'beginner' ? 1 : 0 };
}

/** Default reps-in-reserve for the non-final sets (used for exercises added during a workout). */
export function rirTarget(experience: Experience, effort: Effort = 'last_failure'): number {
  return effortTargets(effort, experience).rir;
}

export function buildProgram(profile: Profile, split: SplitId = recommendSplit(profile.days)): Program {
  const cycle = SPLIT_CYCLE[split];
  const dayTemplates = Array.from({ length: profile.days }, (_, i) => cycle[i % cycle.length]);
  const pool = available(profile.setup, profile.avoid);
  const emphasis = { weak: profile.weak ?? [], strong: (profile.strong ?? []).filter((m) => !profile.weak?.includes(m)) };
  const effort: Effort = profile.effort ?? 'last_failure';
  const targets = effortTargets(effort, profile.experience);
  const explanations: Explanation[] = [];
  let trimmed = false;

  explanations.push({
    text: `${SPLIT_NAMES[split]} over ${profile.days} days. When weekly sets are equal, how often you train a muscle made no meaningful difference to growth across 25 studies, so the split is about fitting your schedule.`,
    label: 'direct',
    refIds: ['frequency_meta', 'frequency_2v3', 'frequency_3v6'],
  });

  // One exercise per muscle per session, 1-3 working sets each. On short days (3 muscles or fewer,
  // e.g. Pull) big muscles get a second exercise with a different movement (row + pulldown).
  const seen: Partial<Record<Muscle, number>> = {};
  const days: PlannedDay[] = dayTemplates.map((t) => {
    const trainable = t.muscles.filter((m) => pool.some((e) => e.muscle === m));
    const slots: { m: Muscle; sets: number; second: boolean }[] = trainable.map((m) => ({ m, sets: setsFor(m, emphasis), second: false }));
    const minutes = () => slots.reduce((a, x) => a + exerciseMinutes(x.sets), 0);
    // Fill the session: weak points, then big muscles, get a second movement while time allows.
    const order = [...emphasis.weak, ...SECOND_PRIORITY.filter((m) => !emphasis.weak.includes(m))];
    for (const m of order) {
      if (!trainable.includes(m) || emphasis.strong.includes(m) || slots.length >= MAX_EXERCISES) continue;
      if (pool.filter((e) => e.muscle === m).length < 2) continue;
      const sets = setsFor(m, emphasis);
      if (minutes() + exerciseMinutes(sets) > profile.sessionMinutes) continue;
      slots.splice(slots.findIndex((x) => x.m === m) + 1, 0, { m, sets, second: true });
    }
    // Fit the session length: drop second exercises first, then take a set from regular muscles
    // (smallest muscles first), then from weak points. Strong points are already at 1 set.
    for (let i = slots.length - 1; i >= 0 && minutes() > profile.sessionMinutes; i--) {
      if (slots[i].second) {
        slots.splice(i, 1);
        trimmed = true;
      }
    }
    for (const pass of ['regular', 'weak'] as const) {
      for (let changed = true; changed && minutes() > profile.sessionMinutes;) {
        changed = false;
        for (let i = slots.length - 1; i >= 0 && minutes() > profile.sessionMinutes; i--) {
          if ((pass === 'weak') === emphasis.weak.includes(slots[i].m) && slots[i].sets > 1) {
            slots[i].sets--;
            trimmed = changed = true;
          }
        }
      }
    }
    const picked: { ex: Exercise; sets: number }[] = [];
    for (const { m, sets, second } of slots) {
      const candidates = rankCandidates(pool.filter((e) => e.muscle === m), profile.experience);
      if (second) {
        const first = picked.find((p) => p.ex.muscle === m)!.ex;
        const other = candidates.find((e) => e.id !== first.id && e.pattern !== first.pattern) ?? candidates.find((e) => e.id !== first.id)!;
        picked.push({ ex: other, sets });
        continue;
      }
      const nth = seen[m] ?? 0;
      seen[m] = nth + 1;
      picked.push({ ex: candidates[nth % candidates.length], sets });
    }
    picked.sort((a, b) => Number(b.ex.compound) - Number(a.ex.compound));
    const exercises: PlannedExercise[] = picked.map(({ ex, sets }) => {
      const [repMin, repMax] = repRange(profile.goal, ex.compound);
      return { exerciseId: ex.id, sets, repMin, repMax, rirTarget: targets.rir, lastSetRir: targets.last };
    });
    return { name: t.name, exercises };
  });

  // "Full body A", "Full body B"... when a day name repeats in the week
  const names = days.map((d) => d.name);
  days.forEach((d, i) => {
    const same = names.filter((n) => n === names[i]).length;
    if (same > 1) d.name = `${names[i]} ${'ABCDEF'[names.slice(0, i).filter((n) => n === names[i]).length]}`;
  });

  const weeklySets = weeklySetsOf(days);

  const list = (ms: Muscle[]) => ms.map((m) => MUSCLE_NAMES[m].toLowerCase()).join(', ');
  explanations.push({
    text: `1 to 3 hard sets per exercise, plus a warm-up set: 2 by default${emphasis.weak.length ? `, 3 for your weak points (${list(emphasis.weak)})` : ', 3 for weak points'}${emphasis.strong.length ? `, 1 for your strong points (${list(emphasis.strong)})` : ', 1 for strong points'}. Fewer, harder sets keep fatigue in check. On average, more weekly sets meant more growth with diminishing returns, so sets then adapt to you: a lift that stalls for 2 sessions while you recover well gets a set (up to 3), and one that goes backwards with rough check-ins loses one. The exact numbers are our rules.`,
    label: 'rule',
    refIds: ['volume_dose'],
  });
  if (trimmed) {
    explanations.push({
      text: `Some sets were cut so each session fits in ${profile.sessionMinutes} minutes (about ${MINUTES_PER_SET} minutes per hard set and ${WARMUP_MINUTES} per warm-up). Weak points keep their sets longest.`,
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
  explanations.push({
    text: profile.goal === 'muscle'
      ? 'Reps from 6 to 15: 6-10 on big lifts, 10-15 on isolation work. Muscle grew similarly across light and heavy loads when sets were hard, so no single rep range is magic; these ranges are practical, not special.'
      : 'Heavier sets (5 to 8 reps) on the big lifts. Muscle grows across a wide range of loads, but heavier loads build more max strength.',
    label: 'principle',
    refIds: ['load_meta'],
  });
  const effortText: Record<Effort, string> = {
    last_failure: `${EFFORT_NAMES.last_failure.label}${targets.last ? ' (1 rep short while you learn the lifts)' : ''}: earlier sets stop about ${targets.rir} reps short, the last set goes as far as it can. Getting close to failure matters; reaching it every set was not needed for growth on average, so this keeps effort high and fatigue in check.`,
    rir: `${EFFORT_NAMES.rir.label}: sets stop 1 to 3 reps before failure. Training to failure was not required for strength or size on average, and stopping short costs less fatigue.`,
    failure: `${EFFORT_NAMES.failure.label}: your choice. Failure was not required for growth on average; trained lifters saw a small extra size benefit, at a higher fatigue cost. If recovery suffers, try "last set to failure".`,
  };
  explanations.push({ text: effortText[effort], label: 'principle', refIds: ['failure'] });
  explanations.push(REST_WHY);

  return { split, weeklySets, days, explanations, emphasis, effort, version: ENGINE_VERSION };
}

/** Planned hard sets per muscle per week (pins count). Recomputed whenever the plan changes. */
export function weeklySetsOf(days: PlannedDay[]): Partial<Record<Muscle, number>> {
  const out: Partial<Record<Muscle, number>> = {};
  for (const d of days) for (const e of d.exercises) {
    const m = EXERCISE_BY_ID[e.exerciseId].muscle;
    out[m] = (out[m] ?? 0) + (e.pinnedSets ?? e.sets);
  }
  return out;
}

// Beginners get easier lifts first; otherwise library order (compounds lead).
function rankCandidates(list: Exercise[], experience: Experience): Exercise[] {
  if (experience !== 'beginner') return list;
  return [...list].sort((a, b) => Number(a.difficulty === 3) - Number(b.difficulty === 3));
}
