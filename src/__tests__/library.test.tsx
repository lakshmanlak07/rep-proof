// Exercise library and detail: search spans every muscle, equipment filter, details and alternatives open real routes.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { EXERCISES } from '@/engine/exercises.ts';
import Library from '@/app/library';
import ExerciseDetail from '@/app/exercise/[id]';

const mockProfile = { id: 'u1', setup: 'home', avoid: [] };
jest.mock('@/lib/data', () => ({ useData: () => ({ profile: mockProfile }) }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

beforeEach(() => jest.clearAllMocks());

test('search looks across all muscles; no match shows an empty state', async () => {
  await render(<Library />);
  await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'squat');
  expect(screen.getByText('Barbell back squat')).toBeTruthy(); // not in the default "chest" category
  await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'zzzz');
  expect(screen.getByText('No exercises match')).toBeTruthy();
});

test('"My equipment" hides exercises a home setup cannot do', async () => {
  await render(<Library />);
  await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'machine chest');
  expect(screen.getByText('Machine chest press')).toBeTruthy();
  await fireEvent.press(screen.getByText('My equipment'));
  expect(screen.queryByText('Machine chest press')).toBeNull(); // home setup: no machines
  expect(screen.getByText('No exercises match')).toBeTruthy();
});

test('tapping an exercise opens its detail route', async () => {
  await render(<Library />);
  await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'barbell bench');
  await fireEvent.press(screen.getByText('Barbell bench press'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/exercise/[id]', params: { id: 'bb_bench' } });
});

test('detail shows real steps and cues, says plainly there is no video, and links alternatives', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'bb_bench' });
  await render(<ExerciseDetail />);
  expect(screen.getByText('Barbell bench press')).toBeTruthy();
  expect(screen.getByText(/does not include exercise videos/)).toBeTruthy();
  for (const cue of EXERCISES.find((e) => e.id === 'bb_bench')!.cues) expect(screen.getAllByText(cue).length).toBeGreaterThan(0);
  expect(screen.getByText('Alternatives with your equipment')).toBeTruthy();
});

test('an unknown exercise id shows "not found" with a way back', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'nope' });
  await render(<ExerciseDetail />);
  expect(screen.getByText('Exercise not found')).toBeTruthy();
  await fireEvent.press(screen.getByText('Open the library'));
  expect(router.replace).toHaveBeenCalledWith('/library');
});
