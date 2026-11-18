# MicroHub

A private Android/iOS application for **one school club**, built with Expo, React Native, TypeScript, Expo Router and Supabase. Designed for development from an iPad through GitHub Codespaces.

**Status: initial MVP foundation, not a complete MVP or production release.** This increment implements real Supabase authentication and membership flows. Homework, attendance and full dashboards are upcoming MVP modules; navigation describes their status without sample data. V1/V2 implementation has not begun.

## Start

Use Node 24.3+ (Node 24 LTS). Configure a Supabase staging project using [SETUP.md](docs/SETUP.md), then:

```sh
npm install
cp .env.example .env
# Edit .env with the two public Supabase values.
npx expo start --tunnel
```

On the same iPad, open the terminal's `exp://` URL in Expo Go. Follow the complete [Codespaces and Expo Go guide](docs/EXPO_TESTING.md). Expo Go must support SDK 58. No credentials are included; without configuration the app shows setup instructions.

## Included

- School email registration and confirmation OTP, login/logout, password recovery, native secure session persistence.
- Profile name/class editing, student ID extraction, membership applications, admin approval/decline, searchable member directory.
- Singleton club configuration, separate technical roles and committee positions, backend suspension and role-management RPCs, one-time Super Admin bootstrap.
- PostgreSQL migrations, per-table RLS, column grants, audited privileged functions, deny-by-default private Storage bucket and optional authenticated Edge review endpoint.
- Five-tab navigation, reusable accessible controls, responsive layout, loading/error/empty states, dependency lockfile, Codespaces configuration and CI workflow.

Role/configuration management currently has checked backend RPCs; its full UI, invitations, avatars and committee management are remaining MVP work. All 76 original requirements remain tracked.

## Documentation

- [Feature matrix and conflicts](docs/FEATURE_MATRIX.md)
- [Architecture and MVP sequence](docs/ARCHITECTURE.md)
- [Database design and security boundaries](docs/DATABASE.md)
- [Setup, migrations, Auth templates and bootstrap](docs/SETUP.md)
- [iPad / Expo Go testing and development builds](docs/EXPO_TESTING.md)
- [Debugging audit and current fixes](docs/DEBUG_AUDIT.md)
- [Development progress, evidence and limitations](docs/DEVELOPMENT_PROGRESS.md)
- [Full extracted source document](docs/SOURCE_REQUIREMENTS.zh-CN.txt)

## Checks

```sh
npm run check
npx expo export --platform all
npx expo install --check
deno check supabase/functions/review-membership/index.ts
```

Unit/component/flow tests use Jest; database security tests run the actual migrations in PGlite PostgreSQL. Supabase-owned auth/storage fixtures exist only in the test harness. No test fixtures are served to the application. Hosted Supabase, email delivery and physical-device acceptance require separate tests before rollout. Do not disable RLS or commit secrets to get started.

### Modern Campus visual redesign

The reference-based interface from `codex/ui-redesign` is now integrated into `codex/mvp-foundation` with colorful surfaces, reduced-motion-aware animations and refined account forms (inline password eye, live rules and keyboard submission). See [design decisions, rendered screenshots and preview instructions](docs/UI_REDESIGN.md). Future-module availability pages do not imply completed backend features.
