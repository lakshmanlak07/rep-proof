// RIR calibration aid (backlog E-02). Opt-in, isolation exercises only, never changes the plan.
// Protocol: in one extra set, the lifter notes the rep count when they believe N reps are left (their guess),
// then continues to failure with good form. Reps actually left at the guess = total reps - reps at the guess.
// One rep-out is one noisy sample (failure varies day to day), so the summary only names a tendency after 3.
import type { Exercise, Explanation } from './types.ts';

export type CalibrationEntry = { exerciseId: string; predicted: number; actual: number; at: string };

export const CALIBRATION_WHY: Explanation = {
  text: 'People are imperfect at guessing reps in reserve; guesses tend to get more accurate closer to failure, with heavier loads and in later sets. In trained lifters, guesses of 1 and 3 reps left were off by about two thirds of a rep on average. A rep-out on a safe isolation exercise lets you compare your guess with what you could actually do. It is one sample, not a measurement of your accuracy, and it does not change your plan.',
  label: 'direct', refIds: ['rir_accuracy', 'rir_bench'],
};

/** Only isolation movements: going to failure on heavy compounds carries more injury risk. */
export const canCalibrate = (ex: Pick<Exercise, 'compound'> | undefined) => !!ex && !ex.compound;

const int = (v: string | number) => (typeof v === 'number' ? v : /^\s*\d+\s*$/.test(v) ? Number(v) : NaN);

/** Validates one rep-out. Returns the entry fields or a reason it cannot be used. */
export function calibrationResult(predicted: number, repsAtGuess: string | number, totalReps: string | number):
  { ok: true; predicted: number; actual: number; gap: number; text: string } | { ok: false; problem: string } {
  const g = int(repsAtGuess);
  const t = int(totalReps);
  if (!Number.isInteger(predicted) || predicted < 1 || predicted > 5) return { ok: false, problem: 'Pick how many reps you thought were left (1 to 5).' };
  if (!Number.isInteger(g) || g < 1 || g > 50) return { ok: false, problem: 'Enter the rep count at your guess as a whole number from 1 to 50.' };
  if (!Number.isInteger(t) || t < g || t > 60) return { ok: false, problem: 'Total reps must be a whole number, at least the reps at your guess and at most 60.' };
  const actual = t - g;
  const gap = actual - predicted;
  const text = gap === 0
    ? `You guessed ${predicted} left and had ${actual}. Spot on this time.`
    : `You guessed ${predicted} left and had ${actual}: ${gap > 0 ? `${gap} more than you thought` : `${-gap} fewer than you thought`}.`;
  return { ok: true, predicted, actual, gap, text };
}

/** Across rep-outs: average error and direction. Says nothing about a tendency below 3 samples. */
export function calibrationSummary(entries: CalibrationEntry[]): { n: number; meanAbs: number; bias: number; text: string } | null {
  const ok = entries.filter((e) => Number.isInteger(e.predicted) && Number.isInteger(e.actual) && e.actual >= 0);
  if (!ok.length) return null;
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const meanAbs = r1(ok.reduce((a, e) => a + Math.abs(e.actual - e.predicted), 0) / ok.length);
  const bias = r1(ok.reduce((a, e) => a + (e.actual - e.predicted), 0) / ok.length);
  if (ok.length < 3) return { n: ok.length, meanAbs, bias, text: `${ok.length} rep-out${ok.length > 1 ? 's' : ''} so far. A few more are needed before any tendency means much.` };
  const lean = Math.abs(bias) < 0.5 ? 'no clear lean either way'
    : bias > 0 ? 'you tended to have more left than you guessed, so your sets may be further from failure than you log'
    : 'you tended to have less left than you guessed, so your sets may be closer to failure than you log';
  return { n: ok.length, meanAbs, bias, text: `Over ${ok.length} rep-outs your guesses were off by about ${meanAbs} reps on average, with ${lean}.` };
}
