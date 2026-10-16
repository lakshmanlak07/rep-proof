// Export logic with the database client passed in, so the exact code the app runs is also run in tests against a
// real Postgres with row-level security (supabase/tests/export_integration.mjs). Pure apart from the client.
import { toCsv } from './csv.ts';
import { EXPORTED, NOT_EXPORTED, pageAll, type ExportTable } from './exportTables.ts';

type Result = { data: unknown[] | null; error: unknown };
type Query = { eq(col: string, v: string): Query; order(col: string): Query; range(from: number, to: number): PromiseLike<Result> };
export type ExportClient = { from(table: string): { select(cols: string): Query } };

const SET_COLUMNS = ['created_at', 'workout_id', 'exercise_id', 'set_index', 'weight', 'reps', 'rir', 'rpe'];

export async function collectExportWith(client: ExportClient, userId: string, email: string | null, now = new Date()) {
  const data: Record<string, Record<string, unknown>[]> = {};
  for (const t of Object.keys(EXPORTED) as ExportTable[]) {
    // Ordered by primary key so consecutive pages never skip or repeat a row; any error aborts the whole export.
    data[t] = await pageAll(async (from, to) => {
      const { data: rows, error } = await client.from(t).select('*').eq(EXPORTED[t], userId).order('id').range(from, to);
      if (error) throw error;
      return (rows ?? []) as Record<string, unknown>[];
    });
  }
  return {
    stamp: now.toISOString().slice(0, 10),
    json: JSON.stringify({ app: 'RepProof', format: 1, exported_at: now.toISOString(), account: { id: userId, email }, data, not_included: NOT_EXPORTED }, null, 2),
    csv: toCsv(data.logged_sets, SET_COLUMNS),
  };
}
