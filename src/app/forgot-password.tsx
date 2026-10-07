import type { SupabaseClient } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { useCaptcha, useCountdown } from '@/auth-ui';
import { alert, friendlyAuthError } from '@/lib/alert';
import { cleanCode, emailRequestOutcome, isCode, MIN_PASSWORD, newPasswordProblem, RESEND_SECONDS } from '@/lib/authFlow';
import { recoveryClient } from '@/lib/supabase';
import { Button, C, Field, Screen, T } from '@/ui';

// Password reset with a code from the email, typed into the app. No link carries a session, so nothing
// can be intercepted through the app's URL scheme, and it works when the email is read on another device.
export default function ForgotPassword() {
  const captcha = useCaptcha();
  const cooldown = useCountdown();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Holds the verified recovery session if setting the password fails, so a retry does not need a new code.
  const verified = useRef<SupabaseClient | null>(null);
  // Leaving the screen after a code was verified ends that recovery session on the server too.
  useEffect(() => {
    const pending = verified;
    return () => { pending.current?.auth.signOut({ scope: 'local' }).catch(() => {}); };
  }, []);

  async function sendCode() {
    setBusy(true);
    setError('');
    const { error } = await recoveryClient().auth.resetPasswordForEmail(email.trim(), { captchaToken: captcha.token });
    captcha.reset();
    setBusy(false);
    // Same answer whether or not the address has an account.
    const out = emailRequestOutcome(error);
    if (!out.sent) return setError(out.message);
    verified.current = null;
    setInfo(out.message);
    setStep('code');
    cooldown.start(RESEND_SECONDS);
  }

  async function setNewPassword() {
    const problem = newPasswordProblem(password, confirm);
    if (problem) return setError(problem);
    setBusy(true);
    setError('');
    try {
      let client = verified.current;
      if (!client) {
        client = recoveryClient();
        const v = await client.auth.verifyOtp({ email: email.trim(), token: code, type: 'recovery' });
        if (v.error) return setError(friendlyAuthError(v.error));
        verified.current = client;
      }
      const u = await client.auth.updateUser({ password });
      if (u.error) return setError(friendlyAuthError(u.error));
      // End every session of this account, everywhere: a stolen session stops working now.
      await client.auth.signOut({ scope: 'global' });
      verified.current = null;
      alert('Password changed', 'Sign in with your new password. You have been signed out on your other devices.');
      router.replace('/sign-in?mode=signin');
    } catch {
      setError('Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'email') {
    return (
      <Screen>
        <T size="lg">Reset your password</T>
        <T muted>Enter the email you signed up with. We will send you a code.</T>
        <Field label="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
        {error ? <T style={{ color: C.danger }}>{error}</T> : null}
        <View style={{ flex: 1 }} />
        {captcha.view}
        <Button kind="primary" title="Email me a code" loading={busy} disabled={!email.includes('@') || !captcha.ready} onPress={sendCode} />
        <Button kind="ghost" title="Back to sign in" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <T size="lg">Choose a new password</T>
      <T muted>{info}</T>
      <Field label="Code from the email" keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={10}
        value={code} onChangeText={(t) => { setCode(cleanCode(t)); verified.current = null; }} />
      <Field label="New password" secureTextEntry autoComplete="new-password" value={password} onChangeText={setPassword} />
      <Field label="New password again" secureTextEntry autoComplete="new-password" value={confirm} onChangeText={setConfirm} />
      <T muted size="sm">At least {MIN_PASSWORD} characters, with letters and numbers.</T>
      {error ? <T style={{ color: C.danger }}>{error}</T> : null}
      <View style={{ flex: 1 }} />
      {captcha.view}
      <Button kind="primary" title="Set new password" loading={busy} disabled={!isCode(code) || !password || !confirm} onPress={setNewPassword} />
      <Button kind="ghost" title={cooldown.left > 0 ? `Send a new code in ${cooldown.left}s` : 'Send a new code'}
        disabled={busy || cooldown.left > 0 || !captcha.ready} onPress={sendCode} />
      <Button kind="ghost" title="Use a different email" onPress={() => { setStep('email'); setError(''); }} />
    </Screen>
  );
}
