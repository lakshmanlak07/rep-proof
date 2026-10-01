import 'expo-sqlite/localStorage/install';

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, TextInput, View } from 'react-native';

import { EXERCISE_BY_ID, substitutes } from '@/engine/exercises.ts';
import { adjustForDay, isBadDay, suggest, warmup, type Suggestion } from '@/engine/progression.ts';
import type { CheckIn, LoggedSet, PlannedExercise } from '@/engine/types.ts';
import {
  bestWeight, history, isDeload, saveProgram, saveWorkout, toProfile, track, updateProfile, useData, type DraftSet,
} from '@/lib/data';
import { Button, C, Card, Loading, s, Screen, T } from '@/ui';
import { Why } from '@/why';

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
type Draft = { dayIndex: number; startedAt: string; checkin: CheckIn | null; items: Item[] };
type Summary = { sets: number; prs: string[]; next: { name: string; text: string }[] };

const KEY = 'draft_workout';
const loadDraft = (): Draft | null => { try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; } };
const PAIN_MSG = "Pain isn't something RepProof can assess. Stop the exercise and consider seeing a qualified professional.";
const REST = { compound: 150, isolation: 90 }; // seconds; PRD defaults

export default function Workout() {
  const { profile, program, refresh } = useData();
  const [draft, setDraft] = useState<Draft | null>(loadDraft);
  const [checkin, setCheckin] = useState<CheckIn>({ sleep: 3, soreness: 3, energy: 3 });
  const [busy, setBusy] = useState(false);
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [swapFor, setSwapFor] = useState<number | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (draft) localStorage.setItem(KEY, JSON.stringify(draft));
  }, [draft]);

  if (!profile || !program) return <Loading />;
  const unit = profile.unit;
  const deload = isDeload(profile.deload_until);
  const dayIndex = draft?.dayIndex ?? program.next_day;
  const day = program.plan.days[dayIndex] ?? program.plan.days[0];

  async function buildItem(planned: PlannedExercise, exerciseId: string, badDay: boolean): Promise<Item> {
    const [h, prevBest] = await Promise.all([history(exerciseId), bestWeight(exerciseId)]);
    const lastWeight = h[0]?.length ? Math.max(...h[0].map((x) => x.weight)) : null;
    const raw = suggest({ ...planned, exerciseId }, h, profile!.experience, unit);
    const sug = adjustForDay(raw, lastWeight, { badDay, deload });
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
    try {
      const items = await Promise.all(day.exercises.map((p) => buildItem(p, p.exerciseId, badDay)));
      setDraft({ dayIndex, startedAt: new Date().toISOString(), checkin: c, items });
    } catch {
      Alert.alert('Could not load your history', 'Check your connection and try again.');
    }
    setBusy(false);
  }

  const update = (i: number, fn: (it: Item) => Item) => setDraft((d) => d && { ...d, items: d.items.map((it, k) => (k === i ? fn(it) : it)) });

  function logSet(i: number, j: number) {
    const it = draft!.items[i];
    update(i, (x) => ({
      ...x,
      sets: x.sets.map((r, k) => {
        if (k === j) return { ...r, done: !r.done };
        // calibration: first logged weight fills the remaining empty sets
        if (k > j && !r.done && r.weight === '' && x.sets[j].weight) return { ...r, weight: x.sets[j].weight };
        return r;
      }),
    }));
    if (!it.sets[j].done) setRestEnd(Date.now() + 1000 * (EXERCISE_BY_ID[it.exerciseId].compound ? REST.compound : REST.isolation));
  }

  async function swap(i: number, exerciseId: string) {
    setSwapFor(null);
    const it = draft!.items[i];
    track('swap', { from: it.exerciseId, to: exerciseId });
    const badDay = !!draft!.checkin && isBadDay(draft!.checkin);
    const next = await buildItem(it.planned, exerciseId, badDay);
    update(i, () => next);
  }

  function pain(i: number) {
    const ex = EXERCISE_BY_ID[draft!.items[i].exerciseId];
    track('pain', { exercise: ex.id });
    Alert.alert('Stop this exercise', PAIN_MSG, [
      { text: 'Swap it', onPress: () => setSwapFor(i) },
      {
        text: 'Avoid this movement', onPress: async () => {
          const avoid = [...new Set([...profile!.avoid, ex.pattern])];
          await updateProfile(profile!.id, { avoid });
          await saveProgram(toProfile({ ...profile!, avoid }), program!.split, program!.next_day);
          setDraft((d) => d && { ...d, items: d.items.filter((_, k) => k !== i) });
          await refresh(); // new active program; finish() updates its next_day
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function finish() {
    const d = draft!;
    const sets: DraftSet[] = d.items.flatMap((it) => it.sets.filter((r) => r.done).map((r, k) => {
      const weight = Number(r.weight) || 0;
      const reps = Number(r.reps) || 0;
      return {
        exerciseId: it.exerciseId, setIndex: k, weight, reps, rir: r.rir === '' ? null : Number(r.rir),
        overridden: weight !== it.suggestion.weight || reps !== it.suggestion.reps,
      };
    }));
    setBusy(true);
    try {
      await saveWorkout({
        programId: program!.id, dayIndex: d.dayIndex, dayName: day.name, checkin: d.checkin, startedAt: d.startedAt,
        sets, daysInPlan: program!.plan.days.length,
      });
    } catch {
      setBusy(false);
      return Alert.alert('Not saved yet', 'Your workout is kept on this phone. Check your connection and tap Finish again.');
    }
    const prs: string[] = [];
    const next: Summary['next'] = [];
    for (const it of d.items) {
      const done = sets.filter((x) => x.exerciseId === it.exerciseId);
      if (!done.length) continue;
      const name = EXERCISE_BY_ID[it.exerciseId].name;
      const top = Math.max(...done.map((x) => x.weight));
      if (it.prevBest !== null && top > it.prevBest) prs.push(`${name}: ${top} ${unit}`);
      const n = suggest(it.planned, [done, ...it.history], profile!.experience, unit);
      next.push({ name, text: n.explanation.text });
    }
    localStorage.removeItem(KEY);
    setBusy(false);
    setSummary({ sets: sets.length, prs, next });
  }

  function confirmFinish() {
    const left = draft!.items.reduce((a, it) => a + it.sets.filter((r) => !r.done).length, 0);
    if (!left) return finish();
    Alert.alert('Finish workout?', `${left} set${left > 1 ? 's' : ''} not logged. Unlogged sets are not saved.`, [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Finish', onPress: finish },
    ]);
  }

  function quit() {
    Alert.alert('Discard this workout?', 'Nothing from this session will be saved.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { localStorage.removeItem(KEY); router.back(); } },
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
        <Button kind="primary" title="Done" onPress={async () => { await refresh(); router.back(); }} />
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
        <T muted>Quick check-in. It takes ten seconds and adjusts today if you are run down.</T>
        {scale('sleep', 'Sleep last night', '1 terrible', '5 great')}
        {scale('soreness', 'Soreness', '1 very sore', '5 not sore')}
        {scale('energy', 'Energy', '1 drained', '5 great')}
        <View style={{ flex: 1 }} />
        <Button kind="primary" title="Start" loading={busy} onPress={() => start(checkin)} />
        <Button kind="ghost" title="Skip check-in" disabled={busy} onPress={() => start(null)} />
        <Button kind="ghost" title="Back" onPress={() => router.back()} />
      </Screen>
    );
  }

  const firstCompound = draft.items.findIndex((it) => EXERCISE_BY_ID[it.exerciseId].compound);

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
              <Why e={it.suggestion.explanation} changed={it.changed} />
            </View>
            <T muted>
              {w === null ? 'Calibrate: pick your starting weight' : `${w} ${unit}`} · {it.suggestion.reps}–{it.planned.repMax} reps · {it.planned.rirTarget} in reserve
            </T>
            {i === firstCompound && w !== null && ex.equipment.includes('barbell') ? (
              <T muted size="sm">Warm-up: {warmup(w, unit).map((x) => `${x.weight}×${x.reps}`).join(' · ')}</T>
            ) : null}
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

      <Button kind="primary" title="Finish workout" loading={busy} onPress={confirmFinish} />

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
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.ceil((end - now) / 1000));
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Dismiss rest timer" onPress={onDone}>
      <Card style={{ borderColor: left ? C.border : C.accent, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T bold>{left ? 'Rest' : 'Rest done. Next set'}</T>
        <T size="lg">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</T>
      </Card>
    </Pressable>
  );
}
