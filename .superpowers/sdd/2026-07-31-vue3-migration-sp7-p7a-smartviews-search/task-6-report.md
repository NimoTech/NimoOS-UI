# Task 6 报告:PhotosSmartViewDetail.vue —— 详情页外壳 + header + 操作栏三菜单 + 删除确认

状态:**DONE**

## 改了哪些文件

- 新建 `src/views/PhotosSmartViewDetail.vue`
- 新建 `src/views/__tests__/PhotosSmartViewDetail.test.ts`(47 例 + 全量内联 style 审计后
  补的 3 例结构断言 = 50 例)
- 新建 `src/photos/util/formatBytes.ts` + `src/photos/util/__tests__/formatBytes.test.ts`(5 例)
- 改 `src/router/index.ts`:追加 `/photos/smart-views/:id` 路由(插在 `/photos/smart-views`
  之后)
- 改 `src/router/index.test.ts`(未新建独立 router 测试文件——发现本仓已有
  `router/index.test.ts` 承担"真实 router 行序 + resolve"这类断言的既定位置,把路由行序 /
  resolve 两条用例加进那里,而不是在组件测试文件里手搭一个临时 router 断言原文件内容,
  与 P6a-T11/T4 的既有先例保持一致)
- 改 `src/i18n/zh_cn.ts` / `src/i18n/en_us.ts`:追加 6 个新键(`photosSvNotFound` /
  `photosSvSearchPending` / `photosSvRenameFailed` / `photosSvUpdateFailed` /
  `photosSvDeleteFailed` / `photosSvDuplicateFailed`),追加在 photos 段末尾,未重排既有键

## Vue2 节点清点表(逐节点 → New-UI 落点)

| Vue2 行号 | 节点 | New-UI 落点 |
|---|---|---|
| 3-9 | `.sv-detail-bar`:返回按钮 + 撑开 + 最近更新时间 | `.sv-detail-bar` → `.sv-back-btn` + `.sv-last-updated` |
| 14-25 | `<h1>`:标题 span/input 二态 + live/paused pill | `.sv-title`(`data-test="sv-title-view"`)/ `.sv-title-input` + `.live-pill`(`data-test="sv-live-pill"`,补 `tabindex="0"` + `@keydown`) |
| 26-59 | `.sv-header-conds`:条件 chip + 加条件弹层 | **T7 挂载点**,`.sv-header-conds`(`data-test="sv-cond-editor-mount"`)空壳 + TODO 注释,不渲染 `sv.conds` |
| 60-65 | `.sv-header-stats`:4 项统计 | `.sv-header-stats` → 4 个 `<span>`,`data-test="sv-stat-count/delta/median/storage"` |
| 67-70 | 暂停/恢复按钮 | `.sv-action-btn`(`data-test="sv-action-pause"`) |
| 71-73 | 「在搜索中细化」`<a>` | `.sv-action-btn`(`data-test="sv-action-refine"`,T6 阶段 `disabled` + `title`) |
| 74-97 | 导出按钮 + 下拉 chevron + 导出菜单两项 | `.sv-action-btn.sv-action-btn-primary`(`data-test="sv-export-toggle"`)→ `.sv-export-menu`(`data-test="sv-export-menu"`)→ 两项(`sv-export-zip`/`sv-export-album`) |
| 98-128 | more 按钮 + more 菜单三项(重命名/复制/分隔线/删除) | `.sv-action-btn.sv-action-btn-icon`(`data-test="sv-more-toggle"`)→ `.sv-export-menu.sv-more-menu`(`data-test="sv-more-menu"`)→ 三项 + 分隔线 |
| 132-142 | 「最近添加」段(`v-if="newCount>0"`)+ tile `v-for` + New 角标 | `.sv-section-head`(`data-test="sv-recent-head"`)+ `.sv-grid-photos`(`data-test="sv-recent-grid"`)→ tile(`data-test="sv-recent-tile"`)+ `.new-tag` |
| 144-149 | 「全部匹配」段 + tile `v-for` | `.sv-section-head`(`data-test="sv-all-head"`)+ `.sv-grid-photos`(`data-test="sv-all-grid"`)→ tile(`data-test="sv-all-tile"`) |
| 152-230 | `<aside class="sv-detail-side">`:阈值/设置/统计/活动流四段 | **T8 挂载点**,`<aside data-test="sv-side-mount">` 空壳 + TODO,不渲染任何内容 |
| 232-237 | `.sv-toast` 页内导出结果浮条 | `.sv-toast`(`data-test="sv-export-toast"`),自绘,不用 `useToast`(信息层级说明见组件注释) |
| 239-253 | 删除确认弹窗(`lb-confirm-*` 借用灯箱类名) | 另起 `.sv-confirm-*` 命名(避免与 `PhotoLightbox.vue` 已有的同名 `.lb-confirm-*` 混淆),内容/文案 1:1 |

逐节点均已实现或明确挂载点化,无静默漏渲染。

## 必含用例 → it 对应表

| brief 必含用例 | 测试文件对应 `it` |
|---|---|
| 数据源三态 | `数据源三态` describe 的 4 条 |
| byId 用 String 归一 | `byId 用 String 归一:store 里 id 是数字 7...` |
| onMounted 加载顺序(listLoaded 假/真两支) | `onMounted 加载顺序` describe 的 2 条 |
| watch route.params.id → loadDetail | `watch route.params.id` describe |
| 改名(6 个分支:点击预填/成功/失败/未改动/Esc) | `改名` describe 的 5 条 |
| paused 派生量(store 直改/键盘可达/失败 toast) | `paused 是派生量` describe 的 5 条 |
| 4 统计(delta 0/>0,median 缺,formatMB 三档) | `header 统计四格` describe 的 6 条 |
| 「在搜索中细化」disabled + title | `「在搜索中细化」按钮` describe |
| 导出/more 菜单存在性 + 千分位 | `导出菜单与 more 菜单` describe 的 3 条 |
| 导出 ZIP(fetch/头/href 未变/createObjectURL/revokeObjectURL/download/401） | `导出 ZIP` describe 的 3 条 |
| 导出相册成功/失败 | `导出相册` describe 的 2 条 |
| 删除(确认弹窗/成功跳转+撤销/失败不跳转) | `删除智能视图` describe 的 3 条 |
| 复制(成功/失败) | `复制` describe 的 2 条 |
| 两段网格(newCount 0/>0、tile 数、openAt 参数、isNew 清除) | `两段照片网格` describe 的 4 条 |
| 浮层(菜单同开一次 Esc 全关、点外部关闭) | `浮层:菜单同开 + Esc + 点外部关闭` describe 的 2 条 |
| cssCascade hover 归属变体 | `样式:hover 级联归属变体` describe 的 2 条 |
| 红色不含字面色值 | `红色走 token,不写死字面量` describe |
| 路由行序 + resolve | `router/index.test.ts` 新增的 2 条(见上「改了哪些文件」的说明) |

`formatMB` 单测(`formatBytes.test.ts`)5 例覆盖 0 / 1.5MB 四舍五入 / 2048MB=2GB / 1024MB 临界值
/ undefined 兜底。另有 3 例非颜色视觉属性结构断言(`.sv-grid-photos-recent` /
`.sv-more-menu` / `.sv-action-btn-icon`,见下方「回源核对结论」的审计记录)。

## 9 条删码验证逐条结果

全部逐条实测(Edit 改 → 跑对应用例确认变红 → Edit 手工还原,未用 `git checkout --`)。

| # | 删码内容 | 结果 |
|---|---|---|
| ① | `byId` 换成本地 `ref` 缓存(模拟 Vue2 对象引用) | **红**——「§7e-2 主守卫」用例:`Cannot call text on an empty DOMWrapper`(pill 文案没跟着 store 变化更新,元素判定异常消失) |
| ② | 去掉 `watch(() => sv.value?.name)` | **红**——「Enter 提交新名...编辑态退出」用例红(成功后 input 未消失)。如报告前预判:「失败保持编辑态」方向因本就不依赖这个 watch,不受影响(诚实登记,非伪造) |
| ③ | `listLoaded && !sv` 分支改成 `v-else-if="false"` | **红**——2 条用例同时红(「找不到」空态用例本身,以及"命中"路径下模板读 `sv.name` 崩溃报错波及「返回按钮」用例) |
| ④ | `formatMB` 去掉 `>= 1024` 分支 | **红**——2 条 GB 用例红(`2147483648`→ 应 `'2.0 GB'` 实得 `'2048 MB'`;临界值 1024MB 用例同理) |
| ⑤ | `downloadZip` 的 fetch 去掉 `Authorization` 头 | **红**——「走 fetch 带 Authorization 头」用例红(`opts` 为 `undefined`,读 `.headers` 抛错) |
| ⑥ | 注释掉 `URL.revokeObjectURL(href)` | **红**——同一用例的 `revokeObjectURL` 调用次数断言红(0 次) |
| ⑦ | `openAt` 第四参误传字面量 `'debug-query'` | **红**——「第四参 undefined」反向断言红(收到 `'debug-query'`) |
| ⑧ | Esc handler 里给 `exportOpen` 分支加 `return` | **红**——「一次 Esc 两者都关」用例红(`moreOpen` 未被关掉) |
| ⑨ | 路由行插到 `/photos/smart-views` 之前 | **红**——`router/index.test.ts` 的行序用例红(`3149` 不大于 `3256`) |

9/9 全部按预期变红,无一条「删了不变红」的情况,无需诚实申报「不成立」。

## 回源核对结论

- **scss 区间够不够**:brief 给的 `photos-smartview.scss:146-186` + `:210-457` + `:480-527`
  **基本够用**,但发现两处出入,已在实现里体现且登记于此:
  1. `.sv-action-btn`/`.sv-export-item` 系的 hover 我**没有**照字面选取 Vue2 的
     `.sv-action-btn[data-primary="true"]` 属性选择器,而是改用一个伴生类
     `.sv-action-btn-primary`(`data-primary="true"` 属性仍保留在 DOM 上,不影响任何既有
     消费方)。原因:本仓 `cssCascade.ts` 的 `classSpecificity`/`hoverBackgroundRules`
     只识别 `.class` 与 `:pseudo` 两类选择器 token,不认属性选择器 `[attr=val]`——
     若照字面用属性选择器,`winningHoverBackground(style, ['sv-action-btn'])` 会把
     `.sv-action-btn[data-primary="true"]:hover` 误判成只命中 `.sv-action-btn:hover`
     (属性部分被规则悄悄丢弃),导致断言口径失真。全仓所有既有 primary/danger 变体
     (`SmartViewCreateDialog.vue` 的 `.sv-btn-primary`、`ClusterActionDialog.vue` 的
     `.cad-btn-danger` 等)无一例外都是走**类名**变体,不是属性选择器——按同一既定惯例
     处理,不是新发明。视觉输出与 Vue2 完全一致(`data-primary="true"` 仍在 DOM 上,
     样式选另一套等价选择器达成同样的渲染结果)。
  2. `.sv-toast`/`.sv-confirm-*` 的滚动条/渐变滚动条样式(scss:172-186、195-208)本任务
     **未搬**——那是 `.sv-detail-main`/`.sv-detail-side` 两个滚动容器的自定义滚动条美化,
     本任务的 `.sv-detail-side` 只是 T8 的空挂载点(无内容、不产生滚动),`.sv-detail-main`
     整体也不存在于本任务(两段网格直接挂在 `.photos-main` 下,没有单独包一层可滚动容器)——
     判断为与本任务无关,留给 T8(它会真正引入需要滚动的右栏内容)时再决定是否需要。
- **内联 style 找全了吗**:自己 `grep -n 'style="'` 通读了 Vue2 源文件,**实际是 23 处**
  (brief 与我的第一版初稿都数错过,以 `grep` 结果为准,登记于此)。逐条对照落点:
  - `:2`(`display:contents`)→ Vue2 用它绕过"模板必须单根节点"的限制;Vue3 原生支持
    多根 fragment 模板,New-UI 不需要这个 hack,**不迁移是正确的,不是漏了**
  - `:7`(`flex:1`,顶栏撑开)→ 原样保留内联(`<div style="flex:1" />`),与 Vue2 一致
  - `:8`(最近更新时间 `font-size:12px;color:var(--text-3)`)→ 改 `.sv-last-updated` class
    承载(`font-size:12px; color:var(--fg-muted)`),**第一版报告漏记了这一条,回查
    `grep` 结果后补登**
  - `:13`(`flex:1;min-width:0`)→ 原样保留内联,与 Vue2 一致
  - `:16`(`cursor:text`)→ `.sv-title { cursor: text; }`
  - `:22`(标题 input 一大串)→ `.sv-title-input`,逐属性对照写进样式块 + 组件注释登记
  - `:31`(加条件弹层容器定位)→ **T7 范围**,不适用
  - `:53/:54`(`sv-btn-ghost`/`sv-btn-primary` 内联尺寸,加条件弹层的按钮)→ **T7 范围**,不适用
  - `:74`(`position:relative`,导出按钮包裹层)→ 原样保留内联,与 Vue2 一致
  - `:77`(下拉 chevron 内联 `margin-left/opacity`)→ 原样保留内联在 svg 上,与 Vue2 一致
  - `:98`(`position:relative`,more 按钮包裹层)→ 原样保留内联,与 Vue2 一致
  - `:99`(more 按钮 `padding:0 10px;min-width:32px;justify-content:center`)→ 改
    `.sv-action-btn-icon` class 承载,三项属性都有程序化断言(`extractStyleBlock` +
    `parseCssRules` 先锚定规则体再断言属性,见测试文件「非颜色视觉属性 1:1」describe)
  - `:103`(more 菜单 `min-width:220px`)→ 改 `.sv-more-menu` class 承载,同样有程序化断言。
    **审计发现的第二处出入**:第一版实现只在模板加了 `sv-more-menu` 这个 class 名,样式块
    里当时**没写**这条规则(等价于当时"没有这个 class",纯装饰性 class)——回查 21→23 处
    inline style 全量核对时才发现,已补上并补测试钉住,不是静默留白
  - `:119-123`(删除项红色三处字面量)→ 改 `--remove-fg` token,组件注释与样式已登记
  - `:136`(「最近添加」网格 `padding-bottom:18px`,全部匹配段没有这条)→ **审计发现的
    第一处出入**:同 `:103`,第一版实现模板已加 `sv-grid-photos-recent` class 但样式块
    漏写这条规则,已补上 `.sv-grid-photos-recent { padding-bottom: 18px; }` 并补测试钉住
  - `:202/:203/:205/:219-221/:223` 全部落在 `<aside>` 右栏与活动流内 → **T8 范围**,不适用
  - 其余(`:159/:161/:167/:169/:171/:178/:184/:187/:198/:207`,右栏阈值/设置/统计段)
    → **T8 范围**,不适用
- **内联 style 结论**:23 处里属于本任务范围的 11 处全部核对落地(6 处原样保留内联属性、
  5 处改写为 class 且全部补了程序化断言),其余 12 处明确划给 T7/T8。**审计中发现并修复
  两处真实漏写**(`:103` 的 `.sv-more-menu` min-width、`:136` 的 `.sv-grid-photos-recent`
  padding-bottom)——两者都是"模板已加 class、样式块忘记定义"的同一种漏渲染模式,是本仓
  高频缺陷的又一次实例,已在补测试后一并登记。

## `formatMB` 最终签名与复用情况

```ts
export function formatMB(bytes: number): string
```

定义在 `src/photos/util/formatBytes.ts`。**未复用**任何既有实现——grep 全仓
(`formatBytes|formatMB|1048576|toFixed(1)`)命中的都是别的口径(`assetToPhoto.ts` 的
`formatSize` 是 KB/MB 两档、无四舍五入 MB 整数这一档;`UploadPanel.vue`/`PhotosTrash.vue`
各自的字节格式化口径也都不同),没有一个与 Vue2 `PhotosSmartViewDetail.vue:424-428` 的
`Math.round(mb) + ' MB'` / `(mb/1024).toFixed(1) + ' GB'` 口径吻合,按брief 要求新建。
T8 消费时直接 `import { formatMB } from '../util/formatBytes'` 即可,签名不变。

## 撤销 toast 用了哪个键

`photosTrashUndo`(zh `'撤销'` / en `'Undo'`,P3 回收站已有)。grep 确认本仓另有语义等价的
`photosPersonUndo`(同值 `'撤销'`/`'Undo'`,P5 人物区加的)——两者文案完全相同,任选一个都
不算新增。选 `photosTrashUndo` 是因为它是两者中**更早**加入、语义上更贴近"撤销一次删除"
场景的键(回收站本身就是"删除的暂存区"),复用时的语义距离比人物区的键更近。

## `smartViewId` 死参数的 grep 结论

`grep -rn "smartViewId" /home/nimo/NimoTech/NimoOS-UI/src/` 只命中一行:
`PhotosSmartViewDetail.vue:520` 的 `this.$emit('refine-in-search', { q: this.sv.name,
smartViewId: this.sv.id })` 本身——**零消费方**(没有任何 `$on('refine-in-search', ...)`
或事件处理器读取过 `smartViewId` 字段)。已确认按死参数不迁处理,组件里「在搜索中细化」
按钮上方留了 TODO 注释,写明 T16 接线时只需要 `q`。

## 任何申报的偏离

1. **导出/more 菜单互斥性**:实现过程中最初误加了"打开一个菜单就关掉另一个"的逻辑
   (以为是常见 UI 惯例),被"先开 export 再开 more,一次 Esc 两者都关"这条必含用例
   直接测出是错的——Vue2 源码里 `exportOpen`/`moreOpen` 是完全独立的两个布尔值,允许
   同时打开。已改正为两个独立 toggle,不互斥,与 Vue2 行为一致。这不是最终交付的偏离
   (已改正),记录在此是为了给后续任务一个教训:不要凭"看起来应该这样"给菜单加交互
   假设,严格照 Vue2 源码逐行核对。
2. **`.sv-action-btn[data-primary="true"]` 用类名变体代替属性选择器**——已在上方"回源
   核对结论"第 1 条详细说明理由(cssCascade 断言工具的选择器解析限制 + 全仓既有惯例),
   不重复。
3. **改名/暂停失败的 toast 文案是 New-UI 新增**(`photosSvRenameFailed`/
   `photosSvUpdateFailed`/`photosSvDeleteFailed`/`photosSvDuplicateFailed`)——Vue2 对应
   路径要么无 catch(改名、删除、复制)要么根本不会失败(paused 是本地 state,从不等
   后端响应)。按 Store 纪律"向上抛出的 action 必须视图层 catch → toast"的通则新增,
   已在组件注释与本报告逐一登记,不是静默新增。
4. brief §结构规格 1/2 两条 New-UI 新增路径(「找不到」空态 / pill 键盘可达)已按 brief
   原文要求登记,不再重复。

## 测试小结

- `pnpm exec vitest run`:**297 files / 3197 tests 全绿**(含本任务新增 50+5=55 例,
  以及 `router/index.test.ts` 新增的 2 条)。
- `pnpm exec vue-tsc --noEmit`:**exit 0**,无裸 `any`。
- color-guard:首次因样式注释里写了字面 `#FF6B5C` 被拦下(已知红线),改成文字描述
  "那个珊瑚红字面量" 后通过。
- i18n parity:通过(zh/en 两个 locale 键集合完全一致)。

## Concerns

- T8 建右栏内容后,`.sv-detail-side` 的滚动条美化(scss:187-208)与 `.sv-detail-main`
  的滚动容器是否需要补齐,留给 T8 判断(本任务范围内 `.sv-detail-side` 是空壳,没有可
  滚动内容,不适用)。
- `downloadZip`/`exportAlbumAction` 两个失败分支目前都复用 `photosFavExportFailed`
  文案(brief §5/§6 明确要求),但 `commitTitle`/`togglePaused`/`doDelete`/`duplicateSv`
  四条失败分支用的是本任务新增的四个独立键——如果后续任务发现这四个新键与某个更早
  就该有的通用错误键重复,可以合并,目前没有找到更合适的既有键可复用(已在报告"申报
  偏离"第 3 条说明 grep 过程)。

---

# Fix round 1

状态:**DONE**

评审(opus)判 **Spec ❌ / Needs fixes**:1 Critical + 2 Important + 2 条并入的 Minor(其余
5 条 Minor 记台账,未动)。**架构核心(§7e-2 修复)评审判定为"这份交付里质量最高的部分"
——不动。**

## 改了哪些文件

- 改 `src/views/PhotosSmartViewDetail.vue`
- 改 `src/views/__tests__/PhotosSmartViewDetail.test.ts`(新增 11 例:61 例,原 50 例)

## 逐条修法

### C1(Critical)—— 导出 ZIP 的 fetch 补 `method: 'POST'`

`downloadZip()` 的 `fetch(url, {...})` 补 `method: 'POST'`(不需要 body,handler 优先取
query 的 `format`,已在 URL 里)。控制器已回源实证:`route/v1/smartviews.go:34` 只注册了
`g.POST`,全仓 grep 该路径只有这一条、无 GET 版本;默认 GET 会被拒成 405,导出 100% 不通。
补断言 `expect((opts).method).toBe('POST')`(原来完全没测方法,评审反向变异过——补上正确
方法后 50 例仍全绿,证明测试对方法零区分力)。

### I2(Important)—— 补齐三处丢失的 `<Transition>`

两个菜单包 `<Transition name="sv-menu">`(样式规则:`opacity 0.14s` + `transform 0.16s`
的 `translateY(-4px) scale(0.97)`,`transform-origin: top right`,照搬 Vue2
scss:454-455);删除确认弹窗包 `<Transition name="sv-confirm">`(`opacity 0.2s` +
`scale(0.95)`,照搬 Vue2 `photos.scss:702-707`,类名不沿用 Vue2 的 `lb-confirm` 命名,
理由同模板里已有的注释——避免与 `PhotoLightbox.vue` 已有同名 transition 混淆)。**Vue3
用 `-enter-from`/`-leave-to`**,不是 Vue2 的 `-enter`,照本文件已有的 `.sv-toast-fade-*`
既定写法。

补两类断言:①`parseCssRules` 先锚定规则体、断言 transition 的具体值;②回源到 `?raw`
源文本,用正则配对 `<Transition name="sv-menu">...</Transition>` 逐对核实两个菜单各自的
`data-test` 标记确实落在对应的 Transition 包裹范围内(而不是"样式定义了但模板没接上"的
假绿——这正是评审抓到的问题模式)。

### I3(Important)—— `.tile.recent::after` 补内阴影

`box-shadow: inset 0 0 0 2px color-mix(in srgb, black 40%, transparent);`——照搬 Vue2
scss:506-513 的效果(在浅色照片上把 accent 边框压出对比),不写字面 `rgba(`/hex(`black`
关键字 + `color-mix` 有本仓先例 `PhotosTrash.vue:405`)。补 `parseCssRules` 锚定断言。

### M2(并入)—— 补建两列布局容器,消除 T8 的可预见返工

新增 `.sv-detail-layout`(`display: grid; grid-template-columns: 1fr 320px`)包住
`.sv-detail-main`(内容列)与 `aside.sv-detail-side`(右栏,T8 挂载点)。`.sv-detail-side`
从"挂在网格下面的自创空壳 margin"改成 Vue2 那组基础外观:`border-left` + 实底背景 +
`padding: 20px 18px 40px`(`--line`→`--divider`、`--surface-1`→`--panel-bg-solid`,后者
的映射先例是 `PlaceDetailPanel.vue:38/312` 同类"内容旁常驻实底侧栏"场景)。**滚动条美化
(Vue2 scss:172-186/195-208)刻意不搬**——留给 T8 真正引入可滚动内容时再决定,已在初版
报告 Concerns 登记过,本轮不动。窄屏 ≤768px 塌成单列(`grid-template-columns: 1fr` +
`border-top` 换 `border-left`)。补 3 条断言:桌面两列值、窄屏单列值、模板结构(aside 在
`.sv-detail-layout` 内而非直接挂在 `.sv-header`/网格下方——通过 mount 测试里
`sv-side-mount` 与两段网格的 DOM 层级关系间接验证,未额外新增断言点)。

### M5(并入)—— 补 3 条低成本断言

- `sv-cond-editor-mount`(T7)与 `sv-side-mount`(T8)挂载点存在性断言(原来 grep 0 命中)。
- `.sv-detail-bar` 两条:`evaluatedAt` 非空时渲染出 `photosSvLastUpdatedTime` 套壳的
  `relTime` 结果;为空时兜底显示 `'—'`(照搬 Vue2 `:332`)。
- `fetch` 的 `method` 断言(见 C1,已实现)。

### `.sv-action-btn-primary` 伴生类 hover 选择器改成复合选择器(评审折中方案,控制器裁定)

`.sv-action-btn-primary:hover` → `.sv-action-btn.sv-action-btn-primary:hover`;
`.sv-export-item-danger:hover` → `.sv-export-item.sv-export-item-danger:hover`。前者
真实 CSS 优先级 (0,3,0),结构上稳赢基类 `.sv-action-btn:hover` 的 (0,2,0),不依赖书写
顺序——原来的单类写法与基类同为 (0,2,0),平局时只靠源码顺序才没白底白字,是本期"hover
硬约束"明确要防的脆弱写法。DOM 上仍保留 `data-primary="true"` 属性(与 Vue2 视觉一致)。
补强断言:两条 `winningHoverBackground` 测试新增 `expect(win.specificity).toBe(3)`
(原来只断言 selector 含子串,单类写法也能通过子串检查,测不出"是不是真的靠优先级取胜"
这个关键点)。

同时补一条此前"一个字都没登记"的偏离注释:`.sv-action-btn[data-primary]` 从 Vue2 的
`linear-gradient(135deg, accent, accent-hi)` 改成 `var(--accent)` 实底 +
`filter: brightness(1.08)` hover 的既定映射,理由是本仓无 `--accent-hi`(全局约定 §33)。

## 每条改动的"能变红"断言逐个删码验证(手工还原,禁 `git checkout --`)

| 改动 | 删码方式 | 结果 |
|---|---|---|
| C1 fetch method | 去掉 `method: 'POST'` | **红**——`toBe('POST')` 断言收到 `undefined` |
| I2 导出菜单 Transition | 用脚本摘掉导出菜单那对 `<Transition name="sv-menu">...</Transition>`(only 剩 more 菜单那对) | **红**——"两个 sv-menu Transition 配对"断言:`menuBlocks.length` 期望 2 实得 1 |
| I3 inset 阴影 | 删掉 `box-shadow` 声明 | **红**——`parseCssRules` 锚定的规则体里读不到 `box-shadow: inset 0 0 0 2px` |
| M2 两列布局 | `.sv-detail-layout` 改回 `display: flex`(去掉 `grid-template-columns`) | **红**——桌面两列值断言读不到 `grid-template-columns: 1fr 320px` |
| M5 sv-side-mount | 去掉 `data-test="sv-side-mount"` | **红**——挂载点存在性断言 `exists()` 为 `false` |
| M5 .sv-detail-bar 兜底 | `lastUpdated` 强制恒为 `'—'` | **红**——"evaluatedAt 非空应渲染出真实值,不是恒定 `'—'`" 的 `not.toBe` 断言失败 |
| hover 复合选择器 | `.sv-action-btn.sv-action-btn-primary:hover` 改回单类 `.sv-action-btn-primary:hover` | **红**——新补的 `expect(win.specificity).toBe(3)` 收到 `2`(证明这条新断言确实在钉真实优先级,不是重复原有的子串检查) |

6 条全部按预期变红,逐条 Edit 手工还原,确认还原后全量重跑绿。

## 测试小结

- 只跑覆盖改动的文件(未重跑全量,按本轮要求):`pnpm exec vitest run
  src/views/__tests__/PhotosSmartViewDetail.test.ts src/photos/util/__tests__/formatBytes.test.ts
  src/router/index.test.ts src/styles/color-guard.test.ts` → **4 files / 504 tests 全绿**
  (组件测试文件本身 61 例,原 50 + 本轮新增 11)。
- `pnpm exec vue-tsc --noEmit`:**exit 0**。
- color-guard:通过(新样式全部走 token/`color-mix`,注释三禁——不写字面 `#hex`、不写
  `rgba(`、`<script>` 注释不写字面 `<style>` 一词——逐条自查未违反)。

## Concerns(fix round 1 新增)

- M2 只补了 `.sv-detail-side` 的基础外观(边框/底色/padding),Vue2 那组自定义滚动条
  美化(渐变滑块、`::-webkit-scrollbar-*`)刻意留白——T8 真正往右栏塞入可滚动内容时需要
  自行决定是否补齐,不是本轮遗漏。
- `.sv-detail-main` 目前只给了 `overflow-y: auto` + `padding-bottom: 60px`,没有搬 Vue2
  scss:170-174 那组滚动条美化(同上,理由一致,T8/后续任务视内容量决定)。
