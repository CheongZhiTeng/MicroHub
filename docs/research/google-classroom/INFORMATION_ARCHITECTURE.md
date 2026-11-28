# Classroom 页面结构

创建与最近更新 2026-11-28 · MicroHub 审计基线 `32150ab4bdd46327f52e42e2431dfaa0b5198b95`

证据 S05、S06、S08、S16、S18、S23、S28、S34、S44、S45。带权限的入口来自官方说明或图解。运行时路径、浏览器回退和动态重定向为 UNVERIFIED。

- Google 登录 → Classroom Home。
  - 全局 App Shell → 侧栏菜单、账户、通知、Google apps。
  - 首页 → Teaching／Enrolled／Admin（按资格） → 班级卡 → Stream；卡片可进入个人工作或班级文件，卡片菜单处理低频操作。
  - 全局工作流 → 学生 To-do（Assigned／Missing／Done）、教师 To review → 项目详情。
  - 全局 Calendar → 班级范围 → 日期、作业详情或外部 Calendar。
  - 全局 Settings → 通知渠道及类别、班级设置开关与设备选项；个人账号归 Google 账户。
  - 归档班级 → 只读班级 → 可用角色的恢复／删除。
  - 教师 Resources → Practice sets（适用版次）。
- 班级上下文。
  - Stream → 近期内容、公告、评论、编辑溢出菜单和即将到期提示；可选 Meet。
  - Classwork → 主题 → 作业／测验／问题／资料 → 详情。
    - 学生 → Your work、附件、提交确认、私人评论、可见成绩；View your work 为该班个人记录。
    - 教师 → Create → 编辑器 → 草稿／定时／发布；作业 → Student work 名册 → 文件及评分 → 历史／退回。
  - People → 教师、学生、适用邀请和管理入口。
  - Grades → 成绩矩阵、适用导出，点击作业或学生进入明细。
  - Class settings → 班级资料、邀请码、Stream 规则、计分和高级选项。
- Workspace 管理 → Admin console 的教师验证／单位作用域、SIS、日志；获授工开放的教育领导视图及临时课堂访问。

全局处理跨班级事务，班级标签负责本班任务，菜单处理行级低频动作，详情负责当前对象。当前证据支持主题、状态、班级等局部筛选。跨内容全文搜索、查询回退保真和通知跳转目标删除后的路径待验证。
