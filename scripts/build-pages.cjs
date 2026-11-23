// Node 24 can load the same public configuration validator as the app.
const { readPublicConfig } = require('../src/lib/config.ts');
const { execFileSync } = require('node:child_process');
const {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const output = path.resolve(process.argv[2] ?? 'dist/pages');
const { error } = readPublicConfig(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
if (error) {
  console.error(
    'GitHub Pages requires a Supabase project URL and public client key.',
  );
  console.error(error);
  process.exit(1);
}

execFileSync(
  process.execPath,
  [
    require.resolve('expo/bin/cli'),
    'export',
    '--platform',
    'web',
    '--output-dir',
    output,
  ],
  {
    stdio: 'inherit',
    env: { ...process.env, EXPO_NO_DOTENV: '1', MICROHUB_GITHUB_PAGES: '1' },
  },
);

// The web app reads auth and appearance in the browser. Publish its client
// entry at each Expo route so direct visits work on a static file host.
const app = path.resolve('app');
const entry = path.join(output, 'index.html');
const favicon = readFileSync(path.join(output, 'favicon.ico'));
const revision = createHash('sha256')
  .update(favicon)
  .digest('hex')
  .slice(0, 12);
const html = readFileSync(entry, 'utf8');
const iconHref = 'href="/MicroHub/favicon.ico"';
if (!html.includes(iconHref))
  throw new Error('Expo favicon link is missing from the Pages entry.');
writeFileSync(
  entry,
  html.replace(iconHref, `href="/MicroHub/favicon.ico?v=${revision}"`),
);
const routes = new Set();
for (const file of readdirSync(app, { withFileTypes: true, recursive: true })) {
  if (!file.isFile() || !file.name.endsWith('.tsx')) continue;
  const name = file.name.slice(0, -'.tsx'.length);
  if (name.startsWith('_') || name.startsWith('+')) continue;
  const segments = path.relative(app, file.parentPath).split(path.sep);
  if (name !== 'index') segments.push(name);
  const route = segments.filter(
    (segment) => segment && !segment.startsWith('('),
  );
  if (route.some((segment) => segment.includes('['))) {
    throw new Error(
      'Dynamic Expo routes require a route-specific GitHub Pages build strategy.',
    );
  }
  if (route.length) routes.add(path.join(...route));
}
for (const route of routes) {
  const folder = path.join(output, route);
  mkdirSync(folder, { recursive: true });
  copyFileSync(entry, path.join(folder, 'index.html'));
}
copyFileSync(entry, path.join(output, '404.html'));
writeFileSync(path.join(output, '.nojekyll'), '');
