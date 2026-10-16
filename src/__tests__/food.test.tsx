// Add food: search, pick, portion maths (real), add once, failures keep the user on the screen, custom food validation.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import AddFood from '@/app/food';
import { leave } from '@/lib/nav';

const mockSearch = jest.fn();
const mockAdd = jest.fn();
const mockDeleteSaved = jest.fn(() => Promise.resolve());
const mockSaved = jest.fn(() => Promise.resolve([] as unknown[]));
jest.mock('@/lib/food', () => ({
  ...jest.requireActual('@/lib/food'),
  searchFoods: (...a: unknown[]) => mockSearch(...a),
  addLogs: (...a: unknown[]) => mockAdd(...a),
  savedMeals: () => mockSaved(),
  byBarcode: (...a: unknown[]) => mockByBarcode(...a),
  recentFoods: () => Promise.resolve([]),
  deleteSavedMeal: (...a: unknown[]) => mockDeleteSaved(...(a as [])),
}));
jest.mock('@/lib/data', () => ({ track: jest.fn() }));
jest.mock('@/lib/nav', () => ({ leave: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
const mockPermission = jest.fn(() => null as null | { granted: boolean; canAskAgain: boolean });
const mockRequest = jest.fn();
let mockScan: ((e: { data: string }) => void) | null = null;
jest.mock('expo-camera', () => ({
  CameraView: (p: { onBarcodeScanned: (e: { data: string }) => void }) => { mockScan = p.onBarcodeScanned; return null; },
  useCameraPermissions: () => [mockPermission(), mockRequest],
}));
const mockByBarcode = jest.fn();

const oats = { id: '173904', source: 'usda', name: 'Oats, rolled', brand: null, servingGrams: null, per100: { kcal: 379, protein: 13.2, fat: 6.5, carbs: 67.7 } };
let alerts: { title: string; buttons?: AlertButton[] }[] = [];
beforeEach(() => {
  jest.clearAllMocks();
  alerts = [];
  jest.spyOn(Alert, 'alert').mockImplementation((title, _m, buttons) => { alerts.push({ title, buttons }); });
});

async function searchAndPick() {
  mockSearch.mockResolvedValueOnce({ foods: [oats], onlineError: null });
  await render(<AddFood />);
  await act(async () => {});
  await fireEvent.changeText(screen.getByLabelText('Search foods'), 'oats');
  await fireEvent.press(screen.getByText('Search'));
  await act(async () => {});
  await fireEvent.press(screen.getByText('Oats, rolled'));
  await fireEvent.changeText(screen.getByDisplayValue('100'), '50');
}

test('search, pick 50 g, add: the logged macros are the real per-100 g values scaled, and the screen closes once', async () => {
  mockAdd.mockResolvedValueOnce(undefined);
  await searchAndPick();
  expect(mockSearch).toHaveBeenCalledWith('oats');
  await fireEvent.press(screen.getByText('Add to Snack'));
  await act(async () => {});
  expect(mockAdd).toHaveBeenCalledTimes(1);
  const [meal, items] = mockAdd.mock.calls[0];
  expect(meal).toBe('snack');
  expect(items).toEqual([expect.objectContaining({ name: 'Oats, rolled', grams: 50, kcal: 190, protein: 6.6 })]);
  expect(leave).toHaveBeenCalledTimes(1);
});

test('a double tap on Add logs the food once', async () => {
  let resolve!: () => void;
  mockAdd.mockReturnValueOnce(new Promise<void>((r) => { resolve = r; }));
  await searchAndPick();
  // Two taps inside one act, before the first insert settles (fireEvent.press would wait for it).
  const button = screen.getByRole('button', { name: /Add to Snack/ });
  await act(async () => { button.props.onClick({ nativeEvent: {} }); button.props.onClick({ nativeEvent: {} }); resolve(); });
  expect(mockAdd).toHaveBeenCalledTimes(1);
});

test('a failed add says so, stays on the screen, and a second tap really retries', async () => {
  mockAdd.mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValueOnce(undefined);
  await searchAndPick();
  await fireEvent.press(screen.getByText('Add to Snack'));
  await act(async () => {});
  expect(alerts.map((a) => a.title)).toContain('Could not add that food');
  expect(leave).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('Add to Snack'));
  await act(async () => {});
  expect(mockAdd).toHaveBeenCalledTimes(2);
  expect(leave).toHaveBeenCalledTimes(1);
});

test('a failed search tells the user; an empty result offers a custom food', async () => {
  mockSearch.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ foods: [], onlineError: null });
  await render(<AddFood />);
  await act(async () => {});
  await fireEvent.changeText(screen.getByLabelText('Search foods'), 'zzzz');
  await fireEvent.press(screen.getByText('Search'));
  await act(async () => {});
  expect(alerts.map((a) => a.title)).toContain('Search failed');
  await fireEvent.press(screen.getByText('Search'));
  await act(async () => {});
  expect(screen.getByText('No foods found. Try simpler words.')).toBeTruthy();
  expect(screen.getByText('Add it as a custom food')).toBeTruthy();
});

test('a custom food with a negative macro cannot be added', async () => {
  await render(<AddFood />);
  await act(async () => {});
  await fireEvent.press(screen.getByText("Can't find it? Add a custom food"));
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Protein bar');
  await fireEvent.changeText(screen.getByLabelText('Amount (g)'), '60');
  await fireEvent.changeText(screen.getByLabelText('Calories'), '220');
  await fireEvent.changeText(screen.getByLabelText('Protein g'), '-20');
  await fireEvent.press(screen.getByText('Add'));
  expect(mockAdd).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Protein g'), '20');
  mockAdd.mockResolvedValueOnce(undefined);
  await fireEvent.press(screen.getByText('Add'));
  await act(async () => {});
  expect(mockAdd.mock.calls[0][1]).toEqual([expect.objectContaining({ name: 'Protein bar', grams: 60, kcal: 220, protein: 20 })]);
});

test('deleting a saved meal asks first', async () => {
  mockSaved.mockResolvedValue([{ id: 'm1', name: 'Breakfast, Oct 9', items: [{ kcal: 300 }] }]);
  await render(<AddFood />);
  await act(async () => {});
  await fireEvent.press(screen.getByText('Delete'));
  expect(alerts[0].title).toBe('Delete this saved meal?');
  expect(mockDeleteSaved).not.toHaveBeenCalled();
  await act(async () => { await alerts[0].buttons!.find((b) => b.text === 'Delete')!.onPress!(); });
  expect(mockDeleteSaved).toHaveBeenCalledWith('m1');
  mockSaved.mockResolvedValue([]);
});

test('scanner: asks for camera permission; if refused for good, offers the phone settings instead of a dead button', async () => {
  mockPermission.mockReturnValue({ granted: false, canAskAgain: true });
  await render(<AddFood />);
  await act(async () => {});
  await fireEvent.press(screen.getByText('Scan a barcode'));
  await fireEvent.press(screen.getByText('Allow camera'));
  expect(mockRequest).toHaveBeenCalled();
  await screen.unmount();
  mockPermission.mockReturnValue({ granted: false, canAskAgain: false });
  await render(<AddFood />);
  await act(async () => {});
  await fireEvent.press(screen.getByText('Scan a barcode'));
  expect(screen.queryByText('Allow camera')).toBeNull();
  expect(screen.getByText('Open settings')).toBeTruthy();
});

test('scanner: a found barcode opens that food once (repeat reads ignored); an unknown one offers a custom food', async () => {
  mockPermission.mockReturnValue({ granted: true, canAskAgain: true });
  mockByBarcode.mockResolvedValueOnce([{ ...oats, id: '5000', source: 'off', name: 'Granola bar', servingGrams: 40 }]);
  await render(<AddFood />);
  await act(async () => {});
  await fireEvent.press(screen.getByText('Scan a barcode'));
  await act(async () => { mockScan!({ data: '5012345678900' }); mockScan!({ data: '5012345678900' }); });
  expect(mockByBarcode).toHaveBeenCalledTimes(1);
  expect(mockByBarcode).toHaveBeenCalledWith('5012345678900');
  expect(screen.getAllByText('Granola bar').length).toBeGreaterThan(0);
  expect(screen.getByDisplayValue('1')).toBeTruthy(); // one serving preselected

  mockByBarcode.mockResolvedValueOnce([]);
  await fireEvent.press(screen.getByText('Scan a barcode'));
  await act(async () => { mockScan!({ data: '0000000000000' }); });
  expect(screen.getByText('That barcode is not in the food databases yet.')).toBeTruthy();
  expect(screen.getByText('Add it as a custom food')).toBeTruthy();
});

test('an invalid meal in the link falls back to Snack', async () => {
  const { useLocalSearchParams } = jest.requireMock('expo-router') as { useLocalSearchParams: jest.Mock };
  useLocalSearchParams.mockReturnValueOnce({ meal: 'junk' });
  mockSearch.mockResolvedValueOnce({ foods: [oats], onlineError: null });
  await render(<AddFood />);
  await act(async () => {});
  await fireEvent.changeText(screen.getByLabelText('Search foods'), 'oats');
  await fireEvent.press(screen.getByText('Search'));
  await act(async () => {});
  await fireEvent.press(screen.getByText('Oats, rolled'));
  expect(screen.getByText('Add to Snack')).toBeTruthy();
});

test('custom food: a failed add keeps the form and its values; comma decimals are accepted', async () => {
  mockAdd.mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValueOnce(undefined);
  await render(<AddFood />);
  await act(async () => {});
  await fireEvent.press(screen.getByText("Can't find it? Add a custom food"));
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Protein bar');
  await fireEvent.changeText(screen.getByLabelText('Amount (g)'), '60');
  await fireEvent.changeText(screen.getByLabelText('Calories'), '220');
  await fireEvent.changeText(screen.getByLabelText('Protein g'), '20,5');
  await fireEvent.press(screen.getByText('Add'));
  await act(async () => {});
  expect(alerts.map((a) => a.title)).toContain('Could not add that food');
  expect(screen.getByLabelText('Name').props.value).toBe('Protein bar');
  await fireEvent.press(screen.getByText('Add'));
  await act(async () => {});
  expect(mockAdd.mock.calls[1][1]).toEqual([expect.objectContaining({ name: 'Protein bar', protein: 20.5 })]);
});

test('an older search finishing after a newer one never replaces its results', async () => {
  let slow!: (v: unknown) => void;
  mockSearch.mockReturnValueOnce(new Promise((r) => { slow = r; }))
    .mockResolvedValueOnce({ foods: [{ ...oats, id: '2', name: 'Chicken breast, roasted' }], onlineError: null });
  await render(<AddFood />);
  await act(async () => {});
  await fireEvent.changeText(screen.getByLabelText('Search foods'), 'chicken');
  await act(async () => { screen.getByLabelText('Search foods').props.onSubmitEditing(); });
  await fireEvent.changeText(screen.getByLabelText('Search foods'), 'chicken breast');
  await act(async () => { screen.getByLabelText('Search foods').props.onSubmitEditing(); });
  await act(async () => { slow({ foods: [{ ...oats, id: '1', name: 'Chicken nuggets' }], onlineError: null }); });
  expect(screen.getByText('Chicken breast, roasted')).toBeTruthy();
  expect(screen.queryByText('Chicken nuggets')).toBeNull();
});

test('saved meals count their items in words that read right ("1 item", "2 items")', async () => {
  mockSaved.mockResolvedValue([
    { id: 'm1', name: 'Snack', items: [{ kcal: 300 }] },
    { id: 'm2', name: 'Lunch', items: [{ kcal: 300 }, { kcal: 1200 }] },
  ]);
  await render(<AddFood />);
  await act(async () => {});
  expect(screen.getByText('1 item · 300 kcal')).toBeTruthy();
  expect(screen.getByText('2 items · 1,500 kcal')).toBeTruthy();
  mockSaved.mockResolvedValue([]);
});
