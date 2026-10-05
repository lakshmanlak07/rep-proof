import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { router, useFocusEffect } from 'expo-router';
import { EXERCISE_BY_ID } from '@/engine/exercises.ts';
import { MUSCLES } from '@/engine/plan.ts';
import type { Muscle } from '@/engine/types.ts';
import { bodyweightHistory, localDate, logBodyweight, must, ok, track, useData, type WeighIn } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { attempt } from '@/lib/alert';
import { Button, C, Card, Chip, Choice, Field, Header, IconTile, LineChart, Pill, Screen, Section, Segmented, Stat, s, T } from '@/ui';
import { newBests } from '@/lib/stats';
import { MUSCLE_LABEL, pct } from '@/lib/insights';

type Workout = { id: string; day_name: string; finished_at: string; logged_sets: { count: number }[] };
type SetRow = { exercise_id: string; weight: number; reps: number; workout_id: string; created_at: string };
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
  const [now] = useState(() => Date.now());
  const [view, setView] = useState<'strength' | 'hypertrophy' | 'volume' | 'bodyweight'>('strength');
  const [range, setRange] = useState<'7D' | '30D' | '90D' | '1Y'>('90D');
  const [muscle, setMuscle] = useState<Muscle>('chest');

  const load = useCallback(async () => {
    const w = must(await supabase.from('workouts').select('id, day_name, finished_at, logged_sets(count)')
      .not('finished_at', 'is', null).order('finished_at', { ascending: false }).limit(30));
    setWorkouts(w as Workout[]);
    // ponytail: client-side stats over the last 2000 sets; move to SQL views if logs grow past that
    const x = must(await supabase.from('logged_sets').select('exercise_id, weight, reps, workout_id, created_at').order('created_at', { ascending: false }).limit(2000));
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
  const days = { '7D': 7, '30D': 30, '90D': 90, '1Y': 365 }[range];
  const cutoff = now - days * 864e5;
  const inRange = (iso: string) => new Date(iso).getTime() >= cutoff;
  const unit = profile?.unit ?? 'kg';

  const best: Record<string, number> = {};
  for (const x of sets) best[x.exercise_id] = Math.max(best[x.exercise_id] ?? 0, x.weight);
  const sessionCount: Record<string, Set<string>> = {};
  for (const x of sets) (sessionCount[x.exercise_id] ??= new Set()).add(x.workout_id);
  const lifts = Object.keys(best).sort((a, b) => sessionCount[b].size - sessionCount[a].size);
  const shown = lift ?? lifts[0] ?? null;

  /** Top weight per session for a lift, oldest first, inside the range. */
  const topWeights = (id: string) => {
    const by = new Map<string, { at: string; w: number }>();
    for (const x of sets.filter((r) => r.exercise_id === id && inRange(r.created_at))) {
      const cur = by.get(x.workout_id);
      if (!cur || x.weight > cur.w) by.set(x.workout_id, { at: x.created_at, w: x.weight });
    }
    return [...by.values()].sort((a, b) => a.at.localeCompare(b.at)).map((p) => p.w);
  };
  const trend = shown ? topWeights(shown) : [];

  // Weekly series per muscle: hard sets and volume load (weight x reps), keyed by week start.
  const weekKey = (iso: string) => { const d = new Date(iso); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
  const weekly = (m: Muscle | null, f: (x: SetRow) => number) => {
    const w = new Map<number, number>();
    for (const x of sets) {
      if (!inRange(x.created_at) || (m && EXERCISE_BY_ID[x.exercise_id]?.muscle !== m)) continue;
      w.set(weekKey(x.created_at), (w.get(weekKey(x.created_at)) ?? 0) + f(x));
    }
    return [...w.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => Math.round(v));
  };
  const muscleSets = (m: Muscle) => weekly(m, () => 1);
  const totalSets = weekly(null, () => 1);

  const bests = newBests(sets.map((x) => ({ ...x })), 90);
  const first = (a: number[]) => a[0] ?? 0;
  const lastOf = (a: number[]) => a[a.length - 1] ?? 0;
  const topTwo = lifts.slice(0, 2);

  const rangeBar = <Segmented value={range} onChange={setRange} options={(['7D', '30D', '90D', '1Y'] as const).map((v) => ({ value: v, label: v }))} />;
  const delta = (a: number, b: number) => { const p = pct(a, b); return `${p >= 0 ? '+' : ''}${p}%`; };

  return (
    <Screen edges={['top']}>
      <Header kicker="Evidence of your work" title="Your progress" />
      {loadFailed ? (
        <Card>
          <T>Could not load your progress.</T>
          <Button title="Try again" onPress={reload} />
        </Card>
      ) : workouts === null ? <ActivityIndicator color={C.accent} /> : null}
      {workouts && !workouts.length ? <T muted>Finish your first workout to see it here.</T> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {([['strength', 'Strength'], ['hypertrophy', 'Hypertrophy'], ['volume', 'Volume'], ['bodyweight', 'Bodyweight']] as const).map(([v, l]) => (
          <Pill key={v} label={l} on={view === v} onPress={() => setView(v)} />
        ))}
      </ScrollView>

      {view === 'strength' && lifts.length ? (<>
        <View style={[s.row, { alignItems: 'stretch', flexWrap: 'wrap' }]}>
          {topTwo.map((id) => {
            const w = topWeights(id);
            return (
              <Card key={id} onPress={() => setLift(id)} style={{ flexBasis: '47%', flexGrow: 1 }}>
                <T size="micro" numberOfLines={1}>{name(id)}</T>
                <T size="lg">{first(w)} → {lastOf(w)} <T muted size="sm">{unit}</T></T>
                {w.length > 1 ? <T size="sm" bold color={lastOf(w) >= first(w) ? C.pos : C.warn}>{delta(first(w), lastOf(w))}</T> : <T muted size="sm">One session</T>}
              </Card>
            );
          })}
        </View>
        <Card>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {lifts.map((id) => <Pill key={id} label={name(id)} on={id === shown} onPress={() => setLift(id)} />)}
          </ScrollView>
          {rangeBar}
          {shown ? <Stat label={`${name(shown)} · top weight`} value={lastOf(trend) || best[shown]} unit={unit} delta={trend.length > 1 ? `${delta(first(trend), lastOf(trend))} in ${range}` : undefined} tone={lastOf(trend) >= first(trend) ? 'pos' : 'warn'} /> : null}
          <LineChart values={trend} label={`${shown ? name(shown) : ''} top weights`} />
        </Card>
      </>) : null}

      {view === 'hypertrophy' ? (
        <Card>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {MUSCLES.map((m) => <Pill key={m} label={MUSCLE_LABEL[m]} on={m === muscle} onPress={() => setMuscle(m)} />)}
          </ScrollView>
          {rangeBar}
          {(() => {
            const load = weekly(muscle, (x) => x.weight * x.reps);
            return (<>
              <Stat label={`${MUSCLE_LABEL[muscle]} · weekly volume load`} value={lastOf(load).toLocaleString()} unit={`${unit} lifted`} delta={load.length > 1 ? `${delta(first(load), lastOf(load))} in ${range}` : undefined} tone={lastOf(load) >= first(load) ? 'pos' : 'warn'} />
              <LineChart values={load} label="Weekly volume load" />
              <T muted size="sm">Volume load (weight × reps) is a rough proxy for stimulus. It tells you what you did, not what grew.</T>
            </>);
          })()}
        </Card>
      ) : null}

      {view === 'volume' ? (<>
        {rangeBar}
        <Card>
          <Stat label="Total hard sets per week" value={lastOf(totalSets)} unit="sets" delta={totalSets.length > 1 ? `${first(totalSets)} → ${lastOf(totalSets)} sets/week` : undefined} tone="neutral" />
          <LineChart values={totalSets} label="Weekly sets" />
        </Card>
        <View style={[s.row, { alignItems: 'stretch', flexWrap: 'wrap' }]}>
          {MUSCLES.filter((m) => muscleSets(m).length).map((m) => {
            const v = muscleSets(m);
            return (
              <Card key={m} style={{ flexBasis: '47%', flexGrow: 1, gap: 4 }}>
                <T size="micro">{MUSCLE_LABEL[m]} volume</T>
                <T size="lg">{first(v)} → {lastOf(v)} <T muted size="sm">sets/wk</T></T>
              </Card>
            );
          })}
        </View>
        <Button title="Weekly volume and productive ranges" icon="layers" onPress={() => router.push('/volume')} />
      </>) : null}

      {view === 'bodyweight' ? (
        <Card>
          {weighIns === null ? <T muted size="sm">Bodyweight tracking needs the latest database update (see README, migration 3).</T> : null}
          {weighIns?.length ? (<>
            <Stat label="Bodyweight" value={weighIns[weighIns.length - 1].weight} unit={unit} delta={weighIns.length > 1 ? `${(weighIns[weighIns.length - 1].weight - weighIns[0].weight).toFixed(1)} ${unit} since ${weighIns[0].logged_on}` : undefined} tone="neutral" />
            <LineChart values={weighIns.slice(-30).map((x) => x.weight)} label="Bodyweight" />
          </>) : null}
          <View style={s.row}>
            <View style={{ flex: 1 }}><Field placeholder={`Today, e.g. ${profile?.bodyweight ?? 75}`} keyboardType="decimal-pad" value={weight} onChangeText={setWeight} /></View>
            <Button kind="primary" title="Log" disabled={!(Number(weight) > 20 && Number(weight) <= 700)} onPress={addWeight} />
          </View>
          <T muted size="sm">Updates your nutrition targets. Weigh at the same time of day; the trend matters more than any single day.</T>
        </Card>
      ) : null}

      {bests.length ? (
        <Section title="Personal records">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {bests.slice(0, 8).map((b) => (
              <Card key={`${b.exerciseId}-${b.at}`} style={{ width: 200, gap: 6 }}>
                <IconTile name="trophy" tone="warn" size={34} />
                <T size="micro" numberOfLines={1}>{name(b.exerciseId)}</T>
                <T size="xl">{b.weight} <T muted size="sm">{unit}</T></T>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <Chip tone="pos" icon="arrow-up" label={`+${Math.round((b.weight - b.previous) * 10) / 10}`} />
                  <T muted size="sm">{new Date(b.at).toLocaleDateString()}</T>
                </View>
              </Card>
            ))}
          </ScrollView>
        </Section>
      ) : null}

      {lifts.length ? (
        <Section title="Best weights">
          <Card>
            {lifts.map((id) => (
              <View key={id} style={[s.row, { justifyContent: 'space-between' }]}>
                <T muted style={{ flex: 1 }}>{name(id)}</T>
                <T bold>{best[id]} {unit}</T>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      <Section title="Cardio">
        <Card>
          <View style={[s.row, { flexWrap: 'wrap' }]}>
            {CARDIO_KINDS.map((k) => <Pill key={k} label={k} on={kind === k} onPress={() => setKind(k)} />)}
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
      </Section>

      {workouts?.length ? (
        <Section title="History">
          {workouts.map((w) => (
            <Card key={w.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <T bold>{w.day_name}</T>
                <T muted size="sm">{new Date(w.finished_at).toLocaleDateString()}</T>
              </View>
              <T muted>{w.logged_sets[0]?.count ?? 0} sets</T>
            </Card>
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}
