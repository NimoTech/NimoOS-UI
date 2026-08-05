# SP8-P5a Task 10 报告 —— KnowledgeLayout.vue

## 文件
- 新增 `src/ai/knowledge/views/KnowledgeLayout.vue`
- 新增 `src/ai/knowledge/views/KnowledgeLayout.test.ts`

## 蓝本对照(`git show main:src/views/AI/Knowledge/KnowledgeLayout.vue`,210 行)

| 蓝本行号 | 内容 | 本仓落点 |
|---|---|---|
| :2-45 | `.knowledge-app` > `aside.k-rail`(head/section/nav 9 项/状态块/foot) | 模板同结构,零改动 DOM/class |
| :47-71 | `.k-main`(topbar/banner/router-view) | 同结构 |
| :73-85 | `.k-mobile-tabs`(前 4 项 + More) | 同结构,`NAV.slice(0,4)` 逐字照抄 |
| :87-91 | `.k-toast` | **不移植**(K3),已删除 |
| :99-108 | `NAV` 常量 | 逐字照抄 id/en/icon,另加 `labelKey` 字段(见下方 i18n 适配说明) |
| :110-120 | `TITLES` 常量 | 逐字照抄 en 字段,`titleKey` 换算成 aiKb 键 |
| :141-153 | `currentTab` 的 if/endsWith 不对称判据 | 逐字照抄这个不对称,注释里写明「不做统一成一种写法的顺手重构」 |
| :154-156 | `currentNav` | 原样 |
| :157-161 | `svcState` | 原样 |
| :162-167 | `svcMeta` | 原样,`n.toLocaleString()` 保留 |
| :168-175 | `badges` | 原样,含 :173 那行「allowlist 恒为 null」的死代码原样保留(见下方偏离说明) |
| :176-181 | `userName`(读 Vuex) | **K8 改写**,见下方专节 |
| :183-190 | `created()`/`beforeDestroy()` 10s 轮询 | 迁到 `onMounted`/`onUnmounted`,行为原样(含 `document.hidden` 判据) |
| :191-194 | `navigate()` | 原样 |
| :195-198 | `onRefresh()` | 原样(`await loadOverview()` 后 toast) |

## i18n 键适配(纯机械,非行为变化)

蓝本 `$t(n.en)` / `$t(titleKey)` 直接拿字面英文短语当 key(Vue2 语言包以短语为 key)。本仓新键一律 `aiKb*` 前缀,所以：
- 每个 `NAV` 项多带一个 `labelKey` 字段,指向对应的 `aiKbNavXxx` 键(rail-item-cn 与移动端 tab 文案共用同一个 `t(n.labelKey)`,与蓝本两处都调用 `$t(n.en)` 行为一致)。
- `TITLES` 的 `titleKey` 字段:
  - `dashboard/search/indexed-files/roots/allowlist/notes` 六个 tab,蓝本 titleKey 字面短语与该 tab 的 NAV 短语相同 → 复用同一个 `aiKbNavXxx` 键(蓝本对同一英文短语的两次 `$t()` 调用,翻译结果本就相同)。
  - `wiki`(titleKey='Wiki map' ≠ nav 'Wiki')→ `aiKbTitleWikiMap`。
  - `queue`(titleKey='Job Queue' ≠ nav 'Queue')→ `aiKbTitleJobQueue`。
  - `settings`(titleKey='Advanced Settings' ≠ nav 'Settings')→ `aiKbTitleAdvancedSettings`。这正是 **N8** 的落点。

复用键:`aiKbKnowledgeBase`/`aiKbBrowse`/`aiKbStatus`/`aiKbIndexer`/`aiKbLastSynced`/`aiKbRefresh`/`aiKbRefreshed`/`aiKbOffline`/`aiKbPaused`/`aiKbRunningIndexed`/`aiKbMore`/`aiKbServiceOfflineBanner`/9 个 `aiKbNavXxx`/`aiKbTitleWikiMap`/`aiKbTitleJobQueue`/`aiKbTitleAdvancedSettings`/`aiCfgYou`(K8)。**本任务未新增任何 i18n 键**——全部来自 T8 已落地的 94 条 + 复用的 `aiCfgYou`。

## CSS 类 grep 确认清单(评审 Minor 订正:原写 32 个,实际本组件用到 29 个基类 + 1 个修饰类 `ghost` = 30 个;`k-scroll`/`k-scroll-inner`/`k-skel` 三个白名单类本组件与蓝本都不用,之前多算了)

```
knowledge-app  k-rail  k-rail-head  k-rail-title  k-rail-sub  k-rail-section  k-rail-nav
k-rail-item  k-rail-item-label  k-rail-item-cn  k-rail-item-en
k-rail-svc  k-rail-svc-row  k-rail-svc-dot  k-rail-svc-name  k-rail-svc-meta  k-rail-foot
k-main  k-topbar  k-topbar-title  k-topbar-sub  k-topbar-spacer
k-banner  k-banner-icon  k-mobile-tabs  k-mobile-tab  k-badge  k-badge-dot
k-btn(+ghost 修饰类)
```
(实测 `grep -oE 'class="[^"]*"' KnowledgeLayout.vue` 模板段,29 个基类各出现 ≥1 次,`k-scroll`/`k-scroll-inner`/`k-skel` 均未出现在本组件模板里。)
逐个 `grep -q "\.$c\b" src/ai/styles/knowledge.scss` 全部命中(见任务过程记录,无 MISSING 输出)。

## 属性态输出确认

- `[data-active]`:rail 项与移动端 tab 均输出字符串 `"true"`/`"false"`(`String(currentTab === n.id)`),单测覆盖「当前项 true、其余全部 8 项 false」(补强,见下)。
- `[data-tone]`:`k-badge`(notes 徽标 `warn`)、`k-banner`(`warn`)——单测覆盖两态。
- `[data-state]`:`k-rail-svc-dot` 三态 error/paused/running——单测覆盖三态。

## `knowledge.scss` import 落点

`<script setup>` 顶部:
```ts
import '../../styles/knowledge.scss'
```
照 `src/ai/views/AgentPage.vue:71-72` 的既有先例(JS 侧 import,而非 `<style>` 块里 `@import`)。**本文件是全仓第一处 import 这个文件的地方**——`KnowledgeDeferred.vue`(T5)特意没 import,留给本任务;`pnpm build` 日志确认 sass 编译无任何告警/报错(见下方三门)。

## K8 写法对照

逐字复用 `src/ai/components/settings/SettingsRail.vue:75-86`:
```ts
interface StoredUser { nickname?: string; username?: string; role?: string }
const storedUser = computed<StoredUser>(() => {
  try {
    const raw = localStorage.getItem('user')
    return raw ? (JSON.parse(raw) as StoredUser) : {}
  } catch { return {} }
})
const userLabel = computed(() => storedUser.value.nickname || storedUser.value.username || t('aiCfgYou'))
```
未使用 `useUserProfile()`(该 store 只有 `avatarVersion`/`bumpAvatarVersion`,无用户名字段,已亲自打开核实)。回落文案复用既有键 `aiCfgYou`(zh=`你`/en=`You`),未新增键。

## K3 toast

`onRefresh()` 直接调用 `store.toast(t('aiKbRefreshed'))`,store 内部已改调 `useToast().show(msg, 2400)`(T6/T7 已落地)。本组件**不渲染任何 toast DOM**,模板末尾只留一行注释说明 K3 退役去向,无 `.k-toast`/`.k-toast-ico`。

## N8 照抄确认 + 钉子用例

- rail 第 9 项:`t('aiKbNavSettings')` = 「系统设置」。
- topbar 标题(settings tab):`t('aiKbTitleAdvancedSettings')` = 「高级设置」。
- 钉子用例:`KnowledgeLayout.test.ts` describe `KnowledgeLayout — topbar / banner` 里的
  `'N8:rail 第 9 项是「系统设置」而 topbar 标题是「高级设置」'`,额外补了一行
  `expect(...).not.toBe(...)` 显式断言两者不相等。

## §3.5 8 条「照抄不改」命中确认

本任务只涉及 rail/topbar 壳层,命中 **N8**(见上)。N1-N7 属于 store/仪表盘层,不在本任务范围,未涉及。

## 偏离申报

1. **badges.allowlist 恒为 null 的死代码**(蓝本 :173 `folderRules.length > 0 ? null : null`)——两支结果相同,是蓝本本身的死代码,不是可复现的错误行为,**原样保留**(未做「顺手清理成 `null`」的重构),加了注释说明。
2. **i18n 键名机械映射**(NAV/TITLES 的 `labelKey`/`titleKey` 字段指向 aiKb 键而非蓝本字面英文短语)——纯机械改名,翻译结果与蓝本逐一对应,非行为变化,已在文件头注释与本报告「i18n 键适配」一节详细说明。
3. **测试脚手架 bug 修正(不在 K1-K8/P1-P4/N1-N8 清单内,单独申报)**:brief Step 2 给的 `makeRouter()` 把顶层路由 `/ai/knowledge` 的 `component` 设成 `KnowledgeLayout` 本身,同时又把 `KnowledgeLayout` 直接 mount 成测试根组件。这会导致组件内唯一的 `<router-view/>` 在渲染树里天然是 depth 0,而 depth 0 匹配到的又是 `KnowledgeLayout` 自己 → 自我递归渲染一次。实测:`.knowledge-app` 数量为 2、`.k-rail-item` 从 9 变 18、`loadOverview`/`refreshNotesDraftCount` 因 `onMounted` 触发两次而各被记两次。**这是测试代码本身的 bug,不是「1:1 照 Vue2」冲突,也不是实现的问题**——生产环境里真正挂载 `KnowledgeLayout` 的是 `App.vue` 自己最外层的 `<router-view/>`(depth 0 在那一层被吃掉),`KnowledgeLayout` 内部的 `<router-view/>` 因此天然是 depth 1,不会自我递归。修正:改用扁平路由(顶层路径直接指向 Stub,`KnowledgeLayout` 不出现在路由表里),使被测组件内的 `<router-view/>` 单纯匹配到子页面,不再自引用。已在测试文件里写明修正理由的详细注释。
4. **brief 未覆盖的 mock 缺口修正**:brief Step 2 没有 mock `@nimotech/nimoos-service`,导致未显式 `vi.spyOn` `loadOverview`/`refreshNotesDraftCount` 的用例(如「unreachable 时出警示条」)会触发 `onMounted` 里对 `service.ai.parserStats/parserState` 的真实调用,在 jsdom 里因无网络而失败,提前把 `unreachable` 置 true,造成初始断言假红(网络竞态,非实现 bug)。已照 T6 `knowledgeStore.parser.test.ts` 已确立的 `vi.hoisted` + `vi.mock('@nimotech/nimoos-service', …)` 写法补上确定性 mock。

## 测试补强(相对 brief 原版)

1. `data-active` 断言从「当前项 + 一项对照」扩到「当前项 true、其余全部 8 项 false」(`items.forEach` 逐项断言)。
2. 移动端 tabs 补了「前 4 项文案与 NAV 前 4 项一致」的独立用例(brief 原版只测数量与 data-active)。
3. K8 rail 页脚用户名补了 4 条独立用例:nickname 优先 / 只有 username / JSON 损坏 / 无 `user` 键(后两种回落「你」)。
4. N8 用例追加了 `not.toBe` 的显式互斥断言。

## 四次 RED 探针

全部在提交前的工作区里做,每次改动前后各跑一次目标用例,截图式贴关键输出,复原后 `git status --short` 只剩两个新文件(无残留改动)。

### 探针 1:N8 —— 把 settings 的 titleKey 改成与 labelKey 同一个键
```diff
-  settings: { en: 'Advanced Settings', titleKey: 'aiKbTitleAdvancedSettings' },
+  settings: { en: 'Advanced Settings', titleKey: 'aiKbNavSettings' },
```
```
FAIL … N8:rail 第 9 项是「系统设置」而 topbar 标题是「高级设置」
AssertionError: expected '系统设置' to be '高级设置'
```
已还原,`git status --short` 干净。

### 探针 2:`[data-active]` —— 全部项恒为 true
```diff
-          :data-active="String(currentTab === n.id)"
+          :data-active="String(true)"
```
```
FAIL … 当前 tab 的 data-active 为 "true",其余全部 8 项为 "false"
AssertionError: expected 'true' to be 'false'
```
已还原,`git status --short` 干净。

### 探针 3:轮询 —— 删掉 `if (document.hidden) return`
```diff
   pollTimer = setInterval(() => {
-    if (document.hidden) return
     store.loadOverview()
   }, 10000)
```
```
FAIL … 10 秒轮询;document.hidden 时跳过;卸载时清定时器
AssertionError: expected "wrappedAction" to be called 2 times, but got 3 times
```
已还原,`git status --short` 干净。

### 探针 4:`onUnmounted` —— 不清定时器(定时器泄漏)
```diff
 onUnmounted(() => {
-  if (pollTimer) {
-    clearInterval(pollTimer)
-    pollTimer = null
-  }
+  // probe: intentionally not clearing the timer
 })
```
```
FAIL … 10 秒轮询;document.hidden 时跳过;卸载时清定时器
AssertionError: expected "wrappedAction" to be called 3 times, but got 6 times
```
已还原,`git status --short` 干净。

## 三门终值

```
pnpm test        exit=0   Test Files  312 passed (312)   Tests  2826 passed (2826)
pnpm exec vue-tsc --noEmit   exit=0(无输出)
pnpm build       exit=0
```
- 算术核对:基线 311 文件/2805 例 → 本任务 +1 `.vue`(color-guard 动态 +1)+1 测试文件(20 例)= **312 文件 / 2805+20+1 = 2826 例**,与实测完全吻合。
- 无已知噪声用例出现(`persist.test.ts`/`AgentComposer.test.ts` 本次全绿,未复跑)。
- `pnpm build` 完整输出已核对:除既有第三方包告警(`@vueuse/core` 的 `/* #__PURE__ */` 位置告警、`lottie-web`/`file-type` 的 `eval` 告警)与 >500KB chunk 告警外,**无任何 sass 相关告警或报错**——`knowledge.scss` 首次真正进入构建管线,编译干净。

## `git show --stat HEAD` / `git status`(第一轮提交 `15ea9fc`)

`git status --short` 为空,`git show --stat HEAD` 只列本任务的两个新文件(`KnowledgeLayout.vue` / `KnowledgeLayout.test.ts`)。见下方第二轮提交章节的最终 sha。

---

# 评审回合(2026-08-01)—— R8 Critical + 3 条 Important + 1 条 Minor

## C1(Critical,裁定 R8)—— 父路由没接上,KnowledgeLayout 是死代码

### 问题

`knowledgeRoutes.ts` 的父路由(布局位)`component` 一直是 `KnowledgeDeferred`(T5 原文),而 `KnowledgeDeferred` 没有 `<router-view/>` 出口。结果:
- 全仓没有任何生产代码 import `KnowledgeLayout`(只有注释提到过名字)。
- `dist/assets/*.css` 里搜不到 `knowledge-app`——`knowledge.scss` 585 行从未真正编译进产物。
- 下游 T12 的 `DashboardView` 连渲染的机会都没有(`KnowledgeDeferred` 没有出口)。

T5/T10(本任务)/T12 三份 brief 都没写「父路由该在哪个任务接上 `KnowledgeLayout`」这一步。协调者裁定这步归 T10。

### 改动原文(`src/ai/knowledge/knowledgeRoutes.ts`)

改前:
```ts
// 本批(K7)全部 9 个子路由 + 2 条 parser 路由的 component 都先指向占位页
// KnowledgeDeferred,T12 会把 '' 子路由换成真正的 DashboardView。
import type { RouteRecordRaw } from 'vue-router'
import KnowledgeDeferred from './views/KnowledgeDeferred.vue'

export const knowledgeRoutes: RouteRecordRaw[] = [
  {
    path: '/ai/knowledge',
    component: KnowledgeDeferred,
    children: [ … 9 条子路由,component 全部 KnowledgeDeferred … ],
  },
  { path: '/ai/parser', name: 'AIParser', component: KnowledgeDeferred },
  { path: '/ai/parser/test', name: 'AIParserTest', component: KnowledgeDeferred },
]
```

改后:只改了父路由那一行(`component: KnowledgeDeferred` → `component: KnowledgeLayout`),9 个子路由与 2 条 parser 路由 **原样不动**,头部注释改写说明这一步的来龙去脉(见文件头,已加 R8 段落)。

### T5 断言反转(不是删除)—— 原文 vs 改后原文

改前(T5 原文,`knowledgeRoutes.test.ts`):
```ts
it('本期(P5a)全部 11 条路由的 component 都还是占位页 KnowledgeDeferred', () => {
  const components = [
    ...knowledgeRoutes[0].children!.map((c) => c.component),
    knowledgeRoutes[1].component,
    knowledgeRoutes[2].component,
  ]
  expect(components).toHaveLength(11)
  for (const c of components) expect(c).toBe(KnowledgeDeferred)
})
```

改后:
```ts
it('父路由(布局位)是 KnowledgeLayout,9 个子路由 + 2 条 parser 路由仍是占位页 KnowledgeDeferred', () => {
  expect(knowledgeRoutes[0].component).toBe(KnowledgeLayout)
  const stillDeferred = [
    ...knowledgeRoutes[0].children!.map((c) => c.component),
    knowledgeRoutes[1].component,
    knowledgeRoutes[2].component,
  ]
  expect(stillDeferred).toHaveLength(11)
  for (const c of stillDeferred) expect(c).toBe(KnowledgeDeferred)
})
```
原断言的改前原文已作为注释保留在文件里(不是无声删除),符合用户对占位机制的长期要求「反转不删」。

### dist 实证(C1 的验收判据)

```
$ grep -rl 'knowledge-app' dist/assets/*.css
dist/assets/index-Bh4zZr5X.css

$ grep -rl 'k-rail-item' dist/assets/*.css
dist/assets/index-Bh4zZr5X.css
```
两条命令都有输出。对照:C1 修复前跑同样两条命令是空输出(见协调者原始报告的实测)。

修复前后 CSS 产物体积对照(同一次 `pnpm build`,文件哈希不同是因为内容变了):
- 修复前:`dist/assets/index-Bh2xA7E5.css` 283.85 kB
- 修复后:`dist/assets/index-Bh4zZr5X.css` 295.54 kB(+11.69 kB,与 `knowledge.scss` 585 行编译产物体量吻合)

### 这次 build 的 sass 告警实情

```
$ grep -i "sass\|deprecat" /tmp/p5a-t10-build-r2.log
(none found)
```
无任何 sass 相关告警或报错——这才是 `knowledge.scss` 第一次真正被编译(C1 之前它虽然被 T10 的 `<script setup>` import 了,但父路由没接上 `KnowledgeLayout`,Vite 的 tree-shaking/未使用模块分析下这行 import 有没有真正触发编译存疑;协调者的复核结论是「没编译才没告警」——C1 修复后 dist 里确实出现了 `knowledge-app`/`k-rail-item`,证明这次是真编译,而且编译干净)。

## Important 2 —— 「界面全无样式」故障模式补了自动化守卫

### 新增用例原文(`src/ai/styles/knowledgeStyles.test.ts`)

```ts
function lineIsLiveImport(line: string, needle: string): boolean {
  const trimmed = line.trim()
  return trimmed.startsWith('import') && trimmed.includes(needle)
}

function findVueFilesImporting(dir: string, needle: string): string[] {
  const hits: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = resolve(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      hits.push(...findVueFilesImporting(full, needle))
    } else if (entry.endsWith('.vue')) {
      const content = readFileSync(full, 'utf8') as string
      if (content.split('\n').some((line: string) => lineIsLiveImport(line, needle))) hits.push(full)
    }
  }
  return hits
}

describe('knowledge.scss —— 必须被至少一个生产 .vue 文件 import(评审 Important 开放发现 2)', () => {
  it('src/ai 下有 .vue 文件 import 了 knowledge.scss,否则样式表编译不出任何 CSS、整个知识库区裸奔', () => {
    const aiDir = resolve(__dirname, '..')
    const importers = findVueFilesImporting(aiDir, 'styles/knowledge.scss')
    expect(importers.length, '…').toBeGreaterThan(0)
  })
})
```

### 自己做 RED 探针时抓到的真实 bug(申报)

第一版守卫用 `content.includes(needle)` 裸子串匹配。按评审建议的探针「把 `import '../../styles/knowledge.scss'` 注释掉」做验证时:
```diff
- import '../../styles/knowledge.scss'
+ // import '../../styles/knowledge.scss'
```
```
结果:1 passed（应该报红,却绿了）
```
根因:注释掉之后那一行文本里子串 `styles/knowledge.scss` 原封不动还在,`content.includes(needle)` 分不清「真的 import」与「写在注释里的同一段文字」——跟 P3b 教训 4「子串检查抓不住真实缺陷」是同一类坑,这次是自己的探针把自己刚写的守卫抓出来的。

修正:改成逐行检查,只有「整行去空白后以 `import` 开头、且包含 needle」才算数(见上方 `lineIsLiveImport`)。修正后重新跑同一探针:

改前(RED,守卫已修正后):
```
FAIL … src/ai 下有 .vue 文件 import 了 knowledge.scss…
AssertionError: 没有任何 .vue 文件 import knowledge.scss …: expected 0 to be greater than 0
```
还原 import 那行后重新跑,通过。`git status --short` 干净(探针改动已还原)。

## Important 3 —— rail/移动端图标 svg 非空断言(`KnowledgeLayout.test.ts`)

### 新增用例原文

```ts
it('rail 9 项与移动端 5 项渲染出的 svg 图标内容非空(防 NAV 图标名手滑成不存在的 glyph)', async () => {
  const { w } = await mountLayout()
  const railSvgs = w.findAll('.k-rail-item svg')
  expect(railSvgs).toHaveLength(9)
  railSvgs.forEach((svg, idx) => {
    expect(svg.element.innerHTML, `rail item #${idx} 的图标渲染为空`).not.toBe('')
  })
  const mobileSvgs = w.findAll('.k-mobile-tab svg')
  expect(mobileSvgs).toHaveLength(5)
  mobileSvgs.forEach((svg, idx) => {
    expect(svg.element.innerHTML, `移动端 tab #${idx} 的图标渲染为空`).not.toBe('')
  })
})
```

### RED 探针

改前/改后:
```diff
-  { id: 'dashboard', en: 'Dashboard', icon: 'home', labelKey: 'aiKbNavDashboard' },
+  { id: 'dashboard', en: 'Dashboard', icon: 'homez', labelKey: 'aiKbNavDashboard' },
```
```
FAIL … rail 9 项与移动端 5 项渲染出的 svg 图标内容非空…
AssertionError: rail item #0 的图标渲染为空: expected '' not to be ''
```
已还原,`git status --short` 干净。

## Important 4 —— TITLES wiki/queue 两项补覆盖,topbar 副标题两档都有对照(`KnowledgeLayout.test.ts`)

### 新增用例原文

```ts
it('wiki:标题取 aiKbTitleWikiMap,副标题带 /wiki 子路径', async () => {
  const { w } = await mountLayout('/ai/knowledge/wiki')
  expect(w.find('.k-topbar-title').text()).toBe('Wiki 导航')
  expect(w.find('.k-topbar-sub').text()).toBe('Wiki · /ai/knowledge/wiki')
})

it('queue:标题取 aiKbTitleJobQueue(≠ nav 的「任务」),副标题带 /queue 子路径(主钉子,判别力强于 wiki)', async () => {
  const { w } = await mountLayout('/ai/knowledge/queue')
  expect(w.find('.k-topbar-title').text()).toBe('任务队列')
  expect(w.find('.k-topbar-sub').text()).toBe('Job Queue · /ai/knowledge/queue')
  expect(w.find('.k-topbar-title').text()).not.toBe('任务')
})
```
(makeRouter 补了 `/ai/knowledge/wiki` 这条子路由,原来只有 dashboard/queue/notes/settings 四条。)

### RED 探针

改前/改后:
```diff
-  queue: { en: 'Job Queue', titleKey: 'aiKbTitleJobQueue' },
+  queue: { en: 'Job Queue', titleKey: 'aiKbNavQueue' },
```
```
FAIL … queue:标题取 aiKbTitleJobQueue…
AssertionError: expected '任务' to be '任务队列'
```
已还原,`git status --short` 干净。

说明:`aiKbNavWiki` 与 `aiKbTitleWikiMap` 中文值都是「Wiki 导航」(Vue2 语言包实测如此,照抄正确),所以 wiki 那条用例判别力天然弱于 queue;queue 是主钉子,已在用例注释与本报告里说明。

## 开放发现 5(Minor)—— 蓝本行号订正 + router-view 断言

### 订正后的蓝本行号对照表(逐个回 `git show main:` 复核;下表标注了本次亲自抽查的两条)

| 结构 | 订正前(误) | 订正后(实测) |
|---|---|---|
| rail | :2-45 | :2-47 |
| k-main | :47-71 | :50-72 |
| mobile tabs | :73-85 | :74-90 |
| k-toast | :87-91 | :92-96 |
| NAV | :99-108 | :104-114 |
| TITLES | :110-120 | :116-126 |
| currentTab | :141-146(注释里写 :141-153) | :140-151 |
| currentNav | :154-156 | :152-154 |
| svcState | :157-161 | :155-159 |
| svcMeta(★抽查复核) | :162-167 | **:160-165** |
| badges(★抽查复核,含内部 :172) | :168-175(内部误写 :173) | **:166-175**(内部 :172) |
| userName | :176-181 | :176-181(本来就对) |
| created/beforeDestroy | :183-190 | :183-190(本来就对) |
| beforeDestroy 单独 | 曾误写 :189-190(其实是 created 内部) | :192-194 |
| navigate | 曾误写 :191-194(实为 created 尾部) | :196-199 |
| onRefresh | 曾误写 :195-198(实为 navigate) | :200-203 |

★抽查复核实测(`git show main:src/views/AI/Knowledge/KnowledgeLayout.vue \| cat -n \| sed -n '160,175p'`):
```
   160	    svcMeta() {
   161	      if (this.store.state.unreachable) return this.$t('Offline')
   162	      if (this.store.state.controlState.paused) return this.$t('Paused')
   163	      const n = this.store.state.stats.indexed_files
   164	      return this.$t('Running · {n} indexed', { n: n.toLocaleString() })
   165	    },
   166	    badges() {
   167	      const failed = this.store.state.stats.queue_depth.failed
   168	      const drafts = this.store.state.notesDraftCount
   169	      return {
   170	        queue: failed > 0 ? { kind: 'number', value: failed } : null,
   171	        notes: drafts > 0 ? { kind: 'number', value: drafts, tone: 'warn' } : null,
   172	        allowlist: this.store.state.folderRules.length > 0 ? null : null,
   173	        settings: null,
   174	      }
   175	    },
```
两条抽查全部对上(svcMeta :160-165、badges :166-175 含内部 :172),已在 `KnowledgeLayout.vue` 头注释与各处行内注释订正。

### router-view 出口断言(之前零覆盖)

```ts
describe('KnowledgeLayout — router-view 出口', () => {
  it('渲染当前路由匹配的子组件', async () => {
    const { w } = await mountLayout()
    expect(w.find('.stub-child').exists()).toBe(true)
  })
})
```

## 三门终值(第二轮,含 C1 + 4 条修法)

```
pnpm test                     exit=0   Test Files  312 passed (312)   Tests  2831 passed (2831)
pnpm exec vue-tsc --noEmit     exit=0(无输出)
pnpm build                     exit=0
```
- 第一次 `pnpm test` 跑出 `Errors 1 error`(exit=1)但 `Test Files 312 passed / Tests 2831 passed`——是已知噪声「`AgentComposer.test.ts` 的 vue-i18n teardown 竞态」(`window is not defined` unhandled rejection,不是某条用例断言失败),复跑一次后 exit=0、无 Errors。`persist.test.ts` 那条已知噪声两次都没出现。
- 算术核对:第一轮基线 312 文件/2826 例 → 本轮修法新增 5 条用例(C1 的路由反转用例是替换,不计增量;knowledgeStyles 1 条 + KnowledgeLayout 的图标非空 1 条 + router-view 出口 1 条 + wiki 1 条 + queue 1 条 = 5)→ **312 文件 / 2826+5 = 2831 例**,与实测完全吻合。文件数不变(没有新增 `.vue`)。
- `pnpm build`:`grep -rl 'knowledge-app' dist/assets/*.css` → `dist/assets/index-Bh4zZr5X.css`(有输出);`grep -rl 'k-rail-item' dist/assets/*.css` → 同一文件(有输出)。`grep -i "sass\|deprecat"` 对 build 日志 → 无输出,无 sass 告警。

## 提交(第二轮)

```
$ git add src/ai/knowledge/knowledgeRoutes.ts src/ai/knowledge/knowledgeRoutes.test.ts \
          src/ai/knowledge/views/KnowledgeLayout.vue src/ai/knowledge/views/KnowledgeLayout.test.ts \
          src/ai/styles/knowledgeStyles.test.ts
$ git commit -m "fix(knowledge): SP8-P5a R8 —— 父路由接上 KnowledgeLayout + 4 条评审补强"
```
`git show --stat HEAD` 与 `git status` 见下方返回协调者的摘要(sha 在其中)。
