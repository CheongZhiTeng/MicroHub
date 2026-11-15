export function readPublicConfig(rawUrl?: string, rawKey?: string) {
  const url = rawUrl?.trim() ?? '';
  const key = rawKey?.trim() ?? '';
  if (!url || !key || url.includes('YOUR_PROJECT') || key.includes('YOUR_'))
    return {
      error:
        'Enter the Supabase Project URL and Publishable key in .env, then restart Expo.',
    };
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== 'https:' ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    )
      throw new Error();
    if (parsed.pathname !== '/')
      return {
        error:
          'Use the Supabase project root URL ending in .supabase.co. Remove /rest/v1/ or other paths, then restart Expo.',
      };
    if (key.startsWith('sb_secret_'))
      return {
        error:
          'Use a Publishable key, never a Supabase secret key, in the app environment.',
      };
    if (!key.startsWith('sb_publishable_')) {
      // Legacy anon JWTs are supported; reject service-role JWTs without logging them.
      const payload = JSON.parse(
        atob(key.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')),
      );
      if (payload.role !== 'anon') throw new Error();
    }
    return { url: parsed.origin, key, error: null };
  } catch {
    return {
      error:
        'Check the HTTPS Project URL and Publishable (or legacy anon) key in .env, then restart Expo.',
    };
  }
}
