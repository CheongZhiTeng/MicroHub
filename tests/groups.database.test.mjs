import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  homeworkBackend,
  admin,
  alice,
  bob,
  secondAdmin,
} from './homework-backend.mjs';

test('group roster, scoped management, transfer and revocation', async (t) => {
  const { db, as } = await homeworkBackend();
  t.after(() => db.close());
  await db.query(
    "update platform_roles set role='super_admin' where user_id=$1",
    [admin],
  );
  const students = [];
  for (let i = 0; i < 5; i++) {
    const id = randomUUID();
    students.push(id);
    await db.query('insert into auth.users values($1,$2,now())', [
      id,
      'sa10000' + i + '@foonyewsa.edu.my',
    ]);
    await db.query('insert into memberships(user_id) values($1)', [id]);
  }
  const [one, two, three, four, five] = students;
  const ws = async (user) =>
    (await as(user, 'select group_workspace() as w'))[0].w;
  const change = async (
    who,
    action,
    group,
    rev,
    person = null,
    src = null,
    srcRev = null,
    name = null,
    replace = null,
  ) =>
    (
      await as(who, 'select group_change($1,$2,$3,$4,$5,$6,$7,$8,$9) as id', [
        action,
        group,
        rev,
        person,
        src,
        srcRev,
        name,
        replace,
        action === 'appoint_teach' ? 'Group handover' : null,
      ])
    )[0].id;
  const g = await change(
    admin,
    'create',
    null,
    null,
    null,
    null,
    null,
    'Falcons',
  );
  const h = await change(admin, 'create', null, null, null, null, null, 'Owls');
  await assert.rejects(
    change(secondAdmin, 'teacher', g, 1, alice),
    /teach access/,
  );
  await assert.rejects(
    change(admin, 'teacher', g, 1, alice),
    /full teach access/,
  );
  await change(admin, 'appoint_teach', g, 1, alice);
  await assert.rejects(change(admin, 'teacher', h, 1, alice), /another group/);
  await change(admin, 'appoint_teach', h, 1, bob);
  await assert.rejects(change(alice, 'activate', g, 2), /teacher and leader/);
  assert.ok((await ws(alice)).groups.every((group) => group.manage));
  await change(bob, 'assign', g, 2, one);
  await assert.rejects(change(alice, 'assign', g, 2, two), /Roster changed/);
  await change(alice, 'promote', g, 3, one);
  assert.equal((await ws(one)).groups.length, 0);
  await change(alice, 'activate', g, 4);
  await change(bob, 'assign', h, 2, four);
  await change(bob, 'promote', h, 3, four);
  await change(bob, 'activate', h, 4);
  await change(alice, 'assign', g, 5, two);
  await change(alice, 'assign', g, 6, three);
  await assert.rejects(change(one, 'assign', g, 7, five), /teach access/);
  await assert.rejects(
    change(bob, 'assign', h, 5, two, g, 7),
    /current group first/,
  );
  await assert.rejects(
    change(admin, 'assign', h, 5, one, g, 7),
    /current group first/,
  );
  await assert.rejects(change(alice, 'remove', g, 7, one), /last leader/);
  await change(alice, 'promote', g, 7, two);
  await assert.rejects(change(alice, 'promote', g, 8, three), /at most two/);
  await change(alice, 'promote', g, 8, three, null, null, null, one);
  await assert.rejects(
    change(admin, 'assign', h, 5, one, g, 8),
    /current group first/,
  );
  await change(admin, 'remove', g, 9, one);
  await change(admin, 'assign', h, 5, one);
  const studentView = await ws(one);
  assert.deepEqual(
    studentView.groups.map((g) => g.id),
    [h],
  );
  assert.deepEqual(studentView.candidates, []);
  assert.deepEqual(studentView.groups[0].changes, []);
  assert.ok(!(await ws(bob)).candidates.some((p) => p.id === two));
  assert.deepEqual((await ws(five)).groups, []);
  const teacherView = await ws(alice);
  assert.equal(teacherView.groups.length, 2);
  assert.ok(
    teacherView.groups
      .find((x) => x.id === g)
      .changes.some((c) => c.action === 'remove'),
  );
  await assert.rejects(
    as(one, 'select * from group_students'),
    /permission denied/,
  );
  await assert.rejects(
    as(alice, 'delete from club_groups'),
    /permission denied/,
  );
  await db.query("update memberships set status='inactive' where user_id=$1", [
    alice,
  ]);
  assert.deepEqual(await ws(alice), { groups: [], candidates: [] });
  await assert.rejects(change(alice, 'assign', g, 10, five), /teach access/);
  assert.equal(
    (await ws(admin)).groups
      .find((row) => row.id === g)
      .roster.find((p) => p.id === alice).eligible,
    false,
  );
  await change(admin, 'appoint_teach', g, 10, secondAdmin);
  await assert.rejects(change(admin, 'archive', g, 11), /password/);
  const verified =
    'select public.group_delete_verified($1,$2,$3,clock_timestamp())';
  await assert.rejects(
    as(admin, verified, [admin, g, 11]),
    /permission denied/,
  );
  await assert.rejects(db.query(verified, [one, g, 11]), /teach access/);
  await assert.rejects(db.query(verified, [admin, g, 10]), /Roster changed/);
  await assert.rejects(
    db.query(
      "select public.group_delete_verified($1,$2,11,now()-interval '2 minutes')",
      [admin, g],
    ),
    /expired/,
  );
  await db.query(verified, [admin, g, 11]);
  assert.deepEqual((await ws(two)).groups, []);
  assert.equal(
    (await ws(bob)).candidates.find((p) => p.id === two).group_id,
    null,
  );
  await assert.rejects(change(admin, 'assign', g, 12, two), /management/);
});
