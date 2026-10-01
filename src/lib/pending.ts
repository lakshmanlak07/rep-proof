import 'expo-sqlite/localStorage/install';

// Age + disclaimer collected before sign-up, held on the device only until the profile is saved.
type Pending = { birthYear: number; disclaimerAt: string | null };
const KEY = 'pending_onboarding';

export const isAdult = (birthYear: number) => new Date().getFullYear() - birthYear >= 18;

export function getPending(): Pending | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
}
export const setPending = (p: Pending) => localStorage.setItem(KEY, JSON.stringify(p));
export const clearPending = () => localStorage.removeItem(KEY);

export const DISCLAIMER =
  'RepProof gives general strength-training information for healthy adults. It is not medical advice and cannot assess pain, injuries or medical conditions. ' +
  'Check with a qualified professional before starting if you have any health concerns. Stop any exercise that causes pain. You train at your own risk.';
