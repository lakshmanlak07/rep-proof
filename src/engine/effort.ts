// Effort scales. RIR (reps in reserve) is what the engine uses; RPE is offered as an input on the
// RIR-based RPE scale (RPE 10 = 0 reps in reserve, RPE 9 = 1, ... Zourdos 2016), in half steps.
import type { Explanation } from './types.ts';

export type EffortScale = 'rir' | 'rpe';

/** RPE choices offered in the app, lowest to highest. 6 stands for "4 or more in reserve". */
export const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;

export const isRpe = (x: number) => x >= 1 && x <= 10 && Number.isInteger(x * 2);

/**
 * Whole reps in reserve for an RPE. Half steps round toward failure (RPE 8.5 -> 1 RIR), so an uncertain
 * rating never makes a set look easier than it was and never speeds up a weight increase.
 */
export function rirFromRpe(rpe: number): number {
  if (!isRpe(rpe)) throw new RangeError('RPE must be 1-10 in half steps');
  return Math.max(0, Math.floor(10 - rpe));
}

/** RPE equivalent of a whole RIR, for showing targets on the RPE scale ("4+" RIR shows as RPE 6). */
export const rpeFromRir = (rir: number) => Math.max(6, 10 - Math.max(0, Math.round(rir)));

/** Target text on the chosen scale: "2 RIR" or "RPE 8". */
export function targetLabel(rir: number, scale: EffortScale): string {
  if (scale === 'rpe') return `RPE ${rpeFromRir(rir)}`;
  return rir === 0 ? 'to failure' : `${rir} RIR`;
}

export const RPE_WHY: Explanation = {
  text: 'RPE here is the reps-in-reserve version of the scale: RPE 10 means no reps left, RPE 9 one left, RPE 8 two left. RepProof converts what you enter to reps in reserve, rounding half steps toward failure, so progression works the same whichever scale you use.',
  label: 'direct',
  refIds: ['rpe_scale', 'monitoring_review'],
};
