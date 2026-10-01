import type { Equipment, Exercise, Pattern, Setup } from './types.ts';

// Beta library: 32 exercises. Founder reviews every name and cue before release.
// Order inside a muscle matters: the selector prefers earlier entries.
export const EXERCISES: Exercise[] = [
  // Chest
  { id: 'bb_bench', name: 'Barbell bench press', muscle: 'chest', pattern: 'horizontal_push', equipment: ['barbell', 'bench', 'rack'], compound: true, difficulty: 2,
    cues: ['Shoulder blades pinched and down', 'Bar touches lower chest', 'Feet planted, press up and slightly back'] },
  { id: 'db_bench', name: 'Dumbbell bench press', muscle: 'chest', pattern: 'horizontal_push', equipment: ['dumbbell', 'bench'], compound: true, difficulty: 1,
    cues: ['Dumbbells over the chest, elbows about 45 degrees out', 'Lower until a deep stretch', 'Press up without clanking the weights'] },
  { id: 'incline_db_press', name: 'Incline dumbbell press', muscle: 'chest', pattern: 'horizontal_push', equipment: ['dumbbell', 'bench'], compound: true, difficulty: 1,
    cues: ['Bench at a low incline', 'Lower to upper chest', 'Keep shoulder blades back'] },
  { id: 'machine_chest_press', name: 'Machine chest press', muscle: 'chest', pattern: 'horizontal_push', equipment: ['machine'], compound: true, difficulty: 1,
    cues: ['Handles level with mid chest', 'Control the way back', 'Do not let shoulders roll forward'] },
  { id: 'cable_fly', name: 'Cable fly', muscle: 'chest', pattern: 'fly', equipment: ['cable'], compound: false, difficulty: 1,
    cues: ['Slight bend in the elbows, keep it fixed', 'Open wide to a stretch', 'Bring hands together in an arc'] },
  { id: 'db_fly', name: 'Dumbbell fly', muscle: 'chest', pattern: 'fly', equipment: ['dumbbell', 'bench'], compound: false, difficulty: 2,
    cues: ['Slight bend in the elbows', 'Lower until a stretch, not further', 'Hug a barrel on the way up'] },

  // Back
  { id: 'lat_pulldown', name: 'Lat pulldown', muscle: 'back', pattern: 'vertical_pull', equipment: ['cable'], compound: true, difficulty: 1,
    cues: ['Grip a little wider than shoulders', 'Pull elbows down to your sides', 'Let the arms fully straighten at the top'] },
  { id: 'cable_row', name: 'Seated cable row', muscle: 'back', pattern: 'horizontal_pull', equipment: ['cable'], compound: true, difficulty: 1,
    cues: ['Chest up, slight lean is fine', 'Pull handle to your stomach', 'Reach forward for a stretch'] },
  { id: 'chest_supported_db_row', name: 'Chest-supported dumbbell row', muscle: 'back', pattern: 'horizontal_pull', equipment: ['dumbbell', 'bench'], compound: true, difficulty: 1,
    cues: ['Chest on an inclined bench', 'Pull elbows back toward your hips', 'Full stretch at the bottom'] },
  { id: 'one_arm_db_row', name: 'One-arm dumbbell row', muscle: 'back', pattern: 'horizontal_pull', equipment: ['dumbbell', 'bench'], compound: true, difficulty: 1,
    cues: ['Hand and knee on the bench, back flat', 'Pull the dumbbell to your hip', 'Do not twist the torso'] },
  { id: 'bb_row', name: 'Barbell row', muscle: 'back', pattern: 'horizontal_pull', equipment: ['barbell'], compound: true, difficulty: 3,
    cues: ['Hinge until torso is near 45 degrees', 'Back flat, brace hard', 'Pull bar to lower ribs'] },

  // Shoulders
  { id: 'db_shoulder_press', name: 'Seated dumbbell shoulder press', muscle: 'shoulders', pattern: 'vertical_push', equipment: ['dumbbell', 'bench'], compound: true, difficulty: 1,
    cues: ['Back against an upright bench', 'Lower to about chin height', 'Press straight up'] },
  { id: 'bb_ohp', name: 'Standing overhead press', muscle: 'shoulders', pattern: 'vertical_push', equipment: ['barbell', 'rack'], compound: true, difficulty: 3,
    cues: ['Squeeze glutes, brace the core', 'Move your head back as the bar passes', 'Finish with the bar over mid-foot'] },
  { id: 'db_lateral_raise', name: 'Dumbbell lateral raise', muscle: 'shoulders', pattern: 'lateral_raise', equipment: ['dumbbell'], compound: false, difficulty: 1,
    cues: ['Slight bend in the elbows', 'Raise out to the side to shoulder height', 'Lower slowly'] },
  { id: 'cable_lateral_raise', name: 'Cable lateral raise', muscle: 'shoulders', pattern: 'lateral_raise', equipment: ['cable'], compound: false, difficulty: 1,
    cues: ['Cable at hand height, across the body', 'Lead with the elbow', 'Stop at shoulder height'] },

  // Quads
  { id: 'bb_squat', name: 'Barbell back squat', muscle: 'quads', pattern: 'squat', equipment: ['barbell', 'rack'], compound: true, difficulty: 3,
    cues: ['Brace before each rep', 'Knees travel over the toes', 'Go as deep as you can with a neutral back'] },
  { id: 'leg_press', name: 'Leg press', muscle: 'quads', pattern: 'squat', equipment: ['machine'], compound: true, difficulty: 1,
    cues: ['Feet shoulder width, mid platform', 'Lower until knees are deeply bent', 'Keep hips on the pad'] },
  { id: 'goblet_squat', name: 'Goblet squat', muscle: 'quads', pattern: 'squat', equipment: ['dumbbell'], compound: true, difficulty: 1,
    cues: ['Hold the dumbbell at your chest', 'Sit down between your knees', 'Chest stays up'] },
  { id: 'bulgarian_split_squat', name: 'Bulgarian split squat', muscle: 'quads', pattern: 'lunge', equipment: ['dumbbell', 'bench'], compound: true, difficulty: 2,
    cues: ['Rear foot on the bench', 'Front knee travels forward', 'Lower until the back knee nearly touches'] },
  { id: 'leg_extension', name: 'Leg extension', muscle: 'quads', pattern: 'knee_extension', equipment: ['machine'], compound: false, difficulty: 1,
    cues: ['Knee lined up with the machine pivot', 'Straighten fully', 'Lower under control'] },

  // Hamstrings
  { id: 'bb_rdl', name: 'Barbell Romanian deadlift', muscle: 'hamstrings', pattern: 'hinge', equipment: ['barbell'], compound: true, difficulty: 2,
    cues: ['Soft knees, push hips back', 'Bar stays close to the legs', 'Stop when the hamstrings are stretched'] },
  { id: 'db_rdl', name: 'Dumbbell Romanian deadlift', muscle: 'hamstrings', pattern: 'hinge', equipment: ['dumbbell'], compound: true, difficulty: 1,
    cues: ['Soft knees, push hips back', 'Dumbbells slide down the thighs', 'Back stays flat'] },
  { id: 'leg_curl', name: 'Leg curl (machine)', muscle: 'hamstrings', pattern: 'knee_flexion', equipment: ['machine'], compound: false, difficulty: 1,
    cues: ['Knee lined up with the pivot', 'Curl all the way', 'Slow on the way back'] },

  // Glutes
  { id: 'bb_hip_thrust', name: 'Barbell hip thrust', muscle: 'glutes', pattern: 'hip_thrust', equipment: ['barbell', 'bench'], compound: true, difficulty: 2,
    cues: ['Upper back on the bench, bar on the hips', 'Chin tucked, drive through the heels', 'Squeeze at the top without arching'] },
  { id: 'db_hip_thrust', name: 'Dumbbell hip thrust', muscle: 'glutes', pattern: 'hip_thrust', equipment: ['dumbbell', 'bench'], compound: true, difficulty: 1,
    cues: ['Dumbbell on the hips', 'Drive through the heels', 'Pause at the top'] },

  // Biceps
  { id: 'db_curl', name: 'Dumbbell curl', muscle: 'biceps', pattern: 'elbow_flexion', equipment: ['dumbbell'], compound: false, difficulty: 1,
    cues: ['Elbows stay by your sides', 'Turn the palms up as you curl', 'Full stretch at the bottom'] },
  { id: 'cable_curl', name: 'Cable curl', muscle: 'biceps', pattern: 'elbow_flexion', equipment: ['cable'], compound: false, difficulty: 1,
    cues: ['Elbows fixed', 'Curl to the shoulders', 'Control the way down'] },
  { id: 'bb_curl', name: 'Barbell curl', muscle: 'biceps', pattern: 'elbow_flexion', equipment: ['barbell'], compound: false, difficulty: 1,
    cues: ['Shoulder-width grip', 'No swinging', 'Straighten the arms fully'] },

  // Triceps
  { id: 'cable_pushdown', name: 'Cable pushdown', muscle: 'triceps', pattern: 'elbow_extension', equipment: ['cable'], compound: false, difficulty: 1,
    cues: ['Elbows pinned to your sides', 'Push until arms are straight', 'Let the forearms come up to parallel'] },
  { id: 'db_overhead_ext', name: 'Overhead dumbbell extension', muscle: 'triceps', pattern: 'elbow_extension', equipment: ['dumbbell'], compound: false, difficulty: 1,
    cues: ['Hold one dumbbell with both hands overhead', 'Lower behind your head', 'Elbows point forward'] },
  { id: 'skull_crusher', name: 'Barbell skull crusher', muscle: 'triceps', pattern: 'elbow_extension', equipment: ['barbell', 'bench'], compound: false, difficulty: 2,
    cues: ['Lower the bar toward your forehead', 'Elbows stay narrow', 'Extend fully'] },

  // Calves
  { id: 'machine_calf_raise', name: 'Standing calf raise (machine)', muscle: 'calves', pattern: 'calf_raise', equipment: ['machine'], compound: false, difficulty: 1,
    cues: ['Balls of the feet on the edge', 'Pause in the deep stretch', 'Rise as high as you can'] },
  { id: 'db_calf_raise', name: 'Dumbbell calf raise', muscle: 'calves', pattern: 'calf_raise', equipment: ['dumbbell'], compound: false, difficulty: 1,
    cues: ['Stand on a step, hold a dumbbell', 'Pause at the bottom', 'Rise fully'] },
];

export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

// PRD: home gym = barbell, rack, dumbbells. Bench assumed (founder to confirm).
export const SETUP_EQUIPMENT: Record<Setup, Equipment[]> = {
  commercial: ['barbell', 'rack', 'dumbbell', 'bench', 'machine', 'cable'],
  home: ['barbell', 'rack', 'dumbbell', 'bench'],
};

export function available(setup: Setup, avoid: Pattern[]): Exercise[] {
  const have = SETUP_EQUIPMENT[setup];
  return EXERCISES.filter((e) => e.equipment.every((q) => have.includes(q)) && !avoid.includes(e.pattern));
}

// Swap candidates: same pattern + same muscle + user's equipment (PRD rule).
// Falls back to same muscle when no other exercise shares the pattern.
export function substitutes(exerciseId: string, setup: Setup, avoid: Pattern[]): Exercise[] {
  const ex = EXERCISE_BY_ID[exerciseId];
  const pool = available(setup, avoid).filter((e) => e.id !== exerciseId && e.muscle === ex.muscle);
  const samePattern = pool.filter((e) => e.pattern === ex.pattern);
  return samePattern.length ? samePattern : pool;
}
