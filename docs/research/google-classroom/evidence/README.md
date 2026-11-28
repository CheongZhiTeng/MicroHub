# 界面证据与结构

创建与最近更新 2026-11-28 · MicroHub 审计基线 `32150ab4bdd46327f52e42e2431dfaa0b5198b95`

| ID  | 页面／角色／平台                                | 证据级别与观察                                                                                                                  | 迁移价值                     |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| E01 | 登录 · 未授权 · Desktop Web                     | OBSERVED：产品入口转公开介绍，随后点击产品登录链接可见账户标识输入、Next 和账户创建；未认证                                     | 登录和可访问内容分清         |
| E02 | Home／班级卡 · 师生 · Desktop                   | OFFICIAL S05、S06、S34；SECONDARY S35                                                                                           | 识别频繁入口与卡片菜单       |
| E03 | Stream · 师生 · Desktop                         | OFFICIAL S07、S08、S34                                                                                                          | 保留公告专属操作             |
| E04 | Classwork · 师生 · Desktop                      | OFFICIAL S05、S13、S34                                                                                                          | 按主题或范围和对象呈现       |
| E05 | 作业编辑 · 教师 · Desktop                       | OFFICIAL S09、S34                                                                                                               | 主字段、受众和时间分组       |
| E06 | 作业详情及提交 · 学生 · Desktop                 | OFFICIAL S15、S34                                                                                                               | 明确个人工作及确认           |
| E07 | Student work 名册 · 教师 · Desktop              | OFFICIAL S16、S34                                                                                                               | 按批改任务筛选               |
| E08 | 文件批改及历史 · 教师 · Desktop、Android 文档   | OFFICIAL S16、S17                                                                                                               | 详情与名册连续               |
| E09 | People · 师生 · Desktop                         | OFFICIAL S06、S34                                                                                                               | 普通目录与管理入口分离       |
| E10 | Grades · 教师 · Desktop                         | OFFICIAL S16、S19、S34                                                                                                          | 点数与返还发布分离           |
| E11 | Calendar · 师生 · Desktop                       | OFFICIAL S22                                                                                                                    | 日期与工作项直接关联         |
| E12 | To-do／To review · 师生 · Desktop               | OFFICIAL S06、S18、S40                                                                                                          | 优先展示下一步               |
| E13 | 通知与设置 · 师生 · Android 文档                | OFFICIAL S23                                                                                                                    | 同步控制与分类               |
| E14 | 班级设置 · 教师 · Desktop                       | OFFICIAL S08                                                                                                                    | 解释发帖、课业摘要、班级治理 |
| E15 | Practice sets · 师生角色的 Desktop 演示         | OBSERVED S44：Start 后左侧分章节、中央图例、底部前后／暂停／文稿；VERIFIED：点击 Next 从 Resources 示意到录入题名的步骤；仅演示 | 跨步骤保留可见进度           |
| E16 | Analytics／Class visits · 管理员的 Desktop 演示 | OBSERVED S45：Start 后显示角色、指定用户和组织单位三个阶段及 Education Plus 提示；第二画面反馈未确认                            | 权限变化先说明范围           |

浏览日期为 2026-11-28（MYT）。为避免把演示示例、账号资料或 Google 品牌资源再分发到公开仓库，证据采用结构记录及权威链接，零张第三方截图入库。核心画面的原创示意结构见 [GUI](../GUI_ANALYSIS.md) 和 [页面树](../INFORMATION_ARCHITECTURE.md)。交互演示的真实测试数据库和真实课堂网络路径均不在观察范围内。
