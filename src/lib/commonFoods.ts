// Built-in common whole foods, searched on the device first. Plain TypeScript: unit-tested.
// Open Food Facts lists packaged products, so "apple" returns apple turnovers and "chicken" returns nuggets;
// these generic foods always answer the everyday searches, offline too, and don't depend on any API key.
// Values are typical per-100 g reference values (USDA FoodData Central, SR Legacy / Foundation), rounded;
// real foods vary, so they are labelled as approximate in the app.
import type { Food, Macros } from './off.ts';

// [name, extra search words, kcal, protein, fat, carbs] per 100 g
const ROWS: [string, string, number, number, number, number][] = [
  ['Oats, rolled, dry', 'oatmeal porridge oat', 379, 13.2, 6.5, 67.7],
  ['Apple, raw, with skin', 'apples', 52, 0.3, 0.2, 13.8],
  ['Banana, raw', 'bananas', 89, 1.1, 0.3, 22.8],
  ['Orange, raw', 'oranges', 47, 0.9, 0.1, 11.8],
  ['Strawberries, raw', 'strawberry berries', 32, 0.7, 0.3, 7.7],
  ['Blueberries, raw', 'blueberry berries', 57, 0.7, 0.3, 14.5],
  ['Grapes, raw', 'grape', 69, 0.7, 0.2, 18.1],
  ['Chicken breast, skinless, cooked', 'chicken roasted grilled', 165, 31.0, 3.6, 0],
  ['Chicken breast, skinless, raw', 'chicken', 120, 22.5, 2.6, 0],
  ['Chicken thigh, skinless, cooked', 'chicken roasted', 209, 26.0, 10.9, 0],
  ['Beef mince 90% lean, cooked', 'ground beef minced hamburger', 217, 26.1, 11.7, 0],
  ['Pork tenderloin, cooked', 'pork', 143, 26.2, 3.5, 0],
  ['Salmon, Atlantic, cooked', 'salmon fish', 206, 22.1, 12.4, 0],
  ['Tuna, canned in water, drained', 'tuna fish', 116, 25.5, 0.8, 0],
  ['Shrimp, cooked', 'prawns shrimp', 99, 24.0, 0.3, 0.2],
  ['Egg, whole, raw', 'eggs', 143, 12.6, 9.5, 0.7],
  ['Egg white, raw', 'eggs whites', 52, 10.9, 0.2, 0.7],
  ['Milk, whole (3.25%)', 'milk', 61, 3.2, 3.3, 4.8],
  ['Milk, skim', 'milk nonfat fat-free', 34, 3.4, 0.1, 5.0],
  ['Greek yogurt, plain, nonfat', 'yoghurt greek', 59, 10.2, 0.4, 3.6],
  ['Cottage cheese, 2% fat', 'cheese cottage', 81, 10.5, 2.3, 4.8],
  ['Cheddar cheese', 'cheese', 403, 24.9, 33.1, 1.3],
  ['Rice, white, cooked', 'rice', 130, 2.7, 0.3, 28.2],
  ['Rice, brown, cooked', 'rice', 123, 2.7, 1.0, 25.6],
  ['Pasta, cooked', 'spaghetti noodles', 158, 5.8, 0.9, 30.9],
  ['Quinoa, cooked', 'quinoa', 120, 4.4, 1.9, 21.3],
  ['Bread, whole wheat', 'bread wholemeal toast', 247, 13.0, 3.4, 41.3],
  ['Bread, white', 'bread toast', 266, 7.6, 3.3, 50.6],
  ['Potato, baked, with skin', 'potatoes', 93, 2.5, 0.1, 21.2],
  ['Sweet potato, baked', 'sweet potatoes yam', 90, 2.0, 0.2, 20.7],
  ['Broccoli, raw', 'broccoli', 34, 2.8, 0.4, 6.6],
  ['Spinach, raw', 'spinach', 23, 2.9, 0.4, 3.6],
  ['Carrot, raw', 'carrots', 41, 0.9, 0.2, 9.6],
  ['Tomato, raw', 'tomatoes', 18, 0.9, 0.2, 3.9],
  ['Avocado, raw', 'avocados', 160, 2.0, 14.7, 8.5],
  ['Lentils, cooked', 'lentil dal', 116, 9.0, 0.4, 20.1],
  ['Black beans, cooked', 'beans', 132, 8.9, 0.5, 23.7],
  ['Chickpeas, cooked', 'garbanzo', 164, 8.9, 2.6, 27.4],
  ['Tofu, firm', 'tofu soy', 144, 17.3, 8.7, 2.8],
  ['Peanut butter, smooth', 'peanut', 588, 25.1, 50.4, 19.6],
  ['Almonds', 'almond nuts', 579, 21.2, 49.9, 21.6],
  ['Olive oil', 'oil', 884, 0, 100, 0],
  ['Butter', 'butter', 717, 0.9, 81.1, 0.1],
  ['Honey', 'honey', 304, 0.3, 0, 82.4],
];

export const COMMON_LABEL = 'Common food · typical values';

export const COMMON_FOODS: Food[] = ROWS.map(([name, , kcal, protein, fat, carbs], i) => ({
  id: `common-${i}`, source: 'custom', name, brand: COMMON_LABEL, servingGrams: null, per100: { kcal, protein, fat, carbs } satisfies Macros,
}));
const WORDS = ROWS.map(([name, extra]) => `${name} ${extra}`.toLowerCase());

/** Foods whose name or search words start with every word typed ("chick", "oat", "rice brown"). */
export function searchCommon(query: string): Food[] {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!words.length) return [];
  return COMMON_FOODS.filter((_, i) => {
    const tokens = WORDS[i].split(/[^a-z0-9%]+/);
    return words.every((w) => tokens.some((t) => t.startsWith(w)));
  });
}
