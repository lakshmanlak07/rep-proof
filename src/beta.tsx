import 'expo-sqlite/localStorage/install';

import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { attempt } from '@/lib/alert';
import { sendFeedback, track } from '@/lib/data';
import { Button, C, Card, Choice, Field, s, T } from '@/ui';

// Beta feedback loop (PRD): weekly 3-question survey and the founding-member waitlist.
// Per-user flags live on the device; answers go to the feedback/events tables.
const key = (name: string, userId: string) => `${name}:${userId}`;
const WEEK_MS = 7 * 864e5;

export function shouldAskSurvey(userId: string, hasWorkouts: boolean) {
  if (!hasWorkouts) return false;
  const last = Number(localStorage.getItem(key('survey_at', userId)) ?? 0);
  return Date.now() - last >= WEEK_MS;
}

export function WeeklySurvey({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [useful, setUseful] = useState<number | null>(null);
  const [fit, setFit] = useState<'yes' | 'mostly' | 'no' | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const close = () => {
    localStorage.setItem(key('survey_at', userId), String(Date.now()));
    onDone();
  };

  async function submit() {
    setBusy(true);
    const sent = await attempt(() => sendFeedback('survey', note, { useful, fit }), 'send your answers');
    setBusy(false);
    if (!sent) return;
    track('survey_answered', { useful, fit });
    close();
  }

  return (
    <Card>
      <T bold>Weekly check-in (3 questions)</T>
      <T muted size="sm">1. How useful was RepProof this week?</T>
      <View style={s.row}>
        {[1, 2, 3, 4, 5].map((v) => (
          <Pressable key={v} accessibilityRole="button" accessibilityLabel={`${v} out of 5`} accessibilityState={{ selected: useful === v }} onPress={() => setUseful(v)}
            style={{ flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: useful === v ? C.accent : C.border }}>
            <T bold>{v}</T>
          </Pressable>
        ))}
      </View>
      <T muted size="sm">2. Did the plan fit your week?</T>
      <Choice value={fit} onChange={setFit} options={[{ value: 'yes', label: 'Yes' }, { value: 'mostly', label: 'Mostly' }, { value: 'no', label: 'No' }]} />
      <Field label="3. One thing to improve (optional)" value={note} onChangeText={setNote} maxLength={2000} multiline />
      <Button kind="primary" title="Send" loading={busy} disabled={!useful || !fit} onPress={submit} />
      <Button kind="ghost" title="Skip this week" onPress={close} />
    </Card>
  );
}

export function shouldOfferFoundingDeal(userId: string) {
  return !localStorage.getItem(key('founding', userId));
}

export function FoundingMember({ userId, onDone }: { userId: string; onDone: () => void }) {
  const answer = (joined: boolean) => {
    localStorage.setItem(key('founding', userId), joined ? 'joined' : 'declined');
    if (joined) track('pro_waitlist_joined');
    onDone();
  };
  return (
    <Card>
      <T bold>Free during the beta</T>
      <T muted>Some features may become paid later. Beta testers get a founding-member deal. Want to hear about it first?</T>
      <View style={s.row}>
        <Button kind="primary" title="Count me in" style={{ flex: 1 }} onPress={() => answer(true)} />
        <Button kind="ghost" title="Not now" onPress={() => answer(false)} />
      </View>
    </Card>
  );
}
