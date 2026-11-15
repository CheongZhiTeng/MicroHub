type Reviewer = {
  authenticate(): Promise<boolean>;
  review(
    applicationId: string,
    approve: boolean,
  ): Promise<{ code: string } | null>;
};
export function createHandler(createReviewer: (token: string) => Reviewer) {
  return async (request: Request): Promise<Response> => {
    const respond = (status: number, error?: string) =>
      Response.json(error ? { error } : { ok: true }, {
        status,
        headers: { 'Cache-Control': 'no-store' },
      });
    if (request.method !== 'POST') return respond(405, 'POST required');
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ') || !authorization.slice(7).trim())
      return respond(401, 'Authentication required');
    try {
      const reviewer = createReviewer(authorization.slice(7));
      if (!(await reviewer.authenticate()))
        return respond(401, 'Invalid session');
      // Enforce the limit while streaming, before allocating an arbitrary-size body.
      const reader = request.body?.getReader();
      if (!reader) return respond(400, 'Invalid request');
      let bytes = 0;
      let body = '';
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > 1024) {
            await reader.cancel();
            return respond(413, 'Request too large');
          }
          body += decoder.decode(value, { stream: true });
        }
        body += decoder.decode();
      } finally {
        reader.releaseLock();
      }
      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        return respond(400, 'Invalid request');
      }
      if (
        !payload ||
        typeof payload.approve !== 'boolean' ||
        typeof payload.applicationId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          payload.applicationId,
        )
      )
        return respond(400, 'Invalid review request');
      const error = await reviewer.review(
        payload.applicationId,
        payload.approve,
      );
      if (error)
        return respond(
          error.code === '42501' ? 403 : 409,
          'Review not permitted or application already processed',
        );
      return respond(200);
    } catch {
      return respond(
        503,
        'Review service unavailable. Refresh the application status before retrying.',
      );
    }
  };
}
