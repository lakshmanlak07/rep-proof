import { useState } from 'react';
import { View } from 'react-native';

import { AVOIDABLE } from '@/engine/exercises.ts';
import { recommendSplit, SPLIT_DAYS, SPLIT_NAMES } from '@/engine/plan.ts';
import type { Experience, Goal, Pattern, Setup, SplitId, Unit } from '@/engine/types.ts';
import { must, saveProgram, toProfile, track, useData, type ProfileRow } from '@/lib/data';
import { clearPending, getPending } from '@/lib/pending';
import { supabase } from '@/lib/supabase';
import { Button, C, Choice, Field, Screen, T } from '@/ui';

const STEPS = ['experience', 'setup', 'goal', 'days', 'minutes', 'body', 'sex', 'avoid', 'split'] as const;

export default function Onboarding() {
  const { session, refresh } = useData();
  const [step, setStep] = useState(0);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [unit, setUnit] = useState<Unit>('kg');
  const [bodyweight, setBodyweight] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | 'none' | null>(null);
  const [avoid, setAvoid] = useState<Pattern[]>([]);
  const [split, setSplit] = useState<SplitId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pending = getPending();
  const name = STEPS[step];
  const next = () => setStep(step + 1);
  const pick = <V,>(set: (v: V) => void) => (v: V) => { set(v); next(); }; // one tap per screen

  async function finish(chosen: SplitId) {
    if (!session || !pending?.disclaimerAt) return;
    setBusy(true);
    try {
      const row: Omit<ProfileRow, 'plan_tier' | 'deload_until'> = {
        id: session.user.id,
        birth_year: pending.birthYear,
        disclaimer_accepted_at: pending.disclaimerAt,
        experience: experience!, goal: goal!, setup: setup!, days: days!, session_minutes: minutes!,
        bodyweight: Number(bodyweight), sex: sex === 'none' ? null : sex, unit, avoid,
      };
      must(await supabase.from('profiles').upsert(row));
      await saveProgram(toProfile({ ...row, plan_tier: 'free', deload_until: null }), chosen);
      clearPending();
      track('onboarding_done', { experience, setup, goal, days, split: chosen });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setBusy(false);
    }
  }

  if (!pending?.disclaimerAt) {
    return (
      <Screen>
        <T size="lg">Confirm your age first</T>
        <T muted>We need your birth year and disclaimer confirmation on this device before building your plan.</T>
        <Button kind="primary" title="Continue" onPress={() => supabase.auth.signOut()} />
      </Screen>
    );
  }

  const back = step > 0 ? <Button kind="ghost" title="Back" onPress={() => setStep(step - 1)} /> : null;
  const progress = <T muted size="sm">Step {step + 1} of {STEPS.length}</T>;

  return (
    <Screen>
      {progress}
      {name === 'experience' && (<>
        <T size="lg">How long have you been lifting consistently?</T>
        <Choice value={experience} onChange={pick(setExperience)} options={[
          { value: 'beginner', label: 'Beginner', hint: 'Under about a year' },
          { value: 'intermediate', label: 'Intermediate', hint: '1 to 3 years' },
          { value: 'advanced', label: 'Advanced', hint: 'More than 3 years' },
        ]} />
      </>)}
      {name === 'setup' && (<>
        <T size="lg">Where do you train?</T>
        <Choice value={setup} onChange={pick(setSetup)} options={[
          { value: 'commercial', label: 'Commercial gym', hint: 'Machines, cables, free weights' },
          { value: 'home', label: 'Home gym', hint: 'Barbell, rack, dumbbells, bench' },
        ]} />
      </>)}
      {name === 'goal' && (<>
        <T size="lg">What is your main goal?</T>
        <Choice value={goal} onChange={pick(setGoal)} options={[
          { value: 'muscle', label: 'Build muscle' },
          { value: 'strength', label: 'Get stronger' },
          { value: 'both', label: 'Both' },
        ]} />
      </>)}
      {name === 'days' && (<>
        <T size="lg">How many days a week can you train?</T>
        <Choice value={days} onChange={pick((d: number) => { setDays(d); setSplit(recommendSplit(d)); })}
          options={[2, 3, 4, 5, 6].map((d) => ({ value: d, label: `${d} days` }))} />
      </>)}
      {name === 'minutes' && (<>
        <T size="lg">How long is each session?</T>
        <Choice value={minutes} onChange={pick(setMinutes)} options={[30, 45, 60, 75, 90].map((m) => ({ value: m, label: `${m} minutes` }))} />
      </>)}
      {name === 'body' && (<>
        <T size="lg">Your bodyweight</T>
        <Choice value={unit} onChange={setUnit} options={[{ value: 'kg', label: 'Kilograms (kg)' }, { value: 'lb', label: 'Pounds (lb)' }]} />
        <Field keyboardType="decimal-pad" placeholder={unit === 'kg' ? 'e.g. 75' : 'e.g. 165'} value={bodyweight} onChangeText={setBodyweight} />
        <T muted size="sm">Used for progress tracking and nutrition targets. Weights in the app use this unit.</T>
        <Button kind="primary" title="Continue" disabled={!(Number(bodyweight) > 20)} onPress={next} />
      </>)}
      {name === 'sex' && (<>
        <T size="lg">Sex (optional)</T>
        <T muted>Only used for starting-weight wording and nutrition formulas.</T>
        <Choice value={sex} onChange={pick(setSex)} options={[
          { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'none', label: 'Prefer not to say' },
        ]} />
      </>)}
      {name === 'avoid' && (<>
        <T size="lg">Any movements to leave out?</T>
        <T muted>Tick any you want out of your plan. You can change this later.</T>
        <Choice value={avoid} onChange={(p) => setAvoid(avoid.includes(p) ? avoid.filter((x) => x !== p) : [...avoid, p])}
          options={AVOIDABLE.map((a) => ({ value: a.pattern, label: a.label }))} />
        <Button kind="primary" title={avoid.length ? 'Continue' : 'None, continue'} onPress={next} />
      </>)}
      {name === 'split' && days && (<>
        <T size="lg">Your split</T>
        <T muted>Recommended for {days} days a week. When weekly sets are equal, how often you train each muscle makes little difference, so pick what fits your week.</T>
        <Choice value={split} onChange={setSplit} options={(Object.keys(SPLIT_DAYS) as SplitId[])
          .filter((sp) => SPLIT_DAYS[sp].includes(days))
          .map((sp) => ({ value: sp, label: SPLIT_NAMES[sp], hint: sp === recommendSplit(days) ? 'Recommended' : undefined }))} />
        {error ? <T style={{ color: C.danger }}>{error}</T> : null}
        <Button kind="primary" title="Build my plan" loading={busy} disabled={!split} onPress={() => finish(split!)} />
      </>)}
      <View style={{ flex: 1 }} />
      {back}
    </Screen>
  );
}
