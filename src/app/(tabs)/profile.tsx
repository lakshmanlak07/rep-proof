import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import type { EffortScale } from '@/engine/effort.ts';
import { SPLIT_NAMES } from '@/engine/plan.ts';
import { alert, attempt, friendlyError } from '@/lib/alert';
import { track, useData } from '@/lib/data';
import { clearExportFiles, exportData } from '@/lib/exportData';
import { DISCLAIMER } from '@/lib/pending';
import { firstName } from '@/lib/insights';
import { DELETE_ACCOUNT_URL } from '@/lib/site';
import { notificationsSupported, restAlertsOn, setRestAlerts } from '@/lib/notify';
import { EXPERIENCE_OPTIONS, GOAL_OPTIONS, SETUP_OPTIONS } from '@/lib/options';
import { clearLocal, effortScale, setEffortScale } from '@/lib/prefs';
import { supabase } from '@/lib/supabase';
import { Banner, Button, C, Card, Choice, Divider, Header, ListRow, Screen, Section, Sheet, T } from '@/ui';
import { Why } from '@/why';
import { RPE_WHY } from '@/engine/effort.ts';

const label = <V,>(opts: { value: V; label: string }[], v: V | undefined) => opts.find((o) => o.value === v)?.label ?? '';
type SheetId = 'notifications' | 'appearance' | 'units' | 'data' | 'privacy' | 'disclaimer' | 'signout' | 'effort';

export default function Profile() {
  const { session, profile, program } = useData();
  const [sheet, setSheet] = useState<null | SheetId>(null);
  const [scale, setScale] = useState<EffortScale>(effortScale);
  const [alerts, setAlerts] = useState(restAlertsOn);
  useFocusEffect(useCallback(() => { setAlerts(restAlertsOn()); }, []));
  const [exporting, setExporting] = useState(false);
  if (!profile || !program) return null;
  const who = session?.user.email || session?.user.phone || '';
  const name = firstName(session?.user.email);

  function deleteAccount() {
    alert('Delete your account?', 'This permanently deletes your account, plan, every logged workout, your food log and your bodyweight history. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.rpc('delete_account');
          if (error) return alert('Could not delete', friendlyError(error));
          clearLocal(profile!.id);
          clearExportFiles();
          // The account no longer exists server-side, so only clear this device's session.
          await supabase.auth.signOut({ scope: 'local' });
        },
      },
    ]);
  }

  async function download() {
    setExporting(true);
    const done = await attempt(() => exportData(profile!.id, session?.user.email ?? null), 'export your data');
    setExporting(false);
    if (done) track('data_exported');
  }

  async function toggleAlerts(on: boolean) {
    const now = await setRestAlerts(on);
    setAlerts(now);
    if (on && !now) alert('Notifications are off', 'Allow notifications for RepProof in your phone settings to get rest alerts.');
  }

  return (
    <Screen edges={['top']}>
      <Header title="Account" />
      <Card flat style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
          <T size="lg" color={C.onAccent}>{(name || who).charAt(0).toUpperCase() || 'R'}</T>
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
          <Divider />
          <ListRow icon="speedometer-outline" title="Effort scale" value={scale === 'rpe' ? 'RPE' : 'RIR'} onPress={() => setSheet('effort')} />
        </Card>
      </Section>

      <Section title="Settings">
        <Card flat style={{ gap: 4 }}>
          <ListRow icon="resize" title="Units" value={profile.unit} onPress={() => setSheet('units')} />
          <Divider />
          <ListRow icon="notifications" title="Notifications" value={alerts ? 'Rest alerts on' : 'Off'} onPress={() => setSheet('notifications')} />
          <Divider />
          <ListRow icon="contrast" title="Appearance" value="Light" onPress={() => setSheet('appearance')} />
          <Divider />
          <ListRow icon="cloud" title="Your data" onPress={() => setSheet('data')} />
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

      <Sheet visible={sheet === 'effort'} onClose={() => setSheet(null)} title="Effort scale">
        <T muted size="sm">How you rate each set. Both mean the same thing to the app: RPE is converted to reps in reserve.</T>
        <Choice value={scale} onChange={(v) => { setScale(v); setEffortScale(v); track('effort_scale', { scale: v }); }} options={[
          { value: 'rir', label: 'Reps in reserve (RIR)', hint: 'How many more reps you could have done. 2 RIR = two left.' },
          { value: 'rpe', label: 'RPE (1-10)', hint: 'RPE 10 = no reps left, RPE 8 = two left. Half steps allowed.' },
        ]} />
        <View style={{ alignSelf: 'flex-start' }}><Why e={RPE_WHY} /></View>
        <T muted size="sm">Applies to workouts you start from now on.</T>
        <Button title="Done" onPress={() => setSheet(null)} />
      </Sheet>
      <Sheet visible={sheet === 'units'} onClose={() => setSheet(null)} title="Units">
        <T>Weights are shown in {profile.unit === 'kg' ? 'kilograms' : 'pounds'}, the unit you chose in onboarding.</T>
        <T muted size="sm">Your logged history and progression increments are stored in that unit, so changing it mid-plan would mix numbers. Unit switching will arrive with conversion of your history.</T>
        <Button title="Got it" onPress={() => setSheet(null)} />
      </Sheet>
      <Sheet visible={sheet === 'notifications'} onClose={() => setSheet(null)} title="Notifications">
        {notificationsSupported ? (<>
          <Choice value={alerts ? ['on'] : []} onChange={() => toggleAlerts(!alerts)} options={[{ value: 'on', label: 'Rest timer alerts', hint: 'A notification when your rest between sets is over, even with the screen off.' }]} />
          <T muted size="sm">Created on this phone only. RepProof sends no marketing or push messages.</T>
        </>) : <T>Rest alerts need the Android or iOS app. In the browser, the on-screen timer still counts down.</T>}
        <Button title="Done" onPress={() => setSheet(null)} />
      </Sheet>
      <Sheet visible={sheet === 'appearance'} onClose={() => setSheet(null)} title="Appearance">
        <T>RepProof currently uses a light, high-contrast theme designed for reading numbers quickly in a bright gym.</T>
        <T muted size="sm">A dark theme is on the roadmap.</T>
        <Button title="Got it" onPress={() => setSheet(null)} />
      </Sheet>
      <Sheet visible={sheet === 'data'} onClose={() => setSheet(null)} title="Your data">
        <T>Your workouts, plan, food log and bodyweight are stored in your account so they follow you across devices. An unfinished workout is kept on this phone until you finish it, discard it or sign out.</T>
        <Button kind="primary" icon="download-outline" title="Download my data (JSON + CSV)" loading={exporting} onPress={download} />
        <Button kind="danger" title="Delete account and all data" onPress={() => { setSheet(null); deleteAccount(); }} />
        {DELETE_ACCOUNT_URL ? <T muted size="sm">No app? Request deletion on the web: {DELETE_ACCOUNT_URL.replace('https://', '')}</T> : null}
      </Sheet>
      <Sheet visible={sheet === 'disclaimer'} onClose={() => setSheet(null)} title="Disclaimer">
        <T>{DISCLAIMER}</T>
        <Button title="Got it" onPress={() => setSheet(null)} />
      </Sheet>
      {/* Board 08 · 06 Sign out confirmation */}
      <Sheet visible={sheet === 'signout'} onClose={() => setSheet(null)} title="Sign out of RepProof?">
        <T muted>Your workouts and food logs stay saved to your account. You can sign back in any time.</T>
        {localStorage.getItem('draft_workout') ? <T color={C.danger}>Your unfinished workout on this phone will be discarded. Finish it first to keep it.</T> : null}
        <Button kind="primary" title="Sign out" onPress={() => { setSheet(null); clearLocal(profile.id); clearExportFiles(); supabase.auth.signOut(); }} />
        <Button kind="ghost" title="Stay signed in" onPress={() => setSheet(null)} />
      </Sheet>
      <Sheet visible={sheet === 'privacy'} onClose={() => setSheet(null)} title="Privacy">
        <T>RepProof stores what it needs to coach you: your training profile, logged sets, check-ins, bodyweight and food. No ads, no selling data, no advertising trackers.</T>
        <T muted size="sm">Usage events (which features are used, with small details such as the number of sets or the goal you chose; never check-in answers, bodyweight, foods, or the weights you lift) and crash reports (with passwords, tokens and emails removed) go to RepProof’s own database.</T>
        <Banner tone="accent" text="RepProof gives training information, not medical advice. If something hurts, stop and see a qualified professional." />
        <Button kind="primary" title="Read the full privacy policy" onPress={() => { setSheet(null); router.push('/privacy'); }} />
        <Button kind="ghost" title="Close" onPress={() => setSheet(null)} />
      </Sheet>
    </Screen>
  );
}
