import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

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
  return message;
}

export default function SignIn() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const [method, setMethod] = useState<Method>('email');
  const [signUp, setSignUp] = useState(params.mode !== 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submitEmail() {
    setBusy(true);
    setError('');
    const creds = { email: email.trim(), password };
    const { data, error } = signUp ? await supabase.auth.signUp(creds) : await supabase.auth.signInWithPassword(creds);
    setBusy(false);
    // Layout switches screens on sign-in; with email confirmation on, sign-up returns no session.
    if (error) setError(error.message);
    else if (signUp && !data.session) setError('Check your email to confirm your account, then sign in.');
  }

  // Phone: one flow for new and returning users. Supabase texts a 6-digit code.
  async function sendCode() {
    const number = normalizePhone(phone);
    if (!number) return setError('Enter your number with country code, e.g. +44 7700 900123.');
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({ phone: number });
    setBusy(false);
    if (error) return setError(phoneError(error.message));
    setCodeSent(true);
  }

  async function verifyCode() {
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.verifyOtp({ phone: normalizePhone(phone)!, token: code.trim(), type: 'sms' });
    setBusy(false);
    if (error) setError(/expired|invalid/i.test(error.message) ? 'That code is wrong or expired. Request a new one.' : error.message);
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
        {signUp ? <T muted size="sm">At least 8 characters.</T> : null}
      </>) : !codeSent ? (<>
        <Field label="Mobile number" keyboardType="phone-pad" autoComplete="tel" placeholder="+44 7700 900123" value={phone} onChangeText={setPhone} />
        <T muted size="sm">Include your country code. Standard text rates may apply.</T>
      </>) : (<>
        <T muted>Code sent to {normalizePhone(phone)}.</T>
        <Field label="6-digit code" keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" maxLength={6} value={code} onChangeText={setCode} />
        <Button kind="ghost" title="Use a different number" onPress={() => { setCodeSent(false); setCode(''); setError(''); }} />
      </>)}

      {error ? <T style={{ color: C.danger }}>{error}</T> : null}
      <View style={{ flex: 1 }} />

      {method === 'email' ? (<>
        <Button kind="primary" title={signUp ? 'Create account' : 'Sign in'} loading={busy}
          disabled={!email.includes('@') || password.length < (signUp ? 8 : 1)} onPress={submitEmail} />
        <Button kind="ghost" title={signUp ? 'I already have an account' : 'Create an account instead'} onPress={() => {
          // New accounts go through the age gate and disclaimer first.
          if (!signUp && !getPending()?.disclaimerAt) return router.replace('/age');
          setSignUp(!signUp);
          setError('');
        }} />
      </>) : !codeSent ? (
        <Button kind="primary" title="Text me a code" loading={busy} disabled={!normalizePhone(phone)} onPress={sendCode} />
      ) : (<>
        <Button kind="primary" title="Continue" loading={busy} disabled={code.trim().length !== 6} onPress={verifyCode} />
        <Button kind="ghost" title="Send a new code" disabled={busy} onPress={sendCode} />
      </>)}
    </Screen>
  );
}
