// Called with newly created, isolated Supabase identities from the browser rehearsal.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Buffer } = require('node:buffer');
module.exports = async function homeworkFull({
  user,
  device,
  login,
  click,
  see,
  origin,
  teacher,
  student,
  session,
  group,
  a,
}) {
  const learner = await user('Team partner', 'member');
  const ws = await a.rpc('group_workspace');
  assert.ifError(ws.error);
  const rev = ws.data.groups.find((g) => g.id === group).revision;
  const assigned = await a.rpc('group_change', {
    p_action: 'assign',
    p_person: learner.id,
    p_group: group,
    p_revision: rev,
  });
  assert.ifError(assigned.error);
  const leader = await device(1080),
    phone = await device(390, 'dark'),
    staff = await device(1280);
  await login(leader, student, origin + '/assignment-editor/');
  const title = 'Team lab ' + Date.now();
  await leader.getByLabel('Title', { exact: true }).fill(title);
  await leader.getByLabel('Deadline (Malaysia time)').fill('2030-10-04 12:00');
  await leader.getByLabel('Maximum points', { exact: true }).fill('10');
  await click(leader, 'Save draft and preview');
  await see(leader, 'Student preview');
  await click(leader, 'Use one shared group submission');
  await see(leader, 'Switch to individual submissions');
  await leader.getByLabel('Files per submission (0–10)').fill('2');
  await click(leader, 'Save file rules');
  await see(leader, 'Require files only');
  const id = new URL(leader.url()).searchParams.get('id');
  assert.ok(id);
  await click(leader, 'Publish assignment');
  await see(leader, 'Submission overview');
  const link = origin + '/assignment/?id=' + id + '&mode=mine';
  await login(phone, learner, link);
  await phone
    .getByLabel('Your response')
    .fill('A shared answer from the phone.');
  await phone.getByText(/Group draft saved ·/).waitFor();
  if (process.env.HOMEWORK_FILES_URL) {
    const fileInput = phone.waitForEvent('filechooser');
    await click(phone, 'Choose file or photo');
    await (
      await fileInput
    ).setFiles({
      name: 'solution.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Shared attachment'),
    });
    await see(phone, 'solution.txt · 1 KB');
  }
  await click(phone, 'Review submission');
  await click(phone, 'Confirm submission');
  await phone.getByText(/Last receipt · Version 1/).waitFor();
  await phone.getByLabel('Message to class').fill('Our team has finished.');
  await click(phone, 'Post message');
  await phone
    .getByText(/Our team has finished\./)
    .first()
    .waitFor();
  await login(
    staff,
    teacher,
    origin + '/assignment/?id=' + id + '&mode=manage',
  );
  await click(staff, 'Team partner · ' + learner.studentId);
  await staff.getByLabel('Score (out of 10)').fill('9');
  await staff.getByLabel('Private feedback').fill('Clear evidence');
  await click(staff, 'Save grading draft');
  await see(staff, 'Grading draft saved privately.');
  await click(staff, 'Mark saved grade for bulk return');
  await see(staff, 'Saved grade marked for bulk return.');
  await click(staff, 'Preview bulk return');
  await click(staff, 'Return listed versions');
  await click(staff, 'Completion analysis');
  await staff.getByText(/Mean released score.*9/).waitFor();
  const dl = staff.waitForEvent('download');
  await click(staff, 'Export grades (CSV)');
  assert.ok((await dl).suggestedFilename().endsWith('.csv'));
  await click(phone, 'Refresh assignment');
  await see(phone, 'Clear evidence');
  const c = await session(learner);
  const info = await c.rpc('hw_detail', { p_id: id });
  assert.ifError(info.error);
  assert.equal(info.data.versions[0].events[0].score, 9);
  if (process.env.HOMEWORK_FILES_URL) {
    const endpoint = new URL(process.env.HOMEWORK_FILES_URL);
    assert.ok(['localhost', '127.0.0.1'].includes(endpoint.hostname));
    const browserFile = phone.waitForEvent('download');
    await click(phone, 'solution.txt · 1 KB');
    assert.equal((await browserFile).suggestedFilename(), 'solution.txt');
    const f = info.data.files[0];
    assert.ok(f.version_id);
    const access = (await c.auth.getSession()).data.session.access_token;
    const res = await fetch(endpoint + '?mode=download', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + access,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: f.id }),
    });
    assert.equal(res.status, 200);
    const signed = await res.json();
    assert.equal(await (await fetch(signed.url)).text(), 'Shared attachment');
  }
  const leaderSession = await session(student),
    learnerSession = await session(learner);
  const raceId = randomUUID();
  const save = await a.rpc('hw_save_scoped', {
    p_id: raceId,
    p_revision: 0,
    p_group: group,
    p_title: 'Concurrent team',
    p_instructions: 'Test',
    p_due: new Date(Date.now() + 86400000).toISOString(),
    p_points: 10,
    p_text: true,
    p_link: true,
    p_late: true,
    p_audience: 'selected',
    p_targets: [student.id, learner.id],
  });
  assert.ifError(save.error);
  assert.ifError(
    (
      await a.rpc('hw_work_mode', {
        p_id: raceId,
        p_revision: 1,
        p_joint: true,
      })
    ).error,
  );
  assert.ifError(
    (await a.rpc('hw_publish', { p_id: raceId, p_revision: 2 })).error,
  );
  const clients = [leaderSession, learnerSession];
  const drafts = await Promise.all(
    clients.map((x, i) =>
      x.rpc('hw_save_draft', {
        p_id: raceId,
        p_base: 0,
        p_revision: 0,
        p_body: 'Team answer ' + i,
        p_link: '',
      }),
    ),
  );
  assert.equal(drafts.filter((r) => !r.error).length, 1);
  const submissions = await Promise.all(
    clients.map((x) =>
      x.rpc('hw_submit', {
        p_id: raceId,
        p_base: 0,
        p_revision: 1,
        p_request: randomUUID(),
      }),
    ),
  );
  for (const submission of submissions) assert.ifError(submission.error);
  const receipts = await Promise.all(
    clients.map((x) => x.rpc('hw_detail', { p_id: raceId })),
  );
  assert.ok(receipts.every((r) => r.data.versions.length === 1));
  assert.equal(
    receipts[0].data.versions[0].team_batch,
    receipts[1].data.versions[0].team_batch,
  );
  console.log(
    'Group homework passed: leader publication, shared phone draft and receipt, discussion, teacher grading, batch return, analytics and CSV.' +
      (process.env.HOMEWORK_FILES_URL
        ? ' Real Edge upload, private Storage and signed download passed.'
        : ''),
  );
};
