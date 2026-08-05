# Task 10 — SP9-P3 静态配色自查报告

方法:真机 fixture 拼与组件模板同构的静态 HTML(真实 `theme.css` + `theme.sp9.css` +
`settings.css`,以及 `SettingsShell.vue` / `Dialog.vue` / `AppPathDialog.vue` 各自
`<style scoped>` 的字面量拷贝),用本机 `~/.cache/ms-playwright/chromium-1228` 的
headless chromium 截图。全程只读:未改仓库任何文件,未发任何写请求。

harness 文件与截图都在 `/tmp/claude-1000/-home-nimo-NimoTech/bc00dd6c-5011-462d-95b1-0f3181b3993c/scratchpad/harness-p3/`
(HTML 源文件在该目录下,截图在其 `shots/` 子目录),会话结束后按 scratchpad 惯例可清理,
不在仓库里。

## 截了哪些图

`shots/` 目录,每个文件名即“页面-主题-宽度”:

| 文件 | tab / 弹窗步骤 | 主题 | 宽度 |
|---|---|---|---|
| apps-w1280.png / apps-light-w1280.png | 应用(App 数据三行 + Docker 清理 + 待上传清除) | 暗/亮 | 1280 |
| apps-w420.png / apps-light-w420.png | 同上 | 暗/亮 | 420(窄屏) |
| status-w1280.png / status-light-w1280.png | 系统状态(17 行,3 组) | 暗/亮 | 1280 |
| status-w420.png / status-light-w420.png | 同上 | 暗/亮 | 420 |
| terminal-w1280.png / terminal-light-w1280.png | 终端与日志(空态 + 日志卡) | 暗/亮 | 1280 |
| terminal-w420.png / terminal-light-w420.png | 同上 | 暗/亮 | 420 |
| storage-w1280.png / storage-light-w1280.png | 存储(容量条 + 打开存储区入口) | 暗/亮 | 1280 |
| storage-w420.png / storage-light-w420.png | 同上 | 暗/亮 | 420 |
| migrate-select-empty(-light)-w1280.png | 迁移弹窗 Step1,真机单分区空态 | 暗/亮 | 1280 |
| migrate-select-two(-light)-w1280.png | 迁移弹窗 Step1,**人为合成**双候选分区(NimoOS-HD/Backup),Backup 处于 `.is-selected` | 暗/亮 | 1280 |
| migrate-browse(-light)-w1280.png / -w420.png | 迁移弹窗 Step2 浏览目录(面包屑 + 行内新建文件夹输入框 + 目录列表 + 目标路径条) | 暗/亮 | 1280 与 420 |
| migrate-migrating(-light)-w1280.png | 迁移弹窗 Step4,copying phase,42% | 暗/亮 | 1280 |
| storage-bar-zoom.png | storage 容量条的自测放大图(3x scale factor,用于确认两段色可辨,非正式交付截图) | 暗 | — |

共 26 张正式截图 + 1 张放大自查图。

## 发现的问题

### 1(真缺陷,高优先级)· 终端日志卡的浮动工具条遮挡日志首行文字

- **元素**:`TerminalPanel.vue` → `LogsCard.vue` 的 `.set-logs-tools`(“下载日志”“全屏”两个按钮)。
- **现象**:`.set-logs-tools` 是 `position:absolute; top:12px; right:16px`,叠在 `.set-logs-wrap`
  右上角;而 `<pre class="set-logs">` 只有 `padding:16px`,**没有为工具条预留净空**。用
  `getBoundingClientRect()` 实测(见 harness 内一次性调试探针,已清理):工具条纵向范围
  `top:65 bottom:93`(相对同一坐标系),日志第一行文字纵向范围 `top:71 bottom:86`——完全落在
  工具条的纵向区间内。真机日志首行本身很长(时间戳 + tab 缩进 + 一大段 JSON),只要首行文字
  横向延伸到卡片右上角这块区域,就会被两个按钮的不透明底遮住。420px 窄屏下这个问题更明显、
  更多行受影响(见 `terminal-w420.png`:"全屏" 按钮明显压在 "InitPathConfig" 字样上)。
  1280px 宽屏下用本次 fixture 的真实首行日志也已经出现遮挡(`terminal-w1280.png` 右上角
  "...system_dat" 那一段被按钮压住)。
- **判断**:**真缺陷**,不是 headless 字体假象——用 `getBoundingClientRect` 精确验证过矩形重叠,
  且在两个不同宽度下都稳定复现,和字体渲染无关。根因是 CSS 只声明了工具条的绝对定位,没有给
  `.set-logs` 顶部内容预留避让空间。
- **建议**:给 `.set-logs` 增加 `padding-top`(按工具条实际高度预留,例如 44-48px),或者把
  `.set-logs-tools` 挪到 `.set-logs-wrap` 之外单独一行(类似 apps chip 那种“工具栏在上、内容在下”
  的两段式布局),而不是浮在内容之上。**这正是 P2 抓到 `.set-input` 92px 截断问题的同类模式**——
  静态自查唯一价值就在于逮到这种“组件各自看没问题、拼一起才炸”的布局缝隙。

### 2(真实但轻微)· 420px 窄屏下 rail 导航横向裁切,无明显可滚动提示

- **元素**:`SettingsShell.vue` 的 `.set-rail-list`(窄屏媒体查询下 `flex-direction:row` +
  `overflow-x:auto`)。
- **现象**:420px 宽度下,8 个 tab 按钮排成一行,超出容器宽度的部分被裁掉——最后一个可见的
  按钮文字在边缘被硬切(例如 `status-w420.png` 里“系统状”缺了“态”字,`storage-w420.png` 里
  "系统状" 后面几个 tab 完全不可见)。`overflow-x:auto` 理论上可以横向滑动,但截图上看不出
  任何“还有更多”的视觉提示(没有渐隐遮罩、没有明显滚动条残影),第一眼观感像是内容被截断坏了,
  而不是“可以滑”。
- **判断**:**真实的可用性问题**,但优先级低于 #1——这是 `SettingsShell` 本身(P1 范围)的既有
  布局,四个 P3 tab 只是共同继承了它,不是 P3 这四个面板自己引入的新问题。且文字裁切本身不是
  颜色缺陷,只是本次窄屏截图顺带看到了,一并记录。
- **建议**:给 `.set-rail-list` 右侧加一个 `mask-image` 渐隐或明确的“更多”箭头提示;或者在窄屏下
  把 tab 列表也做成可换行的两行网格而不是横向滚动。这个改动应该挂在 P1/SettingsShell 名下,不是
  P3 四个面板的债务。

### 3(验证通过,非缺陷)· P2 逮到过的 `.set-input` 92px 截断问题在这里没有复现

- **元素**:`AppPathDialog.vue` 浏览步骤的行内新建文件夹输入框(`class="set-input set-mig-input"`)。
- **现象**:`migrate-browse-w1280.png` / `migrate-browse-w420.png` 里,输入框清晰占满整行宽度,
  没有被 `.set-input` 的 `width:92px` 截断——因为 `settings.css` 里 `.set-mig-input { width:100%;
  max-width:none; }` 在源码顺序上晚于 `.set-input`,同优先级(0,1,0)下靠后者胜出,覆盖生效。
- **判断**:**验证通过**,P3 这里已经正确应用了 P2 教训里提炼出的模式(`.set-mig-input` 命名和
  P2 修复时新增的 `.set-net-field .set-input` 是同一防线思路的两个实例)。特此记录是为了让"再犯
  同类错误"的检查项有一条明确的"已验证不复发"证据。

### 4(验证通过)· 长路径 chip / 长文件夹名的溢出处理

- `apps-w420.png`:三个 `.set-app-chip-path`(App 镜像集 / 用户数据库两行路径很长)在窄屏下正确
  省略号截断(`/NimoOS-HD/.system_data/.c…`),没有把行撑破,`.set-app-chip-path` 的
  `overflow:hidden;text-overflow:ellipsis` 生效正常。
- `migrate-browse-w1280.png`:人为加了一个 36 字符的长文件夹名
  `OldData-2025-archive-do-not-delete` 测试 `.set-mig-folder-name` 的省略号——但这个名字本身没长到
  超出弹窗宽度(弹窗 `min-width:min(480px,88vw)`,这个名字只占约 300px),**没能真正触发溢出**,
  所以这条只能算“CSS 声明正确、但没有用真正会溢出的极端长度验证过”，不是"已验证通过"。见下方
  "验不了什么"。

### 5(观察,非缺陷)· 迁移弹窗分区选中态 `.is-selected` 只靠描边区分

- `migrate-select-two-w1280.png` / `-light`:两套主题下选中的 "Backup" 卡片都只是把
  `border-color` 从默认换成 `var(--accent)`,没有背景色变化。在两套主题下实测都能看清(蓝色描边
  与默认半透明描边对比度足够),不算缺陷,但如果之后有色弱/低对比场景反馈,这是第一个该检查的
  点——目前视觉区分手段单一。

### 6(观察,非缺陷)· 系统状态 17 行在线/离线配色

- `status-w1280.png` / `-light`:绿色圆点+"在线"文字、红色圆点+"离线"文字在两套主题下都清晰可辨,
  空版本号正确显示为 "—"。`--set-ok-fg` 别名到 `--success`、离线用 `--remove-fg`,两套主题各自的
  取值都过关。

### 7(观察,非缺陷)· 存储容量条两段色

- 第一遍看 1280px 截图时,8% 的"系统"段(`--fg-muted`,半透明白/纯色暖灰)因为只有约 76px 宽 + 8px
  高,乍看容易和轨道背景混淆而怀疑是缺陷;用 3x 缩放重新截了 `storage-bar-zoom.png`,确认在暗色和
  亮色下"系统"段（灰白/暖灰）、"文件"段（蓝）、剩余轨道三者色相/明度都能分开,不是缺陷,只是原尺寸
  截图本身分辨率不够高导致的观感误判——已通过放大自查图排除。

## harness 自己的一个坑(已修正,记录以防复发)

第一轮截图时忘记把 `SettingsShell.vue` 自己的 `<style scoped>`(`.settings-shell` /
`.set-rail` / `.set-main` / `.set-bar` / `.set-body` 等布局规则)一并抄进静态页——这些规则
**不在** `settings.css`(那个文件只放"跨组件复用的骨架"),而在组件自己的 scoped style 块里。
漏了之后页面退化成无 flex 布局的纯文档流,肉眼看起来非常像"窄屏媒体查询在宽屏下被错误触发"。
用 `window.innerWidth` 探针确认视口本身没问题后才定位到是 harness 漏抄 CSS,不是产品缺陷。补齐
`SettingsShell.vue` 的 CSS 后四个主 tab 页面才恢复正常布局并重新截图。这不是缺陷,只是记录避免
下次同类 harness 复用时再踩一次。

## 这套 harness 验不了什么(诚实清单)

- **真实数据流**:所有取数(`GET /v1/gateway/components`、`GET /v1/sys/paths`、
  `GET /v1/storage`、`service.sys.getLogs()` 等)全是静态摆好的 fixture,没有验证加载中/
  加载失败态的过渡动画、`loadSeq` 过期守卫、5 秒轮询刷新等**行为**正确性——本报告只覆盖颜色/
  布局的静态可读性。
- **交互与浮层定位**:reka-ui 的 `ContextMenu`(右键菜单)、`Dialog`/`AlertDialog` 的开关动画、
  输入框 focus 后 `.select()` 全选、Esc/遮罩点击拦截(migrating 步骤)等都无法在静态 HTML 里
  验证,因为这些依赖 Vue 运行时和 JS 事件绑定。
- **真实字形**:headless chromium 缺一些字形(P2 报告提到的 `▁▂▃▄▅`、`🔒` 等)。本次内容里
  中文字体渲染看起来正常(PingFang/Microsoft YaHei 字体栈在这台 Linux 机器上会退回到某个
  CJK 兜底字体,但笔画完整,没有出现豆腐块),`⤴`(App 数据更改按钮图标)、`‹`/`›` 这些符号字符
  在两套主题下都正常显示,没发现方块字符——但机主用真实浏览器(尤其 macOS/Windows 下的
  PingFang SC / Microsoft YaHei)复核一遍字重/字距观感仍然值得,不能完全排除字体差异导致的
  视觉细节出入。
- **长文件夹名溢出的真实触发**:如 #4 所述,`.set-mig-folder-name` 的省略号 CSS 声明正确,但
  本次演示用的 36 字符文件夹名没有真正撑到溢出阈值,没有拿到"确实截断成功"的实拍证据(只是
  读代码推断应该没问题)。
- **迁移弹窗 Step1 双候选场景是完全虚构的**:真机本机只有一个分区(单分区设备,`availableVolumes`
  恒为空),`migrate-select-two.html` 里的 "NimoOS-HD 476.94GB / Backup 1.82TB" 两个候选项、
  它们的已用空间数字、`EXT4` 文件系统标签,**全部是我为了摆出 `.is-selected` 对比态而编的演示
  数据**,不是从任何真实接口或已知文档读到的——机主如果关心真实多分区设备下这个界面的样子,
  这张图仅供参考颜色/布局,不代表真实数据形态。
- **浏览步骤的目录列表是虚构的**:`migrate-browse.html` 里的 "Backups" / "OldData-2025-archive-
  do-not-delete" / "Scratch" 三个文件夹名和面包屑路径 `/DATA/Projects` 都是我编的演示数据,
  fixture 里没有提供真实目录快照。
- **窗口尺寸只是浏览器窗口的模拟**,不是真实设备屏幕(比如没有测试触屏下 rail 横向滚动的手势
  体验,只能看静态裁切效果)。
