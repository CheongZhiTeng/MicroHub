# MicroHub Ultimate Homework System

Planning checkpoint based on the latest homework plan and [original project requirements](SOURCE_REQUIREMENTS.zh-CN.txt). MVP A implementation and verification are recorded in [development progress](DEVELOPMENT_PROGRESS.md). The [feature matrix](FEATURE_MATRIX.md) continues to track the full original scope.

## Student and administrator flows

- Students see due, submitted, missing, returned and graded work for their own assignments. Display instructions, private reference attachments, allowed submission types, personal deadline, and points or ungraded status. Keep usable filters, search, pagination, and distinct empty/error states. Home shows real assigned work.
- Students can continue an account-scoped private draft across devices, submit text or links in MVP A and upload files/photos in MVP B. A receipt shows server timestamp, version, and timeliness. Retain drafts after failure, handle repeated requests safely, and expose draft version conflicts without silently discarding local edits.
- Administrators draft, preview, publish, and copy assignments. Publish to selected or all current active members using a recipient snapshot. Later members may be explicitly assigned. Copies exclude original submissions, recipients and reviews. Allow deletion of unpublished drafts; published assignments preserve history through closure or archival.
- The administrator roster supports filters for submitted, late, missing, excused, revisions requested, and awaiting review. Desktop supports a roster beside the detail view; mobile supports individual grading. Show submission versions, separate draft grades from released results, and support both returning feedback and requesting revision.
- A revision request may set a personal resubmission deadline. A new submission gets a new immutable version and is pending review. Prior receipts and released feedback remain available. Grading edits use revisions to detect competing admin changes; alert the grader if a newer submission exists.

## Data and authorization

- Model assignments, recipient snapshots and exceptions, student drafts, immutable submission versions, review drafts and released review history, private attachment metadata, and audited admin actions.
- Keep assignment lifecycle, submission status, timeliness, grading, and revision requests distinct. Store UTC and display Malaysia time. The effective deadline is inclusive; late policy and closure govern whether a submission is allowed. Individual extensions take precedence. An explicit revision window may override normal closure for the named recipient only. Preserve the deadline used in historical receipts.
- Missing does not imply zero. Exclude excused recipients from the denominator. Count late submissions as submitted for completion rate; show not applicable for zero recipients. Audit published deadline edits, closure/reopening, excusal, revision grants, grade release and corrections.
- Reuse existing Auth, active membership and administrator checks. Enforce access in Supabase RLS and server operations, including direct queries, files, search, aggregates and exports. Only recipients can read their published assignments; students access only their own drafts, submissions and released feedback. Review drafts are admin-only, and revoked membership loses access.
- Use transactions, idempotency keys and version checks for publish, submit and release. Bind grades to the exact submitted version. Validate uploaded file type and limits, require finished uploads before submission, provide short-lived private download authorization, and clean up abandoned uploads.
- Read updated data on re-entry, foreground and manual refresh. Web and Expo use the same database. Maintain a compatibility window for deployed clients when applying additive migrations. Evaluate live updates after the core workflow.

## Batches and acceptance

- **MVP A:** Data model and permissions; administrator draft, preview and publish to all or selected members; student list, detail and synced text/link draft; submission, receipt, revision history; individual grading, private comments, release, return and resubmission; basic roster counts and real dashboard work.
- **MVP B:** Private reference and submission attachments, file/photo progress and retry; full late policy, personal deadline extensions, excusal, closure, reopening and archive; completion rates, missing list, enhanced grading filters and device acceptance.
- **V1:** Scheduled publishing, due and feedback notifications/preferences, rubrics, comment bank, bulk release with preview and conflict reporting, grade export, assignment discussions, advanced analytics and group submissions with dedicated permission tests.

Use one administrator and two normal members. Verify draft and non-recipient secrecy via both UI and API, cross-device draft and submission, idempotent retry and concurrent requests, grade draft secrecy, release, return and immutable history. Test expiry boundaries, late/missing/excused states, individual overrides and revocation as introduced. Include web deep-link/reload, iPad Safari, Android, desktop keyboard, light/dark theme and existing authentication/membership regression checks. Use a test backend for destructive or multi-account test data. Keep hosted migration status and local test evidence separate.
