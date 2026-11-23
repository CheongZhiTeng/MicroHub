# Development progress

## 月历选中日期的活动卡片 · 2026-11-23

分支 `codex/calendar-event-blocks`。点选日期后，每项活动以独立高对比色块展示，班级范围、标题、时间、地点和说明分行。当天活动显示紧凑时段，跨日活动保留起止日期；取消活动使用独立配色及文字状态。本次无数据库迁移。

在 320 和 1280 像素宽度使用 Chromium 验证浅深主题和取消状态，并检查手机截图。正常活动块的文字对比度在浅色主题最低为 7.28∶1，在深色主题最低为 5.27∶1。本地 Supabase 浏览器回归验证点选日期、活动地点、翻月及个人作业跳转。115 项自动化测试、TypeScript、ESLint、格式检查以及 iOS、Android、Pages 导出通过。原生真机外观尚未验证。

## 首页仅显示月历 · 2026-11-23

分支 `codex/month-calendar`。按最新需求移除手机与桌面的周视图和视图切换器。月历在同一天标出活动和个人作业截止，沿用班级筛选、马来西亚时区和收件人权限。点日期查看活动地点与作业，点作业可进入个人详情。沿用已有 `daily_due` 接口，本次无需数据库迁移；生产库上一批迁移状态未核实。

本地 Supabase 与 Pages 导出在 390 和 1280 像素宽度验证了直接打开月历、切换月份、查看小组活动地点，并验证手机点选截止日期后打开对应作业。完整检查通过 73 项应用、5 项网页和 37 项数据库测试，iOS 和 Android 导出成功。

## 作业讨论聊天与发布验收 · 2026-11-23

分支 `codex/discussion-brand`。作业参与者可打开独立讨论窗口，按发送人、马来西亚日期及星期阅读聊天。新旧消息分别用时间与消息 ID 定位；阅读历史时可跳至新消息。前台打开时每 10 秒同步，归档后只读，发送重试沿用同一请求 ID。沿用现有数据库行权限及发送接口。

独立手机和桌面浏览器连接本地 Supabase，验证 43 条历史分批加载、丢失发送回执后保留输入和重试去重、另一账号回复、阅读历史时收到提示及跳转。完整作业和会员流程回归通过。73 项应用、5 项网页、37 项数据库测试，以及 TypeScript、ESLint、格式、iOS/Android/Pages 导出通过。手机宽度浅色及深色主题共 30 项页面检查通过。原生键盘和桌面启动图标尚待真机确认。此次无需数据库迁移；上一批 `202611230001` 的正式执行状态仍待项目方核对。发布流程核对线上版本标记和主要直达页面。

## B 款应用图标与 favicon · 2026-11-23

分支 `codex/discussion-brand`。iOS 使用深蓝底、薄荷色双尖括号和连接点的图标，Android 自适应前景留出遮罩空间。网页使用同款图形；Pages 根据图标内容生成缓存版本号。已检查网页导出含 16 和 32 像素图层，首页、作业直达页和 404 入口均引用同一站点子路径。

## 双语日期和首页全名 · 2026-11-23

分支 `codex/discussion-brand`。首页问候使用当前语言的完整姓名，沿用现有姓名回退。作业、通知、公告、活动和管理记录的显示时间统一使用马来西亚时区，并按界面语言显示星期。时间输入及导出格式保持原约定。TypeScript 和 7 项相关测试通过，包括马来西亚周五跨到周六。此次无需迁移；正式库上一批迁移状态未核实。

## 班级创建入口与作业下一步 · 2026-11-23

分支 `codex/club-daily-workflows`。研教和组长按各自权限从小组进入相应编辑页；选择大课时沿用大课范围，无范围入口要求明确选择。正式发布显示班级与人数。学生卡片给出当前可执行的操作，回执和反馈入口优先显示对应记录；批改队列只列出当前有权批改的版本，发还成功后刷新并前进。传统名单仍可打开。

完整检查通过 72 项应用、5 项网页、37 项数据库测试，另通过 iOS、Android、Pages 导出和手机浅色主题 15 项页面检查。独立浏览器账号连接本地 Supabase 完成连续发还两份作业、组长从小组页发作业、公告和活动人数预览、周视图地点查看、菜单选图及跨组隔离验证。线上待应用数据库迁移；原生真机体验待验证。Pages 流程将校验正式发布的提交编号。

## 首页周日程 · 2026-11-23

手机默认按马来西亚周一到周日列出个人有效截止时间和可见活动，支持查看地点、进入作业、翻周及切换月历；桌面默认保留月历。已在手机宽度验证组内活动、地点及月历切换，本地数据库测试覆盖延期后的周边界及非收件人隔离。线上完整截止日程依赖 `202611230001`。

## 作业队列、发布人数与周日程的数据接口 · 2026-11-23

分支 `codex/club-daily-workflows`。新增迁移 `202611230001_daily_workflows.sql`，在本地 Supabase 核对上一版本 `202611220001` 后应用。列表、批改队列和本周截止查询沿用成员行权限；发布接口复用既有事务和鉴权，作业实际分配人数不符时回滚。公告和活动的可见人数包含可跨组查看的研教。数据库测试验证个人延期、越权隔离、批改后出队、预览人数变化和发布回滚。生产项目管理凭据当前不可用，正式库迁移待执行。

## 首页账号菜单 · 2026-11-23

分支 `codex/club-daily-workflows`。首页头像打开账号菜单，与「更多」共享入口、角色检查和退出逻辑。手机宽度浏览器已从菜单进入个人资料并完成头像更换。此项无需数据库迁移。

## 小组导航、首页日历与新建流程 · 2026-11-22

分支 `codex/calendar-profile-creators`，接续头像检查点 `dfc0472`。手机底部与桌面侧栏均可直接进入「我的小组」。首页按马来西亚日期显示月历，保留大课和小组范围，可逐日查看活动；原日历直达地址仍有效。研教从「更多」进入新建活动。新建小组打开弹窗，作业、公告、活动使用独立编辑页。放弃未保存内容时可选择继续编辑。

TypeScript、ESLint、格式检查、72 项应用测试、5 项网页测试、36 项数据库测试通过。4 个 Edge 入口通过 Deno 类型检查，7 项 Edge 测试通过。iOS、Android 与 GitHub Pages 导出成功。使用本地 Supabase 的独立账号在桌面、平板及手机浏览器尺寸验证了小组创建和分配、跨组公告访问、活动保存和放弃提示、首页切换月份、作业提交发还及头像操作。手机浅色主题另通过 15 项页面检查。原生真机选图及正式环境头像仍待验证。发布工作流会检查线上版本标记、首页与新建页。

## 个人头像 · 2026-11-22

分支 `codex/calendar-profile-creators` 从 `9c80082` 继续。个人资料页点头像选图，裁成正方形后可预览、取消、保存、更换或移除。首页、更多与成员目录复用同一头像组件。服务端重新解码并编码 256 像素 JPEG，使用私有对象和 120 秒签名链接；覆盖前核对上一版本。失败或过期的上传在后续头像操作时清理。

`202611220001_profile_avatars.sql` 已在本地 Supabase 从 `202611210005` 迁移并验证。数据库测试覆盖成员可见性、停用、所有权、写入权限、并发更换和移除。浏览器通过本地真实 Auth、Edge 与 Storage 验证了手机宽度的选择、取消、签名读取、更换和移除。现有资料可在迁移前继续使用。生产 Supabase 管理端返回 `AccessTokenRequiredError`；生产迁移与 `profile-avatar` 部署待项目管理员验证。下一检查点为导航、新建流程和 Pages 发布。

## 大课、小组课与日历 · 2026-11-21

分支 `codex/class-workspaces`，接续分组管理检查点 `b48eb39`。首页、作业、公告与活动日历提供全部课程、大课、我的小组范围；研教可选择其他启用的小组。成员只看到获授权的内容。活动支持创建、修改、取消和按马来西亚日期查询。大课作业使用个人提交，小组课可选择个人或共同提交。

本地 Supabase 已从 `202611210003` 依序应用 `202611210004_class_groups.sql` 和 `202611210005_class_calendar.sql`，并核对迁移记录。112 项自动化检查、TypeScript、ESLint、格式检查和 Deno 类型检查通过。iOS、Android 与 Web 导出成功。使用本地真实 Auth、数据库、Storage 和 Edge 在桌面、平板、手机宽度验证了分组、并发分配、作业提交与发还、跨组公告隔离、活动筛选，以及错误密码拒绝和正确密码归档。验收时发现活动直达链接在登录后跳回首页，已修复并重测。手机浅色主题的 15 项页面检查通过。

**线上待办。** 当前环境缺少 Supabase 管理登录，最后一次由操作者确认的正式库版本为 `202611210001`。在含本提交的发布目录核对 `supabase migration list` 和 `db push --dry-run` 的目标及差异，再应用待执行的迁移、部署 `delete-group` 并在托管环境验证。生产库应用 004 后，所有旧客户端的直接归档请求都会被拒绝。既有带组者若尚未取得研教角色，由已有研教在分组页面明确确认任命。

## 分组管理与删除保护 · 2026-11-21

在 `codex/class-workspaces` 上完成研教任命、分组管理和删除确认。新任命需明确确认全会管理权限；每位研教最多带一组，学生须先移出原组。删除会归档小组、解除组员关系并保留历史作业。仅服务端可在验证当前账户密码后执行归档，客户端旧归档入口已封闭。已有跨组带领记录保留，管理页列出冲突供研教处理。

迁移 `202611210004_class_groups.sql` 已应用到本地隔离的 Supabase，并核对迁移记录。PostgreSQL 测试验证组长人数、成员资格、跨组并发修订、普通账户不能归档和密码验证过期。Deno 类型检查通过。线上数据库及 `delete-group` Edge Function 尚待部署；浏览器验收在下一检查点记录。

## Club and group announcements · 2026-11-21

Branch `codex/club-announcements`. Active teachers can publish club-wide announcements and announcements for their own groups. Platform administrators can publish club-wide and Super Admins can publish to any active group. Members, including group leaders, read club posts and posts for their current active group. Home shows up to two recent posts from each of the club-wide and group feeds. The full announcement page includes an audience confirmation, permission-aware composer, paging, and refresh. An identical publication retry is idempotent and writes one audit entry. Pinning, attachments, engagement, and read receipts remain separate backlog items.

Migration `202611210003_club_announcements.sql` was applied on the isolated local Supabase stack after verifying `202611210002`; the local ledger confirms both. The same migration passed PostgreSQL role checks, including denial of direct table access, group-leader publication, former group visibility after a transfer, and access after suspension. Browser acceptance used isolated accounts and real local Auth and PostgreSQL to publish both scopes from a tablet layout, verify the home and feed on a phone layout, and confirm cross-group filtering. iOS, Android, and web exports passed. The same release guards homework publication while a file-rule change is saving so that immediate publication uses the refreshed assignment revision. Production access is unavailable in this workspace. The Pages client explains the pending database update until production applies the migration. Before production rollout, check the remote ledger and apply only the pending migrations through the existing deployment flow.

## Responsive homework workspace · 2026-11-21

Branch `codex/campus-homework-ui`, following shared-control checkpoint `7227a2a`. The teacher editor saves a private draft when attaching a reference, keeps subsequent edits in place and preserves revision checks. Desktop has a live summary alongside the form. Deadline, points, upload limits and late rules feed the same preview. Publication and scheduling wait for pending reference files. Students see their status, instructions, own work and latest receipt in order, with earlier submissions available on demand. Grading opens on awaiting review, with a split desktop roster and a return to the same mobile list. Choices support keyboard navigation and checked-state announcements; common actions retain touch targets, language switching and reduced motion.

Verification on the local Supabase stack covered desktop-to-phone handoff, uploading a real reference before preview, editing after upload, private draft/feedback, conflicting edits, returning and revising, group submissions, private downloads, and the file limit set in the editor. Compared 390, 820 and 1280 pixel screenshots against the preceding build. TypeScript, lint, formatting, all 110 automated checks and iOS/Android/web exports passed. The visual fixture for the notification inbox now uses the current RPC response and heading. The Pages workflow for UI commit `eeaf325` passed, including its live release-marker and route checks. A follow-up on this branch checks the inline eye after React Native finishes a viewport resize; the same 44-point target and containment assertions apply. The 320-pixel login flow passed and the follow-up passed the complete project checks. Physical devices and the production audience migration `202611210002` remain unverified. This release introduces no migrations.

## Teacher authoring and release verification · 2026-11-21

Audience selection comes first, with separate reference uploads, collapsed submission rules and a bilingual recipient count before publication. Browsers at desktop and phone widths uploaded reference PDFs and published individual/selected and group assignments against local Auth, PostgreSQL, Edge and private Storage. All 110 automated tests passed, including an upgrade from the old schema with a previously graded teacher submission. Android, iOS and web exports succeeded. Production needs only migration `202611210002`; the existing homework-files deployment is sufficient.

## Student assignment audiences · 2026-11-21

On `codex/homework-student-audience`, migration `202611210002` aligns candidate search, preview, scheduled and immediate publication, and late additions. Super admins and appointed teachers are excluded, including historical assignments and later appointments. Receipts and grades are retained. Verified the isolated ledger at `202611210001`, applied locally and passed 32 database tests. The operator confirmed the hosted ledger through `202611210001` and the homework-files deployment; the new migration is pending there.

## Shared draft labels · 2026-11-21

Chinese and English saving indicators and actions distinguish the shared group draft from a private response. The full project checks passed (108 tests). Desktop and phone-size browser sessions against the isolated Supabase stack verified the group label, explicit grading approval and successful batch return. Both fixes ship on the shared Pages branch; hosted migration remains pending.

## Bulk return consent · 2026-11-21

Migration `202611210001` makes bulk return opt-in per saved review revision. Private saves, corrections and requests to revise invalidate prior approval. The preview and bulk RPC both enforce it. Verified the isolated ledger through `202611200010` before applying the migration there; all 31 database cases passed including withheld scores and stale previews. Hosted migration pending.

## Homework release verification · 2026-11-20

Branch `codex/homework-complete`. Migrations `202611200008`–`010` complete snapshot reporting, archive filters, assignment audit history, detached receipt privacy, tracked grade corrections and scheduled file cleanup. Each migration batch was compared with the isolated Supabase ledger before application. Its latest version is `202611200010`. The local scheduler has publishing, expiry and object-cleanup jobs.

The full Pages browser rehearsal used real local Auth, PostgreSQL, the homework Edge handler and private Supabase Storage. A leader published group work, a phone-size browser submitted text and an attachment, the teacher saved a private grade and bulk-returned it, and the member saw the returned feedback. Analytics, the CSV download and the signed file download were exercised. Two independent signed-in teammates raced their saves and submissions; one draft edit won and each received exactly one receipt for the same team batch. The student submission, membership and concurrency regressions passed. The Expo iOS, Android and web bundles exported successfully. The [acceptance guide](HOMEWORK_ACCEPTANCE.md) records the remaining hosted and physical-device checks.

No hosted Supabase project is linked in this environment. Hosted migration history, Edge deployment, hosted file delivery and physical iOS/Android acceptance remain unverified. The code release uses the existing GitHub Pages workflow.

## Shared group submissions · 2026-11-20

Migrations `202611200006` and `202611200007` are applied to the isolated local Supabase ledger. Assigned students can edit one revision-checked group draft and submit it once for the eligible group snapshot. Each member receives a separate immutable receipt. Shared files map to each member's version; feedback and subsequent revisions are private. Group participants cannot grade the team's shared submission. Draft settings also support file-only intake and copying submission rules. PostgreSQL tests exercised conflicting edits, deduplicated hand-ins, private revision, file access and departure history. Hosted databases remain unmodified.

## Homework operations checkpoint · 2026-11-20

Migration `202611200005` adds scheduled publication with publisher reauthorization, assignment discussions, in-app deadline/return/grading reminders with per-user preferences, private reusable grading tools, per-version bulk return and a scoped grades report. The UI supports rubric scoring, comment reuse, batch preview/result details, completion analysis and CSV export. The isolated Supabase ledger was checked and migrations 002–005 applied in order. Production rollout and native device acceptance remain pending.

## Private homework attachments · local implementation

Migration `202611200004` introduces per-assignment limits, draft and reference metadata, immutable version binding and a Storage deletion queue. The Edge function authenticates uploads, inspects bytes, restricts types and size, and issues 60-second private download links under caller RLS. Mobile/web clients support picking files, progress and retry. The database suite covers pending upload denial, file-only receipts, private reads and privileged finalization. Hosted Storage/Edge rollout is pending.

## Homework scope and lifecycle checkpoint · 2026-11-20

Branch `codex/homework-complete`. Migrations `202611200002` and `202611200003` add group-scoped publishing, recipient snapshots, cross-group and self-grading restrictions, transfer history, audited published edits, close/reopen/archive, individual deadlines and excusal. The grading overview uses eligible recipients as the completion denominator. Local isolated PostgreSQL exercises these operations. Hosted migrations remain unverified. Attachment and daily-operation acceptance follow.

## Group foundation · 2026-11-20

Branch `codex/group-foundations`. The [confirmed group plan](GROUP_SYSTEM_PLAN.md) is the scope reference. **More → My group** supports bilingual lookup, roster and change history, teacher and leader appointments, transfers, activation and archival. Global Super Admins appoint teachers and transfer students. A teacher can manage their own roster using a regular member account. Students see the roster after activation. Group changes retain an audit trail and use transactional authorization and revision checks.

Migration `202611200001_groups.sql` was the only pending migration in the isolated local Supabase stack. Applied there after checking history through `202611190005`. The local ledger now includes `202611200001`. Hosted migration history is unavailable and hosted rollout remains pending. Older backends display a setup notice on the group route.

`npm run check`, the Pages export, and the Expo iOS, Android and web exports passed. The PostgreSQL tests covered two groups, transfers, inactive accounts, direct access, stale writes, leader limits and atomic replacement. Chromium sessions exercised a desktop coordinator, tablet teacher and phone-size student against real local Supabase, including approval, sign-in return, and competing teachers claiming one student. The existing homework browser and concurrency rehearsals passed. Physical-device and hosted database acceptance remain open.

Next increment: group-scoped homework recipients, publication, grading and direct release by group leaders, with self-grading and cross-group access denied. Group announcements and calendar integration follow.

## Base branch and Pages release · 2026-11-20 (Malaysia)

The release brings the latest app code to `main` and the existing `codex/github-pages` deployment branch. Finished releases now update both branches and verify the served commit through the Pages workflow. See [publishing instructions](../AGENTS.md#publish-finished-changes).

The language switch works against the previous Supabase schema. The profile form, directory and admin review use the available name fields. When homework RPCs are pending, the interface reports that Homework is unavailable. Hosted migration status is still unverified. The bilingual name fields and the homework backend become available when their respective migrations are applied.

## Chinese and English interface and profile names · 2026-11-20 (Malaysia)

The header switches between English and handwritten Simplified Chinese across the shared Expo app. The choice is saved on that device. Profile editing asks for Chinese name, English name and class. The dashboard and member directory prefer the name matching the interface language, and directory search accepts either name. Existing display names remain available as a fallback until members update their profiles.

Migration `202611190005_profile_names.sql` adds two nullable profile fields and grants updates under the existing profile row policy. The PostgreSQL suite verified preservation of legacy names and rejection of changes to another member's fields. `npm run check` passed. The Pages export and browser checks passed on desktop and a small phone viewport with HTTP fixtures, including the language preference after reload and preserving an unsaved profile edit across language changes.

The new migration has been verified locally. Apply it to the intended Supabase project through the existing migration process before previewing or deploying this build with hosted accounts. Hosted acceptance remains pending.

## Hosted staging acceptance · awaiting project connection · 2026-11-20 (Malaysia)

The working tree was clean on `codex/homework-mvp-a` at `4c623f8`. The staging preflight found no linked Supabase project, staging URL or Supabase credential in the Cloud environment. The CLI returned `AccessTokenRequiredError` for project discovery. The environment's outbound proxy rejected the HTTPS connection to `api.supabase.com` with CONNECT 403.

Hosted migration history, test accounts and browser results are unverified. No hosted migration, account creation, assignment write or deployment was performed. Resume when the owner identifies the dedicated test project or preview branch by its public Project URL. Establish access for that target through environment settings, compare its migration history and schema, then exercise the [acceptance flow](HOMEWORK_ACCEPTANCE.md).

## Homework MVP A · remote verification · 2026-11-20 (Malaysia)

Both GitHub Actions jobs passed for the implementation at `bd836c3` on `codex/homework-mvp-a`. The clean runner installed dependencies, ran the project checks, exported the app for all platforms, and checked and tested the Edge function in a separate job. GitHub reported two runtime deprecation warnings for the checkout and Node setup actions. [Quality run 44538208767](https://github.com/CheongZhiTeng/MicroHub/actions/runs/44538208767)

The four homework migrations are verified on the disposable local Supabase stack. During recovery, the working tree was clean and the remote Pages branch still pointed to `202636e`. Hosted staging history and iPad Safari / Expo Go device acceptance remain pending. Resume at the staging checks in [homework acceptance](HOMEWORK_ACCEPTANCE.md).

## Clean-runner verification · 2026-11-19

The feature branch's first remote Quality run exposed a pre-existing assumption in the independent Edge job. Deno attempted to use the Expo workspace's installed Node modules, which are absent in that job. A clean checkout reproduced the missing Supabase dependency. The workflow now resolves the Edge entry point's pinned npm import in Deno's own cache and runs its tests with isolated configuration. The corrected commands passed in a clean checkout with a fresh Deno cache and all six Edge tests passed. No migration accompanies this CI change. The application and migration acceptance checkpoint follows below.

## Homework MVP A · local acceptance · 2026-11-19

**Branch:** `codex/homework-mvp-a`. Publishing, private text/link submissions, versioned feedback, revision requests and the home dashboard passed local acceptance. The [rehearsal](HOMEWORK_ACCEPTANCE.md) and [feature matrix](FEATURE_MATRIX.md) describe the tested flows and remaining scope.

| Homework migration                          | Disposable Supabase PostgreSQL 17 | Hosted project |
| ------------------------------------------- | --------------------------------- | -------------- |
| `202611190001_homework.sql`                 | Applied and recorded              | Unverified     |
| `202611190002_homework_recipients.sql`      | Applied and recorded              | Unverified     |
| `202611190003_homework_roster_order.sql`    | Applied and recorded              | Unverified     |
| `202611190004_homework_revision_window.sql` | Applied and recorded              | Unverified     |

Before applying each subsequent version, the local CLI migration list showed it as the only pending version. The final database query confirmed all four homework versions and both foundation versions. The last migration rejects an unusable revision grant atomically. A closed assignment needs a valid personal deadline before a member can resubmit.

**Verification.** TypeScript, ESLint and Prettier passed. The app/web suites passed 77 tests. PostgreSQL passed 22 behavioral cases (24 reported results including the two suites). The membership Edge function passed Deno typechecking and six tests. Expo exported Android, iOS and web, and its offline dependency check passed. The Pages export served the authenticated assignment routes at the project base path. Four independent Chromium contexts used real local Supabase Auth, PostgreSQL and PostgREST. Additional authenticated sessions exercised competing writes. The existing visual regression suite passed 30 phone-dark and desktop-light checks using HTTP fixtures. The local Auth container's built-in health probe used the environment proxy; successful password sign-ins, authorized reads, denied reads and mutations verified the running service directly.

**Handoff.** Source and test data remained on the feature branch and disposable local stack respectively. No hosted migration or production Pages deployment was run. Next, compare the intended staging project's actual schema and migration history, apply the pending homework versions through the project workflow, then check iPad Safari and native Expo Go with designated test accounts. MVP B remains pending, including private attachments, exception/lifecycle management and completion reporting.

## Homework MVP A · roster and concurrency checkpoint · 2026-11-19

- Added server-side roster ordering by student ID, name or most recent submission before pagination. On narrow screens the selected submission has its own pane and a return-to-roster action. Existing four-argument roster callers remain supported. Homework editor deep links also survive web sign-in.
- Compared local Supabase history, then applied the only pending version, `202611190003_homework_roster_order.sql`. The full browser rehearsal passed with copy, deletion, supplemental assignment and switching the grading workspace between mobile and desktop widths. Concurrent requests through independent GoTrue sessions and PostgREST connections produced one winning draft write, one receipt for repeated submissions, one winning grader, one release for duplicate confirmations and consistent history during resubmission.
- No hosted migration or Pages publication. Next: finish boundary-case review, final regression checks and publish the isolated feature branch.

## Homework MVP A · assignment maintenance checkpoint · 2026-11-19

- Administrators can copy settings to a fresh draft, delete an unchanged unpublished draft after confirmation, and explicitly add named active recipients after publication. Adding a member preserves all existing receipts and feedback. Draft edits use the original revision even when the screen refreshes. The grading panel pins the version a reviewer opened.
- Migration `202611190002_homework_recipients.sql` was the sole pending version when compared with the local Supabase migration history. Applied it to the local test project. Hosted execution remains unverified. Added peer privacy, repeated additions, deletion permissions and stale deletion tests. Database suites passed (23 reported results including the two parents) and strict TypeScript passed.
- Next: run overlapping requests on the local stack and repeat browser acceptance with the maintenance controls.

## Homework MVP A · application checkpoint · 2026-11-19

- On `codex/homework-mvp-a` after database checkpoint `7e97eae`, the Assignments and My submissions routes, home card and private grading workspace now use the same Supabase RPCs on mobile and web. The author previews a saved draft before publishing. Student drafts autosave, keep unacknowledged edits in account-scoped memory, and offer explicit reconciliation. The desktop roster and grade panel share the mobile version history and release controls.
- Real-stack verification: applied migrations `202611140001`, `202611140002`, `202611190001` in a disposable local Supabase/PostgreSQL 17 instance. Queried its migration history. Four isolated browser contexts signed in through local GoTrue and exercised the Pages export, PostgREST and actual RLS. The rehearsal passed publication, non-recipient denial, cross-device drafts, visible conflict resolution, recovery after the successful submission response was dropped, draft grade privacy, release, revision, and authenticated deep-link refresh. See [reproduction](HOMEWORK_ACCEPTANCE.md).
- TypeScript, ESLint, 77 app/web tests, identity and homework database suites, formatting, and Expo iOS/Android/web exports passed. No physical-device or hosted homework acceptance has been recorded. Hosted migration status is unverified. The existing Pages deployment is still on its deployment branch.
- Next checkpoint: exercise real concurrent database requests and review the remaining first-batch acceptance cases.

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
