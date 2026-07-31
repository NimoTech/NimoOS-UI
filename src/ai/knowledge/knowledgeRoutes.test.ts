import { describe, it, expect } from 'vitest'
import { knowledgeRoutes } from './knowledgeRoutes'
import KnowledgeDeferred from './views/KnowledgeDeferred.vue'

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

  // 主动加(brief 未给):T12 会把 '' 子路由的 component 反转成 DashboardView——
  // 现在钉住「本期 9 个子路由 + 2 条 parser 路由的 component 全部指向 KnowledgeDeferred」,
  // 这样 T12 落地时这条断言会精确报红,提醒改的人同步更新它,而不是被无声继承。
  it('本期(P5a)全部 11 条路由的 component 都还是占位页 KnowledgeDeferred', () => {
    const components = [
      ...knowledgeRoutes[0].children!.map((c) => c.component),
      knowledgeRoutes[1].component,
      knowledgeRoutes[2].component,
    ]
    expect(components).toHaveLength(11)
    for (const c of components) expect(c).toBe(KnowledgeDeferred)
  })
})
