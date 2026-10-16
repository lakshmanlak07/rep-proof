// Public web pages (privacy policy, account deletion). Set once they are hosted (see site/README.md);
// until then the app shows the policy itself and points to in-app deletion. Never a guessed URL.
const url = (v: string | undefined) => (v && /^https:\/\/[^\s]+$/.test(v) ? v : null);
export const PRIVACY_URL = url(process.env.EXPO_PUBLIC_PRIVACY_URL);
export const DELETE_ACCOUNT_URL = url(process.env.EXPO_PUBLIC_DELETE_ACCOUNT_URL);
