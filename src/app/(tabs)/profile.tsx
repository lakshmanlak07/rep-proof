import 'expo-sqlite/localStorage/install';

import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { SPLIT_NAMES } from '@/engine/plan.ts';
import { alert, friendlyError } from '@/lib/alert';
import { useData } from '@/lib/data';
import { DISCLAIMER } from '@/lib/pending';
import { firstName } from '@/lib/insights';
import { EXPERIENCE_OPTIONS, GOAL_OPTIONS, SETUP_OPTIONS } from '@/lib/options';
import { supabase } from '@/lib/supabase';
import { C, Card, Divider, Header, ListRow, Screen, Section, Sheet, T, Button } from '@/ui';

const clearLocal = () => ['draft_workout', 'missed_choice', 'pending_onboarding'].forEach((k) => localStorage.removeItem(k));
const label = <V,>(opts: { value: V; label: string }[], v: V | undefined) => opts.find((o) => o.value === v)?.label ?? '';

export default function Profile() {
  const { session, profile, program } = useData();
  const [sheet, setSheet] = useState<null | 'notifications' | 'appearance' | 'units' | 'data' | 'privacy' | 'disclaimer' | 'signout'>(null);
  if (!profile || !program) return null;
  const who = session?.user.email || session?.user.phone || '';
  const name = firstName(session?.user.email);

  function deleteAccount() {
    alert('Delete your account?', 'This permanently deletes your account, plan and every logged workout. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.rpc('delete_account');
          if (error) return alert('Could not delete', friendlyError(error));
          clearLocal();
          await supabase.auth.signOut({ scope: 'local' });
        },
      },
    ]);
  }

  return (
    <Screen edges={['top']}>
      <Header title="Account" />
      <Card flat style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
          <T size="lg" color="#fff">{(name || who).charAt(0).toUpperCase() || 'R'}</T>
        </View>
        <View style={{ flex: 1 }}>
          <T bold numberOfLines={1}>{name || 'RepProof member'}</T>
          <T muted size="sm" numberOfLines={1}>{who}</T>
        </View>
      </Card>

      <Section title="Training">
        <Card flat style={{ gap: 4 }}>
          <ListRow icon="flag" title="Training goal" value={label(GOAL_OPTIONS, profile.goal)} onPress={() => router.push('/training')} />
          <Divider />
          <ListRow icon="school" title="Experience" value={label(EXPERIENCE_OPTIONS, profile.experience)} onPress={() => router.push('/training')} />
          <Divider />
          <ListRow icon="barbell" title="Equipment" value={label(SETUP_OPTIONS, profile.setup)} onPress={() => router.push('/training')} />
          <Divider />
          <ListRow icon="calendar" title="Training days" value={`${profile.days} · ${SPLIT_NAMES[program.plan.split]}`} onPress={() => router.push('/plan')} />
        </Card>
      </Section>

      <Section title="Settings">
        <Card flat style={{ gap: 4 }}>
          <ListRow icon="resize" title="Units" value={profile.unit} onPress={() => setSheet('units')} />
          <Divider />
          <ListRow icon="notifications" title="Notifications" onPress={() => setSheet('notifications')} />
          <Divider />
          <ListRow icon="contrast" title="Appearance" value="Light" onPress={() => setSheet('appearance')} />
          <Divider />
          <ListRow icon="cloud" title="Data" onPress={() => setSheet('data')} />
          <Divider />
          <ListRow icon="shield-checkmark-outline" title="Privacy" onPress={() => setSheet('privacy')} />
          <Divider />
          <ListRow icon="document-text-outline" title="Disclaimer" onPress={() => setSheet('disclaimer')} />
        </Card>
      </Section>

      <Section title="More">
        <Card flat style={{ gap: 4 }}>
          <ListRow icon="flask" title="The science behind RepProof" onPress={() => router.push('/science')} />
          <Divider />
          <ListRow icon="book" title="Exercise library" onPress={() => router.push('/library')} />
          <Divider />
          <ListRow icon="chatbubble-ellipses" title="Send feedback" onPress={() => router.push('/feedback')} />
          <Divider />
          <ListRow icon="log-out-outline" title="Sign out" onPress={() => setSheet('signout')} />
        </Card>
      </Section>

      <Sheet visible={sheet === 'units'} onClose={() => setSheet(null)} title="Units">
        <T>Weights are shown in {profile.unit === 'kg' ? 'kilograms' : 'pounds'}, the unit you chose in onboarding.</T>
        <T muted size="sm">Your logged history and progression increments are stored in that unit, so changing it mid-plan would mix numbers. Unit switching will arrive with conversion of your history.</T>
        <Button title="Got it" onPress={() => setSheet(null)} />
      </Sheet>
      <Sheet visible={sheet === 'notifications'} onClose={() => setSheet(null)} title="Notifications">
        <T>RepProof does not send notifications yet.</T>
        <T muted size="sm">Workout reminders and weekly check-ins are planned for a later release. You will choose exactly what you receive.</T>
        <Button title="Got it" onPress={() => setSheet(null)} />
      </Sheet>
      <Sheet visible={sheet === 'appearance'} onClose={() => setSheet(null)} title="Appearance">
        <T>RepProof currently uses a light, high-contrast theme designed for reading numbers quickly in a bright gym.</T>
        <T muted size="sm">A dark theme is on the roadmap.</T>
        <Button title="Got it" onPress={() => setSheet(null)} />
      </Sheet>
      <Sheet visible={sheet === 'data'} onClose={() => setSheet(null)} title="Your data">
        <T>Your workouts, plan and bodyweight are stored in your account so they follow you across devices. An unfinished workout is kept on this phone until you finish or discard it.</T>
        <Button kind="danger" title="Delete account and all data" onPress={() => { setSheet(null); deleteAccount(); }} />
        <Button kind="ghost" title="Close" onPress={() => setSheet(null)} />
      </Sheet>
      <Sheet visible={sheet === 'disclaimer'} onClose={() => setSheet(null)} title="Disclaimer">
        <T>{DISCLAIMER}</T>
        <Button title="Got it" onPress={() => setSheet(null)} />
      </Sheet>
      {/* Board 08 · 06 Sign out confirmation */}
      <Sheet visible={sheet === 'signout'} onClose={() => setSheet(null)} title="Sign out of RepProof?">
        <T muted>Your workouts and food logs stay saved to your account. You can sign back in any time.</T>
        <Button kind="primary" title="Sign out" onPress={() => { setSheet(null); clearLocal(); supabase.auth.signOut(); }} />
        <Button kind="ghost" title="Stay signed in" onPress={() => setSheet(null)} />
      </Sheet>
      <Sheet visible={sheet === 'privacy'} onClose={() => setSheet(null)} title="Privacy">
        <T>RepProof stores only what it needs to coach you: your training profile, logged sets, bodyweight and food.</T>
        <T muted size="sm">RepProof gives training information, not medical advice. If something hurts, stop and see a qualified professional.</T>
        <Button title="Got it" onPress={() => setSheet(null)} />
      </Sheet>
    </Screen>
  );
}
