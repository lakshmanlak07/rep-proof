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

const BIG: Muscle[] = ['back', 'chest', 'quads', 'hamstrings', 'glutes'];

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
  if (!compound) return [8, 12];
  if (goal === 'strength') return [5, 8];
  if (goal === 'both') return [6, 8];
  return [6, 10];
}

// Working sets go to failure; beginners stop one rep short while they learn the lifts (safety call).
export function rirTarget(experience: Experience): number {
  return experience === 'beginner' ? 1 : 0;
}

export function buildProgram(profile: Profile, split: SplitId = recommendSplit(profile.days)): Program {
  const cycle = SPLIT_CYCLE[split];
  const dayTemplates = Array.from({ length: profile.days }, (_, i) => cycle[i % cycle.length]);
  const pool = available(profile.setup, profile.avoid);
  const emphasis = { weak: profile.weak ?? [], strong: (profile.strong ?? []).filter((m) => !profile.weak?.includes(m)) };
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
    const slots: { m: Muscle; sets: number; second: boolean }[] = [];
    for (const m of trainable) {
      slots.push({ m, sets: setsFor(m, emphasis), second: false });
      if (trainable.length <= 3 && BIG.includes(m) && pool.filter((e) => e.muscle === m).length > 1) {
        slots.push({ m, sets: setsFor(m, emphasis), second: true });
      }
    }
    const minutes = () => slots.reduce((a, x) => a + exerciseMinutes(x.sets), 0);
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

  const weeklySets: Partial<Record<Muscle, number>> = {};
  for (const d of days) for (const e of d.exercises) {
    const m = pool.find((x) => x.id === e.exerciseId)!.muscle;
    weeklySets[m] = (weeklySets[m] ?? 0) + e.sets;
  }

  const list = (ms: Muscle[]) => ms.map((m) => MUSCLE_NAMES[m].toLowerCase()).join(', ');
  explanations.push({
    text: `1 to 3 hard sets per exercise, plus a warm-up set: 2 by default${emphasis.weak.length ? `, 3 for your weak points (${list(emphasis.weak)})` : ', 3 for weak points'}${emphasis.strong.length ? `, 1 for your strong points (${list(emphasis.strong)})` : ', 1 for strong points'}. Fewer, harder sets keep fatigue in check. On average, more weekly sets meant more growth, which is why weak points get the extra set; the exact numbers are our choice.`,
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
      ? 'Reps mostly 6 to 12. Muscle grows similarly across light and heavy loads, so the range is about practicality: heavy enough to track, light enough to recover.'
      : 'Heavier sets (5 to 8 reps) on the big lifts. Muscle grows across a wide range of loads, but heavier loads build more max strength.',
    label: 'principle',
    refIds: ['load_meta'],
  });
  explanations.push({
    text: rirTarget(profile.experience) === 0
      ? 'Every working set goes to failure: the last rep you can complete with good form. Failure was not required for growth on average, but trained lifters saw a small extra size benefit, and with only 1 to 3 sets each one should count.'
      : 'Working sets stop 1 rep short of failure while you learn the lifts; going all the way to failure adds risk before your technique is solid. Failure was not required for growth on average.',
    label: 'principle',
    refIds: ['failure'],
  });
  explanations.push(REST_WHY);

  return { split, weeklySets, days, explanations, emphasis };
}

// Beginners get easier lifts first; otherwise library order (compounds lead).
function rankCandidates(list: Exercise[], experience: Experience): Exercise[] {
  if (experience !== 'beginner') return list;
  return [...list].sort((a, b) => Number(a.difficulty === 3) - Number(b.difficulty === 3));
}
