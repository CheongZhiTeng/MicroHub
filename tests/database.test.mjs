import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('identity and membership authorization against PostgreSQL', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  // Local harness supplies Supabase-owned schemas/roles. Application SQL is
  // unmodified; this is real PostgreSQL RLS, not a mocked authorization engine.
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth, public to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
    create schema storage; create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);`);
  await db.exec(
    await readFile(
      new URL(
        '../supabase/migrations/202611140001_identity_membership.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        '../supabase/migrations/202611140002_private_storage.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const ids = Array.from(
    { length: 6 },
    (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  );
  const [superAdmin, admin, member, applicant, outsider, unverified] = ids;
  for (const [i, id] of ids.entries())
    await db.query(`insert into auth.users values($1,$2,$3)`, [
      id,
      `sa${String(i + 1).padStart(6, '0')}@foonyewsa.edu.my`,
      i === 5 ? null : '2026-11-14T00:00:00Z',
    ]);
  await t.test(
    'bootstrap requires verified identity and only runs once',
    async () => {
      const bootstrap = await readFile(
        new URL('../supabase/bootstrap-super-admin.sql', import.meta.url),
        'utf8',
      );
      await assert.rejects(
        db.exec(
          bootstrap.replace(
            'REPLACE_WITH_VERIFIED_SCHOOL_EMAIL',
            'sa000006@foonyewsa.edu.my',
          ),
        ),
        /Verified active/,
      );
      await db.exec('rollback');
      await db.exec(
        bootstrap.replace(
          'REPLACE_WITH_VERIFIED_SCHOOL_EMAIL',
          'sa000001@foonyewsa.edu.my',
        ),
      );
      await assert.rejects(
        db.exec(
          bootstrap.replace(
            'REPLACE_WITH_VERIFIED_SCHOOL_EMAIL',
            'sa000002@foonyewsa.edu.my',
          ),
        ),
        /already exists/,
      );
      await db.exec('rollback');
    },
  );
  await db.exec(
    `update public.profiles set display_name='Student', class_name='S1'; insert into public.memberships(user_id) values('${superAdmin}'),('${admin}'),('${member}') on conflict(user_id) do nothing; update public.platform_roles set role='super_admin' where user_id='${superAdmin}'; update public.platform_roles set role='admin' where user_id='${admin}';`,
  );
  const as = async (id, sql, params = []) => {
    await db.exec('begin; set local role authenticated');
    try {
      await db.query(`select set_config('request.jwt.claim.sub',$1,true)`, [
        id,
      ]);
      const result = await db.query(sql, params);
      await db.exec('commit');
      return result.rows;
    } catch (error) {
      await db.exec('rollback');
      throw error;
    }
  };
  await t.test('rejects non-school accounts at trusted boundary', async () => {
    for (const email of [
      'admin@example.com',
      'sa12345@foonyewsa.edu.my',
      'sa123456@foonyewsa.edu.my\n',
    ])
      await assert.rejects(
        db.query(
          `insert into auth.users(id,email) values(gen_random_uuid(),$1)`,
          [email],
        ),
        /school email/,
      );
  });
  await t.test('email and student identity cannot be reassigned', async () => {
    await assert.rejects(
      db.query(
        `update auth.users set email='sa999999@foonyewsa.edu.my' where id=$1`,
        [member],
      ),
      /immutable/,
    );
    await assert.rejects(
      as(member, `update public.profiles set student_id='999999' where id=$1`, [
        member,
      ]),
      /permission denied/,
    );
  });
  await t.test('unverified user cannot read profile or apply', async () => {
    assert.equal(
      (await as(unverified, 'select * from public.profiles')).length,
      0,
    );
    await assert.rejects(
      as(unverified, 'select public.apply_for_membership()'),
      /Verified active/,
    );
  });
  await t.test(
    'nonmember sees only own profile, no club settings or roster',
    async () => {
      assert.deepEqual(
        (await as(outsider, 'select id from public.profiles')).map((r) => r.id),
        [outsider],
      );
      assert.equal(
        (await as(outsider, 'select * from public.club_settings')).length,
        0,
      );
      assert.equal(
        (await as(outsider, 'select * from public.memberships')).length,
        0,
      );
    },
  );
  await t.test(
    'member can read roster but cannot edit another profile or role',
    async () => {
      assert.equal(
        (await as(member, 'select * from public.profiles')).length,
        3,
      );
      assert.equal(
        (
          await as(
            member,
            `update public.profiles set display_name='Changed' where id=$1 returning id`,
            [admin],
          )
        ).length,
        0,
      );
      await assert.rejects(
        as(
          member,
          `update public.platform_roles set role='super_admin' where user_id=$1`,
          [member],
        ),
        /permission denied/,
      );
      await assert.rejects(
        as(
          member,
          `update public.profiles set status='suspended' where id=$1`,
          [admin],
        ),
        /permission denied/,
      );
      await assert.rejects(
        as(member, `insert into public.memberships(user_id) values($1)`, [
          outsider,
        ]),
        /permission denied/,
      );
    },
  );
  let application;
  await t.test(
    'profile update and idempotent application work through RLS',
    async () => {
      assert.equal(
        (
          await as(
            applicant,
            `update public.profiles set display_name='Applicant' where id=$1 returning id`,
            [applicant],
          )
        ).length,
        1,
      );
      application = (
        await as(applicant, 'select public.apply_for_membership() as id')
      )[0].id;
      assert.equal(
        (await as(applicant, 'select public.apply_for_membership() as id'))[0]
          .id,
        application,
      );
      assert.equal(
        (await as(outsider, 'select * from public.membership_applications'))
          .length,
        0,
      );
      await assert.rejects(
        as(member, 'select public.review_membership($1,true)', [application]),
        /Administrator required/,
      );
      await assert.rejects(
        as(applicant, 'select public.review_membership($1,true)', [
          application,
        ]),
        /Administrator required/,
      );
    },
  );
  await t.test(
    'admin approval atomically activates membership and creates audit',
    async () => {
      await as(admin, 'select public.review_membership($1,true)', [
        application,
      ]);
      assert.equal(
        (await as(applicant, 'select public.is_member() as ok'))[0].ok,
        true,
      );
      assert.equal(
        (await as(applicant, 'select * from public.membership_applications'))[0]
          .status,
        'approved',
      );
      assert.equal(
        (
          await as(
            superAdmin,
            "select * from public.audit_logs where action='membership.review'",
          )
        ).length,
        1,
      );
      assert.equal(
        (await as(admin, 'select * from public.audit_logs')).length,
        0,
      );
      await assert.rejects(
        as(admin, 'select public.review_membership($1,true)', [application]),
        /already reviewed/,
      );
    },
  );
  await t.test(
    'last super admin and elevated operations are protected',
    async () => {
      await assert.rejects(
        as(
          admin,
          "select public.admin_set_account($1,'super_admin','active')",
          [admin],
        ),
        /Super Admin required/,
      );
      await assert.rejects(
        as(
          superAdmin,
          "select public.admin_set_account($1,'member','active')",
          [superAdmin],
        ),
        /final Super Admin/,
      );
      await assert.rejects(
        as(
          superAdmin,
          "select public.admin_set_account($1,'super_admin','suspended')",
          [superAdmin],
        ),
        /final Super Admin/,
      );
      await assert.rejects(
        as(member, "select public.update_club('Hacked','')"),
        /Super Admin required/,
      );
      await as(
        superAdmin,
        "select public.update_club('School coding club','Private club')",
      );
      assert.equal(
        (await as(member, 'select name from public.club_settings'))[0].name,
        'School coding club',
      );
    },
  );
  await t.test(
    'suspension immediately revokes club access with the same identity',
    async () => {
      await as(
        superAdmin,
        "select public.admin_set_account($1,'member','suspended')",
        [member],
      );
      assert.equal(
        (await as(member, 'select public.is_member() as ok'))[0].ok,
        false,
      );
      assert.equal(
        (await as(member, 'select * from public.club_settings')).length,
        0,
      );
      assert.equal(
        (await as(member, 'select * from public.profiles')).length,
        1,
      );
      assert.equal(
        (
          await as(
            member,
            "update public.profiles set display_name='No' returning id",
          )
        ).length,
        0,
      );
      await assert.rejects(
        as(member, 'select public.apply_for_membership()'),
        /Verified active/,
      );
    },
  );
  await t.test(
    'rejected applications are rate limited and audit is immutable',
    async () => {
      const id = (
        await as(outsider, 'select public.apply_for_membership() as id')
      )[0].id;
      await as(admin, 'select public.review_membership($1,false)', [id]);
      await assert.rejects(
        as(outsider, 'select public.apply_for_membership()'),
        /24 hours/,
      );
      await assert.rejects(
        as(superAdmin, 'delete from public.audit_logs'),
        /permission denied/,
      );
    },
  );
  await t.test(
    'all app tables have RLS and anonymous execution is denied',
    async () => {
      const tables = await db.query(
        "select relname,relrowsecurity from pg_class join pg_namespace on relnamespace=pg_namespace.oid where nspname='public' and relkind='r'",
      );
      assert.equal(tables.rows.length, 7);
      assert.ok(tables.rows.every((r) => r.relrowsecurity));
      assert.equal(
        (
          await db.query(
            "select has_function_privilege('anon','public.review_membership(uuid,boolean)','EXECUTE') as allowed",
          )
        ).rows[0].allowed,
        false,
      );
      assert.equal(
        (
          await db.query(
            "select has_table_privilege('anon','public.profiles','SELECT') as allowed",
          )
        ).rows[0].allowed,
        false,
      );
      assert.equal(
        (await db.query('select public from storage.buckets')).rows[0].public,
        false,
      );
    },
  );
});
