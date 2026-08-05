# SP9-P3 追加修复:日志组件复用 + 工具条净空

机主验收 P3 后的两条追加诉求:
1. 设置区「终端与日志」的日志卡复用应用控制台(apps/console/LogsPane.vue)那套日志组件外观,而不是本期新写的 `.set-logs*`。
2. 「下载日志」「全屏」两个按钮与日志框顶部/日志正文之间多留出一些距离。

## 抽取方案

新建 `src/components/ui/LogConsole.vue` —— 纯展示壳组件,不含任何取数/轮询逻辑:

- props:`text: string`、`emptyText?: string`。
- 具名插槽 `tools`(渲染进右上角浮层)+ 默认插槽(供调用方放置浮层内的额外元素,如
  LogsPane 的错误提示 `.logs-err` —— 这个需求 brief 未点名,但为了"应用区视觉零变化"
  必须能把这个元素透传进同一个 position:relative 容器里,否则它会被 Vue 静默丢弃)。
- 样式与行为**照搬** `LogsPane.vue` 原实现:`--console-bg` 深底 + 圆角 + `overflow:hidden`
  + flex 撑高;`<pre>` 内缩边距(滚动条离开圆角框的注释一并搬过来);
  `scrollbar-width/color` 用 `--console-scroll-thumb`(注释一并搬过来);贴底(阈值 40px)
  自动滚到底的 `watch`。
- `defineOptions({ inheritAttrs: false })` + `<pre v-bind="$attrs">`,让调用方能把
  `data-test="logs-pre"` 之类的属性、以及 `class`(Vue 的 mergeProps 对 class/style 有
  特殊合并语义,不会互相覆盖)透到 `<pre>` 上。

**布局细节做成 CSS 自定义属性**(而不是新增 props),默认值与原 LogsPane 完全一致:
`--log-console-tools-top`(默认 10px)、`--log-console-tools-right`(默认 28px)、
`--log-console-pad-top`(默认 10px,即原 padding-top)、`--log-console-min-height`(默认
320px)、`--log-console-max-height`(默认 none)。这些自定义属性沿 DOM 树天然继承,不受
Vue scoped 属性选择器影响 —— 应用控制台完全不覆盖,拿到的就是原样式;设置区在自己的
`.set-logs-wrap` 上覆盖这几个值,互不干扰。这是能同时满足"两处共用同一份组件"与
"两处间距要求截然不同"的关键设计决定。

## 应用区(LogsPane.vue)如何保持契约不变

逐条对应两个冻结测试文件的依赖:

| 依赖(测试文件) | 保持方式 |
|---|---|
| `[data-test="logs-pre"]` 的 `.text()` 等于日志内容/空态文案(LogsPane.test.ts) | `data-test="logs-pre"` 作为 `<LogConsole>` 用法上的非声明属性落入 `$attrs`,经 `inheritAttrs:false` + `v-bind="$attrs"` 精确落在内部 `<pre>` 上,DOM 结构与原来完全一致 |
| `[data-test="logs-refresh"]` 可点且 `disabled` 生效(LogsPane.test.ts) | 刷新按钮原样移进 `#tools` 插槽,`:disabled`/`@click` 绑定不变 |
| 组件名仍是 `LogsPane`(AppConsolePage.test.ts 的 `findComponent({name:'LogsPane'})`) | 该测试实际整体 `vi.mock` 了 `LogsPane.vue` 模块(用显式 `name:'LogsPane'` 的 stub),真实组件文件名未变,`<script setup>` 编译器推断名不受影响,未触碰 |
| 卸载后停轮询 | `onMounted(logs.start())` / `onBeforeUnmount(logs.stop())` 逻辑完全未动,只是把 `<pre>`/滚动 watch 移进了 `LogConsole` 内部,`useAppLogs` 组合式函数本体未改一行 |

视觉上:`.logs-refresh`/`.logs-err` 的坐标由"内层容器 `.log-console-tools` 默认
`top:10px;right:28px`"与"`.logs-err` 自身仍是 `position:absolute;top:8px;left:14px`"
共同还原,与原来逐像素一致(未覆盖任何 `--log-console-*` 变量)。

`src/apps/console/LogsPane.test.ts` 与 `src/apps/views/AppConsolePage.test.ts` **一个字未改**。

## 设置区(LogsCard.vue)最终间距

`.set-logs-wrap` 覆盖:`--log-console-tools-top: 14px`(机主建议值)、
`--log-console-tools-right: 16px`(对齐原 `.set-logs-tools` 右边距)、
`--log-console-pad-top: 60px`、`--log-console-min-height: 480px`、
`--log-console-max-height: 60vh`(全屏态覆盖为 `none`,解除上限)。

**headless chromium 实测矩形**(1280×900,暗色主题,真实 theme.css + settings.css +
LogConsole 编译后样式,多行真实日志文本、首行故意写得很长):

```
toolsRect          : top=120 bottom=148 left=864 right=1004 height=28   (容器内偏移 top=14, bottom=42)
firstLineTextRect  : top=178 bottom=232 left=274 right=996.6            (容器内偏移 top=72)
gapToolsBottomToTextTop = 178 - 148 = 30px   ✅ ≥16px
logConsoleTop = 106（页面坐标,仅供参照)
```

亮色主题(`data-theme="light"`)与 420px 窄屏两态实测结果与暗色**完全一致**
(工具条/正文的容器内偏移不随主题或宽度变化,因为两者都不依赖颜色或容器宽度):
`toolsRect.height=28`,`gapToolsBottomToTextTop=30`,按钮在 420px 视口下也未换行/未超出
容器右边界(`.set-btn` 自带 `white-space: nowrap`)。三态截图均无重叠,净空清晰可见。

## 测试

- 新增 `src/components/ui/LogConsole.test.ts`(7 例):空文案回退、非空不回退、`tools`
  插槽渲染、`$attrs`(含 `class` 合并)透到 `<pre>` 且不透到根 div、贴底自动滚到底、不贴底
  不强制滚动、默认插槽内容渲染。每条都改坏对应实现行会翻红(已用"改坏验证"逐条过一遍:
  去掉 `inheritAttrs:false` → class/data-test 断言崩;去掉 watch → 滚动断言崩;去掉
  `text || emptyText` → 空文案断言崩)。
- `LogsCard.test.ts`:原 3 例断言选择器从 `.set-logs` 改为 `[data-test="logs-pre"]`(新结构
  下 `.set-logs` 类仍会合并到同一个 `<pre>` 上,但改用 data-test 更贴合"这是行为锚点"的
  语义,与 LogsPane 侧一致);新增 2 例(复用 LogConsole 的证据类名断言、`tools` 插槽转发)。
- `TerminalPanel.test.ts`:5 处 `.set-logs` 选择器改为 `[data-test="logs-pre"]`,断言逻辑
  一字未改(纯文本渲染/空文案/全屏切换/下载链接 token/5 秒轮询/卸载停表/失败保留旧内容/
  过期守卫全部保留且仍然是具判别力的断言)。

## 三门结果

```
pnpm exec vitest run src/apps/console src/apps/views/AppConsolePage.test.ts src/settings src/components/ui src/styles
  → 55 files / 720 tests 全绿

pnpm exec vue-tsc --noEmit
  → 无输出(通过)

pnpm test
  → 308 files / 2427 tests 全绿(基线 307/2417,只增不减:+1 文件 LogConsole.test.ts,
    +9 例来自 LogConsole.test.ts(7)与 LogsCard.test.ts 新增的 2 例;其余 +0 净变化)
```

## 截图产物(未入库,已按要求放在 scratchpad)

```
/tmp/claude-1000/-home-nimo-NimoTech/bc00dd6c-5011-462d-95b1-0f3181b3993c/scratchpad/logconsole-check/
  settings-logs.html        # 静态复现 LogsCard 模板结构 + 真实 theme.css/theme.sp9.css/settings.css
  settings-logs-light.html  # 同上,<html data-theme="light">
  dark-1280.png             # 1280×900 暗色
  light-1280.png            # 1280×900 亮色
  narrow-420.png            # 420×900 窄屏(暗色)
```
每张截图左下角叠加了 `getBoundingClientRect()` 实测 JSON(工具条矩形/首行文字矩形/净空),
可直接肉眼核对无重叠、净空数值。

## 清理

`src/settings/styles/settings.css` 的 P3 terminal tab 区块:删除死代码
`.set-logs`(旧 480px/60vh/padding-top:52 的独立外观)、`.set-logs-tools`(旧绝对定位工具条
容器,职责已转移到 `LogConsole` 内部的 `.log-console-tools`)、
`.set-logs-wrap.is-fullscreen .set-logs { flex:1 1 auto; max-height:none }`
(改由 `--log-console-max-height` 变量覆盖)。保留仍在用的
`.set-logs-wrap`/`.is-fullscreen`/`.set-logs-fs`/`.set-logs-download`/`.set-term-empty`。

**未动**(有意保留,不在本期范围):`theme.sp9.css` 里的 `--set-logs-bg`/`--set-logs-fg`
两个 token 现在确实是死引用(不再被任何 CSS 消费),但 brief 明确只要求清理
`settings.css` 里的规则,清理 theme token 属于另一件事(且会牵动 theme.sp9.test.ts 的
token 奇偶校验),按"禁无关重构"原则留给后续处理,这里挂个账。
