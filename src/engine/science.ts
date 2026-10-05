import type { EvidenceLabel } from './types.ts';

// RepProof's scientific identity and evidence library, shown in the app.
// Built from abstracts checked against PubMed (see references.ts). Creators are never named here (PRD):
// they suggest topics; research decides.

export const POSITIONING = 'Evidence-based training without the guesswork.';
export const MOTTO = 'Evidence first. Individual response second. Algorithmic recommendations third. Hype never.';
export const MISSION =
  'RepProof separates established findings from coaching principles and from its own rules, and turns them into training decisions that learn from you. It does not promise one optimal program for everyone.';

/** The small set of robust principles everything in the app is built on. */
export const PRINCIPLES: string[] = [
  'Train hard enough to give a meaningful stimulus.',
  'Improve performance over time: load, reps or execution.',
  'Do enough productive volume, not the most you can survive.',
  'Use a reasonably broad range of reps.',
  'Manage fatigue: getting close to failure matters; reaching it every set is optional.',
  'Eat enough protein and match calories to your goal.',
  'Recover: sleep, food and stress decide how much training pays off.',
  'Adjust to how you respond, not to fixed numbers.',
];

/** The three evidence tiers every recommendation carries (see why.tsx for the badges). */
export const TIERS: { label: EvidenceLabel; name: string; meaning: string; example: string }[] = [
  {
    label: 'direct', name: 'Tier 1: Direct evidence',
    meaning: 'Supported directly by high-quality research: meta-analyses, systematic reviews, randomized trials.',
    example: 'With weekly sets equal, training frequency made no meaningful difference to growth.',
  },
  {
    label: 'principle', name: 'Tier 2: Principle-based',
    meaning: 'A practical recommendation built from several findings. Sensible, but not itself tested as a universal rule.',
    example: 'Earlier sets stop about 2 reps short and the last set goes to failure.',
  },
  {
    label: 'rule', name: 'Tier 3: RepProof rule',
    meaning: 'A product decision that turns evidence into action. Not a scientific discovery, and we never present it as one.',
    example: 'Add one set when a lift stalls for 2 sessions and your check-ins look fine.',
  },
];

/** Where RepProof deliberately does not turn uncertainty into certainty. */
export const CAUTIONS: string[] = [
  'Stretch-focused training is promising, but "stretch-biased exercises are superior" is not established.',
  'Lengthened partials matched full range of motion in trials; they are an option, not a requirement.',
  'No weekly set number is optimal for everyone. Volume landmarks like MEV and MRV are models, not biology.',
  'Reps in reserve is an estimate, not a measurement.',
  'Pump and soreness are not measures of muscle growth.',
  'Stimulus-to-fatigue ratio is a useful coaching idea, not a measurable quantity.',
  'Supplements are not equal: a few have strong evidence; most do not.',
  'One viral study does not overturn a body of evidence.',
];

/** Open debates. RepProof shows them as debates, not settled answers. */
export const DEBATES: string[] = [
  'How much volume becomes "junk volume", and whether it exists for everyone.',
  'Whether occasional all-out sets add anything beyond sets taken close to failure.',
  'Whether stretch-biased exercises grow specific muscles more.',
  'How close to failure beginners should train while learning technique.',
  'The best rate of weight gain when bulking, and of loss when cutting, for lean lifters.',
  'The best calorie surplus for building muscle.',
  'Whether protein timing changes long-term growth.',
  'One "best" exercise for any muscle.',
];

export type Topic = {
  title: string;
  label: EvidenceLabel;
  shows: string;
  doesNotShow: string;
  inApp: string;
  refIds: string[]; // may be empty only for Tier 3 rules with no supporting study
};

export const TOPICS: Topic[] = [
  {
    title: 'Progressive overload',
    label: 'principle',
    shows: 'Adding reps and adding weight both built muscle over 8 weeks; strength slightly favored adding weight. Adjusting load by reps in reserve beat fixed loading for squat strength.',
    doesNotShow: 'That one progression method is best long term.',
    inApp: 'Double progression: add reps to the top of the range, then add weight. Every session suggests the next step and says why.',
    refIds: ['progression', 'rir_autoreg'],
  },
  {
    title: 'Weekly volume',
    label: 'principle',
    shows: 'More hard sets per muscle per week tends to mean more growth, with diminishing returns.',
    doesNotShow: 'One best number for everyone. Comparisons of under 5, 5-9 and 10+ sets were only a trend, and volume landmarks (MEV, MAV, MRV) are models, not constants.',
    inApp: '1 to 3 sets per exercise: 2 by default, 3 for weak points, 1 for strong points. When a lift stalls for 2 sessions and recovery looks fine, it gets a set (up to 3). When performance falls with rough check-ins, it loses one.',
    refIds: ['volume_dose'],
  },
  {
    title: 'Training to failure',
    label: 'principle',
    shows: 'Failure was not needed for strength or size on average. Trained lifters saw a small extra size benefit.',
    doesNotShow: 'That every set must go to failure, or that failure is harmful.',
    inApp: 'Default: earlier sets about 2 reps short, last set to failure (beginners 1 short). You can choose all sets 1-3 short, or every set to failure.',
    refIds: ['failure'],
  },
  {
    title: 'Reps in reserve (RIR)',
    label: 'principle',
    shows: 'Guessing reps left is imperfect but improves with heavier loads and closer to failure. Trained lifters were off by under one rep on the bench press.',
    doesNotShow: 'That anyone judges RIR exactly on every exercise. It is an estimate.',
    inApp: 'You log RIR per set. Each set is compared with its own target; consistently easy sets speed up progression and trigger a "train closer" note.',
    refIds: ['rir_accuracy', 'rir_bench'],
  },
  {
    title: 'Load and rep ranges',
    label: 'principle',
    shows: 'Muscle grows similarly with light and heavy loads when sets are hard. Heavy loads build more max strength.',
    doesNotShow: 'A special "hypertrophy zone" like 8-12 reps.',
    inApp: 'Reps from 6 to 15: 6-10 on big lifts (5-8 for strength), 10-15 on isolation work.',
    refIds: ['load_meta'],
  },
  {
    title: 'Training frequency',
    label: 'direct',
    shows: 'With the same weekly sets, training a muscle 1, 2, 3 or 6 times a week grew it about the same.',
    doesNotShow: 'That every muscle must be trained twice a week, or that three times beats two.',
    inApp: 'Your split is chosen to fit the days you have, not to chase a frequency.',
    refIds: ['frequency_meta', 'frequency_2v3', 'frequency_3v6'],
  },
  {
    title: 'Rest between sets',
    label: 'principle',
    shows: 'Resting over 60 seconds gave a small growth benefit, with little difference past 90 seconds. In trained men, 3 minutes beat 1 minute for strength and size.',
    doesNotShow: 'That you need 3-5 minutes of rest to grow.',
    inApp: 'Rest timer: 90 seconds on single-joint lifts, 2.5 minutes on big compounds. Rest longer if you need to.',
    refIds: ['rest', 'rest_long', 'rest_review'],
  },
  {
    title: 'Recovery and readiness',
    label: 'principle',
    shows: 'Self-reported well-being tracked training stress better than objective tests in athletes.',
    doesNotShow: 'A proven readiness score, or how much to change a workout based on one.',
    inApp: 'Check-ins are inputs, not diagnoses. A rough day cuts a set and blocks weight increases; rough check-ins stop the app adding volume to a stalled lift. Those cut-offs are our rules.',
    refIds: ['checkins', 'autoreg_review'],
  },
  {
    title: 'Deloads',
    label: 'principle',
    shows: 'A full week off mid-program did not change muscle growth but led to smaller lower-body strength gains (one study).',
    doesNotShow: 'That you should deload every 4, 6 or 8 weeks.',
    inApp: 'No scheduled deloads. One is offered when lifts go backwards and check-ins are rough, and it cuts sets instead of stopping training.',
    refIds: ['deload'],
  },
  {
    title: 'Warm-ups',
    label: 'principle',
    shows: 'In 15 trained men, a warm-up at 80% of the working load led to more total reps than lighter warm-ups.',
    doesNotShow: 'One required warm-up sequence.',
    inApp: 'One warm-up set before every exercise: about 80% of your working weight for 5 reps.',
    refIds: ['warmup'],
  },
  {
    title: 'Range of motion, stretch and partials',
    label: 'principle',
    shows: 'Full range, or partials at long muscle lengths, grew several muscles more than partials at short lengths. In two trials (one with 297 people), lengthened partials and full range gave practically the same growth.',
    doesNotShow: 'That stretch-biased exercises or lengthened partials are superior. The evidence is mixed.',
    inApp: 'Cues favor full range with a good stretch. Lengthened partials are a valid option, not a requirement.',
    refIds: ['rom', 'long_length', 'lp_wolf', 'lp_multisite'],
  },
  {
    title: 'Pump and soreness',
    label: 'principle',
    shows: 'Muscle damage does not drive muscle growth; programs that caused little damage built similar muscle and strength.',
    doesNotShow: 'That soreness or a pump means a workout worked, or that no soreness means it did not.',
    inApp: 'Soreness is only a recovery input in your check-in. Progress is judged by performance over time.',
    refIds: ['damage'],
  },
  {
    title: 'Stimulus-to-fatigue ratio',
    label: 'rule',
    shows: 'Nothing directly: it is a coaching framework for comparing exercises, not something research measures.',
    doesNotShow: 'That any exercise has a known, objective stimulus-to-fatigue score.',
    inApp: 'The app never ranks exercises by it. Swaps keep the same movement pattern and muscle.',
    refIds: [],
  },
  {
    title: 'Protein',
    label: 'direct',
    shows: 'Across 49 trials, lean-mass gains leveled off around 1.6 g per kg per day. Short term, 20 g every 3 hours raised muscle protein synthesis more than smaller or larger doses.',
    doesNotShow: 'That 1.6 g/kg is a hard ceiling for everyone, or that a set number of meals grows more muscle long term.',
    inApp: 'Your protein target is 1.6 g per kg of bodyweight.',
    refIds: ['protein', 'protein_distribution'],
  },
  {
    title: 'Calorie estimates',
    label: 'principle',
    shows: 'The Mifflin-St Jeor equation explained about 71% of differences in measured resting energy.',
    doesNotShow: 'Your exact maintenance calories.',
    inApp: 'Your target starts from the equation and an activity factor. Your weight trend is the real test.',
    refIds: ['mifflin'],
  },
  {
    title: 'Surplus and deficit',
    label: 'rule',
    shows: 'A review found the best surplus size for building muscle is unknown.',
    doesNotShow: 'That +250 or +500 kcal is optimal.',
    inApp: '+10% to gain and -20% to cut are our defaults. Adjust using your weight trend.',
    refIds: ['surplus'],
  },
  {
    title: 'Supplements',
    label: 'direct',
    shows: 'Creatine with resistance training added about 1.1 kg of lean mass versus placebo across 35 trials. Caffeine improved strength, muscle endurance and power (moderate-quality evidence).',
    doesNotShow: 'That popular supplements work equally. Most have weak evidence.',
    inApp: 'RepProof does not prescribe supplements or doses. Ask a qualified professional before taking any.',
    refIds: ['creatine', 'caffeine'],
  },
  {
    title: 'New and viral studies',
    label: 'rule',
    shows: 'Single studies often disagree; meta-analyses pool many of them, which is why they rank highest.',
    doesNotShow: 'That one new study overturns everything before it.',
    inApp: 'A study changes the app only when it is checked against its record and fits the wider evidence.',
    refIds: [],
  },
];
