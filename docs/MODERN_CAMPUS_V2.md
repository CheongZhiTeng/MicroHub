# Modern Campus v2 — mobile and desktop

Implemented from foundation `536cb51` on `codex/modern-campus-v2`. The user selected a youthful campus style, teal branding with colored accents, light/dark/system appearance, and the same private club application on school computers. This branch is for review; it is not merged automatically.

## Shared architecture

Expo Router and React Native Web remain the shared client. Native and web use the same Supabase project, Auth, profiles, roles, memberships and RLS. No database migrations or account changes are introduced. Web authentication remains memory-only for shared computers; refresh requires signing in again. Appearance is the only new local preference.

`src/theme/provider.tsx` resolves system/light/dark, listens through the platform color-scheme hook and persists an explicit preference in localStorage (web) or existing SecureStore (native). Reads cannot overwrite a more recent user choice; native writes are serialized; storage failures preserve the current session choice. `app.json` uses automatic appearance and the SDK-matched `expo-system-ui` plugin so native builds apply the setting. Status bars, navigation, fields, notices and cards use semantic colors.

The responsive shell is mounted around the routed stack so desktop navigation remains visible on member, profile and administration pages. Navigation links use real Expo links, preserve paths and apply active states. The routed subtree stays mounted when crossing breakpoints, preserving unsaved form values. The sidebar exposes member/admin links only for the corresponding active identity; existing route and database authorization remain authoritative.

## Layout and components

- Below 640: single-column content and five bottom destinations. Controls retain at least 44-point touch targets.
- 640–1023: fluid two-column dashboard content and bounded forms; bottom navigation remains.
- 1024+: 232-point sidebar with native safe-area insets, hidden bottom tabs, desktop authentication split layout and horizontal member/application rows. Main content is bounded at 1440; authentication forms at 440.
- Teal actions, navy text, mint surfaces, purple/blue/orange accents; deep navy surfaces with readable lighter accents in dark appearance. System fonts, 16-point body text and 12-point supporting labels; compact bottom navigation retains 10-point labels at narrow widths.
- `Button` now uses `variant="primary|secondary|ghost|danger"`, `disabled`, `busy` and `fullWidth`. Old boolean variants were migrated. Secondary navigation uses quiet links; authentication keeps a prominent primary action.
- Inputs support hints/errors and focused states; passwords use a 44-point in-field eye, preserve value/focus, expose current/new password autofill and retain the existing 8–128-character letter/digit rule.
- ThemePicker, ContentGrid and ConfirmDialog are reusable building blocks. Declining an application requires confirmation. Web dialog focus starts on Cancel, cycles within actions, supports Escape and restores the prior focus. Busy requests cannot be dismissed.
- Loading uses static skeleton bars plus a labelled progress indicator. Page entrances use 220 ms fades and 8-point movement, press/release feedback and keyboard focus outlines. System reduced motion removes decorative movement. No animation library was added.
- `/design-system` is a development-only component studio with theme controls, buttons, fields, notices, loading and a working sample dialog. Production exports redirect it to the home route.

## Future feature layout contract

Use Screen/AppShell for all new pages. Use compact NavigationRow/list rows for collections, ContentGrid for independent summaries, Card for a bounded task/detail section, Field/PasswordField for input and Notice for persistent errors. Only the primary action should be prominent. Preserve role gates and genuine loading/empty states. Homework, attendance, events and other availability screens remain unfinished business functionality; never substitute demo records into the production client.

## Verification

Run `npm run check` and export Android/iOS/Web. `scripts/visual-check.cjs` checks five viewport widths (320, 390, 820, 1280, 1440) in both OS appearances, including theme persistence after reload, live system-theme changes, preservation of unsaved forms across mobile/desktop breakpoints, password visibility, reduced motion, keyboard signup, spaced verification codes, profile save, role-gated navigation, confirmation dialog keyboard behavior and admin approval. The runner uses isolated browser HTTP fixtures, not real accounts or hosted SMTP. Screenshots go to `docs/screenshots/modern-v2` when the following command is used:

```bash
EXPO_OFFLINE=1 EXPO_PUBLIC_SUPABASE_URL=https://microhub-preview.supabase.co EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_visual_review npx expo export --platform all --output-dir /tmp/microhub-modern
VISUAL_EXPORT_DIR=/tmp/microhub-modern VISUAL_OUTPUT_DIR=docs/screenshots/modern-v2 node scripts/visual-check.cjs
```

These are dummy values for an isolated export, never values to paste into `.env`. The runner requires Playwright and Chromium (available in this cloud environment). Actual mobile keyboards, Safari, physical devices and published-host routing require acceptance outside this environment. No production deployment is included.

## Codespaces preview

Stop the previous Expo terminal with its trash icon, open a new terminal, then:

```bash
git fetch origin
git switch codex/modern-campus-v2
git pull --ff-only origin codex/modern-campus-v2
npm install
npm run web -- --clear
```

Open forwarded port 8081. Use Settings → Appearance & language or the authentication page's theme selector. Resize a desktop browser to compare navigation. Keep the existing ignored `.env`; no SQL needs rerunning.

## Completed checks (2026-11-19)

- `npm run check`: TypeScript, ESLint and formatting passed; 72 component/flow tests and 5 web tests passed; all 14 PostgreSQL authorization scenarios passed (15 reported including the parent test).
- Expo production exports for Android, iOS and Web passed. The SDK-matched Expo System UI dependency supports native automatic appearance. Native configuration introspection confirmed `UIUserInterfaceStyle=Automatic` on iOS and `expo_system_ui_user_interface_style=automatic` on Android. Online compatibility metadata was unavailable; the dependency version was selected from the installed SDK’s bundled module table.
- The five-width, two-appearance browser matrix passed all 150 screen checks with no captured console/page errors. It also exercised live system-theme changes, persisted appearance, unsaved form retention across breakpoints, password eye behavior, reduced motion, registration and membership flows, and dialog Cancel/Tab/Escape behavior.
- After the safe-area adjustment, both desktop appearances passed another 30 screen checks.
- Rendered captures were visually inspected on phone, tablet and desktop, including dark-mode verification and member pages. Dark step indicators were corrected for contrast. This is a responsive adaptation of Modern Campus, not a claimed pixel-perfect reproduction of the original marketing mockup.
- Database schema, core identity/access/session logic and Supabase client configuration remain unchanged. Hosted mail delivery and physical iOS/Android behavior were not independently retested here.

## Rendered previews

These captures use fictional browser fixtures; they are not production member records.

- [Phone, light](screenshots/modern-v2/phone-light-home.png) · [Phone, dark](screenshots/modern-v2/phone-dark-home.png)
- [Desktop, light](screenshots/modern-v2/desktop-light-home.png) · [Desktop, dark](screenshots/modern-v2/desktop-dark-home.png)
- [Desktop sign-in](screenshots/modern-v2/wide-light-sign-in.png) · [Tablet verification](screenshots/modern-v2/ipad-dark-verification.png)

Primary implementation files: `src/theme/tokens.ts`, `src/theme/provider.tsx`, `src/components/{ui,motion,dashboard,app-shell,theme-picker,confirm-dialog,layout}.tsx`, root/tab layouts and existing account/member/admin/settings pages. `tests/theme.test.tsx` and `scripts/visual-check.cjs` cover the new appearance and responsive behavior. The only new dependency is `expo-system-ui ~58.0.7`, matching Expo 58; no migration changes.
