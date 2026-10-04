// Home-screen stats. Plain TypeScript (no React), unit-tested in src/engine/engine.test.ts.

const DAY = 864e5;

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
    const t = new Date(iso).getTime();
    if (t >= start && t < start + 7 * DAY) dots[Math.floor((t - start) / DAY)] = true;
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
  if (!weeks.has(cursor.getTime())) cursor = new Date(cursor.getTime() - 7 * DAY);
  let n = 0;
  while (weeks.has(cursor.getTime())) {
    n++;
    cursor = weekStart(new Date(cursor.getTime() - 3 * DAY)); // step into the previous week (DST-safe)
  }
  return n;
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
