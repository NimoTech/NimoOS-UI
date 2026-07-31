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
// 本批(K7)全部 9 个子路由 + 2 条 parser 路由的 component 都先指向占位页
// KnowledgeDeferred,T12 会把 '' 子路由换成真正的 DashboardView。
import type { RouteRecordRaw } from 'vue-router'
import KnowledgeDeferred from './views/KnowledgeDeferred.vue'

export const knowledgeRoutes: RouteRecordRaw[] = [
  {
    path: '/ai/knowledge',
    component: KnowledgeDeferred,
    children: [
      { path: '', name: 'KnowledgeDashboard', component: KnowledgeDeferred },
      { path: 'search', name: 'KnowledgeSearch', component: KnowledgeDeferred },
      { path: 'wiki', name: 'KnowledgeWiki', component: KnowledgeDeferred },
      { path: 'indexed-files', name: 'KnowledgeIndexedFiles', component: KnowledgeDeferred },
      { path: 'queue', name: 'KnowledgeQueue', component: KnowledgeDeferred },
      { path: 'roots', name: 'KnowledgeRoots', component: KnowledgeDeferred },
      { path: 'allowlist', name: 'KnowledgeAllowlist', component: KnowledgeDeferred },
      { path: 'notes', name: 'KnowledgeNotes', component: KnowledgeDeferred },
      { path: 'settings', name: 'KnowledgeSettings', component: KnowledgeDeferred },
    ],
  },
  { path: '/ai/parser', name: 'AIParser', component: KnowledgeDeferred },
  { path: '/ai/parser/test', name: 'AIParserTest', component: KnowledgeDeferred },
]
