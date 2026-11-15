import { act, renderHook } from '@testing-library/react-native';
import { useBusy } from '../src/features/busy';
test('duplicate taps in the same render can start only one operation', async () => {
  const { result } = await renderHook(useBusy);
  await act(() => {
    expect(result.current.start()).toBe(true);
    expect(result.current.start()).toBe(false);
  });
  expect(result.current.busy).toBe(true);
  await act(() => result.current.finish());
  await act(() => expect(result.current.start()).toBe(true));
});
