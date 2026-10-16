// Crash reporting to the project's own database (migration 6, `client_errors`): no third-party SDK,
// so no new data processor. Insert-only for the signed-in user, rate-limited and size-capped on the server.
// Reports are scrubbed (lib/scrub.ts) and best effort: reporting never throws or blocks the app.
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { scrub } from './scrub';
import { supabase } from './supabase';

let lastRoute = '';
let sent = 0;
export const setCrashRoute = (route: string) => { lastRoute = route.split('?')[0].slice(0, 120); };

export async function reportError(error: unknown, where: string) {
  if (sent >= 10) return; // one crash loop must not flood the table (the server also caps 50 a day)
  sent++;
  try {
    const e = error instanceof Error ? error : new Error(String(error));
    const { data } = await supabase.auth.getSession();
    if (!data.session) return; // signed out: nothing is sent
    await supabase.from('client_errors').insert({
      message: scrub(`${e.name}: ${e.message}`, 500),
      stack: e.stack ? scrub(e.stack, 4000) : null,
      context: { where, route: lastRoute, platform: Platform.OS, version: Constants.expoConfig?.version ?? null },
    });
  } catch {
    // never let reporting cause a second failure
  }
}

type Handler = (error: Error, isFatal?: boolean) => void;
type ErrorUtilsLike = { getGlobalHandler: () => Handler; setGlobalHandler: (h: Handler) => void };

/** Reports uncaught JS errors and unhandled promise rejections, then lets the default handler run. */
let installed = false;
export function installCrashReporting() {
  if (installed) return; // a module reload must not wrap the handler twice (double reports)
  installed = true;
  const eu = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (eu) {
    const prev = eu.getGlobalHandler();
    eu.setGlobalHandler((error, isFatal) => {
      reportError(error, isFatal ? 'fatal' : 'global');
      prev(error, isFatal);
    });
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('error', (e) => reportError(e.error ?? e.message, 'window'));
    window.addEventListener('unhandledrejection', (e) => reportError(e.reason, 'promise'));
  }
}
