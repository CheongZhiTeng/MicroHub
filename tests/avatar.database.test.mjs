import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { homeworkBackend, alice, bob, admin } from './homework-backend.mjs';
test('photo ownership, member visibility, replacement conflicts and removal', async (t) => {
  const { db, as } = await homeworkBackend();
  t.after(() => db.close());
  const first = randomUUID(),
    second = randomUUID(),
    foreign = randomUUID();
  const commit = 'select public.avatar_commit($1,$2,$3)';
  await db.query(
    'insert into public.profile_avatar_files(id,owner_id) values($1,$2),($3,$2),($4,$5)',
    [first, alice, second, foreign, bob],
  );
  await assert.rejects(
    as(bob, commit, [alice, null, first]),
    /permission denied/,
  );
  await assert.rejects(
    as(alice, 'update public.profiles set avatar_id=$1 where id=$2', [
      first,
      alice,
    ]),
    /permission denied/,
  );
  await assert.rejects(
    db.query(commit, [alice, null, foreign]),
    /Invalid photo/,
  );
  await db.query(commit, [alice, null, first]);
  const visible = async (user, photo) =>
    (
      await as(user, 'select public.avatar_can_read($1) as allowed', [
        'avatars/' + alice + '/' + photo + '.jpg',
      ])
    )[0].allowed;
  assert.equal(await visible(alice, first), true);
  assert.equal(await visible(bob, first), true);
  await db.query(
    "update public.memberships set status='inactive' where user_id=$1",
    [bob],
  );
  assert.equal(await visible(bob, first), false);
  await db.query(commit, [alice, first, second]);
  await assert.rejects(db.query(commit, [alice, first, null]), /Photo changed/);
  assert.equal(await visible(admin, first), false);
  assert.equal(await visible(admin, second), true);
  await db.query("update public.profiles set status='suspended' where id=$1", [
    alice,
  ]);
  assert.equal(await visible(admin, second), false);
  await assert.rejects(
    db.query(commit, [alice, second, null]),
    /Active account/,
  );
  await db.query("update public.profiles set status='active' where id=$1", [
    alice,
  ]);
  await db.query(commit, [alice, second, null]);
  assert.equal(await visible(alice, second), false);
  assert.equal(
    (
      await db.query(
        'select count(*) from public.profile_avatar_files where owner_id=$1 and clean_after <= now()',
        [alice],
      )
    ).rows[0].count,
    2,
  );
});
