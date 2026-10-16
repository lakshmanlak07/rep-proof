import * as WebBrowser from 'expo-web-browser';

import { POLICY, POLICY_UPDATED } from '@/lib/privacyPolicy';
import { DELETE_ACCOUNT_URL, PRIVACY_URL } from '@/lib/site';
import { Button, Card, Screen, T } from '@/ui';

/** The full privacy policy, in the app (reachable before sign-up and from Account). */
export default function Privacy() {
  return (
    <Screen edges={['bottom']}>
      {/* The screen header already says "Privacy policy". */}
      <T muted size="sm">Last updated {POLICY_UPDATED}</T>
      {POLICY.map((sec) => (
        <Card key={sec.title} flat>
          <T size="lg" header>{sec.title}</T>
          {sec.body.map((p) => <T key={p}>{p}</T>)}
        </Card>
      ))}
      {PRIVACY_URL ? <Button title="Open the web version" onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL!)} /> : null}
      {DELETE_ACCOUNT_URL ? <Button kind="ghost" title="Account deletion page" onPress={() => WebBrowser.openBrowserAsync(DELETE_ACCOUNT_URL!)} /> : null}
    </Screen>
  );
}
