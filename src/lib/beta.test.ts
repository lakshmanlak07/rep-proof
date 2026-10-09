// Workout draft safety and science linking. Run with `npm test`.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EXERCISE_BY_ID } from '../engine/exercises.ts';
import { targets } from '../engine/nutrition.ts';
import { buildProgram } from '../engine/plan.ts';
import { suggest } from '../engine/progression.ts';
import { REFERENCES } from '../engine/references.ts';
import { TOPICS, topicFor } from '../engine/science.ts';
import { isUsableDraft } from './draft.ts';

const known = (id: string) => !!EXERCISE_BY_ID[id];
const plan = buildProgram({ experience: 'intermediate', goal: 'muscle', setup: 'commercial', days: 4, sessionMinutes: 60, unit: 'kg', avoid: [] });
const USER = '11111111-1111-4111-8111-111111111111';

/** A draft exactly as the workout screen saves it. */
function draft() {
  const items = plan.days[0].exercises.map((p) => {
    const s = suggest(p, [], 'intermediate', 'kg');
    return {
      planned: p, exerciseId: p.exerciseId, history: [], prevBest: null, suggestion: s, changed: false,
      sets: Array.from({ length: s.sets }, () => ({ weight: '', reps: String(s.reps), rir: '2', done: false })),
    };
  });
  // Deep copy: suggest() shares explanation objects, and the cases below mutate their own draft.
  return structuredClone({ userId: USER, clientId: 'c', dayIndex: 0, startedAt: new Date().toISOString(), checkin: { sleep: 3, soreness: 3, energy: 3 }, items });
}
const days = plan.days.length;

test('a normal unfinished workout is kept', () => {
  assert.ok(isUsableDraft(draft(), USER, days, known));
  const logged = draft();
  logged.items[0].sets[0] = { weight: '60', reps: '8', rir: '1', done: true };
  assert.ok(isUsableDraft(logged, USER, days, known));
  assert.ok(isUsableDraft({ ...draft(), checkin: null }, USER, days, known), 'skipped check-in');
});

test('drafts that would crash the workout screen are discarded', () => {
  const removedExercise = draft();
  removedExercise.items[1].exerciseId = 'exercise_renamed_in_a_later_version';
  const bad: [string, unknown][] = [
    ['not an object', 'garbage'],
    ['null', null],
    ['array', []],
    ['another user', { ...draft(), userId: '22222222-2222-4222-8222-222222222222' }],
    ['exercise no longer in the library', removedExercise],
    ['day outside the plan', { ...draft(), dayIndex: days }],
    ['negative day', { ...draft(), dayIndex: -1 }],
    ['fractional day', { ...draft(), dayIndex: 0.5 }],
    ['bad start time', { ...draft(), startedAt: 'yesterday-ish' }],
    ['no exercises', { ...draft(), items: [] }],
    ['items not a list', { ...draft(), items: {} }],
    ['set fields of the wrong type', (() => { const d = draft(); (d.items[0].sets[0] as unknown as { reps: number }).reps = 8; return d; })()],
    ['missing suggestion', (() => { const d = draft(); delete (d.items[0] as Partial<typeof d.items[0]>).suggestion; return d; })()],
    ['unknown evidence label', (() => { const d = draft(); (d.items[0].suggestion.explanation as { label: string }).label = 'vibes'; return d; })()],
    ['missing planned targets', (() => { const d = draft(); (d.items[0].planned as Partial<typeof d.items[0]['planned']>).repMin = undefined; return d; })()],
  ];
  for (const [why, d] of bad) assert.equal(isUsableDraft(d, USER, days, known), false, why);
  assert.equal(isUsableDraft(draft(), undefined, days, known), false, 'signed out');
});

test('every science topic is complete, cites real studies and never stands on community content', () => {
  for (const t of TOPICS) {
    assert.ok(t.title.trim().length > 3, 'title');
    for (const field of ['shows', 'doesNotShow', 'inApp'] as const) assert.ok(t[field].trim().length > 10, `${t.title}: ${field}`);
    assert.ok(['direct', 'principle', 'rule'].includes(t.label));
    for (const id of t.refIds) {
      const r = REFERENCES[id];
      assert.ok(r && r.citation && /^10\.\d{4,}\//.test(r.doi) && /^\d+$/.test(r.pmid), `${t.title}: ${id} needs a citation, DOI and PubMed id`);
    }
    assert.ok(!/reddit|discord|tiktok|youtube|instagram/i.test(`${t.shows} ${t.inApp}`), `${t.title} cites community content`);
  }
});

test('Why links lead to the matching evidence topic', () => {
  const t = targets({ bodyweight: 80, unit: 'kg', heightCm: 180, age: 30, sex: 'male', days: 4, phase: 'maintain' });
  const protein = t.explanations.find((e) => e.refIds.includes('protein'))!;
  const topic = topicFor(protein);
  assert.ok(topic && topic.refIds.includes('protein'), 'protein explanation opens a protein topic');
  assert.equal(topicFor({ text: 'Our rule', label: 'rule', refIds: [] }), null, 'no study: generic link');
  // Every engine explanation with studies resolves to a real topic (or none), never crashes.
  const all = [...t.explanations, ...plan.explanations];
  for (const e of all) {
    const found = topicFor(e);
    if (found) assert.ok(TOPICS.includes(found) && found.refIds.some((id) => e.refIds.includes(id)));
  }
});
