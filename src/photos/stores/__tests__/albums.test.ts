import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      listAlbums: vi.fn(() => Promise.resolve([])),
      createAlbum: vi.fn(() => Promise.resolve({ id: 'new1', name: 'New' })),
      getAlbum: vi.fn(() => Promise.resolve({ assets: [] })),
      deleteAlbum: vi.fn(() => Promise.resolve()),
      updateAlbum: vi.fn(() => Promise.resolve({})),
      batchAddToAlbum: vi.fn(() => Promise.resolve()),
      removeFromAlbum: vi.fn(() => Promise.resolve()),
      reorderAlbumAssets: vi.fn(() => Promise.resolve()),
      convertSmartToAlbum: vi.fn(() => Promise.resolve({})),
    },
  },
}))
import { service } from '@nimotech/nimoos-service'
import { usePhotosAlbums } from '../albums'
import { usePhotosSmartViews, type SmartView } from '../smartViews'

function makeSv(id: string): SmartView {
  return {
    id, name: id, description: '', conds: [], threshold: 80, live: true, includeVideos: false,
    count: 0, addedThisWeek: 0, seeds: [], median: 0, storageBytes: 0,
    distribution: new Array(10).fill(0), evaluatedAt: '', createdAt: '',
  }
}

describe('photosAlbums store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('fetchAlbums', () => {
    it('成功 → albums 填充 + albumsLoaded===true', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 7, name: 'A' }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      expect(s.albums).toEqual([{ id: 7, name: 'A' }])
      expect(s.albumsLoaded).toBe(true)
    })
    it('返回 null → albums===[] (?? [])', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce(null)
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      expect(s.albums).toEqual([])
    })
    it('reject → albumsLoaded 仍为 false + console.error 被调', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.listAlbums as any).mockRejectedValueOnce(new Error('net'))
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      expect(s.albumsLoaded).toBe(false)
      expect(errSpy).toHaveBeenCalled()
      errSpy.mockRestore()
    })
    // Task 9(P4 遗留收口):新增 loadError,语义与 albumsLoaded 完全独立——失败时
    // loadError=true 但 albumsLoaded 仍保持 false(不可合并/不可互相替代)。
    it('fetchAlbums 失败:loadError 置真,albumsLoaded 保持假', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.listAlbums as any).mockRejectedValueOnce(new Error('net'))
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      expect(s.loadError).toBe(true)
      expect(s.albumsLoaded).toBe(false)
      errSpy.mockRestore()
    })
    it('重试成功后 loadError 归假', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.listAlbums as any).mockRejectedValueOnce(new Error('net'))
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      expect(s.loadError).toBe(true)
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 1, name: 'A' }])
      await s.fetchAlbums()
      expect(s.loadError).toBe(false)
      expect(s.albumsLoaded).toBe(true)
      errSpy.mockRestore()
    })
    it('成功路径 loadError 保持假', async () => {
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      expect(s.loadError).toBe(false)
    })
    // 评审 Important 1 补的挡门用例:重试本身也失败——loadError 必须仍然是真(不能被
    // "进入重试"这件事本身清空),albums/albumsLoaded 的状态也要与"一次都没成功过"一致。
    it('reject → retry → reject:结束后 loadError 仍为真,albums/albumsLoaded 与未成功过一致', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.listAlbums as any).mockRejectedValueOnce(new Error('e1'))
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      expect(s.loadError).toBe(true)

      ;(service.photos.listAlbums as any).mockRejectedValueOnce(new Error('e2'))
      await s.fetchAlbums() // 重试,仍失败
      expect(s.loadError).toBe(true)
      expect(s.albums).toEqual([])
      expect(s.albumsLoaded).toBe(false)
      errSpy.mockRestore()
    })
  })

  describe('跨类型 String 归一(铁律)', () => {
    it("albumById('7') 命中后端返回的数字 id 7", async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 7, name: 'A' }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      expect(s.albumById('7')).toEqual({ id: 7, name: 'A' })
      expect(s.albumById(7)).toEqual({ id: 7, name: 'A' })
    })
    it('assetsOf 按 key 归一(数字 id 存,字符串查命中)', async () => {
      const s = usePhotosAlbums()
      ;(service.photos.getAlbum as any).mockResolvedValueOnce({ assets: [{ id: 'p1', takenAt: '2026-01-01T00:00:00Z' }] })
      await s.fetchAlbumAssets(7)
      expect(s.assetsOf('7').length).toBe(1)
    })
    it('isLoadingAssets 按 key 归一——in-flight 时数字存/字符串查也命中 true(非零区分力的"早已结束"断言)', async () => {
      let resolveFn: (v: unknown) => void
      ;(service.photos.getAlbum as any).mockImplementationOnce(
        () => new Promise((resolve) => { resolveFn = resolve }),
      )
      const s = usePhotosAlbums()
      const p = s.fetchAlbumAssets(7) // 数字 id 发起
      expect(s.isLoadingAssets('7')).toBe(true) // 字符串查,in-flight 时必须命中
      resolveFn!({ assets: [] })
      await p
      expect(s.isLoadingAssets('7')).toBe(false)
    })
    // 写路径归一(updateAlbumLocal,经 renameAlbum 驱动):后端相册 id 是数字 7,
    // 调用方传字符串 '7'(模拟路由 params.id 恒为字符串)必须命中同一条并原地改写。
    it('updateAlbumLocal(经 renameAlbum)按 key 归一:数字 id 存,字符串 id 改', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 7, name: 'Old' }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      ;(service.photos.updateAlbum as any).mockResolvedValueOnce({ name: '新名' })
      await s.renameAlbum('7', '新名') // 字符串 id,后端存的是数字 7
      expect(service.photos.updateAlbum).toHaveBeenCalledWith('7', { name: '新名' })
      expect(s.albumById(7)?.name).toBe('新名')
      expect(s.albums).toHaveLength(1) // 确认是原地改写而非误插一条新记录
    })
    // 写路径归一(removeAssetsFromAlbum 的 remove Set):Photo.id 类型是 string | number,
    // 后端资产 id 可能是数字,调用方传字符串 assetIds(真实可能发生的组合)。
    it('removeAssetsFromAlbum 的 remove Set 按 key 归一:资产数字 id,传入字符串 id 仍能移除', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1', assetCount: 2 }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      ;(service.photos.getAlbum as any).mockResolvedValueOnce({
        assets: [{ id: 101, takenAt: null }, { id: 102, takenAt: null }],
      })
      await s.fetchAlbumAssets('a1')
      await s.removeAssetsFromAlbum('a1', ['101']) // 字符串,资产实际 id 是数字 101
      expect(s.assetsOf('a1').map((x) => x.id)).toEqual([102])
      expect(service.photos.removeFromAlbum).toHaveBeenCalledWith('a1', '101')
    })
  })

  describe('createAlbum', () => {
    it('返回新相册且 listAlbums 被再次调用', async () => {
      const s = usePhotosAlbums()
      const created = await s.createAlbum('Trip')
      expect(created).toEqual({ id: 'new1', name: 'New' })
      expect(service.photos.createAlbum).toHaveBeenCalledWith('Trip')
      expect(service.photos.listAlbums).toHaveBeenCalledTimes(1)
    })
    it('reject → 抛出', async () => {
      ;(service.photos.createAlbum as any).mockRejectedValueOnce(new Error('dup'))
      const s = usePhotosAlbums()
      await expect(s.createAlbum('Trip')).rejects.toThrow('dup')
    })
  })

  describe('deleteAlbum', () => {
    it('清该 id 资产缓存 + listAlbums 再调', async () => {
      const s = usePhotosAlbums()
      ;(service.photos.getAlbum as any).mockResolvedValueOnce({ assets: [{ id: 'p1', takenAt: null }] })
      await s.fetchAlbumAssets('9')
      expect(s.assetsOf('9').length).toBe(1)
      await s.deleteAlbum('9')
      expect(service.photos.deleteAlbum).toHaveBeenCalledWith('9')
      expect(s.assetsOf('9')).toEqual([])
      expect(service.photos.listAlbums).toHaveBeenCalledTimes(1)
    })
    // 负向:deleteAlbum 无乐观删除(Vue2 :905-909 先 await 后端,成功后才 commit)——
    // 在后端调用尚未 resolve 期间,albums 列表必须原封不动。
    it('无乐观删除:后端调用 in-flight 期间 albums 列表未变', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1', name: 'A' }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      let resolveFn: (v: unknown) => void
      ;(service.photos.deleteAlbum as any).mockImplementationOnce(
        () => new Promise((resolve) => { resolveFn = resolve }),
      )
      const p = s.deleteAlbum('a1')
      expect(s.albums).toEqual([{ id: 'a1', name: 'A' }]) // 未被乐观移除
      resolveFn!({})
      await p
    })
  })

  describe('fetchAlbumAssets', () => {
    it('成功 → assetsOf 为 assetToPhoto 映射结果', async () => {
      ;(service.photos.getAlbum as any).mockResolvedValueOnce({
        assets: [{ id: 'p1', takenAt: '2026-01-01T00:00:00Z', originalName: 'x.jpg' }],
      })
      const s = usePhotosAlbums()
      await s.fetchAlbumAssets('a1')
      expect(s.assetsOf('a1')).toEqual([
        expect.objectContaining({ id: 'p1', file: 'x.jpg' }),
      ])
    })
    it('并发二次调用被防重入吞掉(getAlbum 只调 1 次)', async () => {
      let resolveFn: (v: unknown) => void
      ;(service.photos.getAlbum as any).mockImplementationOnce(
        () => new Promise((resolve) => { resolveFn = resolve }),
      )
      const s = usePhotosAlbums()
      const p1 = s.fetchAlbumAssets('a1')
      const p2 = s.fetchAlbumAssets('a1')
      resolveFn!({ assets: [] })
      await Promise.all([p1, p2])
      expect(service.photos.getAlbum).toHaveBeenCalledTimes(1)
    })
    // 评审挡门项:必须先填充旧值再让第二次拉取失败,否则「清空为 []」和"未知 key 本来
    // 就返回 []"（albums.ts 的 `?? []`）无法区分——把实现里清空那行整行删掉这条测试也会
    // 通过。见 Vue2 photos.js:928(拉失败要抹掉旧内容,不能让用户对着陈旧列表操作)。
    it('reject → assetsOf 从「有旧值」变为 []（非保留旧值)+ loading 收尾为 false + console.error', async () => {
      ;(service.photos.getAlbum as any).mockResolvedValueOnce({ assets: [{ id: 'p1', takenAt: null }] })
      const s = usePhotosAlbums()
      await s.fetchAlbumAssets('a1')
      expect(s.assetsOf('a1')).toHaveLength(1) // 先证明有旧值

      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.getAlbum as any).mockRejectedValueOnce(new Error('x'))
      await s.fetchAlbumAssets('a1')
      expect(s.assetsOf('a1')).toEqual([]) // 这句现在才有区分力:证明旧值被真的抹掉了
      expect(s.isLoadingAssets('a1')).toBe(false)
      expect(errSpy).toHaveBeenCalled()
      errSpy.mockRestore()
    })
  })

  describe('renameAlbum', () => {
    it('调用 updateAlbum(id,{name}),本地写回后端返回的 name', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1', name: 'Old' }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      ;(service.photos.updateAlbum as any).mockResolvedValueOnce({ name: '服务端名' })
      await s.renameAlbum('a1', 'New Name')
      expect(service.photos.updateAlbum).toHaveBeenCalledWith('a1', { name: 'New Name' })
      expect(s.albumById('a1')?.name).toBe('服务端名')
      // 负向:renameAlbum 不重拉列表(Vue2 :933-936 只 commit 本地,不 dispatch fetchAlbums)——
      // listAlbums 只应有 setup 阶段的 1 次调用。
      expect(service.photos.listAlbums).toHaveBeenCalledTimes(1)
    })
    it('reject → 抛出且本地未改', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1', name: 'Old' }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      ;(service.photos.updateAlbum as any).mockRejectedValueOnce(new Error('x'))
      await expect(s.renameAlbum('a1', 'New Name')).rejects.toThrow('x')
      expect(s.albumById('a1')?.name).toBe('Old')
    })
    // 回归保护(逐行核对 Vue2 :934-935 发现的出入):Vue2 是 res.data.name **无兜底**,
    // brief 快照误加了 `?? name`。若这里被误改回加兜底,后端漏返回 name 时本测试会挂红
    // (期望 undefined,兜底实现会得到入参 'New Name')。
    it('Vue2 保真:后端响应缺 name 字段时写回 undefined,不兜底成入参', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1', name: 'Old' }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      ;(service.photos.updateAlbum as any).mockResolvedValueOnce({})
      await s.renameAlbum('a1', 'New Name')
      expect(s.albumById('a1')?.name).toBeUndefined()
    })
  })

  describe('setAlbumCover', () => {
    it('调用前本地立即变新 cover(乐观)', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1', coverAssetId: 'p0' }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      let resolveFn: (v: unknown) => void
      ;(service.photos.updateAlbum as any).mockImplementationOnce(
        () => new Promise((resolve) => { resolveFn = resolve }),
      )
      const p = s.setAlbumCover('a1', 'p1')
      expect(s.albumById('a1')?.coverAssetId).toBe('p1')
      resolveFn!({})
      await p
    })
    it('reject → 回滚为 prev 且抛出', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1', coverAssetId: 'p0' }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      ;(service.photos.updateAlbum as any).mockRejectedValueOnce(new Error('x'))
      await expect(s.setAlbumCover('a1', 'p1')).rejects.toThrow('x')
      expect(s.albumById('a1')?.coverAssetId).toBe('p0')
    })
    // 回归保护(逐行核对 Vue2 :938-939 发现的出入):Vue2 的 prev 在相册存在但
    // coverAssetId 字段缺失时是 undefined(属性直读),不是 null;brief 快照用 `?? null`
    // 把这种情况也归一成了 null。若这里被误改回 `?? null`,本测试会挂红(期望 undefined)。
    it('Vue2 保真:相册存在但 coverAssetId 字段缺失时,回滚值是 undefined 不是 null', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1' }]) // 无 coverAssetId 字段
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      ;(service.photos.updateAlbum as any).mockRejectedValueOnce(new Error('x'))
      await expect(s.setAlbumCover('a1', 'p1')).rejects.toThrow('x')
      expect(s.albumById('a1')?.coverAssetId).toBeUndefined()
    })
  })

  describe('reorderAlbumAssets', () => {
    it('立即按传入顺序重排;传入含未知 id 该项被丢弃', async () => {
      ;(service.photos.getAlbum as any).mockResolvedValueOnce({
        assets: [
          { id: 'p1', takenAt: null },
          { id: 'p2', takenAt: null },
          { id: 'p3', takenAt: null },
        ],
      })
      const s = usePhotosAlbums()
      await s.fetchAlbumAssets('a1')
      let resolveFn: (v: unknown) => void
      ;(service.photos.reorderAlbumAssets as any).mockImplementationOnce(
        () => new Promise((resolve) => { resolveFn = resolve }),
      )
      const p = s.reorderAlbumAssets('a1', ['p3', 'unknown', 'p1', 'p2'])
      expect(s.assetsOf('a1').map((x) => x.id)).toEqual(['p3', 'p1', 'p2'])
      resolveFn!({})
      await p
    })
    it('reject → 整份还原且抛出', async () => {
      ;(service.photos.getAlbum as any).mockResolvedValueOnce({
        assets: [
          { id: 'p1', takenAt: null },
          { id: 'p2', takenAt: null },
        ],
      })
      const s = usePhotosAlbums()
      await s.fetchAlbumAssets('a1')
      ;(service.photos.reorderAlbumAssets as any).mockRejectedValueOnce(new Error('x'))
      await expect(s.reorderAlbumAssets('a1', ['p2', 'p1'])).rejects.toThrow('x')
      expect(s.assetsOf('a1').map((x) => x.id)).toEqual(['p1', 'p2'])
    })
  })

  describe('addAssetsToAlbum', () => {
    it('立即 assetCount=prev+n;成功后 getAlbum 被调且 assetCount 被真实长度覆盖', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1', assetCount: 2 }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      let resolveBatch: (v: unknown) => void
      ;(service.photos.batchAddToAlbum as any).mockImplementationOnce(
        () => new Promise((resolve) => { resolveBatch = resolve }),
      )
      ;(service.photos.getAlbum as any).mockResolvedValueOnce({
        assets: [{ id: 'p1', takenAt: null }, { id: 'p2', takenAt: null }, { id: 'p3', takenAt: null }],
      })
      const p = s.addAssetsToAlbum('a1', ['p2', 'p3'])
      expect(s.albumById('a1')?.assetCount).toBe(4) // 2 + 2 optimistic
      resolveBatch!({})
      await p
      expect(service.photos.getAlbum).toHaveBeenCalledWith('a1')
      expect(s.albumById('a1')?.assetCount).toBe(3) // real length after refetch
    })
    it('reject → 计数回滚为 prev 且抛出', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1', assetCount: 2 }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      ;(service.photos.batchAddToAlbum as any).mockRejectedValueOnce(new Error('x'))
      await expect(s.addAssetsToAlbum('a1', ['p2', 'p3'])).rejects.toThrow('x')
      expect(s.albumById('a1')?.assetCount).toBe(2)
    })
  })

  describe('removeAssetsFromAlbum', () => {
    it('立即移除+计数减;removeFromAlbum 逐条调用;成功后 listAlbums 再调', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1', assetCount: 3 }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      ;(service.photos.getAlbum as any).mockResolvedValueOnce({
        assets: [
          { id: 'p1', takenAt: null },
          { id: 'p2', takenAt: null },
          { id: 'p3', takenAt: null },
        ],
      })
      await s.fetchAlbumAssets('a1')
      const p = s.removeAssetsFromAlbum('a1', ['p1', 'p2'])
      // 乐观写发生在 await Promise.all(...) 之前的同步段,故 await p 前即可断言。
      expect(s.assetsOf('a1').map((x) => x.id)).toEqual(['p3'])
      expect(s.albumById('a1')?.assetCount).toBe(1)
      await p
      expect(service.photos.removeFromAlbum).toHaveBeenCalledTimes(2)
      expect(service.photos.listAlbums).toHaveBeenCalledTimes(2) // initial fetchAlbums + post-remove refetch
    })
    it('reject → assets 与计数整份回滚且抛出', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1', assetCount: 3 }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      ;(service.photos.getAlbum as any).mockResolvedValueOnce({
        assets: [
          { id: 'p1', takenAt: null },
          { id: 'p2', takenAt: null },
          { id: 'p3', takenAt: null },
        ],
      })
      await s.fetchAlbumAssets('a1')
      // .mockRejectedValueOnce 两次(对应 assetIds 长度 2 次调用),避免 mockRejectedValue
      // (非 Once)让 mock 实现在本文件余生永久 reject——vi.clearAllMocks() 只清调用记录,
      // 不清实现,是 brief 警告的跨用例"实现泄漏"。
      ;(service.photos.removeFromAlbum as any)
        .mockRejectedValueOnce(new Error('x'))
        .mockRejectedValueOnce(new Error('x'))
      await expect(s.removeAssetsFromAlbum('a1', ['p1', 'p2'])).rejects.toThrow('x')
      expect(s.assetsOf('a1').map((x) => x.id)).toEqual(['p1', 'p2', 'p3'])
      expect(s.albumById('a1')?.assetCount).toBe(3)
    })
    // 回归保护(逐行核对 Vue2 :979-980 发现的出入):Vue2 的 prevCount 在相册存在但
    // assetCount 字段缺失时兜底 0(`album.assetCount || 0`),只有相册整个找不到时才兜底
    // snapshot.length;brief 快照用 `?? snapshot.length` 把两种情况都兜底成了
    // snapshot.length。若这里被误改回 `??`,本测试会挂红(期望 0,误实现会得到 3)。
    it('Vue2 保真:相册存在但 assetCount 字段缺失时,回滚计数是 0 不是 snapshot.length', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1' }]) // 无 assetCount 字段
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      ;(service.photos.getAlbum as any).mockResolvedValueOnce({
        assets: [
          { id: 'p1', takenAt: null },
          { id: 'p2', takenAt: null },
          { id: 'p3', takenAt: null },
        ],
      })
      await s.fetchAlbumAssets('a1')
      ;(service.photos.removeFromAlbum as any)
        .mockRejectedValueOnce(new Error('x'))
        .mockRejectedValueOnce(new Error('x'))
      await expect(s.removeAssetsFromAlbum('a1', ['p1', 'p2'])).rejects.toThrow('x')
      expect(s.albumById('a1')?.assetCount).toBe(0)
    })
  })

  describe('saveAsAlbum', () => {
    it('createAlbum → batchAddToAlbum(新id, ids) → listAlbums 顺序调用,返回新相册', async () => {
      const s = usePhotosAlbums()
      const order: string[] = []
      ;(service.photos.createAlbum as any).mockImplementationOnce(async () => {
        order.push('createAlbum')
        return { id: 'new2', name: 'Trip' }
      })
      ;(service.photos.batchAddToAlbum as any).mockImplementationOnce(async () => {
        order.push('batchAddToAlbum')
      })
      ;(service.photos.listAlbums as any).mockImplementationOnce(async () => {
        order.push('listAlbums')
        return []
      })
      const created = await s.saveAsAlbum('Trip', ['p1', 'p2'])
      expect(created).toEqual({ id: 'new2', name: 'Trip' })
      expect(service.photos.batchAddToAlbum).toHaveBeenCalledWith('new2', ['p1', 'p2'])
      expect(order).toEqual(['createAlbum', 'batchAddToAlbum', 'listAlbums'])
    })
    it('createAlbum reject(409) → 抛出且 batchAddToAlbum 未被调', async () => {
      ;(service.photos.createAlbum as any).mockRejectedValueOnce(new Error('409 conflict'))
      const s = usePhotosAlbums()
      await expect(s.saveAsAlbum('Trip', ['p1'])).rejects.toThrow('409')
      expect(service.photos.batchAddToAlbum).not.toHaveBeenCalled()
    })
  })

  describe('convertFromSmartView', () => {
    it('unshifts the new album and returns the raw object', async () => {
      ;(service.photos.convertSmartToAlbum as any).mockResolvedValueOnce({ id: 'al-new', name: 'N', videoCount: 2 })
      const s = usePhotosAlbums()
      const album = await s.convertFromSmartView('sv-1')
      expect(album.id).toBe('al-new')
      expect(s.albums[0].id).toBe('al-new')
    })

    it('rethrows instead of swallowing the failure', async () => {
      ;(service.photos.convertSmartToAlbum as any).mockRejectedValueOnce(new Error('boom'))
      const s = usePhotosAlbums()
      await expect(s.convertFromSmartView('sv-1')).rejects.toBeTruthy()
      expect(s.albums).toHaveLength(0)
    })

    // Final fix wave: the backend deletes the source smart view, so it must leave the other
    // store too. Without this, smartViews.listLoaded stays true, PhotosSmartViewDetail.vue:96
    // skips its own fetch, and one browser Back press lands on a fully interactive detail page
    // for an object the server has already deleted.
    it('evicts the source smart view from the smart views store', async () => {
      ;(service.photos.convertSmartToAlbum as any).mockResolvedValueOnce({ id: 'al-new', name: 'N' })
      const sv = usePhotosSmartViews()
      sv.smartViews = [makeSv('sv-1'), makeSv('sv-2')]
      const s = usePhotosAlbums()
      await s.convertFromSmartView('sv-1')
      expect(sv.smartViews.map((v) => v.id)).toEqual(['sv-2'])
      expect(s.albums[0].id).toBe('al-new')
    })

    it('leaves the source smart view alone when the conversion fails', async () => {
      ;(service.photos.convertSmartToAlbum as any).mockRejectedValueOnce(new Error('boom'))
      const sv = usePhotosSmartViews()
      sv.smartViews = [makeSv('sv-1')]
      const s = usePhotosAlbums()
      await expect(s.convertFromSmartView('sv-1')).rejects.toBeTruthy()
      expect(sv.smartViews.map((v) => v.id)).toEqual(['sv-1'])
    })
  })
})
