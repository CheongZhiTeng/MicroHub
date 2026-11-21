import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization,apikey,content-type,x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, message: string) =>
  Response.json({ message }, { status, headers });
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return reply(405, 'POST required');
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_ANON_KEY')!;
  const opts = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  };
  const token = req.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return reply(401, 'Sign in again');
  const caller = createClient(url, key, {
    ...opts,
    global: { headers: { Authorization: 'Bearer ' + token } },
  });
  const {
    data: { user },
  } = await caller.auth.getUser(token);
  if (!user?.email || !(await caller.rpc('is_super_admin')).data)
    return reply(403, 'Active teach access required');
  const args = await req.json().catch(() => null);
  if (
    !args ||
    typeof args.password !== 'string' ||
    args.password.length > 1024 ||
    !args.password ||
    typeof args.group !== 'string' ||
    !Number.isSafeInteger(args.revision)
  )
    return reply(400, 'Invalid confirmation');
  const verifier = createClient(url, key, opts);
  const verified = await verifier.auth.signInWithPassword({
    email: user.email,
    password: args.password,
  });
  if (verified.error || verified.data.user?.id !== user.id)
    return reply(403, 'Password confirmation failed');
  try {
    const worker = createClient(
      url,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      opts,
    );
    const { error } = await worker.rpc('group_delete_verified', {
      p_actor: user.id,
      p_group: args.group,
      p_revision: args.revision,
      p_verified_at: new Date().toISOString(),
    });
    return error
      ? reply(409, 'Group changed. Refresh and try again.')
      : reply(200, 'Group deleted');
  } finally {
    await verifier.auth.signOut({ scope: 'local' });
  }
});
