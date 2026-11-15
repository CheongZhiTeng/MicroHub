export const REQUEST_TIMEOUT_MS = 20000;
/** Cancel network I/O, including response-body reads, so auth cannot hang indefinitely. */
export function createTimedFetch(
  fetcher: typeof fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const upstream =
      init?.signal ??
      (typeof Request !== 'undefined' && input instanceof Request
        ? input.signal
        : undefined);
    const abort = () => controller.abort();
    if (upstream?.aborted) abort();
    else upstream?.addEventListener('abort', abort, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(
          new Error(
            'The request timed out. Check your connection and try again. A submitted change may have succeeded; refresh its status first.',
          ),
        );
      }, timeoutMs);
    });
    try {
      return await Promise.race([
        (async () => {
          const response = await fetcher(input, {
            ...init,
            signal: controller.signal,
          });
          // Supabase consumes JSON responses; buffer their body within the same deadline.
          const body = await response.text();
          return new Response(body || null, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        })(),
        expired,
      ]);
    } finally {
      clearTimeout(timer);
      upstream?.removeEventListener('abort', abort);
    }
  };
}
