import type { CheckIn, Explanation, LoggedSet, Muscle } from './types.ts';
import { isBadDay } from './progression.ts';

// Cooldown checklist: generic stretches for the muscles trained. No injury or pain claims (PRD).
const STRETCHES: Record<Muscle, string> = {
  chest: 'Doorway chest stretch, 30 s per side',
  back: 'Hang or child’s pose reach, 30 s',
  shoulders: 'Cross-body shoulder stretch, 30 s per side',
  quads: 'Standing quad stretch, 30 s per side',
  hamstrings: 'Standing hamstring stretch, 30 s per side',
  glutes: 'Figure-four stretch, 30 s per side',
  biceps: 'Wall biceps stretch, 30 s per side',
  triceps: 'Overhead triceps stretch, 30 s per side',
  calves: 'Wall calf stretch, 30 s per side',
  abs: 'Cobra stretch, 30 s',
};

export type SetRow = { workout_id: string; weight: number | string; reps: number; rir: number | null; set_index: number };

/**
 * Logged-set rows (newest first) grouped into the last `n` sessions, newest session first, each session's sets in the
 * order they were done. Rows of one workout carry increasing timestamps (save_workout, migration 6), so a newest-first
 * query returns them last set first; set_index is the order, never the timestamp.
 */
export function sessionsFromRows(rows: SetRow[], n: number): LoggedSet[][] {
  const order: string[] = [];
  const byWorkout = new Map<string, SetRow[]>();
  for (const r of rows) {
    if (!byWorkout.has(r.workout_id)) {
      if (order.length === n) break;
      order.push(r.workout_id);
      byWorkout.set(r.workout_id, []);
    }
    byWorkout.get(r.workout_id)!.push(r);
  }
  return order.map((id) => byWorkout.get(id)!
    .sort((a, b) => a.set_index - b.set_index)
    .map((r) => ({ weight: Number(r.weight), reps: r.reps, rir: r.rir })));
}

export function cooldown(muscles: Muscle[]): string[] {
  return [...new Set(muscles)].slice(0, 4).map((m) => STRETCHES[m]);
}

/** A session counts as missed when the gap since the last workout is clearly longer than the plan's rhythm. RepProof rule. */
export function isMissed(daysSinceLast: number | null, daysPerWeek: number): boolean {
  if (daysSinceLast === null) return false;
  return daysSinceLast > Math.ceil(7 / daysPerWeek) + 1;
}

export type RecentWorkout = { checkin: CheckIn | null; perfDrops: number };

/** Offer a deload when performance drops and poor check-ins pile up over the last 4 workouts. */
export function deloadOffer(recent: RecentWorkout[]): Explanation | null {
  const last = recent.slice(0, 4);
  const bad = last.filter((w) => w.checkin && isBadDay(w.checkin)).length;
  const drops = last.reduce((a, w) => a + w.perfDrops, 0);
  if (bad < 2 || drops < 2) return null;
  return {
    text: `${bad} rough check-ins and ${drops} lifts going backwards in your last ${last.length} workouts. A lighter week (half the sets, same weights) may help. One study found a week off hurt lower-body strength, so RepProof deloads by cutting volume instead of stopping.`,
    label: 'principle',
    refIds: ['deload'],
  };
}
