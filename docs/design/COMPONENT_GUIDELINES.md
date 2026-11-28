# 组件架构

创建与最近更新 2026-11-28 · MicroHub 审计基线 `32150ab4bdd46327f52e42e2431dfaa0b5198b95`

Proposed。首先延续 `src/components/ui.tsx`、`confirm-dialog.tsx`、`motion.tsx`、`layout.tsx` 和模块控制组件。表中“建议归口”是扩展起点，确需拆出时保留兼容导出。所有适用组件遵循 [Token](DESIGN_SYSTEM.md)、[状态](INTERACTION_PATTERNS.md)、[视口](RESPONSIVE_DESIGN.md)、[无障碍](ACCESSIBILITY.md)。命名 props 为提议，实施时保持现有调用兼容。禁止因样册创建无人使用的组件。

| 组件                                           | 规格与关键 props                                                                       | 使用限制、平台、无障碍                                                             | 建议归口                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Button／IconButton                             | primary、secondary、ghost、danger；44/48；label、icon、busy、disabled、onPress         | 单工作区单主按钮；Icon 仅对熟悉动作，给可读 label 和 tooltip；状态无需改宽         | Existing ui.tsx Button、IconButton；motion.tsx                    |
| TextInput／TextArea／FormField                 | single、multi、password；label、hint、error、required、readOnly；短 48、多行随文本增长 | label 常驻，长输入可上下滚动；密码沿用 OTP 粘贴和眼睛键盘控制                      | Existing ui.tsx Field、PasswordField                              |
| SearchInput                                    | value、onChange、onSubmit、onClear、busy；48，高级筛选单独呈现                         | 普通搜索行支持清除和 Enter；无直接服务器搜索合同的资源不加                         | Existing members.tsx 搜索，复用 member-search.ts；可重构至 ui.tsx |
| Select／Dropdown                               | 单选，label、value、options、disabled、error；默认与长列表                             | Web use 键盘、支持 Esc；窄屏可展开或用已有 Dialog；选项少时 Choices                | Existing homework/controls.tsx Choices，通用适配                  |
| Checkbox／Radio／Switch                        | checked、disabled、onChange，选择组有 groupLabel                                       | Checkbox 多选，Radio 排他，Switch 为即时持久设置并公布结果；全部 ≥44               | Existing Choices、theme-picker.tsx、notifications.tsx             |
| Tabs／SegmentedControl                         | items、selected、onChange；3–5 主标签，短筛选可用段控制                                | 语义分别采用路由或 tab；键盘可移动，溢出时滚动或使用选择器                         | Existing Tabs、Choices；共享导航配置为 Proposed New               |
| Card／ListItem                                 | panel 或 interactive row；title、subtitle、meta、accessory、onPress                    | 传统列表用分隔，不嵌套可点卡；次要动作和整行激活独立；手机双行，自适应中英         | Existing Card、NavigationRow                                      |
| DataTable                                      | columns、rows、selection、sortKey、onSort、pagination；桌面可读列宽                    | 桌面表语义、键盘使用有序；手机转换成含字段名的行／详情。无独立排序权限时禁用伪入口 | Proposed New data-table.tsx，由管理员与批改复用后再推广           |
| Badge／Avatar                                  | variant、label；Avatar 尺寸 32/40/48、fallback 及授权状态                              | 徽章有文字；个人身份通过名字表达；缩略图按授权，不缓存带符号 URL                   | Existing ui.tsx、profile-photo.tsx                                |
| Tooltip／ContextMenu／DropdownMenu             | Tooltip 短提示；菜单 items、triggerLabel、anchor、destructive                          | Tooltip 不承载必需说明；菜单 Tab、Esc、焦点还原；触屏有明显的触发按钮              | Proposed New menu.tsx，仅实测有复用需求时拆出                     |
| Modal／Dialog／BottomSheet／ConfirmationDialog | title、description、primary、dismiss、busy、returnFocus；危险操作对象和原因            | 断网或键盘弹起可退出；多步骤高风险优先整页或屏内 Dialog；底部抽屉用于短命令        | Existing confirm-dialog.tsx，必要时加平台外观                     |
| Toast／Snackbar／Banner                        | tone、message、action、onDismiss；重要 Banner 常驻；短状态可自动收起                   | 不能只用短 toast 告知数据已持久化；普通成功不抢焦点，高优先错误可播报              | Existing Notice；无动作的全局 Snackbar 待用例证明                 |
| Skeleton／Spinner／ProgressIndicator           | label、busy、value／total；默认在局部加载                                              | Skeleton 匹配结构并禁止重复播报，未知进度不用假百分比，进度可重达                  | Existing Loading 与文件进度，保留 reduced motion                  |
| EmptyState／ErrorState／OfflineState           | title、detail、action、scope；区分真空、筛选无结果、初载错误及局部错误                 | 未授权不泄漏；失败不伪装成功，离线不承诺写入                                       | Existing Notice、FetchState，Proposed New collection-state.tsx    |
| FilterBar／Pagination                          | values、results、reset、onChange；page、nextAllowed、busy                              | 分页同范围，状态保留；窄屏筛选可折叠；分页键盘与读屏明确                           | Existing Choices、Paging、ClassScope                              |
| FileUploader／FilePreview                      | kind、maxSize、allowed、onRetry、onRemove、progress、onOpen；文件名及状态              | 复用校验和服务端签发；Web／native 行为差别保留；危险删除后新签名与回退             | Existing homework/files.tsx、profile-photo.tsx                    |
| DatePicker／TimePicker                         | value、timeZone、min、error、onChange，日期和时间分开                                  | 统一 MYT 与原有日期解析；原生选择器、Web 键盘输入各自可达；无事件读写时纯展示      | Existing app/event-editor.tsx、homework/editor.tsx、lib/dates.ts  |
| PageHeader／SectionHeader                      | title、description、back、actions、scope；标题仅一次                                   | 详情与主入口用相同命名；屏幕阅读顺序领先主操作；特殊层不复用空装饰图标             | Existing Screen、SectionTitle                                     |
| Navigation Components                          | capability、destinations、active、unread（仅有真实数据）、back                         | 隐藏未授权链接但后端独立检查；可访问标签、保留来源及显示当前                       | Existing AppShell、AccountLinks、TabsLayout                       |

保留作业 `StudentWork`、`FilePanel`、`Grading`、`Reports`、`GradingLibrary`、`Discussion` 与签到 `AttendanceOverview`、`AttendanceSession` 的业务归属。页面通用化通过组合，再按真实复用量拆分。当前 65 个大写导出入口的统计口径见 [基线](MICROHUB_CURRENT_STATE.md)。
