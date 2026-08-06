## Task 2: Service 仓 —— `wiki` 域

**Files:**
- Create: `.sp8/NimoOS-Service/src/wiki.ts`
- Create: `.sp8/NimoOS-Service/src/wiki.test.ts`
- Modify: `.sp8/NimoOS-Service/src/index.ts`

**Interfaces:**
- Consumes: 无(与 T1 独立)
- Produces:
  ```ts
  export function createWiki(http: AxiosInstance): {
    getRoots(): Promise<WikiRoot[]>
    getCandidates(): Promise<WikiCandidate[]>
    getTree(rootId?: string): Promise<WikiTreeNode[]>
    getNode(path: string): Promise<WikiNode>
    getRaw(path: string): Promise<string>
    createRoot(body: Record<string, unknown>): Promise<unknown>
    deleteRoot(id: string | number, purge?: boolean): Promise<unknown>
    rescanRoot(id: string | number): Promise<unknown>
    patchRootEnabled(id: string | number, enabled: boolean): Promise<unknown>
  }
  export function normalizeRoot(r: Record<string, unknown>): WikiRoot
  export function normalizeTreeNode(n: Record<string, unknown>): WikiTreeNode
  export function normalizeNode(n: Record<string, unknown>): WikiNode
  export function createRootBody(a: {path: string; watchMode?: string; scanIntervalH?: number; mirror?: boolean}): Record<string, unknown>
  ```

- [ ] **Step 1: 读蓝本**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git show main:src/service/wiki.js                                    # 99 行,全文
git show main:src/views/AI/Knowledge/__tests__/wikiRoots.spec.js      # 原测试
```

- [ ] **Step 2: 写失败测试**

`src/wiki.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createWiki, normalizeRoot, normalizeTreeNode, normalizeNode, createRootBody } from './wiki'

type Call = { verb: string; url: string; body?: unknown; cfg?: Record<string, unknown> }
function recorder(dataFor?: (verb: string, url: string) => unknown) {
  const calls: Call[] = []
  const push = (verb: string, url: string, body: unknown, cfg: unknown) => {
    calls.push({ verb, url, body, cfg: cfg as Record<string, unknown> | undefined })
    return { data: dataFor ? dataFor(verb, url) : null }
  }
  const http = {
    get: async (u: string, c?: unknown) => push('get', u, undefined, c),
    post: async (u: string, b?: unknown, c?: unknown) => push('post', u, b, c),
    delete: async (u: string, c?: unknown) => push('delete', u, undefined, c),
    patch: async (u: string, b?: unknown, c?: unknown) => push('patch', u, b, c),
  } as unknown as AxiosInstance
  return { http, calls }
}

describe('createWiki — URL/动词表', () => {
  it('每个方法各调一次', async () => {
    const { http, calls } = recorder((_v, url) => (url === '/wiki/node' ? { path: '/x' } : []))
    const wiki = createWiki(http)
    await wiki.getRoots()
    await wiki.getCandidates()
    await wiki.getTree()
    await wiki.getTree('r1')
    await wiki.getNode('/DATA')
    await wiki.createRoot({ Path: '/DATA' })
    await wiki.deleteRoot('r1')
    await wiki.deleteRoot('r1', true)
    await wiki.rescanRoot('r1')
    await wiki.patchRootEnabled('r1', false)
    expect(calls.map((c) => `${c.verb} ${c.url}`)).toEqual([
      'get /wiki/roots', 'get /wiki/candidates', 'get /wiki/tree', 'get /wiki/tree',
      'get /wiki/node', 'post /wiki/roots',
      'delete /wiki/roots/r1', 'delete /wiki/roots/r1?purge_files=true',
      'post /wiki/roots/r1/rescan', 'patch /wiki/roots/r1',
    ])
    expect(calls[2].cfg).toBe(undefined)                       // 无 rootId → 不传 params
    expect(calls[3].cfg).toEqual({ params: { root_id: 'r1' } }) // 有 rootId → 传
    expect(calls[9].body).toEqual({ enabled: false })
  })

  it('getRoots 对 null 响应兜底成空数组(Go nil slice 序列化成 null)', async () => {
    const { http } = recorder(() => null)
    expect(await createWiki(http).getRoots()).toEqual([])
    expect(await createWiki(http).getCandidates()).toEqual([])
    expect(await createWiki(http).getTree()).toEqual([])
  })

  it('getRaw 把非字符串 body 强制成字符串,null/undefined 成空串', async () => {
    const mk = (v: unknown) => createWiki(recorder(() => v).http)
    expect(await mk('# hi').getRaw('/a')).toBe('# hi')
    expect(await mk(null).getRaw('/a')).toBe('')
    expect(await mk(undefined).getRaw('/a')).toBe('')
    expect(await mk(42).getRaw('/a')).toBe('42')
  })

  it('getRaw / getNode 用 path 作 query 参数', async () => {
    const { http, calls } = recorder(() => 'x')
    await createWiki(http).getRaw('/DATA/a b')
    expect(calls[0].cfg).toEqual({ params: { path: '/DATA/a b' } })
  })
})

describe('wiki 纯函数(移植 Vue2 wikiRoots.spec.js)', () => {
  it('normalizeRoot 把 Go PascalCase 映射成 camelCase', () => {
    expect(normalizeRoot({ ID: 'r1', Path: '/DATA', Level: 'space', WatchMode: 'auto',
      StorageMode: 'inline', Enabled: true, ScanIntervalS: 21600, CreatedAt: 1,
      LastScanAt: 0, NeedsReconcile: true }))
      .toEqual({ id: 'r1', path: '/DATA', level: 'space', watchMode: 'auto',
        storageMode: 'inline', enabled: true, scanIntervalS: 21600, createdAt: 1,
        lastScanAt: 0, needsReconcile: true })
  })

  it('normalizeRoot 缺省时 needsReconcile / enabled 为 false、数值为 0', () => {
    const r = normalizeRoot({ ID: 'r2', Path: '/x' })
    expect(r.needsReconcile).toBe(false)
    expect(r.enabled).toBe(false)
    expect(r.scanIntervalS).toBe(0)
    expect(r.lastScanAt).toBe(0)
  })

  it('normalizeTreeNode 映射 /wiki/tree 的 snake_case 行', () => {
    expect(normalizeTreeNode({ path: '/DATA/Wiki', level: 'dir', ai_label: 'Work notes',
      user_notes_updated_at: '', last_modified: '2026-07-20T10:00:00+08:00' }))
      .toEqual({ path: '/DATA/Wiki', level: 'dir', aiLabel: 'Work notes',
        userNotesUpdatedAt: '', lastModified: '2026-07-20T10:00:00+08:00' })
  })

  it('normalizeNode 映射 child_map / recent_changes 并容忍 null', () => {
    const n = normalizeNode({ path: '/DATA', level: 'root', ai_label: '', summary: null,
      child_map: [{ name: 'Docs', last_modified: 't1', is_opaque: 1 }],
      recent_changes: [{ path: '/DATA/a.md', op: 'create', at: 't2' }],
      user_notes: '', subwikis: null, etag: 'abc' })
    expect(n.childMap).toEqual([{ name: 'Docs', fileCount: 0, lastModified: 't1', isOpaque: true }])
    expect(n.recentChanges).toEqual([{ path: '/DATA/a.md', op: 'create', at: 't2' }])
    expect(n.subwikis).toEqual([])
    expect(n.summary).toBe(null)
    expect(n.etag).toBe('abc')
  })

  it('normalizeNode 顶得住最小载荷', () => {
    const n = normalizeNode({ path: '/x' })
    expect(n.childMap).toEqual([])
    expect(n.recentChanges).toEqual([])
    expect(n.userNotes).toBe('')
    expect(n.parentWiki).toBe('')
  })

  it('createRootBody 用 Go 字段名(无下划线)与固定默认值', () => {
    expect(createRootBody({ path: '/DATA' })).toEqual({ Path: '/DATA', Level: 'space',
      WatchMode: 'auto', StorageMode: 'inline', ScanIntervalS: 21600 })
  })

  it('createRootBody 支持 mirror 重试与自定义间隔,且间隔至少 1 小时', () => {
    const b = createRootBody({ path: '/mnt/ro', watchMode: 'scan_only', scanIntervalH: 2, mirror: true })
    expect(b.StorageMode).toBe('mirror')
    expect(b.WatchMode).toBe('scan_only')
    expect(b.ScanIntervalS).toBe(7200)
    expect(createRootBody({ path: '/x', scanIntervalH: 0 }).ScanIntervalS).toBe(3600)
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-Service && pnpm test src/wiki.test.ts
```
预期:FAIL,`Failed to resolve import "./wiki"`。

- [ ] **Step 4: 实现 `src/wiki.ts`**

逐行移植蓝本,**把它那两段注释一起搬**(「WikiRoot/CreateArgs 无 json tag → PascalCase 响应 + Go 字段名 body,下划线会被静默丢弃」「tree|node|raw 用 snake_case」)。文件头再加:
```ts
/**
 * wiki 域 —— NimoOS-Wiki 服务,Gateway 直达 `/v1/wiki/*`(不经 NimoOS-AI)。
 * 1:1 移植自 Vue2 `src/service/wiki.js`(99 行)。
 * ⚠️ 设备现状(2026-07-31):`file_events` 1.42 亿行 + `pkg/db/db.go:29`
 * SetMaxOpenConns(1) → `/roots`、`/tree`、`/node` 实测超时(60 s axios timeout);
 * `/candidates`、`/raw` 200。见设计 §6.3。本域实现与单测不受影响。
 */
```
`getTree(rootId?)` 的 params:蓝本写 `api.get(url, rootId ? {root_id: rootId} : undefined)` → 本包写 `http.get(url, rootId ? { params: { root_id: rootId } } : undefined)`。

- [ ] **Step 5: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-Service && pnpm test > /tmp/p5a-t2-svc-test.log 2>&1; echo "exit=$?"
```

- [ ] **Step 6: 接线 + build + 消费仓校验**

`src/index.ts`:加 `import { createWiki } from './wiki.js'`、`get wiki()` getter、`export { createRootBody } from './wiki.js'`。然后:
```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-Service && pnpm build 2>&1 | tail -20
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI && pnpm install 2>&1 | tail -5
pnpm exec vue-tsc --noEmit > /tmp/p5a-t2-tsc.log 2>&1; echo "exit=$?"
```

- [ ] **Step 7: 提交**

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-Service
git add src/wiki.ts src/wiki.test.ts src/index.ts
git commit -m "feat(wiki): SP8-P5a wiki 域进包(PascalCase 双向归一化)"
```

---

