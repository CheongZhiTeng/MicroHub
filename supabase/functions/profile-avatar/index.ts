import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import jpeg from 'npm:jpeg-js@0.4.4';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization,apikey,content-type,x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, data: object) =>
  Response.json(data, { status, headers });
const maxBytes = 512 * 1024;
async function photo(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) throw new Error();
  const parts: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel();
      throw new Error();
    }
    parts.push(value);
  }
  const source = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    source.set(part, offset);
    offset += part.length;
  }
  const { data, width, height } = jpeg.decode(source, {
    useTArray: true,
    maxResolutionInMP: 0.1,
    maxMemoryUsageInMB: 16,
  });
  if (width !== 256 || height !== 256) throw new Error();
  return jpeg.encode({ data, width, height }, 85).data;
}
const path = (owner: string, id: string) =>
  'avatars/' + owner + '/' + id + '.jpg';
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return reply(405, { message: 'POST required' });
  const url = Deno.env.get('SUPABASE_URL')!;
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  };
  const bearer = req.headers.get('Authorization') ?? '';
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    ...options,
    global: { headers: { Authorization: bearer } },
  });
  const {
    data: { user },
  } = await caller.auth.getUser(bearer.replace(/^Bearer /i, ''));
  if (!user || !(await caller.rpc('is_active_user')).data)
    return reply(403, { message: 'Active account required' });
  const params = new URL(req.url).searchParams,
    previous = params.get('previous') || null,
    requestedMode = params.get('mode'),
    club = requestedMode === 'logo-upload' || requestedMode === 'logo-remove',
    mode = club ? requestedMode!.slice(5) : requestedMode;
  if (club && !(await caller.rpc('is_super_admin')).data)
    return reply(403, { message: 'Full administrator required.' });
  if (
    !['upload', 'remove', 'read'].includes(mode ?? '') ||
    (previous && !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(previous))
  )
    return reply(400, { message: 'Invalid photo request' });
  const worker = createClient(
    url,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    options,
  );
  const bucket = worker.storage.from('club-private');
  if (mode === 'read') {
    const object = params.get('path') ?? '';
    const allowed = await caller.rpc('avatar_can_read', { p_path: object });
    if (!allowed.data) return reply(403, { message: 'Photo unavailable.' });
    const { data, error } = await bucket.createSignedUrl(object, 120);
    if (error) return reply(404, { message: 'Photo unavailable.' });
    // Return a relative storage path, including on hosted Edge workers with internal URLs.
    return reply(200, {
      path: new URL(data.signedUrl).pathname + new URL(data.signedUrl).search,
    });
  }
  let next: string | null = null;
  if (mode === 'upload') {
    let bytes: Uint8Array;
    try {
      bytes = await photo(req);
    } catch {
      return reply(400, { message: 'Invalid profile photo.' });
    }
    next = crypto.randomUUID();
    const staged = await worker
      .from('profile_avatar_files')
      .insert({ id: next, owner_id: user.id });
    if (staged.error)
      return reply(500, { message: 'Photo could not be saved.' });
    const stored = await bucket.upload(path(user.id, next), bytes, {
      contentType: 'image/jpeg',
      upsert: false,
    });
    if (stored.error)
      return reply(503, { message: 'Photo could not be saved.' });
  }
  const result = await worker.rpc(club ? 'club_logo_commit' : 'avatar_commit', {
    p_actor: user.id,
    p_previous: previous,
    p_next: next,
  });
  // Expired reservations can no longer commit. Retry deletions on later photo changes.
  const expired = await worker
    .from('profile_avatar_files')
    .select('id,owner_id')
    .lte('clean_after', 'now')
    .order('clean_after')
    .limit(30);
  if (expired.data?.length) {
    const removed = await bucket.remove(
      expired.data.map((row) => path(row.owner_id, row.id)),
    );
    if (!removed.error)
      await worker
        .from('profile_avatar_files')
        .delete()
        .in(
          'id',
          expired.data.map((row) => row.id),
        );
  }
  if (result.error)
    return reply(result.error.code === '40001' ? 409 : 400, {
      message:
        result.error.code === '40001'
          ? 'Photo changed. Open your profile again.'
          : 'Photo could not be saved.',
    });
  return reply(200, { avatar_id: next });
});
