# 无障碍验收

创建与最近更新 2026-11-28 · MicroHub 审计基线 `32150ab4bdd46327f52e42e2431dfaa0b5198b95`

依据 [WCAG 2.2](https://www.w3.org/TR/wcag/) AA 与 [React Native Accessibility](https://reactnative.dev/docs/accessibility.html)。目标触控区域 44dp／44 CSS px 是项目设计阈值，WCAG 2.5.8 基线 24 CSS px 有适用例外。正常文字 ≥4.5:1，大字或 UI 边界 ≥3:1（1.4.3、1.4.11）；检查 hover、disabled 旁的说明与所有语义色。200% 文字缩放、320 CSS px 重排依适用准则。

- Web 具跳到主内容、landmark、唯一 H1、符合对象结构的标题和明确 current；Tab/Shift+Tab 无陷阱。相关菜单/Tab 支持方向键时符合语义，Esc 退出；焦点可见且不被 sticky 盖住（2.4.7、2.4.11），对话框关闭回到触发项。
- Native 用正确 role、label、value、state、hint；TalkBack／VoiceOver 能读出标题、选择、忙碌、受众、迟交、空状态和错误。图标装饰从读屏隐藏。
- 用“内容＋图标/形状”表达状态。异步成功通过 live region 或正确的平台口播；长表单错误有上方摘要与字段关系，设置焦点到首错误；敏感数据不写入播报日志。
- 不禁止密码管理器、粘贴和辅助技术输入。避免把拖拽设为唯一操作；跨视口设计阅读顺序一致。
- 系统减少动画时跳过动态转场。清单包含屏幕阅读器手测与 Web 自动化语义扫描。每条记录设备、版本、主题、语言、步骤与结果。
