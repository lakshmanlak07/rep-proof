// npm run scan:secrets [-- --history] [-- <built bundle dir>]
// Fails if a server-side secret appears in tracked files, in git history (--history), or in a built bundle.
// The Supabase URL and publishable key are public by design (they ship inside the app) and are allowed.
// Matches are reported by file and rule only; the value itself is never printed.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RULES = [
  ['Supabase secret key', /sb_secret_[A-Za-z0-9-][A-Za-z0-9_-]{19,}/], // library code has the bare prefix next to '_internal...'
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/],
  ['AWS access key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{50,})\b/],
  ['Stripe live key', /\b[sr]k_live_[A-Za-z0-9]{20,}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Twilio auth token', /\bTWILIO_AUTH_TOKEN\s*=\s*\S{16,}/],
  ['USDA key value', /\bFDC_API_KEY\s*=\s*[A-Za-z0-9]{20,}/],
  ['database URL with password', /postgres(?:ql)?:\/\/[^:\s/]+:[^@\s]{6,}@/],
];
// JWTs: the legacy service_role key (and any JWT for it) is a secret; the legacy anon key is not.
const JWT = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
const isServiceJwt = (t) => {
  try {
    return /service_role|supabase_admin/.test(Buffer.from(t.split('.')[1], 'base64url').toString());
  } catch {
    return false;
  }
};

function scan(text, where, hits) {
  for (const [rule, re] of RULES) if (re.test(text)) hits.push(`${where}: ${rule}`);
  for (const t of text.match(JWT) ?? []) if (isServiceJwt(t)) hits.push(`${where}: service_role JWT`);
}

const hits = [];
const args = process.argv.slice(2);
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 30 });

// 1. Tracked files.
for (const f of git('ls-files', '-z').split('\0').filter(Boolean)) {
  if (/\.(png|jpe?g|gif|webp|ico|ttf|otf|woff2?|mp4|zip)$/i.test(f)) continue;
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  scan(text, f, hits);
}

// 2. .env is committed so EAS builds get the public config; it may hold nothing else.
try {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const name = line.split('=')[0].trim();
    if (!name || name.startsWith('#')) continue;
    if (!['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'].includes(name)) hits.push(`.env: unexpected variable ${name} (server secrets belong in Supabase secrets)`);
    if (name === 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY' && !/=\s*(sb_publishable_|eyJ)/.test(line)) hits.push('.env: publishable key has an unexpected format');
  }
} catch {
  // no .env: nothing to check
}

// 3. Every version of every file ever committed.
if (args.includes('--history')) scan(git('log', '--all', '-p', '--no-color'), 'git history', hits);

// 4. Built bundles (e.g. the output of `npx expo export`).
for (const dir of args.filter((a) => !a.startsWith('--'))) {
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else scan(readFileSync(p, 'latin1'), p, hits);
    }
  };
  walk(dir);
}

if (hits.length) {
  console.error(`Possible secrets found (values not shown):\n${[...new Set(hits)].map((h) => `  ${h}`).join('\n')}`);
  process.exit(1);
}
console.log('Secret scan: clean.');
