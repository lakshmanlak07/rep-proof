import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { isAdult, setPending } from '@/lib/pending';
import { Button, Field, Screen, T } from '@/ui';

export default function Age() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [year, setYear] = useState('');
  const [blocked, setBlocked] = useState(false);
  const y = Number(year);
  const valid = year.length === 4 && y > 1900 && y <= new Date().getFullYear();

  if (blocked) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
          <T size="lg">RepProof is for adults 18 and over.</T>
          <T muted>Nothing you entered was saved.</T>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <T size="lg">What year were you born?</T>
      <Field keyboardType="number-pad" maxLength={4} placeholder="e.g. 1998" value={year} onChangeText={setYear} autoFocus />
      <View style={{ flex: 1 }} />
      <Button kind="primary" title="Continue" disabled={!valid} onPress={() => {
        // Under 18: nothing is stored anywhere.
        if (!isAdult(y)) return setBlocked(true);
        setPending({ birthYear: y, disclaimerAt: null });
        router.push({ pathname: '/disclaimer', params: { mode } });
      }} />
    </Screen>
  );
}
