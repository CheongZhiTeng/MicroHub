import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Access } from '../src/features/access';
import { useIdentity, type Identity } from '../src/features/identity';
import { useSession } from '../src/features/session';
jest.mock('expo-router', () => ({ Redirect: () => null }));
jest.mock('../src/features/identity', () => ({ useIdentity: jest.fn() }));
jest.mock('../src/features/session', () => ({ useSession: jest.fn() }));
test.each([
  ['member', true, 'active', false],
  ['admin', false, 'active', false],
  ['admin', true, 'suspended', false],
  ['admin', true, 'active', true],
  ['super_admin', true, 'active', true],
] as const)(
  'admin screen checks %s membership=%s status=%s',
  async (role, member, status, allowed) => {
    jest.mocked(useSession).mockReturnValue({
      session: { user: { id: 'test' } },
      loading: false,
      recovery: false,
    } as ReturnType<typeof useSession>);
    jest.mocked(useIdentity).mockReturnValue({
      identity: { role, member, profile: { id: 'test', status } } as Identity,
      loading: false,
      error: null,
      reload: jest.fn(),
    });
    await render(
      <Access admin>{() => <Text>Private admin content</Text>}</Access>,
    );
    expect(Boolean(screen.queryByText('Private admin content'))).toBe(allowed);
  },
);
