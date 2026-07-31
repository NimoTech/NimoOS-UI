// P6b-T2: 地点详情面板「照片」标签页的一次性资产加载。
// 照 Vue2 PhotosTimeline.vue:819-841 (_loadPlaceAssets):limit 恒 500、失败清空
// (与 store 主数据的"失败保留"口径刻意不同——这里是一次性查询结果,留着上一次的
// 会误导用户,详见 usePlaceAssets.ts 里的注释)。
import { describe, expect, it, vi } from 'vitest'
import { usePlaceAssets } from '../usePlaceAssets'

const listAssetsByPlace = vi.fn()

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      listAssetsByPlace: (...a: unknown[]) => listAssetsByPlace(...a),
    },
  },
}))

function asset(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: 'a1', mimeType: 'image/jpeg', takenAt: '2026-03-07T10:00:00Z', ...over }
}

describe('usePlaceAssets', () => {
  it('{assets:[...]} 与裸数组两种响应形状都能吃出同样的 photos.length', async () => {
    listAssetsByPlace.mockResolvedValueOnce({ assets: [asset({ id: 'a1' }), asset({ id: 'a2' })] })
    const s1 = usePlaceAssets()
    await s1.load('7', '', null, null)
    expect(s1.photos.value).toHaveLength(2)

    listAssetsByPlace.mockResolvedValueOnce([asset({ id: 'a1' }), asset({ id: 'a2' })])
    const s2 = usePlaceAssets()
    await s2.load('7', '', null, null)
    expect(s2.photos.value).toHaveLength(2)
  })

  it('null / {} 响应 → photos 为空数组、不抛', async () => {
    listAssetsByPlace.mockResolvedValueOnce(null)
    const s1 = usePlaceAssets()
    await expect(s1.load('7', '', null, null)).resolves.toBeUndefined()
    expect(s1.photos.value).toEqual([])

    listAssetsByPlace.mockResolvedValueOnce({})
    const s2 = usePlaceAssets()
    await s2.load('7', '', null, null)
    expect(s2.photos.value).toEqual([])
  })

  it('photos 是 assetToPhoto 的产物:isVideo 由 mimeType 推出、takenAt 被保留', async () => {
    listAssetsByPlace.mockResolvedValueOnce({ assets: [asset({ id: 'v1', mimeType: 'video/mp4', takenAt: '2026-01-05T00:00:00Z' })] })
    const s = usePlaceAssets()
    await s.load('7', '', null, null)
    expect(s.photos.value[0].isVideo).toBe(true)
    expect(s.photos.value[0].takenAt).toBe('2026-01-05T00:00:00Z')
  })

  it('months 按月倒序分组', async () => {
    listAssetsByPlace.mockResolvedValueOnce({
      assets: [
        asset({ id: 'a1', takenAt: '2026-01-05T00:00:00Z' }),
        asset({ id: 'a2', takenAt: '2026-03-07T00:00:00Z' }),
        asset({ id: 'a3', takenAt: '2026-03-08T00:00:00Z' }),
      ],
    })
    const s = usePlaceAssets()
    await s.load('7', '', null, null)
    expect(s.months.value.map(m => m.key)).toEqual(['2026-03', '2026-01'])
    expect(s.months.value[0].photos).toHaveLength(2)
    expect(s.months.value[1].photos).toHaveLength(1)
  })

  it('spotKey 为空串时原样透传(不是 undefined);spotKey 非空且 lat/lon 非 null 时四参数都透传', async () => {
    listAssetsByPlace.mockResolvedValueOnce({ assets: [] })
    const s1 = usePlaceAssets()
    await s1.load('7', '', null, null)
    expect(listAssetsByPlace).toHaveBeenCalledWith('7', '', 500, null, null)

    listAssetsByPlace.mockResolvedValueOnce({ assets: [] })
    const s2 = usePlaceAssets()
    await s2.load('7', 'spot-1', 30.1, 120.2)
    expect(listAssetsByPlace).toHaveBeenCalledWith('7', 'spot-1', 500, 30.1, 120.2)
  })

  it('limit 恒 500', async () => {
    listAssetsByPlace.mockResolvedValueOnce({ assets: [] })
    const s = usePlaceAssets()
    await s.load('9', 'sx', 1, 2)
    expect(listAssetsByPlace).toHaveBeenCalledWith('9', 'sx', 500, 1, 2)
  })

  it('竞态:先发 A(慢)后发 B(快),B 先 resolve → 最终 photos 是 B 的;A 后 resolve 不覆盖;loading 最终为 false', async () => {
    let resolveA: (v: unknown) => void = () => {}
    let resolveB: (v: unknown) => void = () => {}
    listAssetsByPlace
      .mockReturnValueOnce(new Promise((r) => { resolveA = r }))
      .mockReturnValueOnce(new Promise((r) => { resolveB = r }))
    const s = usePlaceAssets()
    const pA = s.load('7', 'a', null, null)
    const pB = s.load('7', 'b', null, null)
    resolveB({ assets: [asset({ id: 'b1' })] })
    await pB
    expect(s.photos.value.map(p => p.id)).toEqual(['b1'])
    expect(s.loading.value).toBe(false)
    resolveA({ assets: [asset({ id: 'a1' })] })
    await pA
    expect(s.photos.value.map(p => p.id)).toEqual(['b1'])
    expect(s.loading.value).toBe(false)
  })

  it('finally 的 seq 守卫:旧请求(mine=1)先 resolve 时,不得在新请求(mine=2)仍在途时把 loading 拨回 false', async () => {
    let resolveA: (v: unknown) => void = () => {}
    listAssetsByPlace
      .mockReturnValueOnce(new Promise((r) => { resolveA = r }))
      .mockReturnValueOnce(new Promise(() => {})) // B 永不 resolve,模拟"仍在途"
    const s = usePlaceAssets()
    const pA = s.load('7', 'a', null, null)
    void s.load('7', 'b', null, null) // B 在途,不 await
    resolveA({ assets: [] })
    await pA
    // B 仍在途——loading 必须仍是 true,不能被 A 这个过期请求的 finally 提前拨回 false
    expect(s.loading.value).toBe(true)
  })

  it('失败:photos 清空、failed 为 true、console.error 被调', async () => {
    listAssetsByPlace.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePlaceAssets()
    await s.load('7', '', null, null)
    expect(s.photos.value).toEqual([])
    expect(s.failed.value).toBe(true)
    expect(s.loading.value).toBe(false)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('loading/loaded 生命周期:请求期间 loading 为 true,成功后 loaded 为 true、failed 为 false', async () => {
    let resolveFn: (v: unknown) => void = () => {}
    listAssetsByPlace.mockReturnValueOnce(new Promise((r) => { resolveFn = r }))
    const s = usePlaceAssets()
    const p = s.load('7', '', null, null)
    expect(s.loading.value).toBe(true)
    expect(s.loaded.value).toBe(false)
    resolveFn({ assets: [] })
    await p
    expect(s.loading.value).toBe(false)
    expect(s.loaded.value).toBe(true)
    expect(s.failed.value).toBe(false)
  })

  // ── 评审 I2:成功路径此前不清旧数据,第二次 load() 期间旧 spot/城市的照片仍可见 ──
  describe('第二次 load() 不残留旧数据(评审 I2)', () => {
    it('第二次 load() 发出后、响应到达前:photos 立即清空、loaded 立即回到 false(骨架门控 loading&&!loaded 重新命中)', async () => {
      listAssetsByPlace.mockResolvedValueOnce({ assets: [asset({ id: 'a1' }), asset({ id: 'a2' })] })
      const s = usePlaceAssets()
      await s.load('7', 'spot-a', null, null)
      expect(s.photos.value.map(p => p.id)).toEqual(['a1', 'a2'])
      expect(s.loaded.value).toBe(true)

      let resolveSecond: (v: unknown) => void = () => {}
      listAssetsByPlace.mockReturnValueOnce(new Promise((r) => { resolveSecond = r }))
      const p2 = s.load('7', '', null, null) // showWholeCity:清 spot,回整城
      // 响应还没到达——此刻不该再看到上一个 spot(a1/a2)的照片。
      expect(s.photos.value).toEqual([])
      expect(s.loaded.value).toBe(false)
      expect(s.loading.value).toBe(true)

      resolveSecond({ assets: [asset({ id: 'city-1' })] })
      await p2
      expect(s.photos.value.map(p => p.id)).toEqual(['city-1'])
      expect(s.loaded.value).toBe(true)
    })

    it('第二次 load() 失败时同样不残留第一次的照片(failed 分支既有清空,行为一致)', async () => {
      listAssetsByPlace.mockResolvedValueOnce({ assets: [asset({ id: 'a1' })] })
      const s = usePlaceAssets()
      await s.load('7', 'spot-a', null, null)
      expect(s.photos.value).toHaveLength(1)

      listAssetsByPlace.mockRejectedValueOnce(new Error('boom'))
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      await s.load('7', '', null, null)
      expect(s.photos.value).toEqual([])
      expect(s.failed.value).toBe(true)
      spy.mockRestore()
    })

    it('过期响应仍不回填:seq 守卫在清空之上继续生效(A 慢/B 快,A 事后到达不覆盖 B 的结果)', async () => {
      let resolveA: (v: unknown) => void = () => {}
      let resolveB: (v: unknown) => void = () => {}
      listAssetsByPlace
        .mockReturnValueOnce(new Promise((r) => { resolveA = r }))
        .mockReturnValueOnce(new Promise((r) => { resolveB = r }))
      const s = usePlaceAssets()
      const pA = s.load('7', 'a', null, null)
      const pB = s.load('7', 'b', null, null)
      resolveB({ assets: [asset({ id: 'b1' })] })
      await pB
      expect(s.photos.value.map(p => p.id)).toEqual(['b1'])
      resolveA({ assets: [asset({ id: 'a1' })] })
      await pA
      // A 是过期响应,即使它在 B 之后才 resolve,也不能把 B 的结果覆盖/清空。
      expect(s.photos.value.map(p => p.id)).toEqual(['b1'])
      expect(s.loaded.value).toBe(true)
    })
  })
})
