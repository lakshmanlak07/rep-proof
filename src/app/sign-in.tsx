import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { Button, C, Field, Screen, T } from '@/ui';

export default function SignIn() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const [signUp, setSignUp] = useState(params.mode !== 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError('');
    const creds = { email: email.trim(), password };
    const { data, error } = signUp ? await supabase.auth.signUp(creds) : await supabase.auth.signInWithPassword(creds);
    setBusy(false);
    // Layout switches screens on sign-in; with email confirmation on, sign-up returns no session.
    if (error) setError(error.message);
    else if (signUp && !data.session) setError('Check your email to confirm your account, then sign in.');
  }

  return (
    <Screen>
      <T size="lg">{signUp ? 'Create your account' : 'Sign in'}</T>
      <Field label="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Field label="Password" secureTextEntry autoComplete={signUp ? 'new-password' : 'current-password'} value={password} onChangeText={setPassword} />
      {signUp ? <T muted size="sm">At least 8 characters.</T> : null}
      {error ? <T style={{ color: C.danger }}>{error}</T> : null}
      <View style={{ flex: 1 }} />
      <Button kind="primary" title={signUp ? 'Create account' : 'Sign in'} loading={busy}
        disabled={!email.includes('@') || password.length < (signUp ? 8 : 1)} onPress={submit} />
      <Button kind="ghost" title={signUp ? 'I already have an account' : 'Create an account instead'} onPress={() => { setSignUp(!signUp); setError(''); }} />
    </Screen>
  );
}
