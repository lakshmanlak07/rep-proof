// Open Food Facts (worldwide packaged foods, ODbL licence). Plain TypeScript: no React, unit-tested.
// Mirrors the normaliser in supabase/functions/food/index.ts.

export type Macros = { kcal: number; protein: number; fat: number; carbs: number };
export type Food = {
  id: string; // USDA fdcId or Open Food Facts barcode
  source: 'usda' | 'off' | 'custom';
  name: string;
  brand: string | null;
  servingGrams: number | null;
  per100: Macros;
};

export const OFF_FIELDS = 'code,product_name,generic_name,brands,nutriments,serving_quantity,serving_quantity_unit';
export const OFF_HEADERS = { 'User-Agent': 'RepProof/1.0 (beta)' };

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** One Open Food Facts product (barcode lookup or search hit) to our Food shape; null if unusable. */
export function fromOff(p: Record<string, any> | undefined | null): Food | null {
  if (!p) return null;
  const name = String(p.product_name || p.generic_name || '').trim().slice(0, 120); // food_logs.name allows 200
  const n = p.nutriments ?? {};
  // kcal can be missing while kJ is present (1 kcal = 4.184 kJ).
  const kcal = num(n['energy-kcal_100g']) || num(n.energy_100g) / 4.184;
  const per100 = { kcal: Math.round(kcal), protein: num(n.proteins_100g), fat: num(n.fat_100g), carbs: num(n.carbohydrates_100g) };
  if (!name || !p.code || (!per100.kcal && !per100.protein && !per100.fat && !per100.carbs)) return null;
  const brands = Array.isArray(p.brands) ? p.brands[0] : String(p.brands ?? '').split(',')[0];
  const unit = String(p.serving_quantity_unit ?? 'g').toLowerCase();
  const serving = num(p.serving_quantity);
  return {
    id: String(p.code),
    source: 'off',
    name,
    brand: brands?.trim() || null,
    servingGrams: serving && (unit === 'g' || unit === 'ml') ? serving : null,
    per100,
  };
}

/** Drop repeats of the same product (same name, brand and calories). */
export function dedupe(foods: Food[]): Food[] {
  const seen = new Set<string>();
  return foods.filter((f) => {
    const key = `${f.name.toLowerCase()}|${(f.brand ?? '').toLowerCase()}|${f.per100.kcal}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
