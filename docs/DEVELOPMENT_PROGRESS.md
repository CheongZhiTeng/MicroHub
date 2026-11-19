# Development progress

## Homework MVP A · database checkpoint · 2026-11-19

- Branch `codex/homework-mvp-a` started from `366e9a4`. The remote Pages branch was verified at `202636e`.
- Implemented active-recipient snapshots, private synced drafts, immutable submission receipts, revision checks, staff-only grading drafts, append-only released feedback, separate revision grants and caller-scoped list/roster/count queries. All write paths serialize on the assignment or recipient and recheck permissions.
- Migration ledger addition: `202611190001_homework.sql` executed with both foundation migrations in a fresh local PGlite PostgreSQL database. Six homework scenarios passed (seven results including parent). Hosted history is unverified. This workspace has no linked project or database credentials; no hosted migration or Pages deployment was run.
- Next checkpoint: connect the existing Expo routes and dashboard, exercise mobile/desktop browser sessions, and verify real overlapping transactions. Files, photos and the remaining MVP B/V1 requirements stay in the original specification.

## Previous checkpoint · 2026-11-19 (Asia/Kuala_Lumpur)

- **Baseline:** `codex/github-pages` at `202636e` before this documentation checkpoint. The approved Modern Campus v2 interface and the GitHub Pages deployment are on this branch.
- **Completed:** Identity, profile, member directory, membership application and review, responsive design, theme switching, Pages build and deployment. The user confirmed the site opens and approved the style. GitHub Actions run [44508677772](https://github.com/CheongZhiTeng/MicroHub/actions/runs/44508677772) passed its live homepage and sign-in checks.
- **Remaining:** The homework route is an availability screen. Homework MVP A has not started. Real two-account cross-device homework acceptance is pending, as are later homework batches, attendance and other roadmap items. The user has previously reported hosted verification, login and initial administrator bootstrap. That evidence is separate from fixture tests and hosted migration-history verification.
- **Technical decisions:** Expo and GitHub Pages share the same Supabase project and UI. Use the [homework specification](HOMEWORK_SPEC.md) with the [original source requirements](SOURCE_REQUIREMENTS.zh-CN.txt) and [feature matrix](FEATURE_MATRIX.md). Preserve the existing Auth, role and RLS boundaries. The development and recovery procedure lives in [AGENTS.md](../AGENTS.md).
- **Verification baseline:** The Pages increment passed `npm run check` (77 app tests and 14 PostgreSQL scenarios, 15 results including the parent); 60 browser checks used HTTP fixtures. Live Pages verification checked the served Expo assets. The documentation checkpoint runs formatting and diff checks; it does not change runtime code.
- **Next concrete step:** When homework implementation is requested, start from the verified Pages baseline on a feature branch. Inspect existing authorization and migrations, then implement the MVP A data model with role and privacy tests.

### Migration ledger

| Version and file                       | In Git    | Local evidence                                | Hosted status                                                                                                    |
| -------------------------------------- | --------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `202611140001_identity_membership.sql` | Committed | Included in previously passing database suite | User reported running the setup SQL and successful identity flows. Exact migration history has not been queried. |
| `202611140002_private_storage.sql`     | Committed | Included in previously passing database suite | Exact migration history and hosted storage configuration are unverified.                                         |

No hosted migration was executed for this checkpoint. Before applying any future migration, inspect the intended Supabase project's recorded versions (for example via `supabase migration list --linked` if authorized and correctly linked). If setup SQL was run manually, compare the relevant schema with its migration before acting on a missing version entry.

## Historical progress

Foundation snapshot from 2026-11-17 (Asia/Kuala_Lumpur). Current phase: **MVP, increment 1 — identity and membership foundation**. MVP is not accepted or complete. No V1/V2 business functionality has begun; the UI branch includes clearly marked availability screens for future modules. Source requirements were fully extracted and all 76 items are preserved in FEATURE_MATRIX.md, including the inapplicable multi-club requirement.

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
| `npm test`                                                                          | 70 native/component/flow tests plus 5 React Native Web tests, including actual DOM clicks; passed                                                                                                                                                                                        |
| `npm run test:db`                                                                   | 14 behavioral PostgreSQL scenarios passed (15 reported tests including parent); actual migrations and bootstrap run in PGlite                                                                                                                                                            |
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

## 2026-11-16: Full foundation debugging review

Reviewed every application route, shared component/hook/library, migration, bootstrap script, Edge entry point and project/CI configuration. Scope, confirmed fixes and evidence are in [DEBUG_AUDIT.md](DEBUG_AUDIT.md). User screenshot showed a rejected short password, not an inert Create button; its message was incorrectly styled as success. The user changed the minimum password length to eight with at least one letter and digit. Hosted Supabase must be changed manually to match; no schema migration is needed.

Repaired error/success presentation; added password visibility/count feedback, resumed OTP verification and new recovery-code request paths; guarded duplicate actions and network deadlines; retained recovery completion when sign-out fails; validated public configuration before client creation; protected account-switch display and directory queries against stale state; fixed repeated search and punctuation; preserved secure-store cleanup metadata and Unicode chunks; made Edge payload/auth failures bounded and explicit. Checks passed: strict types, lint, 60 native tests, 5 Web tests, 14 PostgreSQL scenarios, 6 Edge tests, Edge typecheck, formatting, all-platform exports. No real school registration, email delivery or physical-device success is claimed. No V1/V2 work was started.

## 2026-11-16: Modern Campus UI branch

`codex/ui-redesign` restyles the existing application from the supplied Modern Campus reference. Shared tokens, professional SVG icons, original campus/study illustrations, rounded cards and mint active navigation cover auth, dashboard, profile, directory, admin review and module availability screens. Actual identity fields replace the reference’s fictional statistics; unfinished modules remain explicitly unavailable. No schema, Auth/session or permission changes; no V1/V2 business feature is marked complete.

Validation: 66 native/unit/component tests, 5 Web tests, 14 database scenarios, types/lint/format and Android/iOS/Web exports. Browser interaction/screenshot coverage at three viewport sizes uses isolated HTTP fixtures; hosted SMTP and physical-device acceptance remain pending. See [UI_REDESIGN.md](UI_REDESIGN.md) for comparison evidence and Codespaces branch instructions.

Next: user visual review on the UI branch, then resume hosted email/identity acceptance. Preserve the original feature branch until the user approves a merge.

## 2026-11-17: accessible motion and account-form refinement

Continued on the isolated `codex/ui-redesign` branch. Added reusable entrance/press animations with live system reduced-motion support, brighter shared surface tokens, colored dashboard summaries and module accents, and an illustration column that keeps text unobstructed. Refined the inline password eye/focus, live password-rule feedback, signup progress, keyboard submission and pasted verification/recovery codes. Existing authentication, authorization, account records and database schema are preserved. No dependencies were added in this follow-up.

Validation: 70 native/unit/flow tests and 5 Web tests, 14 PostgreSQL scenarios (15 reported tests), strict TypeScript, ESLint and formatting; all-platform Expo exports. Browser checks cover 45 screens/viewports, rendered press scaling and reduced-motion switching, inline eye placement/value preservation, keyboard signup and pasted verification codes, plus existing profile, member and admin flows. Browser responses are isolated fixtures; this is not hosted email delivery or physical-device evidence.

Next: preview this branch on the user's iPad/Android, review animation and keyboard behavior with accessibility settings, then resolve hosted SMTP and complete real signup/approval acceptance. Neither the original foundation branch nor `main` is merged by this work.

## UI integration review

The user requested an error check and integration. Reviewed UI tip `e012fa1` against foundation tip `230ba27`, then merged `codex/ui-redesign` into `codex/mvp-foundation` with a merge commit. The branches had no conflicts or intervening remote changes. The UI branch is retained; `main` remains unchanged.

Fresh validation passed: `npm run check` (70 native/unit/flow tests, 5 Web tests, 14 PostgreSQL scenarios / 15 reported tests, TypeScript, ESLint, formatting), Android/iOS/Web exports, and 45 browser screen/viewport checks with registration, inline password eye, reduced motion, profile, member navigation and admin approval. No blocking regression was identified in the reviewed scope. Database migrations and core identity/session/access modules match the pre-redesign foundation. See [INTEGRATION_REVIEW.md](INTEGRATION_REVIEW.md).

Continue development and preview from `codex/mvp-foundation`. Hosted SMTP, real end-to-end school-account flows and physical-device acceptance remain outstanding; the MVP is still incomplete.

## Modern Campus v2: responsive design system

Implemented on `codex/modern-campus-v2` from `536cb51`, pending user visual acceptance and merge. Added light/dark/system appearance with local preference persistence, theme-aware shared controls, compact action variants, desktop sidebar, authentication split layout, dashboard grid, responsive member/application rows, confirmation dialog, keyboard focus treatment, loading skeletons and a development-only component studio. No schema or core Auth/RLS change. The user explicitly brought appearance switching forward from V1; translations and other V1/V2 business features remain deferred. See [MODERN_CAMPUS_V2.md](MODERN_CAMPUS_V2.md).

The user has reported successful hosted verification-email delivery, login and first Super Admin bootstrap. Those are user-reported checks; this environment's browser tests still use fixtures. Ordinary-member real-device acceptance and full hosted end-to-end testing remain pending.

Validation for this branch: TypeScript/ESLint/formatting, 77 application tests, 14 PostgreSQL authorization scenarios, all three platform exports, and 150 browser screen checks across five widths and light/dark appearance passed. Browser flows use isolated fixtures. Live theme switching, unsaved form retention across breakpoints, and keyboard confirmation behavior are included. Rendered screenshots and reproduction steps are linked in the v2 design document.
