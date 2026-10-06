// Validates the food function's request body. Pure TypeScript (no Deno APIs) so `npm test` covers it.
export const MAX_BODY = 1024; // bytes; a real request is {"query":"..."} or {"upc":"..."}

export type FoodRequest = { key: string; query: string } | { key: string; upc: string };
export type Rejected = { error: string; status: number };

const bad: Rejected = { error: 'send {"query": "<text>"} or {"upc": "<barcode digits>"}', status: 400 };

export function parseRequest(raw: string): FoodRequest | Rejected {
  if (raw.length > MAX_BODY) return { error: 'request too large', status: 413 };
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return bad;
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return bad;
  const { query, upc } = body as Record<string, unknown>;
  if ((query !== undefined && typeof query !== 'string') || (upc !== undefined && typeof upc !== 'string')) return bad;
  if (upc) {
    const code = upc.replace(/\D/g, '');
    return code.length >= 6 && code.length <= 14 ? { key: `upc:${code}`, upc: code } : bad;
  }
  // Control characters out, whitespace collapsed, capped: the cache key cannot be inflated or varied for free.
  const q = (query ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 100);
  return q ? { key: `q:${q}`, query: q } : bad;
}
