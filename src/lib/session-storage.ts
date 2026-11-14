/** Chunking avoids platform SecureStore per-value size limits. */
export interface SecretStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}
export function createSessionStorage(store: SecretStore) {
  // Serialize operations: token refresh and sign-out must not interleave writes.
  let queue: Promise<unknown> = Promise.resolve();
  const run = <T>(action: () => Promise<T>): Promise<T> => {
    const task = queue.then(action, action);
    queue = task.catch(() => undefined);
    return task;
  };
  const count = async (key: string) => {
    const value = Number(await store.getItemAsync(`${key}.count`));
    return Number.isInteger(value) && value > 0 && value <= 128 ? value : 0;
  };
  const remove = async (key: string) => {
    const size = await count(key);
    await store.deleteItemAsync(`${key}.count`);
    for (let i = 0; i < size; i++) await store.deleteItemAsync(`${key}.${i}`);
  };
  return {
    getItem: (key: string) =>
      run(async () => {
        const size = await count(key);
        if (!size) return null;
        let result = '';
        for (let i = 0; i < size; i++) {
          const part = await store.getItemAsync(`${key}.${i}`);
          if (part === null) {
            await remove(key);
            return null;
          }
          result += part;
        }
        return result;
      }),
    setItem: (key: string, value: string) =>
      run(async () => {
        // 400 UTF-16 units stay below 2KB even for non-ASCII metadata.
        const size = Math.ceil(value.length / 400);
        if (size > 128)
          throw new Error('Session exceeds secure storage capacity.');
        await remove(key);
        // Write count first so interrupted writes are detectable and removable.
        await store.setItemAsync(`${key}.count`, String(size));
        try {
          for (let i = 0; i < size; i++)
            await store.setItemAsync(
              `${key}.${i}`,
              value.slice(i * 400, (i + 1) * 400),
            );
        } catch (error) {
          await remove(key);
          throw error;
        }
      }),
    removeItem: (key: string) => run(() => remove(key)),
  };
}
