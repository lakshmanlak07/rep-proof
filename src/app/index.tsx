import { router } from 'expo-router';
import { View } from 'react-native';

import { MOTTO, POSITIONING } from '@/engine/science.ts';
import { Button, C, Screen, T } from '@/ui';

export default function Welcome() {
  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
        <T size="xl">RepProof</T>
        <T size="lg" style={{ fontWeight: '400' }}>{POSITIONING}</T>
        <T muted>Builds your plan, learns from how you actually lift and recover, and tells you what to do next: add weight, add a set, swap an exercise or back off. Always with the reason.</T>
        <T muted>Every recommendation is labeled: direct evidence, principle-based, or a RepProof rule.</T>
        <T bold style={{ color: C.accent }}>{MOTTO}</T>
      </View>
      <Button kind="primary" title="Get started" onPress={() => router.push('/age')} />
      <Button kind="ghost" title="I already have an account" onPress={() => router.push({ pathname: '/age', params: { mode: 'signin' } })} />
    </Screen>
  );
}
