import { useEffect, useRef, useState } from 'react';
import { BackHandler, View } from 'react-native';

import { recommendSplit, SPLIT_DAYS, SPLIT_NAMES } from '@/engine/plan.ts';
import type { Coverage, Effort, Experience, Goal, Muscle, Pattern, Setup, SplitId, Unit } from '@/engine/types.ts';
import { localDate, ok, saveProgram, toProfile, track, useData, type ProfileRow } from '@/lib/data';
import { clearPending, DISCLAIMER, getPending, isAdult, setPending } from '@/lib/pending';
import { supabase } from '@/lib/supabase';
import { AVOID_OPTIONS, COVERAGE_OPTIONS, EFFORT_OPTIONS, EXPERIENCE_OPTIONS, GOAL_OPTIONS, MINUTE_OPTIONS, MUSCLE_OPTIONS, SETUP_OPTIONS } from '@/lib/options';
import { friendlyError } from '@/lib/alert';
import { once } from '@/lib/workoutSave';
import { Banner, Button, Card, Choice, ErrorText, Field, IconTile, Reveal, Screen, StepProgress, T } from '@/ui';

const STEPS = ['experience', 'setup', 'goal', 'days', 'minutes', 'body', 'height', 'sex', 'avoid', 'weak', 'strong', 'effort', 'coverage', 'split'] as const;

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
  const [coverage, setCoverage] = useState<Coverage>('muscle');
  const [split, setSplit] = useState<SplitId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [built, setBuilt] = useState(false);
  const building = useRef(false); // single-flight: a double tap must not create the profile and plan twice
  const [, rerender] = useState(0); // age check writes device storage; re-read it after

  const pending = getPending();
  const heightCm = unit === 'kg' ? Number(cm) : Math.round((Number(ft) * 12 + Number(inch || 0)) * 2.54);
  const name = STEPS[step];
  const next = () => setStep(step + 1);
  const pick = <V,>(set: (v: V) => void) => (v: V) => { set(v); next(); }; // one tap per screen
  // Android Back goes to the previous step; on the first step it leaves as usual.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 0 || built) return false;
      setStep(step - 1);
      return true;
    });
    return () => sub.remove();
  }, [step, built]);

  const finish = (chosen: SplitId) => once(building, () => finishNow(chosen));
  async function finishNow(chosen: SplitId) {
    if (!session || !pending?.disclaimerAt) return;
    setBusy(true);
    setError('');
    try {
      const row: Omit<ProfileRow, 'plan_tier' | 'deload_until'> = {
        id: session.user.id,
        birth_year: pending.birthYear,
        disclaimer_accepted_at: pending.disclaimerAt,
        experience: experience!, goal: goal!, setup: setup!, days: days!, session_minutes: minutes!,
        bodyweight: Number(bodyweight), height_cm: heightCm, nutrition_phase: 'maintain', sex: sex === 'none' ? null : sex, unit, avoid,
      };
      ok(await supabase.from('profiles').upsert(row));
      await saveProgram(toProfile({ ...row, plan_tier: 'free', deload_until: null }, { emphasis: { weak, strong }, effort, coverage }), chosen);
      // First point of the bodyweight trend; best effort.
      await supabase.from('bodyweight_logs').upsert({ weight: row.bodyweight, logged_on: localDate() }, { onConflict: 'user_id,logged_on' });
      clearPending();
      track('onboarding_done', { experience, setup, goal, days, split: chosen });
      setBusy(false);
      setBuilt(true); // the plan reveal screen calls refresh() to enter the app
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  if (built) {
    return (
      <Screen scroll={false}>
        <View style={{ flexGrow: 1, justifyContent: 'center', gap: 20 }}>
          <Reveal>
            <View style={{ gap: 14 }}>
              <IconTile name="barbell-outline" size={56} />
              <T size="micro">Your RepProof plan</T>
              <T size="xl" header>Your starting plan is ready.</T>
              <T muted>Based on your goals, availability and training experience, we&apos;ve built your starting plan. It adapts as you log sessions, and every change comes with the reason.</T>
            </View>
          </Reveal>
          <Card>
            <T bold>{split ? SPLIT_NAMES[split] : ''} · {days} days a week</T>
            <T muted>{minutes} minute sessions · {setup === 'home' ? 'home gym' : 'full gym'} · {experience}</T>
          </Card>
        </View>
        <Button kind="primary" title="View my plan" onPress={() => refresh()} />
      </Screen>
    );
  }

  // Signed in without the pre-sign-up age check (returning user on a new phone, or phone sign-up): do it here.
  // After the plan-ready screen: saving clears the age data, which must not bring the age check back (BUG-20).
  if (!pending?.disclaimerAt) return <AgeCheck onDone={() => rerender((x) => x + 1)} />;

  const progress = <StepProgress step={step + 1} total={STEPS.length} onBack={step > 0 ? () => setStep(step - 1) : undefined} />;
  return (
    <Screen>
      {progress}
      {name === 'experience' && (<>
        <T size="xl" header>How long have you been lifting consistently?</T>
        <Choice value={experience} onChange={pick(setExperience)} options={EXPERIENCE_OPTIONS} />
      </>)}
      {name === 'setup' && (<>
        <T size="xl" header>Where do you train?</T>
        <Choice value={setup} onChange={pick(setSetup)} options={SETUP_OPTIONS} />
      </>)}
      {name === 'goal' && (<>
        <T size="xl" header>What is your main goal?</T>
        <Choice value={goal} onChange={pick(setGoal)} options={GOAL_OPTIONS} />
      </>)}
      {name === 'days' && (<>
        <T size="xl" header>How many days a week can you train?</T>
        <Choice value={days} onChange={pick((d: number) => { setDays(d); setSplit(recommendSplit(d)); })}
          options={[2, 3, 4, 5, 6].map((d) => ({ value: d, label: `${d} days a week`, icon: 'calendar' as const, hint: ['Short on time', 'A balanced week', 'Room for more frequency', 'Serious commitment', 'Near-daily training'][d - 2] }))} />
      </>)}
      {name === 'minutes' && (<>
        <T size="xl" header>How long is each session?</T>
        <Choice value={minutes} onChange={pick(setMinutes)} options={MINUTE_OPTIONS.map((m) => ({ ...m, icon: 'time' as const }))} />
      </>)}
      {name === 'body' && (<>
        <T size="xl" header>Your bodyweight</T>
        <Choice value={unit} onChange={setUnit} options={[{ value: 'kg', label: 'Kilograms (kg)' }, { value: 'lb', label: 'Pounds (lb)' }]} />
        <Field keyboardType="decimal-pad" accessibilityLabel={`Bodyweight in ${unit === 'kg' ? 'kilograms' : 'pounds'}`} placeholder={unit === 'kg' ? 'e.g. 75' : 'e.g. 165'} value={bodyweight} onChangeText={setBodyweight} />
        <T muted size="sm">Used for progress tracking and nutrition targets. Weights in the app use this unit.</T>
        <Button kind="primary" title="Continue" disabled={!(Number(bodyweight) > 20 && Number(bodyweight) <= 700)} onPress={next} />
      </>)}
      {name === 'height' && (<>
        <T size="xl" header>Your height</T>
        {unit === 'kg' ? (
          <Field keyboardType="number-pad" accessibilityLabel="Height in centimetres" placeholder="cm, e.g. 178" value={cm} onChangeText={setCm} />
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
        <T size="xl" header>Sex (optional)</T>
        <T muted>Only used for starting-weight wording and nutrition formulas.</T>
        <Choice value={sex} onChange={pick(setSex)} options={[
          { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'none', label: 'Prefer not to say' },
        ]} />
      </>)}
      {name === 'avoid' && (<>
        <T size="xl" header>Any movements to leave out?</T>
        <T muted>Tick any you want out of your plan. You can change this later.</T>
        <Choice value={avoid} onChange={(p) => setAvoid(avoid.includes(p) ? avoid.filter((x) => x !== p) : [...avoid, p])}
          options={AVOID_OPTIONS} />
        <Button kind="primary" title={avoid.length ? 'Continue' : 'None, continue'} onPress={next} />
      </>)}
      {name === 'weak' && (<>
        <T size="xl" header>Weak points to bring up?</T>
        <T muted>These get 3 hard sets per exercise when your session length allows. Everything else gets 2.</T>
        <Choice value={weak} onChange={(m) => { setWeak(weak.includes(m) ? weak.filter((x) => x !== m) : [...weak, m]); setStrong(strong.filter((x) => x !== m)); }}
          options={MUSCLE_OPTIONS} />
        <Button kind="primary" title={weak.length ? 'Continue' : 'None, continue'} onPress={next} />
      </>)}
      {name === 'strong' && (<>
        <T size="xl" header>Strong points?</T>
        <T muted>These get 1 hard set per exercise, so your energy goes where you need it.</T>
        <Choice value={strong} onChange={(m) => setStrong(strong.includes(m) ? strong.filter((x) => x !== m) : [...strong, m])}
          options={MUSCLE_OPTIONS.filter((o) => !weak.includes(o.value))} />
        <Button kind="primary" title={strong.length ? 'Continue' : 'None, continue'} onPress={next} />
      </>)}
      {name === 'effort' && (<>
        <T size="xl" header>How hard should sets go?</T>
        <T muted>Getting close to failure matters; reaching it every set is optional. You can change this any time.</T>
        <Choice value={effort} onChange={pick(setEffort)} options={EFFORT_OPTIONS} />
      </>)}
      {name === 'coverage' && (<>
        <T size="xl" header>One exercise per muscle, or every region?</T>
        <T muted>Some muscles grow unevenly: an incline press works the upper chest more, overhead extensions the triceps long head. You can change this any time.</T>
        <Choice value={coverage} onChange={pick(setCoverage)} options={COVERAGE_OPTIONS.map((o) => (o.value === 'regions' && minutes && minutes <= 60
          ? { ...o, hint: `${o.hint} At ${minutes} minutes, sets are cut to 1 before a region is skipped; 75 or 90 minutes allow full sets.` }
          : o))} />
      </>)}
      {name === 'split' && days && (<>
        <T size="xl" header>Your split</T>
        <T muted>Recommended for {days} days a week. When weekly sets are equal, how often you train each muscle makes little difference, so pick what fits your week.</T>
        <Choice value={split} onChange={setSplit} options={(Object.keys(SPLIT_DAYS) as SplitId[])
          .filter((sp) => SPLIT_DAYS[sp].includes(days))
          .map((sp) => ({ value: sp, label: SPLIT_NAMES[sp], hint: sp === recommendSplit(days) ? 'Recommended' : undefined }))} />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button kind="primary" title="Build my plan" loading={busy} disabled={!split} onPress={() => finish(split!)} />
      </>)}
    </Screen>
  );
}

function AgeCheck({ onDone }: { onDone: () => void }) {
  const [year, setYear] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const y = Number(year);
  const valid = year.length === 4 && y > 1900 && y <= new Date().getFullYear();

  async function confirm() {
    if (!isAdult(y)) {
      // Under 18: remove the account that was just created; nothing else was stored.
      setBusy(true);
      setFailed(false);
      const { error } = await supabase.rpc('delete_account').then((r) => r, () => ({ error: true }));
      if (error) {
        setBusy(false);
        setFailed(true); // stay here: the account still exists, so the person can retry
        return;
      }
      clearPending();
      await supabase.auth.signOut({ scope: 'local' });
      return;
    }
    setPending({ birthYear: y, disclaimerAt: new Date().toISOString() });
    onDone();
  }

  return (
    <Screen>
      <T size="lg">Before we build your plan</T>
      <Field label="What year were you born?" keyboardType="number-pad" maxLength={4} placeholder="e.g. 1998" value={year} onChangeText={setYear} />
      <T muted size="sm">RepProof is for adults 18 and over.</T>
      <Card><T>{DISCLAIMER}</T></Card>
      {failed ? <Banner tone="danger" text="We could not remove the account just created. Check your connection and try again." /> : null}
      <Button kind="primary" title="I understand, continue" loading={busy} disabled={!valid} onPress={confirm} />
    </Screen>
  );
}
