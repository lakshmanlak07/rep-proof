import { AVOIDABLE } from '@/engine/exercises.ts';
import { EFFORT_NAMES, MUSCLE_NAMES, MUSCLES } from '@/engine/plan.ts';
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { Effort, Experience, Goal, Muscle, Pattern, Setup } from '@/engine/types.ts';

// Choices shared by onboarding and the training-profile editor.
export const EXPERIENCE_OPTIONS: { value: Experience; label: string; hint: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'beginner', label: 'Beginner', hint: 'Under about a year', icon: 'leaf' },
  { value: 'intermediate', label: 'Intermediate', hint: '1 to 3 years', icon: 'trending-up' },
  { value: 'advanced', label: 'Advanced', hint: 'More than 3 years', icon: 'medal' },
];
export const SETUP_OPTIONS: { value: Setup; label: string; hint: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'commercial', label: 'Full gym', hint: 'Machines, cables, free weights', icon: 'business' },
  { value: 'home', label: 'Home gym', hint: 'Barbell, rack, dumbbells, bench', icon: 'home' },
];
export const GOAL_OPTIONS: { value: Goal; label: string; hint: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'muscle', label: 'Build muscle', hint: 'Bigger, fuller muscles', icon: 'body' },
  { value: 'strength', label: 'Get stronger', hint: 'Heavier lifts, lower reps', icon: 'barbell' },
  { value: 'both', label: 'Both', hint: 'Muscle and strength together', icon: 'infinite' },
];
export const MINUTE_OPTIONS = [30, 45, 60, 75, 90].map((m) => ({ value: m, label: `${m} minutes` }));
export const AVOID_OPTIONS: { value: Pattern; label: string }[] = AVOIDABLE.map((a) => ({ value: a.pattern, label: a.label }));
export const MUSCLE_OPTIONS: { value: Muscle; label: string }[] = MUSCLES.map((m) => ({ value: m, label: MUSCLE_NAMES[m] }));
export const EFFORT_OPTIONS: { value: Effort; label: string; hint: string }[] = (Object.keys(EFFORT_NAMES) as Effort[]).map((e) => ({ value: e, ...EFFORT_NAMES[e] }));
