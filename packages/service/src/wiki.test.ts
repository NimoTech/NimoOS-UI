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

describe('判别力补充断言(评审教训:getRoots/getCandidates/getTree 三者都是「取数组→兜底[]→map normalizer」形状,互换 normalizer 用 brief 原有断言测不出)', () => {
  it('getRoots 对非空真实响应用 normalizeRoot 归一化(与 normalizeTreeNode 输出形状不同,用错 normalizer 必报红)', async () => {
    const { http } = recorder(() => [{ ID: 'r1', Path: '/DATA', Level: 'space', WatchMode: 'auto',
      StorageMode: 'inline', Enabled: true, ScanIntervalS: 21600, CreatedAt: 1,
      LastScanAt: 0, NeedsReconcile: true }])
    const out = await createWiki(http).getRoots()
    expect(out).toEqual([{ id: 'r1', path: '/DATA', level: 'space', watchMode: 'auto',
      storageMode: 'inline', enabled: true, scanIntervalS: 21600, createdAt: 1,
      lastScanAt: 0, needsReconcile: true }])
  })

  it('getTree 对非空真实响应用 normalizeTreeNode 归一化(snake_case → camelCase,与 normalizeRoot 输出形状不同)', async () => {
    const { http } = recorder(() => [{ path: '/DATA/Wiki', level: 'dir', ai_label: 'Work notes',
      user_notes_updated_at: '', last_modified: '2026-07-20T10:00:00+08:00' }])
    const out = await createWiki(http).getTree()
    expect(out).toEqual([{ path: '/DATA/Wiki', level: 'dir', aiLabel: 'Work notes',
      userNotesUpdatedAt: '', lastModified: '2026-07-20T10:00:00+08:00' }])
  })
})
