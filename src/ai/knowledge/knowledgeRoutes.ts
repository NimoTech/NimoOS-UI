// SP8-P5a Task 5 — knowledge base 11 routes (blueprint NimoOS-UI@main src/router/route.js:155-200,
// git show main: read from source, working tree is old branch unreliable, see governance §1).
//
// Divergence declarations (following governance §2 three-part):
// 1) Route names verbatim from blueprint PascalCase (KnowledgeDashboard etc.), rest of this repo's
//    routes are kebab-case (ai-agent/ai-settings) — this task intentionally keeps blueprint naming;
//    deep links/programmatic navigation 1:1 match names; 1:1 Vue2 takes precedence over this repo's
//    naming convention.
// 2) Components use this repo's existing top-level eager import style (see src/router/index.ts),
//    not blueprint's () => import(...) lazy-loading — follows this repo's existing route files.
// 3) Don't copy blueprint meta.requireAuth/meta.showBackground and hidden fields — this repo's
//    meta semantics differ (guard.ts only recognizes meta.public for public routes); follow this
//    repo's existing ai-agent/ai-settings routes (both don't write meta); auth falls back to
//    global authGuard.
//
// [Review R8, Critical, 2026-08-01 fix] Parent route (layout position) originally also pointed to
// placeholder KnowledgeDeferred — KnowledgeDeferred lacks `<router-view/>` outlet, so
// KnowledgeLayout (T10) had zero imports in entire repo, became dead code; knowledge.scss also
// never actually entered build output (`dist/assets/*.css` no `knowledge-app` search hit).
// T5/T10/T12 three briefs didn't specify "which task should wire parent route to KnowledgeLayout",
// coordinator ruled this belongs to T10 (shell task output shouldn't be dead code).
// Now parent route component changed to KnowledgeLayout, its own `<router-view/>` has content
// to render. 9 child routes + 2 standalone parser routes **still** point to KnowledgeDeferred —
// `''` child route reserved for T12 to replace with real DashboardView; remaining 8 child routes
// and 2 parser routes reserved for later batches to replace one by one (K7 mechanism unchanged,
// just parent layer changes from "placeholder to placeholder" to "real layout + placeholder children").
// 【T12,2026-08-01】`''` 子路由(仪表盘位)从占位页 KnowledgeDeferred 反转成
// 真正的 DashboardView(K7 机制不变,反转不是删除 —— 见
// knowledgeRoutes.test.ts 的改前/改后原文对照)。其余 8 个子路由 + 2 条独立
// parser 路由仍是占位页,留给后续批次逐个替换。
//
// 【SP8-P5b Task 5,2026-08-01】`queue` 子路由(任务队列位)同样从占位页
// KnowledgeDeferred 反转成真正的 QueueView(K7 机制不变,反转不是删除 —— 见
// knowledgeRoutes.test.ts 的改前/改后原文对照,承 T12 对 `''` 子路由的先例)。
// 其余 7 个子路由 + 2 条独立 parser 路由仍是占位页,留给后续批次逐个替换。
//
// 【SP8-P5b Task 10,2026-08-02】`indexed-files` 子路由(已收录文件位)同样从占位页
// KnowledgeDeferred 反转成真正的 IndexedFilesView(K7 机制不变,反转不是删除 ——
// 见 knowledgeRoutes.test.ts 的改前/改后原文对照,承 T12/T5 的同一先例)。
// 其余 6 个子路由 + 2 条独立 parser 路由仍是占位页,留给后续批次逐个替换。
//
// 【SP8-P5c Task 10,2026-08-04】本期一次反转**三条**(承 T12 / P5b T5 / P5b T10
// 三次同款先例,反转不是删除):
//   · `settings` 子路由 → 真正的 SettingsView(T8 上半 + T9 下半的产出);
//   · 顶层 `/ai/parser`      → 真正的 ParserStatus(T6 的产出);
//   · 顶层 `/ai/parser/test` → 真正的 ParserTest(T7 的产出)。
// 🔴 This is also the **first time `src/ai/styles/parser-styles.scss` (T2b output) is
// entry-reachably imported** — before this ParserStatus/ParserTest had zero production imports
// in entire repo, module doesn't enter Vite graph; that scss file's side-effect import never
// evaluated, no CSS compiled in output (governance §12.3 E-13: `.vue` just "exists and imports"
// doesn't enter output).
// [M-5, 2026-08-05, P5e-T8 incidental fix] 🔴 This section is a **snapshot of state at P5c-T10
// submission (2026-08-04)**; original text uses present tense "remaining 5 child routes ... still point
// to KnowledgeDeferred" — this statement was already advanced once by the P5d Task 10 record below
// (5→4), now advanced again by the P5e Task 8 record at end of file (4→3). **This original text
// preserved intact per "reverse not delete", only tone changed from present to historical record,
// not changing historical facts it describes**: at the moment P5c-T10 completed, `search` / `wiki` /
// `roots` / `allowlist` / `notes` these 5 child routes truly all still pointed to KnowledgeDeferred;
// K7 placeholder mechanism itself preserved; `allowlist` explicitly moved out this period by user
// 2026-08-03 (governance §2.2), not a migration miss. **After P5c-T10 reverse, parser's two
// top-level routes had no placeholder remnants (remains so).**
// 🔴 Current latest state always follows last reverse record at end of file + `deferred.ts` header,
// don't just read this section.
//
// 【SP8-P5d Task 10,2026-08-05】`notes` 子路由(笔记位)同样从占位页
// KnowledgeDeferred 反转成真正的 NotesView(T6-T9 四刀收官的产出;K7 占位机制
// 本身不变 —— 见 knowledgeRoutes.test.ts 的改前/改后原文对照,承 T12 / P5b T5 /
// P5b T10 / P5c T10 四次同款先例)。**本刀是本期(P5d)最后一环** —— `/ai/knowledge`
// 左栏第 4 项「笔记」第一次真正可达。剩下 4 个子路由(`search` / `wiki` / `roots` /
// `allowlist`)仍指 KnowledgeDeferred,归属见 `deferred.ts` 文件头。
// 【M-5 复发,P5f-T8 顺手订正,2026-08-06 —— 只改语气,不改它描述的历史事实】
// 🔴 上面那句「剩下 4 个子路由**仍指** KnowledgeDeferred」是 **P5d-T10 落笔当时
// (2026-08-05)的状态快照**,用的是现在时;它此后已被 P5e-T8(4→3)推进过一次。
// 按「反转不删」原文整体保留,**读作历史记录**:*于 P5d-T10 完成的那一刻*,那 4 个
// 子路由确实都还指向占位页。当前状态见文件末尾最近一次反转记录。
//
// 【SP8-P5e Task 8,2026-08-05,第六次反转(不是删除)】`search` 子路由(搜索位)同样
// 从占位页 KnowledgeDeferred 反转成真正的 SearchView(T4-T7 四刀收官的产出;K7 占位
// 机制本身不变 —— 见 knowledgeRoutes.test.ts 的改前/改后原文对照,承 T12 / P5b T5 /
// P5b T10 / P5c T10 / P5d T10 五次同款先例)。**本刀是本期(P5e)最后一环** ——
// `/ai/knowledge` 左栏第 2 项「搜索」第一次真正可达。剩下 3 个子路由(`wiki` /
// `roots` / `allowlist`)仍指 KnowledgeDeferred,全部归 P5f(见 `deferred.ts` 文件头)。
// 【M-5 复发,P5f-T8 顺手订正,2026-08-06 —— 只改语气,不改它描述的历史事实】
// 🔴 同上:「剩下 3 个子路由**仍指** KnowledgeDeferred」是 **P5e-T8 落笔当时
// (2026-08-05)的状态快照**;本刀(P5f-T8)已把这 3 条全部反转成真组件(3→0)。
// 按「反转不删」原文保留,**读作历史记录**。
// 🔴 **通用读法(M-5 已连续复发三期,写死在这里)**:本文件头是一条**逐代追加的
// 谱系**,每一段都只描述「该刀落笔那一刻」的状态。**当前最新状态永远以最后一段
// 反转记录为准,不要引用中间任何一段的「剩下 N 个」。**
//
// [SP8-P5f Task 8, 2026-08-06, seventh reverse (not delete) — final closing move] This move reverses
// **three routes** (following T12 / P5b T5 / P5b T10 / P5c T10 / P5d T10 / P5e T8 six precedents):
//   · `wiki`      child route → true **WikiView** (T6 first half + T7 second half output);
//   · `roots`     child route → true **RootsView** (T5 output);
//   · `allowlist` child route → true **AllowlistView** (T4 output).
// 🔴 **This move is the final step of this period (P5f) and the closing move of SP8-P5 six batches**
// — `/ai/knowledge` left rail item 3 "Wiki" / item 7 "Index Directory" / item 8 "Allowlist"
// truly reachable for first time.
// 🔴 **After this move, all 11 routes in this file (9 child + 2 parser top-level) never point
// to KnowledgeDeferred again** — placeholder page has zero remnants in `/ai/knowledge` region.
// 🔴 But K7 mechanism of `KnowledgeDeferred.vue` and `deferred.ts` **both preserved** (K8 /
// following P4 I2): knowledgeRoutes.test.ts uses "KnowledgeDeferred appears 0 times in all
// components" + one "actually got 11 components" anti-empty-loop anchor to pin this state;
// deferred.test.ts uses temporary non-empty list to prove judgment mechanism itself still works.
// When future placeholder page needed, just point back to KnowledgeDeferred.
// 🔴 This is also **first time `WikiView.vue` / `RootsView.vue` / `AllowlistView.vue` are
// entry-reachably imported** — before this all three had zero production imports in entire repo,
// modules don't enter Vite graph (governance §12.3 E-13: `.vue` just "exists" doesn't enter output).
// This move already tested per governance §8 build pipeline gate: before change `dist/assets/*.js`
// has `__name:"WikiView"` / `"RootsView"` / `"AllowlistView"` and `kw-split` all **0 hits**,
// after change all hit (evidence in p5f-task-8-report.md).
import type { RouteRecordRaw } from 'vue-router'
// 🔴 【P5f T8 申报】本刀反转最后三条路由之后,**本文件已无任何一条路由指向
// KnowledgeDeferred** ⇒ 这行 import 在本文件里成了「未被引用的 import」。
// **刻意保留,不删**(K8 / 承 P4 I2 的「留代码要留能力」+ 治理 §9.10「只许加固」):
//   · 它是 K7 占位机制在生产侧的唯一锚点 —— 删掉后 `KnowledgeDeferred.vue` 全仓零
//     生产 import、彻底掉出 Vite 图,机制就只剩一个没人引的文件;
//   · 将来要给新页面挂占位,只需把某条路由的 component 改回它,一行即可;
//   · `noUnusedLocals` 未开启,`vue-tsc --noEmit` 与 `vite build` 均 exit 0(已实测)。
// knowledgeRoutes.test.ts 侧仍逐条 `not.toBe(KnowledgeDeferred)` 消费它,并用
// 「KnowledgeDeferred 在 11 个 component 里出现 0 次」+ 防空转锚点钉住当前状态。
import KnowledgeDeferred from './views/KnowledgeDeferred.vue'
import KnowledgeLayout from './views/KnowledgeLayout.vue'
import DashboardView from './views/DashboardView.vue'
import QueueView from './views/QueueView.vue'
import IndexedFilesView from './views/IndexedFilesView.vue'
import SettingsView from './views/SettingsView.vue'
import NotesView from './views/NotesView.vue'
import SearchView from './views/SearchView.vue'
import WikiView from './views/WikiView.vue'
import RootsView from './views/RootsView.vue'
import AllowlistView from './views/AllowlistView.vue'
import ParserStatus from './parser/ParserStatus.vue'
import ParserTest from './parser/ParserTest.vue'

export const knowledgeRoutes: RouteRecordRaw[] = [
  {
    path: '/ai/knowledge',
    component: KnowledgeLayout,
    children: [
      { path: '', name: 'KnowledgeDashboard', component: DashboardView },
      { path: 'search', name: 'KnowledgeSearch', component: SearchView },
      // 改前(P5e T8 原文,反转前):component: KnowledgeDeferred —— 见文件头 P5f T8 记录。
      { path: 'wiki', name: 'KnowledgeWiki', component: WikiView },
      { path: 'indexed-files', name: 'KnowledgeIndexedFiles', component: IndexedFilesView },
      { path: 'queue', name: 'KnowledgeQueue', component: QueueView },
      // 改前(P5e T8 原文,反转前):component: KnowledgeDeferred。
      { path: 'roots', name: 'KnowledgeRoots', component: RootsView },
      // 改前(P5e T8 原文,反转前):component: KnowledgeDeferred。
      { path: 'allowlist', name: 'KnowledgeAllowlist', component: AllowlistView },
      { path: 'notes', name: 'KnowledgeNotes', component: NotesView },
      { path: 'settings', name: 'KnowledgeSettings', component: SettingsView },
    ],
  },
  { path: '/ai/parser', name: 'AIParser', component: ParserStatus },
  { path: '/ai/parser/test', name: 'AIParserTest', component: ParserTest },
]
