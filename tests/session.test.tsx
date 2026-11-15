import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { Session } from '@supabase/supabase-js';
import { SessionProvider, useSession } from '../src/features/session';
import { supabase } from '../src/lib/supabase';
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    },
  },
}));
test('late persisted-session read cannot overwrite a fresh sign-in or sign-out event', async () => {
  let listener: (event: string, session: Session | null) => void = () => {};
  let resolve: (
    value: Awaited<
      ReturnType<NonNullable<typeof supabase>['auth']['getSession']>
    >,
  ) => void = () => {};
  jest.mocked(supabase!.auth.getSession).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }) as ReturnType<NonNullable<typeof supabase>['auth']['getSession']>,
  );
  const unsubscribe = jest.fn();
  jest
    .mocked(supabase!.auth.onAuthStateChange)
    .mockImplementation((callback) => {
      listener = callback as typeof listener;
      return { data: { subscription: { id: 'test', callback, unsubscribe } } };
    });
  const { result, unmount } = await renderHook(useSession, {
    wrapper: SessionProvider,
  });
  const fresh = { user: { id: 'fresh' } } as Session;
  await act(() => listener('SIGNED_IN', fresh));
  await act(() =>
    resolve({
      data: { session: { user: { id: 'stale' } } as Session },
      error: null,
    }),
  );
  expect(result.current.session?.user.id).toBe('fresh');
  await act(() => listener('PASSWORD_RECOVERY', fresh));
  expect(result.current.recovery).toBe(true);
  await act(() => listener('SIGNED_OUT', null));
  expect(result.current.session).toBeNull();
  expect(result.current.recovery).toBe(false);
  await unmount();
  expect(unsubscribe).toHaveBeenCalled();
});
test('secure storage failure is exposed and can be retried', async () => {
  jest
    .mocked(supabase!.auth.getSession)
    .mockRejectedValueOnce(new Error('Storage locked'))
    .mockResolvedValueOnce({ data: { session: null }, error: null });
  const { result } = await renderHook(useSession, { wrapper: SessionProvider });
  await waitFor(() => expect(result.current.error).toBe('Storage locked'));
  await act(() => result.current.retry());
  await waitFor(() => expect(result.current.error).toBeNull());
  expect(result.current.loading).toBe(false);
});
