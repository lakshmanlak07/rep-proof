import { localDate, must } from './data';
import { supabase } from './supabase';

// Shape returned by the `food` edge function (USDA values per 100 g).
export type Food = { fdcId: number; name: string; brand: string | null; servingGrams: number | null; per100: Macros };
export type Macros = { kcal: number; protein: number; fat: number; carbs: number };
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

async function callFood(body: { query?: string; upc?: string }): Promise<Food[]> {
  const { data, error } = await supabase.functions.invoke('food', { body });
  if (error) throw error;
  return data.foods as Food[];
}
export const searchFoods = (query: string) => callFood({ query });
export const byBarcode = (upc: string) => callFood({ upc });

export async function dayLogs(day = localDate()): Promise<FoodLog[]> {
  const rows = must(await supabase.from('food_logs').select('id, meal, fdc_id, name, grams, kcal, protein, fat, carbs').eq('logged_on', day).order('created_at'));
  return rows.map((r) => ({ ...r, grams: Number(r.grams), kcal: Number(r.kcal), protein: Number(r.protein), fat: Number(r.fat), carbs: Number(r.carbs) })) as FoodLog[];
}

export async function addLogs(meal: Meal, items: Omit<FoodLog, 'id' | 'meal'>[], day = localDate()) {
  must(await supabase.from('food_logs').insert(items.map((x) => ({ ...x, meal, logged_on: day }))));
}

export async function deleteLog(id: string) {
  must(await supabase.from('food_logs').delete().eq('id', id));
}

export async function savedMeals(): Promise<SavedMeal[]> {
  return must(await supabase.from('saved_meals').select('id, name, items').order('created_at', { ascending: false })) as SavedMeal[];
}

export async function saveMeal(name: string, logs: FoodLog[]) {
  const items = logs.map(({ fdc_id, name, grams, kcal, protein, fat, carbs }) => ({ fdc_id, name, grams, kcal, protein, fat, carbs }));
  must(await supabase.from('saved_meals').insert({ name, items }));
}

export async function deleteSavedMeal(id: string) {
  must(await supabase.from('saved_meals').delete().eq('id', id));
}
