import { useState } from 'react';
import { router } from 'expo-router';
import { Modal, Pressable, View } from 'react-native';

import { EXERCISE_BY_ID } from '@/engine/exercises.ts';
import { MUSCLES, recommendSplit, SPLIT_DAYS, SPLIT_NAMES } from '@/engine/plan.ts';
import type { PlannedExercise, SplitId } from '@/engine/types.ts';
import { isDeload, localDate, saveProgram, toProfile, track, updatePlan, updateProfile, useData } from '@/lib/data';
import { Button, C, Card, Choice, Field, s, Screen, T } from '@/ui';
import { alert, attempt } from '@/lib/alert';
import { WhyBody } from '@/why';

export default function Plan() {
  const { profile, program, refresh } = useData();
  const [editing, setEditing] = useState<{ day: number; ex: number } | null>(null);
  const [schedule, setSchedule] = useState<{ days: number; split: SplitId } | null>(null);
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
      await saveProgram(toProfile({ ...profile!, days }), split, 0);
    }, 'rebuild your plan');
    if (!saved) return;
    track('schedule_changed', { days, split });
    setSchedule(null);
    await refresh();
  }

  async function savePin(pin: Pick<PlannedExercise, 'pinnedSets' | 'pinnedReps'>) {
    const { day, ex } = editing!;
    const days = plan.days.map((d, i) => i !== day ? d : {
      ...d, exercises: d.exercises.map((e, k) => (k === ex ? { ...e, pinnedSets: pin.pinnedSets, pinnedReps: pin.pinnedReps } : e)),
    });
    if (!(await attempt(() => updatePlan(program!.id, { ...plan, days }), 'save the pin'))) return;
    track('pin', { set: pin.pinnedSets !== undefined || pin.pinnedReps !== undefined });
    setEditing(null);
    await refresh();
  }

  return (
    <Screen edges={['top']}>
      <T size="xl">Your plan</T>
      <T muted>{SPLIT_NAMES[plan.split]} · {plan.days.length} days a week · {profile.session_minutes} min sessions</T>
      <T muted size="sm">Tap an exercise to pin its sets or reps.</T>

      {plan.days.map((d, i) => (
        <Card key={i} style={i === program.next_day ? { borderColor: C.accent } : undefined}>
          <T bold>{d.name}{i === program.next_day ? ' · next' : ''}</T>
          {d.exercises.map((e, k) => {
            const pinned = e.pinnedSets !== undefined || e.pinnedReps !== undefined;
            return (
              <Pressable key={e.exerciseId} accessibilityRole="button" onPress={() => setEditing({ day: i, ex: k })} style={{ minHeight: 32, justifyContent: 'center' }}>
                <T muted>
                  {pinned ? '📌 ' : ''}{EXERCISE_BY_ID[e.exerciseId].name}: {e.pinnedSets ?? e.sets} × {e.pinnedReps ?? `${e.repMin}–${e.repMax}`}
                </T>
              </Pressable>
            );
          })}
        </Card>
      ))}

      <Card>
        <T bold>Weekly sets per muscle</T>
        {MUSCLES.filter((m) => plan.weeklySets[m]).map((m) => (
          <T key={m} muted>{m[0].toUpperCase() + m.slice(1)}: {plan.weeklySets[m]}</T>
        ))}
      </Card>

      <T size="lg">Why this plan</T>
      {plan.explanations.map((e, i) => <Card key={i}><WhyBody e={e} /></Card>)}

      <Button title="The science behind RepProof" onPress={() => router.push('/science')} />
      <Button title="Edit training profile" onPress={() => router.push('/training')} />
      <Button title="Change days or split" onPress={() => setSchedule({ days: profile.days, split: plan.split })} />
      <Button title={deload ? `End deload (until ${profile.deload_until})` : 'Start a deload week'} onPress={toggleDeload} />

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        {editing ? <PinSheet e={plan.days[editing.day].exercises[editing.ex]} onSave={savePin} onClose={() => setEditing(null)} /> : null}
      </Modal>

      <Modal visible={!!schedule} transparent animationType="slide" onRequestClose={() => setSchedule(null)}>
        <Pressable style={{ flex: 1, backgroundColor: '#000a' }} onPress={() => setSchedule(null)} />
        {schedule ? (
          <Card style={sheet}>
            <T size="lg">Change schedule</T>
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
          </Card>
        ) : null}
      </Modal>
    </Screen>
  );
}

const sheet = { borderRadius: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 };

function PinSheet({ e, onSave, onClose }: { e: PlannedExercise; onSave: (p: Pick<PlannedExercise, 'pinnedSets' | 'pinnedReps'>) => void; onClose: () => void }) {
  const [sets, setSets] = useState(e.pinnedSets !== undefined ? String(e.pinnedSets) : '');
  const [reps, setReps] = useState(e.pinnedReps !== undefined ? String(e.pinnedReps) : '');
  const num = (v: string, max: number) => (v === '' ? undefined : Math.min(max, Math.max(1, Math.round(Number(v)) || 1)));
  return (
    <>
      <Pressable style={{ flex: 1, backgroundColor: '#000a' }} onPress={onClose} />
      <Card style={sheet}>
        <T size="lg">{EXERCISE_BY_ID[e.exerciseId].name}</T>
        <T muted size="sm">Pinned values stay fixed; the app keeps adjusting the weight. Leave blank to let the app decide.</T>
        <View style={s.row}>
          <View style={{ flex: 1 }}><Field label={`Sets (plan: ${e.sets})`} keyboardType="number-pad" value={sets} onChangeText={setSets} /></View>
          <View style={{ flex: 1 }}><Field label={`Reps (plan: ${e.repMin}–${e.repMax})`} keyboardType="number-pad" value={reps} onChangeText={setReps} /></View>
        </View>
        <Button kind="primary" title="Save" onPress={() => onSave({ pinnedSets: num(sets, 10), pinnedReps: num(reps, 30) })} />
        <Button kind="ghost" title="Unpin both" onPress={() => onSave({ pinnedSets: undefined, pinnedReps: undefined })} />
      </Card>
    </>
  );
}
