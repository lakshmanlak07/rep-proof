import { useState } from 'react';
import { Pressable } from 'react-native';

import { TOPICS, UNKNOWNS } from '@/engine/science.ts';
import { track } from '@/lib/data';
import { Card, s, Screen, T } from '@/ui';
import { Badge, LABELS, RefLinks } from '@/why';

export default function Science() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Screen edges={['bottom']}>
      <T>Every rule in RepProof carries a label. Here is what the research shows, what it does not, and what we chose.</T>
      {(['direct', 'principle', 'rule'] as const).map((l) => (
        <Card key={l} style={[s.row, { paddingVertical: 10 }]}>
          <Badge label={l} />
          <T muted size="sm" style={{ flex: 1 }}>{LABELS[l].hint}</T>
        </Card>
      ))}

      {TOPICS.map((t) => {
        const expanded = open === t.title;
        return (
          <Pressable key={t.title} accessibilityRole="button" accessibilityState={{ expanded }}
            onPress={() => { setOpen(expanded ? null : t.title); if (!expanded) track('science_topic', { topic: t.title }); }}>
            <Card>
              <T size="lg">{t.title}</T>
              <Badge label={t.label} />
              <T>{t.shows}</T>
              {expanded ? (<>
                <T bold>What it does not show</T>
                <T muted>{t.doesNotShow}</T>
                <T bold>In RepProof</T>
                <T muted>{t.inApp}</T>
                <T bold>Studies</T>
                <RefLinks ids={t.refIds} />
              </>) : <T muted size="sm">Tap for details and studies</T>}
            </Card>
          </Pressable>
        );
      })}

      <T size="lg">{"What we don't know yet"}</T>
      <Card>
        {UNKNOWNS.map((u) => <T key={u} muted>• {u}</T>)}
      </Card>
      <T muted size="sm">Studies checked against PubMed records, October 2026. Not medical advice.</T>
    </Screen>
  );
}
