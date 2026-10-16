// Analytics privacy: an explicit allowlist. Every event declares the only properties it may carry and their
// types; anything else is dropped before it leaves the phone. An unknown event keeps only its name.
// Pure; tested in features.test.ts. The privacy policy (lib/privacyPolicy.ts) describes these events.

type Kind = 'string' | 'number' | 'boolean';
type Schema = Record<string, Kind>;

const NONE: Schema = {};

/** Every analytics event the app sends, with its permitted properties. Add here, never at the call site. */
export const EVENT_SCHEMA: Record<string, Schema> = {
  bodyweight_logged: NONE,
  cardio_logged: { kind: 'string', intensity: 'string' },
  checkin: NONE, // that a check-in was answered, never the answers
  data_exported: NONE,
  deload: { trigger: 'string' },
  effort_scale: { scale: 'string' },
  exercise_added: { exerciseId: 'string' },
  feedback_sent: NONE,
  food_logged: { meal: 'string', source: 'string' },
  food_search: { source: 'string', results: 'number' },
  meal_saved: NONE,
  missed_session: { choice: 'string' },
  nutrition_phase: { phase: 'string' },
  onboarding_done: { experience: 'string', setup: 'string', goal: 'string', days: 'number', split: 'string' },
  pin: { set: 'boolean' },
  pro_waitlist_joined: NONE,
  saved_meal_used: NONE,
  schedule_changed: { days: 'number', split: 'string' },
  science_topic: { topic: 'string' },
  study_opened: { id: 'string' },
  survey_answered: { useful: 'number', fit: 'string' },
  swap: { from: 'string', to: 'string' },
  swap_in_plan: { from: 'string', to: 'string' },
  training_profile_changed: {
    experience: 'string', setup: 'string', goal: 'string', minutes: 'number', effort: 'string', coverage: 'string', avoid: 'number', weak: 'number', strong: 'number',
  },
  why_opened: { label: 'string' },
  workout_finished: { sets: 'number', checkin: 'boolean' },
};

export type EventProps = Record<string, string | number | boolean>;
const MAX_STRING = 64;

/** Only the declared properties of a known event, with the declared type; strings capped. Never throws. */
export function safeProps(name: string, props?: unknown): EventProps | undefined {
  const schema = Object.prototype.hasOwnProperty.call(EVENT_SCHEMA, name) ? EVENT_SCHEMA[name] : null;
  if (!schema || !props || typeof props !== 'object' || Array.isArray(props)) return undefined;
  const out: EventProps = {};
  for (const [key, kind] of Object.entries(schema)) {
    let v: unknown;
    try { v = (props as Record<string, unknown>)[key]; } catch { continue; } // hostile getters
    if (kind === 'boolean' && typeof v === 'boolean') out[key] = v;
    else if (kind === 'number' && typeof v === 'number' && Number.isFinite(v)) out[key] = v;
    else if (kind === 'string' && typeof v === 'string') out[key] = v.slice(0, MAX_STRING);
  }
  return Object.keys(out).length ? out : undefined;
}
