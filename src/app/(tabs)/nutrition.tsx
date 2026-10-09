import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { NUTRITION_CARDS, targets, type Phase } from '@/engine/nutrition.ts';
import { track, updateProfile, useData } from '@/lib/data';
import { dayLogs, deleteLog, MEALS, saveMeal, sum, updateLogGrams, type FoodLog, type Meal } from '@/lib/food';
import { toGrams } from '@/lib/portion';
import { Banner, Button, C, Card, Field, Header, Press, ProgressBar, s, Screen, Segmented, Sheet, T } from '@/ui';
import { alert, attempt } from '@/lib/alert';
import { Why, WhyBody } from '@/why';

const MEAL_NAMES: Record<Meal, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };
const GOALS: { value: Phase; label: string; hint: string }[] = [
  { value: 'maintain', label: 'Maintenance', hint: 'Hold weight steady' },
  { value: 'cut', label: 'Fat loss', hint: 'About 20% below' },
  { value: 'gain', label: 'Muscle gain', hint: 'About 10% above' },
  { value: 'recomp', label: 'Recomp', hint: 'Maintenance, slower' },
];

export default function Nutrition() {
  const { profile, refresh } = useData();
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [editing, setEditing] = useState<{ id: string; grams: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<'diary' | 'targets'>('diary');

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

  const left = Math.round(t.calories - eaten.kcal);
  const tracker = NUTRITION_CARDS.find((c) => c.title.startsWith('Calories from'));
  const editLog = logs.find((l) => l.id === editing?.id) ?? null;

  // Board 06 · 01 Targets and 02 Diary. Calculation results come from the engine; this screen only shows them.
  return (
    <Screen edges={['top']}>
      <Header title="Fuel" />
      <Segmented value={view} onChange={setView} options={[{ value: 'diary', label: 'Diary' }, { value: 'targets', label: 'Targets' }]} />

      {view === 'diary' ? (<>
        <Card>
          <View style={[s.row, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <T size="xl" style={{ fontVariant: ['tabular-nums'] }}>{Math.abs(left).toLocaleString()}</T>
              <T size="sm" muted>{left >= 0 ? 'kcal left' : 'kcal over'}</T>
            </View>
            {tracker ? <Why e={tracker.explanation} /> : null}
          </View>
          <ProgressBar value={eaten.kcal} max={t.calories} tone={left < 0 ? 'warn' : 'accent'} />
          <View style={[s.row, { flexWrap: 'wrap', gap: 14 }]}>
            <T size="sm" muted><T size="sm" bold>{Math.round(eaten.protein)}</T>/{t.protein} P</T>
            <T size="sm" muted><T size="sm" bold>{Math.round(eaten.carbs)}</T>/{t.carbs} C</T>
            <T size="sm" muted><T size="sm" bold>{Math.round(eaten.fat)}</T>/{t.fat} F</T>
          </View>
          {failed ? <Banner tone="danger" text="Could not load today's foods. Switch tabs and come back to retry." /> : null}
        </Card>

        {MEALS.map((meal) => {
          const items = logs.filter((l) => l.meal === meal);
          return (
            <View key={meal} style={{ gap: 8 }}>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <T bold>{MEAL_NAMES[meal]} <T size="sm" muted>{items.length ? `${Math.round(sum(items).kcal)} kcal` : 'Nothing yet'}</T></T>
                <Button kind="secondary" size="sm" icon="add" title="Add" onPress={() => router.push({ pathname: '/food', params: { meal } })} />
              </View>
              {items.length ? (
                <Card flat style={{ gap: 0, paddingVertical: 4 }}>
                  {items.map((l, k) => (
                    <Pressable key={l.id} onPress={() => setEditing({ id: l.id, grams: String(l.grams) })} onLongPress={() => remove(l)} accessibilityRole="button"
                      accessibilityLabel={`${l.name}, ${l.grams} grams, ${Math.round(l.kcal)} kilocalories`} accessibilityHint="Tap to change the amount or remove"
                      style={[s.row, { justifyContent: 'space-between', minHeight: 52, borderTopWidth: k ? 1 : 0, borderTopColor: C.border }]}>
                      <View style={{ flex: 1 }}>
                        <T numberOfLines={1}>{l.name}</T>
                        <T size="sm" muted>{l.grams} g · {Math.round(Number(l.protein))} g protein</T>
                      </View>
                      <T bold style={{ fontVariant: ['tabular-nums'] }}>{Math.round(l.kcal)}</T>
                    </Pressable>
                  ))}
                  {items.length ? <Button kind="ghost" size="sm" title="Save as meal" onPress={() => save(meal, items)} /> : null}
                </Card>
              ) : null}
            </View>
          );
        })}
        {logs.length ? <T muted size="sm">Tap a food to change the amount or remove it.</T> : null}
      </>) : (<>
        <Card style={{ alignItems: 'center', gap: 4 }}>
          <T size="sm" muted>Daily calories (estimate)</T>
          <T size="display" style={{ fontVariant: ['tabular-nums'] }}>{t.calories.toLocaleString()}</T>
          <Why e={t.explanations[0]} />
        </Card>

        <T bold>Goal</T>
        <View style={[s.row, { flexWrap: 'wrap' }]}>
          {GOALS.map((g) => {
            const on = profile.nutrition_phase === g.value;
            return (
              <Press key={g.value} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setPhase(g.value)} scaleTo={0.97}
                style={{ flexBasis: '47%', flexGrow: 1, minHeight: 56, borderRadius: 16, borderWidth: 1.5, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10,
                  borderColor: on ? C.accent : C.border, backgroundColor: on ? C.accentSoft : C.card }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? C.accent : C.faint, alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: C.accent }} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <T bold>{g.label}</T>
                  <T size="sm" muted>{g.hint}</T>
                </View>
              </Press>
            );
          })}
        </View>

        <T bold>Macros</T>
        <Card flat>
          {([['Protein', t.protein, 4], ['Carbs', t.carbs, 4], ['Fat', t.fat, 9]] as const).map(([label, g, per]) => (
            <View key={label} style={[s.row, { gap: 12 }]} accessibilityLabel={`${label} ${g} grams, ${Math.round((100 * g * per) / t.calories)} percent of calories`}>
              <T bold style={{ width: 64 }}>{label}</T>
              <View style={{ flex: 1 }}><ProgressBar value={g * per} max={t.calories} /></View>
              <T bold style={{ width: 56, textAlign: 'right' }}>{g} g</T>
            </View>
          ))}
        </Card>
        <Banner tone="accent" text="These are estimates. Adjust after 2 to 3 weeks of weight trend." />

        <T size="lg">How targets are set</T>
        {t.explanations.map((e, i) => <Card key={i} flat><WhyBody e={e} /></Card>)}

        <T size="lg">Basics</T>
        {NUTRITION_CARDS.map((c) => (
          <Card key={c.title} flat>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <T bold style={{ flex: 1 }}>{c.title}</T>
              <Why e={c.explanation} />
            </View>
            <T muted>{c.body}</T>
          </Card>
        ))}
      </>)}

      {/* Board 06 · 05 Edit and delete a log */}
      <Sheet visible={!!editLog} onClose={() => setEditing(null)} title="Edit entry">
        {editLog && editing ? (<>
          <T size="sm" muted>{editLog.name} · {MEAL_NAMES[editLog.meal]}</T>
          <Field label="Amount (g)" keyboardType="decimal-pad" value={editing.grams} onChangeText={(g) => setEditing({ id: editLog.id, grams: g })} />
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <T muted>New total</T>
            <T size="lg">{(() => { const g = toGrams(Number(editing.grams), 'g', null); return g ? `${Math.round((Number(editLog.kcal) * g) / editLog.grams)} kcal` : '–'; })()}</T>
          </View>
          <Button kind="primary" title="Save changes" onPress={() => saveAmount(editLog, editing.grams)} />
          <Button kind="ghost" title="Remove this entry from today" icon="trash-outline" onPress={() => remove(editLog)} />
        </>) : null}
      </Sheet>
    </Screen>
  );
}
