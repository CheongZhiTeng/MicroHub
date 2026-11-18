import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import Register from '../app/register';
import { client } from '../src/lib/supabase';
import { router } from 'expo-router';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));
jest.mock('../src/lib/supabase', () => ({ client: jest.fn() }));
const signUp = jest.fn();
const verifyOtp = jest.fn();
beforeEach(() => {
  jest
    .mocked(client)
    .mockReturnValue({ auth: { signUp, verifyOtp } } as unknown as ReturnType<
      typeof client
    >);
});

test('invalid school email never reaches Auth', async () => {
  await render(<Register />);
  await fireEvent.changeText(
    screen.getByLabelText('School email'),
    'student@example.com',
  );
  await fireEvent.changeText(
    screen.getByLabelText('Password (8–128 characters)'),
    'long-passphrase1',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  expect(
    await screen.findByText(
      'Enter your official saXXXXXX@foonyewsa.edu.my address.',
    ),
  ).toBeTruthy();
  expect(signUp).not.toHaveBeenCalled();
});

test('registration requires verification before navigating to the club', async () => {
  signUp.mockResolvedValue({ data: { session: null }, error: null });
  verifyOtp
    .mockResolvedValueOnce({ error: new Error('Token has expired') })
    .mockResolvedValueOnce({ error: null });
  await render(<Register />);
  await fireEvent.changeText(
    screen.getByLabelText('School email'),
    'sa000001@foonyewsa.edu.my',
  );
  await fireEvent.changeText(
    screen.getByLabelText('Password (8–128 characters)'),
    'long-passphrase1',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  await screen.findByLabelText('Verification code');
  expect(signUp).toHaveBeenCalledWith({
    email: 'sa000001@foonyewsa.edu.my',
    password: 'long-passphrase1',
  });
  expect(router.replace).not.toHaveBeenCalled();
  await fireEvent.changeText(
    screen.getByLabelText('Verification code'),
    '123456',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Verify email' }));
  expect(await screen.findByText('Token has expired')).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Verify email' }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  expect(verifyOtp).toHaveBeenLastCalledWith({
    email: 'sa000001@foonyewsa.edu.my',
    token: '123456',
    type: 'signup',
  });
});

test.each(['abc1234', 'abcdefgh', '12345678'])(
  'invalid password %s produces an alert and sends no signup',
  async (password) => {
    await render(<Register />);
    await fireEvent.changeText(
      screen.getByLabelText('School email'),
      'sa000001@foonyewsa.edu.my',
    );
    await fireEvent.changeText(
      screen.getByLabelText('Password (8–128 characters)'),
      password,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Create account' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Use 8–128 characters/,
    );
    expect(signUp).not.toHaveBeenCalled();
  },
);

test('exactly eight characters with a letter and digit reach Auth; SMTP failure is an alert', async () => {
  signUp.mockResolvedValue({
    error: { message: 'Error sending confirmation email' },
  });
  await render(<Register />);
  await fireEvent.changeText(
    screen.getByLabelText('School email'),
    ' SA000001@FOONYEWSA.EDU.MY ',
  );
  await fireEvent.changeText(
    screen.getByLabelText('Password (8–128 characters)'),
    'Abcdef12',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
  expect(
    screen.getByLabelText('Password (8–128 characters)').props.secureTextEntry,
  ).toBe(false);
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  expect(signUp).toHaveBeenCalledWith({
    email: 'sa000001@foonyewsa.edu.my',
    password: 'Abcdef12',
  });
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Error sending confirmation email',
  );
  expect(screen.queryByLabelText('Verification code')).toBeNull();
});

test('existing verification code can be resumed without registering again', async () => {
  verifyOtp.mockResolvedValue({ error: null });
  await render(<Register />);
  await fireEvent.changeText(
    screen.getByLabelText('School email'),
    'sa000001@foonyewsa.edu.my',
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'I already have a verification code' }),
  );
  await fireEvent.changeText(
    screen.getByLabelText('Verification code'),
    '123456',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Verify email' }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  expect(signUp).not.toHaveBeenCalled();
});

test('keyboard submit and pasted spaced OTP retain the verified signup flow', async () => {
  signUp.mockResolvedValue({ error: null });
  verifyOtp.mockResolvedValue({ error: null });
  await render(<Register />);
  await fireEvent.changeText(
    screen.getByLabelText('School email'),
    'sa000001@foonyewsa.edu.my',
  );
  await fireEvent.changeText(
    screen.getByLabelText('Password (8–128 characters)'),
    'Example123',
  );
  await fireEvent(
    screen.getByLabelText('Password (8–128 characters)'),
    'submitEditing',
  );
  const otp = await screen.findByLabelText('Verification code');
  await fireEvent.changeText(otp, '123 456');
  await fireEvent(otp, 'submitEditing');
  await waitFor(() =>
    expect(verifyOtp).toHaveBeenCalledWith({
      email: 'sa000001@foonyewsa.edu.my',
      token: '123456',
      type: 'signup',
    }),
  );
  expect(router.replace).toHaveBeenCalledWith('/');
});
