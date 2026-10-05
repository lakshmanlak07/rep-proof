// Library content layered on the engine's exercise list. Static copy now; replace with an API/CMS later without touching screens.
import { EXERCISES } from '@/engine/exercises.ts';
import type { Exercise, Muscle, Pattern } from '@/engine/types.ts';

export const DIFFICULTY = ['', 'Beginner', 'Intermediate', 'Advanced'] as const;
export const EQUIPMENT_LABEL: Record<string, string> = { barbell: 'Barbell', rack: 'Rack', dumbbell: 'Dumbbells', bench: 'Bench', machine: 'Machine', cable: 'Cable' };

export const PATTERN_LABEL: Record<Pattern, string> = {
  horizontal_push: 'Horizontal press', vertical_push: 'Vertical press', horizontal_pull: 'Horizontal row', vertical_pull: 'Vertical pull',
  squat: 'Squat', lunge: 'Lunge', hinge: 'Hip hinge', hip_thrust: 'Hip thrust', knee_extension: 'Knee extension', knee_flexion: 'Knee flexion',
  fly: 'Fly', lateral_raise: 'Lateral raise', elbow_flexion: 'Elbow flexion', elbow_extension: 'Elbow extension', calf_raise: 'Calf raise',
  rear_delt: 'Rear delt fly', pullover: 'Pullover', hip_abduction: 'Hip abduction',
};

export const CATEGORIES: { id: Muscle | 'abs'; label: string; icon: string }[] = [
  { id: 'chest', label: 'Chest', icon: 'shield' }, { id: 'back', label: 'Back', icon: 'git-network' }, { id: 'shoulders', label: 'Shoulders', icon: 'triangle' },
  { id: 'biceps', label: 'Biceps', icon: 'fitness' }, { id: 'triceps', label: 'Triceps', icon: 'fitness' }, { id: 'quads', label: 'Quads', icon: 'walk' },
  { id: 'hamstrings', label: 'Hamstrings', icon: 'walk' }, { id: 'glutes', label: 'Glutes', icon: 'ellipse' }, { id: 'calves', label: 'Calves', icon: 'footsteps' },
  { id: 'abs', label: 'Abs', icon: 'grid' },
];

const PRIMARY: Partial<Record<string, string>> = {
  incline_db_press: 'Upper chest', cable_fly: 'Chest (stretched position)', db_fly: 'Chest (stretched position)', db_lateral_raise: 'Side delts', cable_lateral_raise: 'Side delts',
  bb_rdl: 'Hamstrings', db_rdl: 'Hamstrings', leg_extension: 'Quads (rectus femoris)', db_calf_raise: 'Calves', machine_calf_raise: 'Calves',
  reverse_pec_deck: 'Rear delts', face_pull: 'Rear delts', db_rear_delt_fly: 'Rear delts', straight_arm_pulldown: 'Lats', db_pullover: 'Lats', hip_abduction: 'Glute medius', incline_bb_press: 'Upper chest',
};
const MUSCLE_TEXT: Record<Muscle, string> = {
  chest: 'Chest', back: 'Lats & upper back', shoulders: 'Shoulders', quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', biceps: 'Biceps', triceps: 'Triceps', calves: 'Calves',
};
const SECONDARY: Record<Pattern, string> = {
  horizontal_push: 'Front delts, triceps', vertical_push: 'Triceps, upper chest', horizontal_pull: 'Biceps, rear delts', vertical_pull: 'Biceps, rear delts',
  squat: 'Glutes, adductors', lunge: 'Glutes, adductors', hinge: 'Glutes, spinal erectors', hip_thrust: 'Hamstrings', knee_extension: 'None (isolation)',
  knee_flexion: 'Calves', fly: 'Front delts', lateral_raise: 'Upper traps', elbow_flexion: 'Forearms', elbow_extension: 'None (isolation)', calf_raise: 'None (isolation)',
  rear_delt: 'Mid traps, rhomboids', pullover: 'Long head of triceps, chest', hip_abduction: 'None (isolation)',
};
const MISTAKES: Record<Pattern, string[]> = {
  horizontal_push: ['Flaring the elbows straight out', 'Bouncing the weight off the chest', 'Letting the shoulders roll forward'],
  vertical_push: ['Over-arching the lower back', 'Pressing in front of the body instead of overhead', 'Cutting the range short'],
  horizontal_pull: ['Yanking with momentum', 'Shrugging the shoulders up', 'Cutting the stretch at the start'],
  vertical_pull: ['Leaning back to turn it into a row', 'Pulling with the hands, not the elbows', 'Skipping the full stretch at the top'],
  squat: ['Rushing the descent', 'Heels lifting off the floor', 'Losing the brace at the bottom'],
  lunge: ['Short, unstable stance', 'Torso collapsing forward', 'Using the back leg to push'],
  hinge: ['Rounding the lower back', 'Squatting instead of pushing the hips back', 'Letting the weight drift away from the legs'],
  hip_thrust: ['Over-arching at the top', 'Pushing through the toes', 'Chin up and ribs flared'],
  knee_extension: ['Swinging the weight up', 'Seat set too far back', 'Dropping the weight fast'],
  knee_flexion: ['Lifting the hips off the pad', 'Rushing the lowering phase', 'Partial reps'],
  fly: ['Turning it into a press', 'Going far past a comfortable stretch', 'Locking the elbows straight'],
  lateral_raise: ['Swinging the torso', 'Raising above shoulder height with shrugs', 'Going too heavy to control'],
  elbow_flexion: ['Swinging the body', 'Elbows drifting forward', 'Half reps at the bottom'],
  elbow_extension: ['Elbows flaring or drifting', 'Using body weight to push', 'Stopping short of full extension'],
  calf_raise: ['Bouncing out of the stretch', 'Short range of motion', 'Rushing the reps'],
  rear_delt: ['Shrugging the shoulders up', 'Turning it into a row with bent elbows', 'Going too heavy to control'],
  pullover: ['Bending the elbows into a press', 'Arching the lower back', 'Cutting the stretch short'],
  hip_abduction: ['Using momentum', 'Rushing the return', 'Partial range'],
};

export type ExerciseInfo = {
  exercise: Exercise;
  primary: string;
  secondary: string;
  bestFor: string;
  steps: string[];
  mistakes: string[];
  programming: string;
  note: string;
};

export function infoFor(ex: Exercise): ExerciseInfo {
  const programming = ex.compound
    ? 'Heavier end of your rep range works well here (about 5–10 reps), with the earlier sets 1–3 reps short of failure.'
    : 'Higher reps (about 10–15) suit this movement. Take sets close to failure, since lighter loads are easy to recover from.';
  return {
    exercise: ex,
    primary: PRIMARY[ex.id] ?? MUSCLE_TEXT[ex.muscle],
    secondary: SECONDARY[ex.pattern],
    bestFor: ex.compound ? 'Building the main mass of the muscle and tracking strength' : 'Adding targeted volume without much fatigue elsewhere',
    steps: ['Set up so the weight is stable and your starting position is fixed.', ...ex.cues, 'Control the lowering phase; do not just drop the weight.'],
    mistakes: MISTAKES[ex.pattern],
    programming,
    note: ex.compound
      ? 'A solid base movement. Choose a load that allows controlled execution while reaching the target proximity to failure.'
      : 'Useful hypertrophy movement. Choose a load that allows controlled execution while reaching the target proximity to failure.',
  };
}

export const exercisesFor = (cat: Muscle | 'abs') => (cat === 'abs' ? [] : EXERCISES.filter((e) => e.muscle === cat));
