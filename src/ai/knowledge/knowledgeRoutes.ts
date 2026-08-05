// SP8-P5a Task 5 —— 知识库 11 条路由(蓝本 NimoOS-UI@main src/router/route.js:155-200,
// git show main: 读取,工作树是旧分支不可信,见治理文件 §1)。
//
// 偏离申报(照治理文件 §2 三件套):
// 1) 路由 name 逐字沿用蓝本 PascalCase(KnowledgeDashboard 等),本仓其余路由
//    是 kebab-case(ai-agent/ai-settings)——本任务刻意保留蓝本命名,深链接/
//    编程式跳转与 name 一一对应,1:1 照 Vue2 优先于本仓命名惯例。
// 2) component 用本仓既有的顶部 eager import 风格(见 src/router/index.ts),
//    不用蓝本的 () => import(...) 懒加载——照本仓既有路由文件的写法。
// 3) 不照抄蓝本 meta.requireAuth/meta.showBackground 与 hidden 字段——本仓
//    meta 语义不同(guard.ts 只认 meta.public 标公开路由),照本仓既有的
//    ai-agent/ai-settings 路由(均不写 meta)处理,鉴权由全局 authGuard 兜底。
//
// 【评审 R8,Critical,2026-08-01 修正】父路由(布局位)原来也指向占位页
// KnowledgeDeferred——KnowledgeDeferred 没有 `<router-view/>` 出口,于是
// KnowledgeLayout(T10)全仓零 import、成了死代码,knowledge.scss 也因此从未
// 真正进过构建产物(`dist/assets/*.css` 里搜不到 `knowledge-app`)。T5/T10/T12
// 三份 brief 都没写「父路由该在哪个任务接上 KnowledgeLayout」这一步,协调者
// 裁定这步归 T10(外壳任务的产出不该是死代码)。
// 现在父路由 component 改成 KnowledgeLayout,它自己的 `<router-view/>`
// 才有内容可渲染。9 个子路由 + 2 条独立 parser 路由**仍然**指向
// KnowledgeDeferred——`''` 子路由留给 T12 换成真正的 DashboardView,其余 8
// 个子路由与 2 条 parser 路由留给后续批次逐个替换(K7 机制不变,只是父路由
// 这一层从「占位页替占位页」变成「真布局 + 占位页子页」)。
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
// 🔴 这也是 `src/ai/styles/parser-styles.scss`(T2b 的产出)**第一次被入口可达地
// import** —— 在此之前 ParserStatus/ParserTest 全仓零生产 import,模块不进 Vite
// 图,那份 scss 的 side-effect import 从未求值、产物里编不出任何 CSS(治理 §12.3
// 的 E-13:`.vue` 光「存在且写了 import」进不了产物)。
// 【M-5,2026-08-05,P5e-T8 顺手订正】🔴 本段是 **P5c-T10 落笔时(2026-08-04)的状态
// 快照**,原文用现在时写「剩下 5 个子路由……仍指 KnowledgeDeferred」—— 这句话早已
// 被下面 P5d Task 10 的记录推进过一次(5→4),现在又被本文件末尾 P5e Task 8 的记录
// 再推进一次(4→3)。**此处原文按「反转不删」整体保留,仅把语气从现在时改成历史
// 记录,不改变它描述的历史事实**:于 P5c-T10 完成的那一刻,`search` / `wiki` /
// `roots` / `allowlist` / `notes` 这 5 个子路由确实都还指向 KnowledgeDeferred,
// K7 占位机制本身保留;`allowlist` 是用户 2026-08-03 明示移出本期的(治理 §2.2),
// 不是漏迁。**P5c-T10 反转后,parser 两条顶层路由已无占位页残留(此后一直如此)。**
// 🔴 当前最新状态永远以文件末尾最近一次反转记录 + `deferred.ts` 文件头为准,不要
// 只读这一段。
//
// 【SP8-P5d Task 10,2026-08-05】`notes` 子路由(笔记位)同样从占位页
// KnowledgeDeferred 反转成真正的 NotesView(T6-T9 四刀收官的产出;K7 占位机制
// 本身不变 —— 见 knowledgeRoutes.test.ts 的改前/改后原文对照,承 T12 / P5b T5 /
// P5b T10 / P5c T10 四次同款先例)。**本刀是本期(P5d)最后一环** —— `/ai/knowledge`
// 左栏第 4 项「笔记」第一次真正可达。剩下 4 个子路由(`search` / `wiki` / `roots` /
// `allowlist`)仍指 KnowledgeDeferred,归属见 `deferred.ts` 文件头。
//
// 【SP8-P5e Task 8,2026-08-05,第六次反转(不是删除)】`search` 子路由(搜索位)同样
// 从占位页 KnowledgeDeferred 反转成真正的 SearchView(T4-T7 四刀收官的产出;K7 占位
// 机制本身不变 —— 见 knowledgeRoutes.test.ts 的改前/改后原文对照,承 T12 / P5b T5 /
// P5b T10 / P5c T10 / P5d T10 五次同款先例)。**本刀是本期(P5e)最后一环** ——
// `/ai/knowledge` 左栏第 2 项「搜索」第一次真正可达。剩下 3 个子路由(`wiki` /
// `roots` / `allowlist`)仍指 KnowledgeDeferred,全部归 P5f(见 `deferred.ts` 文件头)。
import type { RouteRecordRaw } from 'vue-router'
import KnowledgeDeferred from './views/KnowledgeDeferred.vue'
import KnowledgeLayout from './views/KnowledgeLayout.vue'
import DashboardView from './views/DashboardView.vue'
import QueueView from './views/QueueView.vue'
import IndexedFilesView from './views/IndexedFilesView.vue'
import SettingsView from './views/SettingsView.vue'
import NotesView from './views/NotesView.vue'
import SearchView from './views/SearchView.vue'
import ParserStatus from './parser/ParserStatus.vue'
import ParserTest from './parser/ParserTest.vue'

export const knowledgeRoutes: RouteRecordRaw[] = [
  {
    path: '/ai/knowledge',
    component: KnowledgeLayout,
    children: [
      { path: '', name: 'KnowledgeDashboard', component: DashboardView },
      { path: 'search', name: 'KnowledgeSearch', component: SearchView },
      { path: 'wiki', name: 'KnowledgeWiki', component: KnowledgeDeferred },
      { path: 'indexed-files', name: 'KnowledgeIndexedFiles', component: IndexedFilesView },
      { path: 'queue', name: 'KnowledgeQueue', component: QueueView },
      { path: 'roots', name: 'KnowledgeRoots', component: KnowledgeDeferred },
      { path: 'allowlist', name: 'KnowledgeAllowlist', component: KnowledgeDeferred },
      { path: 'notes', name: 'KnowledgeNotes', component: NotesView },
      { path: 'settings', name: 'KnowledgeSettings', component: SettingsView },
    ],
  },
  { path: '/ai/parser', name: 'AIParser', component: ParserStatus },
  { path: '/ai/parser/test', name: 'AIParserTest', component: ParserTest },
]
