import { CameraView, useCameraPermissions } from 'expo-camera';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Linking, Modal, Pressable, View } from 'react-native';

import { alert, attempt } from '@/lib/alert';
import { track } from '@/lib/data';
import {
  FoodError, MEALS, addLogs, byBarcode, deleteSavedMeal, fdcIdOf, forGrams, recentFoods, savedMeals, searchFoods, type Food, type Meal, type SavedMeal,
} from '@/lib/food';
import { leave } from '@/lib/nav';
import { sourceLabel, toGrams, type PortionUnit } from '@/lib/portion';
import { once, toNumber } from '@/lib/workoutSave';
import { Banner, Button, C, Card, Chip, Field, s, Screen, Segmented, Sheet, T } from '@/ui';

export default function AddFood() {
  const { meal: rawMeal } = useLocalSearchParams<{ meal?: string }>();
  const meal: Meal = (MEALS as readonly string[]).includes(rawMeal ?? '') ? (rawMeal as Meal) : 'snack';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[] | null>(null);
  const [notFound, setNotFound] = useState('');
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Food | null>(null);
  const [amount, setAmount] = useState('100');
  const [unit, setUnit] = useState<PortionUnit>('g');
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState<SavedMeal[]>([]);
  const [recent, setRecent] = useState<Food[]>([]);
  const [scanning, setScanning] = useState(false);
  const [custom, setCustom] = useState(false);
  const [mealChoice, setMealChoice] = useState<Meal>(meal);

  useEffect(() => {
    savedMeals().then(setSaved).catch(() => {});
    recentFoods().then(setRecent).catch(() => {});
  }, []);

  const searchId = useRef(0);
  async function run(fn: () => Promise<{ foods: Food[]; onlineError?: string | null }>, source: 'search' | 'barcode') {
    const mine = ++searchId.current;
    setBusy(true);
    setNotFound('');
    setNotice('');
    try {
      const { foods, onlineError } = await fn();
      if (mine !== searchId.current) return; // a newer search replaced this one
      if (onlineError) setNotice(`${onlineError} Showing common foods only.`);
      setResults(foods);
      track('food_search', { source, results: foods.length });
      if (source === 'barcode' && foods.length === 1) pick(foods[0]);
      if (!foods.length) setNotFound(source === 'barcode' ? 'That barcode is not in the food databases yet.' : 'No foods found. Try simpler words.');
      AccessibilityInfo.announceForAccessibility(foods.length ? `${foods.length} result${foods.length > 1 ? 's' : ''}` : 'No results');
    } catch (e) {
      if (mine !== searchId.current) return;
      alert('Search failed', e instanceof FoodError ? e.message : 'Check your connection and try again.');
    } finally {
      if (mine === searchId.current) setBusy(false);
    }
  }

  function pick(f: Food) {
    setPicked(f);
    setUnit(f.servingGrams ? 'serving' : 'g');
    setAmount(f.servingGrams ? '1' : '100');
  }

  // Single-flight: a double tap (or a tap while the insert is in flight) must not log the food twice.
  const adding = useRef(false);
  const [saving, setSaving] = useState(false);
  const save = (fn: () => Promise<void>) => once(adding, async () => { setSaving(true); try { await fn(); } finally { setSaving(false); } });

  const log = (food: Food, g: number) => save(async () => {
    if (!(await attempt(() => addLogs(mealChoice, [{ fdc_id: fdcIdOf(food), name: food.name, grams: g, ...forGrams(food.per100, g) }]), 'add that food'))) return;
    track('food_logged', { meal: mealChoice, source: food.source });
    AccessibilityInfo.announceForAccessibility(`${food.name} added to ${MEAL_LABEL[mealChoice]}`);
    leave();
  });

  const addSaved = (m: SavedMeal) => save(async () => {
    if (!(await attempt(() => addLogs(meal, m.items), 'add that meal'))) return;
    track('saved_meal_used');
    leave();
  });

  function removeSaved(sm: SavedMeal) {
    alert('Delete this saved meal?', `"${sm.name}" is removed from Saved meals. Foods already logged stay in your diary.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => attempt(() => deleteSavedMeal(sm.id), 'delete that meal').then(() => savedMeals().then(setSaved).catch(() => {})) },
    ]);
  }

  const grams = picked ? toGrams(toNumber(amount), unit, picked.servingGrams) : null;
  const m = picked ? forGrams(picked.per100, grams ?? 0) : null;
  const search = () => {
    if (query.trim()) run(() => searchFoods(query.trim()), 'search');
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: `Add to ${MEAL_LABEL[meal]}` }} />
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Field placeholder="Search foods, e.g. oats" accessibilityLabel="Search foods" value={query} onChangeText={setQuery} maxLength={100} returnKeyType="search" onSubmitEditing={search} />
        </View>
        <Button kind="primary" size="sm" icon="search" title="Search" disabled={!query.trim()} loading={busy} onPress={search} style={{ minHeight: 52 }} />
      </View>
      <Button kind="secondary" size="sm" icon="barcode-outline" title="Scan a barcode" onPress={() => setScanning(true)} />

      {busy ? <ActivityIndicator color={C.accent} /> : null}
      {notice ? <Banner text={notice} /> : null}
      {notFound ? (
        <Card>
          <T>{notFound}</T>
          <Button title="Add it as a custom food" onPress={() => setCustom(true)} />
        </Card>
      ) : null}
      {results ? GROUPS.map((g) => {
        const rows = results.filter(g.match);
        return rows.length ? (
          <View key={g.title} style={{ gap: 6 }}>
            <T size="micro">{g.title}</T>
            <Card flat style={{ gap: 0, paddingVertical: 4 }}>
              {rows.map((f, k) => (
                <Pressable key={`${f.source}-${f.id}-${f.name}`} onPress={() => pick(f)} accessibilityRole="button" accessibilityLabel={`${f.name}, ${Math.round(f.per100.kcal)} kilocalories per 100 grams, ${sourceLabel(f)}`}
                  style={[s.row, { minHeight: 56, paddingVertical: 8, borderTopWidth: k ? 1 : 0, borderTopColor: C.border }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T bold numberOfLines={2}>{f.name}</T>
                    <T muted size="sm" numberOfLines={2}>{f.brand && f.source !== 'custom' ? `${f.brand} · ` : ''}{Math.round(f.per100.kcal)} kcal · {Math.round(f.per100.protein * 10) / 10} g protein per 100 g</T>
                  </View>
                  <SourceBadge f={f} />
                </Pressable>
              ))}
            </Card>
          </View>
        ) : null;
      }) : null}

      {!results && recent.length ? (<>
        <T bold>Recent</T>
        {recent.map((f) => (
          <Pressable key={f.name} onPress={() => pick(f)} accessibilityRole="button">
            <Card style={[s.row, { justifyContent: 'space-between' }]}>
              <T style={{ flex: 1 }}>{f.name}</T>
              <T muted size="sm">{f.servingGrams} g · {forGrams(f.per100, f.servingGrams ?? 100).kcal.toLocaleString()} kcal</T>
            </Card>
          </Pressable>
        ))}
      </>) : null}

      {!results && saved.length ? (<>
        <T bold>Saved meals</T>
        {saved.map((sm) => (
          <Card key={sm.id} style={[s.row, { justifyContent: 'space-between' }]}>
            <Pressable style={{ flex: 1 }} onPress={() => addSaved(sm)} accessibilityRole="button">
              <T bold>{sm.name}</T>
              <T muted size="sm">{sm.items.length} item{sm.items.length === 1 ? '' : 's'} · {Math.round(sm.items.reduce((a, x) => a + Number(x.kcal), 0)).toLocaleString()} kcal</T>
            </Pressable>
            <Button kind="ghost" title="Delete" label={`Delete saved meal ${sm.name}`} onPress={() => removeSaved(sm)} />
          </Card>
        ))}
      </>) : null}

      <Button kind="ghost" title={"Can't find it? Add a custom food"} onPress={() => setCustom(true)} />
      <T muted size="sm">Food data: built-in common foods (typical USDA reference values), USDA FoodData Central (public domain) and Open Food Facts (ODbL). Check labels; databases can contain errors.</T>

      <Sheet visible={!!picked} onClose={() => setPicked(null)} title={picked?.name}>
        {picked && m ? (<>
          <View style={[s.row, { flexWrap: 'wrap', gap: 8 }]}>
            <SourceBadge f={picked} />
            <T size="sm" muted>per 100 g: {Math.round(picked.per100.kcal)} kcal{picked.brand && picked.source !== 'custom' ? ` · ${picked.brand}` : ''}</T>
          </View>
          <Field label={unit === 'g' ? 'Amount (g)' : unit === 'oz' ? 'Amount (oz)' : 'Servings'} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
          <Segmented value={unit} onChange={setUnit} options={[
            { value: 'g', label: 'Grams' },
            { value: 'oz', label: 'Ounces' },
            ...(picked.servingGrams ? [{ value: 'serving' as const, label: `Serving (${picked.servingGrams} g)` }] : []),
          ]} />
          <T bold>Meal</T>
          <Segmented value={mealChoice} onChange={setMealChoice} options={MEALS.map((x) => ({ value: x, label: MEAL_LABEL[x] }))} />
          <View style={[s.row, { backgroundColor: C.accentSoft, borderRadius: 16, padding: 14, justifyContent: 'space-between' }]}
            accessibilityLabel={`${grams ?? 0} grams: ${m.kcal} kilocalories, ${m.protein} grams protein, ${m.carbs} grams carbs, ${m.fat} grams fat`}>
            {([['Kcal', `${m.kcal}`], ['Protein', `${m.protein} g`], ['Carbs', `${m.carbs} g`], ['Fat', `${m.fat} g`]] as const).map(([l, v]) => (
              <View key={l} style={{ gap: 2 }}>
                <T size="micro">{l}</T>
                <T size="lg">{v}</T>
              </View>
            ))}
          </View>
          <Button kind="primary" title={`Add to ${MEAL_LABEL[mealChoice]}`} disabled={!grams} loading={saving} onPress={() => grams && log(picked, grams)} />
        </>) : null}
      </Sheet>

      <Sheet visible={custom} onClose={() => setCustom(false)} title="Custom food">
        {custom ? <CustomFood initialName={query} saving={saving} onCancel={() => setCustom(false)} onAdd={(f, g) => log(f, g)} /> : null}
      </Sheet>

      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        {scanning ? <Scanner onClose={() => setScanning(false)} onCode={(code) => { setScanning(false); run(async () => ({ foods: await byBarcode(code) }), 'barcode'); }} /> : null}
      </Modal>
    </Screen>
  );
}

const MEAL_LABEL: Record<Meal, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
const isCommon = (f: Food) => f.source === 'custom' && f.id.startsWith('common-');
const GROUPS: { title: string; match: (f: Food) => boolean }[] = [
  { title: 'Common foods', match: (f) => isCommon(f) || f.source === 'usda' },
  { title: 'Packaged', match: (f) => f.source === 'off' },
  { title: 'My foods', match: (f) => f.source === 'custom' && !isCommon(f) },
];
/** Source badge (Board 02): text label chip for where a food's numbers come from. */
function SourceBadge({ f }: { f: Food }) {
  const short = f.source === 'usda' ? 'USDA' : f.source === 'off' ? 'Open Food Facts' : isCommon(f) ? 'Common food' : 'Custom';
  return <Chip label={short} tone={f.source === 'off' ? 'warn' : 'neutral'} />;
}

/** Anything missing from the databases: macros for the amount eaten. Shows up under Recent afterwards. */
function CustomFood({ initialName, onAdd, onCancel, saving }: { initialName: string; onAdd: (f: Food, grams: number) => void; onCancel: () => void; saving: boolean }) {
  const [name, setName] = useState(initialName);
  const [grams, setGrams] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const g = toNumber(grams);
  // Blank macros count as 0 g (the user did not enter them); anything entered must be a real, non-negative number.
  const okMacro = (v: string) => v.trim() === '' || (Number.isFinite(Number(v)) && Number(v) >= 0);
  const valid = name.trim().length > 1 && g > 0 && g <= 10000 && kcal.trim() !== '' && okMacro(kcal) && okMacro(protein) && okMacro(fat) && okMacro(carbs);
  const per100 = (v: string) => (Number(v) || 0) * (100 / g);
  return (
    <>
      <Field label="Name" value={name} onChangeText={setName} maxLength={80} />
      <View style={s.row}>
        <View style={{ flex: 1 }}><Field label="Amount (g)" keyboardType="decimal-pad" value={grams} onChangeText={setGrams} /></View>
        <View style={{ flex: 1 }}><Field label="Calories" keyboardType="decimal-pad" value={kcal} onChangeText={setKcal} /></View>
      </View>
      <View style={s.row}>
        <View style={{ flex: 1 }}><Field label="Protein g" keyboardType="decimal-pad" value={protein} onChangeText={setProtein} /></View>
        <View style={{ flex: 1 }}><Field label="Fat g" keyboardType="decimal-pad" value={fat} onChangeText={setFat} /></View>
        <View style={{ flex: 1 }}><Field label="Carbs g" keyboardType="decimal-pad" value={carbs} onChangeText={setCarbs} /></View>
      </View>
      <Button kind="primary" title="Add" disabled={!valid} loading={saving} onPress={() => onAdd({
        id: '0', source: 'custom', name: name.trim(), brand: null, servingGrams: g,
        per100: { kcal: per100(kcal), protein: per100(protein), fat: per100(fat), carbs: per100(carbs) },
      }, g)} />
      <Button kind="ghost" title="Cancel" onPress={onCancel} />
    </>
  );
}

function Scanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const done = useRef(false);
  if (!permission) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (!permission.granted) {
    return (
      <Screen>
        <T size="lg">Camera access</T>
        <T muted>RepProof uses the camera only to read food barcodes.</T>
        {permission.canAskAgain ? <Button kind="primary" title="Allow camera" onPress={requestPermission} /> : (<>
          {/* Denied for good: the system will not ask again, so the only way is the phone's settings. */}
          <T>Camera access is turned off for RepProof. Turn it on in your phone settings, or search for the food instead.</T>
          <Button kind="primary" title="Open settings" onPress={() => Linking.openSettings().catch(() => {})} />
        </>)}
        <Button kind="ghost" title="Cancel" onPress={onClose} />
      </Screen>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView style={{ flex: 1 }} barcodeScannerSettings={{ barcodeTypes: ['upc_a', 'upc_e', 'ean13', 'ean8'] }}
        onBarcodeScanned={({ data }) => {
          if (done.current) return; // the camera fires repeatedly; take the first read
          done.current = true;
          onCode(data);
        }} />
      <View style={{ position: 'absolute', bottom: 40, left: 20, right: 20, gap: 10 }}>
        <View style={{ alignSelf: 'center', backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 }}>
          <T bold>Point at the barcode</T>
        </View>
        <Button title="Cancel" onPress={onClose} />
      </View>
    </View>
  );
}
