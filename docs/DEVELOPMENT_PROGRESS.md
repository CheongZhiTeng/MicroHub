# Development progress

Updated 2026-11-15 (Asia/Kuala_Lumpur). Current phase: **MVP, increment 1 — identity and membership foundation**. MVP is not accepted or complete. No V1/V2 implementation has begun. Source requirements were fully extracted and all 76 items are preserved in FEATURE_MATRIX.md, including the inapplicable multi-club requirement.

## Implemented in this increment

- Expo SDK 58 / React Native 0.88 / React 19.3 / strict TypeScript / Expo Router; reusable mobile controls, five tabs, responsive width, keyboard-aware forms and explicit module availability messages.
- Real Supabase school-email signup, confirmation OTP, login, local logout, password recovery and global refresh-session sign-out after reset. Chunked native SecureStore persistence with serialized refresh/logout operations and foreground refresh; web uses in-memory sessions.
- Profile name/class editing, immutable student ID, active/suspended accounts; verified identity and membership gates.
- Membership applications, pending status, administrator approve/decline, searchable/paginated member roster. These call actual Supabase queries/RPCs; no production mock data exists.
- Seven normalized public tables with RLS/column grants, singleton club settings, separate roles/committee positions, audited role/status/configuration RPCs, transactional application review, one-time verified Super Admin bootstrap.
- Private Storage bucket defaults (object access deliberately unavailable until the attachment module); optional caller-authenticated Edge review function, typechecked but not deployed.
- Requirements/conflict analysis, architecture and full phased schema design, setup/deployment instructions, iPad Codespaces/Expo Go guide, GitHub Actions workflow and npm lockfile.

## Validation evidence

| Check                                                                               | Result / scope                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                                 | Passed, strict TypeScript for app and Jest tests                                                                                                                                                                                                                                         |
| `npm run lint`                                                                      | Passed; scoped effect annotations explain network-loading state synchronization                                                                                                                                                                                                          |
| `npm test`                                                                          | 23 native/component/flow tests plus 4 React Native Web regression tests; passed                                                                                                                                                                                                          |
| `npm run test:db`                                                                   | 12 behavioral PostgreSQL scenarios passed (13 reported tests including parent); actual migrations and bootstrap run in PGlite                                                                                                                                                            |
| `npm run format:check`                                                              | Passed after Prettier formatting                                                                                                                                                                                                                                                         |
| `npx expo export --platform all`                                                    | Android/iOS Hermes and web bundles exported successfully; not native binary/device execution                                                                                                                                                                                             |
| `npx expo install --check`                                                          | Offline bundled compatibility check passed; online Expo endpoint blocked by environment proxy                                                                                                                                                                                            |
| `deno check supabase/functions/review-membership/index.ts`                          | Passed                                                                                                                                                                                                                                                                                   |
| `npm audit`                                                                         | 0 high/critical; 29 moderate and 1 low transitive advisories in full dependency graph. Production-filtered graph reported 20 moderate and 1 low; Expo tooling/optional testing peers are included. Review upstream fixes before release. Do not force incompatible Expo/Jest downgrades. |
| Hosted Supabase/Auth/Storage/Edge/Realtime                                          | Not configured or tested; no project credentials supplied                                                                                                                                                                                                                                |
| Physical Android/iOS/iPad, Expo tunnel, visual/accessibility/performance acceptance | Not verified                                                                                                                                                                                                                                                                             |
| GitHub Actions                                                                      | Workflow prepared; no successful remote CI run claimed                                                                                                                                                                                                                                   |

Database scenarios cover first-admin bootstrap verification/single use, invalid school addresses, immutable identity, unverified denial, nonmember isolation, own-profile updates, role/status escalation denial, duplicate application idempotence, unauthorized reviews, approval/membership/audit atomicity, repeated review denial, last-admin guards, club update authorization, immediate suspension, rejected-application cooldown, immutable audit and RLS/grant coverage. The harness supplies only Supabase-owned auth/storage schemas; it does not simulate actual email delivery or Storage HTTP APIs. Multi-connection races still need hosted/local-stack integration tests.

## Remaining MVP work

1. Hosted acceptance of this module; complete club configuration/logo, invitation issuance/redemption, committee-position management, role/status/member-inactivation UI, avatars and generated Supabase schema types.
2. Assignments, attachments and private Storage policies/content validation; text/link/file/photo submission, status/history, grading and private feedback, basic statistics.
3. Secure six-digit attendance sessions, expiry/rate limiting/duplicate and concurrency protection, correction logs, personal records, server validation and authorized live roster.
4. Real academic/attendance dashboards and essential notification entry; complete MVP flow tests and internal build.

The Homework/Attendance tabs explicitly describe unfinished MVP modules; Events describes V1. They have no pretend records or inert action buttons. These destinations are navigation foundation, not completed features. Language/theme switching, communications, events, full notifications and all V2 extensions remain tracked and unstarted.

## Known limitations and risks

- Real Auth email/OTP/recovery, PostgREST embedded member queries, session lifecycle and complete signup-to-approval flows need staging/device acceptance. Frontend flow tests use controlled service responses; database authorization tests run real PostgreSQL.
- Registration confirmation must remain enabled in Supabase; SMTP and OTP templates must be configured. Backend format validation alone cannot establish ownership.
- No attachment uploads, signed URL handling, attendance logic or Realtime subscriptions are shipped. Bucket metadata tests are not Storage API security tests.
- No full administrative UI, Chinese translation, theme switcher, deletion workflow, backup/restore drill or native build. English copy centralization starts with navigation; remaining forms must move into locale dictionaries before V1 translation.
- Codespaces/tunnel depends on external provider availability. iPad handoff and accessibility have documented manual tests but no device evidence.
- Existing transitive dependency advisories need upstream resolution/review before production. No high/critical advisories were reported during this run.
- Auth email is intentionally immutable; school administrators must define account-ID correction and retention procedures. Suspensions retain history. There is no self-service account deletion yet.

## Manual configuration required

Create/configure a staging Supabase project; apply both migrations; set public environment values; enable confirmation and custom SMTP with OTP templates; bootstrap the intended verified Super Admin; agree school permission/privacy/retention policies. See SETUP.md. For iPad development publish this branch, open Codespaces, install dependencies and start Expo tunnel as documented. No secret/service role belongs in the client.

## GitHub status

Implementation commit `34a0826` is published on `codex/mvp-foundation`. Git push succeeded. Draft PR creation failed: the GitHub GraphQL API returned Forbidden, and `gh auth status` reported an invalid configured token. No PR was created and nothing was merged. Open [the prepared branch comparison](https://github.com/CheongZhiTeng/MicroHub/compare/main...codex/mvp-foundation?expand=1), use [PULL_REQUEST.md](PULL_REQUEST.md) as its description, review changes and CI, then merge through GitHub when ready. Keep the PR in draft until hosted/device acceptance for this increment is reviewed. A follow-up commit aligns Jest 30 with the Expo 58 test tooling and records this handoff.

## Recommended next Codex task

“Finish and verify the MVP membership module against my configured staging Supabase: exercise school signup/verification/recovery on Expo Go, bootstrap/approve a member, add tested invitation redemption and committee/club/role administration UI, generate schema types, and update the feature matrix. Keep V1/V2 unstarted.”

After that acceptance, implement private individual assignments and attachments as the next reviewable MVP increment. Do not start V1 until all essential MVP workflows have been reviewed and verified.

## 2026-11-15: Web preview repair

User screenshots confirmed Codespaces Web preview reaches the sign-in route, but React Native Web reports an empty text child inside View. Reproduced this exact error with the real React Native Web renderer for sign-in, signup, recovery and an empty optional subtitle. Converted string-valued JSX conditions to boolean conditions across the UI, preserving visible notices while omitting empty strings. Added four Web regression tests to the standard check command; they failed before the fix and pass afterward. No dependencies or database changes.

Screenshots separately show a global `window.ethereum.selectedAddress` error in Brave. No application code references ethereum; a browser-injected wallet script is suspected, not confirmed. Use Safari to isolate it. Do not add a fake wallet object or suppress global errors. Physical-device browser verification remains pending.

The user reports both initialization migrations succeeded and has configured Auth/SMTP/templates/public env values independently. These reports do not yet establish successful email delivery or complete hosted acceptance. Update Codespaces with `git pull --ff-only` on the existing branch and restart the Web preview; the ignored `.env` is preserved. Expo may independently update tsconfig.json include paths, so retain those local edits.
