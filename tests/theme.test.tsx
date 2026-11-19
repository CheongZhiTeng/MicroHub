import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Text, StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { ThemeProvider, useTheme } from '../src/theme/provider';
import { ThemePicker } from '../src/components/theme-picker';
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));
function Preview() {
  const { theme } = useTheme();
  return (
    <>
      <Text testID="ink" style={{ color: theme.color.text }}>
        Preview
      </Text>
      <ThemePicker />
    </>
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  jest.mocked(SecureStore.setItemAsync).mockResolvedValue();
});
test('restores appearance and persists explicit selection', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('dark');
  await render(
    <ThemeProvider>
      <Preview />
    </ThemeProvider>,
  );
  await waitFor(() =>
    expect(
      StyleSheet.flatten(screen.getByTestId('ink').props.style).color,
    ).toBe('#F2F6FF'),
  );
  await fireEvent.press(
    screen.getByRole('radio', { name: 'light appearance' }),
  );
  expect(StyleSheet.flatten(screen.getByTestId('ink').props.style).color).toBe(
    '#10132E',
  );
  await waitFor(() =>
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'microhub.appearance',
      'light',
    ),
  );
});
test('storage failure does not prevent a usable in-session appearance change', async () => {
  jest
    .mocked(SecureStore.getItemAsync)
    .mockRejectedValue(new Error('unavailable'));
  jest
    .mocked(SecureStore.setItemAsync)
    .mockRejectedValue(new Error('unavailable'));
  await render(
    <ThemeProvider>
      <Preview />
    </ThemeProvider>,
  );
  await fireEvent.press(screen.getByRole('radio', { name: 'dark appearance' }));
  expect(StyleSheet.flatten(screen.getByTestId('ink').props.style).color).toBe(
    '#F2F6FF',
  );
  await waitFor(() => expect(SecureStore.setItemAsync).toHaveBeenCalled());
});
