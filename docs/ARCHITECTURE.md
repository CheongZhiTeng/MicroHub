# Architecture and delivery sequence

MicroHub is one private school club, not a tenant platform. `club_settings` is a singleton enforced with a boolean primary key and CHECK; no business table has a club_id. Technical roles are separate from committee positions. The initial increment implements identity and membership foundations, not the entire MVP.

## Boundaries

- `app/`: Expo Router routes and five bottom tabs. Views consume authenticated data; route visibility is only presentation, never authorization.
- `src/components/`: accessible React Native primitives with shared spacing/color tokens, bounded widths for iPad and keyboard-aware forms.
- `src/features/`: identity/session state and club membership UI. Supabase errors are surfaced with retry controls; lists never substitute sample records.
- `src/lib/`: validated public environment, Supabase client, school-email validation, native SecureStore session persistence. No service role in application code.
- `src/theme/` and `src/locales/`: tokens and centralized English strings; Chinese and user-selectable themes are V1.
- `supabase/migrations/`: versioned SQL authority. All client-facing tables have RLS; functions use explicit empty search paths and restricted execution grants.
- `supabase/functions/`: caller-authenticated Edge endpoints. Privileged work is performed through checked SQL RPCs with the user's JWT, so database security also applies to direct REST requests.
- `tests/`: behavioral identity, component and PostgreSQL RLS tests. Hosted Supabase/Storage/email and physical devices need separate acceptance.

## Trust model

Supabase Auth validates password and email ownership. A database trigger refuses non-school addresses even through direct Auth requests; protected queries also check the live auth.users confirmation and address, profile suspension and membership. Never trust editable JWT user_metadata for role claims. Email change is disabled in the initial app; the database independently enforces school-address changes. Technical roles live in platform_roles and are writable only by trusted RPC/admin provisioning.

New users can see their own profile and application; club academic data is available only after approval. Suspended users lose access on the next request despite an unexpired access token. Administration requires active membership and an admin role. Self-approval does not bootstrap a Super Admin. Every approval, rejection, role/status change and club change is logged in the same database transaction. Last-super-admin safeguards and serialized role mutations prevent accidental lockout.

Native sessions persist in Expo SecureStore with bounded chunks and are cleared on sign-out. Web sessions use memory only, deliberately avoiding browser persistent storage. Auth auto-refresh follows AppState; app logs never print tokens. Recovery uses a six-digit email OTP; email templates must show the OTP. This supports one-iPad testing without relying on email deep links or PKCE state across devices. Production universal links can be added after a stable bundle identity/domain is chosen.

## MVP implementation order and acceptance gates

1. **This increment:** trace all 76 requirements; establish Expo/TypeScript/router/design tokens; real school-email registration, confirmation OTP, login/logout, recovery, profile editing, membership application, roster and admin review; PostgreSQL policies/tests; Codespaces docs.
2. Invitations and committee position UI; complete role/status and club administration UI. Verify bootstrap, last-admin protection and two-device session revocation on hosted Supabase.
3. Assignment creation/attachments; individual text/link/file/image submission; immutable revision history; grades/private feedback; authorized signed URLs. Implement upload validation and Storage tests together.
4. Secure attendance: server CSPRNG six-digit codes, hashed private secrets, short expiry, atomic attempt counters and uniqueness, active membership checks, close/correction audit, Realtime roster. Test concurrency and expiry before device rollout.
5. Real personal/admin dashboards, essential notification entry and MVP analytics.
6. Hosted integration, accessibility, Android/iOS and iPad acceptance, Expo internal build and review. Only then begin V1.

V1 implements communication, groups, events, reminders, analytics, exports, translations/theme controls and search. V2 implements extensions, QR, offline, widgets, deletion workflows and backup/restore drills. Their tables are designed in DATABASE.md and added by migrations with each module, avoiding unused insecure APIs.

## Operational decisions and risks

Use npm lockfile and the Expo SDK's compatible native package versions. Keep build/deploy credentials out of the repository. Expo tunnel is development infrastructure, not production hosting. All event timestamps use timestamptz; display school time in Asia/Kuala_Lumpur. Academic files are private with short signed URL lifetimes; immediate suspension cannot invalidate URLs already issued, so keep TTL at 60 seconds and do not persist URLs offline.

Before real student data, school authorization, privacy contact, retention policy, SMTP delivery, monitoring, backups and an incident owner must be configured. These are deployment prerequisites, not fabricated configuration values. MFA for administrators is recommended before public distribution and must be evaluated during MVP security review.
