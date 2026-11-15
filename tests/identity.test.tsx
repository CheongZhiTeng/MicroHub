import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useIdentity } from '../src/features/identity';
import { useSession } from '../src/features/session';
import { client } from '../src/lib/supabase';
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(callback, [callback]);
  },
}));
jest.mock('../src/features/session', () => ({ useSession: jest.fn() }));
jest.mock('../src/lib/supabase', () => ({ client: jest.fn() }));
test('account switch hides previous identity while the new profile loads', async () => {
  let account = 'first';
  let release: (value: unknown) => void = () => {};
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  jest
    .mocked(useSession)
    .mockImplementation(
      () =>
        ({ session: { user: { id: account } } }) as ReturnType<
          typeof useSession
        >,
    );
  jest.mocked(client).mockReturnValue({
    from: (table: string) => {
      const data =
        table === 'profiles'
          ? { id: account, status: 'active', student_id: '000001' }
          : table === 'platform_roles'
            ? { role: 'member' }
            : table === 'memberships'
              ? { status: 'active' }
              : null;
      const result =
        table === 'profiles' && account === 'second'
          ? pending
          : Promise.resolve({ data, error: null });
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: () => query,
        single: () => result,
        maybeSingle: () => result,
      };
      return query;
    },
  } as unknown as ReturnType<typeof client>);
  const { result, rerender } = await renderHook(useIdentity);
  await waitFor(() =>
    expect(result.current.identity?.profile.id).toBe('first'),
  );
  account = 'second';
  await rerender({});
  expect(result.current.identity).toBeNull();
  await act(() =>
    release({
      data: { id: 'second', status: 'active', student_id: '000002' },
      error: null,
    }),
  );
  await waitFor(() =>
    expect(result.current.identity?.profile.id).toBe('second'),
  );
});
