// Presentation logic for Rep Proof's coaching surfaces. Pure functions over engine output and logged data.
// Nothing here claims scientific certainty: ranges are "Rep Proof estimates" based on experience and recent performance.
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { Decision } from '@/engine/decisions.ts';
import { EXERCISE_BY_ID } from '@/engine/exercises.ts';
import type { CheckIn, EvidenceLabel, Experience, Muscle } from '@/engine/types.ts';
import type { Tone } from '@/ui';

export type VolumeStatus = 'low' | 'productive' | 'high';

/** Rep Proof estimate of a currently productive weekly hard-set range. Starting point only; individual response decides. */
export function productiveRange(experience: Experience): [number, number] {
  return experience === 'beginner' ? [6, 12] : experience === 'intermediate' ? [8, 16] : [10, 20];
}

export function volumeStatus(sets: number, experience: Experience, stalling = false): { status: VolumeStatus; label: string; tone: Tone } {
  const [lo, hi] = productiveRange(experience);
  if (sets < lo) return { status: 'low', label: 'Potentially increase', tone: 'warn' };
  if (sets > hi || (sets >= hi - 1 && stalling)) return { status: 'high', label: 'Consider holding steady', tone: 'danger' };
  return { status: 'productive', label: 'Current productive range', tone: 'pos' };
}

export type Readiness = { label: string; detail: string; tone: Tone; score: number | null };

/** Readiness from the most recent check-ins (sleep, soreness, energy: 1-5, 5 best). */
export function readiness(checkins: (CheckIn | null)[], deloadActive: boolean): Readiness {
  if (deloadActive) return { label: 'Deload', detail: 'Lighter week in progress', tone: 'accent', score: null };
  const c = checkins.find((x) => x);
  if (!c) return { label: 'Ready', detail: 'Check in before your next session', tone: 'neutral', score: null };
  const score = (c.sleep + c.soreness + c.energy) / 3;
  if (score >= 3.7) return { label: 'Ready', detail: 'Recovering well', tone: 'pos', score };
  if (score >= 2.7) return { label: 'Moderate', detail: 'Train as planned, stay honest on effort', tone: 'warn', score };
  return { label: 'Run down', detail: 'Today may be adjusted for you', tone: 'danger', score };
}

type Icon = keyof typeof Ionicons.glyphMap;
const KIND_META: Record<Decision['kind'], { kicker: string; icon: Icon; tone: Tone }> = {
  too_new: { kicker: 'Baseline', icon: 'hourglass', tone: 'neutral' },
  progressing: { kicker: 'Progress', icon: 'trending-up', tone: 'pos' },
  add_set: { kicker: 'Volume', icon: 'add-circle', tone: 'accent' },
  remove_set: { kicker: 'Volume', icon: 'remove-circle', tone: 'warn' },
  swap: { kicker: 'Recommendation', icon: 'swap-horizontal', tone: 'accent' },
  hold_recover: { kicker: 'Recovery', icon: 'bed', tone: 'warn' },
  hold_stalled: { kicker: 'Recommendation', icon: 'pause-circle', tone: 'warn' },
  push_closer: { kicker: 'Effort', icon: 'flash', tone: 'accent' },
};

/** Turns an engine decision into the WHAT WE SEE / WHY IT MATTERS / WHAT TO DO structure. */
export function insightFromDecision(d: Decision): {
  kicker: string; icon: Icon; tone: Tone; see: string; why: string; todo: string; evidence: EvidenceLabel; refIds: string[]; name: string;
} {
  const name = EXERCISE_BY_ID[d.exerciseId]?.name ?? d.exerciseId;
  const meta = KIND_META[d.kind];
  const swap = d.swapTo ? EXERCISE_BY_ID[d.swapTo]?.name : null;
  const todo: Record<Decision['kind'], string> = {
    too_new: 'Keep logging. Weight and reps still progress each session.',
    progressing: `Keep ${name.toLowerCase()} exactly as it is.`,
    add_set: `Add one set to ${name.toLowerCase()}. It is already in your plan.`,
    remove_set: `Drop one set from ${name.toLowerCase()}. It is already in your plan.`,
    swap: swap ? `Swap to ${swap.toLowerCase()} for a fresh stimulus.` : 'Swap this exercise for a fresh stimulus.',
    hold_recover: 'Hold volume steady this week rather than adding another set. Prioritise sleep and food.',
    hold_stalled: 'Hold volume steady rather than adding another set, and train each set close to failure.',
    push_closer: 'Take your hard sets closer to failure before adding any volume.',
  };
  return { ...meta, icon: meta.icon, see: `${name}: ${d.title.charAt(0).toLowerCase()}${d.title.slice(1)}.`, why: d.explanation.text, todo: todo[d.kind], evidence: d.explanation.label, refIds: d.explanation.refIds, name };
}

/** Percentage change, one decimal. */
export const pct = (from: number, to: number) => (from > 0 ? Math.round(((to - from) / from) * 1000) / 10 : 0);

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', biceps: 'Biceps', triceps: 'Triceps', calves: 'Calves',
};

export const greeting = (d = new Date()) => (d.getHours() < 12 ? 'Good morning' : d.getHours() < 18 ? 'Good afternoon' : 'Good evening');

/** Display first name from the account email, or '' when unknown (phone sign-in). */
export function firstName(email?: string | null) {
  const part = email?.split('@')[0]?.split(/[._\-+0-9]/)[0];
  return part ? part.charAt(0).toUpperCase() + part.slice(1) : '';
}
