import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { EXERCISE_BY_ID } from '@/engine/exercises.ts';
import { must, useData } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { Card, s, Screen, T } from '@/ui';

type Workout = { id: string; day_name: string; finished_at: string; logged_sets: { count: number }[] };

export default function Progress() {
  const { profile } = useData();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [bests, setBests] = useState<[string, number][]>([]);

  useFocusEffect(useCallback(() => {
    (async () => {
      const w = must(await supabase.from('workouts').select('id, day_name, finished_at, logged_sets(count)')
        .not('finished_at', 'is', null).order('finished_at', { ascending: false }).limit(30));
      setWorkouts(w as Workout[]);
      // ponytail: client-side max over the last 2000 sets; move to a SQL view if logs grow past that
      const sets = must(await supabase.from('logged_sets').select('exercise_id, weight').order('created_at', { ascending: false }).limit(2000));
      const best: Record<string, number> = {};
      for (const x of sets) best[x.exercise_id] = Math.max(best[x.exercise_id] ?? 0, Number(x.weight));
      const name = (id: string) => EXERCISE_BY_ID[id]?.name ?? id;
      setBests(Object.entries(best).sort((a, b) => name(a[0]).localeCompare(name(b[0]))));
    })().catch(() => setWorkouts([]));
  }, []));

  return (
    <Screen edges={['top']}>
      <T size="xl">Progress</T>
      {workouts && !workouts.length ? <T muted>Finish your first workout to see it here.</T> : null}

      {bests.length ? (
        <Card>
          <T bold>Best weights</T>
          {bests.map(([id, w]) => (
            <View key={id} style={[s.row, { justifyContent: 'space-between' }]}>
              <T muted style={{ flex: 1 }}>{EXERCISE_BY_ID[id]?.name ?? id}</T>
              <T bold>{w} {profile?.unit}</T>
            </View>
          ))}
        </Card>
      ) : null}

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
