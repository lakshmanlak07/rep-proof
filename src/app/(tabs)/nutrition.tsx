import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { NUTRITION_CARDS, targets, type Phase } from '@/engine/nutrition.ts';
import { track, updateProfile, useData } from '@/lib/data';
import { dayLogs, deleteLog, MEALS, saveMeal, sum, updateLogGrams, type FoodLog, type Meal } from '@/lib/food';
import { toGrams } from '@/lib/portion';
import { Button, C, Card, Choice, Field, s, Screen, T } from '@/ui';
import { alert, attempt } from '@/lib/alert';
import { Why, WhyBody } from '@/why';

const MEAL_NAMES: Record<Meal, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };

export default function Nutrition() {
  const { profile, refresh } = useData();
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [editing, setEditing] = useState<{ id: string; grams: string } | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    dayLogs().then((l) => { setLogs(l); setFailed(false); }).catch(() => setFailed(true));
  }, []);
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
      { text: 'Remove', style: 'destructive', onPress: () => attempt(() => deleteLog(l.id), 'remove that food').then(() => { setEditing(null); load(); }) },
    ]);
  }

  async function saveAmount(l: FoodLog, text: string) {
    const g = toGrams(Number(text), 'g', null);
    if (!g) return alert('Check the amount', 'Enter grams between 1 and 10000.');
    if (!(await attempt(() => updateLogGrams(l, g), 'change that food'))) return;
    setEditing(null);
    load();
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
        {failed ? <T style={{ color: C.danger }} size="sm">{"Could not load today's foods. Switch tabs and come back to retry."}</T> : null}
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
            {items.map((l) => editing?.id === l.id ? (
              <View key={l.id} style={{ gap: 8 }}>
                <T size="sm">{l.name}</T>
                <Field label="Amount (g)" keyboardType="decimal-pad" value={editing.grams} onChangeText={(g) => setEditing({ id: l.id, grams: g })} />
                <View style={s.row}>
                  <Button kind="primary" title="Save" style={{ flex: 1 }} onPress={() => saveAmount(l, editing.grams)} />
                  <Button kind="danger" title="Remove" onPress={() => remove(l)} />
                  <Button kind="ghost" title="Cancel" onPress={() => setEditing(null)} />
                </View>
              </View>
            ) : (
              <Pressable key={l.id} onPress={() => setEditing({ id: l.id, grams: String(l.grams) })} onLongPress={() => remove(l)} accessibilityRole="button" accessibilityHint="Tap to change the amount or remove" style={[s.row, { justifyContent: 'space-between', minHeight: 32 }]}>
                <T muted style={{ flex: 1 }} size="sm">{l.name} · {l.grams} g</T>
                <T size="sm">{Math.round(l.kcal)} kcal · {Math.round(Number(l.protein))} g P</T>
              </Pressable>
            ))}
            <View style={s.row}>
              <Button title="Add food" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/food', params: { meal } })} />
              {items.length ? <Button kind="ghost" title="Save as meal" onPress={() => save(meal, items)} /> : null}
            </View>
          </Card>
        );
      })}
      {logs.length ? <T muted size="sm">Tap a food to change the amount or remove it.</T> : null}

      <T bold>Goal</T>
      <Choice value={profile.nutrition_phase} onChange={setPhase} options={[
        { value: 'gain', label: 'Muscle gain', hint: 'About 10% above maintenance' },
        { value: 'maintain', label: 'Maintenance' },
        { value: 'cut', label: 'Fat loss', hint: 'About 20% below maintenance' },
        { value: 'recomp', label: 'Recomp', hint: 'Maintenance calories, train hard; slower change' },
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
