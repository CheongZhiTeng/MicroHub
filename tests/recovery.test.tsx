import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import Recover from '../app/recover';
import { client } from '../src/lib/supabase';
import { useSession } from '../src/features/session';
import { router } from 'expo-router';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));
jest.mock('../src/lib/supabase', () => ({ client: jest.fn() }));
jest.mock('../src/features/session', () => ({ useSession: jest.fn() }));

test('recovery verifies an OTP before changing password and revokes refresh sessions', async () => {
  const resetPasswordForEmail = jest.fn().mockResolvedValue({ error: null });
  const verifyOtp = jest
    .fn()
    .mockResolvedValueOnce({ error: new Error('Invalid recovery code') })
    .mockResolvedValueOnce({ error: null });
  const updateUser = jest.fn().mockResolvedValue({ error: null });
  const signOut = jest.fn().mockResolvedValue({ error: null });
  const setRecovery = jest.fn();
  jest.mocked(client).mockReturnValue({
    auth: { resetPasswordForEmail, verifyOtp, updateUser, signOut },
  } as unknown as ReturnType<typeof client>);
  const sessionState: ReturnType<typeof useSession> = {
    recovery: false,
    setRecovery,
    session: null,
    loading: false,
    error: null,
    retry: jest.fn(),
  };
  jest.mocked(useSession).mockReturnValue(sessionState);
  const view = await render(<Recover />);
  await fireEvent.changeText(
    screen.getByLabelText('School email'),
    'sa000001@foonyewsa.edu.my',
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'Send recovery code' }),
  );
  await screen.findByLabelText('Recovery code');
  expect(resetPasswordForEmail).toHaveBeenCalledWith(
    'sa000001@foonyewsa.edu.my',
  );
  await fireEvent.changeText(screen.getByLabelText('Recovery code'), '123 456');
  await fireEvent.press(
    screen.getByRole('button', { name: 'Verify recovery code' }),
  );
  expect(await screen.findByText('Invalid recovery code')).toBeTruthy();
  expect(updateUser).not.toHaveBeenCalled();
  expect(setRecovery).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Verify recovery code' }),
  );
  await waitFor(() => expect(setRecovery).toHaveBeenCalledWith(true));
  expect(verifyOtp).toHaveBeenLastCalledWith({
    email: 'sa000001@foonyewsa.edu.my',
    token: '123456',
    type: 'recovery',
  });
  jest.mocked(useSession).mockReturnValue({ ...sessionState, recovery: true });
  await view.rerender(<Recover />);
  await fireEvent.changeText(
    screen.getByLabelText('New password'),
    'new-long-passphrase1',
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'Save password and sign out' }),
  );
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/sign-in'));
  expect(updateUser).toHaveBeenCalledWith({ password: 'new-long-passphrase1' });
  expect(signOut).toHaveBeenCalledWith({ scope: 'global' });
});

test('failed global sign-out retries without changing the saved password a second time', async () => {
  const updateUser = jest.fn().mockResolvedValue({ error: null });
  const signOut = jest
    .fn()
    .mockResolvedValueOnce({ error: new Error('Network unavailable') })
    .mockResolvedValueOnce({ error: null });
  jest
    .mocked(client)
    .mockReturnValue({ auth: { updateUser, signOut } } as unknown as ReturnType<
      typeof client
    >);
  jest.mocked(useSession).mockReturnValue({
    recovery: true,
    setRecovery: jest.fn(),
    session: null,
    loading: false,
    error: null,
    retry: jest.fn(),
  });
  await render(<Recover />);
  await fireEvent.changeText(screen.getByLabelText('New password'), 'Abcdef12');
  await fireEvent.press(
    screen.getByRole('button', { name: 'Save password and sign out' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Network unavailable',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Retry sign out' }));
  await waitFor(() => expect(signOut).toHaveBeenCalledTimes(2));
  expect(updateUser).toHaveBeenCalledTimes(1);
});
