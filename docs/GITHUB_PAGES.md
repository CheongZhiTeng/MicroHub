# MicroHub on GitHub Pages

The intended project URL is `https://cheongzhiteng.github.io/MicroHub/`. The website and the Expo app use the same Supabase project. The website bundles the project URL and the public client key. Access to accounts and club data is enforced by Supabase Auth and RLS.

## First deployment

1. Open [Settings → Pages](https://github.com/CheongZhiTeng/MicroHub/settings/pages) and choose **GitHub Actions** as the source. If Pages is unavailable for this repository's visibility and plan, decide on hosting before changing repository visibility.
2. Open [Settings → Secrets and variables → Actions → Variables](https://github.com/CheongZhiTeng/MicroHub/settings/variables/actions). Create these two **repository variables** using the values from the existing app's `.env` or the Supabase project dashboard.
   - `EXPO_PUBLIC_SUPABASE_URL` is the HTTPS project root URL.
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is the publishable key or the legacy `anon` key.
3. If the [github-pages environment](https://github.com/CheongZhiTeng/MicroHub/settings/environments) limits deployment branches, allow `codex/github-pages` in its deployment branch rules.
4. Open [Actions for the website branch](https://github.com/CheongZhiTeng/MicroHub/actions?query=branch%3Acodex%2Fgithub-pages), select **Deploy MicroHub website**, and choose **Re-run all jobs** for its latest run. Future pushes to `codex/github-pages` test, build and publish the site. The deployment job reports the final URL.

The build reuses the app's public configuration validator, which rejects a secret key or a legacy service role key. The website bundle is publicly served when the Pages site is public. Keep database, access token and SMTP credentials in their existing server settings.

## Verify the published site

- Open the homepage and directly visit `/MicroHub/sign-in/`, `/MicroHub/register/` and `/MicroHub/recover/`. Reload each page. Open `/MicroHub/members/` when signed out and confirm it takes you to sign-in.
- Sign in with an existing school account. Check that Safari on iPad, an Android browser and a desktop browser display the expected navigation and theme. A full reload clears the web login session by design for shared computers.
- Register and recover a test account using the six-digit codes. Current email templates show the code, and the user enters it in MicroHub. This flow does not need a new callback URL or changes to existing SMTP settings.
- Apply for membership on mobile with a test account. Approve it on the website with an administrator. Return to the mobile app or tap **Check application status**. Verify that the new member has access and that a regular member cannot open administration.
- Push a later website change to the deploy branch and verify the website updates after the workflow succeeds. Mobile builds are distributed separately. Changes to club data use the same Supabase tables with either client.

## Build and verify locally

With Node 24 and dependencies installed, load public configuration from an existing local `.env` using:

```bash
node --env-file=.env scripts/build-pages.cjs
```

The output is `dist/pages`. Only this build uses Expo Router's `/MicroHub` base path. The build creates a directory entry for every current page so GitHub Pages can serve deep links directly. The browser renders the application, including session-dependent pages and themes. New dynamic route files need a publishing strategy for their URL values.

The local browser suite can emulate directory routing under `/MicroHub/` using `VISUAL_GITHUB_PAGES=1`. For the fixture run, use the preview values described in [Modern Campus v2](MODERN_CAMPUS_V2.md) and point `VISUAL_EXPORT_DIR` at the Pages export. These checks do not contact the live Supabase project.
