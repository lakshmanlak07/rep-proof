// Session storage for supabase-js on top of the platform secure store (iOS Keychain / Android Keystore).
// Plain TypeScript (no React Native) so it is unit-tested.
// The secure store can refuse values over ~2 KB and a Supabase session is usually bigger, so a value is
// split across numbered entries plus a count entry.

export type SecureKV = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
};
type Legacy = { getItem(key: string): string | null; removeItem(key: string): void };

const CHUNK = 1800;
const safeKey = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, '_'); // secure-store key alphabet

/**
 * `legacy`: the old unencrypted store. A session found there is moved to the secure store once and erased.
 * `freshInstall`: on iOS, Keychain entries survive an uninstall; a fresh install must not inherit them.
 */
export function chunkedStore(secure: SecureKV, legacy?: Legacy, freshInstall = false) {
  const wiped = new Set<string>();
  const count = async (k: string) => Number(await secure.get(`${k}.n`)) || 0;

  async function removeItem(key: string) {
    const k = safeKey(key);
    const n = await count(k);
    await secure.del(`${k}.n`); // count first: a half-removed value then reads as missing
    for (let i = 0; i < n; i++) await secure.del(`${k}.${i}`);
  }

  async function setItem(key: string, value: string) {
    const k = safeKey(key);
    const parts: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK) parts.push(value.slice(i, i + CHUNK));
    if (!parts.length) parts.push('');
    const old = await count(k);
    await secure.del(`${k}.n`);
    for (let i = 0; i < parts.length; i++) await secure.set(`${k}.${i}`, parts[i]);
    await secure.set(`${k}.n`, String(parts.length)); // count last: a half-written value reads as missing, never as a mix
    for (let i = parts.length; i < old; i++) await secure.del(`${k}.${i}`);
  }

  async function getItem(key: string): Promise<string | null> {
    const k = safeKey(key);
    if (freshInstall && !wiped.has(k)) {
      wiped.add(k);
      await removeItem(key);
    }
    const n = await count(k);
    if (n) {
      const parts: string[] = [];
      for (let i = 0; i < n; i++) {
        const p = await secure.get(`${k}.${i}`);
        if (p === null) return null;
        parts.push(p);
      }
      return parts.join('');
    }
    const old = legacy?.getItem(key) ?? null;
    if (old !== null) {
      await setItem(key, old);
      legacy?.removeItem(key);
    }
    return old;
  }

  return { getItem, setItem, removeItem };
}
