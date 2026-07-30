import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useDeckPreview } from './useDeckPreview'

const getListMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { folder: { getList: (p: string) => getListMock(p) }, image: { thumbUrl: (p: string) => `/v1/image?path=${p}` } },
}))

const CONTENT = [
  { name: 'a.jpg', path: '/x/a.jpg', is_dir: false },
  { name: 'b.png', path: '/x/b.png', is_dir: false },
  { name: 'notes.txt', path: '/x/notes.txt', is_dir: false },
  { name: 'sub', path: '/x/sub', is_dir: true },
  { name: 'c.jpg', path: '/x/c.jpg', is_dir: false },
  { name: 'd.jpg', path: '/x/d.jpg', is_dir: false },
  { name: 'e.jpg', path: '/x/e.jpg', is_dir: false },
  { name: 'f.jpg', path: '/x/f.jpg', is_dir: false },
]

const setup = (names: string[], relPath = 'Photos') => {
  const visible = ref(names)
  const api = useDeckPreview({ mountPoint: () => '/DATA', relPath: () => relPath, visibleNames: () => visible.value })
  return { api, visible }
}
const flush = async () => { await new Promise((r) => setTimeout(r)); await nextTick() }

beforeEach(() => { vi.clearAllMocks(); getListMock.mockResolvedValue({ content: CONTENT }) })

describe('useDeckPreview', () => {
  it('按 <快照根>/<相对路径> 拉目录', async () => {
    setup(['snap1']); await flush()
    expect(getListMock).toHaveBeenCalledWith('/DATA/.snapshots/snap1/Photos')
  })
  it('相对路径为空时拉快照根', async () => {
    setup(['snap1'], ''); await flush()
    expect(getListMock).toHaveBeenCalledWith('/DATA/.snapshots/snap1')
  })
  it('最多取 6 个瓦片,total 是真实条目数', async () => {
    const { api } = setup(['snap1']); await flush()
    expect(api.previews.value.snap1.tiles).toHaveLength(6)
    expect(api.previews.value.snap1.total).toBe(8)
    expect(api.previews.value.snap1.status).toBe('ready')
  })
  it('标出图片瓦片(缩略图)与非图片瓦片(类型图标)', async () => {
    const { api } = setup(['snap1']); await flush()
    const tiles = api.previews.value.snap1.tiles
    expect(tiles[0]).toMatchObject({ name: 'a.jpg', isImage: true })
    expect(tiles.find((t) => t.name === 'notes.txt')?.isImage).toBe(false)
    expect(tiles.find((t) => t.name === 'sub')?.isDir).toBe(true)
  })
  it('同一个快照名只拉一次(来回拨刻度不重复请求)', async () => {
    const { visible } = setup(['snap1']); await flush()
    visible.value = ['snap2']; await flush()
    visible.value = ['snap1']; await flush()
    expect(getListMock).toHaveBeenCalledTimes(2)
  })
  it('目录在该快照里不存在 → missing', async () => {
    getListMock.mockRejectedValue(Object.assign(new Error('no'), { code: 404 }))
    const { api } = setup(['snap1']); await flush()
    expect(api.previews.value.snap1.status).toBe('missing')
  })
  it('其它失败 → failed(静默降级,不抛错)', async () => {
    getListMock.mockRejectedValue(new Error('boom'))
    const { api } = setup(['snap1']); await flush()
    expect(api.previews.value.snap1.status).toBe('failed')
  })
  it('空目录 → ready + 0 瓦片 + total 0', async () => {
    getListMock.mockResolvedValue({ content: [] })
    const { api } = setup(['snap1']); await flush()
    expect(api.previews.value.snap1).toMatchObject({ status: 'ready', total: 0 })
  })
  it('可见集合变化时给新出现的快照补拉', async () => {
    const { visible } = setup(['snap1']); await flush()
    visible.value = ['snap1', 'snap2', 'snap3']; await flush()
    expect(getListMock).toHaveBeenCalledTimes(3)
  })
  it('相对路径变了要清缓存重拉(不同目录不能复用)', async () => {
    const relPath = ref('Photos')
    const visible = ref(['snap1'])
    useDeckPreview({ mountPoint: () => '/DATA', relPath: () => relPath.value, visibleNames: () => visible.value })
    await flush()
    relPath.value = 'Docs'; await flush()
    expect(getListMock).toHaveBeenLastCalledWith('/DATA/.snapshots/snap1/Docs')
    expect(getListMock).toHaveBeenCalledTimes(2)
  })
  it('换目录后,旧目录的慢响应姗姗来迟也不能盖掉新目录已经落地的内容(交错响应)', async () => {
    let resolveA: (v: unknown) => void = () => {}
    let resolveB: (v: unknown) => void = () => {}
    getListMock.mockImplementation((p: string) => {
      if (p.endsWith('/A')) return new Promise((res) => { resolveA = res })
      if (p.endsWith('/B')) return new Promise((res) => { resolveB = res })
      return Promise.resolve({ content: [] })
    })
    const relPath = ref('A')
    const visible = ref(['snap1'])
    const api = useDeckPreview({ mountPoint: () => '/DATA', relPath: () => relPath.value, visibleNames: () => visible.value })
    await flush() // A 的请求已发出、仍在途

    relPath.value = 'B'
    await flush() // 换目录:previews 被清空,B 的请求也已发出、仍在途

    // B(新目录)先落地
    resolveB({ content: [{ name: 'b.jpg', path: '/y/b.jpg', is_dir: false }] })
    await flush()
    expect(api.previews.value.snap1.tiles.map((t) => t.name)).toEqual(['b.jpg'])

    // A(旧目录)才姗姗来迟地落地 —— 不能覆盖 B 已经写好的内容
    resolveA({ content: [{ name: 'a.jpg', path: '/x/a.jpg', is_dir: false }] })
    await flush()
    expect(api.previews.value.snap1.tiles.map((t) => t.name)).toEqual(['b.jpg'])
  })
})
