import { useCallback, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { router, useFocusEffect } from 'expo-router';
import { EXERCISE_BY_ID } from '@/engine/exercises.ts';
import { MUSCLES } from '@/engine/plan.ts';
import type { Muscle } from '@/engine/types.ts';
import { bodyweightHistory, localDate, logBodyweight, must, ok, track, useData, type WeighIn } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { attempt } from '@/lib/alert';
import { Button, C, Card, Chip, Choice, Empty, Field, Header, IconTile, LineChart, Pill, Screen, Section, Segmented, Stat, s, T } from '@/ui';
import { adherence, newBests, shortDate, weekStart, weeklyTrend } from '@/lib/stats';
import { Why } from '@/why';
import { once, toNumber } from '@/lib/workoutSave';
import { MUSCLE_LABEL, pct } from '@/lib/insights';

type Workout = { id: string; day_name: string; finished_at: string; logged_sets: { count: number }[] };
type SetRow = { exercise_id: string; weight: number; reps: number; rir: number | null; workout_id: string; created_at: string };
const SET_LIMIT = 1000; // Supabase's default API row cap (max_rows); more is silently cut to this
type Cardio = { id: string; kind: string; minutes: number; intensity: string; logged_on: string };

const CARDIO_KINDS = ['Walk', 'Run', 'Bike', 'Row', 'Other'];

export default function Progress() {
  const { profile, program, refresh } = useData();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [sets, setSets] = useState<SetRow[]>([]);
  const [lift, setLift] = useState<string | null>(null);
  const [cardio, setCardio] = useState<Cardio[]>([]);
  const [kind, setKind] = useState('Walk');
  const [minutes, setMinutes] = useState('');
  const [intensity, setIntensity] = useState<'easy' | 'moderate' | 'hard'>('moderate');
  const [weighIns, setWeighIns] = useState<WeighIn[] | null | undefined>(undefined); // undefined = loading, null = failed
  const [weight, setWeight] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [view, setView] = useState<'strength' | 'hypertrophy' | 'volume' | 'bodyweight'>('strength');
  const [range, setRange] = useState<'7D' | '30D' | '90D' | '1Y'>('90D');
  const [muscle, setMuscle] = useState<Muscle>('chest');
  const [trendMuscle, setTrendMuscle] = useState<Muscle | null>(null); // null = all muscles

  const load = useCallback(async () => {
    // Independent of the rest: a bodyweight failure never blocks the charts, and a charts failure never hides bodyweight.
    bodyweightHistory().then(setWeighIns).catch(() => setWeighIns(null));
    const w = must(await supabase.from('workouts').select('id, day_name, finished_at, logged_sets(count)')
      .not('finished_at', 'is', null).order('finished_at', { ascending: false }).limit(60)); // 8 weeks at up to 6 a week
    // ponytail: client-side stats over the last SET_LIMIT sets; move to SQL views if logs grow past that
    const x = must(await supabase.from('logged_sets').select('exercise_id, weight, reps, rir, workout_id, created_at').order('created_at', { ascending: false }).limit(SET_LIMIT));
    const c = must(await supabase.from('cardio_logs').select('id, kind, minutes, intensity, logged_on').order('created_at', { ascending: false }).limit(10));
    // All together, so no chart ever renders from workouts without their sets (a false zero).
    setWorkouts(w as Workout[]);
    setSets(x.map((r) => ({ ...r, weight: Number(r.weight), rir: r.rir == null ? null : Number(r.rir) })) as SetRow[]);
    setCardio(c as Cardio[]);
  }, []);

  const reload = useCallback(() => {
    setNow(Date.now());
    setLoadFailed(false);
    setWeighIns((v) => (v === null ? undefined : v)); // a retry after a failure shows loading again
    load().catch(() => setLoadFailed(true));
  }, [load]);
  useFocusEffect(reload);

  async function addWeight() {
    if (!profile) return;
    const id = profile.id;
    const value = toNumber(weight);
    if (!(await attempt(() => logBodyweight(id, value), 'log your bodyweight'))) return;
    track('bodyweight_logged');
    setWeight('');
    await Promise.all([load().catch(() => setLoadFailed(true)), refresh()]); // profile bodyweight drives nutrition targets
  }

  // Single-flight: a double tap must not log the session twice.
  const logging = useRef(false);
  const addCardio = () => once(logging, async () => {
    const saved = await attempt(async () => {
      ok(await supabase.from('cardio_logs').insert({ kind, minutes: toNumber(minutes), intensity, logged_on: localDate() }));
    }, 'log your cardio');
    if (!saved) return;
    track('cardio_logged', { kind, intensity });
    setMinutes('');
    await load().catch(() => setLoadFailed(true)); // saved; a failed reload says so instead of an unhandled error
  });

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
  const thisWeek = weekKey(new Date(now).toISOString());
  const firstWeek = weekKey(new Date(cutoff).toISOString());
  // At the row cap the oldest loaded week may be cut off part-way: leave it out rather than undercount it.
  const cut = sets.length >= SET_LIMIT ? weekKey(sets[sets.length - 1].created_at) : -Infinity;
  const weekly = (m: Muscle | null, f: (x: SetRow) => number) => {
    const w = new Map<number, number>();
    let soFar = 0;
    for (const x of sets) {
      if (m && EXERCISE_BY_ID[x.exercise_id]?.muscle !== m) continue;
      const k = weekKey(x.created_at);
      if (k < firstWeek || k <= cut) continue;
      if (k >= thisWeek) { soFar += f(x); continue; }
      w.set(k, (w.get(k) ?? 0) + f(x));
    }
    return { series: [...w.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => Math.round(v)), soFar: Math.round(soFar) };
  };
  const muscleSets = (m: Muscle) => weekly(m, () => 1);
  const totalSets = weekly(null, () => 1);

  const bests = newBests(sets.map((x) => ({ ...x })), 90);
  const first = (a: number[]) => a[0] ?? 0;
  const lastOf = (a: number[]) => a[a.length - 1] ?? 0;
  const topTwo = lifts.slice(0, 2);

  const rangeBar = <Segmented value={range} onChange={setRange} options={(['7D', '30D', '90D', '1Y'] as const).map((v) => ({ value: v, label: v }))} />;
  const ready = workouts !== null && !loadFailed; // charts only from loaded data, never from empty placeholders
  const none = (what: string) => <T muted size="sm">No {what} in the last {range === '1Y' ? 'year' : `${days} days`}.</T>;
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
      {workouts?.length && program ? (() => {
        const a = adherence(workouts.map((w) => w.finished_at), program.plan.days.length, 8, new Date(now), profile?.created_at);
        return (
          <Card>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <T size="micro">Consistency, last 8 weeks</T>
              {a.counted ? <Chip tone={a.pct >= 75 ? 'pos' : 'neutral'} label={`${a.pct}% of planned sessions`} /> : <Chip tone="neutral" label="First week in progress" />}
            </View>
            <View style={[s.row, { alignItems: 'flex-end', gap: 6, height: 64 }]} accessible accessibilityLabel={a.weeks.map((w, i) => `Week ${i + 1}: ${i < a.weeks.length - a.span ? 'before you joined' : `${w.done} of ${w.planned}`}`).join('. ')}>
              {a.weeks.map((w) => (
                <View key={w.start} style={{ flex: 1, height: 64, justifyContent: 'flex-end', backgroundColor: C.sunken, borderRadius: 8, overflow: 'hidden' }}>
                  <View style={{ height: `${Math.min(100, (w.done / Math.max(1, w.planned)) * 100)}%`, backgroundColor: w.done >= w.planned ? C.accent : C.control }} />
                </View>
              ))}
            </View>
            <T muted size="sm">Trained in {a.activeWeeks} of the last {a.span} week{a.span === 1 ? '' : 's'}. This week counts once you have done its planned sessions, so it never pulls the number down early.</T>
          </Card>
        );
      })() : null}
      {workouts && !workouts.length ? (
        <Card flat>
          <Empty icon="trending-up-outline" title="Your strength trend starts after 2 workouts" body="Log a session and you'll see how your lifts change over time."
            action="Start a workout" onAction={() => router.push('/workout')} />
        </Card>
      ) : null}

      <Segmented value={view} onChange={setView} options={[
        { value: 'strength', label: 'Strength' }, { value: 'hypertrophy', label: 'Load' }, { value: 'volume', label: 'Sets' }, { value: 'bodyweight', label: 'Body' },
      ]} />

      {ready && view === 'strength' && lifts.length ? (<>
        <View style={[s.row, { alignItems: 'stretch', flexWrap: 'wrap' }]}>
          {topTwo.map((id) => {
            const w = topWeights(id);
            return (
              <Card key={id} onPress={() => setLift(id)} style={{ flexBasis: '47%', flexGrow: 1 }}>
                <T size="micro" numberOfLines={2}>{name(id)}</T>
                {w.length ? <T size="lg">{first(w)} → {lastOf(w)} <T muted size="sm">{unit}</T></T> : none('sessions')}
                {!w.length ? null : w.length > 1 ? <T size="sm" bold color={lastOf(w) >= first(w) ? C.pos : C.warn}>{delta(first(w), lastOf(w))}</T> : <T muted size="sm">One session</T>}
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

      {ready && view === 'hypertrophy' ? (
        <Card>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {MUSCLES.map((m) => <Pill key={m} label={MUSCLE_LABEL[m]} on={m === muscle} onPress={() => setMuscle(m)} />)}
          </ScrollView>
          {rangeBar}
          {(() => {
            const { series: load, soFar } = weekly(muscle, (x) => x.weight * x.reps);
            const sofar = soFar ? <T muted size="sm">This week so far: {soFar.toLocaleString()} {unit} lifted</T> : null;
            if (!load.length) return soFar ? sofar : none(`${MUSCLE_LABEL[muscle].toLowerCase()} sets`);
            return (<>
              {sofar}
              <Stat label={`${MUSCLE_LABEL[muscle]} · weekly volume load`} value={lastOf(load).toLocaleString()} unit={`${unit} lifted`} delta={load.length > 1 ? `${delta(first(load), lastOf(load))} in ${range}` : undefined} tone={lastOf(load) >= first(load) ? 'pos' : 'warn'} />
              <LineChart values={load} label="Weekly volume load" />
              <T muted size="sm">Volume load (weight × reps) is a rough proxy for stimulus. It tells you what you did, not what grew.</T>
            </>);
          })()}
        </Card>
      ) : null}

      {ready && view === 'volume' ? (<>
        {rangeBar}
        <Card>
          {totalSets.soFar ? <T muted size="sm">This week so far: {totalSets.soFar} hard sets</T> : null}
          {!totalSets.series.length ? (totalSets.soFar ? null : none('logged sets')) : (<>
            <Stat label="Total hard sets per week (completed weeks)" value={lastOf(totalSets.series)} unit="sets" delta={totalSets.series.length > 1 ? `${first(totalSets.series)} → ${lastOf(totalSets.series)} sets/week` : undefined} tone="neutral" />
            <LineChart values={totalSets.series} label="Weekly sets" />
          </>)}
        </Card>
        <View style={[s.row, { alignItems: 'stretch', flexWrap: 'wrap' }]}>
          {MUSCLES.filter((m) => muscleSets(m).series.length).map((m) => {
            const v = muscleSets(m).series;
            return (
              <Card key={m} style={{ flexBasis: '47%', flexGrow: 1, gap: 4 }}>
                <T size="micro">{MUSCLE_LABEL[m]} volume</T>
                <T size="lg">{first(v)} → {lastOf(v)} <T muted size="sm">sets/wk</T></T>
              </Card>
            );
          })}
        </View>
        <TrendCard sets={sets} muscle={trendMuscle} onMuscle={setTrendMuscle} now={now} />
        <Button title="Weekly volume and productive ranges" icon="layers" onPress={() => router.push('/volume')} />
      </>) : null}

      {view === 'bodyweight' ? (
        <Card>
          {weighIns === undefined ? <ActivityIndicator color={C.accent} /> : null}
          {weighIns === null ? (<>
            <T muted size="sm">Could not load your bodyweight. Check your connection.</T>
            <Button title="Try again" onPress={reload} />
          </>) : null}
          {weighIns && !weighIns.length ? <Empty icon="scale-outline" title="No bodyweight yet" body="Weigh in a few times a week and we'll show the trend, not the daily noise." /> : null}
          {weighIns?.length ? (<>
            <Stat label="Bodyweight" value={weighIns[weighIns.length - 1].weight} unit={unit} delta={weighIns.length > 1 ? `${(weighIns[weighIns.length - 1].weight - weighIns[0].weight).toFixed(1)} ${unit} since ${shortDate(weighIns[0].logged_on)}` : undefined} tone="neutral" />
            <LineChart values={weighIns.slice(-30).map((x) => x.weight)} label="Bodyweight" />
          </>) : null}
          <View style={s.row}>
            <View style={{ flex: 1 }}><Field label="Bodyweight today" placeholder={`e.g. ${profile?.bodyweight ?? 75}`} keyboardType="decimal-pad" value={weight} onChangeText={setWeight} /></View>
            <Button kind="primary" title="Log" disabled={!(toNumber(weight) > 20 && toNumber(weight) <= 700)} onPress={addWeight} />
          </View>
          <T muted size="sm">Updates your nutrition targets. Weigh at the same time of day; the trend matters more than any single day.</T>
        </Card>
      ) : null}

      {bests.length ? (
        <Section title="Personal records">
          <Card flat style={{ gap: 0, paddingVertical: 4 }}>
            {bests.slice(0, 8).map((b, k) => (
              <View key={`${b.exerciseId}-${b.at}`} style={[s.row, { minHeight: 60, borderTopWidth: k ? 1 : 0, borderTopColor: C.border }]}>
                <IconTile name="trophy-outline" size={36} />
                <View style={{ flex: 1 }}>
                  <T bold numberOfLines={1}>{name(b.exerciseId)}</T>
                  <T muted size="sm">{b.weight} {unit} · +{Math.round((b.weight - b.previous) * 10) / 10} {unit} · {shortDate(b.at)}</T>
                </View>
                <Chip tone="accent" icon="trophy-outline" label="PR" />
              </View>
            ))}
          </Card>
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
          <Button kind="primary" title="Log cardio" disabled={!(toNumber(minutes) >= 1)} onPress={addCardio} />
          {cardio.map((c) => (
            <View key={c.id} style={[s.row, { justifyContent: 'space-between' }]}>
              <T muted>{shortDate(c.logged_on)} · {c.kind}</T><T>{c.minutes} min, {c.intensity}</T>
            </View>
          ))}
        </Card>
      </Section>

      {workouts?.length ? (
        <Section title="Workout history">
          <Card flat style={{ gap: 0, paddingVertical: 4 }}>
            {workouts.map((w, k) => (
              <Pressable key={w.id} accessibilityRole="button" accessibilityHint="Opens the sets you logged" onPress={() => router.push({ pathname: '/history/[id]', params: { id: w.id } })}
                style={[s.row, { minHeight: 60, borderTopWidth: k ? 1 : 0, borderTopColor: C.border }]}>
                <IconTile name="barbell-outline" size={36} />
                <View style={{ flex: 1 }}>
                  <T bold>{w.day_name}</T>
                  <T muted size="sm">{shortDate(w.finished_at)} · {w.logged_sets[0]?.count ?? 0} sets</T>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.faint} />
              </Pressable>
            ))}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}

const TREND_WHY = {
  text: 'Average RIR is the mean of the reps in reserve you logged (RPE entries are converted to RIR), weighted by sets over the last 4 weeks. It shows how close to failure you reported training. It does not measure fatigue, recovery or how hard the sets really were: reps-in-reserve guesses are imperfect, and get more accurate closer to failure. Sets logged without an effort rating are left out of the average.',
  label: 'principle' as const, refIds: ['rir_accuracy'],
};

/** Backlog J-02: 4-week moving averages of hard sets per week and of logged RIR. */
function TrendCard({ sets, muscle, onMuscle, now }: { sets: SetRow[]; muscle: Muscle | null; onMuscle: (m: Muscle | null) => void; now: number }) {
  // At the row limit the oldest week may be cut off part-way: leave it out rather than undercount it.
  const oldest = sets.length >= SET_LIMIT ? weekStart(new Date(sets[sets.length - 1].created_at)).getTime() : -Infinity;
  const rows = sets.filter((x) => (!muscle || EXERCISE_BY_ID[x.exercise_id]?.muscle === muscle) && weekStart(new Date(x.created_at)).getTime() > oldest);
  const t = weeklyTrend(rows, new Date(now));
  const last = t?.[t.length - 1];
  const before = t && t.length > 4 ? t[t.length - 5] : null;
  const rir = (t ?? []).map((w) => w.rirAvg4).filter((v): v is number => v != null);
  const rirSets = (t ?? []).slice(-4).reduce((a, w) => a + w.rirSets, 0);
  return (
    <Card>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <T size="micro">Trends · 4-week average</T>
        <Why e={TREND_WHY} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Pill label="All" on={!muscle} onPress={() => onMuscle(null)} />
        {MUSCLES.map((m) => <Pill key={m} label={MUSCLE_LABEL[m]} on={m === muscle} onPress={() => onMuscle(m)} />)}
      </ScrollView>
      {!t || !last ? <T muted size="sm">Trends appear after 2 weeks of logged sets{muscle ? ` for ${MUSCLE_LABEL[muscle].toLowerCase()}` : ''}.</T> : (<>
        <Stat label="Hard sets per week" value={last.setsAvg4} unit="sets" delta={before ? `${before.setsAvg4} four weeks earlier` : undefined} tone="neutral" />
        <LineChart values={t.map((w) => w.setsAvg4)} label="Hard sets per week, 4-week average" />
        {last.rirAvg4 == null
          ? <T muted size="sm">No reps in reserve logged in the last 4 weeks, so there is no average.</T>
          : <Stat label="Average reps in reserve logged" value={last.rirAvg4} unit={`RIR · ${rirSets} sets`} delta={before?.rirAvg4 != null ? `${before.rirAvg4} four weeks earlier` : undefined} tone="neutral" />}
        {rir.length > 1 ? <LineChart values={rir} label="Average reps in reserve, 4-week average" /> : null}
      </>)}
    </Card>
  );
}
