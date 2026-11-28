# 需求追踪矩阵

创建与最近更新 2026-11-28 · MicroHub 审计基线 `32150ab4bdd46327f52e42e2431dfaa0b5198b95`

状态：P = Proposed，D = 相应验收等待既定环境，V = 已有可复验证据（仅对这次重构的实际实现使用）。当前所有目标均 P 或 D。UX-001…020 是具体发现；详见 [审计](../../design/UI_UX_AUDIT.md)。SCR-00…25 的行级验收在 [逐屏](../../design/SCREEN_STANDARDS.md)，ADM-B01…11 在 [管理规范](../../design/screens/ADMINISTRATION.md)。完成后为每行添加变更提交与证据，保留历史。

| 需求      | 研究／现状                         | 要实现的标准                                         | 实际文件（指定模块）                                                                                        | 阶段    | 测试             | 状态 |
| --------- | ---------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------- | ---------------- | ---- |
| NAV-001   | E02、12；UX-001、004               | 共用 capability 导航，工作、次级与账户位置清楚       | app/(tabs)/_layout.tsx、src/components/app-shell.tsx、account-links.tsx                                     | 4       | T-02、T-07       | P    |
| NAV-002   | GF-04、10；UX-003                  | 安全深链、同来源恢复及 fallback                      | app/sign-in.tsx、assignment.tsx、notifications.tsx、scripts/build-pages.cjs                                 | 4       | T-02、T-09       | P    |
| DS-001    | E05、07；UX-008                    | 扩展 Modern Campus 两主题、断点和用途 Token          | src/theme/tokens.ts、provider.tsx、app/_layout.tsx                                                          | 2       | T-01、07、08     | P    |
| CMP-001   | E05、10；UX-010、016               | 共用密度、确认、表单、选择及状态样例                 | src/components/ui.tsx、confirm-dialog.tsx、app/design-system.tsx                                            | 3       | T-02、07、08     | P    |
| AUTH-001  | GF-01；UX-004、015                 | 学校邮箱到合法会籍节点，错误、安全重登、双语         | app/index.tsx、sign-in.tsx、register.tsx、recover.tsx、app/(tabs)/index.tsx                                 | 5       | T-02、03、07     | P    |
| HOME-001  | E02、11、12；UX-001、013           | 首页下一步、按范围下一个工作及月历                   | app/(tabs)/index.tsx、src/components/dashboard.tsx、month-calendar.tsx                                      | 5       | T-04、05、07、10 | P    |
| HW-001    | E04、06、12；UX-005                | 列表、详情、个人历史和复用状态呈现                   | app/(tabs)/homework.tsx、app/assignment.tsx、submissions.tsx、src/features/homework/list.tsx                | 5       | T-02、05、07     | P    |
| HW-002    | GF-05…08；UX-005、009              | 私有附件、提交版本、回执、评分回显及错误恢复         | src/features/homework/student.tsx、files.tsx、discussion.tsx、api.ts                                        | 5       | T-03、05、10     | P    |
| HW-003    | GF-12…14；UX-005、008              | 作者范围与预览、批改与名单、报表、私稿、同意与反馈   | app/assignment-editor.tsx、src/features/homework/{editor,grading,operations,policies}.tsx                   | 6       | T-03、05、07     | P    |
| ATT-001   | E11、12；UX-013                    | 签到、本人回执、活动关联及纠错历史                   | app/(tabs)/attendance.tsx、app/attendance-new.tsx、attendance-session.tsx、src/features/attendance          | 5–6     | T-03、04、10     | P    |
| COM-001   | E03、11；UX-012、013               | 公告及活动范围、时间和创建／回退                     | app/announcements.tsx、announcement-editor.tsx、events.tsx、event-editor.tsx                                | 7       | T-03、07、10     | P    |
| COM-002   | GC-20、50–51；UX-007、012          | 现有资源和提醒范围清楚，授权提醒跳转                 | app/resources.tsx、notifications.tsx、src/components/planned-module.tsx                                     | 7       | T-02、07、10     | P    |
| ADM-001   | E09、16；UX-002、006、010、017…020 | 后台概览、筛选、角色任免、组交接、邀请、会籍和日志   | app/club-admin.tsx、administration.tsx、members.tsx、app/(tabs)/groups.tsx、src/features/club/manage.tsx    | 6       | T-03、06、07     | P    |
| ACC-001   | GC-03、50；UX-001                  | 资料、颜色、主题、语言、隐私与登出                   | app/profile.tsx、settings.tsx、app/(tabs)/more.tsx、src/features/profile-photo.tsx                          | 7       | T-02、03、07     | P    |
| STATE-001 | GF-05、11；UX-009、012             | 网断、过期、刷新、冲突、脏数据保护、正向回执         | src/features/focused-query.ts、form-exit.tsx、busy.ts、src/components/ui.tsx                                | 3–7     | T-02、05、10     | P    |
| RESP-001  | E06、07、10；UX-008                | 同数据与权限，按可用空间呈现，保留装置输入           | src/components/layout.tsx、ui.tsx、app-shell.tsx、src/features/homework/grading.tsx                         | 2、8    | T-07、08、09     | P    |
| A11Y-001  | GC-53、S37、S38；UX-010、011       | WCAG 相应 AA、读屏、焦点、触控及 reduced motion      | src/components/{ui,motion,confirm-dialog}.tsx、src/features/homework/controls.tsx                           | 2–8     | T-02、08         | P    |
| PERF-001  | UX-008、009、014；构建基准         | 安全刷新、分页、列表虚拟化、大小与受控加载           | src/features/{identity,focused-query}.ts、src/features/attendance/api.ts、scripts/build-pages.cjs           | 1、8    | T-10、11         | P    |
| SEC-001   | GC-02、44、59；现有权限基线        | 全会、研教、组与本人隔离，旧 RPC/RLS/文件/历史不回归 | src/features/access.tsx、supabase/migrations、supabase/functions、tests                                     | 0、6、9 | T-03…06          | P    |
| SEC-002   | 已确认后台需求；DDR-05             | 任免预览、理由、最后全权、并发与学生义务切换         | app/administration.tsx、app/(tabs)/groups.tsx、src/features/club/manage.tsx、202611280002、202611280003     | 6       | T-06             | P    |
| SEC-003   | GC-06；已确认后台需求              | 七天邀请、每码一次、合资格、原子兑换／会籍／审核     | app/(tabs)/index.tsx、app/administration.tsx、src/features/club/manage.tsx、club_invite_redeem              | 6       | T-06             | P    |
| TEST-001  | 当前 Quality 和无障碍缺口          | 单测、组件、视觉、权限、集成、构建与多设备矩阵       | tests、scripts、.github/workflows/ci.yml                                                                    | 1、8–9  | T-01…11          | P    |
| GOV-001   | 既有 AGENTS；DDR-10                | 通用规则、可恢复进度及必要自动检查                   | AGENTS.md、docs/DEVELOPMENT_PROGRESS.md、docs/design、UI_UX_PROGRESS.md、ci.yml                             | 10      | T-11             | P    |
| REL-001   | 当前 Pages 与迁移约束              | 发布授权、核实 202611280001、路由可达及线上 commit   | .github/workflows/pages.yml、scripts/build-pages.cjs、supabase/migrations/202611280001_event_attendance.sql | 9–10    | T-09、T-12       | P    |
