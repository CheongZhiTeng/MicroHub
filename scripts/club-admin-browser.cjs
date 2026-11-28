// Runs against the loopback Supabase acceptance stack with disposable identities.
const { Buffer } = require('node:buffer');
const assert = require('node:assert/strict');
module.exports = async function clubAdminBrowser({
  user,
  device,
  login,
  click,
  see,
  origin,
  service,
  password,
}) {
  const chief = await user('Council coordinator', 'super_admin'),
    student = await user('Council candidate', 'member');
  assert.ifError(
    (await service.from('memberships').delete().eq('user_id', student.id))
      .error,
  );
  assert.ifError(
    (
      await service
        .from('profiles')
        .update({ name_en: 'Council candidate', name_zh: '测试会员' })
        .eq('id', student.id)
    ).error,
  );
  const actorSession = async (person) => {
    const { createClient } = require('@supabase/supabase-js');
    const caller = createClient(
      process.env.API_URL,
      process.env.PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    assert.ifError(
      (await caller.auth.signInWithPassword({ email: person.email, password }))
        .error,
    );
    return caller;
  };
  const manager = await actorSession(chief);
  const raceUsers = await Promise.all([
    user('Invite applicant A', 'member'),
    user('Invite applicant B', 'member'),
  ]);
  const raceIds = raceUsers.map((p) => p.id);
  assert.ifError(
    (await service.from('memberships').delete().in('user_id', raceIds)).error,
  );
  assert.ifError(
    (
      await service
        .from('profiles')
        .update({ name_en: 'Applicant', name_zh: '会员' })
        .in('id', raceIds)
    ).error,
  );
  const callers = await Promise.all(raceUsers.map(actorSession));
  const invitation = await manager.rpc('club_invite_issue');
  assert.ifError(invitation.error);
  const attempts = await Promise.all(
    callers.map((c) =>
      c.rpc('club_invite_redeem', { p_code: invitation.data }),
    ),
  );
  assert.equal(attempts.filter((r) => !r.error).length, 1);
  const admissions = await service
    .from('memberships')
    .select('user_id')
    .in('user_id', raceIds);
  assert.ifError(admissions.error);
  assert.equal(admissions.data.length, 1);
  const colleague = await actorSession(
    await user('Second coordinator', 'super_admin'),
  );
  const member = raceUsers.find(
    (person) => person.id === admissions.data[0].user_id,
  );
  const roster = await manager.rpc('club_admin_panel', {
    p_tab: 'members',
    p_search: member.studentId,
  });
  assert.ifError(roster.error);
  const change = {
    p_id: member.id,
    p_version: roster.data[0].version,
    p_action: 'identity',
    p_reason: 'Elected by committee',
  };
  const edits = await Promise.all([
    manager.rpc('club_member_change', { ...change, p_value: 'president' }),
    colleague.rpc('club_member_change', {
      ...change,
      p_value: 'vice_president',
    }),
  ]);
  assert.equal(edits.filter((r) => !r.error).length, 1);
  assert.match(edits.find((r) => r.error).error.message, /changed/);
  const desk = await device(1200),
    phone = await device(390, 'dark');
  await login(desk, chief, origin + '/club-admin/');
  await click(desk, 'Invitations');
  await click(desk, 'New invitation');
  const issued = desk.waitForResponse((r) =>
    r.url().endsWith('/rpc/club_invite_issue'),
  );
  await click(desk, 'Generate code');
  const code = await (await issued).json();
  assert.match(code, /^[a-f0-9]{32}$/);
  await click(desk, 'Done');
  await login(phone, student);
  await phone.getByLabel('Invitation code').fill(code);
  await click(phone, 'Join with invitation');
  await see(phone, 'Club calendar');
  await click(desk, 'Members');
  await desk.getByLabel('Search members').fill(student.studentId);
  await see(desk, 'Council candidate');
  await click(desk, 'Manage member');
  await desk
    .getByRole('alert')
    .getByRole('radio', { name: 'President', exact: true })
    .click();
  await desk.getByLabel('Reason for change').fill('Annual election');
  await click(desk, 'Confirm change');
  await desk.getByLabel('Reason for change').waitFor({ state: 'hidden' });
  await login(phone, student, origin + '/club-admin/');
  await click(phone, 'Committee positions');
  await click(phone, 'New position');
  const title = 'Secretary ' + student.studentId;
  await phone.getByLabel('Position name').fill(title);
  await click(phone, 'Save');
  await see(phone, title);
  await click(desk, 'Action history');
  await desk.getByLabel('Operator name or student ID').fill(chief.studentId);
  await see(desk, 'member.identity');
  await click(desk, 'Club settings');
  if (process.env.PROFILE_AVATAR_URL) {
    const change = desk.getByRole('button', { name: 'Change club logo' });
    const [chooser] = await Promise.all([
      desk.waitForEvent('filechooser'),
      change.click(),
    ]);
    const png = await desk.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      return c.toDataURL().split(',')[1];
    });
    await chooser.setFiles({
      name: 'crest.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png, 'base64'),
    });
    await click(desk, 'Save photo');
    await change
      .locator('img[src*="/object/sign/"]')
      .first()
      .waitFor({ state: 'attached' });
    await click(desk, 'Remove photo');
    await click(desk, 'Confirm removal');
    await desk
      .getByRole('button', { name: 'Remove photo' })
      .waitFor({ state: 'hidden' });
  }
  console.log(
    'Club administration passed: single-use invitation, mobile enrollment, president appointment, position management and audit.',
  );
};
