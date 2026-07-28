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
