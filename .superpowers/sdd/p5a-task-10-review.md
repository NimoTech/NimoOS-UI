# SP8-P5a Task 10 评审 —— `KnowledgeLayout.vue`

评审者独立执行,未采信实现者报告。蓝本一律 `git show main:src/views/AI/Knowledge/KnowledgeLayout.vue`
(210 行,落盘 `/tmp/p5a-t10-bp.vue`)。提交 `15ea9fc`。

## 判定

- **Spec 合规:❌**(界面/逻辑移植本身正确,但产物未接线 → 本任务声称的交付效果不成立)
- **任务质量:不通过**(1 Critical + 3 Important;测试判别力有三处真空,已用 5 次 RED 探针实证)

Critical 1 严格说根因在计划(无任何 P5a 任务负责把父路由接到 `KnowledgeLayout`),
但它直接推翻本任务「用户第一次能看到这个区」「knowledge.scss 首次进构建管线」两条交付声明,
且实现者报告把后者写成了**已核实的事实**,故按 Critical 计入本任务。

---

## 1. 逐块 DOM 对照表(蓝本 → 本仓)

| 蓝本 | 结构 | 本仓行 | 结论 |
|---|---|---|---|
| :2 | `div.knowledge-app`(无 `data-theme`) | :202 | ✅ 1:1,**未误加 `data-theme`,未接 `aiTheme`/`useAiTheme`** |
| :4 | `aside.k-rail` | :204 | ✅ |
| :5-10 | `.k-rail-head` > `div[style="flex: 1; min-width: 0"]` > `.k-rail-title` + `.k-rail-sub`(字面 `RAG · NimoOS`) | :205-210 | ✅ 连内联 style 与字面量都 1:1 |
| :12 | `.k-rail-section`(Browse) | :212 | ✅ |
| :13-29 | `nav.k-rail-nav` > `a.k-rail-item` ×9:`[data-active]` + `:href` 三元 + `@click.prevent` + `KIcon size=15` + `.k-rail-item-label`(`.k-rail-item-cn` + `.k-rail-item-en`)+ `.k-badge[data-tone]` / `.k-badge-dot[data-tone]` 二选一 | :213-238 | ✅ 层级/顺序/属性全同 |
| :31 | `.k-rail-section[style="margin-top: 8px"]`(Status) | :240 | ✅ |
| :32-41 | `.k-rail-svc` > `.k-rail-svc-row`(`.k-rail-svc-dot[data-state]` + `.k-rail-svc-name`)+ `.k-rail-svc-meta` ×2(第二个带内联 flex style + `KIcon clock size=11` + `lastSyncFmt`) | :241-250 | ✅ |
| :43-46 | `.k-rail-foot` > `KIcon user size=13` + `NimoOS · {userName}` | :252-255 | ✅ 结构同,取值走 K8(见 §5) |
| :50-63 | `.k-main` > `header.k-topbar`(`KIcon currentNav.icon size=18 color="var(--accent)"` + `div` > `.k-topbar-title` + `.k-topbar-sub` + `.k-topbar-spacer` + `button.k-btn.ghost[title]` > `KIcon refresh size=14`) | :259-272 | ✅ |
| :66-69 | `.k-banner[data-tone="warn"]` > `.k-banner-icon` > `KIcon info size=13` + 文案 span | :275-278 | ✅(`data-tone` 写死 `warn`,与蓝本一致 —— T4 评审已确认 scss 里没有 `warn` 档、落回基类橙色,是 Vue2 现状) |
| :71 | `<router-view/>` | :280 | ✅ 蓝本此处**没有** `.k-scroll`/`.k-scroll-inner`(那两个类属于子页面 `KnowledgeDeferred`/`DashboardView`)。评审任务书里「`k-scroll` + `k-scroll-inner` + `<router-view/>`」一条与权威蓝本不符,以蓝本为准 → 本仓正确 |
| :75-89 | `nav.k-mobile-tabs` > `button.k-mobile-tab` ×4(`NAV.slice(0, 4)`)+ 「More」按钮(`data-active` = 后 5 个 tab 之一;`KIcon grid size=18`;`@click="navigate('allowlist')"`) | :284-303 | ✅ 逐字 1:1,含 `['indexed-files','queue','roots','allowlist','settings']` 数组 |
| :93-96 | `.k-toast`(无条件绿勾) | 不移植 | ✅ K3。**全文无 `.k-toast` / `.k-toast-ico` / 任何自绘 toast DOM**,只在 :306 留一行注释说明去向 |

`<script>` 侧:`currentTab`(:140-151 的 `includes`/`endsWith` 不对称)、`currentNav`(:152-154)、
`svcState`(:155-159)、`svcMeta`(:160-165,含 `toLocaleString()`)、`badges`(:166-175,含 :172
`folderRules.length > 0 ? null : null` 死代码)、`navigate`(:196-199)、`onRefresh`(:200-203)
—— **全部逐句 1:1**,死代码与不对称判据都照抄了,注释里也写明了「不做顺手统一」。

## 2. 9 项 rail 对照表

| # | id | icon(蓝本) | icon(本仓) | KIcon 里存在? | 中文标签(实测 `t()`) | Vue2 语言包 | 英文副标签 |
|---|---|---|---|---|---|---|---|
| 1 | dashboard | home | home | ✅ | 概览 | `Dashboard`→概览 ✅ | Dashboard ✅ |
| 2 | search | search | search | ✅ | 搜索 | `Search`→搜索 ✅ | Search ✅ |
| 3 | wiki | layers | layers | ✅ | Wiki 导航 | `Wiki`→Wiki 导航 ✅ | Wiki ✅ |
| 4 | notes | edit | edit | ✅ | 笔记 | `Notes`→笔记 ✅ | Notes ✅ |
| 5 | indexed-files | file | file | ✅ | 已收录文件 | `Indexed Files`→已收录文件 ✅ | Indexed Files ✅ |
| 6 | queue | history | history | ✅ | 任务 | `Queue`→任务 ✅ | Queue ✅ |
| 7 | roots | drive | drive | ✅ | 索引目录 | `Index Roots`→索引目录 ✅ | Index Roots ✅ |
| 8 | allowlist | folder | folder | ✅ | 索引范围 | `Allowlist`→索引范围 ✅ | Allowlist ✅ |
| 9 | settings | settings | settings | ✅ | **系统设置** | `Settings`→系统设置 ✅ | Settings ✅ |

四项(id / 中文 / 英文 / 图标)**逐项吻合,零出入**。图标名逐个对
`src/ai/knowledge/components/KIcon.vue` 的 `PATHS` 键实测存在(另加 `clock`/`user`/`refresh`/`info`/`grid` 五个,共 14 个全部命中)。
中文值回 `git show main:src/assets/lang/zh_CN.json` 逐字符复核,22 个短语全部一致。

## 3. `titles` 9 项对照

| tab | 蓝本 en | 本仓 en | 蓝本 titleKey | 本仓 titleKey → `t()` | Vue2 语言包 |
|---|---|---|---|---|---|
| dashboard | Dashboard | Dashboard ✅ | Dashboard | aiKbNavDashboard → 概览 ✅ | 概览 |
| search | Search | Search ✅ | Search | aiKbNavSearch → 搜索 ✅ | 搜索 |
| wiki | Wiki | Wiki ✅ | **Wiki map** | aiKbTitleWikiMap → Wiki 导航 ✅ | `Wiki map`→Wiki 导航 |
| indexed-files | Indexed Files | Indexed Files ✅ | Indexed Files | aiKbNavIndexedFiles → 已收录文件 ✅ | 已收录文件 |
| queue | **Job Queue** | Job Queue ✅ | **Job Queue** | aiKbTitleJobQueue → 任务队列 ✅ | `Job Queue`→任务队列 |
| roots | Index Roots | Index Roots ✅ | Index Roots | aiKbNavRoots → 索引目录 ✅ | 索引目录 |
| allowlist | Allowlist | Allowlist ✅ | Allowlist | aiKbNavAllowlist → 索引范围 ✅ | 索引范围 |
| notes | Notes | Notes ✅ | Notes | aiKbNavNotes → 笔记 ✅ | 笔记 |
| settings | Advanced Settings | Advanced Settings ✅ | **Advanced Settings** | aiKbTitleAdvancedSettings → **高级设置** ✅ | 高级设置 |

`en` 与 `titleKey` **逐项吻合**。TITLES 里的键顺序也照抄了蓝本那个不按 NAV 排的顺序
(`indexed-files` 在 `notes` 之前)—— 无功能影响,但确实是 1:1。

## 4. N8 复核(§3.5 照抄不改)

- rail 第 9 项 → `t('aiKbNavSettings')` = **系统设置**
- topbar 标题(settings tab)→ `t('aiKbTitleAdvancedSettings')` = **高级设置**
- 两者**都在且不同**,未被统一。测试里有 `toBe('系统设置')` / `toBe('高级设置')` 两条正向钉子
  + 一条 `not.toBe(...)` 互斥钉子。RED 探针(实现者做的,我另做了探针 5 交叉验证)确认报红。
- §3.5 其余 N1-N7 属 store / 仪表盘层,本任务未触及。**无「顺手修正」**。

## 5. K8 复核

`src/ai/components/settings/SettingsRail.vue:74-86` 原文与本仓 :145-165 **逐字比对**:
`interface StoredUser { nickname?; username?; role? }`、`computed` 内 `localStorage.getItem('user')`
+ `raw ? JSON.parse(raw) as StoredUser : {}` + `catch { return {} }`、
`nickname || username || t('aiCfgYou')` —— 结构、try/catch 位置、兜底顺序全同,只把变量名
`user` 改成 `storedUser`(治理文件 §5 明文允许「变量名可按上下文调整」)。
**未使用 `useUserProfile()`**(实测 `src/stores/userProfile.ts` 只导出 `avatarVersion`/`bumpAvatarVersion`)。
**未新增任何 i18n 键**:`git show --stat 15ea9fc` 只有 2 个文件,`src/i18n/*` 未被动;
`aiCfgYou` 实测 zh=`你`(zh_cn.ts) / en=`You`(en_us.ts),复用正确。

## 6. K2 / K3 / scss import 三件套

- `import '../../styles/knowledge.scss'` **在** —— `KnowledgeLayout.vue:41`,`<script setup>` 顶部,
  照 `src/ai/views/AgentPage.vue:71-72` 先例(实测该文件 :71 `import '../styles/tokens.scss'`、
  :72 `import '../styles/agent-styles.scss'`,写法一致)。
- 组件**零 `<style>` 块**(文件里唯一的 `<style` 字样出现在头部 HTML 注释的说明文字里,不是真块)。
- 根节点**无 `data-theme`**,也未 import/调用 `useAiTheme` —— 符合 K2 / 设计 §5.4 / 用户 D5。
- K3:全文无 `.k-toast` / `.k-toast-ico`,`onRefresh()` 走 `store.toast(t('aiKbRefreshed'))`。

## 7. CSS 类清单(逐个 grep `src/ai/styles/knowledge.scss`)

组件模板里实际用到 **30 个**类选择器(29 个 `k*` + 修饰类 `ghost`),逐个
`grep -cE "\.<class>([^a-zA-Z0-9_-]|$)"` 全部命中,**零缺失**:

```
knowledge-app(16) k-rail(3) k-rail-head(1) k-rail-title(1) k-rail-sub(1) k-rail-section(1)
k-rail-nav(1) k-rail-item(4) k-rail-item-label(1) k-rail-item-cn(1) k-rail-item-en(2)
k-rail-svc(3) k-rail-svc-row(1) k-rail-svc-dot(2) k-rail-svc-name(1) k-rail-svc-meta(1)
k-rail-foot(1) k-main(1) k-topbar(1) k-topbar-title(1) k-topbar-sub(1) k-topbar-spacer(1)
k-banner(2) k-banner-icon(3) k-mobile-tabs(3) k-mobile-tab(2) k-badge(2) k-badge-dot(1)
k-btn(1) ghost(1)
```

实现者报告里列了 32 个,多算了 `k-scroll` / `k-scroll-inner`(本组件并不使用,蓝本也不使用)
和 `k-skel`(自己标注了未用到)—— 报告清单不准,但不影响结论:**没有凭空造的类**。

## 8. 属性态 DOM 输出确认(实测渲染而非只看模板)

| 属性 | 挂点 | 输出 | 覆盖 |
|---|---|---|---|
| `[data-active]` | `a.k-rail-item` ×9 | `String(currentTab === n.id)` → 字符串 `"true"`/`"false"` | ✅ 用例 `items.forEach` 逐项断言「idx===5 为 true,其余 8 项为 false」 |
| `[data-active]` | `button.k-mobile-tab` ×5 | 同上;More 用 5-tab 数组 `includes` | ✅ 两侧(`tabs[4]=true` / `tabs[0]=false`) |
| `[data-tone]` | `.k-badge`(notes) | `warn` | ✅ 有断言;queue 徽标 `tone` 为 `undefined` → Vue 省略属性,与蓝本同 |
| `[data-tone]` | `.k-banner` | 写死 `warn` | ✅ 有断言 |
| `[data-state]` | `.k-rail-svc-dot` | `error` / `paused` / `running` **三态** | ✅ 一条用例串起三态,探针 4 证明有判别力 |

## 9. 逻辑复核

| 项 | 蓝本 | 本仓 | 结论 |
|---|---|---|---|
| 轮询周期 | `setInterval(…, 10000)` :190 | :189 `10000` | ✅ |
| `document.hidden` 跳过 | :188 | :187 | ✅ 探针(实现者)已证有判别力 |
| 卸载清理 | `beforeDestroy()` :192-194 | `onUnmounted()` :193-198(`clearInterval` + 置 `null`) | ✅ 无泄漏;句柄放组件局部 `let`(非 store),与 P2 精神一致 |
| 挂载首拉 | `created()` :184-185 两个 action | :184-185 同 | ✅ 各 1 次 |
| 刷新按钮 | `await loadOverview()` 后 `toast($t('Refreshed'))` | :174-177 同 | ✅ toast 文案 `已刷新` |
| 徽标条件 | `failed > 0` / `drafts > 0` | 同 | ✅ 两侧都有对照用例 |
| 索引器文案 | Offline / Paused / `Running · {n} indexed` | `aiKbOffline`/`aiKbPaused`/`aiKbRunningIndexed`(`运行中 · {n} 已收录`) | ✅ 与 Vue2 语言包逐字一致 |
| 「上次同步」 | `store.state.lastSyncFmt` | `store.lastSyncFmt`(T6 的 `fmtAgo` 产物) | ✅ |
| `isDeferred` 接线 | 蓝本无此概念 | 只 `import type { KnowledgeTabId } from '../deferred'`,**无任何 isDeferred 逻辑** | ✅ 无多余/矛盾逻辑(占位由 T5 的路由表负责) |
| 硬编码文案 | — | 模板里零中文字面量;英文字面量只有 `RAG · NimoOS`、`NimoOS · `、`n.en` 副标签、`/ai/knowledge` 路径 —— **全部与蓝本逐字相同且蓝本也不翻译** | ✅ 无违规硬编码 |

## 10. 实现者两条「brief 测试脚手架 bug」的独立裁定

### 10.1 `makeRouter` 自递归 —— **成立**(我把他的修复改回 brief 原文实测复现)

把 `routes` 还原成 brief 的嵌套写法(`{ path: '/ai/knowledge', component: KnowledgeLayout, children: [...] }`)
并追加一条计数用例后:

```
 Test Files  1 failed (1)
      Tests  5 failed | 16 passed (21)
 FAIL … 渲染 9 个导航项,顺序与 Vue2 一致
 AssertionError: expected [ DOMWrapper{ …(3) }, …(17) ] to have a length of 9 but got 18
 FAIL … 挂载时拉一次 overview 与草稿数
 AssertionError: expected "wrappedAction" to be called 1 times, but got 2 times
```

与他描述的现象**逐条一致**(rail 9→18、`loadOverview` 1→2 次、共 5 条红)。
根因判断也对:`mount(KnowledgeLayout)` 时组件内那个 `<router-view/>` 就是 depth 0,
而 depth 0 的匹配记录正是 `KnowledgeLayout` 自己。

**归类**:治理文件 §2 末条讲的是「brief 测试代码与 1:1 冲突时是测试错」;这条严格说不是
1:1 冲突,而是脚手架本身的纯技术错误 —— 但两者都指向「改测试,不是实现让步」,
且他按 §2 三件套做了(注释 :48-62 + 报告偏离申报第 3 条),**处理正确**。

**是否削弱断言力:没有。** brief 原有的 21 条断言一条没删。扁平路由把 `route.path`
留成真值,所以 `currentTab` / `data-active` / `href` / `navigate` 全链仍然吃劲 ——
我的探针 3(改 More 目标)与探针 4(换 `svcState` 态)都精确报红即为证。
唯一被结构性绕过的是「真实路由表把 `/ai/knowledge` 指向 `KnowledgeLayout`」这件事,
但 brief 的嵌套版同样绕过(它也自建路由表),该断言的正确归属地是
`knowledgeRoutes.test.ts` —— 而那里现在恰好断言的是 `KnowledgeDeferred`(见 Critical 1)。

### 10.2 缺 `@nimotech/nimoos-service` mock —— **成立**

删掉 `vi.hoisted` + `vi.mock('@nimotech/nimoos-service', …)` 后实测:

```
 Test Files  1 failed (1)
      Tests  1 failed | 19 passed (20)
 FAIL … KnowledgeLayout — topbar / banner > unreachable 时出警示条,否则不出
 AssertionError: expected true to be false
 ❯ …:183   expect(w.find('.k-banner').exists()).toBe(false)
```

与他描述一致:`onMounted` 的真实取数失败 → store 把 `unreachable` 置 true → 「初始不出警示条」假红。

**是否削弱断言力:没有。** mock 只替换 `service.ai.parserStats`/`parserState` 与
`service.notes.list` 的返回值(形状照治理文件 §4 的后端实测形状写,零/false),
**没有 stub 掉 store 自己的 `loadOverview` 逻辑**;三态/徽标用例都显式覆写 store 字段,
不依赖 mock 的具体数值。写法与 T6 `knowledgeStore.parser.test.ts` 一致,用了 `vi.hoisted()`。

## 11. 测试质量核查(§9)

**判别力充足的部分**

- 9 项 rail 用 `toEqual` 钉**完整英文数组**(不是只数个数)✅
- `[data-active]`:`items.forEach` 逐项断言,**其余 8 项必须是 `false`** ✅(比 brief 原版强)
- 移动端:`toHaveLength(5)` + 前 4 项中文文案 `toEqual` 与 NAV 前 4 一致 + 第 5 项 `浏览更多` ✅
- 轮询三侧齐:推进 10s 触发(1→2)/ `document.hidden` 时不触发(仍 2)/ **卸载后推进 30s 不触发**(仍 3)✅
- K8 四种 localStorage 形态各一条(nickname 优先 / 只有 username / JSON 损坏 / 无键)✅
- 警示条两侧 ✅ 徽标两侧 ✅ N8 正向 ×2 + 互斥 `not.toBe` ×1 ✅
- 无空转用例:所有用例都对生产代码有依赖(5 次探针里 3 次精确报红,2 次全绿的原因见下)
- `vi.hoisted()` 已用;异步一律 `flushPromises()`,无单独 `nextTick()`
- **既有 311 个测试文件一个都没被动**(`git show --stat 15ea9fc` 只有 2 个新文件),无削弱既有断言

**真空(见 Important 2/3/4)**

- 没有任何用例能抓到 scss import 被删(探针 1 全绿)
- 没有任何用例能抓到 NAV 图标名写成 KIcon 里不存在的 glyph(探针 2 全绿)
- `TITLES` 只有 dashboard 与 settings 被钉住;wiki/queue 那两条**蓝本刻意与 nav 不同**的
  `en`/`titleKey` 零覆盖(探针 5 全绿)
- `<router-view/>` 出口本身无断言(没有用例查 `.stub-child` 渲染进了 `.k-main`)
- `.k-topbar-sub` 只测了 dashboard 档(`· /ai/knowledge`),非 dashboard 档的
  `'/' + currentTab` 后缀分支无对照用例(§9「二选一必须两边」)

## 12. 五次独立 RED 探针(均非复用实现者的四次;全部精确还原)

| # | 破坏 | 结果 | 报红用例 |
|---|---|---|---|
| 1 | `KnowledgeLayout.vue:41` `import '../../styles/knowledge.scss'` 注释掉 | **全绿**(312 文件 / 2826 例 exit=0) | 无人报红 ❌ |
| 2 | NAV[0] `icon: 'home'` → `'homez'`(KIcon 里不存在) | **全绿**(9 文件 / 98 例) | 无人报红 ❌ |
| 3 | 移动端 More `navigate('allowlist')` → `navigate('roots')` | 红 | `More 跳到 allowlist(照抄 Vue2)` |
| 4 | `svcState` 里 `paused`/`running` 两态互换 | 红 | `三态:unreachable → error/离线;paused → paused/已暂停;否则 running/已收录数` |
| 5 | `TITLES.wiki/queue` 的 `en` 改成 `WIKIWRONG`/`QUEUEWRONG` 且 `titleKey` 合并成 nav 的键 | **全绿**(8 文件 / 89 例) | 无人报红 ❌ |

改前/改后与还原确认见下,每次探针后 `git status --short` 与 `git diff HEAD --stat` 均为空。

```
# 探针 1  改前: import '../../styles/knowledge.scss'
#         改后: // PROBE1 import '../../styles/knowledge.scss'
# 探针 2  改前: { id: 'dashboard', en: 'Dashboard', icon: 'home',  labelKey: 'aiKbNavDashboard' },
#         改后: { id: 'dashboard', en: 'Dashboard', icon: 'homez', labelKey: 'aiKbNavDashboard' },
# 探针 3  改前: @click="navigate('allowlist')"
#         改后: @click="navigate('roots')"
# 探针 4  改前: if (store.controlState.paused) return 'paused' / return 'running'
#         改后: if (store.controlState.paused) return 'running' / return 'paused'
# 探针 5  改前: wiki: { en: 'Wiki', titleKey: 'aiKbTitleWikiMap' } · queue: { en: 'Job Queue', titleKey: 'aiKbTitleJobQueue' }
#         改后: wiki: { en: 'WIKIWRONG', titleKey: 'aiKbNavWiki' } · queue: { en: 'QUEUEWRONG', titleKey: 'aiKbNavQueue' }
```

KIcon 对未知 name 的行为经实测是**渲染空 `<svg>` 且不抛**
(`KIcon.test.ts` 自己有这条),所以探针 2 对应的线上表现是**图标位置空白** —— 可见回归。
`KIcon.test.ts:23` 那条「22 个 name 全部存在」用的是**测试文件里硬编码的数组**,
与 `KnowledgeLayout` 的 `NAV` 完全解耦,所以改 NAV 抓不到。

## 13. 三门(评审者实测)

```
pnpm test                  exit=0   Test Files  312 passed (312)   Tests  2826 passed (2826)
pnpm exec vue-tsc --noEmit exit=0   (0 行输出)
pnpm build                 exit=0
```

与实现者报的 312/2826 完全一致;算术核对通过(基线 311/2805 → +1 测试文件 20 例 + color-guard 动态 +1 = 312/2826)。
已知噪声(`persist.test.ts` / `AgentComposer.test.ts`)本次未出现。

**build 告警**:只有既有第三方噪声 —— `@vueuse/core` 两处 `/* #__PURE__ */` 位置告警、
`lottie-web`/`file-type` 的 `eval` 告警、以及 >500KB chunk 告警。
**零 sass / scss / deprecation 告警**。

**dist CSS 里有没有 `knowledge-app`:没有。** 见 Critical 1。

```
$ grep -rl 'knowledge-app' dist/            # 无输出
$ grep -rl 'k-rail-item'  dist/             # 无输出
$ for f in dist/assets/*.css; do grep -c 'k-rail' $f; done   # 全为 0
```

## 14. 提交卫生

- `git show --stat 15ea9fc` = `KnowledgeLayout.test.ts`(+308)· `KnowledgeLayout.vue`(+308),**只这两个文件** ✅
- `git status --short` 干净(探针全部还原后复查两次)✅
- `NimoOS-UI`:`git status --short` 只有一个与本期无关的未跟踪文件 `FRONTEND_API_GUIDE.md`(SP7 会话的),
  **无本任务提交**,我一个都没碰 ✅
- `.sp8/NimoOS-Service`:本任务无新提交 ✅

---

# 发现清单

## Critical

### C1 —— `KnowledgeLayout` 根本没被接进路由,是死代码;`knowledge.scss` 至今未进构建产物

`src/ai/knowledge/knowledgeRoutes.ts:22` 里父路由 `/ai/knowledge` 的 `component` 仍是
`KnowledgeDeferred`,9 个子路由也全指向 `KnowledgeDeferred`。全仓**没有任何生产代码 import
`KnowledgeLayout.vue`**(实测:`grep -rn KnowledgeLayout src/ --include=*.ts --include=*.vue`
只命中它自己的测试、`KIcon.test.ts` 的注释、`KnowledgeDeferred.vue` 的注释、两个 i18n 注释)。

后果,全部实测:

1. Rollup 根本看不到这个模块 → `grep -rl 'k-rail-item' dist/` **无输出**,组件不在产物里。
2. 因此它顶部那行 `import '../../styles/knowledge.scss'` 也不在构建图里 →
   `grep -rl 'knowledge-app' dist/` **无输出**,T4 那 585 行样式表**编译出零字节 CSS**。
   实现者报告「`knowledge.scss` 首次真正进入构建管线,编译干净」是**不成立的**
   ——`pnpm build` 之所以没有 sass 告警,是因为它一行都没编译。
3. 治理任务书里「这是用户第一次能真正看到这个区」**不成立**:浏览器打开
   `/app/#/ai/knowledge` 渲染的是 `KnowledgeDeferred` 占位页,而且因为样式表没进产物,
   连占位页的 `.k-scroll`/`.k-empty*` 也是**无样式裸 DOM**。

**根因是计划缺口,不是本任务写错代码**:T5 报告 :134 明文写「该占位是临时的…T10 落地后会替换」,
但 T10 的 brief 里**没有**这一步(Files 只列两个 Create,Step 5 只讲三门);T12 的 brief
`:6`/`:210` 只把 `''` **子**路由从 `KnowledgeDeferred` 换成 `DashboardView`,**父路由不动**。
于是这件事在 T5 与 T10 之间掉了。若照现有计划走完 T11/T12,P5a 收官时:
父路由仍是 `KnowledgeDeferred`(它**没有** `<router-view/>`)→ `DashboardView` 子路由
连渲染机会都没有,整个知识库区在浏览器上是一张无样式占位页。

**应改成**:`knowledgeRoutes.ts` 父路由改 `component: KnowledgeLayout`(需 `import KnowledgeLayout
from './views/KnowledgeLayout.vue'`),并把 `knowledgeRoutes.test.ts` 里对父路由 component 的
断言从 `KnowledgeDeferred` **反转**成 `KnowledgeLayout`(反转,不是删除),同时补一条
「父路由 component 不是 `KnowledgeDeferred`」的负向钉子。建议协调者当作一个独立接线任务派掉,
或并进 T12 的 Step 5;**并在 P5a 收官验收清单里加一条「`grep -rl knowledge-app dist/` 必须有命中」**。

## Important

### I1 —— 「界面全无样式」这个最严重的故障模式零自动覆盖

探针 1(注释掉 `KnowledgeLayout.vue:41` 的 scss import)**全量 312 文件 / 2826 例全绿**。
单测不验 CSS 加载,`knowledgeStyles.test.ts` 只用 `node:fs` 读 `.scss` 文本、不关心谁 import 它。
配合 C1,现状是:样式表没进产物、没有任何一道自动防线会红。

**最小补救**(建议放进 `src/ai/styles/knowledgeStyles.test.ts`,与它既有的 `node:fs` 读法同款):

```ts
// 守卫:必须有生产代码 import 了 knowledge.scss,否则整个知识库区渲染成无样式裸 DOM。
it('至少有一个生产 .vue 文件 import 了 knowledge.scss', () => {
  const hits = globSync('src/**/*.vue').filter((f) =>
    /import\s+['"][^'"]*styles\/knowledge\.scss['"]/.test(readFileSync(f, 'utf8')))
  expect(hits.length, '没有任何组件 import knowledge.scss').toBeGreaterThan(0)
})
```

(`knowledgeStyles.test.ts` 已有 `read()` 助手与 `node:fs` 依赖,照它的写法即可;
`.vue` 清单可复用 `color-guard.test.ts` 已在用的枚举方式。)

### I2 —— NAV 图标名与 `KIcon` 的 `PATHS` 键之间没有任何断言

探针 2(`icon: 'home'` → `'homez'`)全绿,而 KIcon 对未知 name 渲染空 `<svg>` →
线上表现是 rail 第一项图标空白(可见回归)。`KIcon.test.ts:23` 的 22 个 name 是**硬编码数组**,
不从 `NAV` 读,所以两边可以无声漂移。

**应改成**:在 `KnowledgeLayout.test.ts` 加一条 —— 挂载后遍历 9 个 `.k-rail-item` 里的 `svg`,
断言 `innerHTML !== ''`(与 `KIcon.test.ts` 那条同款判据),这样图标名一写错立刻红。
移动端前 4 项 + topbar 的 `currentNav.icon` 同理。

### I3 —— `TITLES` 只有 2/9 项被钉住,蓝本刻意的 wiki/queue 差异零覆盖

探针 5 把 `TITLES.wiki.en`/`TITLES.queue.en` 改成垃圾字符串、并把两者 `titleKey` 合并成
nav 的键,`src/ai/knowledge` 全部 8 文件 89 例**全绿**。也就是说 `Wiki map`→`Wiki 导航`、
`Job Queue`→`任务队列` 这两处「蓝本刻意与 nav 不同」的措辞(与 N8 同一性质)无任何保护。
`.k-topbar-sub` 也只测了 dashboard 一档,`'/' + currentTab` 后缀分支(§9「二选一必须两边」)无对照。

**应改成**:参照 N8 那条的写法,给 wiki 与 queue 各补一条
`mountLayout('/ai/knowledge/wiki')` → `.k-topbar-title` = `Wiki 导航` 且
`.k-topbar-sub` = `Wiki · /ai/knowledge/wiki`;queue 同理(`任务队列` / `Job Queue · /ai/knowledge/queue`)。
一条用例同时补掉 `titleKey`、`en` 与副标题后缀分支三个真空。

## Minor

### M1 —— 文件头注释与报告里的蓝本行号系统性偏移 5-6 行(蓝本 :170 之前的全部条目)

实测(`/tmp/p5a-t10-bp.vue`,与实现者同为 210 行):

| 声称 | 实际 |
|---|---|
| `:2-45` rail | `:2-47` |
| `:47-71` k-main | `:50-72` |
| `:73-85` mobile tabs | `:74-90` |
| `:87-91` k-toast | `:92-96`(治理文件 §3 K3 已订正为 93-96) |
| `:99-108` NAV | **`:104-114`** |
| `:110-120` TITLES | **`:116-126`** |
| `:141-153` currentTab | `:140-151` |
| `:191-194` navigate | `:196-199` |
| `:195-198` onRefresh | `:200-203` |

`:176-181`(K8)与 `:183-190`(轮询)两条**是准的**。治理文件 §2 三件套要求注释注明准确的
Vue2 `file:line`,T0 评审也已就 K3 行号错误提醒过。不影响产物正确性,但下一批实现者若照这些
行号去查蓝本会找错段落。**应改成**表格右列的实测行号(至少改 `KnowledgeLayout.vue` 头部注释里的
`:99-108` / `:110-120` 两条,它们偏得最多且指向最关键的两个常量)。

### M2 —— `<router-view/>` 出口无断言

没有用例断言子页面渲染进了 `.k-main`(测试里 `Stub` 的 `.stub-child` 从未被查过)。
brief 原版也没有。**应改成**在「标题与副标题」那条里顺手加一句
`expect(w.find('.k-main .stub-child').exists()).toBe(true)`。

### M3 —— 报告里的 CSS 类清单不准

报告 §「CSS 类 grep 确认清单」写 32 个,含 `k-scroll`/`k-scroll-inner`(本组件不用)与
`k-skel`(自己标了未用到)。实际用到 30 个。结论不变(无缺失、无凭空造类),但清单本身不可直接引用。

---

# ⚠️ 待协调者裁定

1. **C1 的归属与派工**:代码本身 1:1 正确,缺的是接线,而接线不在 T10 的 brief 里。
   请协调者决定是(a)开一个独立接线任务、(b)并进 T12 Step 5、还是(c)让 T10 补一次 fix 提交。
   无论哪种,**P5a 不接线就收官 = 用户看到的还是一张无样式占位页**,建议列为收官阻塞项。
2. **评审任务书里「`k-scroll` + `k-scroll-inner` + `<router-view/>`」一条**与权威蓝本 `:71` 不符
   (蓝本此处只有裸 `<router-view/>`)。我按蓝本判本仓正确。若协调者本意是别的(例如设计文档另有要求),
   请回权威源确认后告知。
3. **`aiKbNavWiki` 与 `aiKbTitleWikiMap` 的 zh 值都是「Wiki 导航」**(实测 Vue2 语言包
   `Wiki`→`Wiki 导航`、`Wiki map`→`Wiki 导航`,确实相同)。中文界面上 nav 与 topbar 标题
   看起来一样,这是 Vue2 现状、照抄正确;只是它让 I3 建议的 wiki 用例判别力弱于 queue 那条
   (`任务` vs `任务队列` 有区别)。仅提示,不需要动。
