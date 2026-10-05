import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { EXERCISES } from '@/engine/exercises.ts';
import { CATEGORIES, DIFFICULTY, EQUIPMENT_LABEL, PATTERN_LABEL, infoFor } from '@/lib/exerciseInfo';
import { Card, Chip, Empty, Pill, Screen, s, T, useWide } from '@/ui';

export default function Library() {
  const [cat, setCat] = useState<string>('chest');
  const wide = useWide();
  const list = EXERCISES.filter((e) => e.muscle === cat);
  return (
    <Screen edges={['bottom']}>
      <View style={{ gap: 4 }}>
        <T size="micro">Discover</T>
        <T size="xl">Exercise library</T>
        <T muted>Every movement Rep Proof can put in your plan, with cues and programming notes.</T>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {CATEGORIES.map((c) => <Pill key={c.id} label={c.label} on={cat === c.id} onPress={() => setCat(c.id)} />)}
      </ScrollView>
      {!list.length ? <Empty icon="construct" title="Coming soon" body="Abs movements arrive with the next library update." /> : null}
      <View style={[s.row, { flexWrap: 'wrap', alignItems: 'stretch', gap: 14 }]}>
        {list.map((ex) => {
          const info = infoFor(ex);
          return (
            <Card key={ex.id} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: ex.id } })} style={{ flexBasis: wide ? '47%' : '100%', flexGrow: 1, padding: 0, overflow: 'hidden', gap: 0 }}>
              <View style={{ height: 110, backgroundColor: '#E3EFEF', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="barbell" size={44} color="#0E5C63" style={{ opacity: 0.35 }} />
              </View>
              <View style={{ padding: 16, gap: 8 }}>
                <T size="lg">{ex.name}</T>
                <T muted size="sm">{info.primary}</T>
                <View style={[s.row, { flexWrap: 'wrap', gap: 6 }]}>
                  <Chip label={ex.equipment.filter((q) => q !== 'rack' && q !== 'bench').map((q) => EQUIPMENT_LABEL[q]).join(' + ') || 'Bodyweight'} />
                  <Chip label={DIFFICULTY[ex.difficulty]} tone={ex.difficulty === 3 ? 'warn' : 'neutral'} />
                  <Chip label={PATTERN_LABEL[ex.pattern]} />
                </View>
              </View>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}
