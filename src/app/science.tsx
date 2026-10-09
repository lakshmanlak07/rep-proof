import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { CAUTIONS, DEBATES, MISSION, MOTTO, PRINCIPLES, TIERS, TOPICS, type Topic } from '@/engine/science.ts';
import type { EvidenceLabel } from '@/engine/types.ts';
import { track } from '@/lib/data';
import { C, Card, Field, Header, Pill, s, Screen, T } from '@/ui';
import { Badge, RefLinks } from '@/why';

const FILTERS: { value: EvidenceLabel | 'all'; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'direct', label: 'Direct evidence' }, { value: 'principle', label: 'Principle' }, { value: 'rule', label: 'Rules' },
];

/** The science library. `tab`: shown as the Learn tab (own header); otherwise a pushed screen (Why links land here). */
export function ScienceView({ tab }: { tab?: boolean }) {
  // Opened from a Why sheet: that topic is shown first, expanded.
  const { topic } = useLocalSearchParams<{ topic?: string }>();
  const linked = TOPICS.find((t) => t.title === topic) ?? null;
  const [open, setOpen] = useState<string | null>(linked?.title ?? null);
  const [filter, setFilter] = useState<EvidenceLabel | 'all'>('all');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = TOPICS.filter((t) => t !== linked && (filter === 'all' || t.label === filter)
    && (!q || `${t.title} ${t.shows} ${t.inApp}`.toLowerCase().includes(q)));
  const card = (t: Topic) => <TopicCard key={t.title} t={t} expanded={open === t.title} onToggle={() => setOpen(open === t.title ? null : t.title)} />;

  return (
    <Screen edges={tab ? ['top'] : ['bottom']}>
      {tab ? <Header title="Learn" /> : null}
      <T muted size={tab ? 'md' : 'sm'}>The reasoning behind every suggestion, with sources.</T>

      {linked ? (<>
        <T size="micro">The evidence behind that recommendation</T>
        {card(linked)}
      </>) : null}

      <Field placeholder="Search topics" value={query} onChangeText={setQuery} accessibilityLabel="Search topics" returnKeyType="search" />
      <View style={[s.row, { flexWrap: 'wrap', gap: 8 }]}>
        {FILTERS.map((f) => <Pill key={f.value} label={f.label} on={filter === f.value} onPress={() => setFilter(f.value)} />)}
      </View>
      {shown.length ? shown.map(card) : <T muted>No topics match. Try another word or filter.</T>}

      <Card variant="tint">
        <T size="micro">Our rule of thumb</T>
        <T bold>{MOTTO}</T>
        <T muted size="sm">{MISSION}</T>
      </Card>

      <T size="lg">How to read the labels</T>
      {TIERS.map((tier) => (
        <Card key={tier.label} flat>
          <Badge label={tier.label} />
          <T>{tier.meaning}</T>
          <T muted size="sm">Example: {tier.example}</T>
        </Card>
      ))}

      <T size="lg">What everything is built on</T>
      <Card flat>
        {PRINCIPLES.map((p, i) => (
          <View key={p} style={[s.row, { alignItems: 'flex-start' }]}>
            <T bold color={C.accent} style={{ width: 22 }}>{i + 1}</T>
            <T style={{ flex: 1 }}>{p}</T>
          </View>
        ))}
      </Card>

      <T size="lg">Where we stay cautious</T>
      <Card flat>{CAUTIONS.map((c) => <T key={c} muted>• {c}</T>)}</Card>

      <T size="lg">Still debated</T>
      <Card flat>
        {DEBATES.map((d) => <T key={d} muted>• {d}</T>)}
        <T size="sm">{"When the evidence is unclear, we say so instead of picking a side."}</T>
      </Card>
      <T muted size="sm">Studies checked against PubMed records, October 2026. Not medical advice.</T>
    </Screen>
  );
}

export default function Science() {
  return <ScienceView />;
}

/** Topic card: label, title, plain-language read. Expanded: source, limitations and what to do (Board 07). */
function TopicCard({ t, expanded, onToggle }: { t: Topic; expanded: boolean; onToggle: () => void }) {
  return (
    <Card onPress={() => { onToggle(); if (!expanded) track('science_topic', { topic: t.title }); }}>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <Badge label={t.label} />
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-forward'} size={18} color={C.muted} accessibilityLabel={expanded ? 'Collapse' : 'Expand'} />
      </View>
      <T size="lg">{t.title}</T>
      {expanded ? (<>
        <T size="micro">In plain language</T>
        <T>{t.shows}</T>
        <View style={{ backgroundColor: C.warnSoft, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 8 }}>
          <Ionicons name="warning-outline" size={18} color={C.warn} />
          <T size="sm" style={{ flex: 1 }}><T size="sm" bold color={C.warn}>Limitations: </T>{t.doesNotShow}</T>
        </View>
        <T size="micro">What to do</T>
        <T>{t.inApp}</T>
        <T size="micro">{t.refIds.length ? 'Source' : 'Built on'}</T>
        {t.refIds.length ? <RefLinks ids={t.refIds} />
          : <T muted size="sm">Our rule, not a study result. No study measures this directly, so it is labelled as a RepProof rule.</T>}
      </>) : <T muted numberOfLines={2}>{t.shows}</T>}
    </Card>
  );
}

