import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import Home from '../app/(tabs)/index';
import More from '../app/(tabs)/more';
import { useIdentity, type Identity } from '../src/features/identity';
import { useSession } from '../src/features/session';
import { PlannedModule } from '../src/components/planned-module';
import { client } from '../src/lib/supabase';
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  Redirect: () => null,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}));
jest.mock('../src/features/identity');
jest.mock('../src/features/session');
jest.mock('../src/lib/supabase', () => ({ client: jest.fn() }));
const member: Identity = {
  profile: {
    id: 'user',
    student_id: '000001',
    display_name: 'Alex Tan',
    class_name: 'S2',
    status: 'active',
  },
  role: 'member',
  member: true,
  clubName: 'School Club',
  application: 'approved',
};
function identity(value: Identity) {
  jest.mocked(useIdentity).mockReturnValue({
    identity: value,
    loading: false,
    error: null,
    reload: jest.fn(),
  });
}
beforeEach(() => {
  identity(member);
  jest.mocked(useSession).mockReturnValue({
    session: { user: { id: 'user' } } as never,
    loading: false,
    error: null,
    recovery: false,
    setRecovery: jest.fn(),
    retry: jest.fn(),
  });
});
test('home shows actual member identity and routes assignment card without fabricated statistics', async () => {
  await render(<Home />);
  expect(screen.getByText('Welcome back, Alex!')).toBeTruthy();
  expect(screen.getByText('S2')).toBeTruthy();
  expect(screen.queryByText('56')).toBeNull();
  expect(
    screen.queryByRole('button', { name: 'Review membership applications' }),
  ).toBeNull();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Assignment workspace' }),
  );
  expect(router.push).toHaveBeenCalledWith('/(tabs)/homework');
});
test('pending applicant retains status action and cannot see member dashboard', async () => {
  identity({ ...member, member: false, application: 'pending' });
  await render(<Home />);
  expect(
    screen.getByRole('button', { name: 'Check application status' }),
  ).toBeTruthy();
  expect(
    screen.queryByRole('button', { name: 'Apply for membership' }),
  ).toBeNull();
  expect(
    screen.queryByRole('button', { name: 'Assignment workspace' }),
  ).toBeNull();
});
test('suspended account retains suspension message and no club cards', async () => {
  identity({ ...member, profile: { ...member.profile, status: 'suspended' } });
  await render(<Home />);
  expect(screen.getByRole('alert')).toHaveTextContent(/suspended/);
  expect(
    screen.queryByRole('button', { name: 'Assignment workspace' }),
  ).toBeNull();
});
test('application action still invokes the existing RPC', async () => {
  identity({ ...member, member: false, application: null });
  const rpc = jest.fn().mockResolvedValue({ error: null });
  jest
    .mocked(client)
    .mockReturnValue({ rpc } as unknown as ReturnType<typeof client>);
  await render(<Home />);
  await fireEvent.press(
    screen.getByRole('button', { name: 'Apply for membership' }),
  );
  expect(rpc).toHaveBeenCalledWith('apply_for_membership');
});
test('More shows admin navigation only to an active administrator', async () => {
  const view = await render(<More />);
  expect(screen.queryByRole('button', { name: 'Administration' })).toBeNull();
  identity({ ...member, role: 'admin' });
  await view.rerender(<More />);
  await fireEvent.press(screen.getByRole('button', { name: 'Administration' }));
  expect(router.push).toHaveBeenCalledWith('/administration');
});
test('planned resource screen is gated and clearly states availability', async () => {
  const view = await render(<PlannedModule name="resources" />);
  expect(screen.getByText('Coming in V2')).toBeTruthy();
  identity({ ...member, member: false });
  await view.rerender(<PlannedModule name="resources" />);
  expect(
    screen.getByText('An approved club membership is required.'),
  ).toBeTruthy();
  expect(screen.queryByText('Coming in V2')).toBeNull();
});
