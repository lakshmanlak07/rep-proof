import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { EXERCISE_BY_ID } from '@/engine/exercises.ts';
import { exerciseMinutes, MUSCLE_NAMES } from '@/engine/plan.ts';
import type { PlannedExercise } from '@/engine/types.ts';
import { attempt } from '@/lib/alert';
import { track, updatePlan, useData } from '@/lib/data';
import { PinSheet } from '@/pins';
import { Button, Card, Chip, Loading, Screen, s, T } from '@/ui';

export default function WorkoutDay() {
  const { index } = useLocalSearchParams<{ index: string }>();
  const { program, refresh } = useData();
  const [editing, setEditing] = useState<number | null>(null);
  if (!program) return <Loading />;
  const di = Math.min(Number(index) || 0, program.plan.days.length - 1);
  const { plan } = program;
  const day = plan.days[di];
  const mins = Math.round(day.exercises.reduce((a, e) => a + exerciseMinutes(e.pinnedSets ?? e.sets), 0) / 5) * 5;
  const muscles = [...new Set(day.exercises.map((e) => EXERCISE_BY_ID[e.exerciseId].muscle))];

  async function savePin(pin: Pick<PlannedExercise, 'pinnedSets' | 'pinnedReps'>) {
    const days = plan.days.map((d, i) => i !== di ? d : {
      ...d, exercises: d.exercises.map((e, k) => (k === editing ? { ...e, pinnedSets: pin.pinnedSets, pinnedReps: pin.pinnedReps } : e)),
    });
    if (!(await attempt(() => updatePlan(program!.id, { ...plan, days }), 'save the pin'))) return;
    track('pin', { set: pin.pinnedSets !== undefined || pin.pinnedReps !== undefined });
    setEditing(null);
    await refresh();
  }

  return (
    <Screen edges={['bottom']}>
      <View style={{ gap: 6 }}>
        <T size="micro">Workout {di + 1} of {plan.days.length}</T>
        <T size="xl">{day.name}</T>
        <T muted>~{mins} min · {day.exercises.length} exercises</T>
      </View>
      <View style={[s.row, { flexWrap: 'wrap', gap: 6 }]}>{muscles.map((m) => <Chip key={m} label={MUSCLE_NAMES[m]} tone="accent" />)}</View>
      {day.exercises.map((e, k) => {
        const ex = EXERCISE_BY_ID[e.exerciseId];
        const pinned = e.pinnedSets !== undefined || e.pinnedReps !== undefined;
        return (
          <Card key={e.exerciseId} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: e.exerciseId } })}>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <T bold>{ex.name}</T>
                <T muted size="sm">{e.pinnedSets ?? e.sets} sets × {e.pinnedReps ?? `${e.repMin}–${e.repMax}`} reps · {(e.lastSetRir ?? e.rirTarget) === 0 ? 'last set to failure' : `${e.rirTarget} RIR`}</T>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Edit sets and reps" hitSlop={10} onPress={() => setEditing(k)}>
                <Chip tone={pinned ? 'accent' : 'neutral'} icon={pinned ? 'pin' : 'create-outline'} label={pinned ? 'Pinned' : 'Edit'} />
              </Pressable>
            </View>
          </Card>
        );
      })}
      <T muted size="sm">Plus 1 warm-up set before each exercise. Tap an exercise for cues; tap Edit to pin sets or reps.</T>
      {di === program.next_day ? <Button kind="primary" title="Start this workout" icon="play" onPress={() => router.replace('/workout')} /> : null}
      {editing !== null ? <PinSheet e={day.exercises[editing]} onSave={savePin} onClose={() => setEditing(null)} /> : null}
    </Screen>
  );
}
