import { describe, it, expect } from 'vitest'
import { knowledgeRoutes } from './knowledgeRoutes'
import KnowledgeDeferred from './views/KnowledgeDeferred.vue'
import KnowledgeLayout from './views/KnowledgeLayout.vue'
import DashboardView from './views/DashboardView.vue'
import QueueView from './views/QueueView.vue'
import IndexedFilesView from './views/IndexedFilesView.vue'
import SettingsView from './views/SettingsView.vue'
import NotesView from './views/NotesView.vue'
import ParserStatus from './parser/ParserStatus.vue'
import ParserTest from './parser/ParserTest.vue'

describe('knowledgeRoutes', () => {
  it('一条布局路由带 9 个子路由 + 两条 Parser 路由', () => {
    expect(knowledgeRoutes).toHaveLength(3)
    const layout = knowledgeRoutes[0]
    expect(layout.path).toBe('/ai/knowledge')
    expect(layout.children?.map((c) => c.path)).toEqual(
      ['', 'search', 'wiki', 'indexed-files', 'queue', 'roots', 'allowlist', 'notes', 'settings'])
    expect(knowledgeRoutes[1].path).toBe('/ai/parser')
    expect(knowledgeRoutes[2].path).toBe('/ai/parser/test')
  })

  it('路由名逐字照 Vue2', () => {
    const names = [knowledgeRoutes[0].children!.map((c) => c.name),
                   knowledgeRoutes[1].name, knowledgeRoutes[2].name].flat()
    expect(names).toEqual(['KnowledgeDashboard', 'KnowledgeSearch', 'KnowledgeWiki',
      'KnowledgeIndexedFiles', 'KnowledgeQueue', 'KnowledgeRoots', 'KnowledgeAllowlist',
      'KnowledgeNotes', 'KnowledgeSettings', 'AIParser', 'AIParserTest'])
  })

  // 【评审 R8,Critical,2026-08-01 反转(不是删除)】原断言钉住「本期 11 条路由的
  // component 全部指向 KnowledgeDeferred」——这条断言本身就是这次 Critical 的
  // 反面教材:父路由(布局位)一直是 KnowledgeDeferred,KnowledgeLayout(T10)
  // 全仓零 import、knowledge.scss 从未真正进构建产物,而这条断言全程绿灯,因为
  // 它把「父路由也是占位页」断言成了「应有行为」。协调者裁定父路由这步归 T10,
  // 现反转成:父路由(布局位)=== KnowledgeLayout,9 个子路由 + 2 条独立 parser
  // 路由仍 === KnowledgeDeferred(K7 占位机制本身不变,`''` 子路由留给 T12 换成
  // 真正的 DashboardView,届时这条断言会精确报红,提醒同步更新)。
  //
  // 改前(2026-07-31,T5 原文):
  //   it('本期(P5a)全部 11 条路由的 component 都还是占位页 KnowledgeDeferred', () => {
  //     const components = [
  //       ...knowledgeRoutes[0].children!.map((c) => c.component),
  //       knowledgeRoutes[1].component,
  //       knowledgeRoutes[2].component,
  //     ]
  //     expect(components).toHaveLength(11)
  //     for (const c of components) expect(c).toBe(KnowledgeDeferred)
  //   })
  // 【T12,2026-08-01,反转(不是删除)】上面 R8 那条断言(改前）把 `''` 子路由
  // 也算进「仍是占位页」的 11 条里 —— 现在 `''` 换成真正的 DashboardView(本
  // 任务的产出），这条断言必须跟着反转，否则会精确报红（R8 comment 里预告
  // 的正是这一刻）。
  //
  // 改前（2026-08-01 R8 原文，反转前）：
  //   it('父路由(布局位)是 KnowledgeLayout,9 个子路由 + 2 条 parser 路由仍是占位页 KnowledgeDeferred', () => {
  //     expect(knowledgeRoutes[0].component).toBe(KnowledgeLayout)
  //     const stillDeferred = [
  //       ...knowledgeRoutes[0].children!.map((c) => c.component),
  //       knowledgeRoutes[1].component,
  //       knowledgeRoutes[2].component,
  //     ]
  //     expect(stillDeferred).toHaveLength(11)
  //     for (const c of stillDeferred) expect(c).toBe(KnowledgeDeferred)
  //   })
  //
  // 改后（P5a T12）：`''` 单独钉成 DashboardView；其余 8 个子路由 + 2 条 parser
  // 路由仍钉成 KnowledgeDeferred（K7 占位机制本身不变）。
  //
  // 【SP8-P5b Task 5,2026-08-01,再次反转（不是删除）】上面这条断言把 `queue`
  // 子路由也算进「仍是占位页」的 10 条里 —— 现在 `queue` 换成真正的 QueueView
  // （本任务的产出），这条断言必须跟着反转，否则会精确报红（承 T12 R8 comment
  // 里预告的同一模式）。
  //
  // 改前（P5a T12 原文，反转前）：
  //   it('父路由(布局位)是 KnowledgeLayout,"" 子路由(仪表盘)是 DashboardView,其余 8 个子路由 + 2 条 parser 路由仍是占位页 KnowledgeDeferred', () => {
  //     expect(knowledgeRoutes[0].component).toBe(KnowledgeLayout)
  //     const dashboardChild = knowledgeRoutes[0].children!.find((c) => c.path === '')
  //     expect(dashboardChild?.component).toBe(DashboardView)
  //     expect(dashboardChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const stillDeferred = [
  //       ...knowledgeRoutes[0].children!.filter((c) => c.path !== '').map((c) => c.component),
  //       knowledgeRoutes[1].component,
  //       knowledgeRoutes[2].component,
  //     ]
  //     expect(stillDeferred).toHaveLength(10)
  //     for (const c of stillDeferred) expect(c).toBe(KnowledgeDeferred)
  //   })
  //
  // 改后（P5b T5)：`''` 与 `queue` 两个子路由分别单独钉成 DashboardView /
  // QueueView；其余 7 个子路由 + 2 条 parser 路由仍钉成 KnowledgeDeferred。
  //
  // 【SP8-P5b Task 10,2026-08-02,第三次反转(不是删除)】上面这条断言把
  // `indexed-files` 子路由也算进「仍是占位页」的 9 条里 —— 现在 `indexed-files`
  // 换成真正的 IndexedFilesView（T8/T9/T10 三刀收官的产出），这条断言必须跟着
  // 反转，否则会精确报红（承 T12 R8 comment 里预告、T5 已复现过一次的同一模式）。
  //
  // 改前（P5b T5 原文，反转前）：
  //   it('父路由(布局位)是 KnowledgeLayout,"" 是 DashboardView,"queue" 是 QueueView,其余 7 个子路由 + 2 条 parser 路由仍是占位页 KnowledgeDeferred', () => {
  //     expect(knowledgeRoutes[0].component).toBe(KnowledgeLayout)
  //
  //     const dashboardChild = knowledgeRoutes[0].children!.find((c) => c.path === '')
  //     expect(dashboardChild?.component).toBe(DashboardView)
  //     expect(dashboardChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const queueChild = knowledgeRoutes[0].children!.find((c) => c.path === 'queue')
  //     expect(queueChild?.component).toBe(QueueView)
  //     expect(queueChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const stillDeferred = [
  //       ...knowledgeRoutes[0].children!.filter((c) => c.path !== '' && c.path !== 'queue').map((c) => c.component),
  //       knowledgeRoutes[1].component,
  //       knowledgeRoutes[2].component,
  //     ]
  //     expect(stillDeferred).toHaveLength(9)
  //     for (const c of stillDeferred) expect(c).toBe(KnowledgeDeferred)
  //   })
  //
  // 改后（P5b T10）：`''` / `queue` / `indexed-files` 三个子路由分别单独钉成
  // DashboardView / QueueView / IndexedFilesView；其余 6 个子路由 + 2 条 parser
  // 路由仍钉成 KnowledgeDeferred（K7 占位机制本身不变）。
  //
  // 【SP8-P5c Task 10,2026-08-04,第四次反转(不是删除)】上面这条断言把 `settings`
  // 子路由**与两条 parser 路由**都算进「仍是占位页」的 8 条里 —— 本刀一次反转三条:
  // `settings` → SettingsView（T8 上半 + T9 下半的产出）、`/ai/parser` → ParserStatus
  // （T6 的产出）、`/ai/parser/test` → ParserTest（T7 的产出），这条断言必须跟着
  // 反转，否则会精确报红（承 T12 R8 comment 里预告、T5 与 P5b T10 已复现两次的同一模式）。
  // 🔴 **本刀之后两条 parser 顶层路由再无占位页残留** → `stillDeferred` 的取数不再
  // 拼 `knowledgeRoutes[1]/[2]`，改为**只取子路由**，另加两条正向断言分别钉住它们
  // 是真组件（并 `not.toBe(KnowledgeDeferred)`）。
  // 🔴 **K7 占位机制仍被本条用例证明活着**:剩下 **5** 个子路由(`search` / `wiki` /
  // `roots` / `allowlist` / `notes`)仍钉成 KnowledgeDeferred(承 P4 I2 的教训 ——
  // 清空后要仍有用例证明它有能力，而不是只剩一段没人测的代码)。`allowlist` 留在
  // 占位页是用户 2026-08-03 明示移出本期的结果(治理 §2.2)，不是漏迁。
  //
  // 改前（P5b T10 原文，反转前）：
  //   it('父路由(布局位)是 KnowledgeLayout,"" 是 DashboardView,"queue" 是 QueueView,"indexed-files" 是 IndexedFilesView,其余 6 个子路由 + 2 条 parser 路由仍是占位页 KnowledgeDeferred', () => {
  //     expect(knowledgeRoutes[0].component).toBe(KnowledgeLayout)
  //
  //     const dashboardChild = knowledgeRoutes[0].children!.find((c) => c.path === '')
  //     expect(dashboardChild?.component).toBe(DashboardView)
  //     expect(dashboardChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const queueChild = knowledgeRoutes[0].children!.find((c) => c.path === 'queue')
  //     expect(queueChild?.component).toBe(QueueView)
  //     expect(queueChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const indexedFilesChild = knowledgeRoutes[0].children!.find((c) => c.path === 'indexed-files')
  //     expect(indexedFilesChild?.component).toBe(IndexedFilesView)
  //     expect(indexedFilesChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const migrated = ['', 'queue', 'indexed-files']
  //     const stillDeferred = [
  //       ...knowledgeRoutes[0]
  //         .children!.filter((c) => !migrated.includes(c.path))
  //         .map((c) => c.component),
  //       knowledgeRoutes[1].component,
  //       knowledgeRoutes[2].component,
  //     ]
  //     expect(stillDeferred).toHaveLength(8)
  //     for (const c of stillDeferred) expect(c).toBe(KnowledgeDeferred)
  //   })
  //
  // 【SP8-P5d Task 10,2026-08-05,第五次反转(不是删除)】上面这条断言把 `notes`
  // 子路由也算进「仍是占位页」的 5 条里 —— 本刀反转 `notes` → NotesView(T6-T9
  // 四刀收官的产出),这条断言必须跟着反转,否则会精确报红(承 T12 R8 comment
  // 里预告、T5 / P5b T10 / P5c T10 已复现三次的同一模式)。**本刀是本期(P5d)
  // 最后一环** —— `/ai/knowledge` 左栏第 4 项「笔记」第一次真正可达。
  // 🔴 **K7 占位机制仍被本条用例证明活着**:剩下 **4** 个子路由(`search` / `wiki` /
  // `roots` / `allowlist`)仍钉成 KnowledgeDeferred(承 P4 I2 的教训 —— 清空后要
  // 仍有用例证明它有能力,而不是只剩一段没人测的代码)。四项归哪一期反转见
  // `deferred.ts` 文件头(`search`→P5e;`wiki`/`roots`/`allowlist`→P5f)。
  //
  // 改前(P5c T10 原文,反转前):
  //   it('父路由(布局位)是 KnowledgeLayout,"" / "queue" / "indexed-files" / "settings" 四个子路由与两条 parser 路由都是真组件,其余 5 个子路由仍是占位页 KnowledgeDeferred', () => {
  //     expect(knowledgeRoutes[0].component).toBe(KnowledgeLayout)
  //
  //     const dashboardChild = knowledgeRoutes[0].children!.find((c) => c.path === '')
  //     expect(dashboardChild?.component).toBe(DashboardView)
  //     expect(dashboardChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const queueChild = knowledgeRoutes[0].children!.find((c) => c.path === 'queue')
  //     expect(queueChild?.component).toBe(QueueView)
  //     expect(queueChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const indexedFilesChild = knowledgeRoutes[0].children!.find((c) => c.path === 'indexed-files')
  //     expect(indexedFilesChild?.component).toBe(IndexedFilesView)
  //     expect(indexedFilesChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     const settingsChild = knowledgeRoutes[0].children!.find((c) => c.path === 'settings')
  //     expect(settingsChild?.component).toBe(SettingsView)
  //     expect(settingsChild?.component).not.toBe(KnowledgeDeferred)
  //
  //     expect(knowledgeRoutes[1].component).toBe(ParserStatus)
  //     expect(knowledgeRoutes[1].component).not.toBe(KnowledgeDeferred)
  //     expect(knowledgeRoutes[2].component).toBe(ParserTest)
  //     expect(knowledgeRoutes[2].component).not.toBe(KnowledgeDeferred)
  //
  //     // K7 机制钉子:剩下 5 个子路由仍必须指向占位页(承 P4 I2)。
  //     const migrated = ['', 'queue', 'indexed-files', 'settings']
  //     const stillDeferred = knowledgeRoutes[0]
  //       .children!.filter((c) => !migrated.includes(c.path))
  //       .map((c) => c.component)
  //     expect(
  //       knowledgeRoutes[0].children!.filter((c) => !migrated.includes(c.path)).map((c) => c.path),
  //     ).toEqual(['search', 'wiki', 'roots', 'allowlist', 'notes'])
  //     expect(stillDeferred).toHaveLength(5)
  //     for (const c of stillDeferred) expect(c).toBe(KnowledgeDeferred)
  //   })
  //
  // 改后(本次,P5d T10,收官):`''` / `queue` / `indexed-files` / `settings` /
  // `notes` 五个子路由 + 两条 parser 顶层路由各自单独钉成真组件;剩下 4 个子
  // 路由仍钉成 KnowledgeDeferred。
  it('父路由(布局位)是 KnowledgeLayout,"" / "queue" / "indexed-files" / "settings" / "notes" 五个子路由与两条 parser 路由都是真组件,其余 4 个子路由仍是占位页 KnowledgeDeferred', () => {
    expect(knowledgeRoutes[0].component).toBe(KnowledgeLayout)

    const dashboardChild = knowledgeRoutes[0].children!.find((c) => c.path === '')
    expect(dashboardChild?.component).toBe(DashboardView)
    expect(dashboardChild?.component).not.toBe(KnowledgeDeferred)

    const queueChild = knowledgeRoutes[0].children!.find((c) => c.path === 'queue')
    expect(queueChild?.component).toBe(QueueView)
    expect(queueChild?.component).not.toBe(KnowledgeDeferred)

    const indexedFilesChild = knowledgeRoutes[0].children!.find((c) => c.path === 'indexed-files')
    expect(indexedFilesChild?.component).toBe(IndexedFilesView)
    expect(indexedFilesChild?.component).not.toBe(KnowledgeDeferred)

    const settingsChild = knowledgeRoutes[0].children!.find((c) => c.path === 'settings')
    expect(settingsChild?.component).toBe(SettingsView)
    expect(settingsChild?.component).not.toBe(KnowledgeDeferred)

    const notesChild = knowledgeRoutes[0].children!.find((c) => c.path === 'notes')
    expect(notesChild?.component).toBe(NotesView)
    expect(notesChild?.component).not.toBe(KnowledgeDeferred)

    expect(knowledgeRoutes[1].component).toBe(ParserStatus)
    expect(knowledgeRoutes[1].component).not.toBe(KnowledgeDeferred)
    expect(knowledgeRoutes[2].component).toBe(ParserTest)
    expect(knowledgeRoutes[2].component).not.toBe(KnowledgeDeferred)

    // K7 机制钉子:剩下 4 个子路由仍必须指向占位页(承 P4 I2)。
    const migrated = ['', 'queue', 'indexed-files', 'settings', 'notes']
    const stillDeferred = knowledgeRoutes[0]
      .children!.filter((c) => !migrated.includes(c.path))
      .map((c) => c.component)
    expect(
      knowledgeRoutes[0].children!.filter((c) => !migrated.includes(c.path)).map((c) => c.path),
    ).toEqual(['search', 'wiki', 'roots', 'allowlist'])
    expect(stillDeferred).toHaveLength(4)
    for (const c of stillDeferred) expect(c).toBe(KnowledgeDeferred)
  })
})
