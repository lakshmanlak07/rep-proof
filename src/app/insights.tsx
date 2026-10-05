import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { loadCoachNotes, type CoachNotes } from '@/lib/coach';
import { recentWorkouts, isDeload, useData } from '@/lib/data';
import { insightFromDecision, readiness } from '@/lib/insights';
import { Card, Chip, Empty, Header, Screen, Section, T, s } from '@/ui';
import { InsightCard } from '@/why';

export default function Insights() {
  const { profile } = useData();
  const [notes, setNotes] = useState<CoachNotes | null>(null);
  const [checkins, setCheckins] = useState<Parameters<typeof readiness>[0]>([]);
  const userId = profile?.id;
  useFocusEffect(useCallback(() => {
    if (userId) setNotes(loadCoachNotes(userId));
    recentWorkouts(3).then((r) => setCheckins(r.map((w) => w.checkin))).catch(() => {});
  }, [userId]));
  const ready = readiness(checkins, isDeload(profile?.deload_until ?? null));
  const rank = (k: string) => (k === 'progressing' || k === 'too_new' ? 1 : 0);
  const items = [...(notes?.decisions ?? [])].sort((a, b) => rank(a.kind) - rank(b.kind)).map(insightFromDecision);
  return (
    <Screen edges={['bottom']}>
      <Header kicker="Your coach" title="Rep Proof insights" />
      <T muted>What the data shows, why it matters and what to do about it. Every recommendation carries its evidence label.</T>
      <Card>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <T size="micro">Recovery</T>
          <Chip label={ready.label} tone={ready.tone} />
        </View>
        <T muted>{ready.detail}. Based on your last session check-ins.</T>
      </Card>
      {notes?.advice ? (
        <InsightCard kicker="Your program" icon="compass" see={notes.advice.text.split('. ')[0] + '.'} why="Program-level changes are judged across all your lifts, not one session."
          todo={notes.advice.text} evidence={notes.advice.label} refIds={notes.advice.refIds} />
      ) : null}
      {items.length ? (
        <Section title="By exercise">
          {items.map((i) => <InsightCard key={i.name} kicker={`${i.kicker} · ${i.name}`} icon={i.icon} tone={i.tone} see={i.see} why={i.why} todo={i.todo} evidence={i.evidence} refIds={i.refIds} />)}
        </Section>
      ) : <Empty icon="bulb" title="Insights appear after your first workouts" body="Rep Proof compares sessions to tell you whether to add weight, add a set, swap an exercise or hold steady." />}
    </Screen>
  );
}
