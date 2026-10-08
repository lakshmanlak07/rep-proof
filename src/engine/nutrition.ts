import type { Explanation, Unit } from './types.ts';

export type Phase = 'gain' | 'maintain' | 'cut' | 'recomp';
export type NutritionInput = {
  bodyweight: number; // in `unit`
  unit: Unit;
  heightCm: number;
  age: number;
  sex: 'male' | 'female' | null;
  days: number; // training days per week
  phase: Phase;
};
export type Targets = { calories: number; protein: number; fat: number; carbs: number; explanations: Explanation[] };

const LB_PER_KG = 2.20462;
const PHASE_FACTOR: Record<Phase, number> = { gain: 1.1, maintain: 1, cut: 0.8, recomp: 1 };
const PHASE_TEXT: Record<Phase, string> = { maintain: '', gain: ', plus 10% to gain', cut: ', minus 20% to cut', recomp: ', kept at maintenance for a recomp' };

export function targets(i: NutritionInput): Targets {
  const kg = i.unit === 'kg' ? i.bodyweight : i.bodyweight / LB_PER_KG;
  // Mifflin-St Jeor resting energy: +5 male, -161 female; midpoint (-78) when not given.
  const sexTerm = i.sex === 'male' ? 5 : i.sex === 'female' ? -161 : -78;
  const resting = 10 * kg + 6.25 * i.heightCm - 5 * i.age + sexTerm;
  const activity = i.days >= 4 ? 1.55 : 1.375;
  const calories = Math.round((resting * activity * PHASE_FACTOR[i.phase]) / 10) * 10;
  const protein = Math.round(kg * 1.6);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  const explanations: Explanation[] = [
    {
      text: `About ${calories} kcal a day: your estimated resting energy (Mifflin-St Jeor equation from weight, height, age${i.sex ? ' and sex' : ''}) × ${activity} for ${i.days} training days a week${PHASE_TEXT[i.phase]}. The equation explains about 71% of differences between people, so treat it as a starting point and adjust to your weight trend.`,
      label: 'principle',
      refIds: ['mifflin'],
    },
    {
      text: `${protein} g protein a day (1.6 g per kg of bodyweight). Across 49 trials, gains in lean mass leveled off around this intake.`,
      label: 'direct',
      refIds: ['protein'],
    },
    {
      text: `${fat} g fat (25% of calories) and ${carbs} g carbs (the rest). The split between fat and carbs is our default, not a study finding.`,
      label: 'rule',
      refIds: [],
    },
  ];
  if (i.phase === 'gain') explanations.push({ text: 'The +10% surplus is our default. No study has found the best surplus size for building muscle.', label: 'rule', refIds: ['surplus'] });
  if (i.phase === 'cut') explanations.push({ text: 'The -20% deficit is our default, not a study finding. Lifting while you cut helps keep muscle; keep training hard.', label: 'rule', refIds: [] });
  if (i.phase === 'recomp') {
    explanations.push({ text: 'Recomp means eating at about maintenance with the same protein target while training hard, aiming to add muscle and lose fat slowly at the same time. It is our option, not a study-tested prescription: expect slower change than a dedicated gain or cut, and judge it by your gym progress and weight trend over several weeks.', label: 'rule', refIds: [] });
  }
  if (!i.sex) {
    explanations.push({ text: 'You chose not to give your sex, so the calorie estimate uses the midpoint of the male and female equations.', label: 'rule', refIds: [] });
  }
  return { calories, protein, fat, carbs, explanations };
}

// Education cards. Founder reviews wording before release.
export const NUTRITION_CARDS: { title: string; body: string; explanation: Explanation }[] = [
  {
    title: 'Protein basics',
    body: 'Protein supplies the building blocks for new muscle. Hitting your daily total matters most. Spreading it over 3 to 5 meals is a sensible default. Food or shakes both count.',
    explanation: { text: 'Daily total: lean-mass gains leveled off around 1.6 g per kg across 49 trials. Spreading it out: 20 g every 3 hours raised muscle protein synthesis more than smaller or larger doses in one short-term study, which is a marker, not proof of more growth.', label: 'principle', refIds: ['protein', 'protein_distribution'] },
  },
  {
    title: 'Gaining vs cutting',
    body: 'Eating a bit above maintenance supports muscle gain; eating below it loses fat. Change slowly: check your average bodyweight over 2 to 3 weeks before adjusting calories again.',
    explanation: { text: 'The phase percentages (+10% to gain, -20% to cut) and the 2-3 week check are RepProof defaults. A review found the best surplus size for muscle gain is unknown.', label: 'rule', refIds: ['surplus'] },
  },
  {
    title: 'Calories from watches and trackers',
    body: 'Your target already counts your training days, so RepProof does not add back calories burned from a watch, tracker or gym machine. If your weight trend drifts from your goal, adjust the target instead.',
    explanation: { text: 'Not adding exercise calories on top of a target that already includes training is our rule, to avoid counting the same activity twice.', label: 'rule', refIds: [] },
  },
];
