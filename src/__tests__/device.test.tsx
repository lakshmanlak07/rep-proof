// Device data and announcements: a session that ends without saying whose clears every account's local data;
// warning and error banners are announced (a live region that mounts with its text is often not read).
import { render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { clearLocal, userKeysOnDevice } from '@/lib/prefs';
import { Banner } from '@/ui';

test('clearLocal() without an id removes every per-account key and the device keys, nothing else', () => {
  localStorage.setItem('draft_workout', '{}');
  localStorage.setItem('coach:u1', '{}');
  localStorage.setItem('coach:u2', '{}');
  localStorage.setItem('survey_at:u2', '1');
  localStorage.setItem('unrelated', 'keep');
  expect(userKeysOnDevice().sort()).toEqual(['coach:u1', 'coach:u2', 'survey_at:u2']);
  clearLocal();
  expect(localStorage.getItem('draft_workout')).toBeNull();
  expect(userKeysOnDevice()).toEqual([]);
  expect(localStorage.getItem('unrelated')).toBe('keep');
  localStorage.removeItem('unrelated');
});

test('warning banners are announced; informational ones are not', async () => {
  const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  await render(<Banner tone="danger" text="Could not load your plan." />);
  expect(spy).toHaveBeenCalledWith('Could not load your plan.');
  spy.mockClear();
  await render(<Banner tone="accent" text="Deload week in progress." />);
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});
