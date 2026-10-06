// Incoming deep links are untrusted. expo-router parses query strings with decode-uri-component, which
// slows down exponentially on malformed percent-encoding (GHSA-vcc3-ghjq-m6fr; no fix on Expo SDK 57).
// Its slow path only runs when normal decoding fails, so a link that does not decode cleanly, or is
// absurdly long, is sent to the home screen instead of being parsed. Plain TypeScript: unit-tested.
const MAX_LINK = 2048;

export function safeLink(path: string): string {
  if (typeof path !== 'string' || path.length > MAX_LINK) return '/';
  try {
    decodeURIComponent(path.replace(/\+/g, ' '));
    return path;
  } catch {
    return '/';
  }
}
