import 'expo-sqlite/localStorage/install';

import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, View } from 'react-native';

import { available, EXERCISE_BY_ID, substitutes } from '@/engine/exercises.ts';
import { applySetChange, decide, programAdvice, type Decision } from '@/engine/decisions.ts';
import { effortTargets, MUSCLE_NAMES, MUSCLES, repRange, REST_WHY, weeklySetsOf } from '@/engine/plan.ts';
import { adjustForDay, applyPins, isBadDay, suggest, warmup, WARMUP_WHY, type Suggestion } from '@/engine/progression.ts';
import { cooldown, isMissed } from '@/engine/session.ts';
import type { CheckIn, Explanation, LoggedSet, PlannedExercise } from '@/engine/types.ts';
import { saveCoachNotes } from '@/lib/coach';
import {
  bestWeight, daysSince, history, isDeload, recentWorkouts, saveProgram, saveWorkout, toProfile, track, updatePlan, updateProfile, useData, type DraftSet,
} from '@/lib/data';
import { Button, C, Card, Chip, Choice, IconButton, IconTile, Loading, Press, ProgressBar, Reveal, s, Screen, Section, Sheet, Stepper, T } from '@/ui';
import { alert, attempt } from '@/lib/alert';
import { Badge, Why } from '@/why';
import { leave } from '@/lib/nav';

type Row = { weight: string; reps: string; rir: string; done: boolean };
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
type Draft = { userId: string; dayIndex: number; startedAt: string; checkin: CheckIn | null; items: Item[] };
type Summary = {
  sets: number;
  prs: string[];
  next: { exerciseId: string; name: string; text: string; decision?: Decision }[];
  cooldown: string[];
  deload: boolean;
  advice: Explanation | null;
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
function feedbackFor(rir: string, target: number, reps: string, repMax: number) {
  const r = rir === '' ? null : Number(rir);
  if (r === null) return 'Logged.';
  const base = r === 0 ? 'Great. That was to failure.' : `Great. That was approximately ${r} RIR.`;
  if (Number(reps) >= repMax && r <= target) return `${base} Top of the range.`;
  if (r > target + 1) return `${base} You had more in the tank, so feel free to push harder next set.`;
  return base;
}

export default function Workout() {
  const { session, profile, program, refresh } = useData();
  // A draft belongs to the account that started it (several accounts can share a phone).
  const [draft, setDraft] = useState<Draft | null>(() => {
    const d = loadDraft();
    return d && d.userId === session?.user.id ? d : null;
  });
  const finishing = useRef(false);
  const [checkin, setCheckin] = useState<CheckIn>({ sleep: 3, soreness: 3, energy: 3 });
  const [busy, setBusy] = useState(false);
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
      })),
    };
  }

  async function start(c: CheckIn | null) {
    setBusy(true);
    const badDay = !!c && isBadDay(c);
    if (c) track('checkin', { bad: badDay });
    if (missed) {
      localStorage.setItem(MISSED_KEY, skip ? 'skip' : 'now');
      track('missed_session', { choice: skip ? 'skip' : 'now' });
    }
    try {
      const items = await Promise.all(day.exercises.map((p) => buildItem(p, p.exerciseId, badDay)));
      setDraft({ userId: session!.user.id, dayIndex, startedAt: new Date().toISOString(), checkin: c, items });
    } catch {
      alert('Could not load your history', 'Check your connection and try again.');
    }
    setBusy(false);
  }

  const update = (i: number, fn: (it: Item) => Item) => setDraft((d) => d && { ...d, items: d.items.map((it, k) => (k === i ? fn(it) : it)) });

  function logSet(i: number, j: number) {
    if (!draft) return;
    const it = draft.items[i];
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
      setRestEnd(restUntil(EXERCISE_BY_ID[it.exerciseId].compound));
      setFb(feedbackFor(it.sets[j].rir, it.planned.rirTarget, it.sets[j].reps, it.planned.repMax));
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
    const days = program.plan.days.map((day) => ({
      ...day, exercises: day.exercises.map((e) => (e.exerciseId === fromId ? { ...e, exerciseId: toId } : e)),
    }));
    const ok = await attempt(() => updatePlan(program.id, { ...program.plan, days, weeklySets: weeklySetsOf(days) }), 'swap it in your plan');
    if (!ok) return;
    track('swap_in_plan', { from: fromId, to: toId });
    setSwapped((x) => [...x, fromId]);
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

  async function swap(i: number, exerciseId: string) {
    setSwapFor(null);
    if (!draft) return;
    const it = draft.items[i];
    track('swap', { from: it.exerciseId, to: exerciseId });
    const badDay = !!draft.checkin && isBadDay(draft.checkin);
    const next = await buildItem(it.planned, exerciseId, badDay);
    update(i, () => next);
  }

  function pain(i: number) {
    if (!draft) return;
    const ex = EXERCISE_BY_ID[draft.items[i].exerciseId];
    track('pain', { exercise: ex.id });
    alert('Stop this exercise', PAIN_MSG, [
      { text: 'Swap it', onPress: () => setSwapFor(i) },
      {
        text: 'Avoid this movement', onPress: async () => {
          const avoid = [...new Set([...profile!.avoid, ex.pattern])];
          const saved = await attempt(async () => {
            await updateProfile(profile!.id, { avoid });
            await saveProgram(toProfile({ ...profile!, avoid }, program!.plan), program!.split, program!.next_day);
          }, 'update your plan');
          if (!saved) return;
          setDraft((d) => d && { ...d, items: d.items.filter((_, k) => k !== i) });
          await refresh(); // new active program; finish() updates its next_day
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function finish() {
    if (finishing.current || !draft) return; // double tap must not save the workout twice
    finishing.current = true;
    const d = draft;
    const sets: DraftSet[] = d.items.flatMap((it) => it.sets.filter((r) => r.done).map((r, k) => {
      const weight = Number(r.weight) || 0;
      const reps = Number(r.reps) || 0;
      return {
        exerciseId: it.exerciseId, setIndex: k, weight, reps, rir: r.rir === '' ? null : Number(r.rir),
        overridden: weight !== it.suggestion.weight || reps !== it.suggestion.reps,
      };
    }));
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
        programId: program!.id, dayIndex: d.dayIndex, dayName: day.name, checkin: d.checkin, startedAt: d.startedAt,
        sets, daysInPlan: nDays, perfDrops,
      });
    } catch {
      setBusy(false);
      finishing.current = false;
      return alert('Not saved yet', 'Your workout is kept on this phone. Check your connection and tap Finish again.');
    }
    localStorage.removeItem(KEY);
    setDraft(null); // saved: drop it from state too, or a later effect run would write it back

    // Interpret -> Adjust: decide per planned lift, apply set changes to the plan (not during a deload).
    let advice: Explanation | null = null;
    try {
      const checkins = (await recentWorkouts(3)).map((r) => r.checkin);
      const decisions: Decision[] = [];
      for (const it of d.items) {
        const done = sets.filter((x) => x.exerciseId === it.exerciseId);
        if (!done.length || it.added) continue;
        const sub = substitutes(it.exerciseId, profile!.setup, profile!.avoid)[0];
        const decision = decide({ plan: it.planned, sessions: [done, ...it.history], checkins, swapTo: sub ? { id: sub.id, name: sub.name } : null });
        decisions.push(decision);
        const entry = next.find((x) => x.exerciseId === it.exerciseId);
        if (entry) entry.decision = decision;
      }
      if (!deload) {
        advice = programAdvice(decisions);
        const deltas = new Map(decisions.filter((x) => x.setsDelta).map((x) => [x.exerciseId, x.setsDelta]));
        if (deltas.size) {
          const days = program!.plan.days.map((day) => ({
            ...day, exercises: day.exercises.map((e) => applySetChange(e, deltas.get(e.exerciseId) ?? 0)),
          }));
          await updatePlan(program!.id, { ...program!.plan, days, weeklySets: weeklySetsOf(days) });
        }
        saveCoachNotes(session!.user.id, decisions, advice);
      }
    } catch {
      // decisions are advice; the workout itself is already saved
    }
    setBusy(false);
    const trained = d.items.filter((it) => it.sets.some((r) => r.done)).map((it) => EXERCISE_BY_ID[it.exerciseId].muscle);
    setSummary({ sets: sets.length, prs, next, cooldown: cooldown(trained), deload, advice });
  }

  function confirmFinish() {
    if (!draft) return;
    const left = draft.items.reduce((a, it) => a + it.sets.filter((r) => !r.done).length, 0);
    if (!left) return finish();
    alert('Finish workout?', `${left} set${left > 1 ? 's' : ''} not logged. Unlogged sets are not saved.`, [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Finish', onPress: finish },
    ]);
  }

  function quit() {
    alert('Discard this workout?', 'Nothing from this session will be saved.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { localStorage.removeItem(KEY); setDraft(null); leave(); } },
    ]);
  }

  if (summary) {
    const cleared = (k: Decision['kind']) => k === 'progressing' || k === 'too_new';
    return (
      <Screen>
        <Reveal>
          <View style={{ alignItems: 'center', gap: 12, paddingVertical: 24 }}>
            <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark" size={46} color="#fff" />
            </View>
            <T size="xl">Workout complete</T>
            <T muted>{summary.sets} working sets logged</T>
          </View>
        </Reveal>
        {summary.prs.length ? (
          <Card flat style={{ backgroundColor: C.posSoft, borderColor: 'transparent' }}>
            <View style={s.row}><Ionicons name="trophy" size={20} color={C.pos} /><T bold color={C.pos}>New personal best</T></View>
            {summary.prs.map((p) => <T key={p} bold>{p}</T>)}
          </Card>
        ) : null}
        <Section title="What changes next time">
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
                  <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? C.accent : C.faint} />
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

  if (!draft) {
    const scale = (k: keyof CheckIn, title: string, low: string, high: string, icon: keyof typeof Ionicons.glyphMap) => (
      <Card>
        <View style={s.row}><IconTile name={icon} tone="neutral" size={34} /><T bold>{title}</T></View>
        <View style={s.row}>
          {[1, 2, 3, 4, 5].map((v) => (
            <Press key={v} accessibilityState={{ selected: checkin[k] === v }} onPress={() => setCheckin({ ...checkin, [k]: v })} scaleTo={0.92}
              style={{ flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                backgroundColor: checkin[k] === v ? C.accent : C.sunken }}>
              <T bold color={checkin[k] === v ? '#fff' : C.text}>{v}</T>
            </Press>
          ))}
        </View>
        <View style={[s.row, { justifyContent: 'space-between' }]}><T muted size="sm">{low}</T><T muted size="sm">{high}</T></View>
      </Card>
    );
    return (
      <Screen>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <IconButton icon="close" label="Back" onPress={() => leave()} />
          {deload ? <Chip tone="accent" label="Deload week" /> : null}
        </View>
        <View style={{ gap: 6 }}>
          <T size="micro">Before you start</T>
          <T size="xl">{day.name}</T>
          <T muted>A ten-second check-in. If you are run down, Rep Proof adjusts today for you.</T>
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
        {scale('sleep', 'Sleep last night', '1 terrible', '5 great', 'moon')}
        {scale('soreness', 'Soreness', '1 very sore', '5 not sore', 'body')}
        {scale('energy', 'Energy', '1 drained', '5 great', 'flash')}
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
  const doneSets: LoggedSet[] = it.sets.filter((r) => r.done).map((r) => ({ weight: Number(r.weight) || 0, reps: Number(r.reps) || 0, rir: r.rir === '' ? null : Number(r.rir) }));
  const rec = j === -1 && doneSets.length ? applyPins(suggest(it.planned, [doneSets, ...it.history], profile.experience, unit), it.planned) : null;
  const nextRow = j >= 0 && restEnd ? it.sets[j] : null;
  const goto = (k: number) => { setCur(k); setFb(null); setRestEnd(null); setCues(false); };
  const rirTarget = j >= 0 ? (j === it.sets.length - 1 ? it.planned.lastSetRir ?? it.planned.rirTarget : it.planned.rirTarget) : it.planned.rirTarget;

  return (
    <Screen>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <IconButton icon="close" label="Discard workout" onPress={quit} />
        <View style={{ flex: 1, gap: 6, paddingHorizontal: 6 }}>
          <T size="micro" style={{ textAlign: 'center' }}>{day.name} · {logged} of {total} sets</T>
          <ProgressBar value={logged} max={total} />
        </View>
        <IconButton icon="add" label="Add an exercise" onPress={() => setAdding(true)} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {draft.items.map((x, k) => {
          const all = x.sets.every((r) => r.done);
          const on = k === i;
          return (
            <Pressable key={`${k}-${x.exerciseId}`} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => goto(k)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: on ? C.ink : C.card, borderWidth: 1, borderColor: on ? C.ink : C.border }}>
              {all ? <Ionicons name="checkmark-circle" size={14} color={on ? '#fff' : C.pos} /> : null}
              <T size="sm" bold color={on ? '#fff' : C.text}>{k + 1}. {EXERCISE_BY_ID[x.exerciseId].name.split(' ').slice(0, 2).join(' ')}</T>
            </Pressable>
          );
        })}
      </ScrollView>

      <Reveal key={`${i}-${it.exerciseId}`}>
        <View style={{ gap: 10 }}>
          <View style={[s.row, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <T size="micro">{ex.muscle} · {ex.compound ? 'compound' : 'isolation'}</T>
              <T size="xl">{ex.name}</T>
            </View>
            <Why e={it.suggestion.explanation} changed={it.changed} />
          </View>
          <T muted>
            {w === null ? (isBodyweight(it.exerciseId) ? 'Bodyweight: log added weight (0 if none)' : 'Calibrate: pick your starting weight') : `Target ${w} ${unit}`} · {it.planned.pinnedReps !== undefined ? `${it.planned.pinnedReps} reps (pinned)` : `${it.suggestion.reps}–${it.planned.repMax} reps`}
          </T>
          <T muted size="sm">{effortLabel(it.planned)}</T>
        </View>
      </Reveal>

      {/* Completed sets */}
      {it.sets.some((r) => r.done) ? (
        <Card flat style={{ gap: 0, paddingVertical: 6 }}>
          {it.sets.map((r, k) => r.done ? (
            <Pressable key={k} accessibilityRole="button" accessibilityLabel={`Undo set ${k + 1}`} onPress={() => logSet(i, k)}
              style={[s.row, { minHeight: 46, justifyContent: 'space-between' }]}>
              <View style={s.row}>
                <Ionicons name="checkmark-circle" size={20} color={C.pos} />
                <T bold>Set {k + 1}</T>
              </View>
              <T bold>{r.weight} {unit} × {r.reps}</T>
              <T muted size="sm">{r.rir === '' ? '' : `${r.rir} RIR`}</T>
            </Pressable>
          ) : null)}
        </Card>
      ) : null}

      {/* Rest timer */}
      {restEnd ? <RestPanel end={restEnd} onDone={() => setRestEnd(null)} next={nextRow ? `${nextRow.weight} ${unit} × ${it.suggestion.reps}–${it.planned.repMax}` : null} rir={rirTarget} /> : null}

      {/* Active set */}
      {setRow ? (
        <Card style={{ gap: 18 }}>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <T size="micro" color={C.accent}>Set {j + 1} of {it.sets.length}</T>
            <T muted size="sm">Target {rirTarget} RIR</T>
          </View>
          <View style={{ gap: 4 }}>
            <Stepper big value={setRow.weight} onChange={(v) => patch('weight', v)} step={step} unit={unit} />
          </View>
          <View style={{ height: 1, backgroundColor: C.border }} />
          <View style={{ gap: 8 }}>
            <T size="micro">Reps</T>
            <Stepper value={setRow.reps} onChange={(v) => patch('reps', v)} step={1} min={1} />
          </View>
          <View style={{ gap: 8 }}>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <T size="micro">Reps in reserve (RIR)</T>
              <T muted size="sm">How many more could you do?</T>
            </View>
            <View style={s.row}>
              {['0', '1', '2', '3', '4'].map((v) => {
                const on = setRow.rir === v;
                return (
                  <Press key={v} accessibilityState={{ selected: on }} onPress={() => patch('rir', v)} scaleTo={0.92}
                    style={{ flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.accent : C.sunken }}>
                    <T bold color={on ? '#fff' : C.text}>{v === '4' ? '4+' : v}</T>
                  </Press>
                );
              })}
            </View>
          </View>
          {fb ? <T size="sm" bold color={C.pos}>{fb}</T> : null}
          <Button kind="primary" title={`Log set ${j + 1}`} icon="checkmark" disabled={!setRow.weight || !setRow.reps} onPress={() => logSet(i, j)} />
          {w === null && j === 0 ? <T muted size="sm">First time: warm up with 1 light set of 5, then pick a weight that leaves you the target reps in reserve.</T> : null}
        </Card>
      ) : null}

      {/* After the last set: the recommendation */}
      {rec ? (
        <Reveal>
          <Card flat style={{ backgroundColor: C.accentSoft, borderColor: 'transparent' }}>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <T size="micro" color={C.accent}>Rep Proof recommendation</T>
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

      {/* Warm-up, cues, tools */}
      <Card flat>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <T muted size="sm" style={{ flex: 1 }}>
            {w === null ? 'Warm-up: 1 light set of 5 first' : `Warm-up: 1 × ${warmup(w, unit, ex.equipment.includes('barbell')).reps} at ${warmup(w, unit, ex.equipment.includes('barbell')).weight} ${unit}`}
          </T>
          <Why e={WARMUP_WHY} />
        </View>
        <Pressable accessibilityRole="button" onPress={() => setCues(!cues)} style={[s.row, { justifyContent: 'space-between' }]}>
          <T bold size="sm">Key cues</T>
          <Ionicons name={cues ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
        </Pressable>
        {cues ? ex.cues.map((c) => <T key={c} muted size="sm">• {c}</T>) : null}
        <View style={s.row}>
          <Button title="Swap" icon="swap-horizontal" style={{ flex: 1, minHeight: 44 }} onPress={() => setSwapFor(i)} />
          <Button title="Pain" icon="warning" kind="danger" style={{ flex: 1, minHeight: 44 }} onPress={() => pain(i)} />
          <IconButton icon="arrow-up" label="Move up" onPress={() => { move(i, -1); if (i > 0) setCur(i - 1); }} />
          <IconButton icon="arrow-down" label="Move down" onPress={() => { move(i, 1); if (i < draft.items.length - 1) setCur(i + 1); }} />
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

      <Sheet visible={adding} onClose={() => setAdding(false)} title="Add an exercise">
        <T muted size="sm">Logged and tracked like the rest of your plan.</T>
        {adding ? (
          <ScrollView style={{ maxHeight: 420 }}>
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
        {swapFor !== null ? substitutes(draft.items[swapFor].exerciseId, profile.setup, profile.avoid).map((e) => (
          <Button key={e.id} title={e.name} onPress={() => swap(swapFor, e.id)} />
        )) : null}
        {swapFor !== null && !substitutes(draft.items[swapFor].exerciseId, profile.setup, profile.avoid).length ? <T muted>No alternatives with your equipment.</T> : null}
        <Button kind="ghost" title="Cancel" onPress={() => setSwapFor(null)} />
      </Sheet>
    </Screen>
  );
}

function RestPanel({ end, onDone, next, rir }: { end: number; onDone: () => void; next: string | null; rir: number }) {
  const [now, setNow] = useState(clock);
  useEffect(() => {
    const t = setInterval(() => setNow(clock()), 500);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.ceil((end - now) / 1000));
  return (
    <Card style={{ alignItems: 'center', gap: 10, borderColor: left ? C.border : C.accent }}>
      <View style={[s.row, { alignSelf: 'stretch', justifyContent: 'space-between' }]}>
        <T size="micro">{left ? 'Rest timer' : 'Rest done'}</T>
        <Why e={REST_WHY} />
      </View>
      <T size="display" color={left ? C.text : C.accent}>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</T>
      {next ? (
        <View style={{ alignItems: 'center', gap: 2 }}>
          <T size="micro">Next set</T>
          <T bold>{next}</T>
          <T muted size="sm">Target {rir === 0 ? 'failure' : `${rir}${rir < 4 ? '–' + (rir + 1) : '+'} RIR`}</T>
        </View>
      ) : null}
      <Button title={left ? 'Skip rest' : 'Start next set'} kind={left ? 'secondary' : 'primary'} onPress={onDone} style={{ alignSelf: 'stretch' }} />
    </Card>
  );
}
