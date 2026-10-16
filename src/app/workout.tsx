import 'expo-sqlite/localStorage/install';

import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AccessibilityInfo, Pressable, ScrollView, View } from 'react-native';

import { RPE_OPTIONS, RPE_WHY, rirFromRpe, rpeFromRir, targetLabel, type EffortScale } from '@/engine/effort.ts';
import { available, EXERCISE_BY_ID, substitutes } from '@/engine/exercises.ts';
import { applySetChange, decide, programAdvice, type Decision } from '@/engine/decisions.ts';
import { effortTargets, MUSCLE_NAMES, MUSCLES, repRange, REST_WHY, weeklySetsOf } from '@/engine/plan.ts';
import { adjustForDay, applyPins, isBadDay, suggest, warmup, WARMUP_WHY, type Suggestion } from '@/engine/progression.ts';
import { cooldown, isMissed } from '@/engine/session.ts';
import type { CheckIn, Explanation, LoggedSet, PlannedExercise } from '@/engine/types.ts';
import { saveCoachNotes } from '@/lib/coach';
import {
  bestWeight, daysSince, history, isDeload, recentWorkouts, saveProgram, saveWorkout, toProfile, track, updatePlan, updateProfile, useData, uuid,
} from '@/lib/data';
import { Banner, Button, C, Card, Chip, Choice, IconButton, IconTile, Loading, Press, ProgressBar, Reveal, s, Screen, Section, Sheet, Stepper, T } from '@/ui';
import { alert, attempt } from '@/lib/alert';
import { Badge, Why } from '@/why';
import { isUsableDraft } from '@/lib/draft';
import { reportError } from '@/lib/crash';
import { once, prepareSave, rowProblem, saveFailure, toNumber } from '@/lib/workoutSave';
import { leave } from '@/lib/nav';
import { cancelRestAlert, scheduleRestAlert } from '@/lib/notify';
import { effortScale } from '@/lib/prefs';
import { canCalibrate } from '@/engine/calibration.ts';
import { CalibrationCard } from '@/calibration';

type Row = { weight: string; reps: string; rir: string; done: boolean; rpe?: string };
type Item = {
  planned: PlannedExercise;
  added?: boolean; // logged during the workout, not part of the plan
  exerciseId: string;
  history: LoggedSet[][];
  prevBest: number | null;
  suggestion: Suggestion;
  changed: boolean;
  sets: Row[];
};
type Draft = { userId: string; clientId?: string; dayIndex: number; startedAt: string; checkin: CheckIn | null; items: Item[] };
type Summary = {
  sets: number;
  minutes: number;
  volume: number; // weight × reps, in the user's unit
  prs: string[];
  next: { exerciseId: string; name: string; text: string; decision?: Decision }[];
  cooldown: string[];
  deload: boolean;
  advice: Explanation | null;
  planFailed: boolean; // the workout saved, but the plan changes (sets, decisions) could not be stored
};

const KEY = 'draft_workout';
// Bodyweight movements log added load (belt, vest or dumbbell); 0 = bodyweight only.
const isBodyweight = (id: string) => ['bodyweight', 'pullup_bar', 'dip_station'].some((q) => EXERCISE_BY_ID[id].equipment.includes(q as never));

const short = (n: number) => (n === 0 ? 'to failure' : `${n} rep${n > 1 ? 's' : ''} short of failure`);
/** "last set to failure, others 2 reps short of failure", or one phrase when all sets share a target. */
function effortLabel(p: PlannedExercise) {
  const last = p.lastSetRir ?? p.rirTarget;
  if (last === p.rirTarget) return `all sets ${short(last)}`;
  return `last set ${short(last)}, others ${short(p.rirTarget)}`;
}
const MISSED_KEY = 'missed_choice'; // last answer to the missed-session prompt
const loadDraft = (): Draft | null => { try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; } };
const PAIN_MSG = "Pain isn't something RepProof can assess. Stop the exercise and consider seeing a qualified professional.";
const REST = { compound: 150, isolation: 90 }; // seconds; PRD defaults
// Outside components: clock reads happen in event handlers and intervals, never during render.
const restUntil = (compound: boolean) => Date.now() + 1000 * (compound ? REST.compound : REST.isolation);
const clock = () => Date.now();
/** One calm line after each set; never gamified. */
function feedbackFor(rir: string, target: number, reps: string, repMax: number, rpe?: string) {
  const r = rir === '' ? null : Number(rir);
  if (r === null) return 'Logged.';
  const base = r === 0 ? 'Great. That was to failure.' : rpe ? `Great. That was about RPE ${rpe}.` : `Great. That was approximately ${r} RIR.`;
  if (Number(reps) >= repMax && r <= target) return `${base} Top of the range.`;
  if (r > target + 1) return `${base} You had more in the tank, so feel free to push harder next set.`;
  return base;
}

export default function Workout() {
  const { session, profile, program, refresh } = useData();
  // A draft belongs to the account that started it (several accounts can share a phone).
  const [draft, setDraft] = useState<Draft | null>(() => {
    const d = loadDraft();
    if (!d || d.userId !== session?.user.id) return null;
    if (isUsableDraft(d, session?.user.id, program?.plan.days.length ?? 14, (id) => !!EXERCISE_BY_ID[id])) return d;
    localStorage.removeItem(KEY); // unreadable (older version, renamed exercise): discard, never crash on it
    setTimeout(() => alert('Unfinished workout not restored', 'It was saved by an older version of the app and could not be read. Workouts you finished are not affected.'), 0);
    return null;
  });
  const finishing = useRef(false);
  const [saveError, setSaveError] = useState<{ message: string; retry: boolean } | null>(null);
  // The failure card appears below the Finish button, often off screen: say it.
  useEffect(() => {
    if (saveError) AccessibilityInfo.announceForAccessibility(`${saveError.retry ? 'Not saved yet' : 'Fix before finishing'}. ${saveError.message}`);
  }, [saveError]);
  const [checkin, setCheckin] = useState<CheckIn>({ sleep: 3, soreness: 3, energy: 3 });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false); // saved on the server; next steps still being worked out
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [swapFor, setSwapFor] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [swapped, setSwapped] = useState<string[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [missed, setMissed] = useState(false);
  const [skip, setSkip] = useState(() => localStorage.getItem(MISSED_KEY) === 'skip');
  const [stretched, setStretched] = useState<string[]>([]);
  const [cur, setCur] = useState(0); // exercise on screen
  const [fb, setFb] = useState<string | null>(null); // feedback after logging a set
  const [cues, setCues] = useState(false);
  const [scale] = useState<EffortScale>(effortScale);

  useEffect(() => {
    if (draft || !program) return;
    recentWorkouts(1).then((r) => setMissed(isMissed(r[0] ? daysSince(r[0].finishedAt) : null, program.plan.days.length))).catch(() => {});
  }, [draft, program]);

  useEffect(() => {
    if (draft) localStorage.setItem(KEY, JSON.stringify(draft));
  }, [draft]);

  if (!profile || !program) return <Loading />;
  const unit = profile.unit;
  const deload = isDeload(profile.deload_until);
  const nDays = program.plan.days.length;
  const dayIndex = draft?.dayIndex ?? (program.next_day + (missed && skip ? 1 : 0)) % nDays;
  const day = program.plan.days[dayIndex] ?? program.plan.days[0];

  async function buildItem(planned: PlannedExercise, exerciseId: string, badDay: boolean): Promise<Item> {
    const [h, prevBest] = await Promise.all([history(exerciseId), bestWeight(exerciseId)]);
    const lastWeight = h[0]?.length ? Math.max(...h[0].map((x) => x.weight)) : null;
    const raw = suggest({ ...planned, exerciseId }, h, profile!.experience, unit);
    const sug = adjustForDay(applyPins(raw, planned), lastWeight, { badDay, deload });
    return {
      planned, exerciseId, history: h, prevBest, suggestion: sug,
      changed: sug.weight !== lastWeight || sug.sets !== planned.sets,
      sets: Array.from({ length: sug.sets }, (_, k) => ({
        weight: sug.weight === null ? (isBodyweight(exerciseId) ? '0' : '') : String(sug.weight), reps: String(sug.reps),
        rir: String(k === sug.sets - 1 ? planned.lastSetRir ?? planned.rirTarget : planned.rirTarget), done: false,
        rpe: scale === 'rpe' ? String(rpeFromRir(k === sug.sets - 1 ? planned.lastSetRir ?? planned.rirTarget : planned.rirTarget)) : '',
      })),
    };
  }

  async function start(c: CheckIn | null) {
    setBusy(true);
    const badDay = !!c && isBadDay(c);
    if (c) track('checkin'); // that a check-in was answered, never the answers (health data)
    if (missed) {
      localStorage.setItem(MISSED_KEY, skip ? 'skip' : 'now');
      track('missed_session', { choice: skip ? 'skip' : 'now' });
    }
    try {
      const items = await Promise.all(day.exercises.map((p) => buildItem(p, p.exerciseId, badDay)));
      setDraft({ userId: session!.user.id, clientId: uuid(), dayIndex, startedAt: new Date().toISOString(), checkin: c, items });
    } catch {
      alert('Could not load your history', 'Check your connection and try again.');
    }
    setBusy(false);
  }

  const update = (i: number, fn: (it: Item) => Item) => setDraft((d) => d && { ...d, items: d.items.map((it, k) => (k === i ? fn(it) : it)) });

  function logSet(i: number, j: number) {
    if (!draft) return;
    const it = draft.items[i];
    const problem = !it.sets[j].done && rowProblem(it.sets[j]);
    if (problem) return alert('Check this set', `Set ${j + 1}: ${problem}.`);
    update(i, (x) => ({
      ...x,
      sets: x.sets.map((r, k) => {
        if (k === j) return { ...r, done: !r.done };
        // calibration: first logged weight fills the remaining empty sets
        if (k > j && !r.done && r.weight === '' && x.sets[j].weight) return { ...r, weight: x.sets[j].weight };
        return r;
      }),
    }));
    if (!it.sets[j].done) {
      const compound = EXERCISE_BY_ID[it.exerciseId].compound;
      setRestEnd(restUntil(compound));
      scheduleRestAlert(compound ? REST.compound : REST.isolation, EXERCISE_BY_ID[it.exerciseId].name);
      const said = feedbackFor(it.sets[j].rir, it.planned.rirTarget, it.sets[j].reps, it.planned.repMax, scale === 'rpe' ? it.sets[j].rpe : undefined);
      setFb(said);
      AccessibilityInfo.announceForAccessibility(`Set ${j + 1} logged. ${said} Rest started.`);
    } else setFb(null);
  }

  const move = (i: number, by: -1 | 1) => setDraft((d) => {
    if (!d || i + by < 0 || i + by >= d.items.length) return d;
    const items = [...d.items];
    [items[i], items[i + by]] = [items[i + by], items[i]];
    return { ...d, items };
  });

  // A suggested swap is the user's call: replace the exercise everywhere in the plan.
  async function swapPlanned(fromId: string, toId: string) {
    if (!program) return;
    if (!program.plan.days.some((d) => d.exercises.some((e) => e.exerciseId === fromId))) {
      return alert('Not in your plan', 'You swapped this lift in for today only, so there is nothing to replace in your plan.');
    }
    const days = program.plan.days.map((day) => ({
      ...day, exercises: day.exercises.map((e) => (e.exerciseId === fromId ? { ...e, exerciseId: toId } : e)),
    }));
    const ok = await attempt(() => updatePlan(program.id, { ...program.plan, days, weeklySets: weeklySetsOf(days) }), 'swap it in your plan');
    if (!ok) return;
    track('swap_in_plan', { from: fromId, to: toId });
    setSwapped((x) => [...x, fromId]);
    await refresh(); // the next plan change must build on this one, not on the copy loaded before it
  }

  // Any lift, not just the plan's: 2 working sets, tracked and progressed like planned ones.
  async function addExercise(exerciseId: string) {
    setAdding(false);
    if (!draft || !profile) return;
    const [repMin, repMax] = repRange(profile.goal, EXERCISE_BY_ID[exerciseId].compound);
    const effort = effortTargets(program?.plan.effort ?? 'last_failure', profile.experience);
    const planned = { exerciseId, sets: 2, repMin, repMax, rirTarget: effort.rir, lastSetRir: effort.last };
    const badDay = !!draft.checkin && isBadDay(draft.checkin);
    try {
      const item = { ...(await buildItem(planned, exerciseId, badDay)), added: true };
      setDraft((d) => d && { ...d, items: [...d.items, item] });
      track('exercise_added', { exerciseId });
    } catch {
      alert('Could not add that exercise', 'Check your connection and try again.');
    }
  }

  // Alternatives not already in today's workout (two items with one exercise would share every logged set).
  const swapOptions = (i: number) => substitutes(draft!.items[i].exerciseId, profile!.setup, profile!.avoid, draft!.items.map((x) => x.exerciseId));

  async function swap(i: number, exerciseId: string) {
    setSwapFor(null);
    if (!draft) return;
    const it = draft.items[i];
    const badDay = !!draft.checkin && isBadDay(draft.checkin);
    try {
      const next = await buildItem(it.planned, exerciseId, badDay);
      update(i, (x) => ({ ...next, added: x.added }));
      track('swap', { from: it.exerciseId, to: exerciseId });
    } catch {
      alert('Could not swap that exercise', 'Check your connection and try again.');
    }
  }

  function pain(i: number) {
    if (!draft) return;
    const ex = EXERCISE_BY_ID[draft.items[i].exerciseId];
    alert('Stop this exercise', PAIN_MSG, [
      { text: 'Swap it', onPress: () => setSwapFor(i) },
      {
        text: 'Avoid this movement', onPress: async () => {
          const avoid = [...new Set([...profile!.avoid, ex.pattern])];
          const saved = await attempt(async () => {
            await updateProfile(profile!.id, { avoid });
            // Profile and plan must agree: if the rebuild fails, undo the profile change before reporting the failure.
            try {
              await saveProgram(toProfile({ ...profile!, avoid }, program!.plan), program!.split, program!.next_day);
            } catch (e) {
              await updateProfile(profile!.id, { avoid: profile!.avoid }).catch((err) => reportError(err, 'profile_revert'));
              throw e;
            }
          }, 'update your plan');
          if (!saved) return;
          if (draft.items.length === 1) {
            cancelRestAlert();
            localStorage.removeItem(KEY);
            setDraft(null);
            leave();
            return refresh();
          }
          setDraft((d) => d && { ...d, items: d.items.filter((_, k) => k !== i) });
          setCur((c) => Math.max(0, Math.min(c, draft.items.length - 2)));
          await refresh(); // new active program; finish() updates its next_day
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const prepared = () => prepareSave((draft?.items ?? []).map((it) => ({ ...it, name: EXERCISE_BY_ID[it.exerciseId].name })));

  // Double taps and taps during a slow save are ignored; the lock is released on failure so Retry works.
  const finish = () => once(finishing, finishNow);

  async function finishNow() {
    if (!draft) return;
    const { sets, problems } = prepared();
    if (problems.length) return setSaveError({ message: problems.join('\n'), retry: false });
    // One save id for this workout across retries (drafts from older versions have none): a retry after a
    // save that went through but whose answer was lost returns the same workout instead of a second one.
    const d = draft.clientId ? draft : { ...draft, clientId: uuid() };
    if (!draft.clientId) { localStorage.setItem(KEY, JSON.stringify(d)); setDraft(d); }
    setSaveError(null);
    const prs: string[] = [];
    const next: Summary['next'] = [];
    let perfDrops = 0;
    for (const it of d.items) {
      const done = sets.filter((x) => x.exerciseId === it.exerciseId);
      if (!done.length) continue;
      const name = EXERCISE_BY_ID[it.exerciseId].name;
      const top = Math.max(...done.map((x) => x.weight));
      if (it.prevBest !== null && top > it.prevBest) prs.push(`${name}: ${top} ${unit}`);
      const n = applyPins(suggest(it.planned, [done, ...it.history], profile!.experience, unit), it.planned);
      if (n.kind === 'drop') perfDrops++;
      next.push({ exerciseId: it.exerciseId, name, text: n.explanation.text });
    }
    setBusy(true);
    try {
      await saveWorkout({
        clientId: d.clientId!,
        programId: program!.id, dayIndex: d.dayIndex, dayName: day.name, checkin: d.checkin, startedAt: d.startedAt,
        sets, daysInPlan: nDays, perfDrops,
      });
    } catch (e) {
      setBusy(false);
      return setSaveError({ message: saveFailure(e), retry: true });
    }
    localStorage.removeItem(KEY);
    cancelRestAlert();
    setDraft(null); // saved: drop it from state too, or a later effect run would write it back
    setSaved(true); // show "saved" while next steps are worked out, never the empty check-in screen
    await refresh(); // the server moved next_day; Home and Plan must not offer the day just trained again

    // Interpret -> Adjust: decide per planned lift, apply set changes to the plan (not during a deload).
    let advice: Explanation | null = null;
    let planFailed = false;
    try {
      const checkins = (await recentWorkouts(3)).map((r) => r.checkin);
      const decisions: Decision[] = [];
      for (const it of d.items) {
        const done = sets.filter((x) => x.exerciseId === it.exerciseId);
        if (!done.length || it.added) continue;
        const inDay = new Set<string>(day.exercises.map((e) => String(e.exerciseId)));
        const sub = substitutes(it.exerciseId, profile!.setup, profile!.avoid).find((e) => !inDay.has(e.id)); // never one already in this plan day
        // Swapped for the day: judge the lift actually trained. Its set changes then match nothing in the plan
        // (the plan still holds the original lift), so the original is never changed by another lift's sessions.
        const decision = decide({ plan: { ...it.planned, exerciseId: it.exerciseId }, sessions: [done, ...it.history], checkins, swapTo: sub ? { id: sub.id, name: sub.name } : null });
        decisions.push(decision);
        const entry = next.find((x) => x.exerciseId === it.exerciseId);
        if (entry) entry.decision = decision;
      }
      if (!deload) {
        advice = programAdvice(decisions);
        saveCoachNotes(session!.user.id, decisions, advice); // phone-only advice: kept even if the plan write fails
        const deltas = new Map(decisions.filter((x) => x.setsDelta).map((x) => [x.exerciseId, x.setsDelta]));
        if (deltas.size) {
          const days = program!.plan.days.map((day) => ({
            ...day, exercises: day.exercises.map((e) => applySetChange(e, deltas.get(e.exerciseId) ?? 0)),
          }));
          await updatePlan(program!.id, { ...program!.plan, days, weeklySets: weeklySetsOf(days) });
          await refresh(); // a "Swap in plan" on the summary must build on these set changes
        }
      }
    } catch (e) {
      // The workout itself is saved. Say so honestly instead of showing plan changes that were not stored.
      void reportError(e, 'workout_plan_update');
      planFailed = true;
    }
    setBusy(false);
    const trained = d.items.filter((it) => it.sets.some((r) => r.done)).map((it) => EXERCISE_BY_ID[it.exerciseId].muscle);
    const minutes = Math.max(1, Math.round((clock() - Date.parse(d.startedAt)) / 60000));
    const volume = sets.reduce((a, x) => a + x.weight * x.reps, 0);
    setSummary({ sets: sets.length, minutes, volume, prs, next, cooldown: cooldown(trained), deload, advice, planFailed });
    setSaved(false);
  }

  function confirmFinish() {
    if (!draft) return;
    const { problems, left } = prepared();
    if (problems.length) return setSaveError({ message: problems.join('\n'), retry: false });
    if (!left) return finish();
    alert('Finish workout?', `${left} set${left > 1 ? 's' : ''} not logged. They are optional: logged sets are saved, unlogged ones are skipped.`, [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Finish', onPress: finish },
    ]);
  }

  function quit() {
    alert('Discard this workout?', 'Nothing from this session will be saved.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { cancelRestAlert(); localStorage.removeItem(KEY); setDraft(null); leave(); } },
    ]);
  }

  if (summary) {
    const cleared = (k: Decision['kind']) => k === 'progressing' || k === 'too_new';
    return (
      <Screen>
        <Reveal>
          <View style={{ gap: 10, paddingTop: 12 }}>
            <IconTile name="checkmark" tone="pos" size={48} />
            <T size="xl" header>Workout saved.</T>
            <T muted>{summary.prs.length ? 'Solid session. Here is how it went.' : 'Nice work. Here is how it went.'}</T>
          </View>
        </Reveal>
        <View style={[s.row, { alignItems: 'stretch' }]}>
          {[[`${summary.minutes}m`, 'duration'], [String(summary.sets), 'sets'], [summary.volume >= 1000 ? `${(summary.volume / 1000).toFixed(1)}${unit === 'kg' ? 't' : 'k'}` : String(Math.round(summary.volume)), unit === 'kg' && summary.volume >= 1000 ? 'volume' : `${unit} volume`]].map(([v, l]) => (
            <Card key={l} flat style={{ flex: 1, alignItems: 'center', gap: 2, padding: 14 }}>
              <T size="lg">{v}</T>
              <T size="sm" muted>{l}</T>
            </Card>
          ))}
        </View>
        {summary.prs.length ? (
          <Card>
            <View style={s.row}><Ionicons name="trophy-outline" size={20} color={C.accent} /><T bold>{summary.prs.length} personal record{summary.prs.length > 1 ? 's' : ''}</T></View>
            {summary.prs.map((p) => (
              <View key={p} style={[s.row, { justifyContent: 'space-between' }]}>
                <T style={{ flex: 1 }}>{p}</T>
                <Chip tone="accent" icon="trophy-outline" label="PR" />
              </View>
            ))}
          </Card>
        ) : null}
        <Section title="What changes next time">
          {summary.planFailed ? <Banner tone="warn" text="Your workout is saved, but your plan could not be updated (check your connection). These changes will be suggested again after your next session." /> : null}
          {summary.deload ? <T muted size="sm">Deload week: sets and exercises stay as planned; decisions resume after it.</T> : null}
          {summary.next.map((n) => (
            <Card key={n.exerciseId}>
              <T bold>{n.name}</T>
              <T muted>{n.text}</T>
              {n.decision && !summary.deload ? (<>
                <View style={[s.row, { justifyContent: 'space-between' }]}>
                  <T bold style={{ flex: 1 }} color={cleared(n.decision.kind) ? C.muted : C.accent}>{n.decision.title}</T>
                  <Why e={n.decision.explanation} changed={!cleared(n.decision.kind)} />
                </View>
                {n.decision.kind === 'swap' && n.decision.swapTo && !swapped.includes(n.exerciseId) ? (
                  <Button title={`Swap in plan: ${EXERCISE_BY_ID[n.decision.swapTo].name}`} onPress={() => swapPlanned(n.exerciseId, n.decision!.swapTo!)} />
                ) : null}
                {swapped.includes(n.exerciseId) ? <T muted size="sm">Swapped in your plan.</T> : null}
              </>) : null}
            </Card>
          ))}
        </Section>
        {summary.advice ? (
          <Card flat style={{ backgroundColor: C.accentSoft, borderColor: 'transparent' }}>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <T bold style={{ flex: 1 }} color={C.accent}>Should you change your program?</T>
              <Why e={summary.advice} changed />
            </View>
            <T>{summary.advice.text}</T>
          </Card>
        ) : null}
        {summary.cooldown.length ? (
          <Section title="Cooldown (optional)">
            {summary.cooldown.map((c) => {
              const on = stretched.includes(c);
              return (
                <Press key={c} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                  onPress={() => setStretched(on ? stretched.filter((x) => x !== c) : [...stretched, c])}
                  style={[s.choice, on && { borderColor: C.accent, backgroundColor: C.accentSoft }]}>
                  <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? C.accent : C.control} />
                  <T style={{ flex: 1 }}>{c}</T>
                </Press>
              );
            })}
          </Section>
        ) : null}
        <Button kind="primary" title="Done" onPress={async () => { await refresh(); leave(); }} />
      </Screen>
    );
  }

  if (saved) {
    return (
      <Screen scroll={false}>
        <View style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }} accessibilityLiveRegion="polite">
          <IconTile name="checkmark" tone="pos" size={48} />
          <T size="xl" header>Workout saved.</T>
          <T muted>Working out what changes next time…</T>
        </View>
      </Screen>
    );
  }

  if (!draft) {
    const scale = (k: keyof CheckIn, title: string, low: string, high: string) => (
      <View style={{ gap: 8 }}>
        <T bold>{title}</T>
        <View style={s.row} accessibilityRole="radiogroup">
          {[1, 2, 3, 4, 5].map((v) => {
            const on = checkin[k] === v;
            return (
              <Press key={v} accessibilityRole="radio" accessibilityLabel={`${title} ${v}${v === 1 ? `, ${low}` : v === 5 ? `, ${high}` : ''}`} accessibilityState={{ checked: on }} onPress={() => setCheckin({ ...checkin, [k]: v })} scaleTo={0.94}
                style={{ flex: 1, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
                  backgroundColor: on ? C.accent : C.card, borderColor: on ? C.accent : C.border }}>
                <T bold color={on ? C.onAccent : C.text}>{v}</T>
              </Press>
            );
          })}
        </View>
        <View style={[s.row, { justifyContent: 'space-between' }]}><T muted size="sm">{low}</T><T muted size="sm">{high}</T></View>
      </View>
    );
    return (
      <Screen>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <IconButton icon="close" label="Back" onPress={() => leave()} />
          {deload ? <Chip tone="accent" label="Deload week" /> : null}
        </View>
        <View style={{ gap: 6 }}>
          <Chip tone="accent" label={day.name} />
          <T size="xl" header>Quick check-in</T>
          <T muted>Takes 10 seconds. If you are run down, RepProof adjusts today for you.</T>
        </View>
        {missed ? (
          <Card>
            <T bold>You missed a session</T>
            <Choice value={skip ? 'skip' : 'now'} onChange={(v) => setSkip(v === 'skip')} options={[
              { value: 'now', label: `Do it now: ${program.plan.days[program.next_day].name}` },
              { value: 'skip', label: `Skip to today's session: ${program.plan.days[(program.next_day + 1) % nDays].name}` },
            ]} />
          </Card>
        ) : null}
        {scale('sleep', 'Sleep last night', 'Terrible', 'Great')}
        {scale('soreness', 'Soreness', 'Very sore', 'Not sore')}
        {scale('energy', 'Energy', 'Drained', 'Great')}
        <View style={{ flex: 1 }} />
        <Button kind="primary" title="Start workout" icon="play" loading={busy} onPress={() => start(checkin)} />
        <Button kind="ghost" title="Skip check-in" disabled={busy} onPress={() => start(null)} />
      </Screen>
    );
  }

  // ───────── Active workout: one exercise at a time ─────────
  const i = Math.min(cur, draft.items.length - 1);
  const it = draft.items[i];
  const ex = EXERCISE_BY_ID[it.exerciseId];
  const total = draft.items.reduce((a, x) => a + x.sets.length, 0);
  const logged = draft.items.reduce((a, x) => a + x.sets.filter((r) => r.done).length, 0);
  const j = it.sets.findIndex((r) => !r.done); // current set; -1 = exercise complete
  const setRow = j >= 0 ? it.sets[j] : null;
  const step = unit === 'kg' ? 2.5 : 5;
  const w = it.suggestion.weight;
  const patch = (f: 'weight' | 'reps' | 'rir', v: string) => update(i, (x) => ({ ...x, sets: x.sets.map((y, k) => (k === j ? { ...y, [f]: v } : y)) }));
  // An RPE entry also sets the reps in reserve the engine uses (half steps round toward failure).
  const patchRpe = (v: number) => update(i, (x) => ({ ...x, sets: x.sets.map((y, k) => (k === j ? { ...y, rpe: String(v), rir: String(rirFromRpe(v)) } : y)) }));
  // toNumber: "62,5" from comma keyboards is 62.5, not 0 (which made the on-screen next-session advice wrong).
  const doneSets: LoggedSet[] = it.sets.filter((r) => r.done).map((r) => ({ weight: toNumber(r.weight) || 0, reps: toNumber(r.reps) || 0, rir: r.rir === '' ? null : toNumber(r.rir) }));
  const rec = j === -1 && doneSets.length ? applyPins(suggest(it.planned, [doneSets, ...it.history], profile.experience, unit), it.planned) : null;
  const nextRow = j >= 0 && restEnd ? it.sets[j] : null;
  const goto = (k: number) => { setCur(k); setFb(null); setRestEnd(null); cancelRestAlert(); setCues(false); };
  const rirTarget = j >= 0 ? (j === it.sets.length - 1 ? it.planned.lastSetRir ?? it.planned.rirTarget : it.planned.rirTarget) : it.planned.rirTarget;

  return (
    <Screen>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <IconButton icon="close" label="Discard workout" onPress={quit} />
        <View style={{ flex: 1, gap: 6, paddingHorizontal: 6 }}>
          <T size="sm" muted style={{ textAlign: 'center' }}>{day.name} · exercise {i + 1} of {draft.items.length} · {logged}/{total} sets</T>
          <ProgressBar value={logged} max={total} label="Sets logged" />
        </View>
        <IconButton icon="add" label="Add an exercise" onPress={() => setAdding(true)} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {draft.items.map((x, k) => {
          const all = x.sets.every((r) => r.done);
          const on = k === i;
          return (
            <Pressable key={`${k}-${x.exerciseId}`} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => goto(k)}
              accessibilityLabel={`Exercise ${k + 1}: ${EXERCISE_BY_ID[x.exerciseId].name}${all ? ', done' : ''}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, paddingHorizontal: 14, borderRadius: 18, backgroundColor: on ? C.accent : C.card, borderWidth: 1, borderColor: on ? C.accent : C.border }}>
              {all ? <Ionicons name="checkmark-circle" size={14} color={on ? C.onAccent : C.pos} /> : null}
              <T size="sm" bold color={on ? C.onAccent : C.text}>{k + 1}. {EXERCISE_BY_ID[x.exerciseId].name.split(' ').slice(0, 2).join(' ')}</T>
            </Pressable>
          );
        })}
      </ScrollView>

      <Reveal key={`${i}-${it.exerciseId}`}>
        <View style={{ gap: 10 }}>
          <View style={{ gap: 2 }}>
            <T size="sm" muted>{ex.muscle} · {ex.compound ? 'compound' : 'isolation'}</T>
            <T size="xl" header>{ex.name}</T>
          </View>
          <Card variant="tint" style={{ gap: 8 }}>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <T size="micro">Suggested today</T>
              <Why e={it.suggestion.explanation} changed={it.changed} />
            </View>
            <View style={[s.row, { flexWrap: 'wrap' }]}>
              <T size="lg">
                {w === null ? (isBodyweight(it.exerciseId) ? 'Bodyweight' : 'Pick your weight') : `${w} ${unit}`} × {it.planned.pinnedReps !== undefined ? `${it.planned.pinnedReps}` : `${it.suggestion.reps}–${it.planned.repMax}`}
              </T>
              <Chip tone="accent" label={targetLabel(it.planned.rirTarget, scale)} />
            </View>
            <T muted size="sm">
              {w === null ? (isBodyweight(it.exerciseId) ? 'Log added weight (0 if none). ' : 'Calibrate: pick a starting weight. ') : ''}{effortLabel(it.planned)}{it.planned.pinnedReps !== undefined ? ' · reps pinned' : ''}
            </T>
          </Card>
        </View>
      </Reveal>

      {/* Completed sets */}
      {it.sets.some((r) => r.done) ? (
        <Card flat style={{ gap: 8 }}>
          <View style={s.row}>
            {['Set', unit, 'Reps', scale === 'rpe' ? 'RPE' : 'RIR', ''].map((h, k) => <T key={k} size="sm" muted style={{ flex: k === 0 ? 0.6 : k === 4 ? 0.7 : 1, textAlign: 'center' }}>{h}</T>)}
          </View>
          {it.sets.map((r, k) => r.done ? (
            <Pressable key={k} accessibilityRole="button" accessibilityLabel={`Set ${k + 1} logged: ${r.weight} ${unit} × ${r.reps}. Tap to edit`} onPress={() => logSet(i, k)} style={s.row}>
              <T bold style={{ flex: 0.6, textAlign: 'center' }}>{k + 1}</T>
              {[r.weight, r.reps, scale === 'rpe' && r.rpe ? r.rpe : r.rir === '' ? '–' : r.rir].map((v, n) => (
                <View key={n} style={{ flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: C.sunken, alignItems: 'center', justifyContent: 'center' }}>
                  <T bold>{v}</T>
                </View>
              ))}
              <View style={{ flex: 0.7, alignItems: 'center' }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="checkmark" size={18} color={C.onAccent} />
                </View>
              </View>
            </Pressable>
          ) : null)}
          <T size="sm" muted>Tap a logged set to edit it.</T>
        </Card>
      ) : null}

      {/* Rest timer */}
      {restEnd ? <RestPanel end={restEnd} total={ex.compound ? REST.compound : REST.isolation} scale={scale}
        onAdjust={(sec) => { const end = restEnd + sec * 1000; setRestEnd(end); scheduleRestAlert((end - clock()) / 1000, ex.name); }}
        onDone={() => { setRestEnd(null); cancelRestAlert(); }} next={nextRow ? `${nextRow.weight} ${unit} × ${it.suggestion.reps}–${it.planned.repMax}` : null} rir={rirTarget} /> : null}

      {/* Active set */}
      {setRow ? (
        <Card style={{ gap: 18 }}>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <T size="micro">Set {j + 1} of {it.sets.length}</T>
            <T muted size="sm">Target {targetLabel(rirTarget, scale)}</T>
          </View>
          <View style={{ gap: 4 }}>
            <Stepper big label="Weight" value={setRow.weight} onChange={(v) => patch('weight', v)} step={step} unit={unit} />
          </View>
          <View style={{ height: 1, backgroundColor: C.border }} />
          <View style={{ gap: 8 }}>
            <T bold>Reps</T>
            <Stepper label="Reps" value={setRow.reps} onChange={(v) => patch('reps', v)} step={1} min={1} />
          </View>
          {scale === 'rpe' ? (
            <View style={{ gap: 8 }}>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <T bold>Effort (RPE)</T>
                <Why e={RPE_WHY} />
              </View>
              <T muted size="sm">10 = no reps left, 9 = one left, 8 = two left. 6 means four or more.</T>
              {[RPE_OPTIONS.slice(0, 5), RPE_OPTIONS.slice(5)].map((row, n) => (
                <View key={n} style={s.row}>
                  {row.map((v) => {
                    const on = setRow.rpe === String(v);
                    return (
                      <Press key={v} accessibilityRole="radio" accessibilityLabel={`RPE ${v}${v === 6 ? ', four or more reps in reserve' : `, about ${rirFromRpe(v)} reps in reserve`}`} accessibilityState={{ checked: on }} onPress={() => patchRpe(v)} scaleTo={0.94}
                        style={{ flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, backgroundColor: on ? C.accent : C.card, borderColor: on ? C.accent : C.border }}>
                        <T bold color={on ? C.onAccent : C.text}>{v === 6 ? '≤6' : v}</T>
                      </Press>
                    );
                  })}
                </View>
              ))}
            </View>
          ) : (
          <View style={{ gap: 8 }}>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <T bold>Reps in reserve (RIR)</T>
              <T muted size="sm">How many more could you do?</T>
            </View>
            <View style={s.row}>
              {['0', '1', '2', '3', '4'].map((v) => {
                const on = setRow.rir === v;
                return (
                  <Press key={v} accessibilityRole="radio" accessibilityLabel={`${v === '4' ? '4 or more' : v} reps in reserve`} accessibilityState={{ checked: on }} onPress={() => patch('rir', v)} scaleTo={0.94}
                    style={{ flex: 1, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, backgroundColor: on ? C.accent : C.card, borderColor: on ? C.accent : C.border }}>
                    <T bold color={on ? C.onAccent : C.text}>{v === '4' ? '4+' : v}</T>
                  </Press>
                );
              })}
            </View>
          </View>
          )}
          {fb ? <T size="sm" bold color={C.pos}>{fb}</T> : null}
          <Button kind="primary" title={`Log set ${j + 1}`} icon="checkmark" disabled={!setRow.weight || !setRow.reps} onPress={() => logSet(i, j)} />
          {w === null && j === 0 ? <T muted size="sm">First time: warm up with 1 light set of 5, then pick a weight that leaves you the target reps in reserve.</T> : null}
        </Card>
      ) : null}

      {/* After the last set: the recommendation */}
      {rec ? (
        <Reveal>
          <Card variant="tint">
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <T size="micro">Next session</T>
              <Badge label={rec.explanation.label} />
            </View>
            {fb ? <T bold color={C.pos}>{fb}</T> : null}
            <T size="lg">
              {rec.kind === 'up' && rec.weight !== null ? `Increase to ${rec.weight} ${unit} next session.`
                : rec.kind === 'reps' && rec.weight !== null ? `Stay at ${rec.weight} ${unit} and aim for ${rec.reps} reps.`
                : rec.kind === 'drop' && rec.weight !== null ? `Drop to ${rec.weight} ${unit} next session.`
                : 'Keep the same weight next session.'}
            </T>
            <T muted>{rec.explanation.text}</T>
          </Card>
        </Reveal>
      ) : null}

      {/* E-02: optional RIR rep-out, isolation exercises only, after the exercise is complete */}
      {j === -1 && canCalibrate(ex) && session ? <CalibrationCard userId={session.user.id} exerciseId={ex.id} name={ex.name} /> : null}

      {/* Warm-up, cues, tools */}
      <Card flat>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <T muted size="sm" style={{ flex: 1 }}>
            {w === null ? 'Warm-up: 1 light set of 5 first' : `Warm-up: 1 × ${warmup(w, unit, ex.equipment.includes('barbell')).reps} at ${warmup(w, unit, ex.equipment.includes('barbell')).weight} ${unit}`}
          </T>
          <Why e={WARMUP_WHY} />
        </View>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: cues }} onPress={() => setCues(!cues)} style={[s.row, { justifyContent: 'space-between', minHeight: 48 }]}>
          <T bold size="sm">Key cues</T>
          <Ionicons name={cues ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
        </Pressable>
        {cues ? ex.cues.map((c) => <T key={c} muted size="sm">• {c}</T>) : null}
        <View style={s.row}>
          <Button title="Swap" icon="swap-horizontal" size="sm" style={{ flex: 1 }} onPress={() => setSwapFor(i)} />
          <Button title="Pain stop" icon="alert-circle-outline" size="sm" style={{ flex: 1 }} onPress={() => pain(i)} />

          <IconButton icon="arrow-up" label={`Move ${ex.name} up`} onPress={() => { move(i, -1); if (i > 0) setCur(i - 1); }} />
          <IconButton icon="arrow-down" label={`Move ${ex.name} down`} onPress={() => { move(i, 1); if (i < draft.items.length - 1) setCur(i + 1); }} />
        </View>
      </Card>

      <View style={s.row}>
        <Button title="Previous" icon="chevron-back" style={{ flex: 1 }} disabled={i === 0} onPress={() => goto(i - 1)} />
        {i < draft.items.length - 1 ? (
          <Button kind={j === -1 ? 'primary' : 'secondary'} title="Next exercise" style={{ flex: 1.4 }} onPress={() => goto(i + 1)} />
        ) : (
          <Button kind="primary" title="Finish workout" style={{ flex: 1.4 }} loading={busy} onPress={confirmFinish} />
        )}
      </View>
      {i < draft.items.length - 1 ? <Button kind="ghost" title="Finish workout" loading={busy} onPress={confirmFinish} /> : null}
      {saveError ? (
        <Card style={{ borderColor: C.danger }}>
          <T bold color={C.danger}>{saveError.retry ? 'Not saved yet' : 'Fix before finishing'}</T>
          <T>{saveError.message}</T>
          {saveError.retry ? <Button kind="primary" title="Retry" loading={busy} onPress={finish} /> : null}
        </Card>
      ) : null}

      <Sheet visible={adding} onClose={() => setAdding(false)} title="Add an exercise">
        <T muted size="sm">Logged and tracked like the rest of your plan.</T>
        {adding ? (
          <ScrollView style={{ maxHeight: 420 }} nestedScrollEnabled>
            {MUSCLES.map((m) => {
              const options = available(profile.setup, profile.avoid).filter((e) => e.muscle === m && !draft.items.some((x) => x.exerciseId === e.id));
              if (!options.length) return null;
              return (
                <View key={m} style={{ gap: 6, marginBottom: 12 }}>
                  <T size="micro">{MUSCLE_NAMES[m]}</T>
                  {options.map((e) => <Button key={e.id} title={e.name} onPress={() => addExercise(e.id)} />)}
                </View>
              );
            })}
          </ScrollView>
        ) : null}
        <Button kind="ghost" title="Cancel" onPress={() => setAdding(false)} />
      </Sheet>

      <Sheet visible={swapFor !== null} onClose={() => setSwapFor(null)} title="Swap for">
        {swapFor !== null ? swapOptions(swapFor).map((e) => (
          <Button key={e.id} title={e.name} onPress={() => swap(swapFor, e.id)} />
        )) : null}
        {swapFor !== null && !swapOptions(swapFor).length ? <T muted>No alternatives with your equipment.</T> : null}
        <Button kind="ghost" title="Cancel" onPress={() => setSwapFor(null)} />
      </Sheet>
    </Screen>
  );
}

function RestPanel({ end, total, onAdjust, onDone, next, rir, scale }: { end: number; total: number; onAdjust: (sec: number) => void; onDone: () => void; next: string | null; rir: number; scale: EffortScale }) {
  const [now, setNow] = useState(clock);
  useEffect(() => {
    const t = setInterval(() => setNow(clock()), 500);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.ceil((end - now) / 1000));
  const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  const done = left === 0;
  useEffect(() => {
    if (done) AccessibilityInfo.announceForAccessibility('Rest done. Start your next set.');
  }, [done]);
  // Board 05 · 06 Rest timer: big countdown, progress, ±15 s, up next, skip.
  return (
    <Card style={{ gap: 12 }}>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <T size="micro">{left ? 'Rest' : 'Rest done'}</T>
        <Why e={REST_WHY} />
      </View>
      <View style={{ alignItems: 'center', gap: 2 }} accessible accessibilityRole="timer" accessibilityLabel={`Rest: ${fmt(left)} left of ${fmt(total)}`}>
        <T size="display" color={left ? C.text : C.accent} style={{ fontVariant: ['tabular-nums'] }}>{fmt(left)}</T>
        <T size="sm" muted>of {fmt(total)}</T>
      </View>
      <ProgressBar value={total - left} max={total} label="Rest elapsed" />
      <T size="sm" muted style={{ textAlign: 'center' }}>{total >= 120 ? 'Compound lifts do best with 2 to 3 minutes of rest.' : 'Isolation lifts need about 1 to 2 minutes.'}</T>
      {left ? (
        <View style={s.row}>
          <Button title="−15 s" kind="outline" size="sm" style={{ flex: 1 }} onPress={() => onAdjust(-15)} />
          <Button title="+15 s" kind="outline" size="sm" style={{ flex: 1 }} onPress={() => onAdjust(15)} />
        </View>
      ) : null}
      {next ? (
        <Card flat style={{ padding: 14, gap: 2 }}>
          <T size="sm" muted>Up next</T>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <T bold>{next}</T>
            <T muted size="sm">Target {scale === 'rpe' ? targetLabel(rir, 'rpe') : rir === 0 ? 'failure' : `${rir}${rir < 4 ? '–' + (rir + 1) : '+'} RIR`}</T>
          </View>
        </Card>
      ) : null}
      <Button title={left ? 'Skip rest' : 'Start next set'} kind="primary" onPress={onDone} />
    </Card>
  );
}
