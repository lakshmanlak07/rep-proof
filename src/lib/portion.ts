// Serving units, food source labels and log edits. Plain TypeScript: unit-tested.
import type { Food, Macros } from './off.ts';

export type PortionUnit = 'g' | 'oz' | 'serving';

/**
 * Calories and protein per calendar day for the last `days` days (oldest first, today last). Days with no
 * entries are reported as logged: false, never as zero eaten, so a trend never invents a fasting day.
 */
export function dailyTotals(rows: { logged_on: string; kcal: number; protein: number }[], days: number, today: Date) {
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const out = Array.from({ length: days }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1 - i));
    return { day: key(d), kcal: 0, protein: 0, logged: false };
  });
  for (const r of rows) {
    const x = out.find((o) => o.day === r.logged_on);
    if (!x) continue;
    x.kcal += Number(r.kcal);
    x.protein += Number(r.protein);
    x.logged = true;
  }
  return out.map((o) => ({ ...o, kcal: Math.round(o.kcal), protein: Math.round(o.protein) }));
}
export const GRAMS_PER_OZ = 28.3495;
export const MAX_GRAMS = 10000; // food_logs.grams limit (migration 2)

/** Grams for an amount in a unit, or null when it can't be logged (no serving size, out of range). */
export function toGrams(amount: number, unit: PortionUnit, servingGrams: number | null): number | null {
  if (!(amount > 0)) return null;
  const g = unit === 'g' ? amount : unit === 'oz' ? amount * GRAMS_PER_OZ : servingGrams ? amount * servingGrams : NaN;
  if (!(g > 0) || g > MAX_GRAMS) return null;
  return Math.round(g * 10) / 10;
}

/** Where a food's numbers come from, shown next to every result. */
export function sourceLabel(f: Food): string {
  if (f.source === 'usda') return 'USDA FoodData Central';
  if (f.source === 'off') return 'Open Food Facts';
  return f.id.startsWith('common-') ? 'Common food · typical values' : 'Your custom food';
}

/** A logged food at a new amount: totals scale with the grams (the log stores totals, not per-100 g). */
export function rescale(log: Macros & { grams: number }, grams: number): Macros & { grams: number } {
  if (!(Number(log.grams) > 0)) return { ...log, grams };
  const k = grams / log.grams;
  const r = (x: number) => Math.round(Number(x) * k * 10) / 10;
  return { grams, kcal: Math.round(Number(log.kcal) * k), protein: r(log.protein), fat: r(log.fat), carbs: r(log.carbs) };
}
