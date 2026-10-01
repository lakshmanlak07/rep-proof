import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { EXERCISE_BY_ID } from '@/engine/exercises.ts';
import { deloadOffer, isMissed } from '@/engine/session.ts';
import type { Explanation } from '@/engine/types.ts';
import { daysSince, isDeload, localDate, recentWorkouts, track, updateProfile, useData } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { Button, C, Card, s, Screen, T } from '@/ui';
import { Why } from '@/why';

function startOfWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d.toISOString();
}

export default function Home() {
  const { profile, program, refresh } = useData();
  const [weekCount, setWeekCount] = useState<number | null>(null);
  const [offer, setOffer] = useState<Explanation | null>(null);
  const [missed, setMissed] = useState(false);

  useFocusEffect(useCallback(() => {
    supabase.from('workouts').select('id', { count: 'exact', head: true }).not('finished_at', 'is', null).gte('started_at', startOfWeek())
      .then(({ count }) => setWeekCount(count ?? 0));
    recentWorkouts(4).then((r) => {
      setOffer(deloadOffer(r));
      setMissed(isMissed(r[0] ? daysSince(r[0].finishedAt) : null, program?.plan.days.length ?? 3));
    }).catch(() => {});
  }, [program]));

  async function acceptDeload() {
    const end = new Date();
    end.setDate(end.getDate() + 6);
    await updateProfile(profile!.id, { deload_until: localDate(end) });
    track('deload', { trigger: 'offer' });
    await refresh();
  }

  if (!program || !profile) return null;
  const day = program.plan.days[program.next_day];

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
          <T key={e.exerciseId} muted>{e.sets} × {EXERCISE_BY_ID[e.exerciseId].name}</T>
        ))}
        <Button kind="primary" title="Start workout" onPress={() => router.push('/workout')} style={{ marginTop: 6 }} />
      </Card>

      <Card>
        <T muted size="sm">THIS WEEK</T>
        <T size="lg">{weekCount ?? '–'} of {program.plan.days.length} sessions</T>
      </Card>
    </Screen>
  );
}
