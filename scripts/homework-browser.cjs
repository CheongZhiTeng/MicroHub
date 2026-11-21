/* Exercise a Pages export against a disposable local Supabase stack.
 * Start with docs/HOMEWORK_ACCEPTANCE.md. Only the local test runner holds the admin key. */
const assert = require('node:assert/strict');
const { randomUUID, randomInt } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('node:http');
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');
const api = process.env.API_URL;
assert(
  api && ['localhost', '127.0.0.1'].includes(new URL(api).hostname),
  'Use a disposable loopback Supabase stack.',
);
if (process.env.HOMEWORK_FILES_URL) {
  const endpoint = new URL(process.env.HOMEWORK_FILES_URL);
  assert(
    ['localhost', '127.0.0.1'].includes(endpoint.hostname) &&
      ['http:', 'https:'].includes(endpoint.protocol),
    'Use a local Edge endpoint for test identities.',
  );
}
const service = createClient(api, process.env.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const folder = path.resolve(process.argv[2] ?? 'dist/pages');
const password = randomUUID() + 'A1';
async function checked(result) {
  const { data, error } = await result;
  if (error) throw Error(error.message);
  return data;
}
async function user(name, role) {
  const studentId = String(randomInt(100000, 1000000));
  const email = 'sa' + studentId + '@foonyewsa.edu.my';
  const { user } = await checked(
    service.auth.admin.createUser({ email, password, email_confirm: true }),
  );
  await checked(
    service
      .from('profiles')
      .update({ display_name: name, class_name: 'Local test' })
      .eq('id', user.id),
  );
  await checked(service.from('memberships').insert({ user_id: user.id }));
  await checked(
    service.from('platform_roles').update({ role }).eq('user_id', user.id),
  );
  return { email, id: user.id, studentId };
}
async function run() {
  const teacher = await user('Homework Teacher', 'admin'),
    alice = await user('Homework Alice', 'member'),
    bob = await user('Homework Bob', 'member');
  const title = 'Loop study ' + randomUUID().slice(0, 8);
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/MicroHub/')) return res.writeHead(404).end();
    let target = path.resolve(
      folder,
      '.' + decodeURIComponent(url.pathname.slice('/MicroHub'.length)),
    );
    if (!target.startsWith(folder + path.sep) && target !== folder)
      return res.writeHead(403).end();
    if (fs.existsSync(target) && fs.statSync(target).isDirectory())
      target = path.join(target, 'index.html');
    if (!fs.existsSync(target)) return res.writeHead(404).end();
    res.setHeader(
      'Content-Type',
      target.endsWith('.js')
        ? 'text/javascript'
        : target.endsWith('.html')
          ? 'text/html'
          : 'application/octet-stream',
    );
    fs.createReadStream(target).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port + '/MicroHub';
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  const errors = [],
    pages = [];
  async function device(width, scheme = 'light') {
    const ctx = await browser.newContext({
      viewport: { width, height: 850 },
      colorScheme: scheme,
    });
    // Bridge the preview hostname to the same local GoTrue/PostgREST. All RLS,
    // tokens, writes and reads run on the real stack.
    await ctx.route(
      'https://microhub-preview.supabase.co/**',
      async (route) => {
        const url = new URL(route.request().url());
        try {
          const response = await route.fetch({
            url:
              process.env.HOMEWORK_FILES_URL &&
              url.pathname === '/functions/v1/homework-files'
                ? process.env.HOMEWORK_FILES_URL + url.search
                : api + url.pathname + url.search,
          });
          await route.fulfill({ response });
        } catch (e) {
          if (!route.request().failure()) throw e;
        }
      },
    );
    const page = await ctx.newPage();
    pages.push(page);
    page.setDefaultTimeout(14000);
    page.on('console', (entry) => {
      if (
        /Unexpected text node|Text strings must be rendered/.test(entry.text())
      )
        errors.push(entry.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    return page;
  }
  const click = (p, name) =>
    p
      .getByRole('button', { name, exact: true })
      .or(p.getByRole('radio', { name, exact: true }))
      .click();
  const see = (p, text) => p.getByText(text, { exact: true }).first().waitFor();
  async function capture(page, name) {
    if (!process.env.HOMEWORK_SCREENSHOTS) return;
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => document.fonts.ready);
    fs.mkdirSync(process.env.HOMEWORK_SCREENSHOTS, { recursive: true });
    await page.screenshot({
      path: path.join(process.env.HOMEWORK_SCREENSHOTS, name + '.png'),
    });
  }
  async function login(p, account, url = origin + '/') {
    await p.goto(url);
    await p.getByLabel('School email', { exact: true }).fill(account.email);
    await p.getByLabel('Password', { exact: true }).fill(password);
    await click(p, 'Sign in');
  }
  try {
    const staff = await device(1280),
      phone = await device(390, 'dark'),
      desk = await device(1024),
      outsider = await device(820);
    await login(staff, teacher);
    await click(staff, 'Assignment workspace');
    await click(staff, 'Create assignment');
    await staff.getByLabel('Title', { exact: true }).fill(title);
    await staff
      .getByLabel('Instructions', { exact: true })
      .fill('Explain how a loop terminates.');
    for (const width of [1280, 820, 390]) {
      await staff.setViewportSize({ width, height: 850 });
      await staff.getByLabel('Title', { exact: true }).scrollIntoViewIfNeeded();
      assert(
        await staff.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await capture(staff, 'after-' + width);
    }
    await staff.setViewportSize({ width: 1280, height: 850 });
    await click(staff, 'Submission settings');
    await staff.getByLabel('Maximum points', { exact: true }).fill('10');
    const recipients = staff.getByRole('radio', {
      name: 'All club students',
      exact: true,
    });
    await recipients.focus();
    await recipients.press('ArrowRight');
    await staff
      .getByRole('radio', {
        name: 'Select members',
        exact: true,
        checked: true,
      })
      .waitFor();
    await staff
      .getByLabel('Find recipients by name or student ID')
      .fill(alice.studentId);
    await click(staff, 'Homework Alice · ' + alice.studentId);
    if (process.env.HOMEWORK_FILES_URL) {
      await require('./homework-full-browser.cjs').referencePdf(staff);
      assert(new URL(staff.url()).pathname.includes('/assignment-editor'));
      await staff
        .getByLabel('Instructions', { exact: true })
        .fill('Explain how a loop terminates. Include an example.');
    }
    await click(staff, 'Save draft and preview');
    await see(staff, 'Student preview');
    await staff.getByText(/1 student · Individual submissions/).waitFor();
    if (process.env.HOMEWORK_FILES_URL)
      await see(staff, 'worksheet.pdf · 1 KB');
    const id = new URL(staff.url()).searchParams.get('id');
    assert(id);
    const link = origin + '/assignment/?id=' + id + '&mode=mine';
    await login(phone, alice, link);
    await see(phone, 'This assignment is unavailable to your account.');
    const publish = staff.getByRole('button', {
      name: 'Publish to Whole club (selected students)',
      exact: true,
    });
    await publish.focus();
    await publish.press('Enter');
    await see(staff, 'Published to 1 members.');
    await click(phone, 'Refresh assignment');
    await phone.getByLabel('Your response').fill('First device draft');
    await capture(phone, 'student-dark');
    await phone.getByText(/Private draft saved ·/).waitFor();
    await login(desk, alice, link);
    assert.equal(
      await desk.getByLabel('Your response').inputValue(),
      'First device draft',
    );
    await desk.getByLabel('Your response').fill('Final text from desktop');
    await desk.getByLabel('Submission link').fill('https://example.org/loops');
    await desk.getByText(/Private draft saved ·/).waitFor();
    await phone
      .getByLabel('Your response')
      .fill('Keep this unsaved phone text');
    await see(phone, 'Your draft changed on another device');
    assert.equal(
      await phone.getByLabel('Your response').inputValue(),
      'Keep this unsaved phone text',
    );
    await click(phone, 'Use server copy');
    assert.equal(
      await phone.getByLabel('Your response').inputValue(),
      'Final text from desktop',
    );
    // Lose a successful HTTP reply. The second tap must reconcile the receipt.
    await desk.route(
      '**/rest/v1/rpc/hw_submit',
      async (route) => {
        const sent = await route.fetch({ url: api + '/rest/v1/rpc/hw_submit' });
        assert(sent.ok());
        await route.abort('failed');
      },
      { times: 1 },
    );
    await click(desk, 'Review submission');
    await click(desk, 'Confirm submission');
    await desk.getByRole('alert').waitFor();
    await click(desk, 'Confirm submission');
    await see(desk, 'Submission received.');
    await click(phone, 'Refresh assignment');
    await phone.getByText(/Last receipt · Version 1/).waitFor();
    await login(outsider, bob, link);
    await see(outsider, 'This assignment is unavailable to your account.');
    await click(staff, 'Refresh roster');
    await click(staff, 'Homework Alice · ' + alice.studentId);
    await staff.getByLabel('Score (out of 10)').fill('8');
    await capture(staff, 'grading-desktop');
    await staff.getByLabel('Private feedback').fill('Private grading draft');
    await click(staff, 'Save grading draft');
    await see(staff, 'Grading draft saved privately.');
    await click(phone, 'Refresh assignment');
    assert.equal(
      await phone.getByText('Private grading draft', { exact: true }).count(),
      0,
    );
    await staff.getByLabel('Private feedback').fill('Clear explanation.');
    await click(staff, 'Return grade and feedback');
    await click(staff, 'Confirm return');
    await see(staff, 'Feedback returned to the member.');
    await click(phone, 'Refresh assignment');
    await see(phone, 'Score · 8');
    await see(phone, 'Clear explanation.');
    await staff.getByLabel('Private feedback').fill('Add a second example.');
    await click(staff, 'Request a revision');
    await click(staff, 'Confirm revision request');
    await see(staff, 'Revision requested.');
    await click(phone, 'Refresh assignment');
    await see(phone, 'Add a second example.');
    await phone.getByLabel('Your response').fill('Revised with two examples');
    await phone.getByText(/Private draft saved ·/).waitFor();
    await click(phone, 'Review submission');
    await click(phone, 'Confirm submission');
    await phone.getByText(/Last receipt · Version 2/).waitFor();
    await click(phone, 'Show previous submissions');
    await see(phone, 'Score · 8');
    await see(phone, 'Final text from desktop');
    assert(
      await phone.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      'Phone layout overflows',
    );
    await click(staff, 'Refresh member work');
    await see(
      staff,
      'A newer version is available. This draft stays with its original version.',
    );
    await click(staff, 'Version 2');
    await see(staff, 'Grade version 2');
    await staff.setViewportSize({ width: 390, height: 850 });
    await click(staff, 'Back to roster');
    await click(staff, 'Homework Alice · ' + alice.studentId);
    await see(staff, 'Grade version 2');
    await staff.setViewportSize({ width: 1280, height: 850 });
    await click(staff, 'Add recipients');
    await staff
      .getByLabel('Find recipients by name or student ID')
      .fill(bob.studentId);
    await click(staff, 'Homework Bob · ' + bob.studentId);
    await click(staff, 'Assign to selected members');
    await see(staff, 'The selected members have this assignment.');
    await click(outsider, 'Refresh assignment');
    await outsider.getByLabel('Your response').waitFor();
    assert.equal(
      await outsider.getByText('Clear explanation.', { exact: true }).count(),
      0,
    );
    await click(staff, 'Latest submission');
    await click(staff, 'Copy to new draft');
    assert.equal(
      await staff.getByLabel('Title', { exact: true }).inputValue(),
      'Copy of ' + title,
    );
    await see(staff, '0 selected');
    await click(staff, 'All club students');
    await click(staff, 'Save draft and preview');
    await see(staff, 'Student preview');
    const copyId = new URL(staff.url()).searchParams.get('id');
    assert(copyId && copyId !== id);
    await click(staff, 'Delete draft');
    await click(staff, 'Confirm delete');
    await staff
      .getByRole('button', { name: 'Create assignment', exact: true })
      .waitFor();
    assert.equal(
      (await checked(service.from('assignments').select('id').eq('id', copyId)))
        .length,
      0,
    );
    await staff.getByRole('link', { name: 'Go to Home', exact: true }).click();
    await staff.getByText(/submitted · [1-9]\d* awaiting review/).waitFor();
    await desk.reload();
    await desk.getByLabel('School email').fill(alice.email);
    await desk.getByLabel('Password', { exact: true }).fill(password);
    await click(desk, 'Sign in');
    await desk.getByText(/Last receipt · Version 2/).waitFor();
    const reviewer = await user('Second reviewer', 'admin');
    await require('./homework-concurrency.cjs')({
      api,
      key: process.env.PUBLISHABLE_KEY,
      password,
      teacher,
      reviewer,
      student: bob,
      other: alice,
      id,
    });
    await require('./group-browser.cjs')({
      user,
      device,
      login,
      click,
      see,
      origin,
      api,
      password,
      key: process.env.PUBLISHABLE_KEY,
    });
    assert.deepEqual(errors, []);
    console.log(
      'Local Supabase + Pages passed: selected publish, non-recipient denial, two-device draft, two receipts, private grade, release, revision, dashboard and authenticated deep-link reload.',
    );
  } catch (e) {
    for (const p of pages)
      console.error(
        p.url(),
        (
          await p
            .locator('body')
            .innerText()
            .catch(() => '')
        ).slice(-1250),
      );
    throw e;
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
run().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
