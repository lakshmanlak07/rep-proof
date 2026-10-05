// Extended exercise library (2026-10-05): swaps, "Add an exercise" and the library screen.
// Plans are built from the staples in exercises.ts; these are `staple: false` unless marked.
// Founder reviews every name and cue before release.
import type { Equipment, Exercise, Muscle, Pattern } from './types.ts';

type Row = [id: string, name: string, muscle: Muscle, pattern: Pattern, equipment: Equipment[], compound: boolean, difficulty: 1 | 2 | 3, cues: string[]];
const x = ([id, name, muscle, pattern, equipment, compound, difficulty, cues]: Row, staple = false): Exercise =>
  ({ id, name, muscle, pattern, equipment, compound, difficulty, cues, staple });

const ROWS: Row[] = [
  // Chest
  ['flat_machine_press', 'Plate-loaded chest press', 'chest', 'horizontal_push', ['machine'], true, 1, ['Handles level with mid chest', 'Press without locking out hard', 'Control the stretch']],
  ['incline_machine_press', 'Incline machine press', 'chest', 'horizontal_push', ['machine'], true, 1, ['Seat so handles line up with upper chest', 'Press up and slightly together', 'Slow return to a stretch']],
  ['smith_bench', 'Smith machine bench press', 'chest', 'horizontal_push', ['smith', 'bench'], true, 1, ['Bar over lower chest at the bottom', 'Shoulder blades pinched', 'Press straight up']],
  ['smith_incline_press', 'Smith machine incline press', 'chest', 'horizontal_push', ['smith', 'bench'], true, 1, ['Low incline bench', 'Lower to upper chest', 'Elbows about 45 degrees out']],
  ['decline_bb_press', 'Decline barbell press', 'chest', 'horizontal_push', ['barbell', 'bench', 'rack'], true, 2, ['Feet locked in', 'Lower to lower chest', 'Press up over the chest']],
  ['decline_db_press', 'Decline dumbbell press', 'chest', 'horizontal_push', ['dumbbell', 'bench'], true, 2, ['Feet locked in', 'Lower dumbbells beside the lower chest', 'Press up and slightly in']],
  ['close_grip_db_press', 'Dumbbell squeeze press', 'chest', 'horizontal_push', ['dumbbell', 'bench'], true, 1, ['Press the dumbbells together the whole rep', 'Lower to the chest', 'Keep elbows tucked']],
  ['floor_press', 'Dumbbell floor press', 'chest', 'horizontal_push', ['dumbbell'], true, 1, ['Lie on the floor, knees bent', 'Lower until upper arms touch the floor', 'Press straight up']],
  ['push_up', 'Push-up', 'chest', 'horizontal_push', ['bodyweight'], true, 1, ['Hands a little wider than shoulders', 'Body in one straight line', 'Chest to just above the floor']],
  ['deficit_push_up', 'Deficit push-up', 'chest', 'horizontal_push', ['bodyweight'], true, 2, ['Hands on raised handles or plates', 'Lower past hand level for a deep stretch', 'Keep the body rigid']],
  ['weighted_dip_chest', 'Chest dip', 'chest', 'horizontal_push', ['dip_station'], true, 2, ['Lean the torso forward', 'Lower until shoulders are below elbows', 'Press back up without swinging']],
  ['landmine_press_chest', 'Landmine press (two hands)', 'chest', 'horizontal_push', ['landmine'], true, 1, ['Hold the bar end at chest height', 'Press up and forward', 'Control the return']],
  ['cable_crossover_low', 'Low-to-high cable fly', 'chest', 'fly', ['cable'], false, 1, ['Cables set low', 'Sweep hands up to chin height', 'Slight bend in elbows throughout']],
  ['cable_crossover_high', 'High-to-low cable fly', 'chest', 'fly', ['cable'], false, 1, ['Cables set high', 'Sweep hands down and together', 'Stretch fully at the top']],
  ['incline_db_fly', 'Incline dumbbell fly', 'chest', 'fly', ['dumbbell', 'bench'], false, 2, ['Low incline bench', 'Open to a comfortable stretch', 'Bring the dumbbells together in an arc']],
  ['incline_cable_fly', 'Incline cable fly', 'chest', 'fly', ['cable', 'bench'], false, 2, ['Bench between low cables', 'Open wide to a stretch', 'Squeeze hands together over upper chest']],
  ['single_arm_cable_fly', 'Single-arm cable fly', 'chest', 'fly', ['cable'], false, 1, ['Stand side-on to the cable', 'Sweep the arm across the body', 'Control the stretch back']],
  ['svend_press', 'Plate squeeze press', 'chest', 'fly', ['dumbbell'], false, 1, ['Squeeze a plate or dumbbell between the palms', 'Press straight out from the chest', 'Keep squeezing on the way back']],
  ['band_push_up', 'Banded push-up', 'chest', 'horizontal_push', ['band', 'bodyweight'], true, 2, ['Band across the upper back, ends under hands', 'Body in one line', 'Press against the band to lockout']],
  ['guillotine_press', 'Neutral-grip dumbbell press', 'chest', 'horizontal_push', ['dumbbell', 'bench'], true, 1, ['Palms facing each other', 'Lower to the chest with elbows tucked', 'Press straight up']],
  ['machine_fly_incline', 'Incline pec deck', 'chest', 'fly', ['machine'], false, 1, ['Set the seat low so hands are at upper chest', 'Open to a stretch', 'Squeeze together']],

  // Back
  ['pull_up', 'Pull-up', 'back', 'vertical_pull', ['pullup_bar'], true, 2, ['Overhand grip, a little wider than shoulders', 'Pull elbows down to your sides', 'Lower to a full hang']],
  ['chin_up', 'Chin-up', 'back', 'vertical_pull', ['pullup_bar'], true, 2, ['Underhand grip, shoulder width', 'Chest toward the bar', 'Full stretch at the bottom']],
  ['neutral_pull_up', 'Neutral-grip pull-up', 'back', 'vertical_pull', ['pullup_bar'], true, 2, ['Palms facing each other', 'Drive elbows down', 'Lower all the way']],
  ['assisted_pull_up', 'Assisted pull-up (machine)', 'back', 'vertical_pull', ['machine'], true, 1, ['Knees on the pad', 'Pull until chin passes the bar', 'Lower slowly to a full stretch']],
  ['close_grip_pulldown', 'Close-grip pulldown', 'back', 'vertical_pull', ['cable'], true, 1, ['V-handle, lean back slightly', 'Pull to the upper chest', 'Arms fully straight at the top']],
  ['single_arm_pulldown', 'Single-arm cable pulldown', 'back', 'vertical_pull', ['cable'], true, 1, ['Kneel or sit facing the cable', 'Pull the elbow to your side', 'Reach up for the stretch']],
  ['machine_pulldown', 'Machine lat pulldown (plate-loaded)', 'back', 'vertical_pull', ['machine'], true, 1, ['Thighs locked under the pads', 'Pull elbows down and back', 'Full stretch at the top']],
  ['pendlay_row', 'Pendlay row', 'back', 'horizontal_pull', ['barbell'], true, 3, ['Torso near parallel to the floor', 'Each rep starts from the floor', 'Pull the bar to the lower chest']],
  ['t_bar_row', 'T-bar row', 'back', 'horizontal_pull', ['landmine'], true, 2, ['Hinge with a flat back', 'Pull the handle to your stomach', 'Let the shoulders reach at the bottom']],
  ['seal_row', 'Seal row', 'back', 'horizontal_pull', ['barbell', 'bench'], true, 2, ['Lie face down on a high bench', 'Pull the bar to the bench', 'Full stretch at the bottom']],
  ['smith_row', 'Smith machine row', 'back', 'horizontal_pull', ['smith'], true, 2, ['Hinge to about 45 degrees', 'Pull to the lower ribs', 'Keep the back flat']],
  ['single_arm_cable_row', 'Single-arm cable row', 'back', 'horizontal_pull', ['cable'], true, 1, ['Brace with the free hand', 'Pull the elbow back past your side', 'Reach forward for the stretch']],
  ['wide_cable_row', 'Wide-grip cable row', 'back', 'horizontal_pull', ['cable'], true, 1, ['Wide bar, elbows flared', 'Pull to the lower chest', 'Squeeze the upper back']],
  ['kroc_row', 'Heavy dumbbell row', 'back', 'horizontal_pull', ['dumbbell', 'bench'], true, 2, ['Brace on the bench', 'Pull the dumbbell to the hip', 'Controlled, not jerky']],
  ['inverted_row', 'Inverted row', 'back', 'horizontal_pull', ['rack', 'barbell', 'bodyweight'], true, 1, ['Bar at hip height in the rack', 'Body in one line under the bar', 'Pull the chest to the bar']],
  ['band_row', 'Band row', 'back', 'horizontal_pull', ['band'], true, 1, ['Anchor the band at chest height', 'Pull elbows back', 'Control the return']],
  ['kettlebell_row', 'Kettlebell row', 'back', 'horizontal_pull', ['kettlebell', 'bench'], true, 1, ['Brace on a bench', 'Pull the bell to the hip', 'Full stretch at the bottom']],
  ['cable_pullover', 'Rope cable pullover', 'back', 'pullover', ['cable'], false, 1, ['Hinge slightly, arms long', 'Pull the rope down to the thighs', 'Let the lats stretch overhead']],
  ['machine_pullover', 'Pullover machine', 'back', 'pullover', ['machine'], false, 1, ['Elbows on the pads', 'Drive the elbows down in an arc', 'Return to a full stretch']],
  ['bb_shrug', 'Barbell shrug', 'back', 'shrug', ['barbell', 'rack'], false, 1, ['Stand tall, arms straight', 'Shrug straight up toward the ears', 'Pause, lower slowly']],
  ['db_shrug', 'Dumbbell shrug', 'back', 'shrug', ['dumbbell'], false, 1, ['Dumbbells at your sides', 'Shrug straight up', 'Full stretch at the bottom']],
  ['trap_bar_shrug', 'Trap bar shrug', 'back', 'shrug', ['trap_bar'], false, 1, ['Stand in the middle of the bar', 'Shrug up without rolling the shoulders', 'Lower under control']],
  ['back_extension', 'Back extension (45 degree)', 'back', 'hip_extension', ['machine'], false, 1, ['Hips on the pad edge', 'Lower with a neutral spine', 'Rise until the body is straight']],
  ['rack_pull', 'Rack pull', 'back', 'hinge', ['barbell', 'rack'], true, 3, ['Bar set just below the knees', 'Brace and push the floor away', 'Lock out with glutes, not the lower back']],
  ['meadows_row', 'Meadows row', 'back', 'horizontal_pull', ['landmine'], true, 2, ['Stand side-on to the bar end', 'Pull the elbow high and back', 'Stretch at the bottom']],

  // Shoulders
  ['seated_bb_press', 'Seated barbell press', 'shoulders', 'vertical_push', ['barbell', 'rack', 'bench'], true, 2, ['Upright bench in the rack', 'Lower to the upper chest', 'Press to straight arms overhead']],
  ['smith_shoulder_press', 'Smith machine shoulder press', 'shoulders', 'vertical_push', ['smith', 'bench'], true, 1, ['Upright bench under the bar', 'Lower to chin height', 'Press straight up']],
  ['arnold_press', 'Arnold press', 'shoulders', 'vertical_push', ['dumbbell', 'bench'], true, 2, ['Start palms facing you at chin height', 'Rotate the palms out as you press', 'Reverse on the way down']],
  ['standing_db_press', 'Standing dumbbell press', 'shoulders', 'vertical_push', ['dumbbell'], true, 2, ['Brace the core', 'Press straight overhead', 'Lower to shoulder height']],
  ['landmine_press', 'Single-arm landmine press', 'shoulders', 'vertical_push', ['landmine'], true, 1, ['Hold the bar end at the shoulder', 'Press up and slightly forward', 'Do not lean back']],
  ['kettlebell_press', 'Kettlebell overhead press', 'shoulders', 'vertical_push', ['kettlebell'], true, 2, ['Bell resting on the forearm', 'Press straight up', 'Keep the ribs down']],
  ['machine_lateral_raise', 'Lateral raise machine', 'shoulders', 'lateral_raise', ['machine'], false, 1, ['Pads on the outside of the arms', 'Raise to shoulder height', 'Lower slowly']],
  ['lean_away_lateral', 'Lean-away dumbbell lateral raise', 'shoulders', 'lateral_raise', ['dumbbell'], false, 1, ['Hold a post and lean away', 'Raise the arm out to the side', 'Control the bottom stretch']],
  ['seated_lateral_raise', 'Seated dumbbell lateral raise', 'shoulders', 'lateral_raise', ['dumbbell', 'bench'], false, 1, ['Sit tall, no swinging', 'Raise to shoulder height', 'Lower under control']],
  ['band_lateral_raise', 'Band lateral raise', 'shoulders', 'lateral_raise', ['band'], false, 1, ['Stand on the band', 'Raise the arms out to the sides', 'Slow on the way down']],
  ['cable_y_raise', 'Cable Y-raise', 'shoulders', 'lateral_raise', ['cable'], false, 2, ['Cables crossed, set low', 'Raise the arms up and out in a Y', 'Stop at about eye level']],
  ['db_front_raise', 'Dumbbell front raise', 'shoulders', 'vertical_push', ['dumbbell'], false, 1, ['Arms nearly straight', 'Raise to shoulder height in front', 'Lower slowly']],
  ['cable_rear_delt_fly', 'Cable rear delt fly', 'shoulders', 'rear_delt', ['cable'], false, 1, ['Cables crossed at shoulder height', 'Pull the arms out and back', 'Keep the elbows soft']],
  ['band_pull_apart', 'Band pull-apart', 'shoulders', 'rear_delt', ['band'], false, 1, ['Band at chest height, arms straight', 'Pull the band apart to your chest', 'Return slowly']],
  ['seated_rear_delt_raise', 'Seated rear delt raise', 'shoulders', 'rear_delt', ['dumbbell', 'bench'], false, 1, ['Sit on the bench edge, chest to thighs', 'Raise the dumbbells out to the sides', 'No swinging']],
  ['upright_row_cable', 'Cable upright row', 'shoulders', 'lateral_raise', ['cable'], false, 2, ['Wide grip on the bar', 'Pull the elbows up to shoulder height', 'Stop if the shoulders pinch']],

  // Quads
  ['front_squat', 'Front squat', 'quads', 'squat', ['barbell', 'rack'], true, 3, ['Bar on the front of the shoulders, elbows high', 'Sit straight down', 'Chest stays up']],
  ['high_bar_squat', 'High-bar squat (heels raised)', 'quads', 'squat', ['barbell', 'rack'], true, 2, ['Heels on small plates', 'Knees travel well forward', 'Upright torso']],
  ['smith_squat', 'Smith machine squat', 'quads', 'squat', ['smith'], true, 1, ['Feet slightly in front of the bar', 'Sit down deep', 'Drive through the whole foot']],
  ['pendulum_squat', 'Pendulum squat', 'quads', 'squat', ['machine'], true, 1, ['Back against the pad', 'Lower until knees are fully bent', 'Drive up through mid-foot']],
  ['belt_squat', 'Belt squat', 'quads', 'squat', ['machine'], true, 1, ['Belt around the hips', 'Sit straight down', 'Knees track over toes']],
  ['v_squat', 'V-squat machine', 'quads', 'squat', ['machine'], true, 1, ['Shoulders under the pads', 'Lower to a deep knee bend', 'Press back up without locking hard']],
  ['single_leg_press', 'Single-leg leg press', 'quads', 'squat', ['machine'], true, 2, ['One foot in the middle of the platform', 'Lower until the knee is deeply bent', 'Hips stay down']],
  ['kb_goblet_squat', 'Kettlebell goblet squat', 'quads', 'squat', ['kettlebell'], true, 1, ['Hold the bell at the chest', 'Sit between the knees', 'Elbows inside the knees at the bottom']],
  ['walking_lunge', 'Walking lunge', 'quads', 'lunge', ['dumbbell'], true, 2, ['Long, controlled steps', 'Back knee nearly touches the floor', 'Push through the front foot']],
  ['reverse_lunge', 'Reverse lunge', 'quads', 'lunge', ['dumbbell'], true, 1, ['Step back into the lunge', 'Front shin fairly upright', 'Drive up through the front heel']],
  ['smith_split_squat', 'Smith machine split squat', 'quads', 'lunge', ['smith'], true, 1, ['Long split stance', 'Lower straight down', 'Front knee travels forward']],
  ['step_up', 'Dumbbell step-up', 'quads', 'lunge', ['dumbbell', 'bench'], true, 1, ['Whole foot on the box', 'Push through the top leg only', 'Lower slowly']],
  ['sissy_squat', 'Sissy squat', 'quads', 'knee_extension', ['bodyweight'], false, 3, ['Hold a support', 'Lean back as the knees go forward', 'Lower only as far as you control']],
  ['single_leg_extension', 'Single-leg extension', 'quads', 'knee_extension', ['machine'], false, 1, ['One leg at a time', 'Straighten fully', 'Lower under control']],
  ['spanish_squat', 'Band Spanish squat', 'quads', 'squat', ['band'], true, 1, ['Band behind the knees, anchored in front', 'Sit back into the band', 'Keep shins vertical']],
  ['cyclist_squat', 'Heels-elevated goblet squat', 'quads', 'squat', ['dumbbell'], true, 1, ['Heels on a wedge, feet close', 'Knees travel far forward', 'Upright torso']],

  // Hamstrings
  ['lying_leg_curl', 'Lying leg curl', 'hamstrings', 'knee_flexion', ['machine'], false, 1, ['Hips pressed into the pad', 'Curl all the way up', 'Lower slowly']],
  ['nordic_curl', 'Nordic curl', 'hamstrings', 'knee_flexion', ['bodyweight'], false, 3, ['Ankles anchored, kneel tall', 'Lower as slowly as you can', 'Catch yourself and push back up']],
  ['stability_ball_curl', 'Swiss ball leg curl', 'hamstrings', 'knee_flexion', ['bodyweight'], false, 1, ['Heels on the ball, hips up', 'Curl the ball toward you', 'Keep the hips high']],
  ['single_leg_curl', 'Single-leg curl (machine)', 'hamstrings', 'knee_flexion', ['machine'], false, 1, ['One leg at a time', 'Full curl', 'Slow return']],
  ['stiff_leg_deadlift', 'Stiff-leg deadlift', 'hamstrings', 'hinge', ['barbell'], true, 2, ['Knees nearly straight', 'Push the hips back', 'Stop at a strong stretch']],
  ['good_morning', 'Good morning', 'hamstrings', 'hinge', ['barbell', 'rack'], true, 3, ['Bar on the upper back', 'Push the hips back with a flat back', 'Return by driving the hips forward']],
  ['single_leg_rdl', 'Single-leg Romanian deadlift', 'hamstrings', 'hinge', ['dumbbell'], true, 2, ['Hinge on one leg', 'Back leg in line with the torso', 'Hips stay square']],
  ['kb_rdl', 'Kettlebell Romanian deadlift', 'hamstrings', 'hinge', ['kettlebell'], true, 1, ['Bell between the legs', 'Push the hips back', 'Flat back throughout']],
  ['cable_pull_through', 'Cable pull-through', 'hamstrings', 'hinge', ['cable'], true, 1, ['Face away from a low cable', 'Hinge back with soft knees', 'Drive the hips forward']],
  ['smith_rdl', 'Smith machine Romanian deadlift', 'hamstrings', 'hinge', ['smith'], true, 1, ['Bar close to the legs', 'Hips back to a stretch', 'Back stays flat']],

  // Glutes
  ['smith_hip_thrust', 'Smith machine hip thrust', 'glutes', 'hip_thrust', ['smith', 'bench'], true, 1, ['Upper back on the bench, bar on the hips', 'Drive the hips up', 'Pause at the top']],
  ['machine_hip_thrust', 'Hip thrust machine', 'glutes', 'hip_thrust', ['machine'], true, 1, ['Pad across the hips', 'Push up through the heels', 'Chin tucked, ribs down']],
  ['glute_bridge', 'Barbell glute bridge', 'glutes', 'hip_thrust', ['barbell'], true, 1, ['Back on the floor, bar on the hips', 'Drive the hips up', 'Squeeze at the top']],
  ['single_leg_hip_thrust', 'Single-leg hip thrust', 'glutes', 'hip_thrust', ['bench', 'bodyweight'], true, 2, ['Upper back on the bench', 'Drive through one heel', 'Keep the hips level']],
  ['cable_kickback', 'Cable glute kickback', 'glutes', 'hip_extension', ['cable'], false, 1, ['Ankle strap on', 'Kick the leg back without arching', 'Control the return']],
  ['reverse_hyper', 'Reverse hyperextension', 'glutes', 'hip_extension', ['machine'], false, 2, ['Hips on the pad edge', 'Raise the legs to body height', 'Lower slowly']],
  ['glute_ham_raise', 'Glute-ham raise', 'glutes', 'hip_extension', ['machine'], true, 3, ['Knees just behind the pad', 'Lower with a straight body', 'Pull back up with the hamstrings and glutes']],
  ['band_abduction', 'Banded seated abduction', 'glutes', 'hip_abduction', ['band'], false, 1, ['Band above the knees', 'Push the knees out', 'Slow return']],
  ['cable_abduction', 'Cable hip abduction', 'glutes', 'hip_abduction', ['cable'], false, 1, ['Ankle strap on the outside leg', 'Raise the leg out to the side', 'No leaning']],
  ['frog_pump', 'Frog pump', 'glutes', 'hip_thrust', ['bodyweight'], false, 1, ['Soles of the feet together', 'Drive the hips up', 'Squeeze at the top']],
  ['kb_swing', 'Kettlebell swing', 'glutes', 'hinge', ['kettlebell'], true, 2, ['Hike the bell back between the legs', 'Snap the hips forward', 'Arms just guide the bell']],
  ['b_stance_rdl', 'B-stance Romanian deadlift', 'glutes', 'hinge', ['dumbbell'], true, 2, ['Back foot as a kickstand', 'Hinge on the front leg', 'Drive the hips through']],
  ['curtsy_lunge', 'Curtsy lunge', 'glutes', 'lunge', ['dumbbell'], true, 2, ['Step back and across', 'Front knee over the foot', 'Push through the front heel']],

  // Biceps
  ['ez_curl', 'EZ-bar curl', 'biceps', 'elbow_flexion', ['ez_bar'], false, 1, ['Shoulder-width grip on the angles', 'Elbows by your sides', 'Lower to straight arms']],
  ['incline_db_curl', 'Incline dumbbell curl', 'biceps', 'elbow_flexion', ['dumbbell', 'bench'], false, 2, ['Lie back on an incline, arms hanging', 'Curl without moving the elbows forward', 'Full stretch at the bottom']],
  ['bayesian_curl', 'Behind-the-body cable curl', 'biceps', 'elbow_flexion', ['cable'], false, 2, ['Face away from a low cable', 'Arm starts behind the body', 'Curl without the elbow drifting']],
  ['spider_curl', 'Spider curl', 'biceps', 'elbow_flexion', ['dumbbell', 'bench'], false, 1, ['Chest on an incline bench', 'Arms hang straight down', 'Curl and squeeze']],
  ['concentration_curl', 'Concentration curl', 'biceps', 'elbow_flexion', ['dumbbell'], false, 1, ['Elbow braced on the inner thigh', 'Curl up fully', 'Lower slowly']],
  ['ez_preacher_curl', 'EZ-bar preacher curl', 'biceps', 'elbow_flexion', ['ez_bar', 'bench'], false, 1, ['Upper arms flat on the pad', 'Lower to nearly straight', 'Curl without lifting off']],
  ['cable_hammer_curl', 'Rope hammer curl', 'biceps', 'elbow_flexion', ['cable'], false, 1, ['Rope on a low cable', 'Palms facing each other', 'Elbows fixed']],
  ['reverse_curl', 'Reverse-grip curl', 'biceps', 'elbow_flexion', ['ez_bar'], false, 1, ['Overhand grip', 'Curl with the elbows fixed', 'Control the lowering']],
  ['drag_curl', 'Drag curl', 'biceps', 'elbow_flexion', ['barbell'], false, 2, ['Drag the bar up along the body', 'Elbows move back', 'Squeeze at the top']],
  ['band_curl', 'Band curl', 'biceps', 'elbow_flexion', ['band'], false, 1, ['Stand on the band', 'Curl with elbows at your sides', 'Slow return']],
  ['chin_up_close', 'Close-grip chin-up (biceps focus)', 'biceps', 'elbow_flexion', ['pullup_bar'], true, 2, ['Narrow underhand grip', 'Pull the chin over the bar', 'Lower to a full hang']],
  ['kb_curl', 'Kettlebell curl', 'biceps', 'elbow_flexion', ['kettlebell'], false, 1, ['Hold the handle, bell hanging', 'Curl with the elbow fixed', 'Lower fully']],
  ['machine_curl', 'Biceps curl machine', 'biceps', 'elbow_flexion', ['machine'], false, 1, ['Elbows lined up with the pivot', 'Curl through the full range', 'Slow on the way down']],

  // Triceps
  ['close_grip_bench', 'Close-grip bench press', 'triceps', 'elbow_extension', ['barbell', 'bench', 'rack'], true, 2, ['Hands about shoulder width', 'Elbows tucked', 'Lower to the lower chest']],
  ['dip', 'Triceps dip', 'triceps', 'elbow_extension', ['dip_station'], true, 2, ['Torso upright', 'Lower until elbows reach about 90 degrees', 'Press to straight arms']],
  ['bench_dip', 'Bench dip', 'triceps', 'elbow_extension', ['bench', 'bodyweight'], true, 1, ['Hands on the bench behind you', 'Lower by bending the elbows', 'Stay close to the bench']],
  ['diamond_push_up', 'Close-grip push-up', 'triceps', 'elbow_extension', ['bodyweight'], true, 1, ['Hands close under the chest', 'Elbows along the body', 'Full lockout']],
  ['ez_skull_crusher', 'EZ-bar skull crusher', 'triceps', 'elbow_extension', ['ez_bar', 'bench'], false, 2, ['Lower the bar behind the head', 'Elbows stay narrow', 'Extend fully']],
  ['db_skull_crusher', 'Dumbbell skull crusher', 'triceps', 'elbow_extension', ['dumbbell', 'bench'], false, 1, ['Palms facing each other', 'Lower beside the head', 'Elbows point up']],
  ['rope_pushdown', 'Rope pushdown', 'triceps', 'elbow_extension', ['cable'], false, 1, ['Elbows pinned to your sides', 'Split the rope at the bottom', 'Return to about 90 degrees']],
  ['single_arm_pushdown', 'Single-arm cable pushdown', 'triceps', 'elbow_extension', ['cable'], false, 1, ['One arm, elbow fixed', 'Extend fully', 'Slow return']],
  ['cross_body_extension', 'Cross-body cable extension', 'triceps', 'elbow_extension', ['cable'], false, 2, ['Cable set high on the opposite side', 'Extend the arm across the body', 'Elbow stays still']],
  ['db_kickback', 'Dumbbell kickback', 'triceps', 'elbow_extension', ['dumbbell', 'bench'], false, 1, ['Upper arm parallel to the floor', 'Extend to a straight arm', 'No swinging']],
  ['jm_press', 'JM press', 'triceps', 'elbow_extension', ['barbell', 'bench', 'rack'], true, 3, ['Close grip, elbows forward', 'Lower the bar toward the chin', 'Press back up']],
  ['machine_dip', 'Seated dip machine', 'triceps', 'elbow_extension', ['machine'], true, 1, ['Sit tall, handles at your sides', 'Press down to straight arms', 'Control the return']],
  ['band_pushdown', 'Band pushdown', 'triceps', 'elbow_extension', ['band'], false, 1, ['Band anchored high', 'Elbows pinned', 'Extend fully']],
  ['tate_press', 'Tate press', 'triceps', 'elbow_extension', ['dumbbell', 'bench'], false, 2, ['Dumbbells over the chest, ends touching', 'Lower toward the chest by bending the elbows', 'Extend back up']],

  // Calves
  ['leg_press_calf_raise', 'Leg press calf raise', 'calves', 'calf_raise', ['machine'], false, 1, ['Balls of the feet on the platform edge', 'Pause in the stretch', 'Press up fully']],
  ['smith_calf_raise', 'Smith machine calf raise', 'calves', 'calf_raise', ['smith'], false, 1, ['Balls of the feet on a plate', 'Pause at the bottom', 'Rise as high as you can']],
  ['single_leg_calf_raise', 'Single-leg calf raise', 'calves', 'calf_raise', ['dumbbell'], false, 1, ['One foot on a step', 'Full stretch at the bottom', 'Rise fully']],
  ['donkey_calf_raise', 'Donkey calf raise (machine)', 'calves', 'calf_raise', ['machine'], false, 1, ['Hinge forward under the pad', 'Deep stretch at the bottom', 'Rise high']],
  ['tibialis_raise', 'Tibialis raise', 'calves', 'calf_raise', ['bodyweight'], false, 1, ['Back against a wall, heels forward', 'Lift the toes toward the shins', 'Lower slowly']],
  ['bb_calf_raise', 'Standing barbell calf raise', 'calves', 'calf_raise', ['barbell', 'rack'], false, 2, ['Balls of the feet on a plate', 'Pause in the stretch', 'Rise fully']],
];

// Abs: rep-based movements only (timed holds do not fit set logging).
const ABS: Row[] = [
  ['cable_crunch', 'Cable crunch', 'abs', 'trunk_flexion', ['cable'], false, 1, ['Kneel facing the cable, rope by your head', 'Curl the ribs toward the hips', 'Hips stay still']],
  ['weighted_crunch', 'Weighted crunch', 'abs', 'trunk_flexion', ['dumbbell'], false, 1, ['Hold a weight on the chest', 'Curl the shoulders off the floor', 'Lower slowly']],
  ['machine_crunch', 'Ab crunch machine', 'abs', 'trunk_flexion', ['machine'], false, 1, ['Feet locked in', 'Crunch the ribs down', 'Control the return']],
  ['decline_situp', 'Decline sit-up', 'abs', 'trunk_flexion', ['bench'], false, 2, ['Feet locked on a decline bench', 'Curl up one vertebra at a time', 'Lower under control']],
  ['hanging_leg_raise', 'Hanging leg raise', 'abs', 'hip_flexion', ['pullup_bar'], false, 2, ['Hang with straight arms', 'Raise the legs and curl the pelvis up', 'No swinging']],
  ['hanging_knee_raise', 'Hanging knee raise', 'abs', 'hip_flexion', ['pullup_bar'], false, 1, ['Hang with straight arms', 'Bring the knees toward the chest', 'Lower slowly']],
  ['captains_chair_raise', "Captain's chair leg raise", 'abs', 'hip_flexion', ['machine'], false, 1, ['Back against the pad', 'Raise the knees and curl the pelvis', 'Lower under control']],
  ['reverse_crunch', 'Reverse crunch', 'abs', 'hip_flexion', ['bench'], false, 1, ['Lie on the bench holding behind your head', 'Roll the hips up off the bench', 'Lower slowly']],
  ['lying_leg_raise', 'Lying leg raise', 'abs', 'hip_flexion', ['bodyweight'], false, 1, ['Lower back pressed down', 'Raise straight legs', 'Lower without arching']],
  ['ab_wheel', 'Ab wheel rollout', 'abs', 'anti_extension', ['bodyweight'], false, 3, ['Start on the knees', 'Roll out with a flat back', 'Pull back using the abs']],
  ['barbell_rollout', 'Barbell rollout', 'abs', 'anti_extension', ['barbell'], false, 3, ['Kneel behind the bar', 'Roll forward without the hips sagging', 'Pull back to the start']],
  ['dead_bug', 'Dead bug', 'abs', 'anti_extension', ['bodyweight'], false, 1, ['Lower back pressed into the floor', 'Extend opposite arm and leg', 'Return and switch sides']],
  ['pallof_press', 'Pallof press', 'abs', 'rotation', ['cable'], false, 1, ['Stand side-on to the cable', 'Press the handle straight out', 'Resist the twist']],
  ['cable_woodchop', 'Cable woodchop', 'abs', 'rotation', ['cable'], false, 1, ['Cable set high', 'Rotate down across the body', 'Turn through the trunk, not the arms']],
  ['landmine_rotation', 'Landmine rotation', 'abs', 'rotation', ['landmine'], false, 2, ['Hold the bar end overhead, arms straight', 'Rotate side to side in an arc', 'Hips stay mostly square']],
  ['bicycle_crunch', 'Bicycle crunch', 'abs', 'rotation', ['bodyweight'], false, 1, ['Hands lightly behind the head', 'Elbow toward the opposite knee', 'Slow and controlled']],
  ['v_up', 'V-up', 'abs', 'trunk_flexion', ['bodyweight'], false, 2, ['Lie flat, arms overhead', 'Raise legs and torso together', 'Lower slowly']],
  ['band_crunch', 'Band crunch', 'abs', 'trunk_flexion', ['band'], false, 1, ['Band anchored high', 'Kneel and crunch down', 'Hips stay still']],
];

// Ab staples used by the plan builder (one per equipment setup).
const ABS_STAPLES = new Set(['cable_crunch', 'weighted_crunch', 'hanging_leg_raise', 'reverse_crunch']);

export const EXTRA_EXERCISES: Exercise[] = [
  ...ROWS.map((r) => x(r)),
  ...ABS.map((r) => x(r, ABS_STAPLES.has(r[0]))),
];
