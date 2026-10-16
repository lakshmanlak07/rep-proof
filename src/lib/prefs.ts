import 'expo-sqlite/localStorage/install';

// Per-device preferences and phone-only training aids (not synced, not exported).
import type { CalibrationEntry } from '@/engine/calibration.ts';
import type { EffortScale } from '@/engine/effort.ts';

const SCALE = 'effort_scale';
const CALIBRATION = 'rir_calibration';
export const effortScale = (): EffortScale => (localStorage.getItem(SCALE) === 'rpe' ? 'rpe' : 'rir');
export const setEffortScale = (s: EffortScale) => localStorage.setItem(SCALE, s);

/** Every key this app keeps on the device; cleared on sign-out and account deletion. */
export const LOCAL_KEYS = ['draft_workout', 'missed_choice', 'pending_onboarding', SCALE, 'rest_alerts', CALIBRATION];
/** Per-account keys (`<name>:<userId>`): coaching notes (lib/coach.ts) and beta prompts (beta.tsx). */
export const USER_KEYS = ['coach', 'survey_at', 'founding'];
export const clearLocal = (userId?: string | null) => {
  LOCAL_KEYS.forEach((k) => localStorage.removeItem(k));
  if (userId) USER_KEYS.forEach((k) => localStorage.removeItem(`${k}:${userId}`));
  else userKeysOnDevice().forEach((k) => localStorage.removeItem(k)); // a session ended without saying whose
};
/** Per-account keys of every account that used this phone. */
export function userKeysOnDevice(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && USER_KEYS.some((p) => k.startsWith(`${p}:`))) keys.push(k);
  }
  return keys;
}

// RIR calibration rep-outs (E-02): kept on this phone only, never synced or exported; tagged with the account.
export function calibrationEntries(userId: string): CalibrationEntry[] {
  try {
    const all = JSON.parse(localStorage.getItem(CALIBRATION) ?? '[]') as (CalibrationEntry & { userId: string })[];
    return Array.isArray(all) ? all.filter((e) => e.userId === userId) : [];
  } catch {
    return [];
  }
}
export function addCalibration(userId: string, e: CalibrationEntry) {
  const mine = [...calibrationEntries(userId), e].slice(-50).map((x) => ({ ...x, userId }));
  localStorage.setItem(CALIBRATION, JSON.stringify(mine)); // one account's entries at a time; another account's are dropped
}
