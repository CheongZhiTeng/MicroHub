// Called only from the loopback Supabase rehearsal with isolated accounts.
const assert = require('node:assert/strict');
module.exports = async function attendanceBrowser({
  teacher,
  student,
  root,
  session,
  device,
  login,
  click,
  see,
  origin,
  groupName,
}) {
  const staff = await device(1280),
    phone = await device(390, 'dark');
  const leader = await session(student),
    outsider = await session(root);
  const title = 'Attendance ' + Date.now();
  await login(staff, teacher, origin + '/attendance-new/');
  await staff.getByLabel('Session title').fill(title);
  await click(staff, 'Big class');
  await click(staff, 'Start check-in');
  await see(staff, 'Attendance code');
  const code = await staff
    .getByRole('heading', { name: /^\d{6}$/ })
    .textContent();
  await login(phone, student, origin + '/attendance/');
  await click(phone, title);
  await phone.getByLabel('Six-digit code').fill(code);
  const id = new URL(phone.url()).searchParams.get('id');
  assert.ok(id);
  const secondSession = await session(student);
  const response = phone.waitForResponse((r) =>
    r.url().endsWith('/rpc/attendance_check'),
  );
  await Promise.all([
    click(phone, 'Check in now'),
    secondSession.rpc('attendance_check', { p_id: id, p_code: code }),
  ]);
  const receipt = await (await response).json();
  assert.ok(receipt.checked_at);
  const duplicate = await leader.rpc('attendance_check', {
    p_id: id,
    p_code: code,
  });
  assert.ifError(duplicate.error);
  assert.equal(duplicate.data.checked_at, receipt.checked_at);
  await phone
    .getByText(/Check-in receipt ·/)
    .filter({ visible: true })
    .waitFor();
  await click(staff, 'End check-in');
  await click(staff, 'Confirm');
  await staff
    .getByText(/Check-in ended ·/)
    .filter({ visible: true })
    .waitFor();
  await phone
    .getByText(/Check-in ended ·/)
    .filter({ visible: true })
    .waitFor();
  assert.equal(
    await phone.getByRole('heading', { name: 'Attendance roster' }).count(),
    0,
  );
  assert.equal(
    (await leader.rpc('attendance_detail', { p_id: id })).data.roster,
    null,
  );
  // A group member who missed check-in is absent until their own teach records the correction.
  await login(staff, teacher, origin + '/attendance-new/');
  await staff.getByLabel('Session title').fill(title + ' group');
  await click(staff, groupName);
  await click(staff, 'Start check-in');
  await see(staff, 'Attendance code');
  await click(phone, 'Back to attendance');
  await click(phone, 'Refresh');
  await click(phone, title + ' group');
  await phone.getByLabel('Six-digit code').waitFor();
  const groupId = new URL(phone.url()).searchParams.get('id');
  assert.ok((await outsider.rpc('attendance_detail', { p_id: groupId })).error);
  await click(staff, 'End check-in');
  await click(staff, 'Confirm');
  await click(staff, 'Correct record · Group student');
  await staff
    .getByLabel('Reason for correction')
    .fill('Arrived after check-in.');
  await click(staff, 'Save correction');
  await see(staff, 'Attendance updated.');
  await click(staff, 'Recent corrections');
  await see(staff, 'Arrived after check-in.');
  await click(phone, 'Refresh');
  await see(phone, 'Late arrival');
  assert.equal(
    (await leader.rpc('attendance_detail', { p_id: groupId })).data.roster,
    null,
  );
  console.log(
    'Attendance passed: teach desktop, student leader phone, simultaneous receipt, scoped live roster, closure privacy and late correction.',
  );
};
