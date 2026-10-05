import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { View } from 'react-native';

import { MOTTO, POSITIONING } from '@/engine/science.ts';
import { Button, C, IconTile, Reveal, Screen, T } from '@/ui';
import { Badge } from '@/why';

const LOOP = [
  { icon: 'barbell', label: 'Train' }, { icon: 'create', label: 'Record' }, { icon: 'bulb', label: 'Interpret' }, { icon: 'options', label: 'Adjust' },
] as const;

export default function Welcome() {
  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: 28 }}>
        <Reveal>
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="checkmark" size={24} color="#fff" />
              </View>
              <T size="lg">Rep Proof</T>
            </View>
            <T size="display">Train with{'\n'}the reasons.</T>
            <T muted>{POSITIONING} Rep Proof builds your plan, learns from how you actually lift and recover, and tells you what to do next, always with the why.</T>
          </View>
        </Reveal>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {LOOP.map((l) => (
            <View key={l.label} style={{ alignItems: 'center', gap: 6 }}>
              <IconTile name={l.icon} tone="accent" size={46} />
              <T size="micro">{l.label}</T>
            </View>
          ))}
        </View>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Badge label="direct" /><Badge label="principle" /><Badge label="rule" />
          </View>
          <T muted size="sm">{MOTTO}</T>
        </View>
      </View>
      <Button kind="primary" title="Get started" onPress={() => router.push('/age')} />
      <Button kind="ghost" title="I already have an account" onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'signin' } })} />
    </Screen>
  );
}
