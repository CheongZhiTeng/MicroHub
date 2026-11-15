import { createHandler } from './handler.ts';
const id = '00000000-0000-4000-8000-000000000001';
const request = (body: string, token = 'Bearer test') =>
  new Request('https://example.invalid', {
    method: 'POST',
    headers: { Authorization: token },
    body,
  });
const assert = (value: unknown) => {
  if (!value) throw new Error('Assertion failed');
};
Deno.test(
  'unauthenticated and wrong-method requests never create a reviewer',
  async () => {
    const handler = createHandler(() => {
      throw new Error('Must not run');
    });
    assert(
      (await handler(new Request('https://example.invalid'))).status === 405,
    );
    assert((await handler(request('{}', ''))).status === 401);
  },
);
Deno.test('invalid tokens do not invoke review', async () => {
  const handler = createHandler(() => ({
    authenticate: async () => false,
    review: () => {
      throw new Error('Must not run');
    },
  }));
  assert((await handler(request('{}'))).status === 401);
});
Deno.test(
  'invalid bodies and oversized streaming payloads are rejected before review',
  async () => {
    const handler = createHandler(() => ({
      authenticate: async () => true,
      review: () => {
        throw new Error('Must not run');
      },
    }));
    for (const body of [
      'null',
      '{}',
      '{',
      JSON.stringify({ applicationId: '-'.repeat(36), approve: true }),
    ])
      assert((await handler(request(body))).status === 400);
    assert((await handler(request('x'.repeat(1025)))).status === 413);
  },
);
Deno.test('review preserves caller token and decision', async () => {
  const handler = createHandler((token) => ({
    authenticate: async () => token === 'test',
    review: async (application, approve) => {
      assert(application === id && approve === false);
      return null;
    },
  }));
  const response = await handler(
    request(JSON.stringify({ applicationId: id, approve: false })),
  );
  assert(
    response.status === 200 &&
      response.headers.get('Cache-Control') === 'no-store',
  );
});
Deno.test(
  'authorization and stale decisions are returned as 403 and 409',
  async () => {
    for (const [code, status] of [
      ['42501', 403],
      ['23514', 409],
    ] as const) {
      const handler = createHandler(() => ({
        authenticate: async () => true,
        review: async () => ({ code }),
      }));
      assert(
        (
          await handler(
            request(JSON.stringify({ applicationId: id, approve: true })),
          )
        ).status === status,
      );
    }
  },
);
Deno.test(
  'Auth network failures return a controlled retryable error',
  async () => {
    const handler = createHandler(() => ({
      authenticate: async () => {
        throw new Error('private upstream detail');
      },
      review: async () => null,
    }));
    const response = await handler(request('{}'));
    assert(
      response.status === 503 &&
        !(await response.text()).includes('private upstream'),
    );
  },
);
