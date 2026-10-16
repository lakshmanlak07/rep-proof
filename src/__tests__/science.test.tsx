// Learn / science explainers: new topics render with limitations and their checked sources; deep links, glossary
// links and unknown references are handled; opening a study goes to its DOI.
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { REFERENCES } from '@/engine/references.ts';
import { TOPICS } from '@/engine/science.ts';
import Science from '@/app/science';
import { RefLinks } from '@/why';

const mockTrack = jest.fn();
jest.mock('@/lib/data', () => ({ track: (...a: unknown[]) => mockTrack(...a) }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

beforeEach(() => { jest.clearAllMocks(); jest.mocked(useLocalSearchParams).mockReturnValue({}); });

test.each(['Junk volume', 'Mind-muscle connection', 'Time under tension and rep speed', 'Creatine: amounts studied'])('%s: limitations and every cited study are shown', async (title) => {
  const t = TOPICS.find((x) => x.title === title)!;
  await render(<Science />);
  await fireEvent.changeText(screen.getByLabelText('Search topics'), title.split(':')[0]);
  await fireEvent.press(screen.getByText(title));
  expect(screen.getByText(`Limitations: ${t.doesNotShow}`)).toBeTruthy();
  expect(t.refIds.length).toBeGreaterThan(0);
  for (const id of t.refIds) expect(screen.getByText(`${REFERENCES[id].citation} · Open study`)).toBeTruthy();
  expect(mockTrack).toHaveBeenCalledWith('science_topic', { topic: title });
});

test('opening a study goes to its DOI and records only the study id', async () => {
  await render(<Science />);
  await fireEvent.changeText(screen.getByLabelText('Search topics'), 'Mind-muscle');
  await fireEvent.press(screen.getByText('Mind-muscle connection'));
  await fireEvent.press(screen.getByText(`${REFERENCES.attention_focus.citation} · Open study`));
  expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://doi.org/10.1080/17461391.2018.1447020');
  expect(mockTrack).toHaveBeenCalledWith('study_opened', { id: 'attention_focus' });
});

test('a deep link opens that topic first; an unknown topic is ignored', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ topic: 'Junk volume' });
  await render(<Science />);
  expect(screen.getByText('The evidence behind that recommendation')).toBeTruthy();
  expect(screen.getByText(`Limitations: ${TOPICS.find((x) => x.title === 'Junk volume')!.doesNotShow}`)).toBeTruthy();
  await screen.unmount();
  jest.mocked(useLocalSearchParams).mockReturnValue({ topic: 'Not a topic' });
  await render(<Science />);
  expect(screen.queryByText('The evidence behind that recommendation')).toBeNull();
});

test('a glossary term links to its explainer', async () => {
  await render(<Science />);
  await fireEvent.press(screen.getByText('Glossary'));
  await fireEvent.changeText(screen.getByLabelText('Search the glossary'), 'tempo');
  await fireEvent.press(screen.getByText('Read the evidence: Time under tension and rep speed'));
  expect(screen.getByText(TOPICS.find((x) => x.title === 'Time under tension and rep speed')!.shows)).toBeTruthy();
});

test('an unknown reference id renders nothing instead of crashing', async () => {
  await render(<RefLinks ids={['does_not_exist', 'rep_duration']} />);
  expect(screen.getByText(`${REFERENCES.rep_duration.citation} · Open study`)).toBeTruthy();
  expect(screen.getAllByRole('link')).toHaveLength(1);
});

test('a topic toggle reports expanded state, and study links sit outside it so screen readers can reach them', async () => {
  await render(<Science />);
  await fireEvent.changeText(screen.getByLabelText('Search topics'), 'Mind-muscle');
  const toggle = () => screen.getByRole('button', { name: /Mind-muscle connection/ });
  expect(toggle().props.accessibilityState).toMatchObject({ expanded: false });
  await fireEvent.press(toggle());
  expect(toggle().props.accessibilityState).toMatchObject({ expanded: true });
  expect(within(toggle()).queryAllByRole('link')).toHaveLength(0);
  expect(screen.getAllByRole('link').length).toBeGreaterThan(0);
});
