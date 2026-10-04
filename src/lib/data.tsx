import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import type { Phase } from '@/engine/nutrition.ts';
import { buildProgram } from '@/engine/plan.ts';
import type { CheckIn, Experience, Goal, LoggedSet, Pattern, Profile, Program, Setup, SplitId, Unit } from '@/engine/types.ts';
import { supabase } from './supabase';

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
};
export type ProgramRow = { id: string; split: SplitId; plan: Program; next_day: number };

/** Engine profile from the DB row; weak/strong points live with the plan (Program.emphasis). */
export const toProfile = (r: ProfileRow, emphasis?: Program['emphasis']): Profile => ({
  experience: r.experience, goal: r.goal, setup: r.setup, days: r.days, sessionMinutes: r.session_minutes, unit: r.unit, avoid: r.avoid,
  weak: emphasis?.weak ?? [], strong: emphasis?.strong ?? [],
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

  const load = useCallback(async (s: Session | null) => {
    setSession(s);
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
      setProfile(p.data);
      setProgram(g.data);
    }
    setFailed(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') load(s);
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await load(data.session);
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
  await supabase.from('events').insert({ name, props }); // best effort; never blocks the user
}

/** Replaces the active program, keeping the user's place in the week. */
export async function saveProgram(profile: Profile, split?: SplitId, nextDay = 0) {
  const plan = buildProgram(profile, split);
  const next_day = nextDay % plan.days.length;
  // One transaction via migration 2's replace_program; two steps if that migration is not applied yet.
  const rpc = await supabase.rpc('replace_program', { p_split: plan.split, p_plan: plan, p_next_day: next_day });
  if (!rpc.error) return;
  if (rpc.error.code !== 'PGRST202') throw rpc.error; // PGRST202 = function not found
  ok(await supabase.from('programs').update({ active: false }).eq('active', true));
  ok(await supabase.from('programs').insert({ split: plan.split, plan, next_day }));
}

/** Last `n` finished sessions of an exercise, newest first. */
export async function history(exerciseId: string, n = 2): Promise<LoggedSet[][]> {
  const rows = must(await supabase
    .from('logged_sets')
    .select('workout_id, weight, reps, rir, created_at')
    .eq('exercise_id', exerciseId)
    .order('created_at', { ascending: false })
    .limit(n * 10));
  const sessions: LoggedSet[][] = [];
  const ids: string[] = [];
  for (const r of rows) {
    let i = ids.indexOf(r.workout_id);
    if (i === -1) {
      if (ids.length === n) break;
      i = ids.push(r.workout_id) - 1;
      sessions.push([]);
    }
    sessions[i].push({ weight: Number(r.weight), reps: r.reps, rir: r.rir });
  }
  return sessions;
}

export async function bestWeight(exerciseId: string): Promise<number | null> {
  const rows = must(await supabase.from('logged_sets').select('weight').eq('exercise_id', exerciseId).order('weight', { ascending: false }).limit(1));
  return rows.length ? Number(rows[0].weight) : null;
}

export type DraftSet = { exerciseId: string; setIndex: number; weight: number; reps: number; rir: number | null; overridden: boolean };

export async function saveWorkout(w: {
  programId: string; dayIndex: number; dayName: string; checkin: CheckIn | null; startedAt: string; sets: DraftSet[]; daysInPlan: number; perfDrops: number;
}) {
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
