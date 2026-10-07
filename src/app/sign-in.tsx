import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useCaptcha, useCountdown } from '@/auth-ui';
import { friendlyAuthError } from '@/lib/alert';
import { cleanCode, emailRequestOutcome, isCode, MIN_PASSWORD, RESEND_SECONDS } from '@/lib/authFlow';
import { getPending } from '@/lib/pending';
import { supabase } from '@/lib/supabase';
import { Button, C, Choice, Field, Screen, T } from '@/ui';

type Method = 'email' | 'phone';

// International format: + country code + number, 8-15 digits (E.164).
const normalizePhone = (raw: string) => {
  const digits = raw.replace(/[^\d+]/g, '');
  return /^\+\d{8,15}$/.test(digits) ? digits : null;
};

function phoneError(message: string) {
  // Supabase answers this way until a phone/SMS provider is enabled in the dashboard.
  if (/phone.*(disabled|not enabled)|unsupported phone provider|sms provider/i.test(message)) {
    return 'Phone sign-in is not switched on yet. Use email for now.';
  }
  return friendlyAuthError({ message });
}

export default function SignIn() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const captcha = useCaptcha();
  const cooldown = useCountdown();
  const [method, setMethod] = useState<Method>('email');
  const [signUp, setSignUp] = useState(params.mode !== 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false); // phone code sent
  const [confirming, setConfirming] = useState(false); // waiting for the email confirmation code
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  function startConfirm(message: string) {
    setConfirming(true);
    setCode('');
    setInfo(message);
    cooldown.start(RESEND_SECONDS);
  }

  async function submitEmail() {
    setBusy(true);
    setError('');
    const creds = { email: email.trim(), password, options: { captchaToken: captcha.token } };
    const { data, error } = signUp ? await supabase.auth.signUp(creds) : await supabase.auth.signInWithPassword(creds);
    captcha.reset(); // tokens are single-use
    setBusy(false);
    // Only someone who typed the right password gets this answer, so it reveals nothing to a stranger.
    if (error?.code === 'email_not_confirmed') return startConfirm('Enter the code we emailed you to finish setting up your account.');
    if (error) return setError(friendlyAuthError(error));
    // With email confirmation on, sign-up returns no session, for new and already-registered addresses alike.
    if (signUp && !data.session) startConfirm(`We have sent a code to ${email.trim()}. Enter it to finish creating your account. (Already have an account with this email? Sign in instead.)`);
    // Otherwise the layout switches screens on sign-in.
  }

  async function confirmEmail() {
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: 'signup' });
    setBusy(false);
    if (error) setError(friendlyAuthError(error));
  }

  async function resendConfirmation() {
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { captchaToken: captcha.token } });
    captcha.reset();
    setBusy(false);
    const out = emailRequestOutcome(error);
    if (out.sent) { setInfo(out.message); cooldown.start(RESEND_SECONDS); } else setError(out.message);
  }

  // Phone: one flow for new and returning users. Supabase texts a 6-digit code.
  async function sendCode() {
    const number = normalizePhone(phone);
    if (!number) return setError('Enter your number with country code, e.g. +44 7700 900123.');
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({ phone: number, options: { captchaToken: captcha.token } });
    captcha.reset();
    setBusy(false);
    if (error) return setError(phoneError(error.message));
    setCodeSent(true);
    cooldown.start(RESEND_SECONDS);
  }

  async function verifyCode() {
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.verifyOtp({ phone: normalizePhone(phone)!, token: code, type: 'sms' });
    setBusy(false);
    if (error) setError(friendlyAuthError(error));
  }

  if (confirming) {
    return (
      <Screen>
        <T size="lg">Confirm your email</T>
        {info ? <T muted>{info}</T> : null}
        <Field label="Code from the email" keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={10}
          value={code} onChangeText={(t) => setCode(cleanCode(t))} />
        {error ? <T style={{ color: C.danger }}>{error}</T> : null}
        <View style={{ flex: 1 }} />
        {captcha.view}
        <Button kind="primary" title="Confirm" loading={busy} disabled={!isCode(code)} onPress={confirmEmail} />
        <Button kind="ghost" title={cooldown.left > 0 ? `Send a new code in ${cooldown.left}s` : 'Send a new code'}
          disabled={busy || cooldown.left > 0 || !captcha.ready} onPress={resendConfirmation} />
        <Button kind="ghost" title="Use a different email" onPress={() => { setConfirming(false); setError(''); setInfo(''); }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <T size="lg">{method === 'phone' ? 'Continue with your phone' : signUp ? 'Create your account' : 'Sign in'}</T>
      <Choice value={method} onChange={(m) => { setMethod(m); setError(''); }} options={[
        { value: 'email', label: 'Email and password' },
        { value: 'phone', label: 'Mobile number', hint: 'We text you a code' },
      ]} />

      {method === 'email' ? (<>
        <Field label="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <Field label="Password" secureTextEntry autoComplete={signUp ? 'new-password' : 'current-password'} value={password} onChangeText={setPassword} />
        {signUp ? <T muted size="sm">At least {MIN_PASSWORD} characters, with letters and numbers.</T>
          : <Button kind="ghost" title="Forgot password?" onPress={() => router.push('/forgot-password')} />}
      </>) : !codeSent ? (<>
        <Field label="Mobile number" keyboardType="phone-pad" autoComplete="tel" placeholder="+44 7700 900123" value={phone} onChangeText={setPhone} />
        <T muted size="sm">Include your country code. Standard text rates may apply.</T>
      </>) : (<>
        <T muted>Code sent to {normalizePhone(phone)}.</T>
        <Field label="6-digit code" keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" maxLength={6} value={code} onChangeText={(t) => setCode(cleanCode(t))} />
        <Button kind="ghost" title="Use a different number" onPress={() => { setCodeSent(false); setCode(''); setError(''); }} />
      </>)}

      {error ? <T style={{ color: C.danger }}>{error}</T> : null}
      <View style={{ flex: 1 }} />
      {method === 'phone' && codeSent ? null : captcha.view}

      {method === 'email' ? (<>
        <Button kind="primary" title={signUp ? 'Create account' : 'Sign in'} loading={busy}
          disabled={!email.includes('@') || password.length < (signUp ? MIN_PASSWORD : 1) || !captcha.ready} onPress={submitEmail} />
        <Button kind="ghost" title={signUp ? 'I already have an account' : 'Create an account instead'} onPress={() => {
          // New accounts go through the age gate and disclaimer first.
          if (!signUp && !getPending()?.disclaimerAt) return router.replace('/age');
          setSignUp(!signUp);
          setError('');
        }} />
      </>) : !codeSent ? (
        <Button kind="primary" title="Text me a code" loading={busy} disabled={!normalizePhone(phone) || !captcha.ready} onPress={sendCode} />
      ) : (<>
        <Button kind="primary" title="Continue" loading={busy} disabled={code.length !== 6} onPress={verifyCode} />
        <Button kind="ghost" title={cooldown.left > 0 ? `Send a new code in ${cooldown.left}s` : 'Send a new code'}
          disabled={busy || cooldown.left > 0} onPress={() => { setCodeSent(false); setCode(''); }} />
      </>)}
    </Screen>
  );
}
