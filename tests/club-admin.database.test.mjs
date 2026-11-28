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
  await call(admin, "attendance_open($1,null,'Test',10,3)", [event]);
  const task = randomUUID();
  await call(
    admin,
    "hw_save_assignment($1,0,'Council test','Notes',now()+interval '1 day',10,true,true,true,'all',$2)",
    [task, []],
  );
  await call(admin, 'hw_publish($1,1)', [task]);
  const stale = (await call(admin, "club_admin_panel('members')")).find(
    (p) => p.id === alice,
  ).version;
  for (const office of ['president', 'vice_president']) {
    await change(alice, 'identity', office);
    assert.equal(
      (await call(alice, 'attendance_detail($1)', [event])).personal,
      null,
    );
    const code = await call(alice, "attendance_open($1,$2,'B',10,1)", [
      randomUUID(),
      group,
    ]);
    assert.match(code, /^\d{6}$/);
    assert.equal(await call(alice, 'hw_scope_staff($1)', [group]), true);
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
