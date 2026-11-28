# Modern Campus · Design System

创建与最近更新 2026-11-28 · MicroHub 审计基线 `32150ab4bdd46327f52e42e2431dfaa0b5198b95`

**Proposed（以现有实现为起点）**。保留 MicroHub 原有校园标记、墨色与青绿基调、现有图标和系统字体。允许较宽工作区以支持批改和名单。导航、表单和表格以留白、分隔线与清晰状态构成主层级。溢出菜单仅用于当前对象低频命令。喜好设置保留 System／Light／Dark。

## 语义色

| Token 与用途                   | Light                 | Dark                  |
| ------------------------------ | --------------------- | --------------------- |
| background · 页面              | `#F2F8F7`             | `#0C1423`             |
| surface · 表单及内容           | `#FFFFFF`             | `#172235`             |
| surfaceSubtle · 次级槽位       | `#DEF5EE`             | `#153E3D`             |
| selected · 当前状态背景        | `#BCEDE1`             | `#205650`             |
| text · 正文                    | `#10132E`             | `#F2F6FF`             |
| muted · 次级正文               | `#535B66`             | `#BAC6D8`             |
| primary / onPrimary            | `#087F7A` / `#FFFFFF` | `#5EE2CB` / `#092D29` |
| primaryPressed / onPrimary     | `#076D68` / `#FFFFFF` | `#A2F0DF` / `#092D29` |
| borderSubtle · 装饰分隔        | `#DFE6E8`             | `#304159`             |
| borderControl · 控件可识别轮廓 | `#637578`             | `#8191A5`             |
| focus · 焦点可见颜色           | `#087F7A`             | `#5EE2CB`             |
| successText / successSurface   | `#135D40` / `#E1F5EA` | `#A0E8BC` / `#18382B` |
| warningText / warningSurface   | `#8A5518` / `#FFF0DE` | `#FFC38A` / `#442F25` |
| dangerText / dangerSurface     | `#B12A3E` / `#FFF0F2` | `#FF9BA9` / `#44232F` |
| infoText / infoSurface         | `#255B91` / `#E4F1FF` | `#9BC8FF` / `#203650` |
| disabledText / disabledSurface | `#535B66` / `#DFE6E8` | `#BAC6D8` / `#304159` |
| overlay                        | 黑 .48                | 黑 .60                |

沿用现有 primary 和 onPrimary，原色计算分别 4.85:1、9.31:1。提议强边框对应表面的对比为 4.83:1、4.96:1。语义文本与对应色板的最小计算对比为 5.53:1。上述数值基于原始 hex 和 sRGB，仍需在实际 Web 与原生检查透明度、状态叠加与字号。按钮 focus 使用 2px 环及 2px surface 间隙，原生用可见选择与访问焦点，不遮盖状态边框。装饰边线不可传递可操作边界。禁用以语义及原因说明，表单 pending 期间保持按钮尺寸。

## 尺寸与度量

| Token    | 建议值与规则                                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 字体     | iOS System，Android sans-serif，Web system-ui 及系统中文后备；保持动态字号                                                                                    |
| 文字档   | caption 12/18 400；label 14/20 600；body 16/24 400；section 20/28 600；title 28/36 700；仅长文正文建议 65–75 字符宽（中文约 34–40 字）                        |
| 字重     | 400 正文；500 次级／控件；600 标签；700 页标题                                                                                                                |
| 间距     | 4、8、12、16、20、24、32、40、48；列表纵向 8–12；段间 24；页边手机 16、平板 24、桌面 32                                                                       |
| 圆角     | 小标签或图块 6；控件 10；普通面板 14；可选对话框 16；圆形头像及 pill 999                                                                                      |
| 高度     | 交互命中至少 44dp／CSS px，主输入和行 48，紧凑桌面行 44。手机双行行高至少 56，超长换行                                                                        |
| 图标     | 16 细节，20 操作，24 导航；纯图标操作给可懂 EN／中文标签                                                                                                      |
| 表面层级 | 0 默认；1 sticky 或浮层投影 0 2 6 rgba(22,58,64,.10)、elevation 2；2 弹出菜单 0 6 18 rgba(22,58,64,.16)、elevation 4；Dialog 主要由遮罩区分                   |
| 断点     | compact <640；medium 640–1023；expanded ≥1024 CSS px／dp；布局依据容器可用宽度，桌面工作区主从建议 ≥880                                                       |
| 页面宽度 | auth 440、阅读常规 840、工作区 1160、数据 1360；竖屏多栏需要各列满足最小尺寸                                                                                  |
| 动效     | press 100ms，短过渡 160ms，页面 200ms；Reduced Motion 动效 0／立即；不使用动画承担必读反馈                                                                    |
| z-index  | content 0、sticky 10、dropdown 20、overlay 30、dialog 40、exceptional status 50；native overlay 交给 Portal／Modal；阻断 Dialog 的动作不允许被普通 toast 盖过 |

## 工程归口

扩展 `src/theme/tokens.ts`、`provider.tsx`，保留原键对应可验证的兼容期，以语义 Token 替换散落参数。栅格见 `src/components/layout.tsx`；动效接 `motion.tsx`；组件读取当前主题而非直接 import 日间常量。Web 使用共享 Token 的语义映射、平台修正走适用层；文档与 demo 复用相同值和 props。CI 在实施时建立渐进检查，只检测修改过的 UI 样式中的原始颜色与新散落断点，允许 SVG／品牌源和迁移兼容点以书面例外保留。先跑现有 theme、ui、motion 用例及双主题对比，再启用强制规则。
