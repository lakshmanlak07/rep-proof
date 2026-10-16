import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { available, EXERCISES } from '@/engine/exercises.ts';
import { CATEGORIES, DIFFICULTY, EQUIPMENT_LABEL, PATTERN_LABEL, infoFor } from '@/lib/exerciseInfo';
import { useData } from '@/lib/data';
import { C, Card, Chip, Empty, Field, IconTile, Pill, Screen, s, T, useWide } from '@/ui';

const ALL = 'all';

export default function Library() {
  const { profile } = useData();
  const [cat, setCat] = useState<string>('chest');
  const [query, setQuery] = useState('');
  const [mine, setMine] = useState(false); // only what my equipment setup allows
  const wide = useWide();
  const q = query.trim().toLowerCase();
  const usable = new Set(profile ? available(profile.setup, []).map((e) => e.id) : []);
  const list = EXERCISES.filter((e) => (q || cat === ALL || e.muscle === cat) // a search looks across every muscle
    && (!q || `${e.name} ${e.muscle} ${PATTERN_LABEL[e.pattern]} ${e.equipment.join(' ')}`.toLowerCase().includes(q))
    && (!mine || usable.has(e.id)));

  return (
    <Screen edges={['bottom']}>
      <View style={{ gap: 4 }}>
        <T size="micro">Discover</T>
        <T size="xl" header>Exercise library</T>
        <T muted>{EXERCISES.length} movements RepProof can put in your plan, with cues and programming notes.</T>
      </View>
      <Field placeholder="Search, e.g. row or dumbbell" value={query} onChangeText={setQuery} accessibilityLabel="Search exercises" returnKeyType="search" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Pill label="All" on={cat === ALL} onPress={() => setCat(ALL)} />
        {CATEGORIES.map((c) => <Pill key={c.id} label={c.label} on={cat === c.id} onPress={() => setCat(c.id)} />)}
        {profile ? <Pill label="My equipment" on={mine} onPress={() => setMine(!mine)} /> : null}
      </ScrollView>
      <T muted size="sm">{list.length} {list.length === 1 ? 'exercise' : 'exercises'}{list.length > 60 ? ': showing 60, search to narrow' : ''}</T>
      {!list.length ? <Empty icon="search" title="No exercises match" body="Try a shorter word or another muscle group." /> : null}
      <View style={[s.row, { flexWrap: 'wrap', alignItems: 'stretch', gap: 12 }]}>
        {list.slice(0, 60).map((ex) => {
          const info = infoFor(ex);
          return (
            <Card key={ex.id} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: ex.id } })}
              style={{ flexBasis: wide ? '47%' : '100%', flexGrow: 1, gap: 8, padding: 16 }}>
              <View style={[s.row, { alignItems: 'flex-start' }]}>
                <IconTile name={ex.compound ? 'barbell-outline' : 'fitness-outline'} size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T bold>{ex.name}</T>
                  <T muted size="sm">{info.primary}</T>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.faint} />
              </View>
              <View style={[s.row, { flexWrap: 'wrap', gap: 6 }]}>
                <Chip label={ex.equipment.filter((x) => x !== 'rack' && x !== 'bench').map((x) => EQUIPMENT_LABEL[x]).join(' + ') || 'Bodyweight'} />
                <Chip label={DIFFICULTY[ex.difficulty]} tone={ex.difficulty === 3 ? 'warn' : 'neutral'} />
                <Chip label={PATTERN_LABEL[ex.pattern]} />
              </View>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}
