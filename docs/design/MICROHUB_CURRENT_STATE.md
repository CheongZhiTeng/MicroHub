# MicroHub 审计基线

创建与最近更新 2026-11-28 · MicroHub 审计基线 `32150ab4bdd46327f52e42e2431dfaa0b5198b95`

仓库 CheongZhiTeng/MicroHub；GitHub 连接器显示读取、推送和管理权限。初检是 188ed84，写入前远端发布了 2081f78 和 32150ab。最后对照时 main、codex/github-pages、codex/club-admin 都处于 32150ab。研究以此为最终基线。初检的连接器搜索、公开 PR API 及 Git PR refs 均未发现已有 PR。其他 Codex 工作区的未提交文件未访问。线上 release marker 与本地和远端分开核验，详见专项进度。

## 架构

| 层            | 证据与边界                                                                                                                                                                                                                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Router        | app 下 28 个 TSX 文件，2 个布局、1 个启动入口、25 个具体界面入口；首页同逻辑 URL 另有启动入口。管理与编辑通过固定路径＋参数。                                                                                                                                                                                                                    |
| 表现          | src/components 下 33 个首字母大写的导出函数，src/features TSX 下另有 32 个，总计 65 个 UI／布局／Provider 入口；含 Provider、布局及页面辅助组件。私有组件不计。查看 [组件规范](COMPONENT_GUIDELINES.md) 与 [屏幕索引](SCREEN_STANDARDS.md)。                                                                                                     |
| Token／本地化 | src/theme/tokens.ts、provider.tsx 和 src/locales/{en,zh,provider}。System／Light／Dark，中文与英文。根布局有主题、语言、动效、Session、作业草稿 Provider。现有 SVG 图标和品牌图片继续保留。                                                                                                                                                      |
| 权限与状态    | src/features/access.tsx 和 identity.ts、session.tsx；技术角色 member/admin/super_admin；office 为 president、vice_president 或现有研教展示（以技术权限和数据库列为准），再区分会籍、账号状态、组内职责和委员会职位。src/features/class-scope.tsx、daily.ts 和 groups/api.ts 提供大课／小组上下文。                                               |
| 数据          | src/lib/supabase.ts、config.ts、session-storage.ts；以模块 RPC 和 TS 类型为主，未发现统一生成的 Database Types 文件或外部状态库。useFocusedQuery、useAttendanceRead、局部 state 与实时讨论负责刷新。OAuth 等能力按实际分支确认。                                                                                                                 |
| 数据库        | versioned supabase/migrations 与 supabase/config.toml。身份、RLS 和操作审计先从 202611140001；作业、私有附件、组工作区、公告、日历、日常工作流、签到和会长后台分别有后续迁移。权限基线含 202611280002 与 202611280003。Supabase Edge Functions 包括 review-membership、homework-files、delete-group、profile-avatar。                            |
| 构建          | package.json 要求 Node 24；Expo Router、React Native Web、Supabase。app.config.js 在 Pages 下设 /MicroHub 与 SPA；scripts/build-pages.cjs 给固定路由复制入口并明确拒绝动态文件路由。.github/workflows/ci.yml 运行 Quality；pages.yml 仅监听 codex/github-pages。                                                                                 |
| 现有 docs     | [项目架构](../ARCHITECTURE.md)、[功能矩阵](../FEATURE_MATRIX.md)、[开发日志](../DEVELOPMENT_PROGRESS.md)、[作业规格](../HOMEWORK_SPEC.md)、[签到／日历运行记录](../DEVELOPMENT_PROGRESS.md)、[UI V2](../MODERN_CAMPUS_V2.md)、[Pages](../GITHUB_PAGES.md)。矩阵部分状态比源码旧，特别是原始 V1/V2 计划；以执行路径、已运行测试与证据表交叉确认。 |

## 模块状态

| 模块                 | 结论                                     | 证据与未验证边界                                                                                                                                                                          |
| -------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 登录／注册／恢复     | 已实现；本轮已观察 3 个已部署入口        | 未填写生产资料、未真实发邮件；本地 Jest 验证注册／校验／找回密码；账户恢复会话仍保持隔离。                                                                                                |
| 学校身份、申请与审核 | 已实现且 CI 本地路径已验证               | Home `apply_for_membership`、Administration `review_membership`；等待或拒绝在 Home 处理；源码只取 30 条，待实测大量积压。                                                                 |
| 技术身份、会籍、任免 | 已合入并有隔离测试，托管待验证           | 2081f78 与 32150ab 引入 office、版本检查、更正审计、历史保留与最后全权限保护；完整客户端在 app/club-admin.tsx 与 src/features/club/manage.tsx。                                           |
| 小组及班级           | 已实现，测试覆盖隔离                     | groups 工作区及 class scope；候选成员和带组操作当前有实现；小组任命研教填写原因，成员版本包含带组／组长关系；带组替代、接任及事务条件以现有 group_change 和 club_member_change 合同为准。 |
| 作业                 | 已实现及本地验证多个生命周期             | 作者、受众、草稿、发布、排程、各类提交及修订、回执、成绩、反馈、讨论、组作业、名单、政策、报表、规则及历史：见作业 specs；未登录正式环境。                                                |
| 签到／活动联动       | 已实现及本地验证服务端合同               | attendance 迁移和 event-attendance；六位码、出席时窗、名单、历史、更正、取消及竞态。通过的本地测试不代表托管迁移已执行。                                                                  |
| 公告                 | 已实现，覆盖范围及角色合同               | 独立列表和编辑器，大课／小组，已核实分页和发布。尚未看到单独详情、发布后编辑、归档、附件、评论、定时或置顶的客户端入口及完整服务端合同。                                                  |
| 活动／月历           | 已实现基本流，未登录正式环境             | 月历和事件列表、编辑、取消和活动关联签到。未发现 RSVP 流程的完成证据，独立活动详情路由也未见。                                                                                            |
| 成员、资料、设置     | 已实现，组件和权限有测试                 | 搜索及分页、双语姓名、头像、主题及语言。成员目录无独立个人管理等同页；安全选项按现有代码。                                                                                                |
| 通知                 | 部分实现                                 | 基线为作业提醒并有偏好、分页及跳转，未发现通用未读标记、系统 Push、邮件通知中心。                                                                                                         |
| 资源                 | 路由已实现为计划占位，独立资源库尚未实现 | app/resources.tsx→PlannedModule；作业附件和资料链接属于已实现的其他功能。                                                                                                                 |
| 邀请码与综合学会后台 | 已合入并可由本地隔离证据支持；托管待证   | ClubAdmin 六区、申请独立页、Home 兑换及私有 Logo 已出现，功能由 202611280002、202611280003 及新版 profile-avatar 支持。保持 office 列存在检查和安全降级。                                 |
| 原始功能矩阵其它项目 | 视实际证明为计划或未知                   | 匿名箱、全局提及、全站检索、RSVP、Widget、离线写入等不得因矩阵含标题即认定完成，重构不扩大业务。                                                                                          |

## 证据边界

核对了三条公开部署路线。已保存的旧版截图在 [docs 截图目录](../screenshots/) 属历史证据。未授权登录 MicroHub 正式环境，未使用真实学生资料。测试、生产迁移、CI 与实体设备边界见 [专项进度](../implementation/ui-ux-overhaul/UI_UX_PROGRESS.md)。

## 32150ab 新增合同

- `/club-admin` 为独立全权限路由。`club_admin_panel` 提供概览、成员、组、邀请码和审计。委员会表和学会设置使用既有只读权限，写入通过 `club_position_save`、`update_club` 和经授权的私有 Logo Edge 路径。
- `club_member_change` 校验人员版本和原因；`202611280003_club_roster_groups.sql` 扩展人员的组范围与版本字段。Last admin、角色变化和后端名单保全依赖迁移本身。旧的 `admin_set_account` 与 `group_change` 路径依据现有数据库兼容合同处理。
- Home 在迁移列可用时提供 `club_invite_redeem`。入会资料通过个人资料页补齐；服务器核验并提交同一事务。客户端出错或部署环境缺迁移时保留正常申请入口。
- Managed browser 与开发日志所记隔离浏览器均未触碰真实学生资料。生产迁移及 Edge 更新不能由部署代码版本推断。
