import { useRef, useState } from 'react';
import { View } from 'react-native';

import type { Coverage, Effort, Experience, Goal, Muscle, Pattern, Setup } from '@/engine/types.ts';
import { attempt } from '@/lib/alert';
import { reportError } from '@/lib/crash';
import { saveProgram, toProfile, track, updateProfile, useData, type ProfileRow } from '@/lib/data';
import { leave } from '@/lib/nav';
import { AVOID_OPTIONS, COVERAGE_OPTIONS, EFFORT_OPTIONS, EXPERIENCE_OPTIONS, GOAL_OPTIONS, MINUTE_OPTIONS, MUSCLE_OPTIONS, SETUP_OPTIONS } from '@/lib/options';
import { once } from '@/lib/workoutSave';
import { Button, Choice, Loading, Screen, T } from '@/ui';

// Edit what onboarding asked (days and split live on the Plan tab). Saving rebuilds the plan.
export default function Training() {
  const { profile, program } = useData();
  // useState below seeds from the loaded data once; mounting before it arrives would leave the spinner up for good.
  return profile && program ? <TrainingForm key={program.id} /> : <Loading />;
}

function TrainingForm() {
  const { profile, program, refresh } = useData();
  const [experience, setExperience] = useState<Experience | undefined>(profile?.experience);
  const [setup, setSetup] = useState<Setup | undefined>(profile?.setup);
  const [goal, setGoal] = useState<Goal | undefined>(profile?.goal);
  const [minutes, setMinutes] = useState<number | undefined>(profile?.session_minutes);
  const [avoid, setAvoid] = useState<Pattern[]>(profile?.avoid ?? []);
  const [weak, setWeak] = useState<Muscle[]>(program?.plan.emphasis?.weak ?? []);
  const [strong, setStrong] = useState<Muscle[]>(program?.plan.emphasis?.strong ?? []);
  const [effort, setEffort] = useState<Effort>(program?.plan.effort ?? 'last_failure');
  const [coverage, setCoverage] = useState<Coverage>(program?.plan.coverage ?? 'muscle');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false); // single-flight: a double tap must not rebuild the plan twice

  if (!profile || !program || !experience || !setup || !goal || !minutes) return <Loading />;

  const save = () => once(saving, saveNow);
  async function saveNow() {
    if (!profile || !program || !experience || !setup || !goal || !minutes) return;
    const patch: Partial<ProfileRow> = { experience, setup, goal, session_minutes: minutes, avoid };
    const next = { ...profile, ...patch };
    const split = program.split;
    const nextDay = program.next_day;
    setBusy(true);
    const saved = await attempt(async () => {
      await updateProfile(profile.id, patch);
      // Logged weights carry over: suggestions read history by exercise, not by program.
      // Profile and plan must agree: if the rebuild fails, undo the profile change before reporting the failure.
      try {
        await saveProgram(toProfile(next, { emphasis: { weak, strong }, effort, coverage }), split, nextDay);
      } catch (e) {
        const { experience: e0, setup: s0, goal: g0, session_minutes: m0, avoid: a0 } = profile;
        await updateProfile(profile.id, { experience: e0, setup: s0, goal: g0, session_minutes: m0, avoid: a0 }).catch((err) => reportError(err, 'profile_revert'));
        throw e;
      }
    }, 'update your training profile');
    setBusy(false);
    if (!saved) return;
    track('training_profile_changed', { experience, setup, goal, minutes, effort, coverage, avoid: avoid.length, weak: weak.length, strong: strong.length });
    await refresh();
    leave();
  }

  return (
    <Screen edges={['bottom']}>
      <T muted>Saving rebuilds your plan. Logged weights carry over; pinned sets and reps reset.</T>
      <T bold header>Experience</T>
      <Choice value={experience} onChange={setExperience} options={EXPERIENCE_OPTIONS} />
      <T bold header>Where you train</T>
      <Choice value={setup} onChange={setSetup} options={SETUP_OPTIONS} />
      <T bold header>Goal</T>
      <Choice value={goal} onChange={setGoal} options={GOAL_OPTIONS} />
      <T bold header>Session length</T>
      <Choice value={minutes} onChange={setMinutes} options={MINUTE_OPTIONS} />
      <T bold header>How hard sets go</T>
      <Choice value={effort} onChange={setEffort} options={EFFORT_OPTIONS} />
      <T bold header>Exercises per muscle</T>
      <Choice value={coverage} onChange={setCoverage} options={COVERAGE_OPTIONS} />
      <T bold header>Weak points (3 sets per exercise)</T>
      <Choice value={weak} onChange={(m) => { setWeak(weak.includes(m) ? weak.filter((x) => x !== m) : [...weak, m]); setStrong(strong.filter((x) => x !== m)); }} options={MUSCLE_OPTIONS} />
      <T bold header>Strong points (1 set per exercise)</T>
      <Choice value={strong} onChange={(m) => setStrong(strong.includes(m) ? strong.filter((x) => x !== m) : [...strong, m])} options={MUSCLE_OPTIONS.filter((o) => !weak.includes(o.value))} />
      <T bold header>Movements to leave out</T>
      <Choice value={avoid} onChange={(p) => setAvoid(avoid.includes(p) ? avoid.filter((x) => x !== p) : [...avoid, p])} options={AVOID_OPTIONS} />
      <View style={{ height: 8 }} />
      <Button kind="primary" title="Save and rebuild plan" loading={busy} onPress={save} />
      <Button kind="ghost" title="Cancel" onPress={leave} />
    </Screen>
  );
}
