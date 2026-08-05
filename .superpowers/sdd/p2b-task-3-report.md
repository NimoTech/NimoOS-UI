# SP8-P2b Task 3 报告 —— SkModal.vue 弹窗外壳

## 逐文件改动

- **新建 `src/ai/components/settings/SkModal.vue`**:reka `DialogRoot`/`DialogPortal`
  (`:to="portalTo"` 默认 `'.set-app'` + `defer`)/`DialogOverlay`(`.sk-modal-bg`)/
  `DialogContent`(`.sk-modal`)/`DialogTitle`(`.sk-modal-title`)。关闭按钮 `.sk-x` +
  `AgentIcon name="x"`。`footer` 插槽用 `defineSlots` 探测是否传入,决定是否渲染
  `.sk-modal-foot > .right`。逐字采用 brief Step 3 给的代码,仅修正了头注释里的
  Vue2 引用行号(见下一节)。
- **新建 `src/ai/components/settings/SkModal.test.ts`**:逐字采用 brief Step 1 给的 6 个用例。

## Vue2 file:line → New-UI 对照

- 关闭按钮样式:Vue2 `McpTokensSection.vue:241-244`(`.mcp-x`)与
  `ChannelsSection.vue:395-398`(`.chan-x`)两份逐字相同的 scoped 样式,已回蓝本核对
  (原 brief 注释未给行号,写代码时补上并核对属实),本档收成一份 `.sk-x`。
- 结构对照:Vue2 `ChannelsSection.vue:46-79`(加机器人弹窗)/`:140-159`(配对码)、
  `McpTokensSection.vue:91-117`(令牌明文)三处手写 `.sk-modal-bg` 裸 div +
  `@click.self` 关闭;本组件用 reka Dialog 复刻同一套类名结构(`.sk-modal-bg` 挂在
  `DialogOverlay`、`.sk-modal`/`.sk-modal-head`/`.sk-modal-title`/`.sk-modal-body`/
  `.sk-modal-foot`/`.right` 结构与 Vue2 一致),视觉 1:1,交互升级为 reka 焦点陷阱+Esc
  (D1,已在文件头注释申报)。

## RED → GREEN

- RED:`pnpm test src/ai/components/settings/SkModal.test.ts` → `Failed to resolve
  import "./SkModal.vue"`(0 test)。
- GREEN:实现后同命令 → 6/6 passed。

## 全量测试门

```
pnpm test            → 281 files passed, 2229 tests passed
                        (MemorySection.test.ts:226 打印一条 unhandled RangeError 但测试仍全绿——
                         该文件属 P2a 在途文件,归属对方会话,未去动它)
pnpm exec vue-tsc --noEmit → 无输出,通过
pnpm build            → 通过;仅第三方包既有噪声(@vueuse PURE 注释、lottie-web/file-type
                         eval 警告)+ >500KB chunk 警告(ExcelViewer/index-BAuaQrvY 等既有大 chunk)
```

## i18n

本任务无新增/复用 i18n 键(SkModal 不含任何 `t('…')` 调用,`title` 由调用方传入)。

## 静态 containment 检查(替代无法执行的 Step 6 浏览器验证)

**风险描述**:`.sk-modal-bg` 是 `position: fixed`,其包含块取决于最近的会建立包含块的
祖先(`transform`/`perspective`/`filter`/`backdrop-filter`/`will-change`/`contain:paint`)。
若 `.set-app` 或其任一祖先(含中间 wrapper)带有这些属性,遮罩会相对该祖先居中而不是
视口——即便只是入场动画期间瞬时存在也会困住。

**逐条 grep 结果**(`src/ai/styles/*.scss`、`src/styles/theme.css`、
`src/ai/views/SettingsPage.vue` 的 `<style>` 块):
- `.agent-app`(`agent-styles.scss:8-24`、`tokens.scss:31-`):仅 `display/grid-template-columns/
  height/width/overflow/font-family/color` 及自定义属性,无 transform/filter/will-change/contain。
- `.set-app`(`settings-styles.scss:17-26`、`:300-323`):仅 grid 布局 + 颜色 token,无相关属性。
- `.set-main`(`:62`)/`.set-body`(`:77`)/`.set-stack-item`(`:81-82`):flex/overflow/padding/margin,
  无相关属性。
- `html, body`(`theme.css:311-319`)、`body`(`:330-333`):无 transform/filter/will-change/contain;
  `body::before`(`:335-349`)确实有 `filter: blur(46px)` + `transform: translate(...)` +
  `animation: floatField 30s infinite alternate`,**但这是 `body` 的伪元素自身的属性,不作用于
  `body` 这个真实盒子**——伪元素的 transform/filter 不会让 `body` 变成其真实子元素(含
  `#app`/`.set-app` 一路以下)fixed 定位的包含块来源。
- `#app`(`index.html:15`):纯空 `<div>`,全仓 grep 未发现任何 `#app{}` 规则。
- `App.vue`:根模板是 `<router-view/><AppToast/>`(fragment,无包裹 div),SettingsPage.vue 是
  该路由的直接渲染结果,其根即 `.agent-app.set-app`。
- `.sk-modal-bg` 自身有 `backdrop-filter: blur(8px)`(`sk-shared.scss:96-101`)—— 这是遮罩层
  自己的属性,不是它的祖先,**不会困住它自己**(`position:fixed` 元素的包含块由祖先链决定，
  自身的 filter/backdrop-filter 不影响自身定位计算)。

**瞬时 vs 永久**:`body::before` 的 `transform`/`filter` 是永久存在(整档动画循环,并非仅入场
一次性),但因为挂在伪元素而非 `body` 本身,不影响 `body`→`#app`→`.set-app` 这条链的包含块
判定,所以即便是"永久"也不构成风险——risk 判定的关键是"是否作用在祖先元素自身"，不是
"是否短暂"。经过检查，从 `.set-app` 一路向上到 `html`，没有任何一层（含伪元素所属的真实
元素本身）带有会建立包含块的属性。

**结论**:静态证据支持"遮罩应相对视口居中",但**这不是运行时可视验证的替代品**——jsdom/静态
grep 测不出浏览器实际渲染、reka 内部是否额外包了带样式的 wrapper div、或第三方样式表运行时
注入的规则。

**仍需人工做的事(brief Step 6 原文,若失败按此回退)**:
> 起 dev server(`pnpm dev --host --port 5288`),在 `SettingsPage.vue` 临时挂
> `<SkModal :open="true" title="临时验证" />`,浏览器打开设置页确认:①弹窗相对视口居中
> ②浅色主题下底色为近白 `--bg-elevated`,非透明/深色 ③切暗色主题后弹窗随之变深。
> **若第 1 条失败**:不改 `.set-app` 样式,改 `SkModal` 的 `portalTo` 为 `document.body`,
> 并在 `sk-shared.scss` 给 `.sk-modal-bg` 加 `[data-sk-scope]` 变体、把 8 个 AI 区 token
> (`--bg-elevated`/`--line`/`--line-faint`/`--bg-canvas`/`--text-primary`/`--text-secondary`/
> `--text-tertiary`/`--bg-chip`)重新声明一遍(值取自 `tokens.scss` light/dark 各一份)。
> 验证完删掉临时挂载,不提交。

我未起 dev server、未用浏览器验证,此项对协调者是**明确未完成**,需要后续人工核对。

## 偏离申报

- 无功能性偏离;组件/测试逐字采用 brief 给定代码。唯一改动是补全头注释里 `.mcp-x`/`.chan-x`
  的 Vue2 行号引用(brief 原文未给行号,回蓝本核对补上)。
- Step 6 未执行(环境无浏览器),已用静态 containment grep 替代,结论与局限如上,已明确
  标注"仍需人工肉眼验证"。
- 按公共约束 §2 跳过了 `SettingsPage.vue` 接线(本任务本就不涉及,brief 也未要求)。
