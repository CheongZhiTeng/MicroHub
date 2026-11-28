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
test('club offices, handover, invitations and management boundaries', async (t) => {
  const { db, as } = await homeworkBackend();
  t.after(() => db.close());
  const call = async (user, sql, params = []) =>
    (await as(user, 'select ' + sql + ' as v', params))[0].v;
  await db.query(
    "update platform_roles set role='super_admin' where user_id=$1",
    [admin],
  );
  const change = async (target, action, value) => {
    const people = await call(admin, "club_admin_panel('members')");
    return call(admin, 'club_member_change($1,$2,$3,$4,$5)', [
      target,
      people.find((p) => p.id === target).version,
      action,
      value,
      'Committee decision',
    ]);
  };
  await assert.rejects(
    call(alice, "club_admin_panel('members')"),
    /administrator/,
  );
  await assert.rejects(change(admin, 'remove', null), /final/);
  const group = randomUUID(),
    event = randomUUID();
  await db.query(
    "insert into club_groups(id,name,state,teacher_id) values($1,'B','active',$2)",
    [group, admin],
  );
  await db.query('insert into group_students values($1,$2,false)', [
    bob,
    group,
  ]);
  const filtered = await call(admin, "club_admin_panel('members','','',$1)", [
    group,
  ]);
  assert.deepEqual(new Set(filtered.map((p) => p.id)), new Set([admin, bob]));
  assert.equal((await call(admin, "club_admin_panel('groups')"))[0].id, group);
  await call(admin, "attendance_open($1,null,'Test',10,3)", [event]);
  const task = randomUUID();
  await call(
    admin,
    "hw_save_assignment($1,0,'Council test','Notes',now()+interval '1 day',10,true,true,true,'all',$2)",
    [task, []],
  );
  await call(admin, 'hw_publish($1,1)', [task]);
  const historical = randomUUID(),
    checkedSession = randomUUID();
  await call(
    admin,
    "hw_save_assignment($1,0,'Archived work','Notes',now()+interval '1 day',10,true,true,true,'all',$2)",
    [historical, []],
  );
  await call(admin, 'hw_publish($1,1)', [historical]);
  await call(alice, "hw_save_draft($1,0,0,'My answer','')", [historical]);
  const [submitted] = await as(alice, 'select * from hw_submit($1,0,1,$2)', [
    historical,
    randomUUID(),
  ]);
  await call(admin, "hw_review($1,0,'release',9,'Good work',true,null,$2)", [
    submitted.id,
    randomUUID(),
  ]);
  const checkedCode = await call(
    admin,
    "attendance_open($1,null,'Past session',10,3)",
    [checkedSession],
  );
  const receipt = await call(alice, 'attendance_check($1,$2)', [
    checkedSession,
    checkedCode,
  ]);
  await call(admin, "attendance_control($1,'close')", [checkedSession]);
  const stale = (await call(admin, "club_admin_panel('members')")).find(
    (p) => p.id === alice,
  ).version;
  for (const office of ['president', 'vice_president']) {
    await change(alice, 'identity', office);
    assert.equal(
      (await call(alice, 'attendance_detail($1)', [event])).personal,
      null,
    );
    assert.equal(
      (await call(alice, 'attendance_detail($1)', [checkedSession])).checked_at,
      receipt.checked_at,
    );
    assert.equal(
      (await call(alice, 'hw_detail($1,$2)', [historical, alice])).versions[0]
        .events[0].score,
      9,
    );
    const code = await call(alice, "attendance_open($1,$2,'B',10,1)", [
      randomUUID(),
      group,
    ]);
    assert.match(code, /^\d{6}$/);
    assert.equal(await call(alice, 'hw_scope_staff($1)', [group]), true);
    const groupEvent = randomUUID(),
      groupTask = randomUUID(),
      file = randomUUID();
    await call(
      alice,
      "class_event_save($1,$2,0,'Session','Hall','',now()+interval '1 day',now()+interval '2 days',false)",
      [groupEvent, group],
    );
    assert.equal(
      (await call(alice, 'attendance_event($1)', [groupEvent])).setup.students,
      1,
    );
    await call(
      alice,
      "hw_save_scoped($1,0,'Practice','Notes',now()+interval '1 day',10,true,true,true,'all','{}',$2)",
      [groupTask, group],
    );
    await call(alice, "hw_file_settings($1,1,1,200,'any')", [groupTask]);
    await call(alice, 'hw_publish($1,2)', [groupTask]);
    await call(bob, "hw_save_draft($1,0,0,'My work','')", [groupTask]);
    const hash = 'b'.repeat(64);
    await call(
      bob,
      "hw_file_reserve($1,$2,false,'work.txt','text/plain',4,$3,0)",
      [groupTask, file, hash],
    );
    await db.query('select hw_file_finish($1,$2)', [file, hash]);
    const [version] = await as(bob, 'select * from hw_submit($1,0,2,$2)', [
      groupTask,
      randomUUID(),
    ]);
    assert.equal(
      (
        await as(alice, 'select id from assignment_attachments where id=$1', [
          file,
        ])
      )[0].id,
      file,
    );
    await call(
      alice,
      "hw_review($1,0,'release',8,'Private feedback',true,null,$2)",
      [version.id, randomUUID()],
    );
    assert.equal(
      (await call(bob, 'hw_detail($1)', [groupTask])).versions[0].events[0]
        .score,
      8,
    );
    const announcement = randomUUID();
    assert.equal(
      await call(alice, "announcement_publish($1,$2,'Notice','Club news')", [
        announcement,
        group,
      ]),
      announcement,
    );
    assert.equal(
      (
        await db.query(
          'select staff_excluded from assignment_recipients where assignment_id=$1 and member_id=$2',
          [task, alice],
        )
      ).rows[0].staff_excluded,
      true,
    );
    await assert.rejects(
      call(
        admin,
        "club_member_change($1,$2,'identity','member','Stale edit')",
        [alice, stale],
      ),
      /changed/,
    );
  }
  await assert.rejects(change(admin, 'suspend', null), /Hand over/);
  await change(alice, 'identity', 'member');
  await assert.rejects(call(alice, 'club_invite_issue()'), /administrator/);
  assert.equal(
    await call(admin, 'hw_add_recipients($1,$2)', [task, [alice]]),
    1,
  );
  await assert.rejects(
    call(alice, "admin_set_account($1,'super_admin','active')", [alice]),
    /permission/,
  );
  const code = await call(admin, 'club_invite_issue()');
  await db.query('delete from memberships where user_id=$1', [secondAdmin]);
  await db.query(
    "update profiles set name_en='Reviewer',name_zh='审核员' where id=$1",
    [secondAdmin],
  );
  const revoked = await call(admin, 'club_invite_issue()');
  const revokedId = (
    await db.query(
      "select id from club_private.invites where digest=extensions.digest($1::text,'sha256')",
      [revoked],
    )
  ).rows[0].id;
  await call(admin, 'club_invite_revoke($1)', [revokedId]);
  await assert.rejects(
    call(secondAdmin, 'club_invite_redeem($1)', [revoked]),
    /unavailable/,
  );
  const expired = await call(admin, 'club_invite_issue()');
  await db.query(
    "update club_private.invites set expires=now() where digest=extensions.digest($1::text,'sha256')",
    [expired],
  );
  await assert.rejects(
    call(secondAdmin, 'club_invite_redeem($1)', [expired]),
    /unavailable/,
  );
  await call(secondAdmin, 'club_invite_redeem($1)', [code]);
  await call(secondAdmin, 'club_invite_redeem($1)', [code]);
  await db.query("update profiles set name_en='Bob',name_zh='乙' where id=$1", [
    bob,
  ]);
  await assert.rejects(
    call(bob, 'club_invite_redeem($1)', [code]),
    /unavailable/,
  );
  await change(bob, 'remove', null);
  assert.equal(
    (await db.query('select * from group_students where user_id=$1', [bob]))
      .rows.length,
    0,
  );
  await change(bob, 'restore', null);
  assert.ok((await call(admin, "club_admin_panel('audit')")).length);
});
