## Fix round 1 —— 1 Critical + 2 Important + 2 条并入的 Minor(其余 5 条 Minor 记台账,别顺手改)

评审(opus)判 **Spec ❌ / Needs fixes**。**架构核心(§7e-2 修复)评审判「这份交付里质量最高的部分」** —— `byId` 数据源、`paused` 派生、Vue2 那 40 行同步机制一行没留、文件头 17 行注释讲清了「为什么这里比 Vue2 少 40 行」,钉住它的守卫做了两次变异都精准变红。**那部分不用动。**

### C1(Critical)—— 导出 ZIP 用 GET 打了一个只注册 POST 的路由,401 换成了 405,功能仍然 100% 不通

**控制器已回源逐条复核**:`NimoOS-Photos/route/v1/smartviews.go:34` 是 **`g.POST("/smart-views/:id/export", h.Export)`**,而且 `grep -rn '"/smart-views/:id/export"' route/` **全仓只有这一条、没有 GET 版本**。你的 `fetch(url, { headers })` 默认 GET ⇒ Echo 返 **405** ⇒ `!res.ok` ⇒ 每次点「下载为 ZIP」都只弹「导出失败」。

**旁证**:同一个端点的「保存为静态相册」那一项是好的 —— 因为它走 store 的 `exportAlbum` → 共享包 `exportSmartViewAlbum`(`NimoOS-Service/src/photos.ts:334-336`)用的是 `http.post`。两项行为不一致正好印证。

**测试对此零区分力**:评审做了反向变异 —— 把生产码改成正确的 `method: 'POST'`,50 例**仍全绿**。

**这条是 plan/spec 的错**:我 spec §7e-1 只查了「JWT 中间件只从 `Authorization` 头取 token、不读 query」这一半,**没查这条路由注册了什么 HTTP 方法**;plan §5 给的示例代码也漏了 `method`。**我会同步修 spec 与 plan**(否则 T16 会继承)。

**改法**:
```ts
const res = await fetch(url, { method: 'POST', headers: { Authorization: localStorage.getItem('access_token') ?? '' } })
```
**不需要 body** —— handler(`smartviews.go:208-215`)是 `format := c.QueryParam("format")` **优先取 query**,只有 query 为空才去 bind body,而 `exportSmartViewUrl` 已经把 `?format=zip` 拼在 URL 里了(控制器已核)。
**测试必须断言 `method === 'POST'`**(现在完全没测方法)。

### I2(Important)—— 三处 `<transition>` 整条丢失,未登记

- Vue2 `:79` 与 `:102` 各有 `<transition name="sv-menu">` 包着两个菜单,规则在 **`photos-smartview.scss:454-455`**(opacity 0.14s + `translateY(-4px) scale(0.97)`,`transform-origin: top right`)—— **正落在 brief 指定的 `:210-457` 只读区间内**。
- Vue2 `:239` 有 `<transition name="lb-confirm">` 包着删除确认弹窗,规则在 `photos.scss:702-707`。

**不是「本仓不做 transition」的政策** —— 同一文件里 `.sv-toast` 的 transition 你反而逐值搬过来了(`sv-toast-fade`),证明是漏了。现在菜单与弹窗是瞬间硬弹出,Vue2 是 140ms 缩放淡入。

**改法**:两个菜单包 `<Transition name="sv-menu">`、弹窗包 `<Transition name="sv-confirm">`,把那两组值搬进样式块。**注意 Vue3 是 `-enter-from` 而非 Vue2 的 `-enter`** —— 照你自己 `.sv-toast-fade-*` 的既有写法。各补一条先锚定规则体的断言。

**顺带的方法论**:你的审计口径是「按 Vue2 内联 `style` 逐条过」(23 处,数字评审核过是对的),但**这个口径盖不住 scss 里的规则**(transition、`::after` 的 inset 阴影都不是内联 style)。下次审计要两条腿:内联 style **和** 指定 scss 区间里的每条规则。

### I3(Important)—— `.tile.recent::after` 少了 Vue2 的 inset 阴影

Vue2 `photos-smartview.scss:506-513`(同样在 brief 指定的 `:480-527` 区间内)在 accent 边框内侧还有一圈半透明黑 `box-shadow: inset 0 0 0 2px rgba(...)`,作用是在浅色照片上把 accent 环压出对比;你只搬了 `border`。与 P6b-T3 丢 `backdrop-filter`、T4 丢 margin、T5 丢整套滑块样式同一类。

**改法**:`box-shadow: inset 0 0 0 2px color-mix(in srgb, black 40%, transparent);` —— **`color-mix` 里用 `black` 有本仓先例 `PhotosTrash.vue:405`,color-guard 只拦 hex/rgb/hsl 函数**(注释里也不要写字面 `rgba(`,那是本期已撞过的坑)。补一条 `parseCssRules` 锚定断言。

### M2(并入本轮)—— 两列布局容器缺失,T8 一填内容就会返工

Vue2 `:10-11` 有两层容器:`.sv-detail-layout`(grid `1fr 320px`)+ `.sv-detail-main`;`.sv-detail-side` 本身是 `320px` + `border-left` + `surface-1` 底 + `padding 20px 18px 40px`。你现在的 `.sv-detail-side` 是个 `margin: 20px 32px 0` 的自创空壳、挂在网格**下面**而不是右侧。今天不可见(壳是空的),但 **T8 一填内容就会出现在网格下方而不是右栏** —— 那是一次结构返工,而且你的报告 Concerns 只登记了滚动条美化、没登记这个。

**改法(控制器决定:本轮就建起来)**:建 `.sv-detail-layout`(grid `1fr 320px`)+ `.sv-detail-main` 两层,`.sv-detail-side` 给 Vue2 那组值(底色/左边框/padding 走本仓 token 映射),**aside 内部仍留 T8 的空挂载点**。删掉那条临时 `margin`。窄屏(≤768px)按本区惯例塌成单列。补一条锚定 `.sv-detail-layout` 的 `grid-template-columns` 断言 + 窄屏那条。

### M5(并入本轮)—— 3 条低成本断言缺失

- **brief §3 明文要求的挂载点断言**:`grep sv-cond-editor-mount` 在测试文件里 **0 命中**。补 `sv-cond-editor-mount` 与 `sv-side-mount` 存在的断言。
- 结构规格 2(`.sv-detail-bar`)**全无用例**:补 `photosSvLastUpdatedTime` 渲染 + `evaluatedAt` 为空时 `'—'` 兜底两条。
- `fetch` 的 `method` 断言(见 C1)。

### 另:`.sv-action-btn-primary` 伴生类 —— 按评审的折中方案改(控制器裁定)

评审的分析我认可:你这个替换让 CSS 变**更弱**了 —— `.sv-action-btn-primary:hover`(0,2,0)与基类 `.sv-action-btn:hover`(0,2,0)**平级**,只靠书写顺序才没白底白字;而原本的属性选择器 `.sv-action-btn[data-primary="true"]:hover` 是 (0,3,0)、**靠优先级取胜、与顺序无关**。为了让断言工具读得懂而把「结构上免疫」换成「靠行序维持」,正是这条 hover 硬约束当初要防的脆弱。

**裁定:采用评审给的折中方案,不改共享测试工具** —— 选择器写成 **`.sv-action-btn.sv-action-btn-primary:hover`**(真实 (0,3,0),`cssCascade.ts` 的 `classSpecificity` 算出 3,两边都对、不依赖行序)。`.sv-export-item.sv-export-item-danger:hover` 同理。**保留伴生类与 DOM 上的 `data-primary` 属性**(DOM 仍与 Vue2 一致)。

**另补一条注释**:`.sv-action-btn[data-primary]` 由 Vue2 的 `linear-gradient(135deg, accent, accent-hi)` 改成 `var(--accent)` 实底 + `filter: brightness(1.08)` hover —— 这是本仓无 `--accent-hi` 的全局约定,但**本文件一个字都没登记**(T4 的 fix round 1 · I2 就是在这条替换上翻的车)。

### 本轮要求

- 每条都要有**能变红**的断言(样式类一律**先锚定规则体、再断言属性**)。
- 只跑覆盖改动的测试文件 + `color-guard.test.ts` + 一次 `pnpm exec vue-tsc --noEmit`;**不用重跑全量**。
- 逐个删码验证新加的断言(一次一处,**Edit 手工还原,禁 `git checkout --`**)。
- **注释三禁**(本期已各撞一次):`<style>` 块内注释不写字面 `#hex`;任何注释不写字面 `rgba(`;`<script>` 注释不写字面 `<style>` 一词。
- **fix 报告追加到同一份 `task-6-report.md` 末尾**,别新建文件。
- 返回值仍只要:状态 / commit 起止 / 一行测试小结 / concerns。
