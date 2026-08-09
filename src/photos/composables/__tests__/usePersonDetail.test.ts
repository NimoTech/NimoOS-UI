import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      getPerson: vi.fn(),
      getPersonAssets: vi.fn(),
      personPlaces: vi.fn(),
    },
  },
}))

import { service } from '@nimotech/nimoos-service'
import { usePersonDetail, groupPersonAssets } from '../usePersonDetail'
import type { Photo } from '../../util/assetToPhoto'

function makeDeferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

async function flush(times = 5): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve()
}

function P(id: string | number, extra: Partial<Photo> = {}): Photo {
  return {
    id, title: id, file: '', date: '', time: '', takenAt: null, indexedAt: null,
    mimeType: '', fileSize: 0, isVideo: false, hasOcr: false, isNew: false,
    pinned: false,
    isLivePhoto: false, livePhotoVideoId: null, duration: null, durationMs: 0,
    fav: false, status: undefined, filePath: '', width: null, height: null,
    dim: null, size: '', latitude: null, longitude: null, coords: null,
    place: null, camera: null, iso: null, shutter: null, aperture: null,
    focal: null, orientation: null, videoCodec: null, audioCodec: null,
    frameRate: null, bitRate: null, rotation: 0, matchScore: null,
    matchedBy: null, belowCut: false, tags: [], scene: null, faces: [],
    ...extra,
  }
}

describe('usePersonDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('load 成功后 person/relations/places/months 各就位;getPersonAssets 收到 (id,300,0)', async () => {
    ;(service.photos.getPerson as any).mockResolvedValue({
      person: { id: '7', name: 'Alice' },
      relations: [{ personId: '9', name: 'Bob', count: 3 }],
    })
    ;(service.photos.personPlaces as any).mockResolvedValue([{ placeName: 'Paris' }])
    ;(service.photos.getPersonAssets as any).mockResolvedValue([
      { id: 'a1', takenAt: '2026-03-01T00:00:00Z' },
    ])

    const { person, relations, places, months, loading, failed, load } = usePersonDetail()
    await load('7')

    expect(person.value?.id).toBe('7')
    expect(person.value?.name).toBe('Alice')
    expect(relations.value).toEqual([{ personId: '9', name: 'Bob', count: 3 }])
    expect(places.value).toEqual([{ placeName: 'Paris' }])
    expect(months.value).toHaveLength(1)
    expect(months.value[0].key).toBe('2026-03')
    expect(loading.value).toBe(false)
    expect(failed.value).toBe(false)
    expect(service.photos.getPersonAssets).toHaveBeenCalledWith('7', 300, 0)
  })

  it('seq 竞态守卫:先 load(a) 后 load(b),a 的响应后到也不覆盖 b(用可控 deferred promise 构造)', async () => {
    const deferredA = makeDeferred<any>()
    const deferredB = makeDeferred<any>()
    ;(service.photos.getPerson as any).mockImplementation((id: string) =>
      id === 'a' ? deferredA.promise : deferredB.promise,
    )
    ;(service.photos.personPlaces as any).mockResolvedValue([])
    ;(service.photos.getPersonAssets as any).mockResolvedValue([])

    const { person, load } = usePersonDetail()

    const pa = load('a')
    const pb = load('b')

    // b(后发)先 resolve
    deferredB.resolve({ person: { id: 'b', name: 'B' }, relations: [] })
    await flush()
    await pb

    // a(先发但慢)现在才 resolve —— 必须被丢弃
    deferredA.resolve({ person: { id: 'a', name: 'A' }, relations: [] })
    await flush()
    await pa

    expect(person.value?.id).toBe('b')
  })

  it('seq 竞态守卫检查点②:a 的 getPerson 先顺利通过检查点①(写入 a 的 person/relations),但 a 的 Promise.all(places+assets) 比 b 全程更慢返回 → places/months 仍是 b 的,不被 a 的旧数据覆盖', async () => {
    // 与上一条不同:上一条只用 deferred 控制 getPerson,a 在检查点①就被拦下,从没走到过
    // 检查点②(Promise.all 之后那处)。这一条专门让 a 先*通过*检查点①、把 person/relations
    // 写成 a 的,再让它在 Promise.all([personPlaces, getPersonAssets]) 上卡住比 b 更慢返回,
    // 只有检查点②能拦住这次覆盖。
    const deferredAPlaces = makeDeferred<any>()
    const deferredAAssets = makeDeferred<any>()

    ;(service.photos.getPerson as any).mockImplementation((id: string) =>
      Promise.resolve(id === 'a'
        ? { person: { id: 'a', name: 'A' }, relations: [] }
        : { person: { id: 'b', name: 'B' }, relations: [] }),
    )
    ;(service.photos.personPlaces as any).mockImplementation((id: string) =>
      id === 'a' ? deferredAPlaces.promise : Promise.resolve([{ placeName: 'B-place' }]),
    )
    ;(service.photos.getPersonAssets as any).mockImplementation((id: string) =>
      id === 'a' ? deferredAAssets.promise : Promise.resolve([{ id: 'b1', takenAt: '2026-05-01T00:00:00Z' }]),
    )

    const { person, places, months, load } = usePersonDetail()

    const pa = load('a')
    await flush() // 让 a 走过检查点①(person/relations 写成 a 的),随后卡在 Promise.all 上
    expect(person.value?.id).toBe('a') // 确认 a 真的先通过了检查点①,不是被提前拦下

    const pb = load('b')
    await pb // b 全程立即 resolve,完整跑完:person/places/months 全变成 b 的

    expect(person.value?.id).toBe('b')
    expect(places.value).toEqual([{ placeName: 'B-place' }])

    // a 的 places/assets 现在才姗姗来迟地 resolve —— 必须被检查点②拦下,不能覆盖 b 的数据
    deferredAPlaces.resolve([{ placeName: 'A-place-STALE' }])
    deferredAAssets.resolve([{ id: 'a1', takenAt: '2026-01-01T00:00:00Z' }])
    await flush()
    await pa

    expect(places.value).toEqual([{ placeName: 'B-place' }])
    expect(months.value.map((m) => m.key)).toEqual(['2026-05'])
  })

  it('getPerson 抛错 → failed=true、loading=false、console.error 被调,四个数据 ref 保持空', async () => {
    const err = new Error('boom')
    ;(service.photos.getPerson as any).mockRejectedValue(err)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { person, relations, places, months, loading, failed, load } = usePersonDetail()
    await load('7')

    expect(failed.value).toBe(true)
    expect(loading.value).toBe(false)
    expect(errSpy).toHaveBeenCalled()
    expect(person.value).toBeNull()
    expect(relations.value).toEqual([])
    expect(places.value).toEqual([])
    expect(months.value).toEqual([])
  })

  it('relations/places/assets 返回 null(Go nil slice)→ 空数组不炸', async () => {
    ;(service.photos.getPerson as any).mockResolvedValue({ person: { id: '7' }, relations: null })
    ;(service.photos.personPlaces as any).mockResolvedValue(null)
    ;(service.photos.getPersonAssets as any).mockResolvedValue(null)

    const { relations, places, months, failed, load } = usePersonDetail()
    await load('7')

    expect(failed.value).toBe(false)
    expect(relations.value).toEqual([])
    expect(places.value).toEqual([])
    expect(months.value).toEqual([])
  })

  describe('groupPersonAssets', () => {
    it('按 takenAt 前 7 位分桶;月份键降序;缺失 takenAt 进 unknown 桶且排在最后;title 走 monthKeyLabel', () => {
      const photos = [
        P('1', { takenAt: '2026-01-15T00:00:00Z' }),
        P('2', { takenAt: '2026-03-02T00:00:00Z' }),
        P('3', { takenAt: null }),
        P('4', { takenAt: '2026-03-20T00:00:00Z' }),
      ]
      const months = groupPersonAssets(photos)
      expect(months.map((m) => m.key)).toEqual(['2026-03', '2026-01', 'unknown'])
      expect(months.find((m) => m.key === '2026-03')?.title).toBe('March 2026')
      expect(months.find((m) => m.key === 'unknown')?.title).toBe('unknown')
      expect(months.find((m) => m.key === '2026-03')?.photos.map((p) => p.id)).toEqual(['2', '4'])
    })
  })

  describe('patchPerson', () => {
    it('person 已加载时局部合并补丁', async () => {
      ;(service.photos.getPerson as any).mockResolvedValue({ person: { id: '7', name: 'Alice' }, relations: [] })
      ;(service.photos.personPlaces as any).mockResolvedValue([])
      ;(service.photos.getPersonAssets as any).mockResolvedValue([])

      const { person, load, patchPerson } = usePersonDetail()
      await load('7')

      expect(patchPerson({ name: 'Alice2', favorite: true }, '7')).toBe(true)
      expect(person.value?.id).toBe('7') // 未被补丁字段覆盖的字段保持原值
      expect(person.value?.name).toBe('Alice2')
      expect(person.value?.favorite).toBe(true)
    })

    it('person 为 null 时(尚未 load 或加载失败)是空操作,不炸', () => {
      const { person, patchPerson } = usePersonDetail()
      expect(person.value).toBeNull()
      // 一次 load 都没跑过 ⇒ currentId 仍是 null ⇒ 任何 expectId 都算过期。
      expect(patchPerson({ name: 'X' }, 'X')).toBe(false)
      expect(person.value).toBeNull()
    })

    // ── 评审 Important 3:身份守卫 ────────────────────────────────────────────
    it('expectId 与当前装着的人物不符时整条回写作废(返回 false,数据不动)', async () => {
      ;(service.photos.getPerson as any).mockResolvedValue({ person: { id: '7', name: 'Alice' }, relations: [] })
      ;(service.photos.personPlaces as any).mockResolvedValue([])
      ;(service.photos.getPersonAssets as any).mockResolvedValue([])

      const { person, load, patchPerson, isCurrent } = usePersonDetail()
      await load('7')

      expect(isCurrent('7')).toBe(true)
      expect(isCurrent(7)).toBe(true)          // 铁律:String() 归一,数字 id 也算同一人
      expect(isCurrent('8')).toBe(false)
      expect(patchPerson({ name: 'HIJACKED' }, '8')).toBe(false)
      expect(person.value?.name).toBe('Alice')
    })

    it('load(新 id) 一进门就同步换身份 —— 不等响应回来,旧人物在途的回写立刻作废', () => {
      let resolveGet: ((v: unknown) => void) | undefined
      ;(service.photos.getPerson as any).mockImplementation(() => new Promise((r) => { resolveGet = r }))
      ;(service.photos.personPlaces as any).mockResolvedValue([])
      ;(service.photos.getPersonAssets as any).mockResolvedValue([])

      const { load, isCurrent } = usePersonDetail()
      void load('A')
      expect(isCurrent('A')).toBe(true)
      void load('B')                            // 路由一变、watch 一调 load
      expect(isCurrent('A')).toBe(false)        // A 还没 resolve,身份已经不是它了
      expect(isCurrent('B')).toBe(true)
      resolveGet?.({ person: { id: 'B' }, relations: [] })
    })
  })

  describe('removePhotosLocally / flatPhotos', () => {
    it('按 id 移除(数字 id 铁律),移空的月份整个消失;flatPhotos 顺序=各月拼接', async () => {
      ;(service.photos.getPerson as any).mockResolvedValue({ person: { id: '7' }, relations: [] })
      ;(service.photos.personPlaces as any).mockResolvedValue([])
      ;(service.photos.getPersonAssets as any).mockResolvedValue([
        { id: 1, takenAt: '2026-02-01T00:00:00Z' },
        { id: '2', takenAt: '2026-01-01T00:00:00Z' },
      ])

      const { months, load, removePhotosLocally, flatPhotos } = usePersonDetail()
      await load('7')

      expect(flatPhotos().map((p) => String(p.id))).toEqual(['1', '2'])

      // '1' 号月份(2026-02)只有一张照片,id 是数字 1;用字符串 '1' 移除,铁律要求命中
      removePhotosLocally(['1'])
      expect(months.value.map((m) => m.key)).toEqual(['2026-01'])
      expect(flatPhotos().map((p) => String(p.id))).toEqual(['2'])
    })
  })
})
