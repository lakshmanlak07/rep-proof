import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { EXERCISE_BY_ID } from '@/engine/exercises.ts';
import { e1rm } from '@/engine/decisions.ts';
import { alert, attempt } from '@/lib/alert';
import { forgetCoachNotes } from '@/lib/coach';
import { deleteWorkout, must, useData } from '@/lib/data';
import { isUuid } from '@/lib/links';
import { supabase } from '@/lib/supabase';
import { Button, C, Card, Chip, Empty, Screen, s, T } from '@/ui';

type Workout = { id: string; day_name: string; started_at: string; finished_at: string; checkin: { sleep: number; soreness: number; energy: number } | null };
type SetRow = { exercise_id: string; set_index: number; weight: number; reps: number; rir: number | null; rpe: number | null };

/** One saved workout, exactly as logged. Row-level security limits the query to the signed-in user's own rows. */
export default function WorkoutDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useData();
  const [w, setW] = useState<Workout | null | undefined>(undefined); // undefined = loading, null = not found
  const [sets, setSets] = useState<SetRow[]>([]);
  const [failed, setFailed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    // A malformed id (e.g. from a hand-typed deep link) is "not found", not a connection problem.
    if (!isUuid(id)) { setW(null); return; }
    try {
      const { data, error } = await supabase.from('workouts').select('id, day_name, started_at, finished_at, checkin').eq('id', id).maybeSingle();
      if (error) throw error;
      setW(data as Workout | null);
      if (data) {
        // rpe arrives with migration 6; before it, select without it.
        let r = await supabase.from('logged_sets').select('exercise_id, set_index, weight, reps, rir, rpe').eq('workout_id', id).order('created_at').order('set_index');
        if (r.error?.code === '42703') r = await supabase.from('logged_sets').select('exercise_id, set_index, weight, reps, rir').eq('workout_id', id).order('created_at').order('set_index') as typeof r;
        setSets((must(r) as SetRow[]).map((x) => ({ ...x, weight: Number(x.weight), rpe: x.rpe == null ? null : Number(x.rpe) })));
      }
    } catch {
      setFailed(true);
    }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  function confirmDelete() {
    alert('Delete this workout?', 'Its sets are removed from your history, progress and volume. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          if (deleting) return;
          setDeleting(true);
          // Only leave the screen once the server confirms the delete.
          const done = await attempt(() => deleteWorkout(id), 'delete the workout');
          setDeleting(false);
          if (!done) return;
          if (profile) forgetCoachNotes(profile.id, [...new Set(sets.map((x) => x.exercise_id))]);
          router.replace('/progress');
        },
      },
    ]);
  }

  const unit = profile?.unit ?? 'kg';
  if (failed) return <Screen edges={['bottom']}><Empty icon="cloud-offline-outline" title="Could not load this workout" body="Check your connection and try again." action="Try again" onAction={load} /></Screen>;
  if (w === undefined) return <Screen edges={['bottom']}><ActivityIndicator color={C.accent} /></Screen>;
  if (w === null) return <Screen edges={['bottom']}><Empty icon="search" title="Workout not found" body="It may have been deleted." action="Back to progress" onAction={() => router.replace('/progress')} /></Screen>;

  const byExercise = new Map<string, SetRow[]>();
  for (const x of sets) byExercise.set(x.exercise_id, [...(byExercise.get(x.exercise_id) ?? []), x]);
  const minutes = Math.max(1, Math.round((Date.parse(w.finished_at) - Date.parse(w.started_at)) / 60000));
  const volume = sets.reduce((a, x) => a + x.weight * x.reps, 0);

  return (
    <Screen edges={['bottom']}>
      <View style={{ gap: 4 }}>
        <T size="micro">{new Date(w.finished_at).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</T>
        <T size="xl" header>{w.day_name}</T>
      </View>
      <View style={[s.row, { alignItems: 'stretch' }]}>
        {[[`${minutes}m`, 'duration'], [String(sets.length), 'sets'], [volume >= 1000 ? `${(volume / 1000).toFixed(1)}${unit === 'kg' ? 't' : 'k'}` : String(Math.round(volume)), unit === 'kg' && volume >= 1000 ? 'volume' : `${unit} volume`]].map(([v, l]) => (
          <Card key={l} flat style={{ flex: 1, alignItems: 'center', gap: 2, padding: 14 }}>
            <T size="lg">{v}</T>
            <T size="sm" muted>{l}</T>
          </Card>
        ))}
      </View>
      {w.checkin ? <T muted size="sm">Check-in: sleep {w.checkin.sleep}/5 · soreness {w.checkin.soreness}/5 · energy {w.checkin.energy}/5</T> : null}
      {!sets.length ? <Empty icon="barbell-outline" title="No sets in this workout" body="It was saved without logged sets." /> : null}
      {[...byExercise.entries()].map(([ex, rows]) => {
        const best = Math.max(...rows.map((x) => e1rm({ weight: x.weight, reps: x.reps, rir: x.rir })));
        return (
          <Card key={ex} flat style={{ gap: 8 }}>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <T bold style={{ flex: 1 }}>{EXERCISE_BY_ID[ex]?.name ?? ex}</T>
              <Chip label={`e1RM ~${Math.round(best)} ${unit}`} />
            </View>
            {rows.map((x, k) => (
              <View key={k} style={[s.row, { justifyContent: 'space-between' }]}
                accessibilityLabel={`Set ${k + 1}: ${x.weight} ${unit} for ${x.reps} reps${x.rir != null ? `, ${x.rir} in reserve` : ''}`}>
                <T muted style={{ width: 52 }}>Set {k + 1}</T>
                <T bold style={{ flex: 1 }}>{x.weight} {unit} × {x.reps}</T>
                <T muted size="sm">{x.rpe != null ? `RPE ${x.rpe}` : x.rir != null ? `${x.rir} RIR` : ''}</T>
              </View>
            ))}
          </Card>
        );
      })}
      <T muted size="sm">Saved workouts cannot be edited, so your history and progress stay trustworthy. Logged one by mistake? Delete it. e1RM is an estimate (Epley formula).</T>
      <Button kind="ghost" title="Back to progress" onPress={() => router.back()} />
      <Button kind="danger" icon="trash-outline" title="Delete this workout" loading={deleting} onPress={confirmDelete} />
    </Screen>
  );
}
