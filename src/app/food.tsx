import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, View } from 'react-native';

import { track } from '@/lib/data';
import {
  addLogs, byBarcode, deleteSavedMeal, forGrams, savedMeals, searchFoods, type Food, type Meal, type SavedMeal,
} from '@/lib/food';
import { Button, C, Card, Field, s, Screen, T } from '@/ui';

export default function AddFood() {
  const { meal = 'snack' } = useLocalSearchParams<{ meal?: Meal }>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Food | null>(null);
  const [grams, setGrams] = useState('100');
  const [saved, setSaved] = useState<SavedMeal[]>([]);
  const [scanning, setScanning] = useState(false);

  useEffect(() => { savedMeals().then(setSaved).catch(() => {}); }, []);

  async function run(fn: () => Promise<Food[]>, source: string) {
    setBusy(true);
    try {
      const foods = await fn();
      setResults(foods);
      track('food_search', { source, results: foods.length });
      if (source === 'barcode' && foods.length === 1) pick(foods[0]);
    } catch {
      Alert.alert('Search failed', 'Check your connection and try again.');
    }
    setBusy(false);
  }

  function pick(f: Food) {
    setPicked(f);
    setGrams(String(f.servingGrams ?? 100));
  }

  async function add() {
    const g = Number(grams);
    await addLogs(meal, [{ fdc_id: picked!.fdcId, name: picked!.name, grams: g, ...forGrams(picked!.per100, g) }]);
    track('food_logged', { meal });
    router.back();
  }

  async function addSaved(m: SavedMeal) {
    await addLogs(meal, m.items);
    track('saved_meal_used');
    router.back();
  }

  const m = picked ? forGrams(picked.per100, Number(grams) || 0) : null;

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: `Add to ${meal}` }} />
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Field placeholder="Search foods, e.g. oats" value={query} onChangeText={setQuery} returnKeyType="search"
            onSubmitEditing={() => query.trim() && run(() => searchFoods(query), 'search')} />
        </View>
        <Button title="Scan" onPress={() => setScanning(true)} />
      </View>
      <Button kind="primary" title="Search" disabled={!query.trim()} loading={busy} onPress={() => run(() => searchFoods(query), 'search')} />

      {!results && saved.length ? (<>
        <T bold>Saved meals</T>
        {saved.map((sm) => (
          <Card key={sm.id} style={[s.row, { justifyContent: 'space-between' }]}>
            <Pressable style={{ flex: 1 }} onPress={() => addSaved(sm)} accessibilityRole="button">
              <T bold>{sm.name}</T>
              <T muted size="sm">{sm.items.length} items · {Math.round(sm.items.reduce((a, x) => a + Number(x.kcal), 0))} kcal</T>
            </Pressable>
            <Button kind="ghost" title="Delete" onPress={() => deleteSavedMeal(sm.id).then(() => savedMeals().then(setSaved))} />
          </Card>
        ))}
      </>) : null}

      {busy ? <ActivityIndicator color={C.accent} /> : null}
      {results && !results.length ? <T muted>No foods found. Try simpler words.</T> : null}
      {results?.map((f) => (
        <Pressable key={f.fdcId} onPress={() => pick(f)} accessibilityRole="button">
          <Card>
            <T bold>{f.name}</T>
            <T muted size="sm">{f.brand ? `${f.brand} · ` : ''}{Math.round(f.per100.kcal)} kcal · {f.per100.protein} g protein per 100 g</T>
          </Card>
        </Pressable>
      ))}
      <T muted size="sm">Food data: USDA FoodData Central.</T>

      <Modal visible={!!picked} transparent animationType="slide" onRequestClose={() => setPicked(null)}>
        <Pressable style={{ flex: 1, backgroundColor: '#000a' }} onPress={() => setPicked(null)} />
        {picked && m ? (
          <Card style={{ borderRadius: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 }}>
            <T size="lg">{picked.name}</T>
            <Field label={`Amount in grams${picked.servingGrams ? ` (1 serving = ${picked.servingGrams} g)` : ''}`} keyboardType="decimal-pad" value={grams} onChangeText={setGrams} />
            <T>{m.kcal} kcal · {m.protein} g protein · {m.fat} g fat · {m.carbs} g carbs</T>
            <Button kind="primary" title="Add" disabled={!(Number(grams) > 0)} onPress={add} />
          </Card>
        ) : null}
      </Modal>

      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        {scanning ? <Scanner onClose={() => setScanning(false)} onCode={(code) => { setScanning(false); run(() => byBarcode(code), 'barcode'); }} /> : null}
      </Modal>
    </Screen>
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
