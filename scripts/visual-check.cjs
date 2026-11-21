/* Local browser verification only. Fixtures intercept an isolated preview host;
 * they are never imported by the app or sent to a real Supabase project. */
const { chromium } = require('playwright');
const { Buffer } = require('node:buffer');
const { createServer } = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(
  process.env.VISUAL_EXPORT_DIR || '/tmp/microhub-ui-web',
);
const output = path.resolve(
  process.env.VISUAL_OUTPUT_DIR || 'docs/screenshots',
);
const pages = process.env.VISUAL_GITHUB_PAGES === '1';
const legacyProfile = process.env.VISUAL_LEGACY_PROFILE === '1';
const nameLabel = legacyProfile ? 'Full name' : 'English name';
const basePath = pages ? '/MicroHub' : '';
const origin = 'http://127.0.0.1:8091';
fs.mkdirSync(output, { recursive: true });
const server = createServer((req, res) => {
  const url = new URL(req.url, origin);
  const pathname = decodeURIComponent(url.pathname);
  if (pages && pathname !== basePath && !pathname.startsWith(basePath + '/')) {
    res.writeHead(404).end();
    return;
  }
  const file = path.resolve(
    root,
    '.' + (pathname.slice(basePath.length) || '/'),
  );
  if (!file.startsWith(root + path.sep) && file !== root) {
    res.writeHead(403).end();
    return;
  }
  let target = file;
  if (pages && fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!pathname.endsWith('/')) {
      res.writeHead(301, { Location: url.pathname + '/' + url.search }).end();
      return;
    }
    target = path.join(file, 'index.html');
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    if (pages) res.statusCode = 404;
    target = path.join(root, pages ? '404.html' : 'index.html');
  }
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
const user = {
  id: '00000000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'sa000001@foonyewsa.edu.my',
  email_confirmed_at: '2026-11-16T00:00:00Z',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-11-16T00:00:00Z',
};
const profile = {
  id: user.id,
  display_name: 'Alex Tan',
  ...(process.env.VISUAL_LEGACY_PROFILE === '1'
    ? {}
    : { name_en: null, name_zh: null }),
  student_id: '000001',
  class_name: 'S2 Science',
  status: 'active',
};
const jwt = [
  'eyJhbGciOiJIUzI1NiJ9',
  Buffer.from(
    JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString('base64url'),
  'visual-fixture',
].join('.');
const session = {
  access_token: jwt,
  refresh_token: 'local-visual-fixture',
  token_type: 'bearer',
  expires_in: 3600,
  user,
};
const errors = [];
async function main() {
  await new Promise((resolve) => server.listen(8091, '127.0.0.1', resolve));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  let checks = 0;
  try {
    for (const size of [
      { name: 'phone', width: 390, height: 844 },
      { name: 'small-phone', width: 320, height: 740 },
      { name: 'ipad', width: 820, height: 1180 },
      { name: 'desktop', width: 1280, height: 900 },
      { name: 'wide', width: 1440, height: 1000 },
    ]) {
      if (process.env.VISUAL_SIZE && size.name !== process.env.VISUAL_SIZE)
        continue;
      for (const scheme of ['light', 'dark']) {
        if (process.env.VISUAL_SCHEME && scheme !== process.env.VISUAL_SCHEME)
          continue;
        const context = await browser.newContext({
          colorScheme: scheme,
          viewport: size,
          deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        page.on('pageerror', (e) => {
          errors.push(e.message);
          console.error('PAGE', e.message);
        });
        page.on('console', (msg) => {
          if (
            legacyProfile &&
            msg
              .location()
              .url.startsWith(
                'https://microhub-preview.supabase.co/rest/v1/rpc/hw_',
              ) &&
            msg.text().includes('status of 404')
          )
            return;
          if (msg.type() === 'error') {
            errors.push(msg.text());
            console.error(msg.text());
          }
        });
        let role = 'member';
        let approved = false;
        let signups = 0;
        let saves = 0;
        await page.route(
          'https://microhub-preview.supabase.co/**',
          async (route) => {
            const url = new URL(route.request().url());
            let body = [];
            if (legacyProfile && url.pathname.includes('/rpc/hw_')) {
              return route.fulfill({
                status: 404,
                json: {
                  code: 'PGRST202',
                  message: 'Could not find the function in the schema cache',
                },
              });
            }

            if (url.pathname === '/auth/v1/token') body = session;
            else if (url.pathname === '/auth/v1/signup') {
              signups++;
              body = { user, session: null };
            } else if (url.pathname === '/auth/v1/user') body = user;
            else if (url.pathname.endsWith('rpc/hw_summary'))
              body = { todo: 0, next: null, submitted: null, pending: null };
            else if (url.pathname.endsWith('/rpc/announcement_feed'))
              body = { items: [], groups: [], can_publish_club: false };
            else if (url.pathname.endsWith('/rpc/hw_inbox'))
              body = {
                items: [],
                preferences: { due: true, feedback: true, grading: true },
              };
            else if (url.pathname.includes('rpc/review_membership')) {
              approved = true;
              body = null;
            } else if (url.pathname.endsWith('/profiles')) {
              if (route.request().method() === 'PATCH') {
                const update = route.request().postDataJSON();
                assert.equal(Object.hasOwn(update, 'name_zh'), !legacyProfile);
                assert.equal(Object.hasOwn(update, 'name_en'), !legacyProfile);
                saves++;
                body = { id: user.id };
              } else
                body = url.searchParams.has('id')
                  ? profile
                  : [{ ...profile, platform_roles: { role: 'member' } }];
            } else if (url.pathname.endsWith('/platform_roles'))
              body = { role };
            else if (url.pathname.endsWith('/memberships'))
              body = { status: 'active' };
            else if (url.pathname.endsWith('/club_settings'))
              body = { name: 'Campus Coding Club' };
            else if (url.pathname.endsWith('/membership_applications'))
              body = url.searchParams.has('user_id')
                ? { status: 'approved' }
                : approved
                  ? []
                  : [
                      {
                        id: '00000000-0000-4000-8000-000000000002',
                        created_at: '2026-11-16T00:00:00Z',
                        profiles: {
                          display_name: 'Jamie Lee',
                          student_id: '000002',
                          class_name: 'S1 Science',
                        },
                      },
                    ];
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(body),
            });
          },
        );
        const click = (name) =>
          page.getByRole('button', { name, exact: true }).click();
        const settle = () =>
          page.waitForFunction(() => {
            const surfaces = Array.from(
              document.querySelectorAll(
                '[data-testid="screen-content"], [data-testid="motion-card"]',
              ),
            ).filter((el) => el.getClientRects().length);
            return (
              surfaces.length > 0 &&
              surfaces.every((el) => getComputedStyle(el).opacity === '1')
            );
          });
        const snapshot = async (name) => {
          await settle();
          await page.screenshot({
            path: path.join(output, `${size.name}-${scheme}-${name}.png`),
            fullPage: true,
          });
          assert(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `horizontal overflow: ${size.name}/${name}`,
          );
          assert(
            await page.evaluate(() =>
              Array.from(document.querySelectorAll('[role="tab"] *'))
                .filter(
                  (el) =>
                    el instanceof HTMLElement &&
                    el.childElementCount === 0 &&
                    el.textContent.trim(),
                )
                .every((el) => el.scrollWidth <= el.clientWidth),
            ),
            `truncated navigation: ${size.name}/${name}`,
          );
          checks++;
        };
        if (pages) {
          const recover = await page.goto(origin + basePath + '/recover');
          assert.equal(recover.status(), 200, 'recovery deep link resolves');
          await page
            .getByRole('heading', { name: 'Reset your password' })
            .waitFor();
          const members = await page.goto(origin + basePath + '/members');
          assert.equal(members.status(), 200, 'protected deep link resolves');
          await page.waitForURL(new RegExp(basePath + '/sign-in/?$'));
        }
        const home = await page.goto(origin + basePath + '/');
        assert.equal(home.status(), 200, 'home document resolves');
        await page
          .getByRole('button', { name: 'Sign in', exact: true })
          .waitFor();
        await settle();
        await click('切换至简体中文');
        await page.getByRole('heading', { name: '欢迎回来' }).waitFor();
        await page.waitForFunction(
          () => localStorage.getItem('microhub.language') === 'zh',
        );
        await page.reload();
        await page.getByRole('button', { name: '登录', exact: true }).waitFor();
        assert.equal(
          await page.locator('html').getAttribute('lang'),
          'zh-Hans',
        );
        await click('Switch to English');
        await page
          .getByRole('button', { name: 'Sign in', exact: true })
          .waitFor();
        await page
          .getByRole('radio', { name: 'dark appearance', exact: true })
          .click();
        await page.waitForFunction(
          () => localStorage.getItem('microhub.appearance') === 'dark',
        );
        const reload = await page.reload();
        assert.equal(
          reload.status(),
          200,
          'refresh resolves the current route',
        );
        if (pages)
          assert(new URL(page.url()).pathname.startsWith(basePath + '/'));
        await page
          .getByRole('radio', { name: 'dark appearance', exact: true })
          .waitFor();
        await page.waitForFunction(
          () =>
            document
              .querySelector('[aria-label="dark appearance"]')
              ?.getAttribute('aria-checked') === 'true',
        );
        await page
          .getByRole('radio', { name: 'system appearance', exact: true })
          .click();
        await settle();
        const emailInput = page
          .getByLabel('School email', { exact: true })
          .filter({ visible: true });
        const passwordInput = page
          .getByLabel('Password', { exact: true })
          .filter({ visible: true });
        const fieldBackground = () =>
          emailInput.evaluate((el) => getComputedStyle(el).backgroundColor);
        const originalBackground = await fieldBackground();
        await page.emulateMedia({
          colorScheme: scheme === 'light' ? 'dark' : 'light',
        });
        await page.waitForFunction(
          ({ el, original }) =>
            getComputedStyle(el).backgroundColor !== original,
          {
            el: await emailInput.elementHandle(),
            original: originalBackground,
          },
        );
        await page.emulateMedia({ colorScheme: scheme });
        await page.waitForFunction(
          ({ el, original }) =>
            getComputedStyle(el).backgroundColor === original,
          {
            el: await emailInput.elementHandle(),
            original: originalBackground,
          },
        );
        await emailInput.press('Enter');
        assert(
          await passwordInput.evaluate((el) => el === document.activeElement),
          'email Next focuses password',
        );
        await passwordInput.fill('Example123');
        await page.setViewportSize({
          width: size.width < 1024 ? 1280 : 390,
          height: size.height,
        });
        await settle();
        assert.equal(
          await passwordInput.inputValue(),
          'Example123',
          'auth draft survives breakpoint change',
        );
        await page.setViewportSize(size);
        await settle();
        const eye = page.getByRole('button', {
          name: 'Show password',
          exact: true,
        });
        // The web viewport resizes before React Native commits the new breakpoint.
        // Check both rectangles in the same frame after that responsive layout lands.
        await page.waitForFunction(
          ({ toggle, field }) => {
            const eye = toggle.getBoundingClientRect(),
              input = field.getBoundingClientRect();
            return (
              eye.width >= 44 &&
              eye.height >= 44 &&
              eye.left >= input.left &&
              eye.right <= input.right + 1 &&
              eye.top >= input.top &&
              eye.bottom <= input.bottom + 1
            );
          },
          {
            toggle: await eye.elementHandle(),
            field: await passwordInput.elementHandle(),
          },
        );
        const holdEye = async (reduced) => {
          await page.emulateMedia({
            reducedMotion: reduced ? 'reduce' : 'no-preference',
          });
          await settle();
          await eye.scrollIntoViewIfNeeded();
          const eyeBox = await eye.boundingBox();
          await page.mouse.move(
            eyeBox.x + eyeBox.width / 2,
            eyeBox.y + eyeBox.height / 2,
          );
          await page.mouse.down();
          if (reduced) {
            // Sample the whole press interval; a single first-frame check could miss motion.
            const stable = await eye.evaluate(async (el) => {
              const start = performance.now();
              while (performance.now() - start < 180) {
                await new Promise(requestAnimationFrame);
                if (
                  Math.abs(
                    new DOMMatrixReadOnly(getComputedStyle(el).transform).a - 1,
                  ) > 0.001
                )
                  return false;
              }
              return true;
            });
            assert(stable, 'reduced motion disables press scaling');
          } else {
            await page.waitForFunction(
              (el) =>
                new DOMMatrixReadOnly(getComputedStyle(el).transform).a < 0.98,
              await eye.elementHandle(),
            );
          }
          await page.mouse.up();
          await page.waitForFunction(
            (el) => el.type === 'text',
            await passwordInput.elementHandle(),
          );
          assert.equal(await passwordInput.evaluate((el) => el.type), 'text');
          assert.equal(await passwordInput.inputValue(), 'Example123');
          await click('Hide password');
          await page.waitForFunction(
            (el) => el.type === 'password',
            await passwordInput.elementHandle(),
          );
          assert.equal(
            await passwordInput.evaluate((el) => el.type),
            'password',
          );
        };
        await holdEye(false);
        await holdEye(true);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await passwordInput.fill('');
        await passwordInput.blur();
        await page.mouse.move(0, 0);
        await snapshot('sign-in');
        await click('Create a school account');
        await page.getByText('Join your club', { exact: true }).waitFor();
        await page
          .getByLabel('School email', { exact: true })
          .filter({ visible: true })
          .fill(user.email);
        await page
          .getByLabel('Password (8–128 characters)', { exact: true })
          .filter({ visible: true })
          .fill('short');
        await click('Create account');
        await page.getByRole('alert').waitFor();
        assert.equal(signups, 0);
        await snapshot('registration-error');
        await page
          .getByLabel('Password (8–128 characters)', { exact: true })
          .filter({ visible: true })
          .fill('Example123');
        await page
          .getByLabel('Password (8–128 characters)', { exact: true })
          .filter({ visible: true })
          .press('Enter');
        await page
          .getByLabel('Verification code', { exact: true })
          .filter({ visible: true })
          .waitFor();
        assert.equal(signups, 1);
        const code = page
          .getByLabel('Verification code', { exact: true })
          .filter({ visible: true });
        await code.fill('123 456');
        assert.equal(
          await code.inputValue(),
          '123456',
          'pasted verification code normalized',
        );
        await code.fill('');
        await code.blur();
        await snapshot('verification');
        await click('Back to sign in');
        await page
          .getByLabel('School email', { exact: true })
          .filter({ visible: true })
          .fill(user.email);
        await page
          .getByLabel('Password', { exact: true })
          .filter({ visible: true })
          .fill('Example123');
        await click('Sign in');
        await page.getByText('Welcome back, Alex!', { exact: true }).waitFor();
        await page
          .getByRole('button', { name: 'Meet the members', exact: true })
          .waitFor();
        await snapshot('home');
        assert.equal(
          await page.getByTestId('desktop-sidebar').count(),
          size.width >= 1024 ? 1 : 0,
        );

        assert.equal(
          await page
            .getByRole('button', {
              name: 'Review membership applications',
              exact: true,
            })
            .count(),
          0,
        );
        await click('My profile');
        await page
          .getByLabel(nameLabel, { exact: true })
          .filter({ visible: true })
          .fill('Alex Tan');
        const nameField = page
          .getByLabel(nameLabel, { exact: true })
          .filter({ visible: true });
        await nameField.fill('Alex Draft');
        await page
          .getByRole('button', { name: '切换至简体中文', exact: true })
          .filter({ visible: true })
          .click();
        assert.equal(
          await page
            .getByLabel(legacyProfile ? '全名' : '英文姓名', { exact: true })
            .filter({ visible: true })
            .inputValue(),
          'Alex Draft',
        );
        await page
          .getByRole('button', { name: 'Switch to English', exact: true })
          .filter({ visible: true })
          .click();
        await page.setViewportSize({
          width: size.width < 1024 ? 1280 : 390,
          height: size.height,
        });
        await settle();
        assert.equal(
          await nameField.inputValue(),
          'Alex Draft',
          'profile draft survives breakpoint change',
        );
        await page.setViewportSize(size);
        await settle();
        assert.equal(
          await nameField.inputValue(),
          'Alex Draft',
          'profile draft survives return to original width',
        );
        await nameField.fill('Alex Tan');
        if (!legacyProfile) {
          await page
            .getByLabel('Chinese name', { exact: true })
            .filter({ visible: true })
            .fill('陈俊杰');
        }
        await click('Save profile');
        await page.getByText('Profile saved.', { exact: true }).waitFor();
        assert.equal(saves, 1);
        await snapshot('profile');
        await click('Back to home');
        await click('Meet the members');
        await page.getByText('Alex Tan', { exact: true }).waitFor();
        await snapshot('members');
        await click('Back to home');
        await click('Assignment workspace');
        if (legacyProfile) {
          await page
            .getByRole('alert')
            .filter({ hasText: 'Homework is not available yet.' })
            .waitFor();
        } else {
          await page
            .getByText('You have no assignments to do.', { exact: true })
            .waitFor();
        }
        await snapshot('assignments');
        await click('My submissions');
        await page
          .getByRole('heading', { name: 'My submissions', exact: true })
          .waitFor();
        await click('Back to home');
        for (const [button, heading] of [
          ['Attendance', 'See you at the next meeting'],
          ['Club announcements', 'No announcements on this page.'],
          ['Your club calendar', 'Good things are on the calendar'],
          [
            'Notifications',
            legacyProfile
              ? 'Homework is not available yet.'
              : 'Homework reminders',
          ],
        ]) {
          await click(button);
          if (legacyProfile && button === 'Notifications')
            await page
              .getByRole('alert')
              .filter({ hasText: heading })
              .waitFor();
          else await page.getByText(heading, { exact: true }).waitFor();
          await snapshot(button.toLowerCase().replaceAll(' ', '-'));
          await click('Back to home');
        }
        // Native tab items are web links.
        if (size.width >= 1024)
          await page
            .getByRole('link', { name: 'Go to More', exact: true })
            .click();
        else await page.getByRole('tab', { name: /More/ }).click();
        await page
          .getByRole('button', { name: 'Settings', exact: true })
          .waitFor();
        assert.equal(
          await page
            .getByRole('button', { name: 'Administration', exact: true })
            .count(),
          0,
        );
        await snapshot('more');
        await click('Settings');
        await page
          .getByText('Appearance & language', { exact: true })
          .waitFor();
        await snapshot('settings');
        await click('Back to More');
        await click('Resources');
        await page
          .getByText('Room for your next big idea', { exact: true })
          .waitFor();
        await snapshot('resources');
        await click('Back to home');
        // Role variation is restricted to this browser's intercepted HTTP fixture.
        role = 'admin';
        if (size.width >= 1024)
          await page
            .getByRole('link', { name: 'Go to More', exact: true })
            .click();
        else await page.getByRole('tab', { name: /More/ }).click();
        await click('Administration');
        await page.getByText('Jamie Lee', { exact: true }).waitFor();
        await snapshot('administration');
        await click('Decline application');
        await page.getByText('Decline application?', { exact: true }).waitFor();
        await page.waitForFunction(
          () => document.activeElement?.textContent === 'Cancel',
        );
        const confirmFocus = page
          .getByRole('button', { name: 'Confirm', exact: true })
          .and(page.locator(':focus'));
        const cancelFocus = page
          .getByRole('button', { name: 'Cancel', exact: true })
          .and(page.locator(':focus'));
        await page.keyboard.press('Tab');
        await confirmFocus.waitFor();
        await page.keyboard.press('Tab');
        await cancelFocus.waitFor();
        await page.keyboard.press('Shift+Tab');
        await confirmFocus.waitFor();
        await page.keyboard.press('Escape');
        await page
          .getByText('Decline application?', { exact: true })
          .waitFor({ state: 'hidden' });
        assert.equal(
          approved,
          false,
          'cancel leaves the application unchanged',
        );
        await click('Approve membership');
        await page.getByText('All caught up', { exact: true }).waitFor();
        assert(approved);
        await context.close();
        console.log(`Checked ${size.name} ${scheme}`);
      }
    }
    assert.deepEqual(errors, [], 'browser runtime errors');
    console.log(
      `Passed: ${checks} viewport/screen checks, animated press + live reduced motion, inline password eye, keyboard signup + code paste, registration validation + verification transition, profile save, member-only navigation, admin approval; no browser errors. HTTP responses are fixtures.`,
    );
  } finally {
    await browser.close();
    server.close();
  }
}
main().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
