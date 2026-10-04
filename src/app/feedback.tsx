import { useState } from 'react';

import { attempt } from '@/lib/alert';
import { sendFeedback, track } from '@/lib/data';
import { leave } from '@/lib/nav';
import { Button, Field, Screen, T } from '@/ui';

export default function Feedback() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    setBusy(true);
    const ok = await attempt(() => sendFeedback('feedback', message), 'send your feedback');
    setBusy(false);
    if (!ok) return;
    track('feedback_sent');
    setSent(true);
  }

  if (sent) {
    return (
      <Screen>
        <T size="lg">Thanks, got it.</T>
        <T muted>Every message is read. It shapes what gets built next.</T>
        <Button kind="primary" title="Done" onPress={leave} />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <T muted>Bugs, confusing screens, ideas, anything. Please do not include medical details.</T>
      <Field value={message} onChangeText={setMessage} multiline maxLength={2000} placeholder="What should we know?"
        style={{ minHeight: 140, textAlignVertical: 'top', paddingTop: 12 }} />
      <Button kind="primary" title="Send feedback" loading={busy} disabled={message.trim().length < 3} onPress={send} />
    </Screen>
  );
}
