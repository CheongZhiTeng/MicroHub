import { expect, jest, test } from '@jest/globals';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { client } from '../src/lib/supabase';
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

// Exercise real DOM input/click handlers, not only static rendering.

test('Web Create account click reports invalid password, then accepts the corrected eight-character password', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const signUp = jest.fn().mockResolvedValue({ error: null });
  client.mockReturnValue({ auth: { signUp } });
  const input = async (label, value) => {
    const node = host.querySelector(`[aria-label="${label}"]`);
    await act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      ).set.call(node, value);
      node.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  const click = async (title) => {
    const button = [...host.querySelectorAll('[role="button"]')].find(
      (node) => node.textContent === title,
    );
    expect(button).toBeTruthy();
    await act(async () => button.click());
  };
  try {
    await act(() => root.render(<Register />));
    await input('School email', 'sa000001@foonyewsa.edu.my');
    await input('Password (8–128 characters)', 'Abc1234');
    await click('Create account');
    expect(host.querySelector('[role="alert"]').textContent).toContain(
      'Use 8–128 characters',
    );
    expect(signUp).not.toHaveBeenCalled();
    await input('Password (8–128 characters)', 'Abcdef12');
    await click('Create account');
    expect(signUp).toHaveBeenCalledWith({
      email: 'sa000001@foonyewsa.edu.my',
      password: 'Abcdef12',
    });
    expect(host.querySelector('[aria-label="Verification code"]')).toBeTruthy();
  } finally {
    await act(() => root.unmount());
    host.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  }
});
