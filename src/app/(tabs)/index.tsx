import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { FoundingMember, shouldAskSurvey, shouldOfferFoundingDeal, WeeklySurvey } from '@/beta';
import { EXERCISE_BY_ID } from '@/engine/exercises.ts';
import { targets } from '@/engine/nutrition.ts';
import { TOPICS, type Topic } from '@/engine/science.ts';
import { deloadOffer, isMissed } from '@/engine/session.ts';
import type { Explanation } from '@/engine/types.ts';
import { attempt } from '@/lib/alert';
import { daysSince, isDeload, localDate, must, recentWorkouts, track, updateProfile, useData } from '@/lib/data';
import { dayLogs, sum, type Macros, type Meal } from '@/lib/food';
import { loadCoachNotes, type CoachNotes } from '@/lib/coach';
import { newBests, streakWeeks, weekDots, type Best, type SetRecord } from '@/lib/stats';
import { supabase } from '@/lib/supabase';
import { Button, C, Card, s, Screen, T } from '@/ui';
import { Badge, Why } from '@/why';

type Done = { id: string; day_name: string; finished_at: string; logged_sets: { count: number }[] };
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const mealNow = (hour: number): Meal => (hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 21 ? 'dinner' : 'snack');

export default function Home() {
  const { profile, program, refresh } = useData();
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
      setBests(newBests(x.map((r) => ({ ...r, weight: Number(r.weight) })) as SetRecord[], 30, now).slice(0, 3));
    })().catch(() => setDone([]));
    recentWorkouts(4).then((r) => {
      setOffer(deloadOffer(r));
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
  const quick = (icon: keyof typeof Ionicons.glyphMap, label: string, go: () => void) => (
    <Pressable key={label} accessibilityRole="button" onPress={go}
      style={{ flexBasis: '47%', flexGrow: 1, minHeight: 56, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}>
      <Ionicons name={icon} size={22} color={C.accent} />
      <T bold>{label}</T>
    </Pressable>
  );

  return (
    <Screen edges={['top']}>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <T size="xl">RepProof</T>
        <Pressable accessibilityRole="button" accessibilityLabel="Settings" hitSlop={12} onPress={() => router.push('/settings')}>
          <Ionicons name="person-circle" size={34} color={C.muted} />
        </Pressable>
      </View>

      {isDeload(profile.deload_until) ? (
        <Card style={{ borderColor: '#7DB7FF' }}>
          <T bold>Deload week</T>
          <T muted>Half the sets, same weights, until {profile.deload_until}.</T>
        </Card>
      ) : null}

      {offer && !isDeload(profile.deload_until) ? (
        <Card style={{ borderColor: '#7DB7FF' }}>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <T bold>Deload suggested</T>
            <Why e={offer} changed />
          </View>
          <T muted>Your recent sessions suggest a lighter week. Your call.</T>
          <Button title="Start a deload week" onPress={acceptDeload} />
        </Card>
      ) : null}

      {missed ? (
        <Card>
          <T bold>Missed a session?</T>
          <T muted>No problem. When you start, choose to do it now or skip to the next one.</T>
        </Card>
      ) : null}

      <Card>
        <T muted size="sm">NEXT WORKOUT</T>
        <T size="lg">{day.name}</T>
        {day.exercises.map((e) => (
          <T key={e.exerciseId} muted>{e.pinnedSets ?? e.sets} × {EXERCISE_BY_ID[e.exerciseId].name}</T>
        ))}
        <T muted size="sm">Plus 1 warm-up set before each exercise.</T>
        <Button kind="primary" title="Start workout" onPress={() => router.push('/workout')} style={{ marginTop: 6 }} />
      </Card>

      {coach?.decisions.length ? (
        <Card>
          <T muted size="sm">COACH NOTES · WHAT TO DO NEXT</T>
          {[...coach.decisions]
            .sort((a, b) => Number(a.kind === 'progressing' || a.kind === 'too_new') - Number(b.kind === 'progressing' || b.kind === 'too_new'))
            .slice(0, 4)
            .map((d) => (
              <View key={d.exerciseId} style={[s.row, { alignItems: 'flex-start' }]}>
                <View style={{ flex: 1 }}>
                  <T bold>{EXERCISE_BY_ID[d.exerciseId]?.name ?? d.exerciseId}</T>
                  <T muted size="sm" style={{ color: d.kind === 'progressing' || d.kind === 'too_new' ? C.muted : C.accent }}>{d.title}</T>
                </View>
                <Why e={d.explanation} />
              </View>
            ))}
          {coach.advice ? (
            <View style={[s.row, { alignItems: 'flex-start' }]}>
              <T style={{ flex: 1 }}>{coach.advice.text}</T>
              <Why e={coach.advice} changed />
            </View>
          ) : null}
          <T muted size="sm">From your last sessions. Set changes are already in your plan.</T>
        </Card>
      ) : null}

      <Card>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <T muted size="sm">THIS WEEK</T>
          {streak > 1 ? <T size="sm" style={{ color: C.accent }} bold>{streak}-week streak</T> : null}
        </View>
        <View style={s.row} accessibilityLabel={`Trained ${dots.filter(Boolean).length} days this week`}>
          {dots.map((on, i) => (
            <View key={i} style={{ flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
              backgroundColor: on ? C.accent : 'transparent', borderWidth: 1, borderColor: on ? C.accent : C.border }}>
              <T bold size="sm" style={{ color: on ? C.onAccent : C.muted }}>{DAY_LETTERS[i]}</T>
            </View>
          ))}
        </View>
        <T bold>{dots.filter(Boolean).length} of {program.plan.days.length} sessions</T>
      </Card>

      <View style={[s.row, { flexWrap: 'wrap' }]}>
        {quick('restaurant', 'Log food', () => router.push({ pathname: '/food', params: { meal } }))}
        {quick('scale', 'Log weight', () => router.push('/progress'))}
        {quick('walk', 'Add cardio', () => router.push('/progress'))}
        {quick('flask', 'The science', () => router.push('/science'))}
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.push('/nutrition')}>
        <Card>
          <T muted size="sm">NUTRITION TODAY</T>
          <View style={[s.row, { flexWrap: 'wrap', columnGap: 16, rowGap: 2 }]}>
            <T bold>{Math.round(eaten?.kcal ?? 0)} / {goal.calories} kcal</T>
            <T bold>{Math.round(eaten?.protein ?? 0)} / {goal.protein} g protein</T>
          </View>
        </Card>
      </Pressable>

      {bests.length ? (
        <Card>
          <T muted size="sm">NEW BESTS (30 DAYS)</T>
          {bests.map((b) => (
            <View key={`${b.exerciseId}-${b.at}`} style={[s.row, { justifyContent: 'space-between' }]}>
              <T style={{ flex: 1 }}>{EXERCISE_BY_ID[b.exerciseId]?.name ?? b.exerciseId}</T>
              <T bold style={{ color: C.accent }}>{b.weight} {profile.unit}</T>
              <T muted size="sm">was {b.previous}</T>
            </View>
          ))}
        </Card>
      ) : null}

      {last ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/progress')}>
          <Card>
            <T muted size="sm">LAST WORKOUT</T>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <T bold>{last.day_name}</T>
              <T muted>{new Date(last.finished_at).toLocaleDateString()} · {last.logged_sets[0]?.count ?? 0} sets</T>
            </View>
          </Card>
        </Pressable>
      ) : null}

      {tip ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/science')}>
          <Card>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <T muted size="sm">SCIENCE OF THE DAY</T>
              <Badge label={tip.label} />
            </View>
            <T bold>{tip.title}</T>
            <T muted>{tip.shows}</T>
            <T size="sm" style={{ color: C.accent }}>See the studies</T>
          </Card>
        </Pressable>
      ) : null}

      {survey ? <WeeklySurvey userId={profile.id} onDone={() => setSurvey(false)} /> : null}
      {founding && !survey ? <FoundingMember userId={profile.id} onDone={() => setFounding(false)} /> : null}
    </Screen>
  );
}
