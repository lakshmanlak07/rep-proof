// Plain TypeScript (no React Native), unit-tested in security.test.ts.

/** Long enough for a slow mobile network and a full data export; short enough that nothing spins forever. */
export const TIMEOUT_MS = 20_000;

/**
 * fetch with a deadline. React Native's fetch never times out, so a dead connection would leave a spinner
 * up for good; this aborts it, and the caller sees an ordinary network error. A caller's own signal still works.
 */
export function timedFetch(base?: typeof fetch, ms = TIMEOUT_MS): typeof fetch {
  return (input, init) => {
    const ctrl = new AbortController();
    const outer = init?.signal;
    if (outer?.aborted) ctrl.abort();
    else outer?.addEventListener('abort', () => ctrl.abort(), { once: true });
    // The timer is not cleared when headers arrive: Expo's fetch streams the body, and a body that stalls must be
    // cut off too. Aborting a finished request does nothing. unref: never keeps a Node test process alive.
    const timer = setTimeout(() => ctrl.abort(), ms);
    (timer as { unref?: () => void }).unref?.();
    return (base ?? fetch)(input, { ...init, signal: ctrl.signal });
  };
}
