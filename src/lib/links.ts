// Incoming deep links are untrusted. Plain TypeScript: unit-tested.
// 1. expo-router parses query strings with decode-uri-component, which slows down exponentially on
//    malformed percent-encoding (GHSA-vcc3-ghjq-m6fr; no fix on Expo SDK 57). Its slow path only runs when
//    normal decoding fails, so a link that does not decode cleanly, or is absurdly long, goes home.
// 2. The app never takes a session from a link (sign-in, email confirmation and password reset use codes
//    typed into the app). A link carrying auth tokens or codes, e.g. from an old email template or a link
//    crafted to plant someone else's session (session fixation), goes home with the tokens dropped.
const MAX_LINK = 2048;
const AUTH_PARAMS = /[?#&](access_token|refresh_token|provider_token|token_hash|token|code|type|error_code|error_description)=/i;

export function safeLink(path: string): string {
  if (typeof path !== 'string' || path.length > MAX_LINK) return '/';
  try {
    decodeURIComponent(path.replace(/\+/g, ' '));
  } catch {
    return '/';
  }
  return AUTH_PARAMS.test(path) ? '/' : path;
}
