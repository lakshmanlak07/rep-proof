// Proxy to USDA FoodData Central. Keeps FDC_API_KEY on the server and caches results,
// because USDA's limit (1,000 requests/hour) is per IP and every user shares this one.
// Deploy: npx supabase functions deploy food
// Secret: npx supabase secrets set FDC_API_KEY=<your data.gov key>
import { createClient } from 'npm:@supabase/supabase-js@2';

type Food = { fdcId: number; name: string; brand: string | null; servingGrams: number | null; per100: { kcal: number; protein: number; fat: number; carbs: number } };

const CACHE_DAYS = 30;
const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default,
);

function normalize(f: any): Food {
  const n = (...nums: string[]) => {
    for (const num of nums) {
      const hit = f.foodNutrients?.find((x: any) => x.nutrientNumber === num);
      if (hit) return Math.max(0, Number(hit.value) || 0);
    }
    return 0;
  };
  const unit = String(f.servingSizeUnit ?? '').toLowerCase();
  return {
    fdcId: f.fdcId,
    name: f.description,
    brand: f.brandOwner ?? f.brandName ?? null,
    servingGrams: f.servingSize && (unit === 'g' || unit === 'grm' || unit === 'ml') ? Number(f.servingSize) : null,
    // Search results report nutrients per 100 g.
    per100: { kcal: n('208', '958', '957'), protein: n('203'), fat: n('204'), carbs: n('205') },
  };
}

// The native app needs no CORS; the web build does.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const { query, upc } = await req.json().catch(() => ({}));
  const q = String(query ?? '').trim().toLowerCase().slice(0, 100);
  const code = String(upc ?? '').replace(/\D/g, '');
  if (!q && !code) return json({ error: 'query or upc required' }, 400);
  const key = code ? `upc:${code}` : `q:${q}`;

  const cached = await admin.from('food_cache').select('results, fetched_at').eq('key', key).maybeSingle();
  if (cached.data && Date.now() - new Date(cached.data.fetched_at).getTime() < CACHE_DAYS * 864e5) {
    return json({ foods: cached.data.results });
  }

  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('api_key', Deno.env.get('FDC_API_KEY')!);
  url.searchParams.set('query', code || q);
  url.searchParams.set('pageSize', '25');
  url.searchParams.set('dataType', code ? 'Branded' : 'Foundation,SR Legacy,Branded');
  const res = await fetch(url);
  if (!res.ok) return json({ error: `USDA ${res.status}` }, res.status === 429 ? 429 : 502);
  const data = await res.json();

  let foods: Food[] = (data.foods ?? []).map(normalize);
  if (code) {
    const strip = (s: string) => s.replace(/^0+/, '');
    foods = foods.filter((_, i) => strip(String(data.foods[i].gtinUpc ?? '')) === strip(code));
  }
  await admin.from('food_cache').upsert({ key, results: foods, fetched_at: new Date().toISOString() });
  return json({ foods });
});
