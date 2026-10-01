import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Screen, T } from '@/ui';

export default function Welcome() {
  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
        <T size="xl">RepProof</T>
        <T size="lg" style={{ fontWeight: '400' }}>Builds your gym plan, adjusts it when life gets in the way, and shows you exactly why.</T>
        <T muted>Every rule is labeled: backed by a study, based on a studied principle, or our own design choice.</T>
      </View>
      <Button kind="primary" title="Get started" onPress={() => router.push('/age')} />
      <Button kind="ghost" title="I already have an account" onPress={() => router.push({ pathname: '/age', params: { mode: 'signin' } })} />
    </Screen>
  );
}
