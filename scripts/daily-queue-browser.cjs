const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
module.exports = async function exercise({
  staff,
  students,
  session,
  device,
  login,
  click,
  see,
  origin,
}) {
  const manager = await session(staff);
  const id = randomUUID(),
    title = 'Daily queue ' + id.slice(0, 8);
  async function rpc(c, name, args) {
    const r = await c.rpc(name, args);
    assert.ifError(r.error);
    return r.data;
  }
  const due = new Date(Date.now() + 86400000);
  await rpc(manager, 'hw_save_assignment', {
    p_id: id,
    p_revision: 0,
    p_title: title,
    p_instructions: 'Answer',
    p_due: due.toISOString(),
    p_points: 10,
    p_text: true,
    p_link: false,
    p_late: true,
    p_audience: 'selected',
    p_targets: students.map((s) => s.id),
  });
  await rpc(manager, 'daily_publish', {
    p_id: id,
    p_revision: 1,
    p_expected: 2,
  });
  for (const s of students) {
    const c = await session(s);
    await rpc(c, 'hw_save_draft', {
      p_id: id,
      p_revision: 0,
      p_base: 0,
      p_body: 'Answer',
      p_link: '',
    });
    await rpc(c, 'hw_submit', {
      p_id: id,
      p_base: 0,
      p_revision: 1,
      p_request: randomUUID(),
    });
  }
  const page = await device(1280);
  await login(page, staff, origin + '/homework/');
  await page.getByLabel('Search assignments').fill(title);
  await click(page, title + ' · Awaiting review · 2');
  for (let n = 1; n <= 2; n++) {
    await see(page, 'Review ' + n + ' / 2');
    await page.getByLabel('Score (out of 10)').fill(String(7 + n));
    await click(page, 'Return and continue');
    await click(page, 'Confirm return');
  }
  await see(page, 'No more work to grade.');
  console.log(
    'Two private submissions returned sequentially through the staff queue.',
  );
  return { id, title, due };
};
