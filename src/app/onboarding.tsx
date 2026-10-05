import { useState } from 'react';
import { View } from 'react-native';

import { recommendSplit, SPLIT_DAYS, SPLIT_NAMES } from '@/engine/plan.ts';
import type { Effort, Experience, Goal, Muscle, Pattern, Setup, SplitId, Unit } from '@/engine/types.ts';
import { ok, saveProgram, toProfile, track, useData, type ProfileRow } from '@/lib/data';
import { clearPending, getPending } from '@/lib/pending';
import { supabase } from '@/lib/supabase';
import { AVOID_OPTIONS, EFFORT_OPTIONS, EXPERIENCE_OPTIONS, GOAL_OPTIONS, MINUTE_OPTIONS, MUSCLE_OPTIONS, SETUP_OPTIONS } from '@/lib/options';
import { Button, C, Choice, Field, Screen, T } from '@/ui';

const STEPS = ['experience', 'setup', 'goal', 'days', 'minutes', 'body', 'height', 'sex', 'avoid', 'weak', 'strong', 'effort', 'split'] as const;

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
  const [cm, setCm] = useState('');
  const [ft, setFt] = useState('');
  const [inch, setInch] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | 'none' | null>(null);
  const [avoid, setAvoid] = useState<Pattern[]>([]);
  const [weak, setWeak] = useState<Muscle[]>([]);
  const [strong, setStrong] = useState<Muscle[]>([]);
  const [effort, setEffort] = useState<Effort>('last_failure');
  const [split, setSplit] = useState<SplitId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pending = getPending();
  const heightCm = unit === 'kg' ? Number(cm) : Math.round((Number(ft) * 12 + Number(inch || 0)) * 2.54);
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
        bodyweight: Number(bodyweight), height_cm: heightCm, nutrition_phase: 'maintain', sex: sex === 'none' ? null : sex, unit, avoid,
      };
      ok(await supabase.from('profiles').upsert(row));
      await saveProgram(toProfile({ ...row, plan_tier: 'free', deload_until: null }, { emphasis: { weak, strong }, effort }), chosen);
      // First point of the bodyweight trend; best effort (table arrives with migration 3).
      await supabase.from('bodyweight_logs').upsert({ weight: row.bodyweight }, { onConflict: 'user_id,logged_on' });
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
        <Choice value={experience} onChange={pick(setExperience)} options={EXPERIENCE_OPTIONS} />
      </>)}
      {name === 'setup' && (<>
        <T size="lg">Where do you train?</T>
        <Choice value={setup} onChange={pick(setSetup)} options={SETUP_OPTIONS} />
      </>)}
      {name === 'goal' && (<>
        <T size="lg">What is your main goal?</T>
        <Choice value={goal} onChange={pick(setGoal)} options={GOAL_OPTIONS} />
      </>)}
      {name === 'days' && (<>
        <T size="lg">How many days a week can you train?</T>
        <Choice value={days} onChange={pick((d: number) => { setDays(d); setSplit(recommendSplit(d)); })}
          options={[2, 3, 4, 5, 6].map((d) => ({ value: d, label: `${d} days` }))} />
      </>)}
      {name === 'minutes' && (<>
        <T size="lg">How long is each session?</T>
        <Choice value={minutes} onChange={pick(setMinutes)} options={MINUTE_OPTIONS} />
      </>)}
      {name === 'body' && (<>
        <T size="lg">Your bodyweight</T>
        <Choice value={unit} onChange={setUnit} options={[{ value: 'kg', label: 'Kilograms (kg)' }, { value: 'lb', label: 'Pounds (lb)' }]} />
        <Field keyboardType="decimal-pad" placeholder={unit === 'kg' ? 'e.g. 75' : 'e.g. 165'} value={bodyweight} onChangeText={setBodyweight} />
        <T muted size="sm">Used for progress tracking and nutrition targets. Weights in the app use this unit.</T>
        <Button kind="primary" title="Continue" disabled={!(Number(bodyweight) > 20)} onPress={next} />
      </>)}
      {name === 'height' && (<>
        <T size="lg">Your height</T>
        {unit === 'kg' ? (
          <Field keyboardType="number-pad" placeholder="cm, e.g. 178" value={cm} onChangeText={setCm} />
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Field label="Feet" keyboardType="number-pad" value={ft} onChangeText={setFt} /></View>
            <View style={{ flex: 1 }}><Field label="Inches" keyboardType="number-pad" value={inch} onChangeText={setInch} /></View>
          </View>
        )}
        <T muted size="sm">Only used to estimate your calorie target.</T>
        <Button kind="primary" title="Continue" disabled={!(heightCm >= 100 && heightCm <= 250)} onPress={next} />
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
          options={AVOID_OPTIONS} />
        <Button kind="primary" title={avoid.length ? 'Continue' : 'None, continue'} onPress={next} />
      </>)}
      {name === 'weak' && (<>
        <T size="lg">Weak points to bring up?</T>
        <T muted>These get 3 hard sets per exercise. Everything else gets 2.</T>
        <Choice value={weak} onChange={(m) => { setWeak(weak.includes(m) ? weak.filter((x) => x !== m) : [...weak, m]); setStrong(strong.filter((x) => x !== m)); }}
          options={MUSCLE_OPTIONS} />
        <Button kind="primary" title={weak.length ? 'Continue' : 'None, continue'} onPress={next} />
      </>)}
      {name === 'strong' && (<>
        <T size="lg">Strong points?</T>
        <T muted>These get 1 hard set per exercise, so your energy goes where you need it.</T>
        <Choice value={strong} onChange={(m) => setStrong(strong.includes(m) ? strong.filter((x) => x !== m) : [...strong, m])}
          options={MUSCLE_OPTIONS.filter((o) => !weak.includes(o.value))} />
        <Button kind="primary" title={strong.length ? 'Continue' : 'None, continue'} onPress={next} />
      </>)}
      {name === 'effort' && (<>
        <T size="lg">How hard should sets go?</T>
        <T muted>Getting close to failure matters; reaching it every set is optional. You can change this any time.</T>
        <Choice value={effort} onChange={pick(setEffort)} options={EFFORT_OPTIONS} />
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
