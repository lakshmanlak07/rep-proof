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
      text: `${protein} g protein a day (1.6 g per kg of bodyweight). Across 49 trials, gains in lean mass leveled off around this intake; the uncertainty range reached about 2.2 g per kg, so eating more is reasonable but not required.`,
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

/**
 * Weight trend against the chosen phase (backlog H-02). Needs at least 4 weigh-ins spanning 14+ days in the last
 * 28 days; otherwise returns null (not enough data, say nothing). The rate is a least-squares slope, so one
 * heavy or light day does not swing it. Thresholds are a RepProof rule, not study-tested limits.
 */
export function weightTrendCheck(weighIns: { weight: number; logged_on: string }[], phase: Phase, today = new Date()):
  { perWeekPct: number; tone: 'pos' | 'warn'; text: string; explanation: Explanation } | null {
  const day = (iso: string) => Date.parse(`${iso}T12:00:00Z`) / 864e5;
  const now = day(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
  const pts = weighIns.filter((w) => Number.isFinite(w.weight) && w.weight > 0 && now - day(w.logged_on) <= 28 && now >= day(w.logged_on));
  if (pts.length < 4) return null;
  const xs = pts.map((w) => day(w.logged_on));
  if (Math.max(...xs) - Math.min(...xs) < 14) return null;
  const ys = pts.map((w) => w.weight);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const slopePerDay = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  const perWeekPct = Math.round(((slopePerDay * 7) / my) * 1000) / 10; // % of bodyweight per week, 1 decimal
  const rate = `${perWeekPct > 0 ? '+' : ''}${perWeekPct}% of bodyweight a week`;
  const explanation: Explanation = {
    text: 'RepProof rule: a cut losing more than about 1% of bodyweight a week, a gain adding more than about 0.5%, or maintenance drifting more than about 0.5% suggests the calorie target is off for you. These are common coaching guidelines, not study-tested limits; adjust in small steps (about 100–200 kcal) and re-check after two more weeks.',
    label: 'rule', refIds: [],
  };
  const say = (tone: 'pos' | 'warn', text: string) => ({ perWeekPct, tone, text: `Your weight trend: ${rate} over the last ${Math.round(Math.max(...xs) - Math.min(...xs))} days. ${text}`, explanation });
  if (phase === 'cut') {
    if (perWeekPct < -1) return say('warn', 'Faster than about 1% a week; consider eating a little more to protect muscle and training quality.');
    if (perWeekPct >= 0) return say('warn', 'Not dropping yet. If you have logged consistently, consider lowering your target slightly.');
    return say('pos', 'In a sensible range for a cut.');
  }
  if (phase === 'gain') {
    if (perWeekPct > 0.5) return say('warn', 'Faster than about 0.5% a week; more of it is likely fat. Consider eating a little less.');
    if (perWeekPct <= 0) return say('warn', 'Not gaining yet. If you have logged consistently, consider raising your target slightly.');
    return say('pos', 'In a sensible range for a gain.');
  }
  if (Math.abs(perWeekPct) > 0.5) return say('warn', `Drifting ${perWeekPct > 0 ? 'up' : 'down'} for ${phase === 'recomp' ? 'a recomp' : 'maintenance'}. Consider adjusting your target slightly.`);
  return say('pos', 'Steady, as intended.');
}
