import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';
import { MotionProvider, useReducedMotion } from '../src/components/motion';
function Preference() {
  return <Text>{useReducedMotion() ? 'Static' : 'Animated'}</Text>;
}
afterEach(() => jest.restoreAllMocks());
test('uses the system preference, updates live and removes the listener', async () => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
  let update: (value: boolean) => void = () => {};
  const remove = jest.fn();
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockImplementation((name, handler) => {
      if (name === 'reduceMotionChanged')
        update = handler as (value: boolean) => void;
      return { remove };
    });
  const view = await render(
    <MotionProvider>
      <Preference />
    </MotionProvider>,
  );
  expect(await screen.findByText('Animated')).toBeTruthy();
  await act(() => update(true));
  expect(screen.getByText('Static')).toBeTruthy();
  await view.unmount();
  expect(remove).toHaveBeenCalled();
});
test('a stale preference read cannot override a newer reduce-motion event', async () => {
  let resolve: (value: boolean) => void = () => {};
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(
    new Promise<boolean>((done) => {
      resolve = done;
    }),
  );
  let update: (value: boolean) => void = () => {};
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockImplementation((name, handler) => {
      if (name === 'reduceMotionChanged')
        update = handler as (value: boolean) => void;
      return { remove: jest.fn() };
    });
  await render(
    <MotionProvider>
      <Preference />
    </MotionProvider>,
  );
  expect(screen.getByText('Static')).toBeTruthy();
  await act(() => update(true));
  await act(async () => resolve(false));
  expect(screen.getByText('Static')).toBeTruthy();
});
