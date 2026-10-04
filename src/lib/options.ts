import { AVOIDABLE } from '@/engine/exercises.ts';
import type { Experience, Goal, Pattern, Setup } from '@/engine/types.ts';

// Choices shared by onboarding and the training-profile editor.
export const EXPERIENCE_OPTIONS: { value: Experience; label: string; hint: string }[] = [
  { value: 'beginner', label: 'Beginner', hint: 'Under about a year' },
  { value: 'intermediate', label: 'Intermediate', hint: '1 to 3 years' },
  { value: 'advanced', label: 'Advanced', hint: 'More than 3 years' },
];
export const SETUP_OPTIONS: { value: Setup; label: string; hint: string }[] = [
  { value: 'commercial', label: 'Commercial gym', hint: 'Machines, cables, free weights' },
  { value: 'home', label: 'Home gym', hint: 'Barbell, rack, dumbbells, bench' },
];
export const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: 'muscle', label: 'Build muscle' },
  { value: 'strength', label: 'Get stronger' },
  { value: 'both', label: 'Both' },
];
export const MINUTE_OPTIONS = [30, 45, 60, 75, 90].map((m) => ({ value: m, label: `${m} minutes` }));
export const AVOID_OPTIONS: { value: Pattern; label: string }[] = AVOIDABLE.map((a) => ({ value: a.pattern, label: a.label }));
