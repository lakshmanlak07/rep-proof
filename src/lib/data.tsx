import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import type { Phase } from '@/engine/nutrition.ts';
import { buildProgram, ENGINE_VERSION } from '@/engine/plan.ts';
import { sessionsFromRows } from '@/engine/session.ts';
import type { CheckIn, Experience, Goal, LoggedSet, Pattern, Profile, Program, Setup, SplitId, Unit } from '@/engine/types.ts';
import { sessionRejected } from './authFlow';
import { safeProps } from './eventProps';
import { supabase } from './supabase';
import { reportError } from './crash';

export type ProfileRow = {
  id: string;
  birth_year: number;
  plan_tier: string;
  disclaimer_accepted_at: string;
  experience: Experience;
  goal: Goal;
  setup: Setup;
  days: number;
  session_minutes: number;
  bodyweight: number;
  height_cm: number;
  nutrition_phase: Phase;
  sex: 'male' | 'female' | null;
  unit: Unit;
  avoid: Pattern[];
  deload_until: string | null;
  created_at?: string; // account start (server-set)
};
export type ProgramRow = { id: string; split: SplitId; plan: Program; next_day: number };

/** Engine profile from the DB row; weak/strong points and effort style live with the plan. */
export const toProfile = (r: ProfileRow, plan?: Pick<Program, 'emphasis' | 'effort' | 'coverage'>): Profile => ({
  experience: r.experience, goal: r.goal, setup: r.setup, days: r.days, sessionMinutes: r.session_minutes, unit: r.unit, avoid: r.avoid,
  weak: plan?.emphasis?.weak ?? [], strong: plan?.emphasis?.strong ?? [], effort: plan?.effort ?? 'last_failure',
  coverage: plan?.coverage ?? 'muscle',
});

type Ctx = {
  session: Session | null;
  profile: ProfileRow | null;
  program: ProgramRow | null;
  loading: boolean;
  failed: boolean; // last load could not reach the server; profile/program may be stale
  refresh: () => Promise<void>;
};
const DataContext = createContext<Ctx>(null!);
export const useData = () => useContext(DataContext);

export function DataProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [program, setProgram] = useState<ProgramRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const loadedFor = useRef<string | null>(null); // whose profile and program are in state

  const load = useCallback(async (s: Session | null) => {
    setSession(s);
    // Another account (or none): drop the previous one's data at once, so it can never show under the new
    // session, even briefly or when the new account's load fails.
    if (loadedFor.current !== (s?.user.id ?? null)) {
      setProfile(null);
      setProgram(null);
      loadedFor.current = null;
      if (s) setLoading(true); // until this account's profile arrives; never onboarding first for a returning user
    }
    if (!s) {
      setProfile(null);
      setProgram(null);
    } else {
      const [p, g] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle(),
        supabase.from('programs').select('id, split, plan, next_day').eq('active', true).maybeSingle(),
      ]);
      // A failed request must never look like "no profile": that would send an existing user to onboarding.
      if (p.error || g.error) {
        setFailed(true);
        setLoading(false);
        return;
      }
      // No profile: either a new account (onboarding) or one deleted or revoked on the server while this device
      // still held a token. Ask the server; a definite rejection signs this device out instead of trapping the
      // person in an onboarding that can never save. Network errors fall through to onboarding as before.
      if (!p.data) {
        const u = await supabase.auth.getUser();
        if (sessionRejected(u.error)) {
          await supabase.auth.signOut({ scope: 'local' }); // SIGNED_OUT reloads with no session
          return;
        }
      }
      let program = g.data as ProgramRow | null;
      // Profile but no active plan (e.g. an interrupted rebuild): rebuild it, never re-run onboarding.
      if (p.data && !program) {
        try {
          await saveProgram(toProfile(p.data));
          const fresh = await supabase.from('programs').select('id, split, plan, next_day').eq('active', true).maybeSingle();
          if (!fresh.error && fresh.data) program = fresh.data;
        } catch (e) {
          void reportError(e, 'plan_rebuild'); // stays on onboarding's retry path
        }
      }
      // Plans saved by an older engine are rebuilt under the current rules (split and place in the week kept).
      if (p.data && program && (program.plan.version ?? 1) < ENGINE_VERSION) {
        try {
          await saveProgram(toProfile(p.data, program.plan), program.split, program.next_day);
          const fresh = await supabase.from('programs').select('id, split, plan, next_day').eq('active', true).maybeSingle();
          if (!fresh.error && fresh.data) program = fresh.data;
        } catch (e) {
          void reportError(e, 'plan_upgrade'); // keep the old plan; the next load tries again
        }
      }
      setProfile(p.data);
      setProgram(program);
      loadedFor.current = s.user.id;
    }
    setFailed(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    // An unreadable stored session (e.g. the Android keystore was reset) rejects instead of returning null:
    // treat it as signed out so the person reaches sign-in, never an endless spinner.
    supabase.auth.getSession()
      .then(({ data, error }) => {
        // Expired token + no network: auth-js keeps the stored session and returns this error. That is
        // "can't reach RepProof" (Offline screen, Try again), never a sign-out.
        if (!data.session && error?.name === 'AuthRetryableFetchError') { setFailed(true); setLoading(false); return; }
        return load(data.session);
      })
      .catch(() => load(null)) // unreadable stored session (e.g. keystore reset): sign in again
      .catch(() => { setFailed(true); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') load(s).catch(() => { setFailed(true); setLoading(false); }); // Offline screen, Try again
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (!data.session && error?.name === 'AuthRetryableFetchError') { setFailed(true); setLoading(false); return; }
      await load(data.session);
    } catch {
      setFailed(true); // callers' spinners must stop; the Offline screen offers another try
      setLoading(false);
    }
  }, [load]);

  return <DataContext.Provider value={{ session, profile, program, loading, failed, refresh }}>{children}</DataContext.Provider>;
}

/** Reads: throws on error or missing data. */
const must = <T,>({ data, error }: { data: T; error: unknown }): NonNullable<T> => {
  if (error) throw error;
  if (data == null) throw new Error('No data returned');
  return data as NonNullable<T>;
};

/** Writes (insert/update/upsert/delete without select): throws on error only. */
const ok = ({ error }: { error: unknown }) => {
  if (error) throw error;
};

export async function track(name: string, props?: Record<string, unknown>) {
  await supabase.from('events').insert({ name, props: safeProps(name, props) ?? null }); // best effort; only allowlisted properties (eventProps.ts)
}

/** Replaces the active program, keeping the user's place in the week. */
export async function saveProgram(profile: Profile, split?: SplitId, nextDay = 0) {
  const plan = buildProgram(profile, split);
  const next_day = nextDay % plan.days.length;
  // One transaction via migration 2's replace_program; two steps if that migration is not applied yet.
  const rpc = await supabase.rpc('replace_program', { p_split: plan.split, p_plan: plan, p_next_day: next_day });
  if (!rpc.error) return;
  if (rpc.error.code !== 'PGRST202') throw rpc.error; // PGRST202 = function not found
  // Save the new plan inactive first: if anything fails, the old plan stays active (never left with none).
  const created = must(await supabase.from('programs').insert({ split: plan.split, plan, next_day, active: false }).select('id').single());
  ok(await supabase.from('programs').update({ active: false }).eq('active', true));
  ok(await supabase.from('programs').update({ active: true }).eq('id', created.id));
}

/** Last `n` sessions of an exercise, newest first; sets in the order they were done. */
export async function history(exerciseId: string, n = 6): Promise<LoggedSet[][]> {
  const rows = must(await supabase
    .from('logged_sets')
    .select('workout_id, weight, reps, rir, created_at, set_index')
    .eq('exercise_id', exerciseId)
    .order('created_at', { ascending: false })
    .order('set_index', { ascending: true })
    .limit(n * 10));
  return sessionsFromRows(rows, n);
}

export async function bestWeight(exerciseId: string): Promise<number | null> {
  const rows = must(await supabase.from('logged_sets').select('weight').eq('exercise_id', exerciseId).order('weight', { ascending: false }).limit(1));
  return rows.length ? Number(rows[0].weight) : null;
}

export type DraftSet = { exerciseId: string; setIndex: number; weight: number; reps: number; rir: number | null; overridden: boolean; rpe?: number | null };

/** Random v4 UUID (idempotency key; not a secret). */
export const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = (Math.random() * 16) | 0;
  return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
});

export async function saveWorkout(w: {
  clientId?: string; // stable per workout: a retried save returns the first one instead of duplicating it
  programId: string; dayIndex: number; dayName: string; checkin: CheckIn | null; startedAt: string; sets: DraftSet[]; daysInPlan: number; perfDrops: number;
}) {
  // One transaction on the server (migration 4); the multi-step path below only runs until it is applied.
  if (w.clientId) {
    const rpc = await supabase.rpc('save_workout', {
      p_client_id: w.clientId, p_program_id: w.programId, p_day_index: w.dayIndex, p_day_name: w.dayName, p_checkin: w.checkin,
      p_started_at: w.startedAt, p_perf_drops: w.perfDrops, p_next_day: (w.dayIndex + 1) % w.daysInPlan,
      p_sets: w.sets.map((x) => ({
        exercise_id: x.exerciseId, set_index: x.setIndex, weight: x.weight, reps: x.reps, rir: x.rir, overridden: x.overridden,
        // Only sent when present, so a project without migration 6 keeps saving exactly as before.
        ...(x.rpe != null ? { rpe: x.rpe } : {}),
      })),
    });
    if (!rpc.error) {
      track('workout_finished', { sets: w.sets.length, checkin: !!w.checkin });
      return;
    }
    if (rpc.error.code !== 'PGRST202') throw rpc.error; // PGRST202 = function not found
  }
  const workout = must(await supabase.from('workouts').insert({
    program_id: w.programId, day_index: w.dayIndex, day_name: w.dayName, checkin: w.checkin, perf_drops: w.perfDrops, started_at: w.startedAt, finished_at: new Date().toISOString(),
  }).select('id').single());
  if (w.sets.length) {
    ok(await supabase.from('logged_sets').insert(w.sets.map((x) => ({
      workout_id: workout.id, exercise_id: x.exerciseId, set_index: x.setIndex, weight: x.weight, reps: x.reps, rir: x.rir, overridden: x.overridden,
    }))));
  }
  ok(await supabase.from('programs').update({ next_day: (w.dayIndex + 1) % w.daysInPlan }).eq('id', w.programId));
  track('workout_finished', { sets: w.sets.length, checkin: !!w.checkin });
}

export async function updatePlan(programId: string, plan: Program) {
  ok(await supabase.from('programs').update({ plan }).eq('id', programId));
}

/** Last finished workouts, newest first: for missed-session and deload checks. */
export async function recentWorkouts(n = 4) {
  const rows = must(await supabase.from('workouts').select('finished_at, checkin, perf_drops')
    .not('finished_at', 'is', null).order('finished_at', { ascending: false }).limit(n));
  return rows.map((r) => ({ finishedAt: r.finished_at as string, checkin: r.checkin as CheckIn | null, perfDrops: r.perf_drops as number }));
}

export const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);

/** Deletes one of the user's workouts (its sets cascade). RLS scopes it to the owner; zero rows back means nothing was deleted. */
export async function deleteWorkout(id: string) {
  const rows = must(await supabase.from('workouts').delete().eq('id', id).select('id'));
  if (!rows.length) throw new Error('Workout not found');
}

export async function updateProfile(id: string, patch: Partial<ProfileRow>) {
  ok(await supabase.from('profiles').update(patch).eq('id', id));
}

export async function sendFeedback(kind: 'feedback' | 'survey', message: string | null, answers?: Record<string, unknown>) {
  ok(await supabase.from('feedback').insert({ kind, message: message?.trim() || null, answers: answers ?? null }));
}

export type WeighIn = { weight: number; logged_on: string };

/** Today's bodyweight (one per day; logging again replaces it). Also updates the profile, which drives nutrition targets. */
export async function logBodyweight(profileId: string, weight: number) {
  ok(await supabase.from('bodyweight_logs').upsert({ weight, logged_on: localDate() }, { onConflict: 'user_id,logged_on' }));
  await updateProfile(profileId, { bodyweight: weight });
}

/** Last `n` weigh-ins, oldest first. */
export async function bodyweightHistory(n = 30): Promise<WeighIn[]> {
  const rows = must(await supabase.from('bodyweight_logs').select('weight, logged_on').order('logged_on', { ascending: false }).limit(n));
  return rows.map((r) => ({ weight: Number(r.weight), logged_on: r.logged_on as string })).reverse();
}

export { must, ok };

/** Local calendar date, YYYY-MM-DD. */
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const isDeload = (until: string | null) => !!until && until >= localDate();


/** Monday 00:00 local time of the current week, as ISO. */
export function startOfWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString();
}
