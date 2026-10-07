// Cloudflare Turnstile inside a WebView, for Supabase Auth's CAPTCHA. Plain TypeScript: unit-tested.
// The WebView page is built here from a validated site key only; nothing else is interpolated into it.

/** The page's origin. Add this hostname to the Turnstile widget's allowed hostnames in Cloudflare. */
export const CAPTCHA_ORIGIN = 'https://repproof.app';

const SITE_KEY = /^[0-9A-Za-z_-]{10,100}$/;
export const isSiteKey = (k: string) => SITE_KEY.test(k);

export function turnstileHtml(siteKey: string): string {
  if (!isSiteKey(siteKey)) throw new Error('invalid Turnstile site key');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=start&render=explicit" async defer></script>
<style>html,body{margin:0;background:transparent;display:flex;justify-content:center}</style></head>
<body><div id="w"></div><script>
function post(m){window.ReactNativeWebView.postMessage(JSON.stringify(m));}
function start(){turnstile.render('#w',{sitekey:${JSON.stringify(siteKey)},theme:'light',
  callback:function(t){post({type:'token',token:t});},
  'expired-callback':function(){post({type:'expired'});},
  'timeout-callback':function(){post({type:'expired'});},
  'error-callback':function(){post({type:'error'});return true;}});}
setTimeout(function(){if(!window.turnstile)post({type:'error'});},15000);
</script></body></html>`;
}

export type CaptchaEvent = { type: 'token'; token: string } | { type: 'expired' } | { type: 'error' };

/** Messages from the WebView are checked before use: a token is a bounded run of URL-safe characters. */
export function parseCaptchaMessage(data: unknown): CaptchaEvent | null {
  if (typeof data !== 'string' || data.length > 5000) return null;
  let m: unknown;
  try {
    m = JSON.parse(data);
  } catch {
    return null;
  }
  const { type, token } = (m ?? {}) as { type?: unknown; token?: unknown };
  if (type === 'token') return typeof token === 'string' && /^[A-Za-z0-9._:-]{20,4096}$/.test(token) ? { type, token } : null;
  return type === 'expired' || type === 'error' ? { type } : null;
}

/** The WebView may only load the page itself and Cloudflare's challenge; every other navigation is blocked. */
export function captchaMayLoad(url: string): boolean {
  return url === 'about:blank' || url.startsWith('about:srcdoc') || url.startsWith(`${CAPTCHA_ORIGIN}/`) || url === CAPTCHA_ORIGIN
    || url.startsWith('https://challenges.cloudflare.com/');
}
