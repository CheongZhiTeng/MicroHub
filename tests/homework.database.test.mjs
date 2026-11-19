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
test('homework lifecycle, privacy and concurrency contracts', async (t) => {
  const { db, as } = await homeworkBackend();
  t.after(() => db.close());
  const id = randomUUID();
  const scalar = async (user, expr, args = []) =>
    (await as(user, 'select ' + expr + ' as value', args))[0].value;
  const save = (user, audience = 'selected', targets = [alice]) =>
    scalar(
      user,
      `hw_save_assignment($1,0,'Loops','Explain your loop.',now()+interval '1 day',10,true,true,true,$2,$3)`,
      [id, audience, targets],
    );
  const detail = (user, who = user) =>
    scalar(user, 'hw_detail($1,$2)', [id, who]);
  const draft = (base, rev, body, link = '') =>
    scalar(alice, 'hw_save_draft($1,$2,$3,$4,$5)', [id, base, rev, body, link]);
  const submit = async (base, rev, key) =>
    (
      await as(alice, 'select * from hw_submit($1,$2,$3,$4)', [
        id,
        base,
        rev,
        key,
      ])
    )[0];
  let version;
  const review = (
    user,
    rev,
    action,
    score,
    feedback,
    include,
    due = null,
    key = randomUUID(),
  ) =>
    scalar(user, 'hw_review($1,$2,$3,$4,$5,$6,$7,$8)', [
      version,
      rev,
      action,
      score,
      feedback,
      include,
      due,
      key,
    ]);
  await t.test(
    'staff-only unpublished drafts and atomic selected snapshot',
    async () => {
      await assert.rejects(save(alice), /Administrator/);
      assert.equal(await save(admin), 1);
      assert.equal(await detail(alice), null);
      assert.deepEqual(await scalar(alice, "hw_list(true,'all','',0)"), []);
      assert.equal(await scalar(admin, 'hw_publish($1,1)', [id]), 1);
      assert.equal(await scalar(admin, 'hw_publish($1,1)', [id]), 1);
      assert.equal((await detail(alice)).assignment.title, 'Loops');
      assert.equal(await detail(bob), null);
      assert.deepEqual(await scalar(bob, "hw_list(false,'all','Loops',0)"), []);
      assert.deepEqual(
        await as(alice, "select * from hw_roster($1,'all','',0)", [id]),
        [],
      );
    },
  );
  await t.test(
    'private synced drafts, competing devices and immutable receipt replay',
    async () => {
      assert.equal(await draft(0, 0, 'private'), 1);
      assert.equal((await detail(alice)).draft.body, 'private');
      assert.equal((await detail(admin, alice)).draft, null);
      await assert.rejects(draft(0, 0, 'stale'), /Draft conflict/);
      const idempotency = randomUUID();
      const receipt = await submit(0, 1, idempotency);
      version = receipt.id;
      assert.equal(receipt.late, false);
      assert.equal((await submit(0, 1, idempotency)).id, version);
      await assert.rejects(submit(0, 1, randomUUID()), /already changed/);
      assert.deepEqual(
        await as(bob, 'select * from submission_versions where id=$1', [
          version,
        ]),
        [],
      );
      await assert.rejects(
        as(alice, "update submission_versions set body='new'"),
        /permission denied/,
      );
      assert.equal((await detail(alice)).versions.length, 1);
      assert.equal((await scalar(admin, 'hw_summary()')).pending, 1);
    },
  );
  await t.test(
    'grade drafts private, competing grader conflicts, explicit zero and separate revision return',
    async () => {
      await assert.rejects(
        review(alice, 0, 'release', 0, 'x', true),
        /Administrator/,
      );
      await assert.rejects(review(admin, 0, 'save', 11, 'x', false), /range/);
      await review(admin, 0, 'save', 0, 'private grading draft', false);
      assert.equal((await detail(alice)).versions[0].review, null);
      assert.deepEqual((await detail(alice)).versions[0].events, []);
      await assert.rejects(
        review(secondAdmin, 0, 'save', 4, 'stale', false),
        /conflict/,
      );
      const key = randomUUID();
      await review(admin, 1, 'release', 0, 'Explain the loop', true, null, key);
      await review(admin, 1, 'release', 0, 'Explain the loop', true, null, key);
      let { events } = (await detail(alice)).versions[0];
      assert.equal(events.length, 1);
      assert.equal(Number(events[0].score), 0);
      await review(admin, 2, 'release', 2, 'Corrected partial credit', true);
      await review(
        admin,
        3,
        'revision',
        7,
        'Add an example',
        false,
        new Date(Date.now() + 86400000).toISOString(),
      );
      events = (await detail(alice)).versions[0].events;
      assert.equal(events.length, 3);
      assert.equal(events[2].score, null);
      assert.equal(events[2].includes_grade, false);
      assert.deepEqual(
        await as(bob, 'select * from assignment_review_events'),
        [],
      );
      assert.deepEqual(
        await as(alice, 'select * from assignment_audit_events'),
        [],
      );
      assert.equal((await scalar(alice, 'hw_summary()')).todo, 1);
    },
  );
  await t.test(
    'authorized resubmission, old feedback and historical timestamps survive',
    async () => {
      await db.query(
        "update assignments set lifecycle='closed',due_at=now()-interval '2 days' where id=$1",
        [id],
      );
      assert.equal(
        await draft(1, 0, 'new version', 'https://example.org/loop'),
        1,
      );
      assert.equal((await submit(1, 1, randomUUID())).version, 2);
      const data = await detail(alice);
      assert.equal(data.versions.length, 2);
      assert.equal(data.versions[1].events.length, 3);
      assert.equal(data.versions[0].events.length, 0);
      assert.equal(data.status.grading, 'Awaiting review');
      assert.equal(data.status.modification, 'Resubmitted');
      await assert.rejects(
        review(admin, 4, 'release', 3, 'old', true),
        /newer submission/,
      );
      await assert.rejects(draft(2, 0, 'closed'), /revision request|closed/);
    },
  );
  await t.test(
    'all-member snapshots, missing/late/extension/excusal and server boundary',
    async () => {
      const all = randomUUID();
      await scalar(
        admin,
        `hw_save_assignment($1,0,'Deadline','',now()-interval '1 day',null,false,true,false,'all','{}')`,
        [all],
      );
      await db.query(
        "update memberships set status='inactive' where user_id=$1",
        [bob],
      );
      assert.equal(await scalar(admin, 'hw_publish($1,1)', [all]), 3);
      await db.query(
        "update memberships set status='active' where user_id=$1",
        [bob],
      );
      assert.equal(await scalar(bob, 'hw_detail($1,null)', [all]), null);
      assert.equal(
        (await scalar(alice, 'hw_detail($1,null)', [all])).status.submission,
        'Missing',
      );
      await assert.rejects(
        scalar(alice, "hw_save_draft($1,0,0,'','https://example.org')", [all]),
        /deadline/,
      );
      await db.query(
        "update assignment_recipients set extension_at=now()+interval '1 hour' where assignment_id=$1 and member_id=$2",
        [all, alice],
      );
      await scalar(alice, "hw_save_draft($1,0,0,'','invalid')", [all]);
      await assert.rejects(
        scalar(alice, 'hw_submit($1,0,1,$2)', [all, randomUUID()]),
        /valid HTTP/,
      );
      await scalar(alice, "hw_save_draft($1,0,1,'','https://example.org')", [
        all,
      ]);
      await db.query(
        'update assignment_recipients set excused=true where assignment_id=$1 and member_id=$2',
        [all, alice],
      );
      await assert.rejects(
        scalar(alice, 'hw_submit($1,0,2,$2)', [all, randomUUID()]),
        /excused/,
      );
      await db.query(
        'update assignment_recipients set excused=false,extension_at=null where assignment_id=$1 and member_id=$2',
        [all, alice],
      );
      await db.query('update assignments set allow_late=true where id=$1', [
        all,
      ]);
      assert.equal(
        (
          await as(alice, 'select * from hw_submit($1,0,2,$2)', [
            all,
            randomUUID(),
          ])
        )[0].late,
        true,
      );
      assert.equal(
        (
          await db.query(
            "select homework_private.submission_block('published',false,0,null,null,now(),false,now()) as reason",
          )
        ).rows[0].reason,
        null,
      );
    },
  );
  await t.test(
    'revocation removes old direct links and RPC access, retains staff history',
    async () => {
      await db.query(
        "update memberships set status='inactive' where user_id=$1",
        [alice],
      );
      assert.equal(await detail(alice), null);
      assert.deepEqual(
        await as(alice, 'select * from assignment_review_events'),
        [],
      );
      await assert.rejects(draft(2, 0, 'denied'), /membership/);
      assert.equal((await detail(admin, alice)).versions.length, 2);
      const grants = await db.query(
        "select proname from pg_proc where pronamespace='public'::regnamespace and proname like 'hw_%' and has_function_privilege('anon',oid,'execute')",
      );
      assert.equal(grants.rows.length, 0);
    },
  );
});
