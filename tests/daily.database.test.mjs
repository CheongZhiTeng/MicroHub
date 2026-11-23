import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { homeworkBackend, admin, alice, bob } from './homework-backend.mjs';

test('checked audiences, private weekly deadlines and authorized latest-version queues', async (t) => {
  const { db, as } = await homeworkBackend();
  t.after(() => db.close());
  const id = randomUUID();
  const scalar = async (user, sql, args = []) =>
    (await as(user, 'select ' + sql + ' as value', args))[0].value;
  await scalar(
    admin,
    "hw_save_assignment($1,0,'Practice','Read this',now()+interval '2 days',10,true,true,true,'selected',$2)",
    [id, [alice]],
  );
  await assert.rejects(
    scalar(admin, 'daily_publish($1,1,9)', [id]),
    /Audience changed/,
  );
  assert.equal(
    (await db.query('select lifecycle from assignments where id=$1', [id]))
      .rows[0].lifecycle,
    'draft',
  );
  await scalar(admin, 'daily_publish($1,1,1)', [id]);
  const due = "select id from daily_due('all',now(),now()+interval '7 days')";
  assert.deepEqual(await as(alice, due), [{ id }]);
  assert.deepEqual(await as(bob, due), []);
  await db.query(
    "update assignment_recipients set extension_at=now()+interval '2 weeks' where assignment_id=$1",
    [id],
  );
  assert.deepEqual(await as(alice, due), []);
  await scalar(alice, "hw_save_draft($1,0,0,'answer','')", [id]);
  await scalar(alice, 'hw_submit($1,0,1,$2)', [id, randomUUID()]);
  const queue = 'select member_id,version_id from daily_queue($1)';
  assert.deepEqual(await as(alice, queue, [id]), []);
  const [row] = await as(admin, queue, [id]);
  assert.equal(row.member_id, alice);
  const [item] = await scalar(admin, "daily_list(true,'all','all','',0)");
  assert.equal(item.pending, 1);
  await scalar(admin, "hw_review($1,0,'release',8,'Good',true,null,$2)", [
    row.version_id,
    randomUUID(),
  ]);
  assert.deepEqual(await as(admin, queue, [id]), []);
  await db.query(
    "update platform_roles set role='super_admin' where user_id=$1",
    [admin],
  );
  assert.equal(await scalar(admin, 'class_reach(null)'), 4);
  await assert.rejects(scalar(bob, 'class_reach(null)'), /teach/);
  await assert.rejects(
    scalar(admin, "daily_announcement($1,null,'News','Read',1)", [
      randomUUID(),
    ]),
    /Audience changed/,
  );
  await assert.rejects(
    scalar(
      admin,
      "daily_event($1,null,0,'Practice','Hall','',now(),now()+interval '1 hour',false,1)",
      [randomUUID()],
    ),
    /Audience changed/,
  );
});
