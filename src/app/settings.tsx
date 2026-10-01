import 'expo-sqlite/localStorage/install';

import { Alert, Linking } from 'react-native';

import { useData } from '@/lib/data';
import { DISCLAIMER } from '@/lib/pending';
import { supabase } from '@/lib/supabase';
import { Button, Card, Screen, T } from '@/ui';

// Where the in-app feedback button sends email. Empty = button hidden.
const FEEDBACK_EMAIL = '';

const clearLocal = () => localStorage.removeItem('draft_workout');

export default function Settings() {
  const { session, profile } = useData();

  function deleteAccount() {
    Alert.alert('Delete your account?', 'This permanently deletes your account, plan and every logged workout. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.rpc('delete_account');
          if (error) return Alert.alert('Could not delete', error.message);
          clearLocal();
          await supabase.auth.signOut();
        },
      },
    ]);
  }

  return (
    <Screen edges={['bottom']}>
      <Card>
        <T muted size="sm">SIGNED IN AS</T>
        <T>{session?.user.email}</T>
        <T muted size="sm">Weights in {profile?.unit} · Plan: {profile?.plan_tier}</T>
      </Card>
      <Card>
        <T bold>Disclaimer</T>
        <T muted>{DISCLAIMER}</T>
      </Card>
      {FEEDBACK_EMAIL ? (
        <Button title="Send feedback" onPress={() => Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=RepProof%20beta%20feedback`)} />
      ) : null}
      <Button title="Sign out" onPress={() => { clearLocal(); supabase.auth.signOut(); }} />
      <Button title="Delete account" kind="danger" onPress={deleteAccount} />
    </Screen>
  );
}
