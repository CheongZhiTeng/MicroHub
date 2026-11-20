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
test('group homework uses scoped duties, immutable history and a private self-review boundary', async (t) => {
  const { db, as } = await homeworkBackend();
  t.after(() => db.close());
  const outsider = randomUUID(),
    gid = randomUUID(),
    id = randomUUID();
  await db.query(
    "insert into auth.users values($1,'sa200005@foonyewsa.edu.my',now())",
    [outsider],
  );
  await db.query('insert into memberships(user_id) values($1)', [outsider]);
  await db.query(
    "insert into club_groups(id,name,state,teacher_id) values($1,'Group A','active',$2)",
    [gid, secondAdmin],
  );
  await db.query(
    'insert into group_students values ($1,$3,true),($2,$3,false)',
    [alice, bob, gid],
  );
  const call = async (who, expr, args = []) =>
    (await as(who, 'select ' + expr + ' v', args))[0].v;
  const save = (who, targets) =>
    call(
      who,
      "hw_save_scoped($1,0,'Task','Do it',now()+interval '1 day',10,true,true,true,'selected',$2,$3)",
      [id, targets, gid],
    );
  await assert.rejects(save(admin, [bob]), /Administrator/);
  await assert.rejects(save(alice, [outsider]), /group/);
  await save(alice, [alice, bob]);
  await call(alice, 'hw_publish($1,1)', [id]);
  assert.equal(await call(admin, 'hw_detail($1)', [id]), null);
  assert.equal(await call(outsider, 'hw_detail($1)', [id]), null);
  const submit = async (user) => {
    await call(user, "hw_save_draft($1,0,0,'sample','')", [id]);
    return (
      await as(user, 'select * from hw_submit($1,0,1,$2)', [id, randomUUID()])
    )[0].id;
  };
  const mine = await submit(alice),
    v = await submit(bob);
  const review = (who, version, action, rev) =>
    call(who, "hw_review($1,$2,$3,9,'Private',true,null,$4)", [
      version,
      rev,
      action,
      randomUUID(),
    ]);
  await assert.rejects(review(alice, mine, 'save', 0), /Administrator/);
  await review(secondAdmin, mine, 'save', 0);
  assert.equal(
    (await call(alice, 'hw_detail($1)', [id])).versions[0].review,
    null,
  );
  await review(alice, v, 'release', 0);
  await db.query('delete from group_students where user_id=$1', [bob]);
  const past = await call(bob, 'hw_detail($1)', [id]);
  assert.equal(past.versions[0].events[0].score, 9);
  assert.match(past.status.blocked, /left/);
  assert.deepEqual(await call(bob, "hw_list(false,'todo','',0)"), []);
  await assert.rejects(
    call(bob, "hw_save_draft($1,1,0,'again','')", [id]),
    /left/,
  );
  await db.query('update group_students set leader=false where user_id=$1', [
    alice,
  ]);
  await assert.rejects(review(alice, v, 'release', 1), /Administrator/);
  assert.deepEqual(
    await as(alice, 'select * from submission_versions where id=$1', [v]),
    [],
  );
});
test('deadline changes, excusal and lifecycle preserve submission receipts', async (t) => {
  const { db, as } = await homeworkBackend();
  t.after(() => db.close());
  const id = randomUUID();
  const q = async (user, exp, args = []) =>
    (await as(user, 'select ' + exp + ' v', args))[0].v;
  await q(
    admin,
    "hw_save_assignment($1,0,'Test','Work',now()+interval '1 day',10,true,true,false,'selected',$2)",
    [id, [alice, bob]],
  );
  await q(admin, 'hw_publish($1,1)', [id]);
  const settings = (user, act, rev) =>
    q(
      user,
      "hw_maintain($1,$2,$3,'Planning',now()+interval '2 days','Updated',true)",
      [id, rev, act],
    );
  await assert.rejects(settings(alice, 'edit', 2), /Administrator/);
  await settings(admin, 'edit', 2);
  await assert.rejects(settings(admin, 'close', 2), /changed/);
  await q(admin, "hw_exception($1,$2,0,true,null,'Absent')", [id, bob]);
  await assert.rejects(
    q(admin, "hw_exception($1,$2,0,false,null,'Back')", [id, bob]),
    /changed/,
  );
  await q(
    admin,
    "hw_exception($1,$2,0,false,now()+interval '4 days','Extension')",
    [id, alice],
  );
  await q(alice, "hw_save_draft($1,0,0,'Done','')", [id]);
  const receipt = (
    await as(alice, 'select * from hw_submit($1,0,1,$2)', [id, randomUUID()])
  )[0];
  await settings(admin, 'close', 3);
  await settings(admin, 'reopen', 4);
  await settings(admin, 'archive', 5);
  const d = await q(admin, 'hw_detail($1,$2)', [id, alice]);
  assert.equal(d.counts.eligible, 1);
  assert.equal(d.counts.excused, 1);
  assert.equal(d.counts.submitted, 1);
  assert.equal(
    +new Date(d.versions[0].effective_due_at),
    +new Date(receipt.effective_due_at),
  );
  assert.equal(d.assignment.lifecycle, 'archived');
});
test('file-only receipt binds verified files, closes pending uploads and protects peer files', async (t) => {
  const { db, as } = await homeworkBackend();
  t.after(() => db.close());
  const id = randomUUID(),
    f = randomUUID(),
    hash = 'a'.repeat(64);
  const q = async (user, x, args = []) =>
    (await as(user, 'select ' + x + ' v', args))[0].v;
  await q(
    admin,
    "hw_save_assignment($1,0,'Photo','Work',now()+interval '1 day',10,true,true,true,'all','{}')",
    [id],
  );
  await q(admin, "hw_file_settings($1,1,1,200,'photo')", [id]);
  await q(admin, 'hw_publish($1,2)', [id]);
  const reserve = (mime, size) =>
    q(alice, "hw_file_reserve($1,$2,false,'pic.png',$3,$4,$5,0)", [
      id,
      f,
      mime,
      size,
      hash,
    ]);
  await assert.rejects(reserve('text/plain', 20), /limits/);
  await assert.rejects(reserve('image/png', 201), /limits/);
  await reserve('image/png', 32);
  await q(alice, "hw_save_draft($1,0,0,'','')", [id]);
  await assert.rejects(
    q(alice, 'hw_submit($1,0,1,$2)', [id, randomUUID()]),
    /pending/,
  );
  await assert.rejects(
    q(alice, 'hw_file_finish($1,$2)', [f, hash]),
    /permission/,
  );
  await db.query('select hw_file_finish($1,$2)', [f, hash]);
  const v = (
    await as(alice, 'select * from hw_submit($1,0,2,$2)', [id, randomUUID()])
  )[0];
  const own = await q(alice, 'hw_detail($1)', [id]);
  assert.equal(own.files[0].version_id, v.id);
  assert.equal(own.files[0].filename, 'pic.png');
  assert.deepEqual(
    await as(bob, 'select id from assignment_attachments where id=$1', [f]),
    [],
  );
  assert.equal(
    (await q(admin, 'hw_detail($1,$2)', [id, alice])).files.length,
    1,
  );
  await assert.rejects(q(alice, 'hw_file_remove($1)', [f]), /immutable/);
});
test('scheduled publication, scoped discussion, reminders, CSV rows and retried bulk returns', async (t) => {
  const { db, as } = await homeworkBackend();
  t.after(() => db.close());
  const id = randomUUID();
  const q = async (user, x, args = []) =>
    (await as(user, 'select ' + x + ' v', args))[0].v;
  await q(
    admin,
    "hw_save_assignment($1,0,'Quiz','Work',now()+interval '1 hour',10,true,true,true,'selected',$2)",
    [id, [alice]],
  );
  await q(admin, "hw_schedule($1,1,now()+interval '3 minutes')", [id]);
  assert.equal(await q(alice, 'hw_schedule_info($1)', [id]), null);
  await db.query(
    "update homework_schedules set run_at=now()-interval '1 minute' where assignment_id=$1",
    [id],
  );
  await db.query('select homework_private.publish_due()');
  await q(alice, "hw_comment($1,$2,'What time?')", [id, randomUUID()]);
  assert.equal(
    (await as(alice, 'select * from hw_comments($1,0)', [id])).length,
    1,
  );
  assert.deepEqual(await as(bob, 'select * from hw_comments($1,0)', [id]), []);
  await assert.rejects(
    q(bob, "hw_comment($1,$2,'Hi')", [id, randomUUID()]),
    /unavailable/,
  );
  assert.equal((await q(alice, 'hw_inbox(0)')).items[0].kind, 'Due soon');
  await q(alice, 'hw_preferences(false,true,true)');
  assert.equal((await q(alice, 'hw_inbox(0)')).items.length, 0);
  await q(alice, "hw_save_draft($1,0,0,'Done','')", [id]);
  const v = (
    await as(alice, 'select * from hw_submit($1,0,1,$2)', [id, randomUUID()])
  )[0].id;
  await q(admin, "hw_review($1,0,'save',7,'Ready',false,null,$2)", [
    v,
    randomUUID(),
  ]);
  const [row] = await as(admin, 'select * from hw_report($1,0)', [id]);
  assert.equal(row.review_revision, 1);
  assert.equal(row.released_score, null);
  assert.deepEqual(await as(alice, 'select * from hw_report($1,0)', [id]), []);
  const key = randomUUID();
  await assert.rejects(
    q(admin, 'hw_release_saved($1,$2,0,$3)', [id, v, key]),
    /conflict/,
  );
  await q(admin, 'hw_release_saved($1,$2,1,$3)', [id, v, key]);
  await q(admin, 'hw_release_saved($1,$2,1,$3)', [id, v, key]);
  assert.equal((await q(alice, 'hw_inbox(0)')).items.length, 1);
  assert.equal(
    Number(
      (await as(admin, 'select * from hw_report($1,0)', [id]))[0]
        .released_score,
    ),
    7,
  );
  await as(
    admin,
    "insert into homework_grading_tools values($1,$2,'rubric','Logic','Reasoning | 5')",
    [randomUUID(), admin],
  );
  assert.deepEqual(await as(secondAdmin, 'select * from hw_tools()'), []);
});
