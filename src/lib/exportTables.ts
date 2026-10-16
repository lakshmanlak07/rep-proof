// What "Download my data" contains, and what it deliberately does not. Pure data: features.test.ts checks
// that every table in supabase/migrations appears in exactly one of these lists, so a new table can never be
// silently left out of exports.

/** Tables the user can read through row-level security; exported in full. Key = owner column. */
export const EXPORTED = {
  profiles: 'id', programs: 'user_id', workouts: 'user_id', logged_sets: 'user_id', food_logs: 'user_id',
  saved_meals: 'user_id', cardio_logs: 'user_id', bodyweight_logs: 'user_id',
} as const;
export type ExportTable = keyof typeof EXPORTED;

/** Tables the app cannot read back (insert-only by design), with the reason. Deleted with the account. */
export const NOT_EXPORTED: Record<string, string> = {
  events: 'Usage events are write-only so no client can read analytics; they hold feature names, not your entries.',
  feedback: 'Feedback and survey answers are write-only; you wrote them, and they are deleted with your account.',
  client_errors: 'Crash reports are write-only and scrubbed of personal data; reports older than 90 days are deleted whenever a new report arrives.',
  food_cache: 'Shared food search cache with no personal data.',
  rate_limits: 'Server-side abuse counters (request counts only), cleared automatically.',
};

/** Fixed-size page reader used by data export: every row once, in the order the pages return them. */
export async function pageAll<T>(fetchPage: (from: number, to: number) => Promise<T[]>, size = 1000): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const page = await fetchPage(from, from + size - 1);
    rows.push(...page);
    if (page.length < size) return rows;
  }
}
