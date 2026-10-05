import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { NUTRITION_CARDS, targets, type Phase } from '@/engine/nutrition.ts';
import { track, updateProfile, useData } from '@/lib/data';
import { dayLogs, deleteLog, MEALS, saveMeal, sum, type FoodLog, type Meal } from '@/lib/food';
import { Button, C, Card, Choice, s, Screen, T } from '@/ui';
import { alert, attempt } from '@/lib/alert';
import { Why, WhyBody } from '@/why';

const MEAL_NAMES: Record<Meal, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };

export default function Nutrition() {
  const { profile, refresh } = useData();
  const [logs, setLogs] = useState<FoodLog[]>([]);

  const load = useCallback(() => { dayLogs().then(setLogs).catch(() => {}); }, []);
  useFocusEffect(load);

  if (!profile) return null;
  const t = targets({
    bodyweight: Number(profile.bodyweight), unit: profile.unit, heightCm: Number(profile.height_cm),
    age: new Date().getFullYear() - profile.birth_year, sex: profile.sex, days: profile.days, phase: profile.nutrition_phase,
  });
  const eaten = sum(logs);

  async function setPhase(phase: Phase) {
    if (!(await attempt(() => updateProfile(profile!.id, { nutrition_phase: phase }), 'change the phase'))) return;
    track('nutrition_phase', { phase });
    await refresh();
  }

  function remove(l: FoodLog) {
    alert('Remove this food?', l.name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => attempt(() => deleteLog(l.id), 'remove that food').then(load) },
    ]);
  }

  async function save(meal: Meal, items: FoodLog[]) {
    const name = `${MEAL_NAMES[meal]}, ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    if (!(await attempt(() => saveMeal(name, items), 'save the meal'))) return;
    track('meal_saved');
    alert('Saved', `"${name}" is in Saved meals when you add food.`);
  }

  const bar = (label: string, have: number, goal: number, unit: string) => (
    <View style={{ gap: 4 }}>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <T muted size="sm">{label}</T>
        <T size="sm">{Math.round(have)} / {goal} {unit}</T>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: C.border, overflow: 'hidden' }}>
        <View style={{ width: `${Math.min(100, (100 * have) / Math.max(1, goal))}%`, height: 8, backgroundColor: have > goal * 1.05 ? C.warn : C.accent }} />
      </View>
    </View>
  );

  return (
    <Screen edges={['top']}>
      <T size="xl">Nutrition</T>
      <Card>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <T muted size="sm">TODAY VS TARGET</T>
          <Why e={t.explanations[0]} />
        </View>
        {bar('Calories', eaten.kcal, t.calories, 'kcal')}
        {bar('Protein', eaten.protein, t.protein, 'g')}
        {bar('Fat', eaten.fat, t.fat, 'g')}
        {bar('Carbs', eaten.carbs, t.carbs, 'g')}
      </Card>

      {MEALS.map((meal) => {
        const items = logs.filter((l) => l.meal === meal);
        return (
          <Card key={meal}>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <T bold>{MEAL_NAMES[meal]}</T>
              <T muted size="sm">{Math.round(sum(items).kcal)} kcal</T>
            </View>
            {items.map((l) => (
              <Pressable key={l.id} onLongPress={() => remove(l)} accessibilityHint="Long press to remove" style={[s.row, { justifyContent: 'space-between', minHeight: 32 }]}>
                <T muted style={{ flex: 1 }} size="sm">{l.name} · {l.grams} g</T>
                <T size="sm">{Math.round(l.kcal)} kcal</T>
              </Pressable>
            ))}
            <View style={s.row}>
              <Button title="Add food" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/food', params: { meal } })} />
              {items.length ? <Button kind="ghost" title="Save as meal" onPress={() => save(meal, items)} /> : null}
            </View>
          </Card>
        );
      })}
      {logs.length ? <T muted size="sm">Long-press a food to remove it.</T> : null}

      <T bold>Phase</T>
      <Choice value={profile.nutrition_phase} onChange={setPhase} options={[
        { value: 'gain', label: 'Gain', hint: 'About 10% above maintenance' },
        { value: 'maintain', label: 'Maintain' },
        { value: 'cut', label: 'Cut', hint: 'About 20% below maintenance' },
      ]} />

      <T size="lg">How targets are set</T>
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
    </Screen>
  );
}
