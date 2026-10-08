// Food search: built-in common foods. Run with `npm test`.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { targets } from '../engine/nutrition.ts';
import { COMMON_FOODS, COMMON_LABEL, searchCommon } from './commonFoods.ts';
import { rescale, sourceLabel, toGrams } from './portion.ts';

test('everyday searches return selectable generic foods', () => {
  assert.equal(searchCommon('oats')[0].name, 'Oats, rolled, dry');
  assert.equal(searchCommon('apple')[0].name, 'Apple, raw, with skin');
  assert.ok(searchCommon('chicken').some((f) => f.name === 'Chicken breast, skinless, cooked'));
  assert.ok(searchCommon('chick').length >= 3, 'prefixes work while typing');
  assert.deepEqual(searchCommon('rice brown').map((f) => f.name), ['Rice, brown, cooked']);
  assert.ok(searchCommon('OATMEAL').length === 1, 'case and synonyms');
  assert.deepEqual(searchCommon(''), []);
  assert.deepEqual(searchCommon('xyzzy'), []);
});

test('common foods are labelled and loggable', () => {
  for (const f of COMMON_FOODS) {
    assert.equal(f.brand, COMMON_LABEL);
    assert.equal(f.source, 'custom'); // logged with fdc_id 0, like custom foods
    assert.ok(f.name.length <= 200);
  }
  assert.equal(new Set(COMMON_FOODS.map((f) => f.id)).size, COMMON_FOODS.length);
});

test('catalog values are internally consistent (catches typos)', () => {
  for (const f of COMMON_FOODS) {
    const { kcal, protein, fat, carbs } = f.per100;
    assert.ok(protein + fat + carbs <= 100.5, `${f.name}: macros exceed 100 g`);
    const atwater = 4 * protein + 4 * carbs + 9 * fat;
    assert.ok(Math.abs(atwater - kcal) <= Math.max(25, kcal * 0.15), `${f.name}: ${kcal} kcal vs ${Math.round(atwater)} from macros`);
  }
});


test('serving units convert to grams, refusing what cannot be logged', () => {
  assert.equal(toGrams(150, 'g', null), 150);
  assert.equal(toGrams(2, 'oz', null), 56.7);
  assert.equal(toGrams(1.5, 'serving', 40), 60);
  assert.equal(toGrams(1, 'serving', null), null, 'no serving size known');
  assert.equal(toGrams(0, 'g', null), null);
  assert.equal(toGrams(-5, 'g', null), null);
  assert.equal(toGrams(20000, 'g', null), null, 'over the database limit');
  assert.equal(toGrams(Number('abc'), 'g', null), null);
});

test('editing a logged amount scales its totals', () => {
  const log = { grams: 50, kcal: 190, protein: 6.6, fat: 3.3, carbs: 33.9 };
  assert.deepEqual(rescale(log, 100), { grams: 100, kcal: 380, protein: 13.2, fat: 6.6, carbs: 67.8 });
  assert.deepEqual(rescale(log, 25), { grams: 25, kcal: 95, protein: 3.3, fat: 1.7, carbs: 17 });
});

test('every food shows where its numbers come from', () => {
  const base = { name: 'x', brand: null, servingGrams: null, per100: { kcal: 1, protein: 0, fat: 0, carbs: 0 } };
  assert.equal(sourceLabel({ ...base, id: '123', source: 'usda' }), 'USDA FoodData Central');
  assert.equal(sourceLabel({ ...base, id: '0001', source: 'off' }), 'Open Food Facts');
  assert.equal(sourceLabel({ ...base, id: 'common-3', source: 'custom' }), 'Common food · typical values');
  assert.equal(sourceLabel({ ...base, id: '0', source: 'custom' }), 'Your custom food');
  assert.equal(sourceLabel(COMMON_FOODS[0]), 'Common food · typical values');
});

test('nutrition goals: recomp eats at maintenance, every explanation is labelled', () => {
  const base = { bodyweight: 80, unit: 'kg' as const, heightCm: 180, age: 30, sex: 'male' as const, days: 4 };
  const maintain = targets({ ...base, phase: 'maintain' });
  const recomp = targets({ ...base, phase: 'recomp' });
  assert.equal(recomp.calories, maintain.calories);
  assert.equal(recomp.protein, maintain.protein);
  assert.ok(targets({ ...base, phase: 'cut' }).calories < maintain.calories);
  assert.ok(targets({ ...base, phase: 'gain' }).calories > maintain.calories);
  const recompWhy = recomp.explanations.find((e) => e.text.startsWith("Recomp means"));
  assert.ok(recompWhy && recompWhy.label === 'rule', 'recomp is presented as our rule, not a study finding');
  for (const phase of ['gain', 'maintain', 'cut', 'recomp'] as const) {
    for (const e of targets({ ...base, phase }).explanations) assert.ok(['direct', 'principle', 'rule'].includes(e.label));
  }
});
