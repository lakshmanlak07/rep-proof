import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { EXERCISE_BY_ID } from '@/engine/exercises.ts';
import { DIFFICULTY, EQUIPMENT_LABEL, PATTERN_LABEL, infoFor } from '@/lib/exerciseInfo';
import { Badge } from '@/why';
import { C, Card, Chip, Section, Screen, s, T } from '@/ui';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ex = EXERCISE_BY_ID[id];
  if (!ex) return <Screen><T>Exercise not found.</T></Screen>;
  const info = infoFor(ex);
  return (
    <Screen edges={['bottom']}>
      <View style={{ gap: 6 }}>
        <T size="micro">{ex.muscle}</T>
        <T size="xl">{ex.name}</T>
      </View>
      <View style={[s.row, { flexWrap: 'wrap', gap: 6 }]}>
        <Chip tone="accent" label={DIFFICULTY[ex.difficulty]} />
        <Chip label={ex.equipment.map((q) => EQUIPMENT_LABEL[q]).join(' + ')} />
        <Chip label={PATTERN_LABEL[ex.pattern]} />
      </View>

      <View style={{ height: 210, borderRadius: 24, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Ionicons name="play-circle" size={56} color={C.accent} />
        <T muted size="sm">Movement video coming soon</T>
      </View>

      <View style={[s.row, { alignItems: 'stretch' }]}>
        <Card style={{ flex: 1 }}><T size="micro">Primary</T><T bold>{info.primary}</T></Card>
        <Card style={{ flex: 1 }}><T size="micro">Secondary</T><T bold>{info.secondary}</T></Card>
      </View>
      <Card flat><T size="micro">Best for</T><T>{info.bestFor}</T></Card>

      <Section title="How to perform">
        <Card>{info.steps.map((st, i) => (
          <View key={st} style={[s.row, { alignItems: 'flex-start' }]}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}><T size="sm" bold color={C.accent}>{i + 1}</T></View>
            <T style={{ flex: 1 }}>{st}</T>
          </View>
        ))}</Card>
      </Section>
      <Section title="Key cues">
        <View style={[s.row, { flexWrap: 'wrap', gap: 8 }]}>{ex.cues.map((c) => <Chip key={c} tone="accent" label={c} />)}</View>
      </Section>
      <Section title="Common mistakes">
        <Card>{info.mistakes.map((m) => <View key={m} style={[s.row, { alignItems: 'flex-start' }]}><Ionicons name="close-circle" size={18} color={C.danger} /><T style={{ flex: 1 }}>{m}</T></View>)}</Card>
      </Section>
      <Section title="Programming">
        <Card><T>{info.programming}</T></Card>
      </Section>
      <Card flat style={{ backgroundColor: C.accentSoft, borderColor: 'transparent' }}>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <T size="micro" color={C.accent}>Rep Proof note</T>
          <Badge label="principle" />
        </View>
        <T>{info.note}</T>
      </Card>
    </Screen>
  );
}
