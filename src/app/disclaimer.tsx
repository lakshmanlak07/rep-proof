import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { DISCLAIMER, getPending, setPending } from '@/lib/pending';
import { Button, Card, Screen, T } from '@/ui';

export default function Disclaimer() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return (
    <Screen>
      <T size="lg">Before you start</T>
      <Card><T>{DISCLAIMER}</T></Card>
      <T muted size="sm">You can read this again any time in Settings.</T>
      <View style={{ flex: 1 }} />
      <Button kind="primary" title="I understand" onPress={() => {
        const p = getPending();
        if (!p) return router.replace('/age');
        setPending({ ...p, disclaimerAt: new Date().toISOString() });
        router.push({ pathname: '/sign-in', params: { mode } });
      }} />
    </Screen>
  );
}
