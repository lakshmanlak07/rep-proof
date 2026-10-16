import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { isAdult, setPending } from '@/lib/pending';
import { Button, C, Card, Field, IconTile, Screen, StepProgress, T } from '@/ui';

// Board 04 · 02 Age gate, 03 Under 18. Stores only the birth year (unchanged).
export default function Age() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [year, setYear] = useState('');
  const [blocked, setBlocked] = useState(false);
  const y = Number(year);
  const valid = year.length === 4 && y > 1900 && y <= new Date().getFullYear();

  if (blocked) {
    return (
      <Screen scroll={false}>
        <View style={{ flexGrow: 1, justifyContent: 'center', gap: 16 }}>
          <IconTile name="information-circle-outline" />
          <T size="xl" header>RepProof is for ages 18 and up.</T>
          <T muted>{"This app is built for adult training and nutrition, so we can't set up an account for you yet. Nothing you entered was saved. Thanks for checking us out."}</T>
          <Card flat><T size="sm" muted>If you want to start lifting, a PE teacher, coach or doctor can help you do it safely.</T></Card>
        </View>
        <Button kind="secondary" title="Close" onPress={() => router.replace('/')} />
        <Button kind="ghost" title="I entered the wrong year" onPress={() => { setBlocked(false); setYear(''); }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <StepProgress step={1} total={2} onBack={() => router.back()} />
      <View style={{ flexGrow: 1, justifyContent: 'flex-end', gap: 16 }}>
        <T size="xl" header>RepProof is for adults.</T>
        <T muted>{"Please enter the year you were born. We use it only to confirm you're 18 or older."}</T>
        <Field label="Year of birth" keyboardType="number-pad" maxLength={4} placeholder="e.g. 1998" value={year} onChangeText={setYear} autoFocus />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.accentSoft, borderRadius: 12, padding: 12 }}>
          <Ionicons name="shield-checkmark-outline" size={16} color={C.accent} />
          <T size="sm" muted style={{ flex: 1 }}>Your birth year is not shown to anyone else.</T>
        </View>
      </View>
      <Button kind="primary" title="Continue" disabled={!valid} onPress={() => {
        // Under 18: nothing is stored anywhere.
        if (!isAdult(y)) return setBlocked(true);
        setPending({ birthYear: y, disclaimerAt: null });
        router.push({ pathname: '/disclaimer', params: { mode } });
      }} />
    </Screen>
  );
}
