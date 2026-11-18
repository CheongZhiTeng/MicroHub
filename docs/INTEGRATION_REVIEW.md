# UI integration review

The user authorized checking the redesign for errors and combining it with the existing application. The reviewed inputs are foundation `230ba27` and UI `e012fa1`. The integration target is `codex/mvp-foundation`; `main` is unchanged. A merge commit preserves both histories, and the UI branch is retained.

## Review scope and result

Reviewed shared form controls, password rules and visibility, animation lifecycle/reduced motion, navigation, dashboard states and role-gated availability/admin pages. Compared the database and core identity/session/access modules with the foundation: they are unchanged. No blocking regression was identified in this scope. This does not establish that the entire unfinished application has no bugs.

## Fresh verification

| Check                                                 | Result                                                                                                                                                                                         |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strict TypeScript, ESLint, Prettier (`npm run check`) | Passed                                                                                                                                                                                         |
| Native/unit/component/flow tests                      | 70 passed                                                                                                                                                                                      |
| React Native Web tests                                | 5 passed                                                                                                                                                                                       |
| PostgreSQL authorization/constraint scenarios         | 14 scenarios passed; 15 reported tests including parent                                                                                                                                        |
| Expo Android, iOS and Web exports                     | Passed; bundle export only                                                                                                                                                                     |
| Browser screen/viewport checks                        | 45 passed at 320×740, 390×844 and 820×1180; no browser runtime errors, overflow or tab-label truncation                                                                                        |
| Browser interactions                                  | Animated presses, live reduced motion, inline eye placement/masking/value, email Next, keyboard signup, spaced OTP paste, profile save, member/admin navigation and membership approval passed |
| Expo dependency compatibility                         | Offline bundled check passed; online dependency validation was not performed                                                                                                                   |
| Merge                                                 | No conflicts; application files match the reviewed UI tip                                                                                                                                      |

Browser checks intercept an isolated preview Supabase host with HTTP fixtures. These are not real school accounts or hosted email-delivery tests. Temporary exports and new review screenshots are in `/tmp/microhub-merge-export` and `/tmp/microhub-merge-screenshots`; the committed UI screenshots remain in `docs/screenshots/`.

## Remaining work

- Verify real school registration, confirmation and recovery after correcting the hosted SMTP configuration.
- Accept the combined UI, keyboard behavior and reduced motion on physical iPad/Android devices.
- Finish remaining MVP homework, attendance and administration requirements. Availability screens do not implement those features.
- Resolve previously documented dependency advisories before release; this review does not claim a fresh vulnerability audit.

## Continue in Codespaces

Stop the old Expo terminal with its trash icon, open a new terminal, then run:

```bash
git fetch origin
git switch codex/mvp-foundation
git pull --ff-only origin codex/mvp-foundation
npm install
npm run web -- --clear
```

Open forwarded port 8081. Keep the existing ignored `.env`; no SQL needs rerunning for this UI integration.
