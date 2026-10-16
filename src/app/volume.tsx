import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { EXERCISE_BY_ID } from '@/engine/exercises.ts';
import { MUSCLES } from '@/engine/plan.ts';
import type { Muscle } from '@/engine/types.ts';
import { loadCoachNotes } from '@/lib/coach';
import { startOfWeek, useData } from '@/lib/data';
import { MUSCLE_LABEL, productiveRange, volumeStatus } from '@/lib/insights';
import { supabase } from '@/lib/supabase';
import { Banner, Card, Header, ProgressBar, Screen, Segmented, T, s, toneColor } from '@/ui';
import { Badge } from '@/why';

export default function Volume() {
  const { profile, program } = useData();
  const [mode, setMode] = useState<'planned' | 'logged'>('planned');
  const [logged, setLogged] = useState<Partial<Record<Muscle, number>> | null>(null); // null = not loaded
  const [stalling, setStalling] = useState<string[]>([]);
  const [failed, setFailed] = useState(false); // logged sets could not load: never show zeros as if real
  const userId = profile?.id;
  const load = useCallback(() => {
    setFailed(false);
    setLogged(null);
    supabase.from('logged_sets').select('exercise_id').gte('created_at', startOfWeek()).then(({ data, error }) => {
      setFailed(!!error);
      if (error) return;
      const c: Partial<Record<Muscle, number>> = {};
      for (const r of data ?? []) { const m = EXERCISE_BY_ID[r.exercise_id]?.muscle; if (m) c[m] = (c[m] ?? 0) + 1; }
      setLogged(c);
    }, () => setFailed(true));
    if (userId) {
      const notes = loadCoachNotes(userId);
      setStalling((notes?.decisions ?? []).filter((d) => d.kind === 'hold_stalled' || d.kind === 'hold_recover').map((d) => EXERCISE_BY_ID[d.exerciseId]?.muscle).filter(Boolean));
    }
  }, [userId]);
  useFocusEffect(load);
  if (!profile || !program) return null;
  const [lo, hi] = productiveRange(profile.experience);
  const scaleMax = Math.ceil(hi * 1.3);
  const source = mode === 'planned' ? program.plan.weeklySets : logged; // null: logged sets not loaded
  const rows = MUSCLES.filter((m) => program.plan.weeklySets[m]);

  return (
    <Screen edges={['bottom']}>
      <Header kicker="Volume management" title="Weekly volume" />
      <T muted>Hard sets per muscle per week. The shaded band is your current productive range, a RepProof estimate for your experience level, not a fixed law.</T>
      <Segmented value={mode} onChange={setMode} options={[{ value: 'planned', label: 'Planned' }, { value: 'logged', label: 'Logged this week' }]} />
      {failed && mode === 'logged' ? <Banner tone="danger" text="Could not load this week's sets. Check your connection." action="Retry" onAction={load} /> : null}
      <View style={{ gap: 14 }}>
        {rows.map((m) => {
          const n = source ? source[m] ?? 0 : null;
          const st = n == null ? { label: failed ? 'Unknown' : 'Loading…', tone: 'neutral' as const } : volumeStatus(n, profile.experience, stalling.includes(m));
          return (
            <Card key={m}>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <T size="lg">{MUSCLE_LABEL[m]}</T>
                <T size="lg">{n ?? '—'} <T muted size="sm">sets</T></T>
              </View>
              <ProgressBar value={n ?? 0} max={scaleMax} tone={st.tone === 'danger' ? 'warn' : st.tone === 'warn' ? 'warn' : 'accent'} zone={[lo / scaleMax, hi / scaleMax]} height={10} />
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <T size="sm" bold color={toneColor(st.tone)}>{st.label}</T>
                <T muted size="sm">Range ~{lo}–{hi}</T>
              </View>
            </Card>
          );
        })}
      </View>
      <Card flat>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <T bold>How to read this</T>
          <Badge label="rule" />
        </View>
        <T muted>RepProof estimates a productive range from your training experience and adjusts the message when your performance stalls or recovery drops. Below the range, you may be able to add a set. Above it, hold steady if progress has slowed.</T>
        <T muted size="sm">Based on your recent performance. Individual response varies.</T>
      </Card>
    </Screen>
  );
}
