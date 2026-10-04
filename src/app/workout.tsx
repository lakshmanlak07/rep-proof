import 'expo-sqlite/localStorage/install';

import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import { available, EXERCISE_BY_ID, substitutes } from '@/engine/exercises.ts';
import { MUSCLE_NAMES, MUSCLES, repRange, REST_WHY, rirTarget } from '@/engine/plan.ts';
import { adjustForDay, applyPins, isBadDay, suggest, warmup, WARMUP_WHY, type Suggestion } from '@/engine/progression.ts';
import { cooldown, isMissed } from '@/engine/session.ts';
import type { CheckIn, LoggedSet, PlannedExercise } from '@/engine/types.ts';
import {
  bestWeight, daysSince, history, isDeload, recentWorkouts, saveProgram, saveWorkout, toProfile, track, updateProfile, useData, type DraftSet,
} from '@/lib/data';
import { Button, C, Card, Choice, Loading, s, Screen, T } from '@/ui';
import { alert, attempt } from '@/lib/alert';
import { Why } from '@/why';
import { leave } from '@/lib/nav';

type Row = { weight: string; reps: string; rir: string; done: boolean };
type Item = {
  planned: PlannedExercise;
  exerciseId: string;
  history: LoggedSet[][];
  prevBest: number | null;
  suggestion: Suggestion;
  changed: boolean;
  sets: Row[];
};
type Draft = { userId: string; dayIndex: number; startedAt: string; checkin: CheckIn | null; items: Item[] };
type Summary = { sets: number; prs: string[]; next: { name: string; text: string }[]; cooldown: string[] };

const KEY = 'draft_workout';
const MISSED_KEY = 'missed_choice'; // last answer to the missed-session prompt
const loadDraft = (): Draft | null => { try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; } };
const PAIN_MSG = "Pain isn't something RepProof can assess. Stop the exercise and consider seeing a qualified professional.";
const REST = { compound: 150, isolation: 90 }; // seconds; PRD defaults
// Outside components: clock reads happen in event handlers and intervals, never during render.
const restUntil = (compound: boolean) => Date.now() + 1000 * (compound ? REST.compound : REST.isolation);
const clock = () => Date.now();

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
  const [summary, setSummary] = useState<Summary | null>(null);
  const [missed, setMissed] = useState(false);
  const [skip, setSkip] = useState(() => localStorage.getItem(MISSED_KEY) === 'skip');
  const [stretched, setStretched] = useState<string[]>([]);

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
      sets: Array.from({ length: sug.sets }, () => ({
        weight: sug.weight === null ? '' : String(sug.weight), reps: String(sug.reps), rir: String(planned.rirTarget), done: false,
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
    if (!it.sets[j].done) setRestEnd(restUntil(EXERCISE_BY_ID[it.exerciseId].compound));
  }

  const move = (i: number, by: -1 | 1) => setDraft((d) => {
    if (!d || i + by < 0 || i + by >= d.items.length) return d;
    const items = [...d.items];
    [items[i], items[i + by]] = [items[i + by], items[i]];
    return { ...d, items };
  });

  // Any lift, not just the plan's: 2 working sets, tracked and progressed like planned ones.
  async function addExercise(exerciseId: string) {
    setAdding(false);
    if (!draft || !profile) return;
    const [repMin, repMax] = repRange(profile.goal, EXERCISE_BY_ID[exerciseId].compound);
    const planned = { exerciseId, sets: 2, repMin, repMax, rirTarget: rirTarget(profile.experience) };
    const badDay = !!draft.checkin && isBadDay(draft.checkin);
    try {
      const item = await buildItem(planned, exerciseId, badDay);
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
            await saveProgram(toProfile({ ...profile!, avoid }, program!.plan.emphasis), program!.split, program!.next_day);
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
      next.push({ name, text: n.explanation.text });
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
    setBusy(false);
    const trained = d.items.filter((it) => it.sets.some((r) => r.done)).map((it) => EXERCISE_BY_ID[it.exerciseId].muscle);
    setSummary({ sets: sets.length, prs, next, cooldown: cooldown(trained) });
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
    return (
      <Screen>
        <T size="xl">Done</T>
        <Card>
          <T size="lg">{summary.sets} sets logged</T>
          {summary.prs.length ? <T bold style={{ color: C.accent }}>New best: {summary.prs.join(', ')}</T> : null}
        </Card>
        <T bold>What changes next time</T>
        {summary.next.map((n) => (
          <Card key={n.name}><T bold>{n.name}</T><T muted>{n.text}</T></Card>
        ))}
        {summary.cooldown.length ? (<>
          <T bold>Cooldown (optional)</T>
          {summary.cooldown.map((c) => {
            const on = stretched.includes(c);
            return (
              <Pressable key={c} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                onPress={() => setStretched(on ? stretched.filter((x) => x !== c) : [...stretched, c])}>
                <Card style={[s.row, on && { borderColor: C.accent }]}><T>{on ? '☑' : '☐'}</T><T style={{ flex: 1 }}>{c}</T></Card>
              </Pressable>
            );
          })}
        </>) : null}
        <Button kind="primary" title="Done" onPress={async () => { await refresh(); leave(); }} />
      </Screen>
    );
  }

  if (!draft) {
    const scale = (k: keyof CheckIn, title: string, low: string, high: string) => (
      <View style={{ gap: 8 }}>
        <T bold>{title}</T>
        <View style={s.row}>
          {[1, 2, 3, 4, 5].map((v) => (
            <Pressable key={v} accessibilityRole="button" accessibilityState={{ selected: checkin[k] === v }} onPress={() => setCheckin({ ...checkin, [k]: v })}
              style={{ flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1,
                borderColor: checkin[k] === v ? C.accent : C.border, backgroundColor: C.card }}>
              <T bold>{v}</T>
            </Pressable>
          ))}
        </View>
        <View style={[s.row, { justifyContent: 'space-between' }]}><T muted size="sm">{low}</T><T muted size="sm">{high}</T></View>
      </View>
    );
    return (
      <Screen>
        <T size="lg">{day.name}{deload ? ' · deload' : ''}</T>
        {missed ? (
          <Card>
            <T bold>You missed a session</T>
            <Choice value={skip ? 'skip' : 'now'} onChange={(v) => setSkip(v === 'skip')} options={[
              { value: 'now', label: `Do it now: ${program.plan.days[program.next_day].name}` },
              { value: 'skip', label: `Skip to today's session: ${program.plan.days[(program.next_day + 1) % nDays].name}` },
            ]} />
          </Card>
        ) : null}
        <T muted>Quick check-in. It takes ten seconds and adjusts today if you are run down.</T>
        {scale('sleep', 'Sleep last night', '1 terrible', '5 great')}
        {scale('soreness', 'Soreness', '1 very sore', '5 not sore')}
        {scale('energy', 'Energy', '1 drained', '5 great')}
        <View style={{ flex: 1 }} />
        <Button kind="primary" title="Start" loading={busy} onPress={() => start(checkin)} />
        <Button kind="ghost" title="Skip check-in" disabled={busy} onPress={() => start(null)} />
        <Button kind="ghost" title="Back" onPress={() => leave()} />
      </Screen>
    );
  }


  return (
    <Screen>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <T size="lg">{day.name}</T>
        <Button kind="ghost" title="Discard" onPress={quit} />
      </View>
      {restEnd ? <RestTimer end={restEnd} onDone={() => setRestEnd(null)} /> : null}

      {draft.items.map((it, i) => {
        const ex = EXERCISE_BY_ID[it.exerciseId];
        const w = it.suggestion.weight;
        return (
          <Card key={`${i}-${it.exerciseId}`}>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <T size="lg" style={{ flex: 1 }}>{ex.name}</T>
              <Pressable accessibilityRole="button" accessibilityLabel="Move up" hitSlop={8} disabled={i === 0} onPress={() => move(i, -1)}>
                <T muted size="lg" style={{ opacity: i === 0 ? 0.3 : 1 }}>↑</T>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Move down" hitSlop={8} disabled={i === draft.items.length - 1} onPress={() => move(i, 1)}>
                <T muted size="lg" style={{ opacity: i === draft.items.length - 1 ? 0.3 : 1 }}>↓</T>
              </Pressable>
              <Why e={it.suggestion.explanation} changed={it.changed} />
            </View>
            <T muted>
              {w === null ? 'Calibrate: pick your starting weight' : `${w} ${unit}`} · {it.planned.pinnedReps !== undefined ? `${it.planned.pinnedReps} reps (pinned)` : `${it.suggestion.reps}–${it.planned.repMax} reps`} · {it.planned.rirTarget === 0 ? 'to failure' : `${it.planned.rirTarget} rep short of failure`}
            </T>
            <View style={s.row}>
              <T muted size="sm" style={{ flex: 1 }}>
                {w === null ? 'Warm-up: 1 light set of 5 before your first working set' : `Warm-up: 1 × ${warmup(w, unit, ex.equipment.includes('barbell')).reps} at ${warmup(w, unit, ex.equipment.includes('barbell')).weight} ${unit}`}
              </T>
              <Why e={WARMUP_WHY} />
            </View>
            {ex.cues.map((c) => <T key={c} muted size="sm">• {c}</T>)}

            <View style={[s.row, { marginTop: 4 }]}>
              <T muted size="sm" style={{ width: 28 }}>Set</T>
              <T muted size="sm" style={{ flex: 1 }}>{unit}</T>
              <T muted size="sm" style={{ flex: 1 }}>Reps</T>
              <T muted size="sm" style={{ flex: 1 }}>RIR</T>
              <View style={{ width: 52 }} />
            </View>
            {it.sets.map((r, j) => (
              <View key={j} style={s.row}>
                <T bold style={{ width: 28 }}>{j + 1}</T>
                {(['weight', 'reps', 'rir'] as const).map((f) => (
                  <TextInput key={f} value={r[f]} editable={!r.done} keyboardType={f === 'weight' ? 'decimal-pad' : 'number-pad'}
                    placeholder={f === 'weight' ? '?' : ''} placeholderTextColor={C.muted} selectTextOnFocus
                    onChangeText={(v) => update(i, (x) => ({ ...x, sets: x.sets.map((y, k) => (k === j ? { ...y, [f]: v } : y)) }))}
                    style={{ flex: 1, height: 48, borderRadius: 10, borderWidth: 1, borderColor: C.border, color: r.done ? C.muted : C.text, fontSize: 18, textAlign: 'center' }} />
                ))}
                <Pressable accessibilityRole="button" accessibilityLabel={r.done ? 'Undo set' : 'Log set'} disabled={!r.done && (!r.weight || !r.reps)}
                  onPress={() => logSet(i, j)}
                  style={{ width: 52, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: r.done ? C.accent : C.card, borderWidth: 1, borderColor: r.done ? C.accent : C.border, opacity: !r.done && (!r.weight || !r.reps) ? 0.4 : 1 }}>
                  <T bold style={{ color: r.done ? C.onAccent : C.text }}>{r.done ? '✓' : 'Log'}</T>
                </Pressable>
              </View>
            ))}
            <View style={s.row}>
              <Button title="Swap" style={{ flex: 1 }} onPress={() => setSwapFor(i)} />
              <Button title="Pain" kind="danger" style={{ flex: 1 }} onPress={() => pain(i)} />
            </View>
          </Card>
        );
      })}

      <Button title="Add an exercise" onPress={() => setAdding(true)} />
      <Button kind="primary" title="Finish workout" loading={busy} onPress={confirmFinish} />

      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#000a' }} onPress={() => setAdding(false)} />
        {adding ? (
          <Card style={{ borderRadius: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, maxHeight: '75%' }}>
            <T size="lg">Add an exercise</T>
            <T muted size="sm">Logged and tracked like the rest of your plan.</T>
            <ScrollView>
              {MUSCLES.map((m) => {
                const options = available(profile.setup, profile.avoid).filter((e) => e.muscle === m && !draft.items.some((it) => it.exerciseId === e.id));
                if (!options.length) return null;
                return (
                  <View key={m} style={{ gap: 6, marginBottom: 10 }}>
                    <T bold>{MUSCLE_NAMES[m]}</T>
                    {options.map((e) => <Button key={e.id} title={e.name} onPress={() => addExercise(e.id)} />)}
                  </View>
                );
              })}
            </ScrollView>
            <Button kind="ghost" title="Cancel" onPress={() => setAdding(false)} />
          </Card>
        ) : null}
      </Modal>

      <Modal visible={swapFor !== null} transparent animationType="slide" onRequestClose={() => setSwapFor(null)}>
        <Pressable style={{ flex: 1, backgroundColor: '#000a' }} onPress={() => setSwapFor(null)} />
        {swapFor !== null ? (
          <Card style={{ borderRadius: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 }}>
            <T size="lg">Swap for</T>
            {substitutes(draft.items[swapFor].exerciseId, profile.setup, profile.avoid).map((e) => (
              <Button key={e.id} title={e.name} onPress={() => swap(swapFor, e.id)} />
            ))}
            {!substitutes(draft.items[swapFor].exerciseId, profile.setup, profile.avoid).length ? <T muted>No alternatives with your equipment.</T> : null}
            <Button kind="ghost" title="Cancel" onPress={() => setSwapFor(null)} />
          </Card>
        ) : null}
      </Modal>
    </Screen>
  );
}

function RestTimer({ end, onDone }: { end: number; onDone: () => void }) {
  const [now, setNow] = useState(clock);
  useEffect(() => {
    const t = setInterval(() => setNow(clock()), 500);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.ceil((end - now) / 1000));
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Dismiss rest timer" onPress={onDone}>
      <Card style={{ borderColor: left ? C.border : C.accent, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T bold style={{ flex: 1 }}>{left ? 'Rest' : 'Rest done. Next set'}</T>
        <T size="lg">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</T>
        <View style={{ marginLeft: 12 }}><Why e={REST_WHY} /></View>
      </Card>
    </Pressable>
  );
}
