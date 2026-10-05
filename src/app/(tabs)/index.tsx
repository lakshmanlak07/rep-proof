import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { FoundingMember, shouldAskSurvey, shouldOfferFoundingDeal, WeeklySurvey } from '@/beta';
import { EXERCISE_BY_ID } from '@/engine/exercises.ts';
import { exerciseMinutes, MUSCLE_NAMES } from '@/engine/plan.ts';
import { greeting, firstName, insightFromDecision, readiness as readinessOf } from '@/lib/insights';
import { targets } from '@/engine/nutrition.ts';
import { TOPICS, type Topic } from '@/engine/science.ts';
import { deloadOffer, isMissed } from '@/engine/session.ts';
import type { Explanation } from '@/engine/types.ts';
import { attempt } from '@/lib/alert';
import { daysSince, isDeload, localDate, must, recentWorkouts, startOfWeek, track, updateProfile, useData } from '@/lib/data';
import { dayLogs, sum, type Macros, type Meal } from '@/lib/food';
import { loadCoachNotes, type CoachNotes } from '@/lib/coach';
import { newBests, streakWeeks, weekDots, type Best, type SetRecord } from '@/lib/stats';
import { supabase } from '@/lib/supabase';
import { Button, C, Card, Chip, Header, IconTile, LineChart, ProgressBar, Reveal, s, Screen, Section, T, type Tone } from '@/ui';
import { Badge, InsightCard, Why } from '@/why';

type Done = { id: string; day_name: string; finished_at: string; logged_sets: { count: number }[] };
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const mealNow = (hour: number): Meal => (hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 21 ? 'dinner' : 'snack');

export default function Home() {
  const { session, profile, program, refresh } = useData();
  const [done, setDone] = useState<Done[] | null>(null);
  const [bests, setBests] = useState<Best[]>([]);
  const [offer, setOffer] = useState<Explanation | null>(null);
  const [missed, setMissed] = useState(false);
  const [eaten, setEaten] = useState<Macros | null>(null);
  const [survey, setSurvey] = useState(false);
  const [founding, setFounding] = useState(false);
  const [tip, setTip] = useState<Topic | null>(null);
  const [meal, setMeal] = useState<Meal>('snack');
  const [coach, setCoach] = useState<CoachNotes | null>(null);
  const [sets, setSets] = useState<{ exercise_id: string; weight: number; created_at: string; workout_id: string }[]>([]);
  const [checkins, setCheckins] = useState<(import('@/engine/types.ts').CheckIn | null)[]>([]);
  const userId = profile?.id;

  useFocusEffect(useCallback(() => {
    const now = new Date();
    setTip(TOPICS[Math.floor(now.getTime() / 864e5) % TOPICS.length]); // a different topic each day
    setMeal(mealNow(now.getHours()));
    if (userId) setCoach(loadCoachNotes(userId));
    const since = (days: number) => new Date(now.getTime() - days * 864e5).toISOString();
    (async () => {
      const w = must(await supabase.from('workouts').select('id, day_name, finished_at, logged_sets(count)')
        .not('finished_at', 'is', null).gte('finished_at', since(120)).order('finished_at', { ascending: false }));
      setDone(w as Done[]);
      const x = must(await supabase.from('logged_sets').select('exercise_id, weight, workout_id, created_at').gte('created_at', since(90)));
      setSets(x.map((r) => ({ ...r, weight: Number(r.weight) })));
      setBests(newBests(x.map((r) => ({ ...r, weight: Number(r.weight) })) as SetRecord[], 30, now).slice(0, 3));
    })().catch(() => setDone([]));
    recentWorkouts(4).then((r) => {
      setOffer(deloadOffer(r));
      setCheckins(r.map((w) => w.checkin));
      setMissed(isMissed(r[0] ? daysSince(r[0].finishedAt) : null, program?.plan.days.length ?? 3));
      if (userId) {
        setSurvey(shouldAskSurvey(userId, r.length > 0));
        setFounding(r.length > 0 && shouldOfferFoundingDeal(userId));
      }
    }).catch(() => {});
    dayLogs().then((l) => setEaten(sum(l))).catch(() => setEaten(null));
  }, [program, userId]));

  async function acceptDeload() {
    const end = new Date();
    end.setDate(end.getDate() + 6);
    if (!userId) return;
    if (!(await attempt(() => updateProfile(userId, { deload_until: localDate(end) }), 'start the deload'))) return;
    track('deload', { trigger: 'offer' });
    await refresh();
  }

  if (!program || !profile) return null;
  const day = program.plan.days[program.next_day];
  const goal = targets({
    bodyweight: Number(profile.bodyweight), unit: profile.unit, heightCm: Number(profile.height_cm),
    age: new Date().getFullYear() - profile.birth_year, sex: profile.sex, days: profile.days, phase: profile.nutrition_phase,
  });
  const finished = (done ?? []).map((w) => w.finished_at);
  const dots = weekDots(finished);
  const streak = streakWeeks(finished);
  const last = done?.[0];
  const deload = isDeload(profile.deload_until);

  const dayMinutes = Math.round(day.exercises.reduce((a, e) => a + exerciseMinutes(e.pinnedSets ?? e.sets), 0) / 5) * 5;
  const daySets = day.exercises.reduce((a, e) => a + (e.pinnedSets ?? e.sets), 0);
  const dayMuscles = [...new Set(day.exercises.map((e) => EXERCISE_BY_ID[e.exerciseId].muscle))];

  // Weekly volume: logged hard sets this week vs plan.
  const week = startOfWeek();
  const weekSets: Record<string, number> = {};
  for (const x of sets) if (x.created_at >= week) { const m = EXERCISE_BY_ID[x.exercise_id]?.muscle; if (m) weekSets[m] = (weekSets[m] ?? 0) + 1; }
  const plannedTotal = Object.values(program.plan.weeklySets).reduce((a, b) => a + (b ?? 0), 0);
  const doneTotal = Object.values(weekSets).reduce((a, b) => a + b, 0);

  const ready = readinessOf(checkins, deload);
  const noteRank = (k: string) => (k === 'progressing' || k === 'too_new' ? 1 : 0);
  const lead = [...(coach?.decisions ?? [])].sort((a, b) => noteRank(a.kind) - noteRank(b.kind))[0];
  const insight = lead ? insightFromDecision(lead) : null;
  const progressing = (coach?.decisions ?? []).find((d) => d.kind === 'progressing');

  // Progress chart: top e1RM-ish (top weight) per session for the most-trained lift.
  const counts: Record<string, Set<string>> = {};
  for (const x of sets) (counts[x.exercise_id] ??= new Set()).add(x.workout_id);
  const topLift = Object.keys(counts).sort((a, b) => counts[b].size - counts[a].size)[0];
  const trend: number[] = [];
  if (topLift) {
    const by = new Map<string, { at: string; w: number }>();
    for (const x of sets.filter((r) => r.exercise_id === topLift)) {
      const cur = by.get(x.workout_id);
      if (!cur || x.weight > cur.w) by.set(x.workout_id, { at: x.created_at, w: x.weight });
    }
    trend.push(...[...by.values()].sort((a, b) => a.at.localeCompare(b.at)).slice(-10).map((p) => p.w));
  }
  const name = firstName(session?.user.email);
  const quick = (icon: keyof typeof Ionicons.glyphMap, label: string, go: () => void) => (
    <Card key={label} onPress={go} style={{ flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
      <IconTile name={icon} tone="neutral" size={36} />
      <T bold>{label}</T>
    </Card>
  );

  const tile = (icon: keyof typeof Ionicons.glyphMap, tone: Tone, label: string, value: string, sub: string, go: () => void, extra?: React.ReactNode) => (
    <Card key={label} onPress={go} style={{ flexBasis: '47%', flexGrow: 1, gap: 8, padding: 16 }}>
      <IconTile name={icon} tone={tone} size={34} />
      <View style={{ gap: 2 }}>
        <T size="micro">{label}</T>
        <T size="lg" numberOfLines={1}>{value}</T>
        <T muted size="sm" numberOfLines={2}>{sub}</T>
      </View>
      {extra}
    </Card>
  );

  return (
    <Screen edges={['top']}>
      <Header kicker={greeting()} title={name ? `${name}, you're ready.` : "You're ready to train."}
        right={<Pressable accessibilityRole="button" accessibilityLabel="Profile" hitSlop={12} onPress={() => router.push('/profile')}>
          <IconTile name="person" tone="neutral" size={44} />
        </Pressable>} />

      {deload ? (
        <Card flat style={{ backgroundColor: C.accentSoft, borderColor: 'transparent' }}>
          <T bold color={C.accent}>Deload week</T>
          <T muted>Half the sets, same weights, until {profile.deload_until}.</T>
        </Card>
      ) : null}
      {offer && !deload ? (
        <Card flat style={{ backgroundColor: C.warnSoft, borderColor: 'transparent' }}>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <T bold color={C.warn}>Deload suggested</T>
            <Why e={offer} changed />
          </View>
          <T muted>Your recent sessions suggest a lighter week. Your call.</T>
          <Button title="Start a deload week" onPress={acceptDeload} />
        </Card>
      ) : null}
      {missed ? (
        <Card flat>
          <T bold>Missed a session?</T>
          <T muted>No problem. When you start, choose to do it now or skip to the next one.</T>
        </Card>
      ) : null}

      <Reveal>
        <View style={{ backgroundColor: C.accent, borderRadius: 28, padding: 22, gap: 18, shadowColor: C.accent, shadowOpacity: 0.28, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 6 }}>
          <View style={{ gap: 6 }}>
            <T size="micro" color="#B9D8DA">Today&apos;s workout</T>
            <T size="xl" color="#fff">{day.name}</T>
            <T color="#D7E8E9">~{dayMinutes} min · {day.exercises.length} exercises · {daySets} sets</T>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {dayMuscles.map((m) => (
              <View key={m} style={{ backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <T size="sm" color="#fff" bold>{MUSCLE_NAMES[m]}</T>
              </View>
            ))}
          </View>
          <Button kind="secondary" title="Start workout" icon="play" onPress={() => router.push('/workout')} style={{ borderColor: 'transparent' }} />
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/workout-day/[index]', params: { index: String(program.next_day) } })} hitSlop={8} style={{ alignSelf: 'center' }}>
            <T size="sm" bold color="#D7E8E9">Preview exercises</T>
          </Pressable>
        </View>
      </Reveal>

      <Card>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <T size="micro">This week</T>
          {streak > 1 ? <Chip tone="pos" icon="flame" label={`${streak}-week streak`} /> : null}
        </View>
        <View style={s.row} accessibilityLabel={`Trained ${dots.filter(Boolean).length} days this week`}>
          {dots.map((on, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.accent : C.sunken }}>
                {on ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
              </View>
              <T size="micro">{DAY_LETTERS[i]}</T>
            </View>
          ))}
        </View>
        <T muted size="sm">{dots.filter(Boolean).length} of {program.plan.days.length} sessions complete</T>
      </Card>

      <Section title="Your training">
        <View style={[s.row, { flexWrap: 'wrap', alignItems: 'stretch' }]}>
          {tile('layers', 'accent', 'Weekly volume', `${doneTotal} / ${plannedTotal} sets`, 'Hard sets logged this week', () => router.push('/volume'),
            <ProgressBar value={doneTotal} max={plannedTotal || 1} />)}
          {tile('trending-up', 'pos', 'Progression', progressing ? (EXERCISE_BY_ID[progressing.exerciseId]?.name ?? 'On track') : 'Building baseline',
            progressing ? 'Responding well, keep going' : 'Decisions start after 3 sessions', () => router.push('/insights'))}
          {tile('pulse', ready.tone, 'Readiness', ready.label, ready.detail, () => router.push('/insights'))}
          {tile('trophy', 'warn', 'Recent PRs', bests.length ? `${bests.length} new` : 'None yet', bests.length ? `${EXERCISE_BY_ID[bests[0].exerciseId]?.name} ${bests[0].weight} ${profile.unit}` : 'Your next best shows up here', () => router.push('/progress'))}
        </View>
      </Section>

      {insight ? (
        <Section title="Rep Proof insight" action="All insights" onAction={() => router.push('/insights')}>
          <InsightCard kicker={insight.kicker} icon={insight.icon} tone={insight.tone} see={insight.see} why={insight.why} todo={insight.todo} evidence={insight.evidence} refIds={insight.refIds} />
        </Section>
      ) : (
        <Section title="Rep Proof insight">
          <Card>
            <T bold>Your coach is learning.</T>
            <T muted>Finish a few sessions and Rep Proof will explain what is working, what is stalling and what to change, with the reasoning shown.</T>
          </Card>
        </Section>
      )}

      {trend.length > 1 && topLift ? (
        <Section title="Your progress" action="See all" onAction={() => router.push('/progress')}>
          <Card onPress={() => router.push('/progress')}>
            <View style={[s.row, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
              <View style={{ gap: 2 }}>
                <T size="micro">{EXERCISE_BY_ID[topLift]?.name}</T>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <T size="xl">{trend[trend.length - 1]}</T>
                  <T muted size="sm">{profile.unit} top weight</T>
                </View>
              </View>
              {trend[trend.length - 1] >= trend[0] ? <Chip tone="pos" icon="arrow-up" label={`${Math.abs(trend[trend.length - 1] - trend[0])} ${profile.unit}`} /> : null}
            </View>
            <LineChart values={trend} label="Top weight per session" height={120} />
          </Card>
        </Section>
      ) : null}

      <Section title="Quick log">
        <View style={[s.row, { flexWrap: 'wrap' }]}>
          {quick('restaurant', 'Log food', () => router.push({ pathname: '/food', params: { meal } }))}
          {quick('scale', 'Log weight', () => router.push('/progress'))}
          {quick('book', 'Exercise library', () => router.push('/library'))}
          {quick('flask', 'The science', () => router.push('/science'))}
        </View>
      </Section>

      <Card onPress={() => router.push('/nutrition')}>
        <T size="micro">Nutrition today</T>
        <View style={s.row}>
          <View style={{ flex: 1, gap: 6 }}>
            <T bold>{Math.round(eaten?.kcal ?? 0)} <T muted size="sm">/ {goal.calories} kcal</T></T>
            <ProgressBar value={eaten?.kcal ?? 0} max={goal.calories} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <T bold>{Math.round(eaten?.protein ?? 0)} <T muted size="sm">/ {goal.protein} g protein</T></T>
            <ProgressBar value={eaten?.protein ?? 0} max={goal.protein} />
          </View>
        </View>
      </Card>

      {last ? (
        <Card onPress={() => router.push('/progress')}>
          <T size="micro">Last workout</T>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <T bold>{last.day_name}</T>
            <T muted>{new Date(last.finished_at).toLocaleDateString()} · {last.logged_sets[0]?.count ?? 0} sets</T>
          </View>
        </Card>
      ) : null}

      {tip ? (
        <Card onPress={() => router.push('/science')}>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <T size="micro">Science of the day</T>
            <Badge label={tip.label} />
          </View>
          <T bold>{tip.title}</T>
          <T muted>{tip.shows}</T>
          <T size="sm" bold color={C.accent}>See the studies</T>
        </Card>
      ) : null}

      {survey ? <WeeklySurvey userId={profile.id} onDone={() => setSurvey(false)} /> : null}
      {founding && !survey ? <FoundingMember userId={profile.id} onDone={() => setFounding(false)} /> : null}
    </Screen>
  );
}
