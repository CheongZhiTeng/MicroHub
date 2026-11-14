# Setup and deployment

This is the first MVP increment. You need a GitHub account, a Supabase project owned by the school/club, and access to the official school inbox. No hosted project was configured by Codex.

## Local project

Use Node 24.3+ (Node 24 LTS) and npm. Open this repository, run `npm install`, copy `.env.example` to `.env`, and set:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Both are public client values from Project Settings → API. A legacy anon key also works. Never put a service_role/secret key, database password, SMTP credential or access token in any EXPO_PUBLIC variable. `.env` is ignored by Git. If variables are absent, the app shows setup guidance rather than fabricated club data. Restart Metro after changing them.

## Supabase schema and Auth

1. Create a fresh Supabase project. Save database credentials in a password manager, not this repository. Apply migrations only after checking existing project data; the identity trigger rejects non-school accounts. For a fresh project run the two files in `supabase/migrations/` in filename order in SQL Editor, or use the CLI below. Do not reset an existing remote database.
2. In Authentication settings, enable email/password signup and **Confirm email**. Disable anonymous sign-ins, phone signup, public OAuth providers and unused auth providers. Set minimum password length to 12. Configure OTP length 6, expiry 600 seconds, and email resend interval at least 60 seconds. Configure Auth rate limits and CAPTCHA for production abuse protection as appropriate to school policy.
3. Configure custom SMTP and test delivery to `foonyewsa.edu.my`. Supabase's default mail service may restrict recipients and volume and is unsuitable for club rollout. Confirm with the school that student mailboxes can receive verification messages.
4. In **Confirm signup** email template, include `Your MicroHub verification code is {{ .Token }}`. In **Reset password** template include `Your MicroHub recovery code is {{ .Token }}`. Keep valid HTML and the standard surrounding template fields. The app calls verifyOtp with `signup` or `recovery`; do not send only a default web verification link. For this build the email code is entered into the app; no callback route is required or implemented.
5. Set Site URL to the school's chosen HTTPS support/landing page for production. Local config uses `http://localhost:8081`. `microhub://auth/callback` is a reserved redirect URL for a future development-build callback, **not** an implemented link handler. Do not switch templates to links until a callback route and PKCE tests exist. If future Expo Go deep-link testing is added, allow its exact current `exp://<tunnel>/--/auth/callback` URL and remove it afterward; avoid broad production wildcards.
6. The migration's auth.users trigger enforces school-email registration on the trusted backend and prevents email identity changes. Test one valid and one invalid direct Auth request in staging. Matching format does not bypass confirmation or membership.
7. Sign up the intended Super Admin in the app, verify the emailed code, and save their name/class. Run `supabase/bootstrap-super-admin.sql` manually in SQL Editor after replacing the single email placeholder. It requires verified ownership, permits only the first bootstrap, and writes an audit event. Refresh the app. Never elevate roles from client metadata or a public bootstrap endpoint.
8. Test another verified student's application and administrator approval. Only active members can read the club roster/configuration. Admin cannot assign technical roles; Super Admin uses the checked RPC below until the management UI is completed.

Trusted SQL Editor examples for an already-authorized operator: to configure the club, use the app's user JWT to call `update_club(p_name,p_description)` through Supabase RPC; to manage role/status call `admin_set_account(p_user_id,p_role,p_status)`. These RPCs require authenticated Super Admin context: raw SQL Editor sessions have no auth.uid and will correctly fail. For emergency recovery use a reviewed project-owner transaction with an audit entry; never remove authorization checks to make SQL Editor calls work.

## CLI deployment (optional alternative to SQL Editor)

Use the official Supabase CLI via `npx supabase` or install the supported binary. Log in with your own account; the project ref is a public identifier. CLI prompts may request your database password—never paste it into tracked files.

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase functions deploy review-membership
```

The Edge handler verifies the bearer token using Auth and forwards it to the checked RPC. `verify_jwt = false` in config disables only the legacy gateway JWT check; it does not allow unauthenticated requests. No service role is required. Native clients can invoke it; this initial optional endpoint does not enable browser CORS. The shipped membership UI calls the same database RPC directly, so Edge deployment is not required for that UI. Typecheck the Edge handler with `deno check supabase/functions/review-membership/index.ts` (Deno 2).

Storage bucket creation is in migration 002: private, 10 MiB limit and allowed MIME types. No object policies are opened yet. Upload UI, file associations, content validation and signed URL authorization ship together in the assignment increment. Realtime is available through the configured Supabase client but no foundation table is published; enable and test it during attendance, not globally for private tables.

## Local Supabase and schema changes

For a full local stack, install Docker and run `npx supabase start`, then `npx supabase db reset` **only locally**. Local HTTP Supabase URLs are deliberately rejected by the mobile production-oriented env validator; use a trusted HTTPS development proxy for physical-device access or a separate hosted staging project. The portable PostgreSQL tests (`npm run test:db`) need neither Docker nor project credentials.

Add a new timestamped migration for every schema/policy change; never edit a deployed migration. Regenerate client types with `npx supabase gen types typescript --linked` when implementing the full data service layer. This foundation uses explicit response types; generated schema types are a next-increment improvement. Run `npm run check`, deploy to staging, then run the manual acceptance steps in EXPO_TESTING.md.

## Before real student data

Agree school authorization, privacy contact, minimal profile fields, retention schedule and incident owner. Configure SMTP, Auth rate limits, project backups and monitoring. The V2 deletion workflow is not implemented: handle requests through the school's documented process. There is no promise of legal compliance or a tested production restore. Account suspension blocks protected database access immediately; Supabase access JWTs may remain cryptographically valid until expiry, but cannot bypass the live database status check. Sign-out revokes refresh sessions; native persisted tokens are cleared locally.
