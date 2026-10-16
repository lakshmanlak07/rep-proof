import 'expo-sqlite/localStorage/install';

// Rest-timer alerts as local notifications (nothing is sent to a server). Off until the user turns them on
// in Account > Notifications, which is when Android/iOS ask for permission. Web version: notify.web.ts.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const KEY = 'rest_alerts';
let pending: string | null = null;
let generation = 0; // bumps on every schedule/cancel, so an older in-flight schedule can tell it was superseded

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

export const notificationsSupported = true;
export const restAlertsOn = () => localStorage.getItem(KEY) === 'on';

/** Turns rest alerts on (asking for permission) or off. Returns whether they are on afterwards. */
export async function setRestAlerts(on: boolean): Promise<boolean> {
  if (!on) {
    localStorage.setItem(KEY, 'off');
    await cancelRestAlert();
    return false;
  }
  let granted = false;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('rest', { name: 'Rest timer', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 250, 150, 250] });
    }
    granted = (await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } })).granted;
  } catch {
    granted = false; // treated like a refusal: the screen explains how to allow notifications
  }
  localStorage.setItem(KEY, granted ? 'on' : 'off');
  return granted;
}

/** Schedules "rest is over" for `seconds` from now, replacing any earlier one. No-op when alerts are off. */
export async function scheduleRestAlert(seconds: number, next: string | null) {
  const mine = ++generation; // taken before any await: a later call always gets a higher number
  await cancelPending();
  if (!restAlertsOn() || seconds < 5) return;
  try {
    // Permission can be revoked in the phone's settings at any time: then switch the preference off, so
    // Account never claims alerts are on while nothing would be shown.
    if (!(await Notifications.getPermissionsAsync()).granted) {
      localStorage.setItem(KEY, 'off');
      return;
    }
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: 'Rest is over', body: next ? `Up next: ${next}` : 'Time for your next set.', sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.round(seconds), channelId: 'rest' },
    });
    // A newer schedule or a cancel happened while this one was in flight: never leave a stray alert behind.
    if (mine !== generation) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    else pending = id;
  } catch {
    if (mine === generation) pending = null; // the in-app timer still works; never clear a newer alert's id
  }
}

export async function cancelRestAlert() {
  generation++;
  await cancelPending();
}

async function cancelPending() {
  if (!pending) return;
  const id = pending;
  pending = null;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}
