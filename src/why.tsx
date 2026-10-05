import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { REFERENCES } from '@/engine/references.ts';
import type { EvidenceLabel, Explanation } from '@/engine/types.ts';
import { track } from '@/lib/data';
import { Button, C, Card, T } from '@/ui';

export const LABELS: Record<EvidenceLabel, { title: string; hint: string; color: string }> = {
  direct: { title: 'Tier 1 · Direct evidence', hint: 'Supported directly by high-quality research.', color: '#5BD6A0' },
  principle: { title: 'Tier 2 · Principle-based', hint: 'Built from several findings. Sensible, but not itself tested as a universal rule.', color: '#7DB7FF' },
  rule: { title: 'Tier 3 · RepProof rule', hint: 'A RepProof decision rule built from the evidence. Not a scientific finding, and we say so.', color: '#C9B6FF' },
};

export function Badge({ label }: { label: EvidenceLabel }) {
  const l = LABELS[label];
  return (
    <View style={{ alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, borderColor: l.color, paddingHorizontal: 10, paddingVertical: 3 }}>
      <T size="sm" style={{ color: l.color }} bold>{l.title}</T>
    </View>
  );
}

export function WhyBody({ e }: { e: Explanation }) {
  return (
    <View style={{ gap: 10 }}>
      <Badge label={e.label} />
      <T>{e.text}</T>
      <T muted size="sm">{LABELS[e.label].hint}</T>
      <RefLinks ids={e.refIds} />
    </View>
  );
}

/** Study list: citation, study type and population; tap opens the DOI page. */
export function RefLinks({ ids }: { ids: string[] }) {
  return (
    <View style={{ gap: 8 }}>
      {ids.map((id) => {
        const r = REFERENCES[id];
        return (
          <Pressable key={id} accessibilityRole="link" onPress={() => { WebBrowser.openBrowserAsync(`https://doi.org/${r.doi}`); track('study_opened', { id }); }}>
            <T size="sm" style={{ color: C.accent }}>{r.citation} Open study</T>
            <T size="sm" muted>{r.type} · {r.population}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** "why?" icon; highlighted when the suggestion changed since last time. */
export function Why({ e, changed }: { e: Explanation; changed?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Why?" hitSlop={12}
        onPress={() => { setOpen(true); track('why_opened', { label: e.label }); }}>
        <Ionicons name="help-circle" size={26} color={changed ? C.accent : C.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#000a' }} onPress={() => setOpen(false)} />
        <Card style={{ borderRadius: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 }}>
          <T size="lg">Why?</T>
          <WhyBody e={e} />
          <Button title="Got it" onPress={() => setOpen(false)} />
        </Card>
      </Modal>
    </>
  );
}
