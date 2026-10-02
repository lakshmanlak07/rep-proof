import { Alert, Platform, type AlertButton } from 'react-native';

/**
 * Alert.alert on iOS/Android. On web (react-native-web has no Alert), falls back to
 * window.alert/confirm: each non-cancel button is offered in order and the first "OK" wins.
 */
export function alert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') return Alert.alert(title, message, buttons);
  const actions = (buttons ?? []).filter((b) => b.style !== 'cancel');
  const text = message ? `${title}\n\n${message}` : title;
  if (!actions.length) return window.alert(text);
  if (actions.length === 1 && !(buttons ?? []).some((b) => b.style === 'cancel')) {
    window.alert(text);
    return actions[0].onPress?.();
  }
  for (const b of actions) {
    if (window.confirm(`${text}\n\n${b.text}?`)) return b.onPress?.();
  }
}
