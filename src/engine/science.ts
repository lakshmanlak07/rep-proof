import type { EvidenceLabel } from './types.ts';

// Evidence library shown in the app. Built from abstracts checked on 2026-10-01 (see references.ts).
// Creators are never named here (PRD): they suggested topics, research decides.
export type Topic = {
  title: string;
  label: EvidenceLabel;
  shows: string;
  doesNotShow: string;
  inApp: string;
  refIds: string[];
};

export const TOPICS: Topic[] = [
  {
    title: 'Weekly volume',
    label: 'principle',
    shows: 'More hard sets per muscle per week tends to mean more growth.',
    doesNotShow: 'One best number for everyone. Comparisons of under 5, 5-9 and 10+ sets were only a trend.',
    inApp: '1 to 3 hard sets per exercise: 2 by default, 3 for weak points you choose, 1 for strong points. Fewer, harder sets keep fatigue down; weak points get the extra volume.',
    refIds: ['volume_dose'],
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
    title: 'Load and rep ranges',
    label: 'principle',
    shows: 'Muscle grows similarly with light and heavy loads when sets are hard. Heavy loads build more max strength.',
    doesNotShow: 'A special "hypertrophy zone" like 8-12 reps.',
    inApp: 'Rep ranges follow your goal: heavier on big lifts for strength, 6-12 for muscle.',
    refIds: ['load_meta'],
  },
  {
    title: 'Training to failure',
    label: 'principle',
    shows: 'Failure was not needed for strength or size on average. Trained lifters saw a small extra size benefit.',
    doesNotShow: 'That every set must go to failure, or that failure is harmful.',
    inApp: 'Working sets go to failure (beginners stop 1 rep short while learning the lifts). With only 1 to 3 sets, each set should count.',
    refIds: ['failure'],
  },
  {
    title: 'Reps in reserve (RIR)',
    label: 'principle',
    shows: 'Guessing reps left is imperfect but improves with heavier loads and closer to failure. Trained lifters were off by under one rep on the bench press. Adjusting load by RIR beat fixed loading for squat strength.',
    doesNotShow: 'That everyone judges RIR exactly on every exercise.',
    inApp: 'You log RIR on each set. For intermediate and advanced lifters it also adjusts next session’s weight.',
    refIds: ['rir_accuracy', 'rir_bench', 'rir_autoreg'],
  },
  {
    title: 'Progression',
    label: 'principle',
    shows: 'Adding reps and adding weight both built muscle over 8 weeks; strength slightly favored adding weight.',
    doesNotShow: 'That one progression method is best long term.',
    inApp: 'Double progression: add reps to the top of the range, then add weight.',
    refIds: ['progression', 'rir_autoreg'],
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
    title: 'Deloads',
    label: 'principle',
    shows: 'A full week off mid-program did not change muscle growth but led to smaller lower-body strength gains (one study).',
    doesNotShow: 'That you should deload every 4, 6 or 8 weeks.',
    inApp: 'No scheduled deloads. One is offered when lifts go backwards and check-ins are rough, and it cuts sets instead of stopping training.',
    refIds: ['deload'],
  },
  {
    title: 'Readiness check-ins',
    label: 'principle',
    shows: 'Self-reported well-being tracked training stress better than objective tests in athletes.',
    doesNotShow: 'A proven readiness score, or how much to change a workout based on one.',
    inApp: 'A rough check-in cuts one set per exercise and blocks weight increases. Those cut-offs are our choice.',
    refIds: ['checkins', 'autoreg_review'],
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
    title: 'Range of motion and stretch',
    label: 'principle',
    shows: 'Full range, or partial reps at long muscle lengths, grew several muscles more than partials at short lengths. Effects differed by muscle.',
    doesNotShow: 'That lengthened partials beat full reps on every exercise. A 2026 review called the evidence mixed.',
    inApp: 'Cues favor full range with a deep stretch. Lengthened partials are not prescribed yet.',
    refIds: ['rom', 'long_length'],
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
];

export const UNKNOWNS: string[] = [
  'The best number of weekly sets for each person and muscle.',
  'The best calorie surplus for building muscle.',
  'The best rate of weight gain or loss for lean, experienced lifters.',
  'A readiness score that reliably tells you how to change a workout.',
  'Whether protein timing changes long-term muscle growth.',
  'Whether lengthened partials beat full reps for every muscle.',
  'One "best" exercise for any muscle.',
];
