import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';

export const [admin, alice, bob, secondAdmin] = [1, 2, 3, 4].map(
  (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0'),
);

// Test-only Supabase-owned roles and JWT subject. Every homework query uses the
// shipped migrations and authenticated role, including in the browser rehearsal.
export async function homeworkBackend() {
  const db = new PGlite();
  await db.exec(`create role anon; create role service_role; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated,anon;
    create schema storage; create table storage.objects(bucket_id text,name text); create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
  const directory = new URL('../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(directory))
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await db.exec(await readFile(new URL(file, directory), 'utf8'));
  for (const [index, id] of [admin, alice, bob, secondAdmin].entries()) {
    await db.query('insert into auth.users values($1,$2,now())', [
      id,
      'sa00000' + (index + 1) + '@foonyewsa.edu.my',
    ]);
    await db.query('insert into public.memberships(user_id) values($1)', [id]);
    await db.query(
      "update public.profiles set display_name=$2,class_name='S2' where id=$1",
      [id, ['Teacher', 'Alice', 'Bob', 'Reviewer'][index]],
    );
  }
  await db.query(
    "update public.platform_roles set role='admin' where user_id in ($1,$2)",
    [admin, secondAdmin],
  );
  const as = (id, sql, params = []) =>
    db.transaction(async (tx) => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        id,
      ]);
      return (await tx.query(sql, params)).rows;
    });
  return { db, as };
}
