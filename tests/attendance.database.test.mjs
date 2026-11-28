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

test('attendance scope, cutoff, receipts, throttling, audit and immutable roster', async (t) => {
  const { db, as } = await homeworkBackend();
  t.after(() => db.close());
  const val = async (user, sql, args = []) =>
    (await as(user, 'select ' + sql + ' as value', args))[0].value;
  const root = admin,
    other = secondAdmin;
  await assert.rejects(
    val(root, "attendance_open($1,null,'X',10,4)", [randomUUID()]),
    /Teach/,
  );
  await db.query(
    "update platform_roles set role='super_admin' where user_id=any($1)",
    [[root, other]],
  );
  const gid = randomUUID();
  await db.query(
    "insert into club_groups(id,name,state,teacher_id) values($1,'Group A','active',$2)",
    [gid, root],
  );
  await db.query(
    'insert into group_students(user_id,group_id,leader) values($1,$2,true)',
    [alice, gid],
  );
  const id = randomUUID();
  const open = "attendance_open($1,$2,'Meeting',10,$3)";
  await assert.rejects(val(other, open, [id, gid, 1]), /Teach/);
  await assert.rejects(val(root, open, [id, gid, 2]), /Audience/);
  let code = await val(root, open, [id, gid, 1]);
  assert.match(code, /^\d{6}$/);
  assert.equal(await val(root, open, [id, gid, 1]), null);
  const detail = (u) => val(u, 'attendance_detail($1)', [id]);
  const check = (u, c) => val(u, 'attendance_check($1,$2)', [id, c]);
  const control = (action) =>
    val(root, 'attendance_control($1,$2)', [id, action]);
  const live = await detail(alice);
  assert.equal(live.personal, 'Waiting');
  assert.deepEqual(live.roster, [
    { en: 'Alice', zh: 'Alice', status: 'Waiting' },
  ]);
  await assert.rejects(detail(other), /unavailable/);
  await assert.rejects(detail(bob), /unavailable/);
  await assert.rejects(
    as(alice, 'select * from attendance_private.sessions'),
    /permission/,
  );
  const old = code;
  const panel = (u) => val(u, 'attendance_panel($1)', [id]);
  assert.equal((await panel(root)).generation, 0);
  assert.equal((await panel(alice)).generation, undefined);
  code = await val(root, 'attendance_rotate($1,0)', [id]);
  await assert.rejects(val(root, 'attendance_rotate($1,0)', [id]), /changed/);
  assert.equal((await panel(root)).generation, 1);
  assert.notEqual(old, code);
  for (let i = 0; i < 5; i++)
    assert.equal((await check(alice, old)).error, 'Invalid check-in code.');
  assert.match((await check(alice, code)).error, /Too many/);
  await db.query(
    "update attendance_private.throttle set start_at=now()-interval '6 min'",
  );
  const receipt = await check(alice, code);
  assert.equal(receipt.status, 'Present');
  assert.ok(receipt.checked_at);
  assert.deepEqual(await check(alice, code), receipt);
  await control('close');
  assert.equal((await detail(alice)).roster, null);
  assert.deepEqual(await check(alice, code), receipt);
  await assert.rejects(
    val(alice, "attendance_correct($1,$2,1,'Late','Arrival')", [id, alice]),
    /Teach/,
  );
  await val(root, "attendance_correct($1,$2,1,'Late','Arrival')", [id, alice]);
  await assert.rejects(
    val(root, "attendance_correct($1,$2,1,'Present','Change')", [id, alice]),
    /changed/,
  );
  assert.equal((await detail(alice)).personal, 'Late');
  assert.equal((await panel(alice)).corrections, undefined);
  assert.equal((await panel(root)).corrections[0].reason, 'Arrival');
  assert.deepEqual(await val(alice, 'attendance_summary()'), {
    attended: 1,
    late: 1,
    total: 1,
  });
  const eventId = randomUUID(),
    linkedId = randomUUID();
  await db.query(
    "insert into public.class_events(id,group_id,title,location,description,starts_at,ends_at) values($1,$2,'Workshop','','',now(),now()+interval '1 hour')",
    [eventId, gid],
  );
  const event = (u) => val(u, 'attendance_event($1)', [eventId]);
  const startEvent = (u, sid, revision) =>
    val(u, 'attendance_open_event($1,$2,$3,10,1)', [eventId, sid, revision]);
  assert.deepEqual(await event(alice), {});
  await assert.rejects(event(bob), /unavailable/);
  await assert.rejects(startEvent(other, linkedId, 1), /unavailable/);
  await assert.rejects(startEvent(alice, linkedId, 1), /unavailable/);
  assert.deepEqual((await event(root)).setup, {
    title: 'Workshop',
    class_name: 'Group A',
    revision: 1,
    students: 1,
  });
  await assert.rejects(startEvent(root, linkedId, 0), /Event changed/);
  await db.query('update public.class_events set cancelled=true where id=$1', [
    eventId,
  ]);
  await assert.rejects(startEvent(root, linkedId, 1), /Event changed/);
  await db.query('update public.class_events set cancelled=false where id=$1', [
    eventId,
  ]);
  const linked = await startEvent(root, linkedId, 1);
  assert.match(linked.code, /^\d{6}$/);
  assert.equal(linked.session_id, linkedId);
  assert.deepEqual(await startEvent(root, randomUUID(), 1), {
    session_id: linkedId,
  });
  assert.deepEqual(await event(alice), { session_id: linkedId });
  await assert.rejects(event(bob), /unavailable/);
  const big = randomUUID();
  await val(root, open, [big, null, 2]);
  assert.equal(
    (await val(bob, 'attendance_detail($1)', [big])).roster.length,
    2,
  );
  await db.query(
    'update attendance_private.sessions set expires=clock_timestamp() where id=$1',
    [big],
  );
  assert.equal(
    (await val(alice, 'attendance_detail($1)', [big])).personal,
    'Absent',
  );
  assert.match(
    (await val(bob, 'attendance_check($1,$2)', [big, '123456'])).error,
    /ended/,
  );
  assert.equal(
    (
      await db.query(
        "select reason from attendance_private.audit where action='correct'",
      )
    ).rows[0].reason,
    'Arrival',
  );
  assert.equal(
    (
      await db.query(
        'select count(*)::int n from attendance_private.records where student=$1',
        [root],
      )
    ).rows[0].n,
    0,
  );
});
