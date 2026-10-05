import 'expo-sqlite/localStorage/install';

import type { Decision } from '@/engine/decisions.ts';
import type { Explanation } from '@/engine/types.ts';

// The latest decisions from the decision engine, kept on the device for Home's "Coach notes".
export type CoachNotes = { at: string; decisions: Decision[]; advice: Explanation | null };
const key = (userId: string) => `coach:${userId}`;

export function saveCoachNotes(userId: string, decisions: Decision[], advice: Explanation | null) {
  // Merge with earlier notes: a lift not trained today keeps its last decision.
  const prev = loadCoachNotes(userId)?.decisions ?? [];
  const merged = [...decisions, ...prev.filter((p) => !decisions.some((d) => d.exerciseId === p.exerciseId))];
  localStorage.setItem(key(userId), JSON.stringify({ at: new Date().toISOString(), decisions: merged, advice }));
}

export function loadCoachNotes(userId: string): CoachNotes | null {
  try {
    return JSON.parse(localStorage.getItem(key(userId)) ?? 'null');
  } catch {
    return null;
  }
}
