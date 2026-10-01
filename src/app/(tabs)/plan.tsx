import { Alert } from 'react-native';

import { EXERCISE_BY_ID } from '@/engine/exercises.ts';
import { MUSCLES, SPLIT_NAMES } from '@/engine/plan.ts';
import { isDeload, localDate, track, updateProfile, useData } from '@/lib/data';
import { Button, Card, Screen, T } from '@/ui';
import { WhyBody } from '@/why';

export default function Plan() {
  const { profile, program, refresh } = useData();
  if (!profile || !program) return null;
  const { plan } = program;
  const deload = isDeload(profile.deload_until);

  function toggleDeload() {
    if (deload) return updateProfile(profile!.id, { deload_until: null }).then(refresh);
    Alert.alert('Start a deload?', 'For the next 7 days: half the sets, same weights.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start deload', onPress: async () => {
          const end = new Date();
          end.setDate(end.getDate() + 6);
          await updateProfile(profile!.id, { deload_until: localDate(end) });
          track('deload');
          await refresh();
        },
      },
    ]);
  }

  return (
    <Screen edges={['top']}>
      <T size="xl">Your plan</T>
      <T muted>{SPLIT_NAMES[plan.split]} · {plan.days.length} days a week · {profile.session_minutes} min sessions</T>

      {plan.days.map((d, i) => (
        <Card key={i} style={i === program.next_day ? { borderColor: '#C6F432' } : undefined}>
          <T bold>{d.name}{i === program.next_day ? ' · next' : ''}</T>
          {d.exercises.map((e) => (
            <T key={e.exerciseId} muted>{EXERCISE_BY_ID[e.exerciseId].name}: {e.sets} × {e.repMin}–{e.repMax}</T>
          ))}
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

      <Button title={deload ? `End deload (until ${profile.deload_until})` : 'Start a deload week'} onPress={toggleDeload} />
    </Screen>
  );
}
