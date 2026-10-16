// Builds the public pages Google Play needs (privacy policy, account deletion) into site/dist from the same
// policy text the app shows (src/lib/privacyPolicy.ts). Nothing is published by this script.
//   SUPPORT_EMAIL=you@example.com node scripts/build-site.mjs
// The owner chooses the contact address; the build refuses to run without one so no placeholder ships.
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { POLICY, POLICY_UPDATED } from '../src/lib/privacyPolicy.ts';

const email = process.env.SUPPORT_EMAIL ?? '';
if (!/^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(email)) {
  console.error('Set SUPPORT_EMAIL to the address users should contact for privacy and deletion requests.');
  process.exit(1);
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title === 'RepProof' ? 'RepProof' : `${esc(title)} · RepProof`}</title>
<link rel="icon" href="favicon.png">
<style>
:root{--bg:#FBF6F1;--ink:#2A1620;--muted:#5E4A53;--brand:#7A1F3D;--line:#E9DDD3;--card:#fff}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:720px;margin:0 auto;padding:32px 20px 64px}
h1{font-size:32px;line-height:1.2;margin:8px 0 4px}h2{font-size:20px;margin:0 0 8px}
.brand{color:var(--brand);font-weight:700}.muted{color:var(--muted)}
section{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:20px;margin:16px 0}
a{color:var(--brand)}ol li{margin:6px 0}
</style></head><body><main><div class="brand">RepProof</div>${body}</main></body></html>\n`;

const privacy = page('Privacy policy', `<h1>Privacy policy</h1><p class="muted">Last updated ${esc(POLICY_UPDATED)}</p>
${POLICY.map((s) => `<section><h2>${esc(s.title)}</h2>${s.body.map((p) => `<p>${esc(p)}</p>`).join('')}</section>`).join('\n')}
<section><h2>Contact</h2><p>Email <a href="mailto:${esc(email)}">${esc(email)}</a>. To delete your account, see <a href="delete-account.html">account deletion</a>.</p></section>`);

const subject = encodeURIComponent('RepProof account deletion request');
const deletion = page('Delete your account', `<h1>Delete your RepProof account</h1>
<p class="muted">This page is for RepProof, the strength-training and nutrition app.</p>
<section><h2>In the app (immediate)</h2><ol>
<li>Open RepProof and sign in.</li><li>Tap your avatar on Home to open <b>Account</b>.</li>
<li>Tap <b>Your data</b>, then <b>Delete account and all data</b>, and confirm.</li></ol>
<p>Your account is deleted straight away.</p></section>
<section><h2>Without the app</h2>
<p>Email <a href="mailto:${esc(email)}?subject=${subject}">${esc(email)}</a> from the email address on your RepProof account, with the subject "RepProof account deletion request".
We only act on requests from the account's own address, and delete the account within 30 days. We will reply to confirm.</p></section>
<section><h2>What is deleted</h2>
<p>Everything linked to the account: sign-in details, training profile, plans, workouts and sets, check-ins, food logs and saved meals, cardio and bodyweight entries, feedback, usage events and crash reports. Nothing is kept afterwards, except short-lived server logs held by our hosting provider for security, which expire on their schedule.</p>
<p>Want a copy first? In the app: Account, Your data, Download my data.</p></section>
<p><a href="privacy.html">Privacy policy</a></p>`);

const out = fileURLToPath(new URL('../site/dist/', import.meta.url));
mkdirSync(out, { recursive: true });
writeFileSync(out + 'privacy.html', privacy);
writeFileSync(out + 'delete-account.html', deletion);
copyFileSync(fileURLToPath(new URL('../assets/images/favicon.png', import.meta.url)), out + 'favicon.png');
writeFileSync(out + 'index.html', page('RepProof', `<h1>RepProof</h1><p>Evidence-based strength training and nutrition.</p><p><a href="privacy.html">Privacy policy</a> · <a href="delete-account.html">Delete your account</a></p>`));
console.log(`Built site/dist (privacy.html, delete-account.html, index.html) for ${email.replace(/^(.).*@/, '$1***@')}`);
