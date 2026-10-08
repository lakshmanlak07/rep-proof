import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { REFERENCES } from '@/engine/references.ts';
import type { EvidenceLabel, Explanation } from '@/engine/types.ts';
import { track } from '@/lib/data';
import { Button, C, Card, Chip, IconTile, Sheet, T, type Tone } from '@/ui';

export const LABELS: Record<EvidenceLabel, { title: string; short: string; hint: string; tone: Tone; icon: keyof typeof Ionicons.glyphMap }> = {
  direct: { title: 'Direct evidence', short: 'Direct evidence', hint: 'Supported directly by high-quality research.', tone: 'pos', icon: 'flask' },
  principle: { title: 'Principle-based', short: 'Principle-based', hint: 'A practical recommendation derived from several evidence-based principles. Sensible, but not itself tested as a universal rule.', tone: 'accent', icon: 'git-merge' },
  rule: { title: 'Rep Proof rule', short: 'Rep Proof rule', hint: 'A product decision Rep Proof made to turn the evidence into something actionable. Not a scientific finding, and we say so.', tone: 'neutral', icon: 'construct' },
};

/** Subtle evidence chip. Tapping it anywhere that wraps it in <Why/> opens the explanation. */
export function Badge({ label }: { label: EvidenceLabel }) {
  const l = LABELS[label];
  return <Chip label={l.short} tone={l.tone} icon={l.icon} />;
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
            <T size="sm" bold color={C.accent}>{r.citation} · Open study</T>
            <T size="sm" muted>{r.type} · {r.population}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** "Why?" affordance; highlighted when the suggestion changed since last time. Opens an explanation sheet. */
export function Why({ e, changed }: { e: Explanation; changed?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Why?" hitSlop={12}
        onPress={() => { setOpen(true); track('why_opened', { label: e.label }); }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: changed ? C.accentSoft : C.sunken }}>
        <Ionicons name="sparkles" size={13} color={changed ? C.accent : C.muted} />
        <T size="sm" bold color={changed ? C.accent : C.muted}>Why</T>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Why this recommendation?">
        <WhyBody e={e} />
        <Button title="Got it" onPress={() => setOpen(false)} />
        <Button kind="ghost" icon="flask" title="All the evidence, topic by topic" onPress={() => { setOpen(false); router.push('/science'); }} />
      </Sheet>
    </>
  );
}

/**
 * The signature Rep Proof explanation: what we see, why it matters, what to do.
 * Recommendations are never a black box.
 */
export function InsightCard({ kicker, icon = 'bulb', tone = 'accent', see, why, todo, evidence, refIds }: {
  kicker: string; icon?: keyof typeof Ionicons.glyphMap; tone?: Tone; see: string; why: string; todo: string; evidence?: EvidenceLabel; refIds?: string[];
}) {
  const [open, setOpen] = useState(false);
  const row = (label: string, text: string, strong?: boolean) => (
    <View style={{ gap: 3 }}>
      <T size="micro">{label}</T>
      <T bold={strong}>{text}</T>
    </View>
  );
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconTile name={icon} tone={tone} size={34} />
          <T size="micro" color={C.text}>{kicker}</T>
        </View>
        {evidence ? <Badge label={evidence} /> : null}
      </View>
      {row('What we see', see)}
      {row('Why it matters', why)}
      <View style={{ backgroundColor: C.accentSoft, borderRadius: 14, padding: 14 }}>{row('What to do', todo, true)}</View>
      {refIds?.length ? (
        <Pressable accessibilityRole="button" onPress={() => setOpen(!open)} hitSlop={8}>
          <T size="sm" bold color={C.accent}>{open ? 'Hide studies' : 'See the evidence'}</T>
        </Pressable>
      ) : null}
      {open && refIds ? <RefLinks ids={refIds} /> : null}
    </Card>
  );
}
