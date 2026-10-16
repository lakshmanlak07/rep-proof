// Workout day detail (pins, start, bad links) and Feedback (validation, failure, success).
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { buildProgram } from '@/engine/plan.ts';
import WorkoutDay from '@/app/workout-day/[index]';
import Feedback from '@/app/feedback';

const mockProgram = {
  id: 'p1', split: 'upper_lower', next_day: 1,
  plan: buildProgram({ experience: 'intermediate', goal: 'muscle', setup: 'commercial', days: 4, sessionMinutes: 60, unit: 'kg', avoid: [] }, 'upper_lower'),
};
const mockUpdatePlan = jest.fn();
const mockFeedback = jest.fn();
const mockRefresh = jest.fn();
jest.mock('@/lib/data', () => ({
  useData: () => ({ program: mockProgram, refresh: mockRefresh }),
  updatePlan: (...a: unknown[]) => mockUpdatePlan(...a),
  sendFeedback: (...a: unknown[]) => mockFeedback(...a),
  track: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/nav', () => ({ leave: jest.fn() }));

let alerts: { title: string; buttons?: AlertButton[] }[] = [];
beforeEach(() => {
  jest.clearAllMocks();
  alerts = [];
  jest.spyOn(Alert, 'alert').mockImplementation((title, _m, buttons) => { alerts.push({ title, buttons }); });
});

test.each(['-1', '1.5', 'abc', '99'])('a bad day link (%s) opens a real day instead of crashing', async (index) => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ index });
  await render(<WorkoutDay />);
  const expected = index === '99' ? mockProgram.plan.days.length - 1 : 0;
  expect(screen.getByText(mockProgram.plan.days[expected].name)).toBeTruthy();
});

test('only the next workout can be started from here', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ index: '0' });
  await render(<WorkoutDay />);
  expect(screen.queryByText('Start this workout')).toBeNull();
  await screen.unmount();
  jest.mocked(useLocalSearchParams).mockReturnValue({ index: '1' });
  await render(<WorkoutDay />);
  await fireEvent.press(screen.getByText('Start this workout'));
  expect(router.replace).toHaveBeenCalledWith('/workout');
});

test('pinning sets saves only that exercise in that day; a failed save keeps the sheet open', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ index: '1' });
  mockUpdatePlan.mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValueOnce(undefined);
  await render(<WorkoutDay />);
  await fireEvent.press(screen.getAllByLabelText('Edit sets and reps')[0]);
  await fireEvent.changeText(screen.getByLabelText(/^Sets, 1-3/), '3');
  await fireEvent.press(screen.getByText('Save'));
  await act(async () => {});
  expect(alerts.map((a) => a.title)).toContain('Could not save the pin');
  expect(screen.getByText('Save')).toBeTruthy();
  await fireEvent.press(screen.getByText('Save'));
  await act(async () => {});
  const saved = mockUpdatePlan.mock.calls[1][1];
  expect(saved.days[1].exercises[0].pinnedSets).toBe(3);
  expect(saved.days[1].exercises.slice(1).every((e: { pinnedSets?: number }) => e.pinnedSets === undefined)).toBe(true);
  expect(saved.days[0]).toEqual(mockProgram.plan.days[0]);
  expect(mockRefresh).toHaveBeenCalled();
});

test('feedback: needs a few characters, failure keeps the text, success thanks the user', async () => {
  mockFeedback.mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValueOnce(undefined);
  await render(<Feedback />);
  const send = () => screen.getByRole('button', { name: 'Send feedback' });
  await fireEvent.changeText(screen.getByLabelText('Your feedback'), 'ok');
  expect(send().props.accessibilityState.disabled).toBe(true);
  await fireEvent.changeText(screen.getByLabelText('Your feedback'), 'The rest timer is great');
  await fireEvent.press(send());
  await act(async () => {});
  expect(alerts.map((a) => a.title)).toContain('Could not send your feedback');
  expect(screen.getByLabelText('Your feedback').props.value).toBe('The rest timer is great');
  await fireEvent.press(send());
  await act(async () => {});
  expect(mockFeedback).toHaveBeenLastCalledWith('feedback', 'The rest timer is great');
  expect(screen.getByText('Thanks, got it.')).toBeTruthy();
});
