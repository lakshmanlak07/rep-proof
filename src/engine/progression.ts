import type { CheckIn, Experience, Explanation, LoggedSet, PlannedExercise, Unit } from './types.ts';

export type Suggestion = {
  kind: 'calibrate' | 'drop' | 'hold' | 'up' | 'reps';
  weight: number | null; // null = calibrate: user picks the starting weight
  reps: number;
  sets: number;
  explanation: Explanation;
};

const INCREMENT: Record<Unit, number> = { kg: 2.5, lb: 5 };

const round = (w: number, unit: Unit) => Math.round(w / INCREMENT[unit]) * INCREMENT[unit];
const fmt = (w: number, unit: Unit) => `${w} ${unit}`;

/**
 * Next session's load and reps for one exercise, from what was actually logged.
 * `history` = previous sessions of this exercise, newest first, working sets only.
 */
export function suggest(
  plan: PlannedExercise,
  history: LoggedSet[][],
  experience: Experience,
  unit: Unit,
): Suggestion {
  const { repMin, repMax, rirTarget, sets } = plan;
  const inc = INCREMENT[unit];
  const last = history[0];

  if (!last?.length) {
    const text = experience === 'beginner'
      ? `First time on this one. Pick a weight that feels challenging for ${repMin} reps but you could do 2-3 more. Lighter is fine; the app adjusts from here.`
      : `First time on this one. Pick a weight you can do for ${repMin} reps with about ${rirTarget} left in the tank.`;
    return { kind: 'calibrate', weight: null, reps: repMin, sets, explanation: { text, label: 'rule', refIds: [] } };
  }

  const weight = Math.max(...last.map((s) => s.weight));
  const minReps = Math.min(...last.map((s) => s.reps));
  const rirs = last.map((s) => s.rir ?? rirTarget);
  const minRir = Math.min(...rirs);
  const avgRir = rirs.reduce((a, b) => a + b, 0) / rirs.length;
  const below = (session: LoggedSet[] | undefined) => !!session?.length && session.some((s) => s.reps < repMin);
  const usesRir = experience !== 'beginner';

  // Performance drop: under the rep range two sessions running.
  if (below(last) && below(history[1])) {
    const next = Math.max(0, Math.min(weight - inc, round(weight * 0.95, unit)));
    return {
      kind: 'drop', weight: next, reps: repMin, sets,
      explanation: { text: `Down to ${fmt(next, unit)}: you were under ${repMin} reps two sessions in a row. Resetting a little lets you build back up.`, label: 'rule', refIds: [] },
    };
  }
  if (below(last)) {
    return {
      kind: 'hold', weight, reps: repMin, sets,
      explanation: { text: `Same weight: you were under ${repMin} reps last time. One off session is not a trend.`, label: 'rule', refIds: [] },
    };
  }

  if (minReps >= repMax) {
    if (usesRir && avgRir >= rirTarget + 2) {
      const next = weight + 2 * inc;
      return {
        kind: 'up', weight: next, reps: repMin, sets,
        explanation: { text: `Up ${2 * inc} ${unit}: you hit all ${repMax} reps with about ${Math.round(avgRir)} in reserve, so it was too easy for one small step.`, label: 'direct', refIds: ['rir_autoreg'] },
      };
    }
    const next = weight + inc;
    return {
      kind: 'up', weight: next, reps: repMin, sets,
      explanation: { text: `Up ${inc} ${unit}: you hit the top of the range (${repMax} reps) on every set. Reps go back to ${repMin} and climb again.`, label: 'rule', refIds: [] },
    };
  }

  if (usesRir && minRir < rirTarget - 1) {
    return {
      kind: 'hold', weight, reps: minReps, sets,
      explanation: { text: `Same weight and reps: last time you went to ${minRir} in reserve, closer to failure than the target of ${rirTarget}. Match it with more left in the tank first.`, label: 'direct', refIds: ['rir_autoreg'] },
    };
  }

  const reps = Math.min(minReps + 1, repMax);
  return {
    kind: 'reps', weight, reps, sets,
    explanation: { text: `Same weight, aim for ${reps} reps: add reps until you reach ${repMax} on every set, then the weight goes up.`, label: 'rule', refIds: [] },
  };
}

/** User-pinned sets/reps win over the engine until unpinned. */
export function applyPins(s: Suggestion, plan: PlannedExercise): Suggestion {
  if (plan.pinnedSets === undefined && plan.pinnedReps === undefined) return s;
  return {
    ...s,
    sets: plan.pinnedSets ?? s.sets,
    reps: plan.pinnedReps ?? s.reps,
    explanation: { ...s.explanation, text: `${s.explanation.text} You pinned ${[plan.pinnedSets !== undefined && `${plan.pinnedSets} sets`, plan.pinnedReps !== undefined && `${plan.pinnedReps} reps`].filter(Boolean).join(' and ')}, so the app keeps that.` },
  };
}

// Bad day: any score of 1, or a total of 7 or less out of 15. RepProof rule.
export function isBadDay(c: CheckIn): boolean {
  return Math.min(c.sleep, c.soreness, c.energy) <= 1 || c.sleep + c.soreness + c.energy <= 7;
}

/** Applies a bad check-in or a deload on top of a suggestion. Never raises load. */
export function adjustForDay(s: Suggestion, lastWeight: number | null, opts: { badDay: boolean; deload: boolean }): Suggestion {
  const holdWeight = s.weight !== null && lastWeight !== null ? Math.min(s.weight, lastWeight) : s.weight;
  if (opts.deload) {
    return {
      ...s, weight: holdWeight, sets: Math.ceil(s.sets / 2),
      explanation: { text: 'Deload: half the sets, same weight. A lighter week keeps the habit going without losing progress.', label: 'principle', refIds: ['deload'] },
    };
  }
  if (opts.badDay) {
    return {
      ...s, weight: holdWeight, sets: Math.max(1, s.sets - 1),
      explanation: { text: 'Rough check-in today: one set fewer and no weight increase. Short self-reported check-ins track how training is going.', label: 'principle', refIds: ['checkins'] },
    };
  }
  return s;
}

// Warm-up ramp before the first compound: bar x10, 50% x5, 75% x3. RepProof rule.
export function warmup(workWeight: number, unit: Unit, barWeight = unit === 'kg' ? 20 : 45): { weight: number; reps: number }[] {
  return [
    { weight: barWeight, reps: 10 },
    { weight: Math.max(barWeight, round(workWeight * 0.5, unit)), reps: 5 },
    { weight: Math.max(barWeight, round(workWeight * 0.75, unit)), reps: 3 },
  ];
}
