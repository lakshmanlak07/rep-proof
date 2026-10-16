// Plain-language glossary for the Learn tab. Each term carries the evidence label of the idea behind it,
// and links to the science topic that explains it (titles must match TOPICS; checked in engine.test.ts).
// No creator attributions: terms are defined by what they mean in RepProof, not who popularised them.
import type { EvidenceLabel } from './types.ts';

export type Term = { term: string; also?: string; meaning: string; label: EvidenceLabel; topic?: string };

export const GLOSSARY: Term[] = [
  { term: 'Reps in reserve', also: 'RIR', label: 'principle', topic: 'Reps in reserve (RIR)',
    meaning: 'How many more good reps you could have done when you stopped the set. 0 RIR is failure; 2 RIR means two more were possible. It is an estimate, and it gets more accurate closer to failure.' },
  { term: 'Rating of perceived exertion', also: 'RPE', label: 'direct', topic: 'RPE and effort scales',
    meaning: 'A 1-10 effort rating. On the RIR-based scale RepProof uses, RPE = 10 minus reps in reserve: RPE 8 means about 2 reps left.' },
  { term: 'Failure', label: 'principle', topic: 'Training to failure',
    meaning: 'The point where you cannot complete another rep with good form. Sets do not have to reach it to build muscle.' },
  { term: 'Hard set', also: 'working set', label: 'principle', topic: 'Weekly volume',
    meaning: 'A set taken reasonably close to failure. Warm-ups do not count. Weekly volume counts hard sets.' },
  { term: 'Weekly volume', label: 'direct', topic: 'Weekly volume',
    meaning: 'Hard sets per muscle per week. More tends to build more muscle, with diminishing returns and big individual differences.' },
  { term: 'Productive range', label: 'rule', topic: 'Weekly volume',
    meaning: 'RepProof\'s estimate of a sensible weekly set range for your experience level. A starting point that adjusts to your progress, not a law.' },
  { term: 'MEV, MAV, MRV', also: 'volume landmarks', label: 'rule', topic: 'Weekly volume',
    meaning: 'Coaching models for minimum effective, most adaptive and maximum recoverable volume. Useful ideas, not measured biological limits.' },
  { term: 'Junk volume', label: 'principle', topic: 'Weekly volume',
    meaning: 'Sets that add fatigue without adding much growth, usually far from failure or beyond what you recover from. Where that point is differs per person and is still debated.' },
  { term: 'Progressive overload', label: 'principle', topic: 'Progressive overload',
    meaning: 'Doing a little more over time: more reps, more weight or better execution at the same effort.' },
  { term: 'Double progression', label: 'principle', topic: 'Progressive overload',
    meaning: 'Add reps at the same weight until you reach the top of the rep range on every set, then add weight and start again at the bottom. RepProof\'s default.' },
  { term: 'Estimated 1-rep max', also: 'e1RM', label: 'rule', topic: 'Progressive overload',
    meaning: 'A formula estimate (Epley) of the most you could lift once, from a weight and rep count. Used to compare sessions, not as a test result.' },
  { term: 'Autoregulation', label: 'principle', topic: 'Recovery and readiness',
    meaning: 'Adjusting training to how you are performing and recovering on the day, instead of following fixed numbers.' },
  { term: 'Readiness check-in', label: 'rule', topic: 'Recovery and readiness',
    meaning: 'Three quick 1-5 ratings (sleep, soreness, energy) before a workout. A rough day trims a set and blocks weight increases.' },
  { term: 'Deload', label: 'principle', topic: 'Deloads',
    meaning: 'A lighter week to shed fatigue. In RepProof: half the sets at the same weights, offered when performance drops and check-ins are rough.' },
  { term: 'Stimulus-to-fatigue ratio', also: 'SFR', label: 'rule', topic: 'Stimulus-to-fatigue ratio',
    meaning: 'A coaching idea for comparing how much growth signal an exercise gives for the fatigue it costs. Not something studies can measure.' },
  { term: 'Lengthened partials', label: 'principle', topic: 'Range of motion, stretch and partials',
    meaning: 'Partial reps done in the stretched part of the movement. In trials they grew muscle about as well as full range; an option, not a requirement.' },
  { term: 'Maintenance calories', label: 'principle', topic: 'Calorie estimates',
    meaning: 'The calories that keep your weight steady. Equations estimate it; your weight trend over 2-3 weeks tells you the real number.' },
  { term: 'Surplus and deficit', label: 'rule', topic: 'Surplus and deficit',
    meaning: 'Eating above maintenance (surplus) to support gaining, or below it (deficit) to lose fat. The best size of either is not known.' },
  { term: 'Recomp', also: 'body recomposition', label: 'rule', topic: 'Surplus and deficit',
    meaning: 'Eating near maintenance with enough protein while training hard, aiming to gain muscle and lose fat slowly at the same time.' },
  { term: 'Evidence labels', label: 'rule', topic: 'New and viral studies',
    meaning: 'Direct evidence: a study tested it. Principle-based: built from several findings. RepProof rule: our product choice. Every recommendation shows one.' },
  { term: 'Junk volume', label: 'principle', topic: 'Junk volume',
    meaning: 'A community term for sets that add fatigue but little growth. Studies show diminishing returns from more sets, not a fixed point where extra sets stop counting.' },
  { term: 'Mind-muscle connection', also: 'internal focus', label: 'direct', topic: 'Mind-muscle connection',
    meaning: 'Focusing on squeezing the target muscle rather than on moving the weight. One small trial found more biceps growth with it; it is an optional cue, not a requirement.' },
  { term: 'Time under tension', also: 'tempo', label: 'direct', topic: 'Time under tension and rep speed',
    meaning: 'How long a set or rep lasts. With sets taken to failure, a wide range of rep speeds built similar muscle; a slow tempo is not required.' },
];

/** Case-insensitive search over term, abbreviation and meaning. */
export function searchGlossary(q: string): Term[] {
  const k = q.trim().toLowerCase();
  if (!k) return GLOSSARY;
  return GLOSSARY.filter((t) => `${t.term} ${t.also ?? ''} ${t.meaning}`.toLowerCase().includes(k));
}
