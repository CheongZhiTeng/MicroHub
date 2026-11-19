# Homework acceptance

The feature branch uses the deployed client's existing membership and role checks. Apply its migrations in order to a disposable local Supabase project or a designated staging project. For a hosted target, first check its migration history and schema, including any foundation migrations previously applied in the SQL Editor. Review a CLI dry run before applying pending migrations. Deploy the compatible app after the database is ready.

## Portable database suite

`npm run check` includes the identity regression suite and the homework PostgreSQL suite. Each test database starts empty. The homework suite exercises the actual migrations as different authenticated users, including non-recipients, inactive members and competing graders.

## Local browser rehearsal

Use Node 24, Docker, the Supabase CLI, Chromium and Playwright. The browser runner uses a private, local deployment and creates disposable school-format identities there. Use an isolated Supabase work directory for this rehearsal. Keep the local environment file outside the repository and accessible only to your account.

```sh
stage=$(mktemp -d)
cp -R supabase "$stage/"
(cd "$stage" && npx supabase start)
(umask 077 && cd "$stage" && npx supabase status -o env > "$stage/local.env")
(
  . "$stage/local.env"
  EXPO_PUBLIC_SUPABASE_URL=https://microhub-preview.supabase.co \
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$PUBLISHABLE_KEY" \
  npm run build:pages -- "$stage/pages"
)
node --env-file="$stage/local.env" scripts/homework-browser.cjs "$stage/pages"
```

The test uses Playwright from the Node module search path. Set `CHROMIUM_PATH` to the local Chromium binary if it differs from `/usr/bin/chromium`. Each browser request to the preview hostname is forwarded to local GoTrue or PostgREST. The admin credential is confined to the Node test process that seeds local accounts. The Pages export contains the public publishable key.

The walkthrough covers publication to a named recipient, a denied direct link, cross-device typing, a draft conflict, lost submission acknowledgement, grade privacy, returned feedback, resubmission, retained history, responsive layout and refreshing an authenticated deep link. Web sessions follow the existing in-memory policy, so refreshing prompts for sign-in and returns to the requested assignment.

## Release checks

- Exercise the same flow with an administrator and two members in the designated staging project. Check iPad Safari, native Expo Go and desktop keyboard navigation against the same assignment.
- Record the target, applied migration versions, build commit and results in `DEVELOPMENT_PROGRESS.md`.
- Use the existing Pages workflow on its deployment branch after acceptance. Files and photos, administrative deadline exceptions, lifecycle management and advanced reporting remain scheduled for MVP B.
