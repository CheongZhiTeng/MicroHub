# Ultimate Codex Implementation Prompt · MicroHub GUI 重构

创建与最近更新 2026-11-28 · MicroHub 审计基线 `32150ab4bdd46327f52e42e2431dfaa0b5198b95`

你要在 `CheongZhiTeng/MicroHub` 的现有 Expo Router、React Native、Supabase 和 GitHub Pages 项目中，**分阶段实际完成全站 GUI、信息架构和交互重构**。以单一学校电脑学会的日常工作为中心，延续现有 Modern Campus 品牌、双语和两套主题。实现完整可测的用户路径和持久设计治理。研究基线为 `32150ab4bdd46327f52e42e2431dfaa0b5198b95`，只用于差异对照。

## 0. 恢复上下文和接入方式

1. 获取最新 refs，运行 `git status -sb`、`git branch -vv`、`git log --oneline --decorate -12`，检查未提交工作、当前开着的 PR、远端 main、codex/github-pages 和权限开发分支。核对需要保护的未合并或未提交变更，使用独立工作分支／worktree。更新报告时记录真实起点。
2. 先读 [AGENTS.md](../../../AGENTS.md)、[DEVELOPMENT_PROGRESS.md](../../DEVELOPMENT_PROGRESS.md)、[专项进度](UI_UX_PROGRESS.md)、[路线图](IMPLEMENTATION_ROADMAP.md)、[设计索引](../../design/README.md)、[实际文件与功能](../../design/MICROHUB_CURRENT_STATE.md) 及 [追踪矩阵](REQUIREMENTS_TRACEABILITY.md)。
3. 若当前实施分支缺这套设计文件，先从研究 PR 按项目流程取得已经审阅的文档，保留既有 AGENTS 条款与开发日志。对比 `git diff 32150ab4bdd46327f52e42e2431dfaa0b5198b95..HEAD` 的相关范围。路由与测试重新枚举，按现行实现修订逐屏和文件计划，记录决策。
4. 会长后台已在 2081f78、32150ab 合入。先核对 app/club-admin.tsx、src/features/club/manage.tsx、Home 兑换、Groups 的理由、迁移 202611280002/003、tests/club-admin.database.test.mjs、scripts/club-admin-browser.cjs 与当前线上版本。组织权限、旧版本 fallback 和 hosted ledger 分开核验。在缺少测试环境或实际托管能力时，仅相应验收标 Blocked，继续可验证的工作。
5. 研究按需查 [Classroom 目录](../../research/google-classroom/FEATURE_INVENTORY.md) 和 [证据](../../research/google-classroom/evidence/README.md)。采用清晰操作、状态队列、对象菜单和桌面评阅空间。App 需保持自己的产品结构、颜色、标志和视觉表达。

## 1. 业务不变量与保护

- 单学会及其大课、小组权属保持。保留真实 Supabase 数据、现有功能、路由与安全深链、API 参数兼容、历史、数据可见性和已有技术角色或岗位。现有角色为 member/admin/super_admin。会长和副会长由现有 office 带技术权限；以已合入 RPC 的实际授权为准。原研教继续其身份和授权。
- 会长、副会长可管理全会与所有小组的作业、成绩、私密反馈、附件、签到、公告与活动；学校邮箱所有权、当前有效账号、会籍及有效权限均由服务端确认。旧客户端直接 RPC、Edge Function、Storage 与 RLS 继续执行同样规则。Group scope、模式、按钮隐藏、深链参数及可编辑资料不授予访问权。
- 晋升使该成员离开尚待交作业和进行中签到的应到名单。保留已交作业、原提交回执、成绩、私人反馈、签到及更正历史。降回学生只从新分配开始。任免显示影响并填写原因，防并发误改，保护最后有效全权限管理员。
- 后台覆盖管理概览、入会申请、成员搜索与筛选、身份任免、停用／恢复、移除／恢复会籍、委员会职位、学会名称及 Logo、可筛选操作记录及带组人员交接。手机与桌面使用同一权限与数据。
- 全权限管理者生成、复制、撤销邀请码。默认七天、一次性兑换、学生须符合入会条件、验证学校邮箱，填中英文名与班级。服务器事务同时兑换、入会及结清待审申请。次数、失效、竞态及最后负责人均由服务端控制。
- 保持作业受众快照、分配与修订窗口、幂等回执、共享草稿与个人成绩、长期历史、反馈稿与已发布版本、批量退回同意、文件短时授权、签到活动链接和取消行为。个人档案、申请状态、讨论和组内容均按实际授权管理。
- 禁止用样例假装接通正式功能、加入虚假的互动按钮、为 UI 绕过服务端校验、删除难重构的功能、关闭测试、把秘密或真实学生资料写入仓库、调整生产数据或擅自部署。本地 UI fixtures 仅可用于测试，按授权使用独立测试数据库。数据库差异须维护历史、旧客户端合同和原有测试，并按权限项目流程实施。
- 生产发布前核实 `202611280001_event_attendance.sql`、`202611280002_club_administration.sql`、`202611280003_club_roster_groups.sql` 与后续已批准迁移的实际目标项目执行历史。Git 中文件和本地 PGlite 测试不能证明托管库已迁移。缺证据先保留兼容路径并记录阻塞。

## 2. 实际实施

按 [路线图](IMPLEMENTATION_ROADMAP.md) 逐阶段提交。每项回到 [文件计划](FILE_CHANGE_PLAN.md) 与 [需求矩阵](REQUIREMENTS_TRACEABILITY.md)，映射到具体页面文件、组件、验收和提交。

- **Token 与组件**。在 `src/theme/tokens.ts` 和 `provider.tsx` 扩展既有键，落实 [Design System](../../design/DESIGN_SYSTEM.md)。优先 `src/components/ui.tsx`、`layout.tsx`、`motion.tsx`、`confirm-dialog.tsx` 及 `homework/controls.tsx` 里的已用模式。兼容旧调用，重构后逐步收敛相同变体。样册扩展真实组件状态，以动画及颜色可验证的检查逐步扩大覆盖。改动的 UI 避免散落原始颜色和断点，支持明暗主题、集中双语与语义状态。
- **应用 Shell**。协调 `src/components/app-shell.tsx`、`account-links.tsx`、`app/_layout.tsx`、`app/(tabs)/_layout.tsx`、`app/(tabs)/more.tsx` 和 `app/sign-in.tsx`，使用 [目标导航](../../design/INFORMATION_ARCHITECTURE.md)。用同一能力入口表渲染移动／平板／桌面，保留已验证 URL，确保只在允许范围恢复路径、焦点和筛选。继续遵守 `scripts/build-pages.cjs` 的固定路径发布规则。
- **逐屏实现**。按 [SCR-00…25](../../design/SCREEN_STANDARDS.md) 评审，包括所有 Router 布局、启动、登录、OTP、恢复、入会与异常，Home、活动月历、作业列表/详情/编辑/附件/提交/讨论/回执/评分与管理、签到、公告、活动、资源入口、小组、成员、通知与偏好、后台、个人资料、设置、更多、内部样册。对比今日 routes，并为新合并的真实界面补屏幕编号。对计划项例如资源、普通公告附件／编辑／评论、RSVP、通用未读及推送，只按批准能力与实际接口接入；保留现状与实用回退。
- **学生与研教路径**。优先明确下一项动作和真实范围。保持月历、按班级范围组织的发布与评阅、队列和文件引用。移动和桌面用相同的数据与状态，桌面宽空间可用主从视图；窄屏保留可返回的路线与焦点。
- **管理界面**。依 [ADM-B01…11](../../design/screens/ADMINISTRATION.md) 重构已合入的 /club-admin 与原 /administration、Home 兑换及 Groups 模块。危险命令先显示对象、影响、理由和确认，一次送出；冲突时重核对而非默默重试。审计、最后管理员、一码一次和历史记录均要对应真实测试。
- **交互与响应式**。执行 [状态规范](../../design/INTERACTION_PATTERNS.md) 和 [跨平台设计](../../design/RESPONSIVE_DESIGN.md)。包括默认、初载、空、筛选无匹配、刷新中、局部错误、成功、禁用、hover、focus、selected、网络中断、会话过期或拒绝。对表单实现字段错误、文件恢复、草稿未保存保护和必要的重复请求防护，失败可安全返回。验证 Android、iOS、Mobile Web、Tablet Web、Desktop Web。
- **无障碍与性能**。依据 [AA 验收](../../design/ACCESSIBILITY.md) 与 [性能](../../design/PERFORMANCE_GUIDELINES.md) 验证。测出首载、切页、列表规模和数据刷新基线后再合并或虚拟化；权限缓存只按同会话同范围安全用。记录实测 Web、原生语义差异及证据。

## 3. 验证、进度和长期约束

按 [测试计划](TEST_PLAN.md) 运行 Node 24 的 `npm ci`、`npm run check`、`npx expo export --platform all`、`npm run build:pages`。沿用 Jest、RN Testing Library、Web Jest、PGlite、Deno 与 Playwright 工具链；覆盖单元、组件、集成、E2E、浏览器、真机、权限隔离、性能、回归和视觉对比。相关工作要用独立测试库验证跨组及低权限拒绝、晋升前后统计、历史保留、同时任免和邀请码双重请求；使用模拟身份和数据。未经授权不接触生产真实数据。写浏览器自动化时确认测试 fixture 与实际数据库验收是不同证据。

阶段可独立验证后，更新 [主开发日志](../../DEVELOPMENT_PROGRESS.md)、[专项进度](UI_UX_PROGRESS.md) 及矩阵；记录 branch、commit、实际文件、状态、已执行命令及计数、剩余任务、已知缺口和下一项，按 AGENTS 创建可追溯提交。失败测试修复或有证据记录阻塞，不借改门槛使通过。

在相关设计获得批准、兼容验收完成时，将 ADR 转为 Accepted/Implemented/Verified 并标证据。把长期规则加到 AGENTS：改 UI 前阅读适用规范，优先 Tokens 与现有组件，保持导航、视觉与交互，考虑原生与 Web、全部适用状态和无障碍，保留权限与业务合同，验收并更新文档和主进度。更新 [组件规范](../../design/COMPONENT_GUIDELINES.md)、[逐屏规范](../../design/SCREEN_STANDARDS.md)、[决策](../../design/DESIGN_DECISIONS.md) 与 [验收清单](../../design/UI_UX_ACCEPTANCE_CHECKLIST.md)。将可测设计要求转成质量流水线检查，禁止把一次性重构排程写进长期规则。未来的设计偏移记录原因、影响、更新的实现及测试。

## 4. 断点恢复

遇 Token、Context、Usage Limit、会话中断或模型切换，先保存已知的真实进度。重新进入后依次检查 Git 状态、AGENTS、主开发日志、专项进度、近期提交、当前任务的逐屏与规范、实际代码和已有测试结果。从第一项未完成且依赖已满足的任务继续。不要重复有证据的工作，也不假定上次聊天完成了任何事。必要时留下当前分支、未提交文件概况和待运行命令。

## 5. 发布与完成定义

按照 [发布清单](RELEASE_CHECKLIST.md) 和现行 AGENTS 使用合适发布分支。在明确发布授权、环境权限及相关验收都具备时，经正常流程推进。没有生产授权即停在通过的代码／测试及 PR 交接，保护 main 与部署分支现状。验证 Pages 的 release marker、基路径与直达路由，勿以 bundle 生成替代上线验收。

完成用于 GUI 重构的标准：最新全部实际路由和已确认后台均有实现与对应矩阵、多个角色操作链路和异常状态验证；现有功能、旧客户端、数据、历史与权限不回归；移动、平板、桌面、双主题、双语、a11y 和性能要求有证据；三平台导出与 Pages 构建及相应测试通过；长期规则、进度、设计决策与 CI 机制据实同步。仅局部实施时保留对应任务为部分完成。对依赖或尚可复验事项明确写需要的人员／环境、待核验的具体项目和下一项安全操作。
