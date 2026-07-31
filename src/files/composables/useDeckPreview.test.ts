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
/** 超过 MAX_TILES(36)的目录,用来验证截断与 total */
const BIG = Array.from({ length: 40 }, (_, i) => ({
  name: `f${String(i).padStart(2, '0')}.jpg`, path: `/x/f${i}.jpg`, is_dir: false,
}))

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
  it('条目数不到上限时全给,total 是真实条目数', async () => {
    const { api } = setup(['snap1']); await flush()
    expect(api.previews.value.snap1.entries).toHaveLength(8)
    expect(api.previews.value.snap1.total).toBe(8)
    expect(api.previews.value.snap1.status).toBe('ready')
  })
  it('超过 36 条只给 36 条,total 仍是真实条目数(卡片靠 total-entries 算 +N)', async () => {
    getListMock.mockResolvedValue({ content: BIG })
    const { api } = setup(['snap1']); await flush()
    expect(api.previews.value.snap1.entries).toHaveLength(36)
    expect(api.previews.value.snap1.total).toBe(40)
  })
  it('原样交出后端条目(卡片直接喂给文件区的 FileThumb,不再自己判图片)', async () => {
    const { api } = setup(['snap1']); await flush()
    const entries = api.previews.value.snap1.entries
    expect(entries.find((e) => e.name === 'notes.txt')).toMatchObject({ path: '/x/notes.txt', is_dir: false })
    expect(entries.find((e) => e.name === 'sub')?.is_dir).toBe(true)
  })
  it('按文件区默认规则排序:文件夹在前,再按名字升序(与进入快照后看到的顺序一致)', async () => {
    getListMock.mockResolvedValue({
      content: [
        { name: 'zeta.txt', path: '/x/zeta.txt', is_dir: false },
        { name: 'Alpha.txt', path: '/x/Alpha.txt', is_dir: false },
        { name: 'zdir', path: '/x/zdir', is_dir: true },
        { name: 'adir', path: '/x/adir', is_dir: true },
      ],
    })
    const { api } = setup(['snap1']); await flush()
    expect(api.previews.value.snap1.entries.map((e) => e.name)).toEqual(['adir', 'zdir', 'Alpha.txt', 'zeta.txt'])
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
  it('空目录 → ready + 0 条目 + total 0', async () => {
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
    expect(api.previews.value.snap1.entries.map((t) => t.name)).toEqual(['b.jpg'])

    // A(旧目录)才姗姗来迟地落地 —— 不能覆盖 B 已经写好的内容
    resolveA({ content: [{ name: 'a.jpg', path: '/x/a.jpg', is_dir: false }] })
    await flush()
    expect(api.previews.value.snap1.entries.map((t) => t.name)).toEqual(['b.jpg'])
  })
})
