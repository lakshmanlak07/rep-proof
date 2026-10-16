// Turning logged set rows into a save, and explaining why a save failed. Plain TypeScript: unit-tested.
// Limits match the database checks (migration 2: weight <= 2000, reps <= 200, whole reps; rir 0-10), so a
// value the server would refuse is caught on the phone with a clear message instead of failing every retry.
// RPE (migration 6) is optional: 1-10 in half steps.
import { isRpe, rirFromRpe } from '../engine/effort.ts';

export type SetRow = { weight: string; reps: string; rir: string; done: boolean; rpe?: string };
export type SaveSet = {
  exerciseId: string; setIndex: number; weight: number; reps: number; rir: number | null; overridden: boolean; rpe: number | null;
};
type Item = { exerciseId: string; name: string; sets: SetRow[]; suggestion: { weight: number | null; reps: number } };

/** "62,5" (comma keyboards) and "62.5" both mean 62.5; blank is NaN. Use for every typed number in the app. */
// "1,000" could be a thousand or 1.000: ambiguous, so it is refused (the user retypes) rather than silently read as 1.
export const toNumber = (s: string) => {
  const t = s.trim();
  return /^-?(\d+[.,]?\d*|[.,]\d+)$/.test(t) && !/^-?\d+,\d{3}$/.test(t) ? Number(t.replace(',', '.')) : NaN;
};

export function parseWeight(s: string): number | null {
  const n = toNumber(s);
  return Number.isFinite(n) && n >= 0 && n <= 2000 ? Math.round(n * 100) / 100 : null;
}
export function parseReps(s: string): number | null {
  const n = toNumber(s);
  return Number.isInteger(n) && n >= 0 && n <= 200 ? n : null;
}
export function parseRir(s: string): number | null | undefined {
  if (s.trim() === '') return null; // not given
  const n = toNumber(s);
  return Number.isInteger(n) && n >= 0 && n <= 10 ? n : undefined; // undefined = invalid
}

export function parseRpe(s: string | undefined): number | null | undefined {
  if (!s || s.trim() === '') return null; // not given
  const n = toNumber(s);
  return isRpe(n) ? n : undefined; // undefined = invalid
}

/** Problem with one set row, or null if it can be saved. */
export function rowProblem(r: Pick<SetRow, 'weight' | 'reps' | 'rir' | 'rpe'>): string | null {
  if (parseWeight(r.weight) === null) return 'weight must be a number from 0 to 2000';
  if (parseReps(r.reps) === null) return 'reps must be a whole number from 0 to 200';
  if (parseRir(r.rir) === undefined) return 'reps in reserve must be 0 to 10';
  if (parseRpe(r.rpe) === undefined) return 'RPE must be 1 to 10 in half steps';
  return null;
}

/** Logged sets ready to save, plus what blocks saving. Unlogged sets are optional and never block. */
export function prepareSave(items: Item[]): { sets: SaveSet[]; problems: string[]; left: number } {
  const sets: SaveSet[] = [];
  const problems: string[] = [];
  let left = 0;
  for (const it of items) {
    let k = 0;
    it.sets.forEach((r, j) => {
      if (!r.done) { left++; return; }
      const problem = rowProblem(r);
      if (problem) { problems.push(`${it.name}, set ${j + 1}: ${problem}`); return; }
      const weight = parseWeight(r.weight)!;
      const rir = parseRir(r.rir) ?? null;
      const rpe = parseRpe(r.rpe) ?? null;
      const reps = parseReps(r.reps)!;
      sets.push({
        exerciseId: it.exerciseId, setIndex: k++, weight, reps, rir,
        overridden: weight !== it.suggestion.weight || reps !== it.suggestion.reps,
        // RPE is kept only while it still matches the RIR the engine uses. A set first rated in RPE and then
        // changed in RIR (scale switched mid-workout) would otherwise send a contradictory pair that the
        // server refuses (migration 6), failing the whole save over a value the lifter cannot see.
        rpe: rpe !== null && rir !== null && rirFromRpe(rpe) === rir ? rpe : null,
      });
    });
  }
  if (!sets.length && !problems.length) problems.push('Log at least one set to finish, or discard the workout.');
  return { sets, problems, left };
}

/** What to tell the user when saving fails. The workout stays on the phone in every case. */
export function saveFailure(e: unknown): string {
  const code = (e as { code?: string })?.code;
  if (code === 'P0001') return "You've saved a lot of workouts today. Try again later.";
  if (code === '22P02' || code === '23514' || code === '22023') return 'One of the logged values was refused. Check each set (tap a logged set to edit it), then try again.';
  if (code === '42501') return 'Your session has ended. Sign in again, then retry. The workout is kept on this phone.';
  return 'Could not reach RepProof. Check your connection and retry. The workout is kept on this phone.';
}

/**
 * Runs `fn` unless a run is already in progress (double taps, a tap during a slow save). The lock is released
 * when the run ends, success or failure, so Retry works. Returns false when the call was ignored.
 */
export async function once(lock: { current: boolean }, fn: () => Promise<void>): Promise<boolean> {
  if (lock.current) return false;
  lock.current = true;
  try {
    await fn();
    return true;
  } finally {
    lock.current = false;
  }
}
