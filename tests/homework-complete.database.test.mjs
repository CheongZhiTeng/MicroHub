import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
  const todo = (who, scope) =>
    call(who, "class_homework_list(false,'todo','',0,$1)", [scope]);
  assert.deepEqual(
    (await todo(bob, 'mine')).map((row) => row.id),
    [id],
  );
  assert.deepEqual(await todo(bob, 'big'), []);
  assert.deepEqual(await todo(outsider, 'all'), []);
  assert.equal((await call(bob, "class_homework_summary('mine')")).todo, 1);
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
  assert.deepEqual(
    await as(bob, 'select * from assignments where id=$1', [id]),
    [],
  );
  assert.equal(past.assignment.instructions, '');
  assert.equal((await call(bob, "hw_list(false,'submitted','',0)"))[0].id, id);
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
  const snap = () => q(admin, 'hw_report_snapshot($1)', [id]);
  assert.equal((await snap())[0].ready, false);
  await q(admin, 'hw_mark_bulk_ready($1,$2)', [v, 1]);
  assert.equal((await snap())[0].ready, true);
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
  assert.equal((await snap())[0].ready, false);
  await q(admin, "hw_review($1,2,'save',8,'Corrected',false,null,$2)", [
    v,
    randomUUID(),
  ]);
  assert.equal((await snap())[0].ready, false);
  await q(admin, 'hw_mark_bulk_ready($1,$2)', [v, 3]);
  assert.equal((await snap())[0].ready, true);
  await q(admin, 'hw_release_saved($1,$2,3,$3)', [id, v, randomUUID()]);
  const history = (await q(alice, 'hw_detail($1)', [id])).versions[0].events;
  assert.equal(history[1].supersedes, history[0].id);
  await q(admin, 'hw_mark_bulk_ready($1,4)', [v]);
  await q(admin, "hw_review($1,4,'revision',9,'Revise first',false,null,$2)", [
    v,
    randomUUID(),
  ]);
  assert.equal((await snap())[0].ready, false);
  for (const revision of [4, 5]) {
    await assert.rejects(
      q(admin, 'hw_release_saved($1,$2,$3,$4)', [
        id,
        v,
        revision,
        randomUUID(),
      ]),
      /conflict/,
    );
  }
  assert.equal(Number((await snap())[0].released_score), 8);
  await as(
    admin,
    "insert into homework_grading_tools values($1,$2,'rubric','Logic','Reasoning | 5')",
    [randomUUID(), admin],
  );
  assert.deepEqual(await as(secondAdmin, 'select * from hw_tools()'), []);
});
test('team draft collisions, one shared hand-in, individual review and transfer history', async (t) => {
  const { db, as } = await homeworkBackend();
  t.after(() => db.close());
  const group = randomUUID(),
    task = randomUUID(),
    file = randomUUID(),
    hash = 'f'.repeat(64);
  await db.query(
    "insert into club_groups(id,name,state,teacher_id) values($1,'Team','active',$2)",
    [group, secondAdmin],
  );
  await db.query(
    'insert into group_students values($1,$3,true),($2,$3,false)',
    [alice, bob, group],
  );
  const q = async (u, x, args = []) =>
    (await as(u, 'select ' + x + ' v', args))[0].v;
  await q(
    alice,
    "hw_save_scoped($1,0,'Team quiz','Write together',now()+interval '1 day',10,true,true,true,'all','{}',$2)",
    [task, group],
  );
  await q(alice, 'hw_work_mode($1,1,true)', [task]);
  await q(alice, "hw_file_settings($1,2,1,200,'any')", [task]);
  await q(alice, 'hw_publish($1,3)', [task]);
  await q(bob, "hw_save_draft($1,0,0,'Shared','')", [task]);
  assert.equal((await q(alice, 'hw_detail($1)', [task])).draft.body, 'Shared');
  await assert.rejects(
    q(alice, "hw_save_draft($1,0,0,'Overwrite','')", [task]),
    /conflict/,
  );
  await q(
    alice,
    "hw_file_reserve($1,$2,false,'report.txt','text/plain',4,$3,0)",
    [task, file, hash],
  );
  await db.query('select hw_file_finish($1,$2)', [file, hash]);
  const submit = async (u) =>
    (
      await as(u, 'select * from hw_submit($1,0,2,$2)', [task, randomUUID()])
    )[0];
  const b = await submit(bob),
    a = await submit(alice);
  assert.equal(a.team_batch, b.team_batch);
  assert.notEqual(a.id, b.id);
  assert.equal(
    (await q(alice, 'hw_detail($1)', [task])).files[0].version_id,
    a.id,
  );
  assert.equal(
    (await q(bob, 'hw_detail($1)', [task])).files[0].version_id,
    b.id,
  );
  await assert.rejects(
    q(alice, "hw_review($1,0,'release',8,'Team',true,null,$2)", [
      b.id,
      randomUUID(),
    ]),
    /Administrator/,
  );
  await q(
    secondAdmin,
    "hw_review($1,0,'revision',8,'Revise individually',true,null,$2)",
    [b.id, randomUUID()],
  );
  assert.equal(
    (await q(alice, 'hw_detail($1)', [task])).versions[0].events.length,
    0,
  );
  await q(bob, "hw_save_draft($1,1,0,'Personal revision','')", [task]);
  const later = (
    await as(bob, 'select * from hw_submit($1,1,1,$2)', [task, randomUUID()])
  )[0];
  assert.equal(later.version, 2);
  assert.equal(later.team_batch, null);
  await db.query('delete from group_students where user_id=$1', [bob]);
  assert.equal(
    (await q(bob, 'hw_detail($1)', [task])).files[0].version_id,
    b.id,
  );
  assert.equal(await q(bob, 'hw_joint_draft($1)', [task]), null);
});

test('club and group recipient counts exclude staff, retain leaders and preserve earlier receipts', async (t) => {
  const { db, as } = await homeworkBackend();
  t.after(() => db.close());
  const group = randomUUID(),
    club = randomUUID(),
    small = randomUUID();
  const rpc = async (who, sql, args) =>
    (await as(who, 'select ' + sql + ' v', args))[0].v;
  await db.query(
    "update platform_roles set role='super_admin' where user_id=$1",
    [admin],
  );
  await db.query(
    "insert into club_groups(id,name,state,teacher_id) values($1,'Team','active',$2)",
    [group, secondAdmin],
  );
  await db.query('insert into group_students values($1,$2,true)', [
    alice,
    group,
  ]);
  for (const [id, scope, count] of [
    [club, null, 2],
    [small, group, 1],
  ]) {
    await rpc(
      admin,
      "hw_save_scoped($1,0,'Work','',now()+interval '1 day',10,true,true,true,'all','{}',$2)",
      [id, scope],
    );
    assert.equal(await rpc(admin, 'hw_preview_count($1)', [id]), count);
    assert.equal(await rpc(admin, 'hw_publish($1,1)', [id]), count);
    await assert.rejects(rpc(admin, 'hw_add_recipients($1,$2)', [id, [admin]]));
    assert.equal((await rpc(admin, 'hw_detail($1)', [id])).status, null);
    assert.equal((await rpc(secondAdmin, 'hw_detail($1)', [id])).status, null);
    assert.ok((await rpc(alice, 'hw_detail($1)', [id])).status);
  }
  await rpc(bob, "hw_save_draft($1,0,0,'Done','')", [club]);
  await rpc(bob, 'hw_submit($1,0,1,$2)', [club, randomUUID()]);
  await db.query(
    "update platform_roles set role='super_admin' where user_id=$1",
    [bob],
  );
  const old = await rpc(bob, 'hw_detail($1)', [club]);
  assert.equal(old.versions.length, 1);
  assert.equal(old.counts.eligible, 1);
  assert.equal(old.status.excused, true);
});

test('upgrading an existing roster removes teacher obligations while retaining graded receipts', async (t) => {
  const file = '202611210002_student_audience.sql';
  const { db, as } = await homeworkBackend({ beforeMigration: file });
  t.after(() => db.close());
  const task = randomUUID();
  const rpc = async (who, sql, args) =>
    (await as(who, 'select ' + sql + ' v', args))[0].v;
  await db.query(
    "update platform_roles set role='super_admin' where user_id=$1",
    [admin],
  );
  await db.query(
    "insert into club_groups(id,name,state,teacher_id) values($1,'Blue','active',$2)",
    [randomUUID(), secondAdmin],
  );
  await rpc(
    admin,
    "hw_save_assignment($1,0,'Old','',now()-interval '1 day',10,true,false,true,'all','{}')",
    [task],
  );
  assert.equal(await rpc(admin, 'hw_publish($1,1)', [task]), 4);
  await rpc(secondAdmin, "hw_save_draft($1,0,0,'Historical response','')", [
    task,
  ]);
  const v = await rpc(secondAdmin, 'to_jsonb(hw_submit($1,0,1,$2))', [
    task,
    randomUUID(),
  ]);
  await rpc(admin, "hw_review($1,0,'release',8,'Old feedback',true,null,$2)", [
    v.id,
    randomUUID(),
  ]);
  await db.exec(
    await readFile(
      new URL('../supabase/migrations/' + file, import.meta.url),
      'utf8',
    ),
  );
  const detail = await rpc(admin, 'hw_detail($1)', [task]);
  assert.equal(detail.status, null);
  assert.equal(detail.counts.eligible, 2);
  assert.equal(detail.counts.missing, 2);
  const saved = await rpc(secondAdmin, 'hw_detail($1)', [task]);
  assert.equal(saved.versions[0].id, v.id);
  assert.equal(Number(saved.versions[0].events[0].score), 8);
  assert.equal((await rpc(admin, "hw_list(false,'todo','',0)", [])).length, 0);
  assert.equal(
    (await rpc(admin, 'hw_inbox(0)', [])).items.some(
      (row) => row.mode === 'mine',
    ),
    false,
  );
});
