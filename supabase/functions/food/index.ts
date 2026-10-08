// Food search for the app: USDA FoodData Central (generic + US branded) merged with Open Food Facts
// (worldwide packaged foods). Keeps FDC_API_KEY on the server and caches results, because USDA's
// limit (1,000 requests/hour) is per IP and every user shares this one.
// Deploy: npx supabase functions deploy food
// Secret: npx supabase secrets set FDC_API_KEY=<your data.gov key>
import { createClient } from 'npm:@supabase/supabase-js@2';

import { MAX_BODY, parseRequest } from './request.ts';

type Macros = { kcal: number; protein: number; fat: number; carbs: number };
type Food = { id: string; source: 'usda' | 'off'; name: string; brand: string | null; servingGrams: number | null; per100: Macros };

const CACHE_DAYS = 30;
const TIMEOUT_MS = 8000; // per upstream call; a slow provider must not hold the function open
const OFF_FIELDS = 'code,product_name,generic_name,brands,nutriments,serving_quantity,serving_quantity_unit';
const OFF_HEADERS = { 'User-Agent': 'RepProof/1.0 (beta)' };
const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default,
);

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const hasData = (m: Macros) => !!(m.kcal || m.protein || m.fat || m.carbs);
// Upstream text is untrusted: keep it short (food_logs.name allows 200 characters).
const text = (v: unknown, max = 120) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
// Only fixed provider hosts are fetched; user input only ever lands in an encoded query value or a digits-only path.
const get = (url: string | URL, headers: Record<string, string> = OFF_HEADERS) => fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });

function fromUsda(f: any): Food {
  const n = (...nums: string[]) => {
    for (const id of nums) {
      const hit = f.foodNutrients?.find((x: any) => x.nutrientNumber === id);
      if (hit) return num(hit.value);
    }
    return 0;
  };
  const unit = String(f.servingSizeUnit ?? '').toLowerCase();
  return {
    id: String(f.fdcId),
    source: 'usda',
    name: text(f.description),
    brand: text(f.brandOwner ?? f.brandName) || null,
    servingGrams: f.servingSize && (unit === 'g' || unit === 'grm' || unit === 'ml') ? Number(f.servingSize) : null,
    // Search results report nutrients per 100 g.
    per100: { kcal: n('208', '958', '957'), protein: n('203'), fat: n('204'), carbs: n('205') },
  };
}

// Same rules as src/lib/off.ts (unit-tested there).
function fromOff(p: any): Food | null {
  if (!p) return null;
  const name = text(p.product_name || p.generic_name);
  const n = p.nutriments ?? {};
  const kcal = num(n['energy-kcal_100g']) || num(n.energy_100g) / 4.184;
  const per100 = { kcal: Math.round(kcal), protein: num(n.proteins_100g), fat: num(n.fat_100g), carbs: num(n.carbohydrates_100g) };
  if (!name || !p.code || !hasData(per100)) return null;
  const brands = Array.isArray(p.brands) ? p.brands[0] : String(p.brands ?? '').split(',')[0];
  const unit = String(p.serving_quantity_unit ?? 'g').toLowerCase();
  const serving = num(p.serving_quantity);
  return { id: text(p.code, 20), source: 'off', name, brand: text(brands) || null, servingGrams: serving && (unit === 'g' || unit === 'ml') ? serving : null, per100 };
}

async function usdaSearch(query: string, branded: boolean): Promise<any[]> {
  const key = Deno.env.get('FDC_API_KEY');
  if (!key) return [];
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('query', query);
  url.searchParams.set('pageSize', '25');
  url.searchParams.set('dataType', branded ? 'Branded' : 'Foundation,SR Legacy,Branded');
  // Key in a header, not the URL, so it never shows up in URLs or logs.
  const res = await get(url, { 'X-Api-Key': key });
  if (!res.ok) throw new Error(`USDA ${res.status}`);
  return (await res.json()).foods ?? [];
}

async function offSearch(query: string): Promise<Food[]> {
  const res = await get(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(query)}&page_size=20&fields=${OFF_FIELDS}`);
  if (!res.ok) return [];
  return ((await res.json()).hits ?? []).map(fromOff).filter(Boolean);
}

async function offBarcode(code: string): Promise<Food[]> {
  const res = await get(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}`);
  if (!res.ok) return [];
  const food = fromOff((await res.json()).product);
  return food ? [food] : [];
}

function dedupe(foods: Food[]): Food[] {
  const seen = new Set<string>();
  return foods.filter((f) => {
    if (!hasData(f.per100)) return false; // entry has no nutrient data
    const key = `${f.name.toLowerCase()}|${(f.brand ?? '').toLowerCase()}|${f.per100.kcal}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function search(q: string): Promise<Food[]> {
  const [usda, off] = await Promise.all([usdaSearch(q, false).catch(() => []), offSearch(q).catch(() => [])]);
  // USDA: names containing every search word first, then generic before branded.
  // Stable sort keeps USDA's relevance order inside each group.
  const words = q.split(/\s+/).filter(Boolean);
  const rank: Record<string, number> = { Foundation: 0, 'SR Legacy': 1, 'Survey (FNDDS)': 2 };
  const score = (f: any) => (words.every((w) => String(f.description ?? '').toLowerCase().includes(w)) ? 0 : 10) + (rank[f.dataType] ?? 3);
  const sorted = [...usda].sort((a, b) => score(a) - score(b));
  // Exact-name USDA matches lead; Open Food Facts (worldwide packaged foods) follow; loose USDA matches last.
  const exact = sorted.filter((f) => score(f) < 10).map(fromUsda);
  const loose = sorted.filter((f) => score(f) >= 10).map(fromUsda);
  return dedupe([...exact, ...off, ...loose]).slice(0, 40);
}

async function barcode(code: string): Promise<Food[]> {
  const off = await offBarcode(code).catch(() => []);
  if (off.length) return off;
  const strip = (s: string) => s.replace(/^0+/, '');
  const usda = await usdaSearch(code, true).catch(() => []);
  return dedupe(usda.filter((f) => strip(String(f.gtinUpc ?? '')) === strip(code)).map(fromUsda));
}

// The native app needs no CORS; the web build does. A wildcard origin is safe here: callers authenticate
// with a bearer token they must already hold (no cookies), so another site gains nothing it could not do itself.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

const PUBLISHABLE = Deno.env.get('SUPABASE_ANON_KEY') ?? JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}').default;

/**
 * Per-user allowance (migration 4), asked as the caller. The gateway also lets the public key through as an
 * anonymous caller, so a signed-in user is required here too. Fails closed: if the limiter can't answer,
 * nothing is searched.
 */
async function allowance(req: Request): Promise<'ok' | 'unauthorized' | 'limited' | 'unavailable'> {
  const auth = req.headers.get('Authorization');
  if (!auth) return 'unauthorized';
  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, PUBLISHABLE, { global: { headers: { Authorization: auth } } });
  const { data, error } = await asUser.rpc('food_search_allowed');
  if (error) return error.code === '42501' || error.code?.startsWith('PGRST3') ? 'unauthorized' : 'unavailable';
  return data === true ? 'ok' : 'limited';
}

const REFUSED = {
  unauthorized: [401, 'sign in to search foods'],
  limited: [429, 'too many requests'],
  unavailable: [503, 'food search unavailable'],
} as const;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  try {
    if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return json({ error: 'request too large' }, 413);
    const parsed = parseRequest(await req.text());
    if ('error' in parsed) return json({ error: parsed.error }, parsed.status);
    const allow = await allowance(req);
    if (allow !== 'ok') return json({ error: REFUSED[allow][1] }, REFUSED[allow][0]);

    const cached = await admin.from('food_cache').select('results, fetched_at').eq('key', parsed.key).maybeSingle();
    if (cached.data && Date.now() - new Date(cached.data.fetched_at).getTime() < CACHE_DAYS * 864e5) {
      return json({ foods: cached.data.results });
    }

    const foods = 'upc' in parsed ? await barcode(parsed.upc) : await search(parsed.query);
    if (foods.length) await admin.from('food_cache').upsert({ key: parsed.key, results: foods, fetched_at: new Date().toISOString() });
    // Expired entries are never served; clear them out now and then so the cache cannot grow without bound.
    if (Math.random() < 0.01) await admin.from('food_cache').delete().lt('fetched_at', new Date(Date.now() - CACHE_DAYS * 864e5).toISOString());
    return json({ foods });
  } catch (e) {
    // Log the error type only: no request text, tokens or upstream URLs in the logs, nothing internal in the reply.
    console.error('food: request failed:', e instanceof Error ? e.name : typeof e);
    return json({ error: 'food search failed' }, 502);
  }
});
