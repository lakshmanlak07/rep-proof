import { localDate, must, ok } from './data';
import { dedupe, fromOff, OFF_FIELDS, OFF_HEADERS, type Food, type Macros } from './off';
import { supabase } from './supabase';

export type { Food, Macros };
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type FoodLog = Macros & { id: string; meal: Meal; fdc_id: number; name: string; grams: number };
export type SavedMeal = { id: string; name: string; items: Omit<FoodLog, 'id' | 'meal'>[] };

export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export function forGrams(per100: Macros, grams: number): Macros {
  const f = grams / 100;
  const r = (x: number) => Math.round(x * f * 10) / 10;
  return { kcal: Math.round(per100.kcal * f), protein: r(per100.protein), fat: r(per100.fat), carbs: r(per100.carbs) };
}

export function sum(rows: Macros[]): Macros {
  return rows.reduce((a, x) => ({ kcal: a.kcal + Number(x.kcal), protein: a.protein + Number(x.protein), fat: a.fat + Number(x.fat), carbs: a.carbs + Number(x.carbs) }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0 });
}

class NotDeployed extends Error {}

/** The `food` edge function: USDA + Open Food Facts merged server-side, USDA key kept on the server. */
async function callFood(body: { query?: string; upc?: string }): Promise<Food[]> {
  const { data, error } = await supabase.functions.invoke('food', { body });
  if (error) {
    // FunctionsHttpError carries the HTTP response; network failures have none.
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 404) throw new NotDeployed();
    if (status === 429) throw new Error('Food search is busy right now. Try again in a minute.');
    if (status) throw new Error('Food search had a problem. Try again shortly.');
    throw new Error('Could not reach food search. Check your connection and try again.');
  }
  return (data?.foods ?? []) as Food[];
}

async function offSearch(query: string): Promise<Food[]> {
  const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(query)}&page_size=30&fields=${OFF_FIELDS}`;
  const res = await fetch(url, { headers: OFF_HEADERS });
  if (!res.ok) throw new Error('Food search had a problem. Try again shortly.');
  const data = await res.json();
  return dedupe(((data.hits ?? []) as Record<string, unknown>[]).map(fromOff).filter((f): f is Food => !!f));
}

async function offBarcode(code: string): Promise<Food[]> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`, { headers: OFF_HEADERS });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error('Barcode lookup had a problem. Try again shortly.');
  const food = fromOff((await res.json()).product);
  return food ? [food] : [];
}

/** Search every source we have; works before the edge function is deployed (Open Food Facts direct). */
export async function searchFoods(query: string): Promise<Food[]> {
  try {
    return await callFood({ query });
  } catch (e) {
    if (!(e instanceof NotDeployed)) throw e;
    return offSearch(query);
  }
}

/** Packaged foods: Open Food Facts first (worldwide), then USDA branded foods via the edge function. */
export async function byBarcode(code: string): Promise<Food[]> {
  const off = await offBarcode(code).catch(() => [] as Food[]);
  if (off.length) return off;
  return callFood({ upc: code }).catch(() => []);
}

/** fdc_id column: USDA id for USDA foods, 0 for Open Food Facts and custom foods. */
export const fdcIdOf = (f: Food) => (f.source === 'usda' ? Number(f.id) || 0 : 0);

/** Foods this user logged recently, newest first, one per name: one tap to log again. */
export async function recentFoods(): Promise<Food[]> {
  const rows = must(await supabase.from('food_logs').select('fdc_id, name, grams, kcal, protein, fat, carbs').order('created_at', { ascending: false }).limit(60));
  const seen = new Set<string>();
  const foods: Food[] = [];
  for (const r of rows) {
    const g = Number(r.grams);
    if (seen.has(r.name) || !(g > 0)) continue;
    seen.add(r.name);
    const k = 100 / g;
    foods.push({
      id: String(r.fdc_id), source: r.fdc_id ? 'usda' : 'custom', name: r.name, brand: null, servingGrams: g,
      per100: { kcal: Math.round(Number(r.kcal) * k), protein: Number(r.protein) * k, fat: Number(r.fat) * k, carbs: Number(r.carbs) * k },
    });
    if (foods.length === 15) break;
  }
  return foods;
}

export async function dayLogs(day = localDate()): Promise<FoodLog[]> {
  const rows = must(await supabase.from('food_logs').select('id, meal, fdc_id, name, grams, kcal, protein, fat, carbs').eq('logged_on', day).order('created_at'));
  return rows.map((r) => ({ ...r, grams: Number(r.grams), kcal: Number(r.kcal), protein: Number(r.protein), fat: Number(r.fat), carbs: Number(r.carbs) })) as FoodLog[];
}

export async function addLogs(meal: Meal, items: Omit<FoodLog, 'id' | 'meal'>[], day = localDate()) {
  ok(await supabase.from('food_logs').insert(items.map((x) => ({ ...x, meal, logged_on: day }))));
}

export async function deleteLog(id: string) {
  ok(await supabase.from('food_logs').delete().eq('id', id));
}

export async function savedMeals(): Promise<SavedMeal[]> {
  return must(await supabase.from('saved_meals').select('id, name, items').order('created_at', { ascending: false })) as SavedMeal[];
}

export async function saveMeal(name: string, logs: FoodLog[]) {
  const items = logs.map(({ fdc_id, name, grams, kcal, protein, fat, carbs }) => ({ fdc_id, name, grams, kcal, protein, fat, carbs }));
  ok(await supabase.from('saved_meals').insert({ name, items }));
}

export async function deleteSavedMeal(id: string) {
  ok(await supabase.from('saved_meals').delete().eq('id', id));
}
