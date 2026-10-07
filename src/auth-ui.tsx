import { useCallback, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { CAPTCHA_ORIGIN, captchaMayLoad, isSiteKey, parseCaptchaMessage, turnstileHtml } from '@/lib/captcha';
import { Button, T } from '@/ui';

// Public site key (safe to ship). Leave it unset and no check is shown or sent: Supabase ignores tokens
// until CAPTCHA is switched on in the dashboard, so ship a build with the key first, switch it on second.
const SITE_KEY = (process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '').trim();
export const CAPTCHA_ON = Platform.OS !== 'web' && isSiteKey(SITE_KEY);

/**
 * Turnstile security check for Supabase Auth. Tokens are single-use and expire after 5 minutes:
 * call reset() after every request that used one. If the check fails to load, the user gets a retry button,
 * never a dead end.
 */
export function useCaptcha() {
  const [token, setToken] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [run, setRun] = useState(0); // new key = fresh WebView = fresh token
  const reset = useCallback(() => {
    setToken(null);
    setFailed(false);
    setRun((n) => n + 1);
  }, []);

  const view = CAPTCHA_ON ? (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <View style={{ width: 304, height: 70 }}>
        <WebView
          key={run}
          source={{ html: turnstileHtml(SITE_KEY), baseUrl: CAPTCHA_ORIGIN }}
          originWhitelist={['https://*', 'about:*']}
          onShouldStartLoadWithRequest={(r) => captchaMayLoad(r.url)}
          setSupportMultipleWindows={false}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          scrollEnabled={false}
          style={{ backgroundColor: 'transparent' }}
          onMessage={(e) => {
            const m = parseCaptchaMessage(e.nativeEvent.data);
            if (m?.type === 'token') setToken(m.token);
            else if (m?.type === 'expired') setToken(null);
            else if (m?.type === 'error') { setToken(null); setFailed(true); }
          }}
          onError={() => setFailed(true)}
        />
      </View>
      {failed ? (<>
        <T muted size="sm">The security check could not finish. Check your connection, then try it again.</T>
        <Button kind="ghost" title="Try the check again" onPress={reset} />
      </>) : null}
    </View>
  ) : null;

  return { ready: !CAPTCHA_ON || !!token, token: token ?? undefined, view, reset };
}

/** Seconds until another email may be requested; start(n) begins a countdown. */
export function useCountdown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return { left, start: setLeft };
}
