import { CameraView, useCameraPermissions } from 'expo-camera';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';

import { alert, attempt } from '@/lib/alert';
import { track } from '@/lib/data';
import {
  FoodError, addLogs, byBarcode, deleteSavedMeal, fdcIdOf, forGrams, recentFoods, savedMeals, searchFoods, type Food, type Meal, type SavedMeal,
} from '@/lib/food';
import { leave } from '@/lib/nav';
import { Button, C, Card, Field, s, Screen, T } from '@/ui';

export default function AddFood() {
  const { meal = 'snack' } = useLocalSearchParams<{ meal?: Meal }>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[] | null>(null);
  const [notFound, setNotFound] = useState('');
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Food | null>(null);
  const [grams, setGrams] = useState('100');
  const [saved, setSaved] = useState<SavedMeal[]>([]);
  const [recent, setRecent] = useState<Food[]>([]);
  const [scanning, setScanning] = useState(false);
  const [custom, setCustom] = useState(false);

  useEffect(() => {
    savedMeals().then(setSaved).catch(() => {});
    recentFoods().then(setRecent).catch(() => {});
  }, []);

  async function run(fn: () => Promise<Food[]>, source: 'search' | 'barcode') {
    setBusy(true);
    setNotFound('');
    try {
      const foods = await fn();
      setResults(foods);
      track('food_search', { source, results: foods.length });
      if (source === 'barcode' && foods.length === 1) pick(foods[0]);
      if (!foods.length) setNotFound(source === 'barcode' ? 'That barcode is not in the food databases yet.' : 'No foods found. Try simpler words.');
    } catch (e) {
      alert('Search failed', e instanceof FoodError ? e.message : 'Check your connection and try again.');
    }
    setBusy(false);
  }

  function pick(f: Food) {
    setPicked(f);
    setGrams(String(f.servingGrams ?? 100));
  }

  async function log(food: Food, g: number) {
    if (!(await attempt(() => addLogs(meal, [{ fdc_id: fdcIdOf(food), name: food.name, grams: g, ...forGrams(food.per100, g) }]), 'add that food'))) return;
    track('food_logged', { meal, source: food.source });
    leave();
  }

  async function addSaved(m: SavedMeal) {
    if (!(await attempt(() => addLogs(meal, m.items), 'add that meal'))) return;
    track('saved_meal_used');
    leave();
  }

  const m = picked ? forGrams(picked.per100, Number(grams) || 0) : null;
  const search = () => {
    if (query.trim()) run(() => searchFoods(query.trim()), 'search');
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: `Add to ${meal}` }} />
      <Button kind="primary" title="Scan a barcode" onPress={() => setScanning(true)} />
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Field placeholder="Search any food, e.g. oats" value={query} onChangeText={setQuery} maxLength={100} returnKeyType="search" onSubmitEditing={search} />
        </View>
        <Button title="Search" disabled={!query.trim()} loading={busy} onPress={search} />
      </View>

      {busy ? <ActivityIndicator color={C.accent} /> : null}
      {notFound ? (
        <Card>
          <T>{notFound}</T>
          <Button title="Add it as a custom food" onPress={() => setCustom(true)} />
        </Card>
      ) : null}
      {results?.map((f) => (
        <Pressable key={`${f.source}-${f.id}-${f.name}`} onPress={() => pick(f)} accessibilityRole="button">
          <Card>
            <T bold>{f.name}</T>
            <T muted size="sm">{f.brand ? `${f.brand} · ` : ''}{Math.round(f.per100.kcal)} kcal · {Math.round(f.per100.protein * 10) / 10} g protein per 100 g</T>
          </Card>
        </Pressable>
      ))}

      {!results && recent.length ? (<>
        <T bold>Recent</T>
        {recent.map((f) => (
          <Pressable key={f.name} onPress={() => pick(f)} accessibilityRole="button">
            <Card style={[s.row, { justifyContent: 'space-between' }]}>
              <T style={{ flex: 1 }}>{f.name}</T>
              <T muted size="sm">{f.servingGrams} g · {forGrams(f.per100, f.servingGrams ?? 100).kcal} kcal</T>
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
              <T muted size="sm">{sm.items.length} items · {Math.round(sm.items.reduce((a, x) => a + Number(x.kcal), 0))} kcal</T>
            </Pressable>
            <Button kind="ghost" title="Delete" onPress={() => attempt(() => deleteSavedMeal(sm.id), 'delete that meal').then(() => savedMeals().then(setSaved).catch(() => {}))} />
          </Card>
        ))}
      </>) : null}

      <Button kind="ghost" title={"Can't find it? Add a custom food"} onPress={() => setCustom(true)} />
      <T muted size="sm">Food data: USDA FoodData Central (public domain) and Open Food Facts (ODbL). Check labels; databases can contain errors.</T>

      <Modal visible={!!picked} transparent animationType="slide" onRequestClose={() => setPicked(null)}>
        <Pressable style={{ flex: 1, backgroundColor: '#000a' }} onPress={() => setPicked(null)} />
        {picked && m ? (
          <Card style={sheet}>
            <T size="lg">{picked.name}</T>
            {picked.brand ? <T muted size="sm">{picked.brand}</T> : null}
            <Field label="Amount (grams)" keyboardType="decimal-pad" value={grams} onChangeText={setGrams} />
            <View style={s.row}>
              {picked.servingGrams ? <Button title={`1 serving (${picked.servingGrams} g)`} onPress={() => setGrams(String(picked.servingGrams))} /> : null}
              <Button title="100 g" onPress={() => setGrams('100')} />
            </View>
            <T>{m.kcal} kcal · {m.protein} g protein · {m.fat} g fat · {m.carbs} g carbs</T>
            <Button kind="primary" title="Add" disabled={!(Number(grams) > 0 && Number(grams) <= 10000)} onPress={() => log(picked, Number(grams))} />
          </Card>
        ) : null}
      </Modal>

      <Modal visible={custom} transparent animationType="slide" onRequestClose={() => setCustom(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#000a' }} onPress={() => setCustom(false)} />
        {custom ? <CustomFood initialName={query} onCancel={() => setCustom(false)} onAdd={(f, g) => { setCustom(false); log(f, g); }} /> : null}
      </Modal>

      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        {scanning ? <Scanner onClose={() => setScanning(false)} onCode={(code) => { setScanning(false); run(() => byBarcode(code), 'barcode'); }} /> : null}
      </Modal>
    </Screen>
  );
}

const sheet = { borderRadius: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 };

/** Anything missing from the databases: macros for the amount eaten. Shows up under Recent afterwards. */
function CustomFood({ initialName, onAdd, onCancel }: { initialName: string; onAdd: (f: Food, grams: number) => void; onCancel: () => void }) {
  const [name, setName] = useState(initialName);
  const [grams, setGrams] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const g = Number(grams);
  const valid = name.trim().length > 1 && g > 0 && g <= 10000 && kcal !== '' && Number(kcal) >= 0;
  const per100 = (v: string) => (Number(v) || 0) * (100 / g);
  return (
    <Card style={sheet}>
      <T size="lg">Custom food</T>
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
      <Button kind="primary" title="Add" disabled={!valid} onPress={() => onAdd({
        id: '0', source: 'custom', name: name.trim(), brand: null, servingGrams: g,
        per100: { kcal: per100(kcal), protein: per100(protein), fat: per100(fat), carbs: per100(carbs) },
      }, g)} />
      <Button kind="ghost" title="Cancel" onPress={onCancel} />
    </Card>
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
        <Button kind="primary" title="Allow camera" onPress={requestPermission} />
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
        <T style={{ textAlign: 'center' }}>Point at the barcode</T>
        <Button title="Cancel" onPress={onClose} />
      </View>
    </View>
  );
}
