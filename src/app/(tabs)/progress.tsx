import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { EXERCISE_BY_ID } from '@/engine/exercises.ts';
import { MUSCLES } from '@/engine/plan.ts';
import type { Muscle } from '@/engine/types.ts';
import { bodyweightHistory, localDate, logBodyweight, must, ok, startOfWeek, track, useData, type WeighIn } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { attempt } from '@/lib/alert';
import { Button, C, Card, Choice, Field, s, Screen, T } from '@/ui';

type Workout = { id: string; day_name: string; finished_at: string; logged_sets: { count: number }[] };
type SetRow = { exercise_id: string; weight: number; workout_id: string; created_at: string };
type Cardio = { id: string; kind: string; minutes: number; intensity: string; logged_on: string };

const CARDIO_KINDS = ['Walk', 'Run', 'Bike', 'Row', 'Other'];

export default function Progress() {
  const { profile, refresh } = useData();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [sets, setSets] = useState<SetRow[]>([]);
  const [lift, setLift] = useState<string | null>(null);
  const [cardio, setCardio] = useState<Cardio[]>([]);
  const [kind, setKind] = useState('Walk');
  const [minutes, setMinutes] = useState('');
  const [intensity, setIntensity] = useState<'easy' | 'moderate' | 'hard'>('moderate');
  const [weighIns, setWeighIns] = useState<WeighIn[] | null>(null); // null = not available (e.g. migration 3 not applied)
  const [weight, setWeight] = useState('');

  const load = useCallback(async () => {
    const w = must(await supabase.from('workouts').select('id, day_name, finished_at, logged_sets(count)')
      .not('finished_at', 'is', null).order('finished_at', { ascending: false }).limit(30));
    setWorkouts(w as Workout[]);
    // ponytail: client-side stats over the last 2000 sets; move to SQL views if logs grow past that
    const x = must(await supabase.from('logged_sets').select('exercise_id, weight, workout_id, created_at').order('created_at', { ascending: false }).limit(2000));
    setSets(x.map((r) => ({ ...r, weight: Number(r.weight) })) as SetRow[]);
    const c = must(await supabase.from('cardio_logs').select('id, kind, minutes, intensity, logged_on').order('created_at', { ascending: false }).limit(10));
    setCardio(c as Cardio[]);
    // Separate so a missing bodyweight table never blocks the rest of the screen.
    bodyweightHistory().then(setWeighIns).catch(() => setWeighIns(null));
  }, []);

  const reload = useCallback(() => {
    setLoadFailed(false);
    load().catch(() => setLoadFailed(true));
  }, [load]);
  useFocusEffect(reload);

  async function addWeight() {
    if (!profile) return;
    const id = profile.id;
    const value = Number(weight);
    if (!(await attempt(() => logBodyweight(id, value), 'log your bodyweight'))) return;
    track('bodyweight_logged');
    setWeight('');
    await Promise.all([load(), refresh()]); // profile bodyweight drives nutrition targets
  }

  async function addCardio() {
    const saved = await attempt(async () => {
      ok(await supabase.from('cardio_logs').insert({ kind, minutes: Number(minutes), intensity, logged_on: localDate() }));
    }, 'log your cardio');
    if (!saved) return;
    track('cardio_logged', { kind, intensity });
    setMinutes('');
    await load();
  }

  const name = (id: string) => EXERCISE_BY_ID[id]?.name ?? id;
  const best: Record<string, number> = {};
  for (const x of sets) best[x.exercise_id] = Math.max(best[x.exercise_id] ?? 0, x.weight);
  const lifts = Object.keys(best).sort((a, b) => name(a).localeCompare(name(b)));
  const shown = lift ?? lifts[0] ?? null;

  // Top weight per session for the chosen lift, oldest first, last 12 sessions.
  const trend: { at: string; w: number }[] = [];
  if (shown) {
    const bySession = new Map<string, { at: string; w: number }>();
    for (const x of sets.filter((r) => r.exercise_id === shown)) {
      const cur = bySession.get(x.workout_id);
      if (!cur || x.weight > cur.w) bySession.set(x.workout_id, { at: x.created_at, w: x.weight });
    }
    trend.push(...[...bySession.values()].sort((a, b) => a.at.localeCompare(b.at)).slice(-12));
  }

  const week = startOfWeek();
  const weekSets: Partial<Record<Muscle, number>> = {};
  for (const x of sets) {
    if (x.created_at < week) continue;
    const m = EXERCISE_BY_ID[x.exercise_id]?.muscle;
    if (m) weekSets[m] = (weekSets[m] ?? 0) + 1;
  }

  return (
    <Screen edges={['top']}>
      <T size="xl">Progress</T>
      {loadFailed ? (
        <Card>
          <T>Could not load your progress.</T>
          <Button title="Try again" onPress={reload} />
        </Card>
      ) : workouts === null ? <ActivityIndicator color={C.accent} /> : null}
      {workouts && !workouts.length ? <T muted>Finish your first workout to see it here.</T> : null}

      {shown ? (
        <Card>
          <T bold>Strength trend</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {lifts.map((id) => (
              <Pressable key={id} onPress={() => setLift(id)} accessibilityRole="button" accessibilityState={{ selected: id === shown }}
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: id === shown ? C.accent : C.border }}>
                <T size="sm">{name(id)}</T>
              </Pressable>
            ))}
          </ScrollView>
          <T muted size="sm">Top weight per session ({profile?.unit}), last {trend.length}</T>
          <BarTrend values={trend.map((p) => p.w)} label={`${name(shown)} top weights`} />
        </Card>
      ) : null}

      <Card>
        <T bold>Bodyweight ({profile?.unit})</T>
        {weighIns === null ? <T muted size="sm">Bodyweight tracking needs the latest database update (see README, migration 3).</T> : null}
        {weighIns?.length ? (<>
          <T muted size="sm">Last {Math.min(12, weighIns.length)} weigh-ins · latest {weighIns[weighIns.length - 1].weight} on {weighIns[weighIns.length - 1].logged_on}</T>
          <BarTrend values={weighIns.slice(-12).map((x) => x.weight)} label="Bodyweight" />
        </>) : null}
        <View style={s.row}>
          <View style={{ flex: 1 }}><Field placeholder={`Today, e.g. ${profile?.bodyweight ?? 75}`} keyboardType="decimal-pad" value={weight} onChangeText={setWeight} /></View>
          <Button kind="primary" title="Log" disabled={!(Number(weight) > 20 && Number(weight) <= 700)} onPress={addWeight} />
        </View>
        <T muted size="sm">Updates your nutrition targets. Weigh at the same time of day; the trend matters more than any single day.</T>
      </Card>

      {Object.keys(weekSets).length ? (
        <Card>
          <T bold>Sets per muscle this week</T>
          {MUSCLES.filter((m) => weekSets[m]).map((m) => (
            <View key={m} style={[s.row, { justifyContent: 'space-between' }]}>
              <T muted>{m[0].toUpperCase() + m.slice(1)}</T><T bold>{weekSets[m]}</T>
            </View>
          ))}
        </Card>
      ) : null}

      {lifts.length ? (
        <Card>
          <T bold>Best weights</T>
          {lifts.map((id) => (
            <View key={id} style={[s.row, { justifyContent: 'space-between' }]}>
              <T muted style={{ flex: 1 }}>{name(id)}</T>
              <T bold>{best[id]} {profile?.unit}</T>
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <T bold>Log cardio</T>
        <View style={[s.row, { flexWrap: 'wrap' }]}>
          {CARDIO_KINDS.map((k) => <Button key={k} title={k} kind={kind === k ? 'primary' : 'secondary'} onPress={() => setKind(k)} />)}
        </View>
        <Field label="Minutes" keyboardType="number-pad" value={minutes} onChangeText={setMinutes} />
        <Choice value={intensity} onChange={setIntensity} options={[
          { value: 'easy', label: 'Easy' }, { value: 'moderate', label: 'Moderate' }, { value: 'hard', label: 'Hard' },
        ]} />
        <Button kind="primary" title="Log cardio" disabled={!(Number(minutes) >= 1)} onPress={addCardio} />
        {cardio.map((c) => (
          <View key={c.id} style={[s.row, { justifyContent: 'space-between' }]}>
            <T muted>{c.logged_on} · {c.kind}</T><T>{c.minutes} min, {c.intensity}</T>
          </View>
        ))}
      </Card>

      {workouts?.length ? <T size="lg">History</T> : null}
      {workouts?.map((w) => (
        <Card key={w.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <T bold>{w.day_name}</T>
            <T muted size="sm">{new Date(w.finished_at).toLocaleDateString()}</T>
          </View>
          <T muted>{w.logged_sets[0]?.count ?? 0} sets</T>
        </Card>
      ))}
    </Screen>
  );
}

/** Bars scaled between 25% and 100% so small changes stay visible; labels carry the real numbers. Latest bar highlighted. */
function BarTrend({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 4 }} accessibilityLabel={`${label}: ${values.join(', ')}`}>
      {values.map((v, i) => {
        const h = max === min ? 100 : 25 + (75 * (v - min)) / (max - min);
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <T size="sm" muted>{v}</T>
            <View style={{ width: '100%', height: (110 * h) / 100, backgroundColor: i === values.length - 1 ? C.accent : C.border, borderRadius: 4 }} />
          </View>
        );
      })}
    </View>
  );
}
