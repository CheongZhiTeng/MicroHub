# Homework acceptance

The feature branch uses the deployed client's existing membership and role checks. Apply its migrations in order to a disposable local Supabase project or a designated staging project. For a hosted target, first check its migration history and schema, including any foundation migrations previously applied in the SQL Editor. Review a CLI dry run before applying pending migrations. Deploy the compatible app after the database is ready.

## Portable database suite

`npm run check` includes the identity regression suite and the homework PostgreSQL suite. Each test database starts empty. The homework suite exercises the actual migrations as different authenticated users, including non-recipients, inactive members and competing graders.

## Local browser rehearsal

Use Node 24, Docker, the Supabase CLI, Chromium and Playwright. The browser runner uses a private, local deployment and creates disposable school-format identities there. Use an isolated Supabase work directory for this rehearsal. Keep the local environment file outside the repository and accessible only to your account.

```sh
stage=$(mktemp -d)
mkdir "$stage/supabase"
cp -R supabase/migrations "$stage/supabase/"
sed 's/^project_id = .*/project_id = "microhub-homework-local"/' supabase/config.toml > "$stage/supabase/config.toml"
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

Independent local password sessions also exercise simultaneous draft saves, competing submissions, lost or repeated acknowledgements, concurrent graders and a release racing a resubmission.

The walkthrough covers keyboard publication to a named recipient, a denied direct link, cross-device typing, a draft conflict, lost submission acknowledgement, grade privacy, returned feedback, resubmission, retained history, responsive layout and refreshing an authenticated deep link. Web sessions follow the existing in-memory policy, so refreshing prompts for sign-in and returns to the requested assignment.

## Release checks

- Exercise the same flow with an administrator and two members in the designated staging project. Check iPad Safari, native Expo Go and desktop keyboard navigation against the same assignment.
- Record the target, applied migration versions, build commit and results in `DEVELOPMENT_PROGRESS.md`.
- Use the existing Pages workflow on its deployment branch after acceptance. See the complete release checklist below for the subsequent migrations and private Storage rollout.

## Complete homework release

The scoped grading and group suites run in `npm run test:db`. The browser rehearsal additionally creates a regular teacher, a student leader, and a teammate. It publishes shared work from the leader account, submits on a phone-sized screen, returns feedback from the teacher account and downloads a grade export. Deadline, feedback and grading reminders are in the in-app Notifications screen. Native push delivery is tracked separately in the platform notification module.

For the private-file rehearsal, enable Storage on the isolated Supabase stack and serve `supabase/functions/homework-files` against that same stack. Set `HOMEWORK_FILES_URL` to its loopback URL when running the browser script (for example, `http://127.0.0.1:54321/functions/v1/homework-files`). The browser then uploads a real file and the runner downloads its exact bytes using a short-lived signed URL. With the URL omitted, the script still tests the text-based workflow. In the snippet above, copy the repository's `supabase/functions` into the isolated work directory before running `supabase functions serve homework-files`.

### Hosted rollout

1. In the authenticated project workspace, confirm the intended project reference and compare `supabase migration list --linked` against the repository. Reconcile any foundation scripts previously applied outside the CLI against the schema before proceeding. The complete module includes versions `202611200001` through `202611200010` after the existing homework and profile migrations.
2. Review `supabase db push --linked --dry-run` and apply the verified outstanding migrations through the project's migration workflow. The migrations preserve existing accounts, submissions and released results.
3. Deploy `supabase functions deploy homework-files --project-ref <project-ref>` from the repository, with the included function configuration. The function verifies end-user tokens with Auth. Its server-only Supabase credentials come from the Edge runtime. The app and Pages build use only the public client configuration.
4. Verify that the `club-private` Storage bucket remains private, run a file upload and signed download in staging, and inspect scheduled jobs. On hosted Supabase the migrations register minute-by-minute scheduled publishing and garbage collection using `pg_cron` and `pg_net`. The trusted uploader records the hosted project origin so the cleanup job can drain discarded objects. Deployments without those extensions need a scheduler for `homework_private.publish_due()` and the protected cleanup endpoint.
5. Check an actual iPad Safari and Android/Expo Go against staging before marking physical-device acceptance. The Pages release job verifies its live commit and app entry routes independently of the backend rollout.
