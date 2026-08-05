## Task 5: 路由 + 占位页 + 占位机制

**Files:**
- Create: `src/ai/knowledge/deferred.ts`
- Create: `src/ai/knowledge/views/KnowledgeDeferred.vue`
- Create: `src/ai/knowledge/knowledgeRoutes.ts`
- Create: `src/ai/knowledge/knowledgeRoutes.test.ts`
- Create: `src/ai/knowledge/deferred.test.ts`
- Modify: `src/router/index.ts`

**Interfaces:**
- Produces:
  ```ts
  // deferred.ts
  export type KnowledgeTabId = 'dashboard' | 'search' | 'wiki' | 'notes' | 'indexed-files'
    | 'queue' | 'roots' | 'allowlist' | 'settings'
  export const DEFERRED_TABS: readonly KnowledgeTabId[]   // P5a = 除 dashboard 外的 8 个
  export function isDeferred(id: KnowledgeTabId): boolean
  // knowledgeRoutes.ts
  export const knowledgeRoutes: RouteRecordRaw[]          // 11 条
  ```
- Consumes: T12 的 `DashboardView.vue` **本任务还不存在** → 路由表里 `''` 子路由本任务先指向 `KnowledgeDeferred.vue`,T12 改成真组件(T12 的 Step 里含这一行改动)。

- [ ] **Step 1: 读蓝本路由**

```bash
git -C /home/nimo/NimoTech/NimoOS-UI show main:src/router/route.js | sed -n '155,200p'
```
9 条 Knowledge 子路由(`''`/`search`/`wiki`/`indexed-files`/`queue`/`roots`/`allowlist`/`notes`/`settings`,**注意 Vue2 数组里 `wiki` 在 `search` 之后、`notes` 在 `allowlist` 之后**)+ `/ai/parser`、`/ai/parser/test`。`name` 逐字照抄(`KnowledgeDashboard`/`KnowledgeSearch`/`KnowledgeWiki`/`KnowledgeIndexedFiles`/`KnowledgeQueue`/`KnowledgeRoots`/`KnowledgeAllowlist`/`KnowledgeNotes`/`KnowledgeSettings`/`AIParser`/`AIParserTest`)。

- [ ] **Step 2: 写失败测试**

`deferred.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { DEFERRED_TABS, isDeferred } from './deferred'

describe('占位机制(K7)', () => {
  it('P5a 只实现 dashboard,其余 8 个 tab 挂占位', () => {
    expect([...DEFERRED_TABS].sort()).toEqual(
      ['allowlist', 'indexed-files', 'notes', 'queue', 'roots', 'search', 'settings', 'wiki'])
    expect(isDeferred('dashboard')).toBe(false)
  })

  it('isDeferred 对每个已列 tab 返回 true', () => {
    for (const id of DEFERRED_TABS) expect(isDeferred(id)).toBe(true)
  })

  // 机制钉子(承 P4 I2:「留了代码没留能力」)——将来 DEFERRED_TABS 清空后,
  // 这条用例仍必须证明 isDeferred 真的在读那个常量,而不是恒返回 false。
  it('isDeferred 的判定来源是 DEFERRED_TABS 本身', () => {
    const notListed = 'dashboard' as const
    expect(DEFERRED_TABS.includes(notListed)).toBe(false)
    expect(isDeferred(notListed)).toBe(false)
    const listed = DEFERRED_TABS[0]
    expect(isDeferred(listed)).toBe(true)
  })
})
```

`knowledgeRoutes.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { knowledgeRoutes } from './knowledgeRoutes'

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
})
```

在既有 `src/router/index.test.ts`(**已确认存在**,和 `guard.test.ts`/`onAuthFail.test.ts` 同目录)里加:
```ts
it('主路由表已展开 knowledge 路由', async () => {
  const { router } = await import('./index')
  const paths = router.getRoutes().map((r) => r.path)
  expect(paths).toContain('/ai/knowledge')
  expect(paths).toContain('/ai/knowledge/notes')
  expect(paths).toContain('/ai/parser/test')
})
```

- [ ] **Step 3: 跑测试确认失败**

```bash
pnpm test src/ai/knowledge/deferred.test.ts src/ai/knowledge/knowledgeRoutes.test.ts
```

- [ ] **Step 4: 实现**

`deferred.ts`:
```ts
// SP8-P5a 占位机制(偏离 K7)—— 承 P2a 的 DEFERRED_SECTIONS 先例:rail 保持
// Vue2 的 9 项 1:1,未迁页面落占位页,分批替换。P5f 会把 DEFERRED_TABS 清空,
// **但机制本身保留**(承 P4 I2 的教训:清空后要仍有用例证明它有能力,而不是
// 只剩一段没人测的代码)。
export type KnowledgeTabId = …
export const DEFERRED_TABS = ['search', 'wiki', 'notes', 'indexed-files', 'queue',
  'roots', 'allowlist', 'settings'] as const satisfies readonly KnowledgeTabId[]
export function isDeferred(id: KnowledgeTabId): boolean {
  return (DEFERRED_TABS as readonly string[]).includes(id)
}
```

`KnowledgeDeferred.vue`:占位页,**零 `<style>` 块**,复用 `knowledge.scss` 已有的 `.k-scroll`/`.k-empty*` 类(用前 grep 确认类名真实存在)。文案走 i18n:`aiKbDeferredTitle` / `aiKbDeferredHint`(§附录 A)。

`knowledgeRoutes.ts`:11 条,`component` 直接 import(照本仓既有 `router/index.ts` 的非懒加载风格)。`''` 与 8 个占位子路由本任务全部指 `KnowledgeDeferred`;`/ai/parser`、`/ai/parser/test` 也指它(它们归 P5c)。

`src/router/index.ts`:加一行 `import { knowledgeRoutes } from '../ai/knowledge/knowledgeRoutes'`,在 `/ai/settings` 之后加一行 `...knowledgeRoutes,`。**只加这两行**(减小与 sp7/sp9 的合并足迹)。

- [ ] **Step 5: 跑测试 + 三门**

预期全量 **305 文件**(+`KnowledgeDeferred.vue` 的 color-guard 1 例)。

- [ ] **Step 6: 提交**

```bash
git add src/ai/knowledge/deferred.ts src/ai/knowledge/deferred.test.ts \
        src/ai/knowledge/views/KnowledgeDeferred.vue \
        src/ai/knowledge/knowledgeRoutes.ts src/ai/knowledge/knowledgeRoutes.test.ts \
        src/router/index.ts
git commit -m "feat(knowledge): SP8-P5a 11 条路由 + 占位页机制"
```

---

