import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { DISCLAIMER, getPending, setPending } from '@/lib/pending';
import { Button, Card, Choice, Screen, StepProgress, T } from '@/ui';

// Board 04 · 04 Disclaimer. The approved disclaimer text is shown unchanged.
export default function Disclaimer() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [agreed, setAgreed] = useState(false);
  return (
    <Screen>
      <StepProgress step={2} total={2} onBack={() => router.back()} />
      <View style={{ flexGrow: 1, justifyContent: 'flex-end', gap: 16 }}>
        <T size="xl" header>Before we start</T>
        <T muted>A few honest things about what RepProof is.</T>
        <Card><T>{DISCLAIMER}</T></Card>
        <T muted size="sm">You can read this again any time in Settings.</T>
        <Choice value={agreed ? ['yes'] : []} onChange={() => setAgreed(!agreed)} options={[{ value: 'yes', label: 'I understand and agree.' }]} />
      </View>
      <Button kind="primary" title="Continue" disabled={!agreed} onPress={() => {
        const p = getPending();
        if (!p) return router.replace('/age');
        setPending({ ...p, disclaimerAt: new Date().toISOString() });
        router.push({ pathname: '/sign-in', params: { mode } });
      }} />
    </Screen>
  );
}
