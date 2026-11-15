# iPad, Codespaces and Expo testing

The app targets Android/iOS with Expo SDK 58, React Native 0.88 and React 19.3. Expo Go must support the same SDK. Install the current compatible Expo Go from the App Store. If your installed Expo Go does not support this SDK, use a compatible Expo Development Build; do not bypass npm dependency compatibility checks.

## Start from an iPad

1. Open Safari → GitHub → `CheongZhiTeng/MicroHub`. Switch to the branch containing this work after it has been pushed/merged. Select **Code → Codespaces → Create codespace on this branch**. A local-only Codex commit will not appear there until published.
2. Wait for the browser VS Code workspace and terminal. The committed devcontainer uses Node 24 and installs dependencies automatically with `npm ci`. You can still run the requested commands manually:

   ```sh
   npm install
   cp .env.example .env
   ```

3. Edit `.env` in browser VS Code and paste the two **public** Supabase values described in SETUP.md. Complete migrations, Auth email templates and SMTP first. Never enter a service role key. Do not commit `.env`.
4. In the terminal run:

   ```sh
   npx expo start --tunnel
   ```

   `@expo/ngrok` is included as a development dependency. If Expo requests permission to install or configure its supported tunnel helper, follow the prompt. Some networks/accounts require ngrok authentication or impose quotas; put any ngrok token in the provider's secret configuration, not tracked files. Tunnel traffic uses external Expo/ngrok infrastructure.

5. Wait for “Tunnel ready” and the `exp://…` development URL. Use the URL printed **this session**, not the GitHub forwarded port's HTTPS address. Keep the terminal process running.
6. On the **same iPad**, you do not need to scan its own QR code. Copy the complete `exp://…` URL from the terminal, open Safari, paste it into the address bar, and choose **Open in Expo Go**. If Safari searches instead, use Expo Go's open-from-clipboard/URL option if available in your version, or open the Expo development landing link and choose Open in Expo Go. Apple/Expo Go UI wording varies. This same-device handoff requires manual validation on your iPad.
7. Switch between Expo Go and Safari Codespaces to edit files. Fast Refresh updates the running app. Keep the Codespace running; if it sleeps or the Metro process stops, reopen it and restart the command.

## Resume after closing Codespaces

Reopen the existing Codespace from GitHub's Codespaces list rather than creating a new one. `.env` stays inside that Codespace but is not in Git. If the Codespace was rebuilt/deleted, restore public values. Run `npm install` after dependency changes, then `npx expo start --tunnel`. Use the newly printed URL; tunnel hosts can change. If the environment is missing Metro dependencies, run `npm ci`.

## Troubleshooting

- **iPad browser Web preview:** run `npm run web -- --clear` and open port 8081 using Codespaces Ports. For a `window.ethereum.selectedAddress` global error in Brave, try the same preview URL in Safari to isolate a possible injected wallet script. MicroHub does not use cryptocurrency wallets. Keep `.env` unchanged. The Web session is memory-only, so reloading signs out.
- **Unexpected text node inside View:** update the existing branch with `git pull --ff-only` and restart Metro; the 2026-11-15 repair omits empty-string notice/subtitle children. `npm run test:web` covers initial sign-in/signup/recovery renders with the real React Native Web renderer.

- **Cannot connect / timeout:** ensure Codespace is running, tunnel says ready, and Expo Go uses the current exp URL. Disable a restrictive VPN or try another network. Restart Metro; tunnel providers can be temporarily unavailable.
- **SDK mismatch:** match Expo Go's supported SDK or install a development build. `npx expo install --check` validates package compatibility.
- **Stale code / variables:** stop Metro with Ctrl+C, restart with `npx expo start --tunnel --clear`. Only EXPO_PUBLIC variables reach the client; never use that prefix for secrets.
- **Setup screen:** check both public environment values and restart Metro. A placeholder URL is intentionally rejected.
- **Verification email absent:** configure SMTP, allow school inbox delivery, check junk folder and Auth rate limits. Signup and reset templates must display `{{ .Token }}`. Codes expire after 10 minutes.
- **Permission denied / empty profile:** apply migrations; confirm the exact school account and email confirmation. A verified account still needs approval for club data. Do not turn off RLS to resolve this.
- **No administrator yet:** follow the one-time SQL Editor bootstrap in SETUP.md; do not put a role in signup metadata.
- **No tunnel helper:** run `npm install`, then retry. Do not make Codespaces ports public as a substitute for a working Expo tunnel.

## Acceptance checklist (not yet executed on a physical device)

Use a staging project and authorized test accounts. Never use made-up live student records.

1. Attempt an invalid address via both app and direct Auth API; confirm registration is denied. Register a real authorized school account, receive an OTP, reject an incorrect/expired code, then verify successfully. Before confirmation, protected REST queries must fail or return no rows.
2. Login/logout, restart Expo Go, confirm secure persistence, background/foreground refresh, and repeat after network loss. Ensure no profile from a prior user flashes after switching accounts.
3. Request reset, verify recovery OTP, save a new password and confirm sign-in with the new password. Wrong/expired OTP must fail. Confirm other refresh sessions are revoked; access JWT expiry follows Supabase policy.
4. Save name/class; submit an application twice; confirm one pending request. Applicant must not see roster or club data. Bootstrap the authorized Super Admin, approve the student, refresh Home and view the roster.
5. Attempt admin RPCs as Member and technical-role changes as Admin; verify denial. Suspend an active member via Super Admin RPC and check existing sessions cannot read club data. Final Super Admin cannot demote/suspend themselves.
6. Test application decline/reapply interval, offline errors, retry, empty queue, name/ID search and pagination. Keep audit rows private and immutable.
7. Test portrait/landscape, iPad split screen, small Android/iPhone width, large system text, keyboard avoidance, VoiceOver/TalkBack labels, contrast and touch targets. Check slow/failed requests and duplicate taps.
8. Subsequent MVP increments must add homework creation/submission/private-file/private-grade isolation, attendance expiration/duplicate/concurrent/rate-limit/correction scenarios and real dashboards before MVP acceptance.

Automated checks: `npm run check`; bundle validation: `npx expo export --platform all`; package compatibility: `npx expo install --check` and `npx expo-doctor`. `npm run test:db` uses real embedded PostgreSQL, not the hosted Supabase services. GitHub Actions runs these code checks plus Edge typechecking; a workflow file is not evidence that GitHub CI already ran.

## Development Builds and internal distribution

The current identity/membership code uses Expo Go-compatible libraries, including SecureStore. Push notifications may require a development build on current Expo SDKs; native home screen widgets will require one. Do not promise every V2 feature in Expo Go.

When native capabilities are needed, install `expo-dev-client` with `npx expo install expo-dev-client`, choose school-owned stable iOS bundle/Android package identifiers, log in to EAS, run `npx eas-cli build:configure`, create a development profile, and build with `npx eas-cli build --profile development --platform ios` (and Android). Configure signing and iOS test devices through the school Apple Developer account. Then run `npx expo start --dev-client --tunnel`. EAS account, project ID, signing and builds have not been provisioned here. Internal distribution does not require immediate App Store publication.
