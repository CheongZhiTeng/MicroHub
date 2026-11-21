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
    "update public.platform_roles set role='super_admin' where user_id in ($1,$2,$3)",
    [admin, alice, secondAdmin],
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
  assert.deepEqual(await titles(alice), [
    'Club meeting',
    'Falcon practice',
    'Owl practice',
  ]);
  assert.deepEqual(await titles(admin), [
    'Club meeting',
    'Falcon practice',
    'Owl practice',
  ]);
  assert.deepEqual((await feed(alice)).groups, [
    { id: group, name: 'Falcons' },
    { id: other, name: 'Owls' },
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

test('class calendar and class feeds enforce live membership, revisions and Malaysia date boundaries', async (t) => {
  const { db, as } = await homeworkBackend();
  t.after(() => db.close());
  const own = randomUUID(),
    other = randomUUID(),
    allId = randomUUID(),
    ownId = randomUUID(),
    otherId = randomUUID();
  await db.query(
    "update platform_roles set role='super_admin' where user_id=$1",
    [admin],
  );
  await db.query(
    "insert into club_groups (id,name,state,teacher_id) values ($1,'North','active',$3),($2,'South','active',$4)",
    [own, other, admin, secondAdmin],
  );
  await db.query('insert into group_students values ($1,$2,true)', [
    alice,
    own,
  ]);
  const save = (actor, id, group, rev, title, cancel = false) =>
    as(actor, 'select class_event_save($1,$2,$3,$4,$5,$6,$7,$8,$9)', [
      id,
      group,
      rev,
      title,
      'Hall',
      '',
      '2030-02-01T15:00Z',
      '2030-02-01T17:00Z',
      cancel,
    ]);
  const list = async (
    actor,
    scope,
    preview = false,
    from = null,
    until = null,
  ) =>
    (
      await as(actor, 'select class_events_feed($1,$2,$3,0,$4) items', [
        scope,
        from,
        until,
        preview,
      ])
    )[0].items
      .map((e) => e.title)
      .sort();
  await save(admin, allId, null, 0, 'Club');
  await save(admin, allId, null, 0, 'Club');
  await save(admin, ownId, own, 0, 'North');
  await save(admin, otherId, other, 0, 'South');
  await assert.rejects(
    save(alice, randomUUID(), own, 0, 'Leader edit'),
    /teach access/,
  );
  assert.deepEqual(await list(alice, 'all'), ['Club', 'North']);
  assert.deepEqual(await list(alice, 'big'), ['Club']);
  assert.deepEqual(await list(alice, 'mine'), ['North']);
  assert.deepEqual(await list(alice, other), []);
  assert.deepEqual(await list(admin, other), ['South']);
  assert.deepEqual(await list(bob, 'all'), ['Club']);
  assert.deepEqual(
    await list(alice, 'mine', false, '2030-02-01T16:00Z', '2030-02-02T16:00Z'),
    ['North'],
  );
  await save(admin, ownId, own, 1, 'Updated');
  await assert.rejects(save(admin, ownId, own, 1, 'Stale'), /Event changed/);
  await save(admin, ownId, own, 2, 'Updated', true);
  assert.deepEqual(await list(alice, 'mine', true), []);
  assert.deepEqual(await list(alice, 'mine'), ['Updated']);
  for (const [group, title] of [
    [null, 'Big'],
    [own, 'Mine'],
    [other, 'Other'],
  ])
    await as(admin, 'select announcement_publish($1,$2,$3,$4)', [
      randomUUID(),
      group,
      title,
      'Meeting',
    ]);
  const posts = async (scope) =>
    (
      await as(alice, 'select class_announcements(0,false,$1) feed', [scope])
    )[0].feed.items.map((p) => p.title);
  assert.deepEqual(await posts('big'), ['Big']);
  assert.deepEqual(await posts('mine'), ['Mine']);
  assert.deepEqual(await posts(other), []);
  assert.deepEqual(
    (
      await as(
        alice,
        "select class_homework_list(false,'todo','',0,'mine') items",
      )
    )[0].items,
    [],
  );
  assert.equal(
    (await as(alice, "select class_homework_summary('mine') s"))[0].s.todo,
    0,
  );
  await db.query('delete from group_students where user_id=$1', [alice]);
  assert.deepEqual(await list(alice, 'mine'), []);
  assert.deepEqual(await posts('mine'), []);
  await db.query("update profiles set status='suspended' where id=$1", [bob]);
  assert.deepEqual(await list(bob, 'all'), []);
});
