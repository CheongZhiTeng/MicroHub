// Runs inside the existing local acceptance harness, using real password sessions.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
module.exports = async function groupBrowser({
  user,
  device,
  login,
  click,
  see,
  origin,
  api,
  password,
  key,
}) {
  const root = await user('Group coordinator', 'super_admin');
  const teacher = await user('Group tutor', 'member');
  const student = await user('Group student', 'member');
  const other = await user('Other tutor', 'member');
  const waiting = await user('Waiting student', 'member');
  const desk = await device(1280),
    tablet = await device(820),
    phone = await device(390, 'dark');
  const title = 'Group ' + randomUUID().slice(0, 8);
  const url = origin + '/groups/';
  await login(desk, root, url);
  await desk.getByLabel('Group name', { exact: true }).fill(title);
  await click(desk, 'Preview new group');
  await click(desk, 'Confirm change');
  await see(desk, title);
  const search = (p, q) => p.getByLabel('Search name or student ID').fill(q);
  await search(desk, teacher.studentId);
  await click(desk, 'Group tutor · ' + teacher.studentId);
  await click(desk, 'Appoint teacher');
  await click(desk, 'Confirm change');
  await see(desk, 'Group tutor · ' + teacher.studentId + ' · Group teacher');
  await login(tablet, teacher, url);
  await search(tablet, student.studentId);
  await click(tablet, 'Group student · ' + student.studentId);
  await click(tablet, 'Assign student');
  await click(tablet, 'Confirm change');
  await click(tablet, 'Group student · ' + student.studentId + ' · Student');
  await click(tablet, 'Appoint leader');
  await click(tablet, 'Confirm change');
  await see(tablet, 'Group student · ' + student.studentId + ' · Group leader');
  await login(phone, student, url);
  await see(
    phone,
    'Your group will appear here after placement and activation.',
  );
  await click(tablet, 'Activate group');
  await click(tablet, 'Confirm change');
  await see(tablet, 'Active group');
  await click(phone, 'Refresh');
  await see(phone, title);
  await see(phone, 'Group student · ' + student.studentId + ' · Group leader');
  assert.equal(await phone.getByText('Manage placements').count(), 0);
  await phone.reload();
  await phone.getByLabel('School email').fill(student.email);
  await phone.getByLabel('Password', { exact: true }).fill(password);
  await click(phone, 'Sign in');
  await see(phone, title);
  // Two teachers attempt to claim the same unassigned student at once.
  const session = async (account) => {
    const c = createClient(api, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    assert.ifError(
      (await c.auth.signInWithPassword({ email: account.email, password }))
        .error,
    );
    return c;
  };
  const [coord, a, b] = await Promise.all([root, teacher, other].map(session));
  const workspace = await a.rpc('group_workspace');
  assert.ifError(workspace.error);
  const first = workspace.data.groups[0];
  const second = await coord.rpc('group_change', {
    p_action: 'create',
    p_name: title + ' B',
    p_group: null,
    p_revision: null,
  });
  assert.ifError(second.error);
  assert.ifError(
    (
      await coord.rpc('group_change', {
        p_action: 'teacher',
        p_group: second.data,
        p_revision: 1,
        p_person: other.id,
      })
    ).error,
  );
  const claims = await Promise.all(
    [
      [a, first.id, first.revision],
      [b, second.data, 2],
    ].map(([c, id, rev]) =>
      c.rpc('group_change', {
        p_action: 'assign',
        p_group: id,
        p_revision: rev,
        p_person: waiting.id,
      }),
    ),
  );
  assert.equal(claims.filter((r) => !r.error).length, 1);
  assert.match(
    claims.find((r) => r.error).error.message,
    /already assigned|Roster changed/,
  );
  const posts = origin + '/announcements/';
  const groupPost = 'Group practice ' + title;
  const clubPost = 'Club briefing ' + title;
  await login(tablet, teacher, posts);
  const publish = async (audience, heading) => {
    await click(tablet, 'New announcement');
    await click(tablet, audience);
    await tablet.getByLabel('Title', { exact: true }).fill(heading);
    await tablet
      .getByLabel('Announcement message')
      .fill('Bring your notes to the meeting.');
    await click(tablet, 'Review announcement');
    await see(tablet, 'Publish this announcement to ' + audience + '?');
    await click(tablet, 'Publish announcement');
    await see(tablet, heading);
  };
  await publish(title, groupPost);
  await publish('Whole club', clubPost);
  await login(phone, student, posts);
  await see(phone, groupPost);
  await see(phone, clubPost);
  assert.equal(
    await phone.getByRole('button', { name: 'New announcement' }).count(),
    0,
  );
  await click(phone, 'Back to home');
  await see(phone, groupPost);
  await see(phone, clubPost);
  const outside = await device(390);
  await login(outside, other, posts);
  await see(outside, clubPost);
  assert.equal(await outside.getByText(groupPost, { exact: true }).count(), 0);
  console.log(
    'Announcements passed: tablet publish, phone feed and home preview, and cross-group privacy.',
  );
  await require('./homework-full-browser.cjs')({
    user,
    device,
    login,
    click,
    see,
    origin,
    teacher,
    student,
    session,
    group: first.id,
    a,
  });
  console.log(
    'Groups passed: desktop coordinator, tablet teacher, phone leader, login return and simultaneous placement.',
  );
};
