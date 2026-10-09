import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, C, Card, IconTile, Reveal, Screen, T } from '@/ui';

// Board 04 · 01 Welcome.
const POINTS = [
  { icon: 'book-outline', text: 'Every suggestion shows its source.' },
  { icon: 'flash-outline', text: 'Weights and reps adjust as you improve.' },
  { icon: 'restaurant-outline', text: 'Simple nutrition targets you can edit.' },
] as const;

export default function Welcome() {
  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, gap: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="heart-outline" size={20} color="#fff" />
          </View>
          <T size="lg" color={C.accent}>RepProof</T>
        </View>
        <Reveal>
          <Card variant="hero" style={{ height: 180, justifyContent: 'flex-end', overflow: 'hidden' }}>
            <View style={{ position: 'absolute', right: -40, top: -40, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.10)' }} />
            <View style={{ position: 'absolute', right: 30, top: 24, width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="barbell-outline" size={28} color="#fff" />
            </View>
            <T size="lg" color="#fff">Progressive overload,{'\n'}explained.</T>
          </Card>
        </Reveal>
        <T size="xl">Lift with a plan you can check.</T>
        <View style={{ gap: 12 }}>
          {POINTS.map((p) => (
            <View key={p.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconTile name={p.icon} size={32} />
              <T muted style={{ flex: 1 }}>{p.text}</T>
            </View>
          ))}
        </View>
      </View>
      <Button kind="primary" title="Get started" onPress={() => router.push('/age')} />
      <Button kind="ghost" title="I already have an account" onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'signin' } })} />
    </Screen>
  );
}
