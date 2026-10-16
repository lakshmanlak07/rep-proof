// Home-screen stats. Plain TypeScript (no React), unit-tested in src/engine/engine.test.ts.

const DAY = 864e5;

/** "Fri, Oct 9" in the device's locale: one date format across the app. A date-only YYYY-MM-DD is a local calendar day, not UTC midnight. */
export function shortDate(d: string | Date): string {
  const v = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00`) : new Date(d);
  return v.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export type Readiness = { label: string; detail: string; tone: 'neutral' | 'accent' | 'pos' | 'warn' | 'danger'; score: number | null };

/** Readiness from the most recent check-ins (sleep, soreness, energy: 1-5, 5 best). */
export function readiness(checkins: ({ sleep: number; soreness: number; energy: number } | null)[], deloadActive: boolean): Readiness {
  if (deloadActive) return { label: 'Deload', detail: 'Lighter week in progress', tone: 'accent', score: null };
  const c = checkins.find((x) => x);
  // No data is not the same as recovered: say we do not know.
  if (!c) return { label: 'No check-in yet', detail: 'Check in before your next session', tone: 'neutral', score: null };
  const score = (c.sleep + c.soreness + c.energy) / 3;
  if (score >= 3.7) return { label: 'Ready', detail: 'Recovering well', tone: 'pos', score };
  if (score >= 2.7) return { label: 'Moderate', detail: 'Train as planned, stay honest on effort', tone: 'warn', score };
  return { label: 'Run down', detail: 'Today may be adjusted for you', tone: 'danger', score };
}

/** Monday 00:00 (local) of the week containing `d`. */
export function weekStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/** Which days of the current week (Mon..Sun) had a finished workout. */
export function weekDots(finished: string[], now = new Date()): boolean[] {
  const start = weekStart(now).getTime();
  const dots = Array<boolean>(7).fill(false);
  for (const iso of finished) {
    // Calendar days, not 24 h steps: a daylight-saving week is 167 or 169 hours long.
    const d = new Date(iso);
    if (weekStart(d).getTime() === start) dots[(d.getDay() + 6) % 7] = true;
  }
  return dots;
}

/**
 * Consecutive weeks with at least one workout. Counts from this week if it has one,
 * otherwise from last week, so a streak does not reset on Monday morning.
 */
export function streakWeeks(finished: string[], now = new Date()): number {
  const weeks = new Set(finished.map((iso) => weekStart(new Date(iso)).getTime()));
  let cursor = weekStart(now);
  if (!weeks.has(cursor.getTime())) cursor = weekStart(new Date(cursor.getTime() - 3 * DAY)); // previous week, DST-safe
  let n = 0;
  while (weeks.has(cursor.getTime())) {
    n++;
    cursor = weekStart(new Date(cursor.getTime() - 3 * DAY)); // step into the previous week (DST-safe)
  }
  return n;
}

export type Adherence = {
  weeks: { start: string; done: number; planned: number }[]; // oldest first, the current week last
  pct: number; // finished / planned over the full weeks (the current week counts only when it is already met)
  activeWeeks: number; // weeks with at least one workout
  span: number; // weeks in the window since the account started (all `n` when no start is known)
  counted: number; // weeks that entered pct (0 in a first, unfinished week: pct then means nothing yet)
};

/**
 * Planned vs finished workouts per week over the last `n` weeks. The current, unfinished week only
 * counts toward the percentage once its plan is met, so a Monday does not drag adherence down.
 * Weeks before `since` (account start) are not missed weeks, and the partial first week, like the current one,
 * counts only once met: someone two weeks in who never missed a session reads 100%, not 25%.
 */
export function adherence(finished: string[], plannedPerWeek: number, n = 8, now = new Date(), since?: string): Adherence {
  const thisWeek = weekStart(now).getTime();
  const firstWeek = since ? weekStart(new Date(since)).getTime() : -Infinity;
  const weeks = Array.from({ length: n }, (_, i) => {
    const start = weekStart(new Date(thisWeek - (n - 1 - i) * 7 * DAY + 3 * DAY)); // mid-week step: DST-safe
    return { start: start.toISOString(), t: start.getTime(), done: 0, planned: plannedPerWeek };
  });
  for (const iso of finished) {
    const t = weekStart(new Date(iso)).getTime();
    const w = weeks.find((x) => x.t === t);
    if (w) w.done++;
  }
  const started = weeks.filter((w) => w.t >= firstWeek);
  const counted = started.filter((w) => (w.t !== thisWeek && w.t !== firstWeek) || w.done >= w.planned);
  const planned = counted.reduce((a, w) => a + w.planned, 0);
  const done = counted.reduce((a, w) => a + Math.min(w.done, w.planned), 0);
  return {
    weeks: weeks.map(({ start, done, planned }) => ({ start, done, planned })),
    pct: planned ? Math.round((done / planned) * 100) : 0,
    activeWeeks: weeks.filter((w) => w.done > 0).length,
    span: started.length,
    counted: counted.length,
  };
}

export type SetRecord = { exercise_id: string; weight: number; workout_id: string; created_at: string };
export type Best = { exerciseId: string; weight: number; previous: number; at: string };

/** Sessions where an exercise's top weight beat every earlier session, newest first. First sessions do not count. */
export function newBests(sets: SetRecord[], sinceDays = 30, now = new Date()): Best[] {
  const sessions = new Map<string, { exerciseId: string; at: string; top: number }>();
  for (const s of sets) {
    const key = `${s.exercise_id}|${s.workout_id}`;
    const cur = sessions.get(key);
    if (!cur) sessions.set(key, { exerciseId: s.exercise_id, at: s.created_at, top: s.weight });
    else cur.top = Math.max(cur.top, s.weight);
  }
  const best = new Map<string, number>();
  const out: Best[] = [];
  for (const x of [...sessions.values()].sort((a, b) => a.at.localeCompare(b.at))) {
    const prev = best.get(x.exerciseId);
    if (prev !== undefined && x.top > prev && now.getTime() - new Date(x.at).getTime() <= sinceDays * DAY) {
      out.push({ exerciseId: x.exerciseId, weight: x.top, previous: prev, at: x.at });
    }
    best.set(x.exerciseId, Math.max(prev ?? 0, x.top));
  }
  return out.reverse();
}

export type TrendSet = { created_at: string; rir: number | null };
export type WeekPoint = { start: number; sets: number; rirSets: number; avgRir: number | null; setsAvg4: number; rirAvg4: number | null };

/**
 * Weekly trend (backlog J-02): hard sets and average logged reps in reserve per Monday-start week, with a
 * 4-week moving average. Only completed weeks count: the current week is still filling up, so it would pull
 * every average down. Weeks run from the first week with a set to last week, so a week without
 * training counts as 0 sets, while its average RIR is null (nothing to average), never 0. Sets with no RIR
 * are counted as sets but left out of the RIR average. The RIR average is weighted by sets across the window.
 * Returns null below 2 weeks of data (too little to call a trend).
 */
export function weeklyTrend(sets: TrendSet[], now = new Date(), maxWeeks = 26): WeekPoint[] | null {
  const current = weekStart(now);
  const end = new Date(current); end.setDate(end.getDate() - 7);
  const valid = sets.filter((x) => Number.isFinite(Date.parse(x.created_at)) && Date.parse(x.created_at) < current.getTime());
  if (!valid.length) return null;
  const oldest = weekStart(new Date(Math.min(...valid.map((x) => Date.parse(x.created_at)))));
  const cap = new Date(end); cap.setDate(cap.getDate() - (maxWeeks - 1) * 7);
  const firstStart = Math.max(oldest.getTime(), cap.getTime());
  const weeks: { start: number; sets: number; rirSum: number; rirSets: number }[] = [];
  // Step by calendar weeks (setDate), not 7×24 h, so daylight-saving changes cannot shift a boundary.
  for (const d = new Date(firstStart); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 7)) weeks.push({ start: d.getTime(), sets: 0, rirSum: 0, rirSets: 0 });
  if (weeks.length < 2) return null;
  for (const x of valid) {
    const w = weeks.find((k) => k.start === weekStart(new Date(x.created_at)).getTime());
    if (!w) continue; // older than the window
    w.sets++;
    if (x.rir != null && Number.isFinite(x.rir) && x.rir >= 0 && x.rir <= 10) { w.rirSum += x.rir; w.rirSets++; }
  }
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return weeks.map((w, i) => {
    const win = weeks.slice(Math.max(0, i - 3), i + 1);
    const rirSets = win.reduce((a, k) => a + k.rirSets, 0);
    return {
      start: w.start, sets: w.sets, rirSets: w.rirSets,
      avgRir: w.rirSets ? r1(w.rirSum / w.rirSets) : null,
      setsAvg4: r1(win.reduce((a, k) => a + k.sets, 0) / win.length),
      rirAvg4: rirSets ? r1(win.reduce((a, k) => a + k.rirSum, 0) / rirSets) : null,
    };
  });
}
