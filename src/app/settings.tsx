import 'expo-sqlite/localStorage/install';

import { router } from 'expo-router';

import { useData } from '@/lib/data';
import { DISCLAIMER } from '@/lib/pending';
import { supabase } from '@/lib/supabase';
import { alert } from '@/lib/alert';
import { Button, Card, Screen, T } from '@/ui';

// Everything this device keeps between sessions (see workout.tsx and lib/pending.ts).
const clearLocal = () => ['draft_workout', 'missed_choice', 'pending_onboarding'].forEach((k) => localStorage.removeItem(k));

export default function Settings() {
  const { session, profile } = useData();

  function deleteAccount() {
    alert('Delete your account?', 'This permanently deletes your account, plan and every logged workout. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.rpc('delete_account');
          if (error) return alert('Could not delete', error.message);
          clearLocal();
          // The account no longer exists server-side, so only clear this device's session.
          await supabase.auth.signOut({ scope: 'local' });
        },
      },
    ]);
  }

  return (
    <Screen edges={['bottom']}>
      <Card>
        <T muted size="sm">SIGNED IN AS</T>
        <T>{session?.user.email || session?.user.phone}</T>
        <T muted size="sm">Weights in {profile?.unit} · Plan: {profile?.plan_tier}</T>
      </Card>
      <Card>
        <T bold>Disclaimer</T>
        <T muted>{DISCLAIMER}</T>
      </Card>
      <Button title="Edit training profile" onPress={() => router.push('/training')} />
      <Button title="The science behind RepProof" onPress={() => router.push('/science')} />
      <Button title="Send feedback" onPress={() => router.push('/feedback')} />
      <Button title="Sign out" onPress={() => { clearLocal(); supabase.auth.signOut(); }} />
      <Button title="Delete account" kind="danger" onPress={deleteAccount} />
    </Screen>
  );
}
