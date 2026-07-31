import { describe, it, expect } from 'vitest'
import { knowledgeRoutes } from './knowledgeRoutes'
import KnowledgeDeferred from './views/KnowledgeDeferred.vue'
import KnowledgeLayout from './views/KnowledgeLayout.vue'

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
})
