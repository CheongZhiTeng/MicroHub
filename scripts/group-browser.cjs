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
  await click(desk, 'Create group');
  await desk.getByLabel('Group name', { exact: true }).fill(title);
  await desk
    .getByRole('button', { name: 'Create group', exact: true })
    .last()
    .click();
  await see(desk, title);
  const search = (p, q) => p.getByLabel('Search name or student ID').fill(q);
  await search(desk, teacher.studentId);
  await click(desk, 'Group tutor · ' + teacher.studentId);
  await click(desk, 'Appoint teach');
  await desk.getByLabel('Reason for change').fill('New teaching appointment');
  await click(desk, 'Confirm change');
  await see(desk, 'Group tutor · ' + teacher.studentId + ' · Group teach');
  await login(tablet, teacher, url);
  await tablet.getByText('Create group', { exact: true }).first().waitFor();
  if (await tablet.getByRole('button', { name: title, exact: true }).count())
    await click(tablet, title);
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
  const assignment = await require('./daily-queue-browser.cjs')({
    staff: root,
    students: [student, waiting],
    session,
    device,
    login,
    click,
    see,
    origin,
  });
  const leaderAccount = await session(student);
  const leaderWork = await leaderAccount.rpc('hw_detail', {
    p_id: assignment.id,
  });
  assert.ifError(leaderWork.error);
  assert.equal(leaderWork.data.can_manage, false);
  assert.equal(leaderWork.data.versions[0].version, 1);
  assert.ok(
    leaderWork.data.versions[0].events.some((event) => event.score >= 7),
  );
  await require('./attendance-browser.cjs')({
    teacher,
    student,
    root,
    session,
    device,
    login,
    click,
    see,
    origin,
    groupName: title,
  });
  const workspace = await a.rpc('group_workspace');
  assert.ifError(workspace.error);
  const first = workspace.data.groups.find((g) => g.name === title);
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
        p_action: 'appoint_teach',
        p_reason: 'Group appointment',
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
    /current group first|Roster changed/,
  );
  const posts = origin + '/announcements/';
  const groupPost = 'Group practice ' + title;
  const clubPost = 'Club briefing ' + title;
  await login(tablet, teacher, posts);
  const publish = async (audience, heading) => {
    await click(tablet, 'New announcement');
    await tablet.getByLabel('Title', { exact: true }).fill(heading);
    await tablet
      .getByRole('radio', { name: audience, exact: true })
      .filter({ visible: true })
      .click();

    await tablet
      .getByLabel('Announcement message')
      .fill('Bring your notes to the meeting.');
    await click(tablet, 'Review announcement');
    await see(tablet, 'Publish this announcement to ' + audience + '?');
    await tablet
      .getByRole('button', {
        name: new RegExp('^Publish to ' + audience + ' · [0-9]+'),
      })
      .click();
    await see(tablet, heading);
  };
  await publish(title, groupPost);
  await publish('Big class', clubPost);
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
  await login(outside, await user('Outside student', 'member'), posts);
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
  const eventsUrl = origin + '/events/';
  await login(tablet, teacher, origin + '/more/');
  await click(tablet, 'New event');
  await tablet.getByLabel('Starts (MYT)').waitFor();
  await tablet
    .getByRole('radio', { name: title, exact: true })
    .filter({ visible: true })
    .click();
  const eventTitle = 'Workshop ' + title;
  await tablet.getByLabel('Title', { exact: true }).fill(eventTitle);
  const nowDay = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  await tablet.getByLabel('Starts (MYT)').fill(nowDay + ' 00:00');
  await tablet.getByLabel('Ends (MYT)').fill(nowDay + ' 23:59');
  await tablet.getByLabel('Location', { exact: true }).fill('Room A201');
  await click(tablet, 'Back to calendar');
  await see(tablet, 'Discard changes?');
  await click(tablet, 'Keep editing');
  assert.equal(
    await tablet.getByLabel('Title', { exact: true }).inputValue(),
    eventTitle,
  );
  await tablet
    .getByRole('button', {
      name: new RegExp('^Publish to ' + title + ' · [0-9]+'),
    })
    .click();
  await see(tablet, eventTitle);
  await login(phone, student, eventsUrl);
  await click(phone, 'My group');
  await see(phone, eventTitle);
  await click(phone, 'Big class');
  await see(phone, 'No events in this view.');
  await click(phone, 'Back to home');
  await see(phone, 'Club calendar');
  const eventDay = phone.getByRole('button', {
    name: new RegExp('^' + nowDay + ' · Has events'),
  });
  for (const width of [390, 1280]) {
    await phone.setViewportSize({ width, height: 850 });
    assert.equal(
      await phone.getByRole('radio', { name: /^(Week|Month)$/ }).count(),
      0,
    );
    assert.equal(
      await phone.getByText('This week', { exact: true }).count(),
      0,
    );
    await eventDay.click();
    await see(phone, eventTitle);
    await phone
      .getByText(/Room A201/)
      .first()
      .waitFor();
    await click(phone, 'Next month');
    await click(phone, 'Previous month');
    await eventDay.click();
  }
  await phone.setViewportSize({ width: 390, height: 850 });
  const eventCheckIn = 'Event check-in · ' + eventTitle;
  await click(phone, eventCheckIn);
  await see(phone, 'No check-in available for this event.');
  await click(tablet, eventCheckIn);
  await tablet.getByText(/Expected students · [1-9]/).waitFor();
  await click(tablet, 'Start check-in');
  await see(tablet, 'Attendance code');
  const eventCode = await tablet
    .getByRole('heading', { name: /^\d{6}$/ })
    .textContent();
  await click(phone, 'Refresh');
  await phone.getByLabel('Six-digit code').fill(eventCode);
  await click(phone, 'Check in now');
  await phone.getByText(/Check-in receipt ·/).waitFor();
  const eventLink = phone.url();
  await login(phone, student, eventLink);
  await phone.getByText(/Check-in receipt ·/).waitFor();
  await click(tablet, 'End check-in');
  await click(tablet, 'Confirm');
  await login(phone, student, origin + '/');
  await eventDay.click();
  console.log(
    'Calendar-linked check-in passed: prefill, start, phone receipt, sign-in return and close.',
  );
  const dueDay = new Date(assignment.due.getTime() + 8 * 3600000)
    .toISOString()
    .slice(0, 10);
  if (dueDay.slice(0, 7) !== nowDay.slice(0, 7))
    await click(phone, 'Next month');
  await phone
    .getByRole('button', { name: new RegExp('^' + dueDay + ' .*Homework due') })
    .click();
  await click(phone, assignment.title);
  await phone.waitForURL(
    (target) =>
      target.searchParams.get('id') === assignment.id &&
      target.searchParams.get('mode') === 'mine',
  );
  await phone
    .getByText(assignment.title, { exact: true })
    .filter({ visible: true })
    .waitFor();
  console.log(
    'Home month calendar and event editor passed: group event, location, navigation and unsaved form.',
  );
  if (process.env.DELETE_GROUP_URL) {
    await login(tablet, teacher, url);
    await tablet
      .getByRole('button', { name: 'Create group', exact: true })
      .waitFor();
    await click(tablet, title);
    const remove = async (value) => {
      await click(tablet, 'Delete group');
      await tablet
        .getByLabel('Your current password', { exact: true })
        .fill(value);
      await click(tablet, 'Confirm deletion');
    };
    await remove('Incorrect-Pass-12345');
    await see(tablet, 'Password confirmation failed');
    const [deleted] = await Promise.all([
      tablet.waitForResponse(
        (response) =>
          response.url().endsWith('/functions/v1/delete-group') &&
          response.request().method() === 'POST',
      ),
      remove(password),
    ]);
    assert.equal(deleted.status(), 200);
    await see(tablet, 'Show archived groups');
    const result = await a.rpc('group_workspace');
    assert.ifError(result.error);
    assert.equal(
      result.data.groups.find((g) => g.id === first.id).state,
      'archived',
    );
    assert.equal(
      result.data.candidates.find((p) => p.id === student.id).group_id,
      null,
    );
  }
  console.log(
    'Groups passed: desktop coordinator, tablet teacher, phone leader, login return and simultaneous placement.',
  );
};
