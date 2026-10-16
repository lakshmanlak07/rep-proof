import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { EXERCISE_BY_ID, substitutes } from '@/engine/exercises.ts';
import { MUSCLE_NAMES } from '@/engine/plan.ts';
import { useData } from '@/lib/data';
import { DIFFICULTY, EQUIPMENT_LABEL, PATTERN_LABEL, infoFor } from '@/lib/exerciseInfo';
import { Banner, C, Card, Chip, Empty, IconTile, ListRow, Screen, Section, s, T } from '@/ui';
import { Badge } from '@/why';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useData();
  const ex = EXERCISE_BY_ID[id];
  if (!ex) {
    return (
      <Screen edges={['bottom']}>
        <Empty icon="search" title="Exercise not found" body="It may have been renamed. Browse the library to find it." action="Open the library" onAction={() => router.replace('/library')} />
      </Screen>
    );
  }
  const info = infoFor(ex);
  const alternatives = profile ? substitutes(ex.id, profile.setup, profile.avoid).slice(0, 4) : [];
  return (
    <Screen edges={['bottom']}>
      <View style={[s.row, { alignItems: 'flex-start' }]}>
        <IconTile name={ex.compound ? 'barbell-outline' : 'fitness-outline'} size={52} />
        <View style={{ flex: 1, gap: 4 }}>
          <T size="micro">{MUSCLE_NAMES[ex.muscle]} · {ex.compound ? 'compound' : 'isolation'}</T>
          <T size="xl" header>{ex.name}</T>
        </View>
      </View>
      <View style={[s.row, { flexWrap: 'wrap', gap: 6 }]}>
        <Chip tone="accent" label={DIFFICULTY[ex.difficulty]} />
        <Chip label={ex.equipment.map((q) => EQUIPMENT_LABEL[q]).join(' + ')} />
        <Chip label={PATTERN_LABEL[ex.pattern]} />
      </View>

      <View style={[s.row, { alignItems: 'stretch' }]}>
        <Card flat style={{ flex: 1 }}><T size="micro">Primary</T><T bold>{info.primary}</T></Card>
        <Card flat style={{ flex: 1 }}><T size="micro">Secondary</T><T bold>{info.secondary}</T></Card>
      </View>
      <Card flat><T size="micro">Best for</T><T>{info.bestFor}</T></Card>

      <Section title="How to perform">
        <Card>{info.steps.map((st, i) => (
          <View key={st} style={[s.row, { alignItems: 'flex-start' }]}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}><T size="sm" bold color={C.accent}>{i + 1}</T></View>
            <T style={{ flex: 1 }}>{st}</T>
          </View>
        ))}</Card>
        <T muted size="sm">Written steps only: RepProof does not include exercise videos yet.</T>
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
          <T size="micro" color={C.accent}>RepProof note</T>
          <Badge label="principle" />
        </View>
        <T>{info.note}</T>
      </Card>

      {alternatives.length ? (
        <Section title="Alternatives with your equipment">
          <Card flat style={{ gap: 4 }}>
            {alternatives.map((a) => (
              <ListRow key={a.id} icon={a.compound ? 'barbell-outline' : 'fitness-outline'} title={a.name} value={PATTERN_LABEL[a.pattern]}
                onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: a.id } })} />
            ))}
          </Card>
        </Section>
      ) : null}

      <Banner text="General technique guidance, not medical advice. If an exercise hurts, stop and see a qualified professional." />
    </Screen>
  );
}
