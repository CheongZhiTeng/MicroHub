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

test('announcement feed follows membership and group placement, with staff-only publication', async (t) => {
  const { db, as } = await homeworkBackend();
  t.after(() => db.close());
  const group = randomUUID();
  const other = randomUUID();
  await db.query(
    "update public.platform_roles set role='super_admin' where user_id=$1",
    [admin],
  );
  await db.query(
    "insert into public.club_groups(id,name,state,teacher_id) values ($1,'Falcons','active',$3),($2,'Owls','active',$4)",
    [group, other, alice, secondAdmin],
  );
  await db.query('insert into public.group_students values ($1,$2,true)', [
    bob,
    group,
  ]);
  const publish = async (actor, scope, title, id = randomUUID()) => {
    const [row] = await as(
      actor,
      'select public.announcement_publish($1,$2,$3,$4) as id',
      [id, scope, title, 'Meeting details'],
    );
    assert.equal(row.id, id);
    return id;
  };
  const feed = async (actor, preview = false) =>
    (
      await as(actor, 'select public.announcement_feed(0,$1) as feed', [
        preview,
      ])
    )[0].feed;
  const titles = async (actor) =>
    (await feed(actor)).items.map(({ title }) => title).sort();

  const shared = await publish(alice, null, 'Club meeting');
  await publish(alice, null, 'Club meeting', shared);
  const {
    rows: [audit],
  } = await db.query(
    'select count(*)::int as count from public.audit_logs where target_id=$1',
    [shared],
  );
  assert.equal(audit.count, 1);
  await assert.rejects(
    publish(alice, null, 'Changed title', shared),
    /already used/,
  );
  await assert.rejects(publish(alice, null, ' '), /check constraint/);
  await publish(alice, group, 'Falcon practice');
  await publish(secondAdmin, other, 'Owl practice');
  await assert.rejects(publish(alice, other, 'Wrong group'), /cannot publish/);
  await assert.rejects(publish(bob, group, 'Leader post'), /cannot publish/);
  await assert.rejects(publish(bob, null, 'Student post'), /cannot publish/);
  await assert.rejects(
    as(bob, 'select * from public.club_announcements'),
    /permission denied/,
  );
  await assert.rejects(
    db.exec(
      'begin; set local role anon; select public.announcement_feed(); commit;',
    ),
    /permission denied/,
  );
  await db.exec('rollback');
  assert.deepEqual(await titles(bob), ['Club meeting', 'Falcon practice']);
  assert.deepEqual(await titles(alice), ['Club meeting', 'Falcon practice']);
  assert.deepEqual(await titles(admin), [
    'Club meeting',
    'Falcon practice',
    'Owl practice',
  ]);
  assert.deepEqual((await feed(alice)).groups, [
    { id: group, name: 'Falcons' },
  ]);
  assert.equal((await feed(alice)).can_publish_club, true);
  assert.equal((await feed(bob)).can_publish_club, false);
  assert.deepEqual((await feed(bob)).groups, []);
  const preview = await feed(bob, true);
  assert.deepEqual(preview.items.map((item) => item.group_name).sort(), [
    'Falcons',
    null,
  ]);
  assert.ok(preview.items.every((item) => item.body === null));
  await db.query(
    'update public.group_students set group_id=$1 where user_id=$2',
    [other, bob],
  );
  assert.deepEqual(await titles(bob), ['Club meeting', 'Owl practice']);
  await db.query("update public.profiles set status='suspended' where id=$1", [
    bob,
  ]);
  await assert.rejects(feed(bob), /Active club membership/);
});
