// Checks an unfinished workout saved on the device before the workout screen renders it.
// A draft written by an older app version, edited storage, or an exercise later renamed or removed from the
// library would otherwise crash the screen on every open (the crash screen's retry reloads the same draft).
// Plain TypeScript: unit-tested.

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const LABELS = ['direct', 'principle', 'rule'];
const KINDS = ['calibrate', 'drop', 'hold', 'up', 'reps'];

function validItem(it: unknown, knownExercise: (id: string) => boolean): boolean {
  if (!isObj(it) || typeof it.exerciseId !== 'string' || !knownExercise(it.exerciseId)) return false;
  const p = it.planned;
  if (!isObj(p) || !num(p.sets) || !num(p.repMin) || !num(p.repMax) || !num(p.rirTarget)) return false;
  const s = it.suggestion;
  if (!isObj(s) || !KINDS.includes(s.kind as string) || !(s.weight === null || num(s.weight)) || !num(s.reps) || !num(s.sets)) return false;
  const e = s.explanation;
  if (!isObj(e) || typeof e.text !== 'string' || !LABELS.includes(e.label as string) || !Array.isArray(e.refIds)) return false;
  if (!Array.isArray(it.history) || !(it.prevBest === null || num(it.prevBest))) return false;
  if (!Array.isArray(it.sets) || it.sets.length > 20) return false;
  return it.sets.every((r) => isObj(r) && typeof r.weight === 'string' && typeof r.reps === 'string' && typeof r.rir === 'string' && typeof r.done === 'boolean'
    && (r.rpe === undefined || typeof r.rpe === 'string'));
}

/** True only for a draft this user started that the workout screen can render safely. */
export function isUsableDraft(d: unknown, userId: string | undefined, dayCount: number, knownExercise: (id: string) => boolean): boolean {
  if (!isObj(d) || !userId || d.userId !== userId) return false;
  if (!Number.isInteger(d.dayIndex) || (d.dayIndex as number) < 0 || (d.dayIndex as number) >= dayCount) return false;
  if (typeof d.startedAt !== 'string' || Number.isNaN(Date.parse(d.startedAt))) return false;
  if (!(d.checkin === null || isObj(d.checkin))) return false;
  if (!Array.isArray(d.items) || d.items.length === 0 || d.items.length > 40) return false;
  return d.items.every((it) => validItem(it, knownExercise));
}
