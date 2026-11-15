import { readPublicConfig } from '../src/lib/config';
const url = 'https://example.supabase.co';
const key = 'sb_publishable_test';
test('trims public config without accepting API paths', () => {
  expect(readPublicConfig(` ${url}/ `, ` ${key} `)).toEqual({
    url,
    key,
    error: null,
  });
  expect(readPublicConfig(`${url}/rest/v1/`, key).error).toMatch(/Remove/);
});
test.each([
  'not-a-url',
  'https://',
  'http://example.supabase.co',
  'https://user:pass@example.supabase.co',
  'https://example.supabase.co?key=secret',
  'https://example.supabase.co#x',
])('rejects invalid project URL %s without throwing', (value) =>
  expect(readPublicConfig(value, key).error).toBeTruthy(),
);
test('rejects secret keys and service role JWTs', () => {
  expect(readPublicConfig(url, 'sb_secret_private').error).toBeTruthy();
  const jwt = (role: string) =>
    `header.${btoa(JSON.stringify({ role }))}.signature`;
  expect(readPublicConfig(url, jwt('service_role')).error).toBeTruthy();
  expect(readPublicConfig(url, jwt('anon')).error).toBeNull();
  expect(readPublicConfig(url, 'random').error).toBeTruthy();
});
