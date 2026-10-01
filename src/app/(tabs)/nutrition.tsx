import { View } from 'react-native';

import { NUTRITION_CARDS, targets, type Phase } from '@/engine/nutrition.ts';
import { track, updateProfile, useData } from '@/lib/data';
import { Card, Choice, s, Screen, T } from '@/ui';
import { Why, WhyBody } from '@/why';

export default function Nutrition() {
  const { profile, refresh } = useData();
  if (!profile) return null;
  const t = targets({
    bodyweight: Number(profile.bodyweight), unit: profile.unit, heightCm: Number(profile.height_cm),
    age: new Date().getFullYear() - profile.birth_year, sex: profile.sex, days: profile.days, phase: profile.nutrition_phase,
  });

  async function setPhase(phase: Phase) {
    await updateProfile(profile!.id, { nutrition_phase: phase });
    track('nutrition_phase', { phase });
    await refresh();
  }

  const stat = (label: string, value: string) => (
    <View style={{ flex: 1, gap: 2 }}>
      <T muted size="sm">{label}</T>
      <T size="lg">{value}</T>
    </View>
  );

  return (
    <Screen edges={['top']}>
      <T size="xl">Nutrition</T>
      <Card>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <T muted size="sm">DAILY TARGETS</T>
          <Why e={t.explanations[0]} />
        </View>
        <View style={s.row}>
          {stat('Calories', `${t.calories}`)}
          {stat('Protein', `${t.protein} g`)}
        </View>
        <View style={s.row}>
          {stat('Fat', `${t.fat} g`)}
          {stat('Carbs', `${t.carbs} g`)}
        </View>
      </Card>

      <T bold>Phase</T>
      <Choice value={profile.nutrition_phase} onChange={setPhase} options={[
        { value: 'gain', label: 'Gain', hint: 'About 10% above maintenance' },
        { value: 'maintain', label: 'Maintain' },
        { value: 'cut', label: 'Cut', hint: 'About 20% below maintenance' },
      ]} />

      <T size="lg">How these are set</T>
      {t.explanations.map((e, i) => <Card key={i}><WhyBody e={e} /></Card>)}

      <T size="lg">Basics</T>
      {NUTRITION_CARDS.map((c) => (
        <Card key={c.title}>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <T bold>{c.title}</T>
            <Why e={c.explanation} />
          </View>
          <T muted>{c.body}</T>
        </Card>
      ))}
      <T muted size="sm">Food logging is coming in a later update.</T>
    </Screen>
  );
}
