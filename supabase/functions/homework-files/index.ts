import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { detectFile } from './type.ts';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization,apikey,content-type,x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: cors });
const limit = 10485760;
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method unavailable' }, 405);
  const url = Deno.env.get('SUPABASE_URL')!,
    serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authorization = req.headers.get('Authorization') ?? '';
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  const bucket = admin.storage.from('club-private');
  const mode = new URL(req.url).searchParams.get('mode');
  async function sweep() {
    const { data, error } = await admin.rpc('hw_cleanup_files');
    if (error) throw error;
    if (data?.length) {
      const removed = await bucket.remove(
        data.map(
          (r: { file_id: string; file_digest: string }) =>
            'homework/' + r.file_id + '/' + r.file_digest,
        ),
      );
      if (removed.error) throw removed.error;
      const ack = await admin.rpc('hw_cleanup_files', {
        p_done: data.map((r: { file_id: string }) => r.file_id),
      });
      if (ack.error) throw ack.error;
    }
  }
  try {
    if (mode === 'cleanup') {
      if (authorization !== 'Bearer ' + serviceKey)
        return json({ error: 'Access denied' }, 403);
      await sweep();
      return json({ ok: true });
    }
    const auth = await caller.auth.getUser();
    if (auth.error || !auth.data.user)
      return json({ error: 'Sign in again' }, 401);
    if (mode === 'download') {
      const { id } = await req.json();
      const { data: f, error } = await caller
        .from('assignment_attachments')
        .select('id,digest,filename,state')
        .eq('id', id)
        .eq('state', 'ready')
        .maybeSingle();
      if (!f || error) return json({ error: 'File unavailable' }, 404);
      const signed = await bucket.createSignedUrl(
        'homework/' + f.id + '/' + f.digest,
        60,
        { download: f.filename },
      );
      if (signed.error) throw signed.error;
      return json({ url: signed.data.signedUrl });
    }
    if (mode !== 'upload') return json({ error: 'Unknown operation' }, 400);
    // Bound the request before parsing the multipart payload, including streamed uploads.
    const reader = req.body?.getReader();
    if (!reader) return json({ error: 'Choose a file' }, 400);
    let total = 0;
    const parts: Uint8Array<ArrayBuffer>[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit + 65536) {
        await reader.cancel();
        return json({ error: 'File too large' }, 413);
      }
      parts.push(new Uint8Array(value));
    }
    const form = await new Response(new Blob(parts), {
      headers: { 'Content-Type': req.headers.get('Content-Type') ?? '' },
    }).formData();
    const file = form.get('file');
    if (!(file instanceof File) || !file.size || file.size > limit)
      return json({ error: 'Invalid file size' }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = detectFile(bytes, file.name);
    if (!mime)
      return json({ error: 'Choose a valid PDF, TXT, PNG or JPEG file.' }, 400);
    const digest = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
      (x) => x.toString(16).padStart(2, '0'),
    ).join('');
    const id = String(form.get('id'));
    const reserved = await caller.rpc('hw_file_reserve', {
      p_id: form.get('assignment'),
      p_file: id,
      p_reference: form.get('reference') === 'true',
      p_name: file.name.replace(/[\\/\r\n]/g, '_'),
      p_mime: mime,
      p_size: file.size,
      p_digest: digest,
      p_base: Number(form.get('base')),
    });
    if (reserved.error) return json({ error: reserved.error.message }, 400);
    if (reserved.data !== 'ready') {
      const upload = await bucket.upload(
        'homework/' + id + '/' + digest,
        bytes,
        { contentType: mime, upsert: false },
      );
      if (
        upload.error &&
        String(upload.error.statusCode) !== '409' &&
        !/already exists/i.test(upload.error.message)
      )
        throw upload.error;
      const finished = await admin.rpc('hw_file_finish', {
        p_file: id,
        p_digest: digest,
      });
      if (finished.error) throw finished.error;
    }
    await sweep().catch(() => console.error('Attachment cleanup deferred'));
    return json({ id });
  } catch {
    return json(
      { error: 'The file operation could not finish. Retry or refresh.' },
      400,
    );
  }
});
