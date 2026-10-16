import { useState } from 'react';
import { View } from 'react-native';

import { CALIBRATION_WHY, calibrationResult, calibrationSummary } from '@/engine/calibration.ts';
import { addCalibration, calibrationEntries } from '@/lib/prefs';
import { Button, Card, Field, Segmented, Sheet, T } from '@/ui';
import { Why } from '@/why';

/** Optional rep-out to compare a reps-in-reserve guess with reality (backlog E-02). Shown only for isolation exercises. */
export function CalibrationCard({ userId, exerciseId, name }: { userId: string; exerciseId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [predicted, setPredicted] = useState('2');
  const [atGuess, setAtGuess] = useState('');
  const [total, setTotal] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const r = calibrationResult(Number(predicted), atGuess, total);
  const [entries, setEntries] = useState(() => calibrationEntries(userId));
  const summary = calibrationSummary(entries);

  function save() {
    if (!r.ok) return;
    addCalibration(userId, { exerciseId, predicted: r.predicted, actual: r.actual, at: new Date().toISOString() });
    setEntries(calibrationEntries(userId));
    setSaved(r.text);
    setAtGuess('');
    setTotal('');
  }

  return (
    <Card flat>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T bold style={{ flex: 1 }}>Check your RIR guess (optional)</T>
        <Why e={CALIBRATION_WHY} />
      </View>
      <T muted size="sm">An extra rep-out set on {name} to see how close your reps-in-reserve guesses are. It is not added to your workout or your plan.</T>
      <Button size="sm" title="Try a rep-out" onPress={() => { setSaved(null); setOpen(true); }} />
      <Sheet visible={open} onClose={() => setOpen(false)} title="RIR rep-out">
        <T>1. Use the weight from your last set. 2. When you think this many reps are left, remember the rep count. 3. Keep going with good form until you cannot do another rep. Stop at once if anything hurts or your form breaks.</T>
        <T bold>Reps you thought were left</T>
        <Segmented value={predicted} onChange={setPredicted} options={['1', '2', '3', '4', '5'].map((v) => ({ value: v, label: v }))} />
        <Field label="Rep count when you made the guess" keyboardType="number-pad" value={atGuess} onChangeText={setAtGuess} maxLength={2} />
        <Field label="Total reps when you could not do another" keyboardType="number-pad" value={total} onChangeText={setTotal} maxLength={2} />
        {atGuess && total ? <T size="sm" bold={r.ok}>{r.ok ? r.text : r.problem}</T> : null}
        <Button kind="primary" title="Save rep-out" disabled={!r.ok} onPress={save} />
        {saved ? <T size="sm" bold>Saved. {saved}</T> : null}
        {summary ? <T muted size="sm">{summary.text}</T> : null}
        <T muted size="sm">Kept on this phone only. Failure varies from day to day, so one rep-out is a sample, not a measurement.</T>
        <Button kind="ghost" title="Close" onPress={() => setOpen(false)} />
      </Sheet>
    </Card>
  );
}
