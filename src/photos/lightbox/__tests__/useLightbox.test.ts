import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      recordView: vi.fn(() => Promise.resolve()),
      getAsset: vi.fn(() => Promise.resolve({ id: 'x' })),
      getAssetOcr: vi.fn(() => Promise.resolve({ lines: [] })),
      listFavoriteIds: vi.fn(() => Promise.resolve([])),
      favorite: vi.fn(() => Promise.resolve()),
      unfavorite: vi.fn(() => Promise.resolve()),
    },
  },
}))
import { service } from '@nimotech/nimoos-service'
import { useLightbox } from '../useLightbox'
const P = (id: string, extra: Record<string, unknown> = {}) => ({ id, isVideo: false, ...extra }) as any

describe('useLightbox 开合/翻页', () => {
  let back: any, push: any
  beforeEach(() => {
    useLightbox().__resetForTest()
    back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    push = vi.spyOn(window.history, 'pushState')
  })
  afterEach(() => vi.restoreAllMocks())

  it('openAt 打开、定位当前项、pushState 一次、recordView', () => {
    const lb = useLightbox()
    lb.openAt(P('b'), [P('a'), P('b'), P('c')])
    expect(lb.open.value).toBe(true)
    expect(lb.index.value).toBe(1)
    expect(lb.current.value?.id).toBe('b')
    expect(push).toHaveBeenCalledTimes(1)
    expect(service.photos.recordView).toHaveBeenCalledWith('b')
  })
  it('list 为空退化为单项', () => {
    const lb = useLightbox(); lb.openAt(P('x'), [])
    expect(lb.list.value.map((p) => p.id)).toEqual(['x'])
  })
  it('prev/next 边界钳制,不再 pushState', () => {
    const lb = useLightbox(); lb.openAt(P('a'), [P('a'), P('b')])
    push.mockClear()
    lb.prev(); expect(lb.index.value).toBe(0) // 已在头,不动
    lb.next(); expect(lb.index.value).toBe(1)
    lb.next(); expect(lb.index.value).toBe(1) // 已在尾
    expect(push).not.toHaveBeenCalled()
  })
  it('close 复位并 history.back 一次', () => {
    const lb = useLightbox(); lb.openAt(P('a'), [P('a')])
    lb.close()
    expect(lb.open.value).toBe(false)
    expect(back).toHaveBeenCalledTimes(1)
  })
  it('popstate(返回键)只关灯箱,不调 history.back', () => {
    const lb = useLightbox(); lb.openAt(P('a'), [P('a')])
    back.mockClear()
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(lb.open.value).toBe(false)
    expect(back).not.toHaveBeenCalled()
  })
  it('视频 startMs 仅在 isVideo && >0 时保留', () => {
    const lb = useLightbox()
    lb.openAt(P('v', { isVideo: true }), [], 4200); expect(lb.startMs.value).toBe(4200)
    lb.__resetForTest(); lb.openAt(P('p'), [], 4200); expect(lb.startMs.value).toBe(0)
  })
  it('query trim 存入 searchQuery', () => {
    const lb = useLightbox(); lb.openAt(P('a'), [], 0, '  hello  ')
    expect(lb.searchQuery.value).toBe('hello')
  })

  describe('goTo 跳转', () => {
    it('范围内跳转成功:goTo(2) 三项列表 → index=2,current 是第三项', () => {
      const lb = useLightbox()
      lb.openAt(P('a'), [P('a'), P('b'), P('c')])
      push.mockClear()
      lb.goTo(2)
      expect(lb.index.value).toBe(2)
      expect(lb.current.value?.id).toBe('c')
      expect(push).not.toHaveBeenCalled()
    })
    it('越界下 goTo(-1) → index 不变', () => {
      const lb = useLightbox()
      lb.openAt(P('a'), [P('a'), P('b')])
      push.mockClear()
      lb.goTo(-1)
      expect(lb.index.value).toBe(0)
      expect(push).not.toHaveBeenCalled()
    })
    it('越界上 goTo(99) → index 不变', () => {
      const lb = useLightbox()
      lb.openAt(P('a'), [P('a'), P('b'), P('c')])
      push.mockClear()
      lb.goTo(99)
      expect(lb.index.value).toBe(0) // 仍在 openAt 后的位置
      expect(push).not.toHaveBeenCalled()
    })
  })
})

describe('useLightbox 水合+收藏', () => {
  beforeEach(() => {
    useLightbox().__resetForTest()
    vi.spyOn(window.history, 'back').mockImplementation(() => {})
    vi.spyOn(window.history, 'pushState').mockImplementation(() => {})
    vi.mocked(service.photos.getAsset).mockReset().mockResolvedValue({ id: 'x' } as any)
    vi.mocked(service.photos.getAssetOcr).mockReset().mockResolvedValue({ lines: [] } as any)
    vi.mocked(service.photos.listFavoriteIds).mockReset().mockResolvedValue([])
    vi.mocked(service.photos.favorite).mockReset().mockResolvedValue(undefined as any)
    vi.mocked(service.photos.unfavorite).mockReset().mockResolvedValue(undefined as any)
  })
  afterEach(() => vi.restoreAllMocks())

  it('openAt 后 detail 先等于当前项、getAsset 到达后合并', async () => {
    vi.mocked(service.photos.getAsset).mockResolvedValue({ id: 'b', make: 'Nikon' } as any)
    const lb = useLightbox()
    lb.openAt(P('b'), [P('a'), P('b'), P('c')])
    // synchronously (before await resolves) detail already mirrors current
    expect(lb.detail.value?.id).toBe('b')
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(lb.detail.value?.camera).toBe('Nikon')
  })

  it('翻页时过期 getAsset 结果被 seq 守卫丢弃(先解析旧的、当前已是新项 → detail 不被旧值覆盖)', async () => {
    let resolveFirst: (v: any) => void = () => {}
    let resolveSecond: (v: any) => void = () => {}
    const firstPromise = new Promise((res) => { resolveFirst = res })
    const secondPromise = new Promise((res) => { resolveSecond = res })
    vi.mocked(service.photos.getAsset)
      .mockImplementationOnce(() => firstPromise as any)
      .mockImplementationOnce(() => secondPromise as any)

    const lb = useLightbox()
    lb.openAt(P('a'), [P('a'), P('b'), P('c')]) // issues first (slow) getAsset for 'a'
    lb.next() // issues second (fast) getAsset for 'b'

    // resolve the newer (second) call first, then the older (first) call after
    resolveSecond({ id: 'b', make: 'Sony' })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(lb.detail.value?.id).toBe('b')

    resolveFirst({ id: 'a', make: 'Nikon' }) // stale — must be dropped by seq guard
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(lb.detail.value?.id).toBe('b')
    expect(lb.detail.value?.camera).toBe('Sony')
  })

  it('searchQuery 为空不发 getAssetOcr;非空且非视频才发', async () => {
    const lb = useLightbox()
    lb.openAt(P('a'), [P('a')])
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(service.photos.getAssetOcr).not.toHaveBeenCalled()
    expect(lb.ocrLines.value).toEqual([])

    vi.mocked(service.photos.getAssetOcr).mockResolvedValue({ lines: [{ box: [1, 2, 3, 4] }] } as any)
    lb.__resetForTest()
    lb.openAt(P('a'), [P('a')], 0, 'hello')
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(service.photos.getAssetOcr).toHaveBeenCalledWith('a', 'hello')
    expect(lb.ocrLines.value).toEqual([{ box: [1, 2, 3, 4] }])

    vi.mocked(service.photos.getAssetOcr).mockClear()
    lb.__resetForTest()
    lb.openAt(P('v', { isVideo: true }), [P('v', { isVideo: true })], 0, 'hello')
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(service.photos.getAssetOcr).not.toHaveBeenCalled()
  })

  it('reconcileFav 播种 favIds、isFav 反映当前项', async () => {
    vi.mocked(service.photos.listFavoriteIds).mockResolvedValue(['a', 42])
    const lb = useLightbox()
    lb.openAt(P('a'), [P('a'), P(String(42))])
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(lb.isFav.value).toBe(true)
    lb.goTo(1)
    expect(lb.isFav.value).toBe(true)
  })

  it('toggleFav 乐观翻转并调 favorite/unfavorite;失败回滚', async () => {
    vi.mocked(service.photos.listFavoriteIds).mockResolvedValue(['a'])
    const lb = useLightbox()
    lb.openAt(P('a'), [P('a')])
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(lb.isFav.value).toBe(true)

    vi.mocked(service.photos.unfavorite).mockRejectedValueOnce(new Error('boom'))
    await lb.toggleFav()
    expect(lb.isFav.value).toBe(true) // rolled back after rejection

    vi.mocked(service.photos.unfavorite).mockResolvedValue(undefined as any)
    await lb.toggleFav()
    expect(service.photos.unfavorite).toHaveBeenCalledWith('a')
    expect(lb.isFav.value).toBe(false)

    vi.mocked(service.photos.favorite).mockResolvedValue(undefined as any)
    await lb.toggleFav()
    expect(service.photos.favorite).toHaveBeenCalledWith('a')
    expect(lb.isFav.value).toBe(true)
  })

  it('seq 守卫同 id 重访竞态覆盖(隔离 seq 机制):openAt a → next b → prev a(同 id!)→ 解析新的 a 再旧的 a,detail 反映新的', async () => {
    // 目标: 用同一个 id 的两个 getAsset 调用来隔离 seq 守卫。
    // 场景: openAt(a) [call 0, pending] → next() [call 1, pending] → prev() [call 2, pending, same id 'a']
    // 然后先解析 call 2(新的) → detail 应为 'NEW',再解析 call 0(旧的) → detail 仍应为 'NEW'
    // (不能用 id 检查来区别,因为两个都是 id='a',必须靠 seq 机制丢弃 call 0)

    const deferreds: Array<{ resolve: (v: any) => void; reject: (e: any) => void }> = []
    let callCount = 0
    vi.mocked(service.photos.getAsset).mockImplementation(() => {
      const idx = callCount++
      let resolve: (v: any) => void = () => {}
      let reject: (e: any) => void = () => {}
      const promise = new Promise((res, rej) => {
        resolve = res
        reject = rej
      })
      deferreds[idx] = { resolve, reject }
      return promise as any
    })

    const lb = useLightbox()
    // call 0: openAt 触发 hydrateDetail,开始 getAsset('a'),保持 pending
    lb.openAt(P('a'), [P('a'), P('b'), P('c')])
    // call 1: next 触发 hydrateDetail,开始 getAsset('b')
    lb.next()
    // call 2: prev 触发 hydrateDetail,开始 getAsset('a') —— 同一个 id 的第二次调用!
    lb.prev()

    expect(lb.current.value?.id).toBe('a')

    // 先解析 call 2(最新) 的结果,带 status='NEW'(status 字段在 assetToPhoto 中被保留)
    deferreds[2].resolve({ id: 'a', status: 'NEW' } as any)
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(lb.detail.value?.id).toBe('a')
    expect(lb.detail.value?.status).toBe('NEW')

    // 再解析 call 0(最旧) 的结果,带 status='STALE'
    // 如果 seq 检查工作,这个结果应该被丢弃;detail 应仍为 'NEW'
    deferreds[0].resolve({ id: 'a', status: 'STALE' } as any)
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()

    // 关键断言: detail 仍然是 NEW,不会被 STALE 覆盖
    // (id 检查无法区别,因为两个都是 id='a';只有 seq 检查能丢弃 call 0)
    expect(lb.detail.value?.id).toBe('a')
    expect(lb.detail.value?.status).toBe('NEW')
  })
})
