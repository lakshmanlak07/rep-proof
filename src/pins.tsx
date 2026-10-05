import { useState } from 'react';
import { View } from 'react-native';

import { EXERCISE_BY_ID } from '@/engine/exercises.ts';
import type { PlannedExercise } from '@/engine/types.ts';
import { Button, Field, s, Sheet, T } from '@/ui';

/** Pin an exercise's sets or reps; pinned values stay fixed while the app keeps adjusting weight. */
export function PinSheet({ e, onSave, onClose }: { e: PlannedExercise; onSave: (p: Pick<PlannedExercise, 'pinnedSets' | 'pinnedReps'>) => void; onClose: () => void }) {
  const [sets, setSets] = useState(e.pinnedSets !== undefined ? String(e.pinnedSets) : '');
  const [reps, setReps] = useState(e.pinnedReps !== undefined ? String(e.pinnedReps) : '');
  const num = (v: string, max: number) => (v === '' ? undefined : Math.min(max, Math.max(1, Math.round(Number(v)) || 1)));
  return (
    <Sheet visible onClose={onClose} title={EXERCISE_BY_ID[e.exerciseId].name}>
      <T muted size="sm">Pinned values stay fixed; the app keeps adjusting the weight. Leave blank to let the app decide.</T>
      <View style={s.row}>
        <View style={{ flex: 1 }}><Field label={`Sets, 1-3 (plan: ${e.sets})`} keyboardType="number-pad" value={sets} onChangeText={setSets} /></View>
        <View style={{ flex: 1 }}><Field label={`Reps (plan: ${e.repMin}–${e.repMax})`} keyboardType="number-pad" value={reps} onChangeText={setReps} /></View>
      </View>
      <Button kind="primary" title="Save" onPress={() => onSave({ pinnedSets: num(sets, 3), pinnedReps: num(reps, 30) })} />
      <Button kind="ghost" title="Unpin both" onPress={() => onSave({ pinnedSets: undefined, pinnedReps: undefined })} />
    </Sheet>
  );
}
