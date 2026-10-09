import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { CAUTIONS, DEBATES, MISSION, MOTTO, POSITIONING, PRINCIPLES, TIERS, TOPICS, type Topic } from '@/engine/science.ts';
import { track } from '@/lib/data';
import { C, Card, s, Screen, T } from '@/ui';
import { Badge, RefLinks } from '@/why';

export default function Science() {
  // Opened from a Why sheet: that topic is shown first, expanded.
  const { topic } = useLocalSearchParams<{ topic?: string }>();
  const linked = TOPICS.find((t) => t.title === topic) ?? null;
  const [open, setOpen] = useState<string | null>(linked?.title ?? null);
  const card = (t: Topic) => <TopicCard key={t.title} t={t} expanded={open === t.title} onToggle={() => setOpen(open === t.title ? null : t.title)} />;

  return (
    <Screen edges={['bottom']}>
      {linked ? (<>
        <T size="micro">The evidence behind that recommendation</T>
        {card(linked)}
      </>) : null}
      <T size="lg">{POSITIONING}</T>
      <T muted>{MISSION}</T>
      <Card style={{ borderColor: C.accent }}>
        <T bold>{MOTTO}</T>
      </Card>

      <T size="lg">What everything is built on</T>
      <Card>
        {PRINCIPLES.map((p, i) => (
          <View key={p} style={[s.row, { alignItems: 'flex-start' }]}>
            <T bold style={{ width: 22, color: C.accent }}>{i + 1}</T>
            <T style={{ flex: 1 }}>{p}</T>
          </View>
        ))}
      </Card>

      <T size="lg">How to read the labels</T>
      {TIERS.map((tier) => (
        <Card key={tier.label}>
          <Badge label={tier.label} />
          <T>{tier.meaning}</T>
          <T muted size="sm">Example: {tier.example}</T>
        </Card>
      ))}

      <T size="lg">The evidence, topic by topic</T>
      {TOPICS.filter((t) => t !== linked).map(card)}

      <T size="lg">Where we stay cautious</T>
      <Card>
        {CAUTIONS.map((c) => <T key={c} muted>• {c}</T>)}
      </Card>

      <T size="lg">Still debated</T>
      <Card>
        {DEBATES.map((d) => <T key={d} muted>• {d}</T>)}
        <T size="sm">{"When the evidence is unclear, we say so instead of picking a side."}</T>
      </Card>
      <T muted size="sm">Studies checked against PubMed records, October 2026. Not medical advice.</T>
    </Screen>
  );
}

function TopicCard({ t, expanded, onToggle }: { t: Topic; expanded: boolean; onToggle: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }}
      onPress={() => { onToggle(); if (!expanded) track('science_topic', { topic: t.title }); }}>
      <Card>
        <T size="lg">{t.title}</T>
        <Badge label={t.label} />
        <T>{t.shows}</T>
        {expanded ? (<>
          <T bold>What it does not show</T>
          <T muted>{t.doesNotShow}</T>
          <T bold>In RepProof</T>
          <T muted>{t.inApp}</T>
          {t.refIds.length ? (<>
            <T bold>Studies</T>
            <RefLinks ids={t.refIds} />
          </>) : <T muted size="sm">No study measures this directly; this is our rule, labeled as one.</T>}
        </>) : <T muted size="sm">Tap for details and studies</T>}
      </Card>
    </Pressable>
  );
}
