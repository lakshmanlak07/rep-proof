import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { EXERCISE_BY_ID } from '@/engine/exercises.ts';
import { exerciseMinutes, MUSCLE_NAMES, recommendSplit, SPLIT_DAYS, SPLIT_NAMES } from '@/engine/plan.ts';
import type { SplitId } from '@/engine/types.ts';
import { supabase } from '@/lib/supabase';
import { isDeload, localDate, saveProgram, startOfWeek, toProfile, track, updateProfile, useData } from '@/lib/data';
import { Button, C, Card, Chip, Choice, Header, IconTile, Section, Sheet, s, Screen, T } from '@/ui';
import { alert, attempt } from '@/lib/alert';
import { WhyBody } from '@/why';

export default function Plan() {
  const { profile, program, refresh } = useData();
  const [schedule, setSchedule] = useState<{ days: number; split: SplitId } | null>(null);
  const [doneDays, setDoneDays] = useState<number[]>([]);
  useFocusEffect(useCallback(() => {
    supabase.from('workouts').select('day_index').not('finished_at', 'is', null).gte('finished_at', startOfWeek()).then(({ data }) => {
      setDoneDays((data ?? []).map((r) => r.day_index as number));
    });
  }, []));
  if (!profile || !program) return null;
  const { plan } = program;
  const deload = isDeload(profile.deload_until);

  function toggleDeload() {
    if (deload) return attempt(() => updateProfile(profile!.id, { deload_until: null }), 'end the deload').then(refresh);
    alert('Start a deload?', 'For the next 7 days: half the sets, same weights.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start deload', onPress: async () => {
          const end = new Date();
          end.setDate(end.getDate() + 6);
          if (!(await attempt(() => updateProfile(profile!.id, { deload_until: localDate(end) }), 'start the deload'))) return;
          track('deload', { trigger: 'user' });
          await refresh();
        },
      },
    ]);
  }

  async function saveSchedule() {
    const { days, split } = schedule!;
    const saved = await attempt(async () => {
      await updateProfile(profile!.id, { days });
      // Logged weights carry over: suggestions read history by exercise, not by program.
      await saveProgram(toProfile({ ...profile!, days }, plan), split, 0);
    }, 'rebuild your plan');
    if (!saved) return;
    track('schedule_changed', { days, split });
    setSchedule(null);
    await refresh();
  }

  const n = plan.days.length;
  const slots = SLOTS[n] ?? SLOTS[3];
  const week = Array.from({ length: 7 }, (_, d) => (slots.includes(d) ? slots.indexOf(d) : -1));
  const todayIdx = (new Date().getDay() + 6) % 7;

  return (
    <Screen edges={['top']}>
      <Header kicker={`${SPLIT_NAMES[plan.split]} · ${n} days a week`} title="Your plan" />
      {deload ? <Chip tone="accent" icon="leaf" label={`Deload week until ${profile.deload_until}`} /> : null}

      <Section title="This week">
        <View style={{ gap: 10 }}>
          {week.map((di, d) => {
            const today = d === todayIdx;
            if (di < 0) {
              return (
                <View key={d} style={[s.row, { paddingHorizontal: 4, minHeight: 36 }]}>
                  <T size="micro" style={{ width: 40 }} color={today ? C.accent : C.faint}>{DAYS[d]}</T>
                  <T muted size="sm">Rest</T>
                </View>
              );
            }
            const day = plan.days[di];
            const complete = doneDays.includes(di);
            const next = di === program.next_day && !complete;
            const muscles = [...new Set(day.exercises.map((e) => EXERCISE_BY_ID[e.exerciseId].muscle))];
            const mins = Math.round(day.exercises.reduce((a, e) => a + exerciseMinutes(e.pinnedSets ?? e.sets), 0) / 5) * 5;
            return (
              <View key={d} style={s.row}>
                <T size="micro" style={{ width: 40, alignSelf: 'flex-start', paddingTop: 20 }} color={today ? C.accent : C.muted}>{DAYS[d]}</T>
                <Card onPress={() => router.push({ pathname: '/workout-day/[index]', params: { index: String(di) } })}
                  style={[{ flex: 1, gap: 8 }, next && { borderColor: C.accent, borderWidth: 1.5 }]}>
                  <View style={[s.row, { justifyContent: 'space-between' }]}>
                    <T size="lg" style={{ flex: 1 }}>{day.name}</T>
                    {complete ? <Chip tone="pos" icon="checkmark" label="Done" /> : next ? <Chip tone="accent" label="Up next" /> : null}
                  </View>
                  <T muted size="sm">{muscles.map((m) => MUSCLE_NAMES[m]).join(' · ')}</T>
                  <T muted size="sm">~{mins} min · {day.exercises.length} exercises</T>
                </Card>
              </View>
            );
          })}
        </View>
        <T muted size="sm">Suggested layout. Rep Proof follows your order, so a missed day just shifts the week.</T>
      </Section>

      <Section title="Volume this week" action="Details" onAction={() => router.push('/volume')}>
        <Card onPress={() => router.push('/volume')}>
          <T muted size="sm">Hard sets done vs planned, counted from your logs. Warm-ups do not count.</T>
          {Object.keys(plan.weeklySets).slice(0, 4).map((m) => {
            const planned = plan.weeklySets[m as keyof typeof plan.weeklySets]!;
            return (
              <View key={m} style={[s.row, { justifyContent: 'space-between' }]}>
                <T muted>{MUSCLE_NAMES[m as keyof typeof MUSCLE_NAMES]}</T>
                <T bold>{planned} sets planned</T>
              </View>
            );
          })}
          <T size="sm" bold color={C.accent}>See weekly volume</T>
        </Card>
      </Section>

      <Section title="Why this plan">
        {plan.explanations.map((e, i) => <Card key={i}><WhyBody e={e} /></Card>)}
      </Section>

      <Section title="Tools">
        <Card onPress={() => router.push('/library')} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <IconTile name="book" tone="accent" />
          <View style={{ flex: 1 }}><T bold>Exercise library</T><T muted size="sm">Browse movements by muscle</T></View>
        </Card>
        <Button title="Change days or split" onPress={() => setSchedule({ days: profile.days, split: plan.split })} />
        <Button title={deload ? `End deload (until ${profile.deload_until})` : 'Start a deload week'} onPress={toggleDeload} />
      </Section>

      <Sheet visible={!!schedule} onClose={() => setSchedule(null)} title="Change schedule">
        {schedule ? (<>
          <T muted size="sm">Your logged weights carry over. Pins reset and the week starts from day 1.</T>
          <View style={[s.row, { flexWrap: 'wrap' }]}>
            {[2, 3, 4, 5, 6].map((d) => (
              <Button key={d} title={`${d} days`} kind={schedule.days === d ? 'primary' : 'secondary'}
                onPress={() => setSchedule({ days: d, split: SPLIT_DAYS[schedule.split].includes(d) ? schedule.split : recommendSplit(d) })} />
            ))}
          </View>
          <Choice value={schedule.split} onChange={(sp) => setSchedule({ ...schedule, split: sp })}
            options={(Object.keys(SPLIT_DAYS) as SplitId[]).filter((sp) => SPLIT_DAYS[sp].includes(schedule.days))
              .map((sp) => ({ value: sp, label: SPLIT_NAMES[sp], hint: sp === recommendSplit(schedule.days) ? 'Recommended' : undefined }))} />
          <Button kind="primary" title="Rebuild my plan" onPress={saveSchedule} />
        </>) : null}
      </Sheet>
    </Screen>
  );
}

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
/** Suggested weekday slots by training days per week (0 = Monday). */
const SLOTS: Record<number, number[]> = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };
