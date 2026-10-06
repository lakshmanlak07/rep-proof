// npm run test:db -- emulates the bits of Supabase the migrations rely on, then runs migrations 1-4 and the security tests.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const repo = fileURLToPath(new URL('..', import.meta.url));
const db = new PGlite();
const notices = [];
const stub = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant anon, authenticated to current_user;
create schema auth; grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key, email text, aud text, role text, instance_id uuid, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid $$;
create function auth.role() returns text language sql stable as $$
  select current_setting('request.jwt.claims', true)::jsonb ->> 'role' $$;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
`;
await db.exec(stub);
for (const f of readdirSync(repo + 'migrations').sort()) {
  try { await db.exec(readFileSync(`${repo}migrations/${f}`, 'utf8')); console.log('applied', f); }
  catch (e) { console.log('MIGRATION FAILED', f, e.message); process.exit(1); }
}
const tests = readFileSync(`${repo}tests/security_tests.sql`, 'utf8');
try {
  await db.exec(tests, { onNotice: (n) => notices.push(n.message) });
} catch (e) { console.log(notices.join('\n')); console.log('TEST ERROR:', e.message); process.exit(1); }
console.log(notices.join('\n'));
