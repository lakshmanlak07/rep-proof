// Shared types for the training engine. Pure data: no React, no Supabase.

export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type Goal = 'muscle' | 'strength' | 'both';
export type Unit = 'kg' | 'lb';
export type Setup = 'commercial' | 'home';

export type Muscle =
  | 'chest' | 'back' | 'shoulders' | 'quads' | 'hamstrings'
  | 'glutes' | 'biceps' | 'triceps' | 'calves';

export type Pattern =
  | 'horizontal_push' | 'vertical_push' | 'horizontal_pull' | 'vertical_pull'
  | 'squat' | 'lunge' | 'hinge' | 'hip_thrust' | 'knee_extension' | 'knee_flexion'
  | 'fly' | 'lateral_raise' | 'elbow_flexion' | 'elbow_extension' | 'calf_raise';

export type Equipment = 'barbell' | 'rack' | 'dumbbell' | 'bench' | 'machine' | 'cable';

// direct = a study tested this exact thing; principle = follows a studied principle;
// rule = RepProof design choice with no direct study.
export type EvidenceLabel = 'direct' | 'principle' | 'rule';

export type Explanation = { text: string; label: EvidenceLabel; refIds: string[] };

export type Exercise = {
  id: string;
  name: string;
  muscle: Muscle;
  pattern: Pattern;
  equipment: Equipment[];
  compound: boolean;
  difficulty: 1 | 2 | 3;
  cues: string[];
};

export type Profile = {
  experience: Experience;
  goal: Goal;
  setup: Setup;
  days: number; // 2-6
  sessionMinutes: number;
  unit: Unit;
  avoid: Pattern[];
  weak?: Muscle[]; // weak points: 3 sets per exercise
  strong?: Muscle[]; // strong points: 1 set per exercise
};

export type PlannedExercise = {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  rirTarget: number;
  pinnedSets?: number; // user override; engine stops adjusting it
  pinnedReps?: number;
};

export type PlannedDay = { name: string; exercises: PlannedExercise[] };

export type SplitId = 'full_body' | 'upper_lower' | 'ulppl' | 'ppl';

export type Program = {
  split: SplitId;
  weeklySets: Partial<Record<Muscle, number>>;
  days: PlannedDay[];
  explanations: Explanation[];
  emphasis?: { weak: Muscle[]; strong: Muscle[] }; // kept with the plan so rebuilds remember it
};

export type LoggedSet = { weight: number; reps: number; rir: number | null };

export type CheckIn = { sleep: number; soreness: number; energy: number }; // 1-5, 5 = best
