# 逐屏设计总表

创建与最近更新 2026-11-28 · MicroHub 审计基线 `32150ab4bdd46327f52e42e2431dfaa0b5198b95`

以路由文件为可追踪单位。SCR-00 为启动入口，SCR-01 到 SCR-25 共 25 个实际界面；作业工作区内共用路径的子状态继续列入相应屏幕。文件编号稳定，目标为 **Proposed**。实作前按现状差异修订。

| ID     | 界面                                 | URL                    | 基线文件                      | 模块规范                                                   |
| ------ | ------------------------------------ | ---------------------- | ----------------------------- | ---------------------------------------------------------- |
| SCR-00 | 入口与启动                           | `/`                    | `app/index.tsx`               | [认证与会籍启动](screens/AUTH.md)                          |
| SCR-01 | 登录                                 | `/sign-in`             | `app/sign-in.tsx`             | [认证与会籍启动](screens/AUTH.md)                          |
| SCR-02 | 注册／邮箱 OTP                       | `/register`            | `app/register.tsx`            | [认证与会籍启动](screens/AUTH.md)                          |
| SCR-03 | 密码找回、重置                       | `/recover`             | `app/recover.tsx`             | [认证与会籍启动](screens/AUTH.md)                          |
| SCR-04 | 首页、资料完善、申请与异常           | `/`                    | `app/(tabs)/index.tsx`        | [学会首页](screens/HOME.md)                                |
| SCR-05 | 作业列表及待办                       | `/homework`            | `app/(tabs)/homework.tsx`     | [作业与提交](screens/WORK.md)                              |
| SCR-06 | 作业详情、个人提交、讨论、评阅、管理 | `/assignment`          | `app/assignment.tsx`          | [作业与提交](screens/WORK.md)                              |
| SCR-07 | 创建和编辑作业                       | `/assignment-editor`   | `app/assignment-editor.tsx`   | [作业与提交](screens/WORK.md)                              |
| SCR-08 | 我的提交                             | `/submissions`         | `app/submissions.tsx`         | [作业与提交](screens/WORK.md)                              |
| SCR-09 | 签到首页、本人历史及授权概况         | `/attendance`          | `app/(tabs)/attendance.tsx`   | [签到](screens/ATTENDANCE.md)                              |
| SCR-10 | 发起普通或活动签到                   | `/attendance-new`      | `app/attendance-new.tsx`      | [签到](screens/ATTENDANCE.md)                              |
| SCR-11 | 签到会话、名单和更正                 | `/attendance-session`  | `app/attendance-session.tsx`  | [签到](screens/ATTENDANCE.md)                              |
| SCR-12 | 公告列表、正文及未来附件边界         | `/announcements`       | `app/announcements.tsx`       | [公告、活动、资源、成员、小组、通知](screens/COMMUNITY.md) |
| SCR-13 | 公告创建与未来编辑边界               | `/announcement-editor` | `app/announcement-editor.tsx` | [公告、活动、资源、成员、小组、通知](screens/COMMUNITY.md) |
| SCR-14 | 活动及日历                           | `/events`              | `app/events.tsx`              | [公告、活动、资源、成员、小组、通知](screens/COMMUNITY.md) |
| SCR-15 | 活动新增、编辑、取消                 | `/event-editor`        | `app/event-editor.tsx`        | [公告、活动、资源、成员、小组、通知](screens/COMMUNITY.md) |
| SCR-16 | 资源入口                             | `/resources`           | `app/resources.tsx`           | [公告、活动、资源、成员、小组、通知](screens/COMMUNITY.md) |
| SCR-17 | 我的组、大课、小组工作台             | `/groups`              | `app/(tabs)/groups.tsx`       | [公告、活动、资源、成员、小组、通知](screens/COMMUNITY.md) |
| SCR-18 | 成员目录、查找及已有资料展示         | `/members`             | `app/members.tsx`             | [公告、活动、资源、成员、小组、通知](screens/COMMUNITY.md) |
| SCR-19 | 作业提醒和偏好                       | `/notifications`       | `app/notifications.tsx`       | [公告、活动、资源、成员、小组、通知](screens/COMMUNITY.md) |
| SCR-20 | 申请审核及目标管理后台               | `/administration`      | `app/administration.tsx`      | [学会后台](screens/ADMINISTRATION.md)                      |
| SCR-21 | 资料、双语姓名、班级、头像           | `/profile`             | `app/profile.tsx`             | [账户与样册](screens/ACCOUNT.md)                           |
| SCR-22 | 主题、语言、账号及隐私信息           | `/settings`            | `app/settings.tsx`            | [账户与样册](screens/ACCOUNT.md)                           |
| SCR-23 | 次级工具与登出                       | `/more`                | `app/(tabs)/more.tsx`         | [账户与样册](screens/ACCOUNT.md)                           |
| SCR-24 | 内部样册                             | `/design-system`       | `app/design-system.tsx`       | [账户与样册](screens/ACCOUNT.md)                           |
| SCR-25 | 学会后台首页与六个管理区             | `/club-admin`          | `app/club-admin.tsx`          | [学会后台](screens/ADMINISTRATION.md)                      |

- `app/_layout.tsx` 验收包括 provider 层次、状态栏深浅色、Reduce Motion、退出草稿与 AppShell 不移除路由树。
- `app/(tabs)/_layout.tsx` 验收包括移动五项、宽屏互斥、active/selected、会籍恢复与轮换设备保留状态。
- 全屏统一格子结构为「返回或导航 → 作用范围＋标题与主操作 → 状态或筛选 → 内容 → 低频操作」。[导航](INFORMATION_ARCHITECTURE.md) 决定返回行为。未授权、计划外和迁移等待不额外启用入口。
- 目标后台子视图和邀请见 [管理规范](screens/ADMINISTRATION.md)。既有业务场景与条件见 [工作](screens/WORK.md)、[签到](screens/ATTENDANCE.md) 和 [社区](screens/COMMUNITY.md)。
