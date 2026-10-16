/* eslint-disable @typescript-eslint/no-require-imports -- fresh module state per test needs require() after resetModules */
// Rest-timer notifications (lib/notify.ts) with the native module mocked: permission granted, denied, revoked
// later, errors, and rapid re-scheduling never leaving a stray alert. Real delivery needs a phone.
import * as Notifications from 'expo-notifications';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

let N = jest.mocked(Notifications); // re-read after each resetModules (the module notify.ts imports)
const load = () => require('@/lib/notify') as typeof import('@/lib/notify');
let ids = 0;
beforeEach(() => {
  jest.resetModules();
  require('expo-sqlite/localStorage/install'); // installs the test localStorage (see setup.ts)
  N = jest.mocked(require('expo-notifications') as typeof Notifications);
  localStorage.clear();
  jest.clearAllMocks();
  ids = 0;
  N.requestPermissionsAsync.mockResolvedValue({ granted: true } as never);
  N.getPermissionsAsync.mockResolvedValue({ granted: true } as never);
  N.scheduleNotificationAsync.mockImplementation(async () => `n${++ids}`);
});

test('off by default: nothing is scheduled and no permission is asked', async () => {
  const n = load();
  expect(n.restAlertsOn()).toBe(false);
  await n.scheduleRestAlert(90, 'Bench');
  expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
});

test('turning on asks permission; granted schedules "Rest is over" for the rest length', async () => {
  const n = load();
  expect(await n.setRestAlerts(true)).toBe(true);
  await n.scheduleRestAlert(90, '60 kg × 8');
  expect(N.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
    content: expect.objectContaining({ title: 'Rest is over', body: 'Up next: 60 kg × 8' }),
    trigger: expect.objectContaining({ seconds: 90 }),
  }));
});

test('permission denied: alerts stay off and nothing is scheduled', async () => {
  N.requestPermissionsAsync.mockResolvedValue({ granted: false } as never);
  const n = load();
  expect(await n.setRestAlerts(true)).toBe(false);
  expect(n.restAlertsOn()).toBe(false);
  await n.scheduleRestAlert(90, null);
  expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
});

test('a permission error is treated as a refusal, not a crash', async () => {
  N.requestPermissionsAsync.mockRejectedValue(new Error('native module unavailable'));
  const n = load();
  await expect(n.setRestAlerts(true)).resolves.toBe(false);
  expect(n.restAlertsOn()).toBe(false);
});

test('permission revoked in phone settings: the preference switches off instead of claiming alerts are on', async () => {
  const n = load();
  await n.setRestAlerts(true);
  N.getPermissionsAsync.mockResolvedValue({ granted: false } as never);
  await n.scheduleRestAlert(90, null);
  expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(n.restAlertsOn()).toBe(false);
});

test('re-scheduling replaces the alert; overlapping schedules never leave two alerts pending', async () => {
  const n = load();
  await n.setRestAlerts(true);
  await n.scheduleRestAlert(90, null); // n1
  await n.scheduleRestAlert(105, null); // +15 s: n1 cancelled, n2 pending
  expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith('n1');
  // Two taps at once: both in flight together; only the newest may survive.
  await Promise.all([n.scheduleRestAlert(120, null), n.scheduleRestAlert(135, null)]);
  const scheduled = N.scheduleNotificationAsync.mock.results.length;
  const cancelled = new Set(N.cancelScheduledNotificationAsync.mock.calls.map((c) => c[0]));
  expect(scheduled - cancelled.size).toBe(1);
  await n.cancelRestAlert();
  expect(new Set(N.cancelScheduledNotificationAsync.mock.calls.map((c) => c[0])).size).toBe(scheduled);
});

test('very short rests (under 5 s) are not worth a notification', async () => {
  const n = load();
  await n.setRestAlerts(true);
  await n.scheduleRestAlert(3, null);
  expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
});
