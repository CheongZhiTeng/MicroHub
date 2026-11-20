import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import Members from '../app/members';
import { client } from '../src/lib/supabase';
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));
jest.mock('../src/features/access', () => ({
  Access: ({
    children,
  }: {
    children: (identity: {
      profile: { name_en: null; name_zh: null };
    }) => React.ReactNode;
  }) => children({ profile: { name_en: null, name_zh: null } }),
}));
jest.mock('../src/lib/supabase', () => ({ client: jest.fn() }));
test('repeating a search reloads data and punctuation remains in a quoted filter', async () => {
  const result = jest.fn().mockResolvedValue({ data: [], error: null });
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    range: jest.fn(),
    or: jest.fn(),
    returns: result,
  };
  for (const name of ['select', 'eq', 'order', 'range', 'or'] as const)
    query[name].mockReturnValue(query);
  jest
    .mocked(client)
    .mockReturnValue({ from: () => query } as unknown as ReturnType<
      typeof client
    >);
  await render(<Members />);
  await screen.findByText('No matching members.');
  await fireEvent.changeText(
    screen.getByLabelText('Search name or student ID'),
    "O'Neil, Jr.",
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Search members' }));
  await waitFor(() => expect(result).toHaveBeenCalledTimes(2));
  expect(query.or).toHaveBeenLastCalledWith(
    'display_name.ilike."%O\'Neil, Jr.%",name_zh.ilike."%O\'Neil, Jr.%",name_en.ilike."%O\'Neil, Jr.%",student_id.ilike."%O\'Neil, Jr.%"',
  );
  await screen.findByText('No matching members.');
  await fireEvent.press(screen.getByRole('button', { name: 'Search members' }));
  await waitFor(() => expect(result).toHaveBeenCalledTimes(3));
});
