const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');

// Independent password sessions reach PostgREST concurrently on the local stack.
module.exports = async function concurrentHomework({
  api,
  key,
  password,
  teacher,
  reviewer,
  student,
  other,
  id,
}) {
  async function signIn(account) {
    const client = createClient(api, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await client.auth.signInWithPassword({
      email: account.email,
      password,
    });
    if (error) throw Error(error.message);
    return client;
  }
  const [a, b, first, second, peer] = await Promise.all(
    [teacher, reviewer, student, student, other].map(signIn),
  );
  const args = {
    p_id: id,
    p_revision: 0,
    p_base: 0,
    p_body: 'concurrent draft',
    p_link: '',
  };
  const writes = await Promise.all(
    [first, second].map((c) => c.rpc('hw_save_draft', args)),
  );
  assert.equal(writes.filter((r) => !r.error).length, 1);
  assert.match(writes.find((r) => r.error).error.message, /Draft conflict/);
  const submit = {
    p_id: id,
    p_base: 0,
    p_revision: 1,
    p_request: randomUUID(),
  };
  const receipts = await Promise.all(
    [first, second].map((c) => c.rpc('hw_submit', submit)),
  );
  for (const r of receipts) assert.ifError(r.error);
  const read = async (c) => {
    const r = await c.rpc('hw_detail', { p_id: id });
    assert.ifError(r.error);
    return r.data;
  };
  const record = (await read(first)).versions;
  assert.equal(record.length, 1);
  const version = record[0].id;
  const review = {
    p_version: version,
    p_revision: 0,
    p_action: 'save',
    p_score: 4,
    p_feedback: 'Working grade',
    p_include_grade: false,
    p_revision_due: null,
    p_request: randomUUID(),
  };
  const grades = await Promise.all(
    [a, b].map((c) =>
      c.rpc('hw_review', { ...review, p_request: randomUUID() }),
    ),
  );
  assert.equal(grades.filter((r) => !r.error).length, 1);
  assert.match(grades.find((r) => r.error).error.message, /Review conflict/);
  assert.equal((await read(first)).versions[0].review, null);
  const release = {
    ...review,
    p_revision: 1,
    p_action: 'release',
    p_include_grade: true,
    p_request: randomUUID(),
  };
  for (const r of await Promise.all(
    [a, a].map((c) => c.rpc('hw_review', release)),
  ))
    assert.ifError(r.error);
  assert.equal((await read(first)).versions[0].events.length, 1);
  assert.ifError(
    (
      await a.rpc('hw_review', {
        ...review,
        p_revision: 2,
        p_action: 'revision',
        p_feedback: 'Expand the example.',
        p_request: randomUUID(),
      })
    ).error,
  );
  assert.ifError(
    (
      await first.rpc('hw_save_draft', {
        ...args,
        p_base: 1,
        p_body: 'updated',
      })
    ).error,
  );
  const outcomes = await Promise.all([
    first.rpc('hw_submit', { ...submit, p_base: 1, p_request: randomUUID() }),
    second.rpc('hw_submit', { ...submit, p_base: 1, p_request: randomUUID() }),
    b.rpc('hw_review', { ...release, p_revision: 3, p_request: randomUUID() }),
  ]);
  assert.equal(outcomes.slice(0, 2).filter((r) => !r.error).length, 1);
  assert.match(
    outcomes.slice(0, 2).find((r) => r.error).error.message,
    /already changed/,
  );
  if (outcomes[2].error)
    assert.match(outcomes[2].error.message, /newer submission/);
  const history = (await read(first)).versions;
  assert.equal(history.length, 2);
  assert.equal(history[0].events.length, 0);
  assert.equal(history[0].review, null);
  assert.equal(history[1].id, version);
  const hidden = await peer
    .from('submission_versions')
    .select('id')
    .eq('id', version);
  assert.ifError(hidden.error);
  assert.deepEqual(hidden.data, []);
  console.log(
    'Concurrent PostgREST sessions passed: draft collision, duplicate and competing submits, two graders, repeated release and resubmission during grading.',
  );
};
