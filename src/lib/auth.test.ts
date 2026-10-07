// Security regression tests for authentication: password reset, email confirmation, CAPTCHA, deep links,
// session sources. Run with `npm test`.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { cleanCode, emailRequestOutcome, isCode, newPasswordProblem } from './authFlow.ts';
import { CAPTCHA_ORIGIN, captchaMayLoad, parseCaptchaMessage, turnstileHtml } from './captcha.ts';
import { friendlyAuthError } from './errors.ts';
import { safeLink } from './links.ts';

const srcFiles = () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(f) && !f.endsWith('.test.ts')) files.push(p);
    }
  };
  walk(fileURLToPath(new URL('..', import.meta.url)));
  return files.map((f) => ({ f, text: readFileSync(f, 'utf8') }));
};

test('auth error messages: specific where safe, never raw', () => {
  const cases: [{ code: string; message: string; status: number }, RegExp][] = [
    [{ code: 'captcha_failed', message: 'captcha protection: request disallowed (invalid-input-response)', status: 400 }, /security check/],
    [{ code: 'over_email_send_rate_limit', message: 'For security purposes, you can only request this after 37 seconds.', status: 429 }, /wait a minute/],
    [{ code: 'otp_expired', message: 'Token has expired or is invalid', status: 403 }, /wrong or expired/],
    [{ code: 'same_password', message: 'New password should be different from the old password.', status: 422 }, /not used/],
    [{ code: 'weak_password', message: 'Password should be at least 10 characters.', status: 422 }, /at least 10/],
    [{ code: 'over_request_rate_limit', message: 'Request rate limit reached', status: 429 }, /Too many attempts/],
  ];
  for (const [e, want] of cases) {
    const shown = friendlyAuthError(e);
    assert.match(shown, want);
    assert.ok(!shown.includes(e.message), shown);
  }
});

test('"email me a code" answers the same whether or not the account exists', () => {
  const exists = emailRequestOutcome(null);
  const unknown = emailRequestOutcome({ code: 'user_not_found', message: 'User not found', status: 404 });
  const other = emailRequestOutcome({ code: 'validation_failed', message: 'Unable to process request', status: 400 });
  assert.deepEqual(unknown, exists);
  assert.deepEqual(other, exists);
  assert.ok(exists.sent && !/exists|registered|found/i.test(exists.message));
  // Problems that say nothing about the account are shown, and nothing pretends to have been sent.
  assert.equal(emailRequestOutcome({ code: 'over_email_send_rate_limit', message: 'only request this after 40 seconds', status: 429 }).sent, false);
  assert.equal(emailRequestOutcome({ code: 'captcha_failed', message: 'captcha protection: request disallowed', status: 400 }).sent, false);
  assert.equal(emailRequestOutcome({ code: 'email_address_invalid', message: 'Email address is invalid', status: 400 }).sent, false);
  assert.equal(emailRequestOutcome({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' }).sent, false);
});

test('reset codes and new passwords', () => {
  assert.equal(cleanCode(' 12 34-56 '), '123456');
  assert.ok(isCode('123456') && isCode('1234567890'));
  assert.ok(!isCode('12345') && !isCode('12345678901') && !isCode('12a456'));
  assert.match(String(newPasswordProblem('short1', 'short1')), /10 characters/);
  assert.match(String(newPasswordProblem('onlyletterspassword', 'onlyletterspassword')), /letters and numbers/);
  assert.match(String(newPasswordProblem('goodpassword1', 'goodpassword2')), /match/);
  assert.equal(newPasswordProblem('goodpassword1', 'goodpassword1'), null);
});

test('CAPTCHA page: only a validated site key is inserted', () => {
  const html = turnstileHtml('0x4AAAAAAABkMYinukE8nzY');
  assert.ok(html.includes('sitekey:"0x4AAAAAAABkMYinukE8nzY"'));
  assert.ok(html.includes('https://challenges.cloudflare.com/turnstile/v0/api.js'));
  for (const bad of ['', 'short', '"};alert(1);//aaaaaaaa', '</script><script>x()</script>', 'a'.repeat(101), '0x4AAA BBB CCC']) {
    assert.throws(() => turnstileHtml(bad), bad);
  }
});

test('CAPTCHA messages from the WebView are validated', () => {
  const token = '0.' + 'a'.repeat(40) + '_-:.Z9';
  assert.deepEqual(parseCaptchaMessage(JSON.stringify({ type: 'token', token })), { type: 'token', token });
  assert.deepEqual(parseCaptchaMessage('{"type":"expired"}'), { type: 'expired' });
  assert.deepEqual(parseCaptchaMessage('{"type":"error"}'), { type: 'error' });
  for (const bad of ['', 'nope', '{"type":"token"}', '{"type":"token","token":"short"}', JSON.stringify({ type: 'token', token: 'a b'.repeat(20) }),
    JSON.stringify({ type: 'token', token: 'x'.repeat(5000) }), '{"type":"navigate","url":"https://evil.example"}', 'null', '[]']) {
    assert.equal(parseCaptchaMessage(bad), null, bad);
  }
  assert.equal(parseCaptchaMessage({ type: 'token' }), null);
});

test('CAPTCHA WebView cannot be navigated away', () => {
  assert.ok(captchaMayLoad('about:blank') && captchaMayLoad('about:srcdoc') && captchaMayLoad(CAPTCHA_ORIGIN));
  assert.ok(captchaMayLoad('https://challenges.cloudflare.com/cdn-cgi/challenge-platform/x'));
  for (const bad of ['https://evil.example', 'https://challenges.cloudflare.com.evil.example/', 'http://challenges.cloudflare.com/', 'javascript:alert(1)',
    `${CAPTCHA_ORIGIN}.evil.example/`, 'file:///etc/passwd', 'repproof://reset']) {
    assert.equal(captchaMayLoad(bad), false, bad);
  }
});

test('links carrying auth tokens or codes never reach the router (no session from a link)', () => {
  for (const bad of [
    'repproof://#access_token=eyJabc&refresh_token=r1&type=recovery',
    'repproof://reset?token_hash=pkce_abc&type=recovery',
    'repproof://auth/callback?code=4f1e-abc',
    'repproof://#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid',
    '/sign-in?refresh_token=attacker',
  ]) assert.equal(safeLink(bad), '/', bad);
  assert.equal(safeLink('/sign-in?mode=signin'), '/sign-in?mode=signin');
});

test('every CAPTCHA-protected auth call sends a CAPTCHA token', () => {
  // Supabase checks CAPTCHA on sign-up, password sign-in, OTP, password recovery and resend.
  const gated = /auth\.(signUp|signInWithPassword|signInWithOtp|resetPasswordForEmail|resend)\(/g;
  let found = 0;
  for (const { f, text } of srcFiles()) {
    for (const m of text.matchAll(gated)) {
      found++;
      const around = text.slice(Math.max(0, m.index - 300), m.index + 250);
      assert.ok(/captchaToken: captcha\.token/.test(around), `${f}: ${m[0]} without captchaToken`);
    }
  }
  assert.ok(found >= 5, `found ${found} gated calls`);
});

test('sessions only come from the app\'s own API calls, and a reset ends every session', () => {
  const all = srcFiles();
  for (const { f, text } of all) {
    assert.ok(!/detectSessionInUrl:\s*true/.test(text), f);
    assert.ok(!/\.setSession\(|exchangeCodeForSession\(/.test(text), `${f} takes a session from outside`);
  }
  const reset = all.find(({ f }) => f.endsWith('forgot-password.tsx'));
  assert.ok(reset);
  assert.match(reset.text, /signOut\(\{ scope: 'global' \}\)/);
  assert.match(reset.text, /recoveryClient\(\)/, 'recovery session stays out of device storage');
});
