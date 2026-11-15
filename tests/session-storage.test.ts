import { createSessionStorage } from '../src/lib/session-storage';
function fixture() {
  const values = new Map<string, string>();
  const store = {
    getItemAsync: async (key: string) => values.get(key) ?? null,
    setItemAsync: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    deleteItemAsync: async (key: string) => {
      values.delete(key);
    },
  };
  return { values, store, storage: createSessionStorage(store) };
}
test('large Unicode session survives persistence and cleanup', async () => {
  const { storage, values } = fixture();
  const session = '学生🔒'.repeat(1000);
  await storage.setItem('auth', session);
  expect(await storage.getItem('auth')).toBe(session);
  await storage.removeItem('auth');
  expect(values.size).toBe(0);
});
test('sign-out queued during token refresh removes the new token', async () => {
  const { storage } = fixture();
  await Promise.all([
    storage.setItem('auth', 'first'),
    storage.setItem('auth', 'refreshed'),
    storage.removeItem('auth'),
  ]);
  expect(await storage.getItem('auth')).toBeNull();
});
test('interrupted write is rejected and removed', async () => {
  const { storage, values, store } = fixture();
  store.setItemAsync.mockImplementation(async (key, value) => {
    if (key.endsWith('.1')) throw new Error('disk full');
    values.set(key, value);
  });
  await expect(storage.setItem('auth', 'x'.repeat(800))).rejects.toThrow(
    'disk full',
  );
  expect(await storage.getItem('auth')).toBeNull();
  expect(values.size).toBe(0);
});
test('missing chunk never returns a partial session', async () => {
  const { storage, values } = fixture();
  await storage.setItem('auth', 'x'.repeat(800));
  values.delete('auth.0');
  expect(await storage.getItem('auth')).toBeNull();
  expect(values.size).toBe(0);
});

test('Unicode characters spanning a chunk boundary are not split', async () => {
  const { storage, store } = fixture();
  const value = 'x'.repeat(399) + '🔒';
  await storage.setItem('auth', value);
  for (const [, chunk] of store.setItemAsync.mock.calls)
    expect(() => encodeURIComponent(chunk)).not.toThrow();
  expect(await storage.getItem('auth')).toBe(value);
});
test('failed deletion preserves metadata so a retry removes remaining secrets', async () => {
  const { storage, store, values } = fixture();
  await storage.setItem('auth', 'x'.repeat(800));
  const original = store.deleteItemAsync;
  const fail = jest
    .spyOn(store, 'deleteItemAsync')
    .mockRejectedValueOnce(new Error('locked'))
    .mockImplementation(original);
  await expect(storage.removeItem('auth')).rejects.toThrow('locked');
  await storage.removeItem('auth');
  expect(values.size).toBe(0);
  fail.mockRestore();
});
