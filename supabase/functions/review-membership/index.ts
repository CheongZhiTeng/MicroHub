import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

Deno.serve(async (request: Request) => {
  const respond = (status: number, body: Record<string, unknown>) =>
    Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (request.method !== 'POST')
    return respond(405, { error: 'POST required' });
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer '))
    return respond(401, { error: 'Authentication required' });
  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    },
  );
  const { data, error: authError } = await client.auth.getUser(
    authorization.slice(7),
  );
  if (authError || !data.user)
    return respond(401, { error: 'Invalid session' });
  try {
    const body = await request.text();
    if (body.length > 1024) return respond(413, { error: 'Request too large' });
    const payload = JSON.parse(body);
    if (
      typeof payload.approve !== 'boolean' ||
      typeof payload.applicationId !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(payload.applicationId)
    )
      return respond(400, { error: 'Invalid review request' });
    const { error } = await client.rpc('review_membership', {
      p_application_id: payload.applicationId,
      p_approve: payload.approve,
    });
    if (error)
      return respond(error.code === '42501' ? 403 : 409, {
        error: 'Review not permitted or application already processed',
      });
    return respond(200, { ok: true });
  } catch {
    return respond(400, { error: 'Invalid request' });
  }
});
