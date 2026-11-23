const { Buffer } = require('node:buffer');
const assert = require('node:assert/strict');
module.exports = async function profileBrowser({
  user,
  device,
  login,
  click,
  see,
  origin,
}) {
  const student = await user('Photo student', 'member');
  const phone = await device(390, 'dark');
  await login(phone, student);
  await click(phone, 'Account menu');
  await phone.getByRole('button',{name:'My profile',exact:true}).waitFor();
  await phone.keyboard.press('Escape');
  await phone.getByRole('button',{name:'My profile',exact:true}).waitFor({state:'hidden'});
  await click(phone,'Account menu');
  await click(phone, 'My profile');
  const change = phone.getByRole('button', { name: 'Change profile photo' });
  const image = Buffer.from(
    await phone.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 600;
      c.height = 400;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#118877';
      ctx.fillRect(0, 0, c.width, c.height);
      return c.toDataURL('image/png').split(',')[1];
    }),
    'base64',
  );
  const choose = async () => {
    const [chooser] = await Promise.all([
      phone.waitForEvent('filechooser'),
      change.click(),
    ]);
    await chooser.setFiles({
      name: 'photo.png',
      mimeType: 'image/png',
      buffer: image,
    });
    await see(phone, 'Photo preview');
  };
  await choose();
  await click(phone, 'Cancel');
  await phone
    .getByText('Photo preview', { exact: true })
    .waitFor({ state: 'detached' });
  for (let i = 0; i < 2; i++) {
    await choose();
    const [save] = await Promise.all([
      phone.waitForResponse(
        (r) =>
          r.url().includes('/functions/v1/profile-avatar?mode=upload') &&
          r.request().method() === 'POST',
      ),
      click(phone, 'Save photo'),
    ]);
    assert.equal(save.status(), 200, await save.text());
    await change
      .locator('img[src*="/object/sign/"]')
      .first()
      .waitFor({ state: 'attached' });
  }
  await click(phone, 'Remove photo');
  await click(phone, 'Confirm removal');
  await phone
    .getByRole('button', { name: 'Remove photo' })
    .waitFor({ state: 'detached' });
  await change
    .locator('img[src*="/object/sign/"]')
    .waitFor({ state: 'detached' });
  console.log(
    'Phone profile photo passed: pick, cancel, save, signed display, replace and remove.',
  );
};
