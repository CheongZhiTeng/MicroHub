import { createTimedFetch } from '../src/lib/network';
afterEach(() => jest.useRealTimers());
test('preserves status and JSON on a completed request', async () => {
  const fetcher = jest.fn().mockResolvedValue(
    new Response('{"message":"denied"}', {
      status: 403,
      headers: { 'content-type': 'application/json' },
    }),
  );
  const response = await createTimedFetch(fetcher)('https://example.invalid');
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ message: 'denied' });
});
test('times out stalled network and aborts underlying I/O', async () => {
  jest.useFakeTimers();
  const fetcher = jest.fn().mockReturnValue(new Promise(() => {}));
  const pending = createTimedFetch(fetcher, 100)('https://example.invalid');
  const check = expect(pending).rejects.toThrow(/timed out/);
  await jest.advanceTimersByTimeAsync(100);
  await check;
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
});
test('deadline also covers a stalled response body', async () => {
  jest.useFakeTimers();
  const fetcher = jest
    .fn()
    .mockResolvedValue({ text: () => new Promise(() => {}) });
  const pending = createTimedFetch(fetcher, 100)('https://example.invalid');
  const check = expect(pending).rejects.toThrow(/timed out/);
  await jest.advanceTimersByTimeAsync(100);
  await check;
});
