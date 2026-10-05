// Decision engine: Train -> Record -> Interpret -> Adjust.
// After each session, answers per exercise: add weight? add a set? keep the exercise? doing too much?
// train closer to failure? why did it stall? Every answer carries its reason and evidence tier.
// The thresholds here are RepProof rules (Tier 3), built on the principles cited in each explanation.
import { MAX_SETS } from './plan.ts';
import { isBadDay } from './progression.ts';
import type { CheckIn, Explanation, LoggedSet, PlannedExercise } from './types.ts';

export type DecisionKind =
  | 'too_new' | 'progressing' | 'add_set' | 'remove_set' | 'swap' | 'hold_recover' | 'hold_stalled' | 'push_closer';

export type Decision = {
  exerciseId: string;
  kind: DecisionKind;
  setsDelta: -1 | 0 | 1; // applied to the plan
  title: string; // one line answer
  explanation: Explanation;
  swapTo?: string; // exercise id, for kind 'swap'
};

export type DecisionInput = {
  plan: PlannedExercise; // current plan entry (sets before any deload/bad-day cut)
  sessions: LoggedSet[][]; // newest first, including the session just finished
  checkins: (CheckIn | null)[]; // newest first, recent workouts
  swapTo: { id: string; name: string } | null; // best substitute, if any
};

/** Estimated 1-rep max for a set (Epley). An estimate for tracking trends, not a test result. */
export const e1rm = (s: LoggedSet) => s.weight * (1 + s.reps / 30);
const score = (session: LoggedSet[]) => Math.max(...session.map(e1rm));

export function decide({ plan, sessions, checkins, swapTo }: DecisionInput): Decision {
  const id = plan.exerciseId;
  const sets = plan.pinnedSets ?? plan.sets;
  const pinned = plan.pinnedSets !== undefined;
  const d = (kind: DecisionKind, setsDelta: -1 | 0 | 1, title: string, explanation: Explanation, extra: Partial<Decision> = {}): Decision =>
    ({ exerciseId: id, kind, setsDelta, title, explanation, ...extra });

  const s = sessions.filter((x) => x.length);
  if (s.length < 3) {
    return d('too_new', 0, `Building a baseline (${s.length} of 3 sessions)`, {
      text: `Decisions about sets and swaps start after 3 sessions of this exercise, so one good or bad day does not steer your plan. Weight and reps still progress every session.`,
      label: 'rule', refIds: [],
    });
  }

  const scores = s.map(score);
  const bestBefore = Math.max(...scores.slice(2));
  const stalled = scores[0] <= bestBefore && scores[1] <= bestBefore; // 2 exposures without a new best
  const longStall = s.length >= 5 && scores.slice(0, 4).every((x) => x <= Math.max(...scores.slice(4)));
  const dropping = scores[0] < scores[1] && scores[1] < scores[2];
  const recent = checkins.slice(0, 2);
  const rough = recent.filter((c) => c && isBadDay(c)).length;
  const recoveryOk = rough === 0;
  const noCheckins = recent.every((c) => !c);

  // Reps left beyond each set's target, last two sessions.
  const target = (i: number, n: number) => (i === n - 1 ? plan.lastSetRir ?? plan.rirTarget : plan.rirTarget);
  const spare = (session: LoggedSet[]) => {
    const vals = session.map((x, i) => (x.rir ?? target(i, session.length)) - target(i, session.length));
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  const tooEasy = spare(s[0]) >= 2 && spare(s[1]) >= 2;

  // 1. Am I doing too much? Performance falling while recovery check-ins are rough.
  if (dropping && !recoveryOk) {
    if (sets > 1 && !pinned) {
      return d('remove_set', -1, `Doing too much: ${sets} to ${sets - 1} sets`, {
        text: `Performance fell two sessions in a row and ${rough} of your last check-ins were rough. One set fewer next time to manage fatigue; it comes back when you progress again.`,
        label: 'rule', refIds: ['checkins', 'autoreg_review'],
      });
    }
    return d('hold_recover', 0, 'Recover first', {
      text: 'Performance fell two sessions in a row with rough check-ins, and this exercise is already at its minimum. Prioritise sleep and food; a deload week is a reasonable call (Plan tab).',
      label: 'rule', refIds: ['checkins', 'deload'],
    });
  }

  if (stalled) {
    // Why did it stall? Recovery is the first suspect.
    if (!recoveryOk) {
      return d('hold_recover', 0, 'Stalled: recovery first, no extra set', {
        text: `No new best for 2 sessions, and ${rough} of your last check-ins were rough. Adding volume while under-recovered rarely helps, so sets stay at ${sets}. Sleep, food and stress are the likely bottleneck.`,
        label: 'rule', refIds: ['checkins'],
      });
    }
    if (longStall && (sets >= MAX_SETS || pinned) && swapTo) {
      return d('swap', 0, `Try ${swapTo.name}`, {
        text: `No new best in 4 sessions, already at ${sets} sets with recovery looking fine. A different variation of the same movement may restart progress. Your choice: swap it in the plan or keep going.`,
        label: 'rule', refIds: [],
      }, { swapTo: swapTo.id });
    }
    if (sets < MAX_SETS && !pinned) {
      return d('add_set', 1, `Stalled: ${sets} to ${sets + 1} sets`, {
        text: `No new best for 2 sessions and recovery looks ${noCheckins ? 'fine (no rough check-ins logged)' : 'fine'}. On average, more weekly sets meant more growth, so this exercise gets one more set, up to ${MAX_SETS}.`,
        label: 'rule', refIds: ['volume_dose'],
      });
    }
    return d('hold_stalled', 0, 'Stalled: keep going for now', {
      text: `No new best for 2 sessions at ${sets} sets${pinned ? ' (pinned by you)' : ', our maximum'}. Keep going; if it is still stuck after 4 sessions we will suggest a different variation. Check that reps in reserve are logged honestly.`,
      label: 'rule', refIds: ['rir_accuracy'],
    });
  }

  // Should I train closer to failure?
  if (tooEasy) {
    return d('push_closer', 0, 'Train closer to your target effort', {
      text: `For two sessions you finished about ${Math.round(spare(s[0]))} reps further from failure than planned. Getting close to failure matters for the stimulus; push the last reps harder. The weight also goes up faster when sets are too easy.`,
      label: 'principle', refIds: ['failure', 'rir_accuracy'],
    });
  }

  return d('progressing', 0, 'Progressing: no change', {
    text: 'Your estimated strength on this lift is still moving up or holding within normal variation. Same plan: keep adding reps, then weight.',
    label: 'principle', refIds: ['progression'],
  });
}

/** Apply set changes to a plan entry, clamped to 1..MAX_SETS. Pinned entries never change. */
export function applySetChange(plan: PlannedExercise, delta: number): PlannedExercise {
  if (plan.pinnedSets !== undefined || !delta) return plan;
  return { ...plan, sets: Math.min(MAX_SETS, Math.max(1, plan.sets + delta)) };
}

/** "Should I change my program?" Most lifts stalled while recovery is fine. */
export function programAdvice(decisions: Decision[]): Explanation | null {
  const judged = decisions.filter((x) => x.kind !== 'too_new');
  if (judged.length < 3) return null;
  const stuck = judged.filter((x) => ['add_set', 'swap', 'hold_stalled'].includes(x.kind)).length;
  if (stuck / judged.length < 0.5) return null;
  return {
    text: `${stuck} of ${judged.length} lifts have stalled while recovery looks fine. Sets are already being added; if this persists for another week, consider more training days, longer sessions, or marking stuck muscles as weak points (Settings, Edit training profile).`,
    label: 'rule',
    refIds: ['volume_dose', 'frequency_meta'],
  };
}
