import { expect, jest, test } from '@jest/globals';
import { renderToString } from 'react-dom/server';
import SignIn from '../app/sign-in';
import Register from '../app/register';
import Recover from '../app/recover';
import { Screen } from '../src/components/ui';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  Redirect: () => null,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }) => <div>{children}</div>,
}));
jest.mock('../src/lib/supabase', () => ({
  configured: true,
  client: jest.fn(),
}));
jest.mock('../src/features/session', () => ({
  useSession: () => ({
    session: null,
    recovery: false,
    setRecovery: jest.fn(),
  }),
}));

test.each([
  ['sign-in', <SignIn key="sign-in" />],
  ['registration', <Register key="register" />],
  ['recovery', <Recover key="recover" />],
  ['empty optional subtitle', <Screen key="screen" title="Test" subtitle="" />],
])('%s renders on web without bare text inside a View', (_, element) => {
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    expect(renderToString(element)).toBeTruthy();
    const textErrors = errors.mock.calls.filter((args) =>
      String(args[0]).includes('Unexpected text node'),
    );
    expect(textErrors).toEqual([]);
  } finally {
    errors.mockRestore();
  }
});
