import { useState } from 'react';
import { View } from 'react-native';

import type { Experience, Goal, Pattern, Setup } from '@/engine/types.ts';
import { attempt } from '@/lib/alert';
import { saveProgram, toProfile, track, updateProfile, useData, type ProfileRow } from '@/lib/data';
import { leave } from '@/lib/nav';
import { AVOID_OPTIONS, EXPERIENCE_OPTIONS, GOAL_OPTIONS, MINUTE_OPTIONS, SETUP_OPTIONS } from '@/lib/options';
import { Button, Choice, Loading, Screen, T } from '@/ui';

// Edit what onboarding asked (days and split live on the Plan tab). Saving rebuilds the plan.
export default function Training() {
  const { profile, program, refresh } = useData();
  const [experience, setExperience] = useState<Experience | undefined>(profile?.experience);
  const [setup, setSetup] = useState<Setup | undefined>(profile?.setup);
  const [goal, setGoal] = useState<Goal | undefined>(profile?.goal);
  const [minutes, setMinutes] = useState<number | undefined>(profile?.session_minutes);
  const [avoid, setAvoid] = useState<Pattern[]>(profile?.avoid ?? []);
  const [busy, setBusy] = useState(false);

  if (!profile || !program || !experience || !setup || !goal || !minutes) return <Loading />;

  async function save() {
    if (!profile || !program || !experience || !setup || !goal || !minutes) return;
    const patch: Partial<ProfileRow> = { experience, setup, goal, session_minutes: minutes, avoid };
    const next = { ...profile, ...patch };
    const split = program.split;
    const nextDay = program.next_day;
    setBusy(true);
    const saved = await attempt(async () => {
      await updateProfile(profile.id, patch);
      // Logged weights carry over: suggestions read history by exercise, not by program.
      await saveProgram(toProfile(next), split, nextDay);
    }, 'update your training profile');
    setBusy(false);
    if (!saved) return;
    track('training_profile_changed', { experience, setup, goal, minutes, avoid: avoid.length });
    await refresh();
    leave();
  }

  return (
    <Screen edges={['bottom']}>
      <T muted>Saving rebuilds your plan. Logged weights carry over; pinned sets and reps reset.</T>
      <T bold>Experience</T>
      <Choice value={experience} onChange={setExperience} options={EXPERIENCE_OPTIONS} />
      <T bold>Where you train</T>
      <Choice value={setup} onChange={setSetup} options={SETUP_OPTIONS} />
      <T bold>Goal</T>
      <Choice value={goal} onChange={setGoal} options={GOAL_OPTIONS} />
      <T bold>Session length</T>
      <Choice value={minutes} onChange={setMinutes} options={MINUTE_OPTIONS} />
      <T bold>Movements to leave out</T>
      <Choice value={avoid} onChange={(p) => setAvoid(avoid.includes(p) ? avoid.filter((x) => x !== p) : [...avoid, p])} options={AVOID_OPTIONS} />
      <View style={{ height: 8 }} />
      <Button kind="primary" title="Save and rebuild plan" loading={busy} onPress={save} />
      <Button kind="ghost" title="Cancel" onPress={leave} />
    </Screen>
  );
}
