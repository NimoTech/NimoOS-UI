## Task 3: moments store

**Files:**
- Create: `src/photos/stores/moments.ts`
- Test: `src/photos/stores/__tests__/moments.test.ts`

**Interfaces:**
- Consumes: `service.photos.*`（Task 1）· `assignMomentSizes`（Task 2）· `assetToPhoto` / `Photo`（既有 `src/photos/util/assetToPhoto.ts`）
- Produces：
  - `export interface Moment { id: string; title: string; subtitle: string; place: string; recipeKey: string; coverAssetId: string; featuredAssetIds: string[]; assetCount: number; addedThisWeek: number; coverRatio: number; timeFrom: string; timeTo: string; updatedAt: string }`
  - `export interface MomentMember { assetId: string; manual: boolean; featured: boolean }`
  - `export interface MomentPlace { name: string; count: number }`
  - `export interface MomentDetailAssets { assets: Photo[]; members: MomentMember[]; places: MomentPlace[] }`
  - `usePhotosMoments()` 暴露：`moments` · `listLoading` · `listLoaded` · `sizeMap` · `fetchMoments()` · `byId(id)` · `ensureLoaded()` · `setOrder(ids)` · `reorder(ids)` · `loadDetail(id)` · `loadAll(id)` · `pin(id, ids)` · `exclude(id, ids)` · `remove(id)` · `exportAlbum(id)` · `applyAssetCount(id, n)`

- [ ] **Step 1: 写失败的测试**

新建 `src/photos/stores/__tests__/moments.test.ts`：

```ts
// SP15-P1-T3: moments store。回源核对 NimoOS-Photos/route/v1/moments.go 的
// momentResponse —— featured_asset_ids / added_this_week / cover_ratio 恒输出,
// cover_asset_id / time_from / time_to / place / sort_order 带 omitempty 可缺,
// **updated_at 后端根本不发**(见 plan Global Constraints)。
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const listMoments = vi.fn()
const getMomentAssets = vi.fn()
const pinMomentAssets = vi.fn()
const excludeMomentAssets = vi.fn()
const deleteMoment = vi.fn()
const exportMomentAlbum = vi.fn()
const reorderMoments = vi.fn()

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      listMoments: (...a: unknown[]) => listMoments(...a),
      getMomentAssets: (...a: unknown[]) => getMomentAssets(...a),
      pinMomentAssets: (...a: unknown[]) => pinMomentAssets(...a),
      excludeMomentAssets: (...a: unknown[]) => excludeMomentAssets(...a),
      deleteMoment: (...a: unknown[]) => deleteMoment(...a),
      exportMomentAlbum: (...a: unknown[]) => exportMomentAlbum(...a),
      reorderMoments: (...a: unknown[]) => reorderMoments(...a),
      thumbnailUrl: (id: string, size: string) => `mock://${id}/${size}`,
    },
  },
}))

import { usePhotosMoments } from '../moments'

const RAW = {
  id: 'm1', title: 'Bozeman', subtitle: 'Nov 2016', cover_asset_id: 'c1',
  asset_count: 42, time_from: '2016-11-20T00:46:46Z', time_to: '2016-11-22T04:04:35Z',
  place: 'Bozeman', recipe_key: 'trip:1', named_by_llm: false, sort_order: 0,
  featured_asset_ids: ['f1', 'f2'], added_this_week: 3, cover_ratio: 1.5,
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('归一', () => {
  it('snake_case 逐字段转驼峰', async () => {
    listMoments.mockResolvedValue([RAW])
    const s = usePhotosMoments()
    await s.fetchMoments()
    expect(s.moments[0]).toEqual({
      id: 'm1', title: 'Bozeman', subtitle: 'Nov 2016', place: 'Bozeman',
      recipeKey: 'trip:1', coverAssetId: 'c1', featuredAssetIds: ['f1', 'f2'],
      assetCount: 42, addedThisWeek: 3, coverRatio: 1.5,
      timeFrom: '2016-11-20T00:46:46Z', timeTo: '2016-11-22T04:04:35Z', updatedAt: '',
    })
  })

  it('omitempty 缺席的字段兜底,不产生 undefined', async () => {
    listMoments.mockResolvedValue([{ id: 'm2', title: 'T', asset_count: 0, recipe_key: 'theme:food', featured_asset_ids: [], added_this_week: 0, cover_ratio: 0 }])
    const s = usePhotosMoments()
    await s.fetchMoments()
    expect(s.moments[0]).toMatchObject({ subtitle: '', place: '', coverAssetId: '', timeFrom: '', timeTo: '', updatedAt: '' })
  })

  it('id 一律 String 归一(后端若给数字 id 也不炸)', async () => {
    listMoments.mockResolvedValue([{ ...RAW, id: 7 }])
    const s = usePhotosMoments()
    await s.fetchMoments()
    expect(s.moments[0].id).toBe('7')
  })
})

describe('列表与 sizeMap', () => {
  it('sizeMap 跟着 moments 走,是 assignMomentSizes 的结果', async () => {
    listMoments.mockResolvedValue([RAW])
    const s = usePhotosMoments()
    await s.fetchMoments()
    expect(s.sizeMap.m1).toEqual({ size: 'standard', template: 'T1' })
  })

  it('fetchMoments 失败时保留旧列表并置 listLoaded,不把界面清空', async () => {
    listMoments.mockResolvedValueOnce([RAW])
    const s = usePhotosMoments()
    await s.fetchMoments()
    listMoments.mockRejectedValueOnce(new Error('boom'))
    await s.fetchMoments()
    expect(s.moments).toHaveLength(1)
    expect(s.listLoaded).toBe(true)
  })

  it('ensureLoaded 只拉一次;byId 在未加载时返回 undefined', async () => {
    listMoments.mockResolvedValue([RAW])
    const s = usePhotosMoments()
    expect(s.byId('m1')).toBeUndefined()
    await s.ensureLoaded()
    await s.ensureLoaded()
    expect(listMoments).toHaveBeenCalledTimes(1)
    expect(s.byId('m1')?.title).toBe('Bozeman')
  })
})

describe('排序', () => {
  it('reorder 乐观更新在前,成功后不回滚', async () => {
    listMoments.mockResolvedValue([RAW, { ...RAW, id: 'm2' }])
    reorderMoments.mockResolvedValue({})
    const s = usePhotosMoments()
    await s.fetchMoments()
    const ok = await s.reorder(['m2', 'm1'])
    expect(ok).toBe(true)
    expect(s.moments.map((m) => m.id)).toEqual(['m2', 'm1'])
    expect(reorderMoments).toHaveBeenCalledWith(['m2', 'm1'])
  })

  it('reorder 失败时重拉列表整体还原,并返回 false', async () => {
    listMoments.mockResolvedValue([RAW, { ...RAW, id: 'm2' }])
    reorderMoments.mockRejectedValue(new Error('nope'))
    const s = usePhotosMoments()
    await s.fetchMoments()
    const ok = await s.reorder(['m2', 'm1'])
    expect(ok).toBe(false)
    expect(s.moments.map((m) => m.id)).toEqual(['m1', 'm2'])
  })

  it('ids 与当前列表对不齐时保守放弃,不发请求也不丢条目', async () => {
    listMoments.mockResolvedValue([RAW, { ...RAW, id: 'm2' }])
    const s = usePhotosMoments()
    await s.fetchMoments()
    expect(await s.reorder(['m2'])).toBe(false)
    expect(await s.reorder(['m2', 'nope'])).toBe(false)
    expect(reorderMoments).not.toHaveBeenCalled()
    expect(s.moments.map((m) => m.id)).toEqual(['m1', 'm2'])
  })
})

describe('详情资产', () => {
  it('loadDetail 解 {assets,members,places} 并把 members 转驼峰', async () => {
    getMomentAssets.mockResolvedValue({
      assets: [{ id: 'a1', takenAt: '2016-11-20T00:00:00Z' }],
      members: [{ asset_id: 'a1', manual: true, featured: true }],
      places: [{ name: 'Bozeman', count: 323 }],
    })
    const s = usePhotosMoments()
    const d = await s.loadDetail('m1')
    expect(getMomentAssets).toHaveBeenCalledWith('m1', true, true)
    expect(d.members).toEqual([{ assetId: 'a1', manual: true, featured: true }])
    expect(d.places).toEqual([{ name: 'Bozeman', count: 323 }])
    expect(d.assets).toHaveLength(1)
  })

  it('loadDetail 容忍旧后端的裸数组形状(members/places 兜底空数组)', async () => {
    getMomentAssets.mockResolvedValue([{ id: 'a1' }])
    const s = usePhotosMoments()
    const d = await s.loadDetail('m1')
    expect(d.members).toEqual([])
    expect(d.places).toEqual([])
    expect(d.assets).toHaveLength(1)
  })

  it('loadAll 不带 featured/withMembers,返回展平的 Photo 数组', async () => {
    getMomentAssets.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }])
    const s = usePhotosMoments()
    const list = await s.loadAll('m1')
    expect(getMomentAssets).toHaveBeenCalledWith('m1', false, false)
    expect(list).toHaveLength(2)
  })
})

describe('写操作', () => {
  it('pin 成功后把返回的 asset_count 写回列表项', async () => {
    listMoments.mockResolvedValue([RAW])
    pinMomentAssets.mockResolvedValue({ ok: true, asset_count: 50 })
    const s = usePhotosMoments()
    await s.fetchMoments()
    expect(await s.pin('m1', ['x'])).toBe(50)
    expect(s.byId('m1')?.assetCount).toBe(50)
  })

  it('exclude 同理', async () => {
    listMoments.mockResolvedValue([RAW])
    excludeMomentAssets.mockResolvedValue({ ok: true, asset_count: 41 })
    const s = usePhotosMoments()
    await s.fetchMoments()
    expect(await s.exclude('m1', ['x'])).toBe(41)
    expect(s.byId('m1')?.assetCount).toBe(41)
  })

  it('后端没回 asset_count 时保持原值,不写入 undefined', async () => {
    listMoments.mockResolvedValue([RAW])
    pinMomentAssets.mockResolvedValue({ ok: true })
    const s = usePhotosMoments()
    await s.fetchMoments()
    expect(await s.pin('m1', ['x'])).toBeNull()
    expect(s.byId('m1')?.assetCount).toBe(42)
  })

  it('remove 成功后把该条从列表摘掉,sizeMap 随之重算', async () => {
    listMoments.mockResolvedValue([RAW, { ...RAW, id: 'm2' }])
    deleteMoment.mockResolvedValue({})
    const s = usePhotosMoments()
    await s.fetchMoments()
    await s.remove('m1')
    expect(s.moments.map((m) => m.id)).toEqual(['m2'])
    expect(s.sizeMap.m1).toBeUndefined()
  })

  it('remove 失败时抛出且不动列表', async () => {
    listMoments.mockResolvedValue([RAW])
    deleteMoment.mockRejectedValue(new Error('nope'))
    const s = usePhotosMoments()
    await s.fetchMoments()
    await expect(s.remove('m1')).rejects.toThrow()
    expect(s.moments).toHaveLength(1)
  })

  it('exportAlbum 原样上抛 {albumId,name,count}', async () => {
    exportMomentAlbum.mockResolvedValue({ albumId: 'al1', name: 'Bozeman', count: 42 })
    const s = usePhotosMoments()
    expect(await s.exportAlbum('m1')).toEqual({ albumId: 'al1', name: 'Bozeman', count: 42 })
  })
})

describe('并发过期守卫', () => {
  it('两次 fetchMoments 交错返回时,后发的赢(先发的迟到结果被丢弃)', async () => {
    let resolveA: (v: unknown) => void = () => {}
    listMoments.mockImplementationOnce(() => new Promise((r) => { resolveA = r }))
    listMoments.mockResolvedValueOnce([{ ...RAW, id: 'second' }])

    const s = usePhotosMoments()
    const pA = s.fetchMoments()   // 先发,挂起
    const pB = s.fetchMoments()   // 后发,立刻返回
    await pB
    resolveA([{ ...RAW, id: 'first' }])  // 先发的迟到
    await pA

    expect(s.moments.map((m) => m.id)).toEqual(['second'])
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/photos/stores/__tests__/moments.test.ts --reporter=verbose`
Expected: FAIL —— 找不到模块 `../moments`

- [ ] **Step 3: 实现**

新建 `src/photos/stores/moments.ts`：

```ts
// SP15-P1-T3: Moments store。
// 移植自 Vue2 NimoOS-UI 899af59b:src/views/Photos/PhotosSmartViewsView.vue:553-624
// (fetchMoments/persistMomentsOrder/onMomentDeleted/onMomentAssetCountChanged)与
// PhotosMomentDetail.vue:307-338(loadFeatured/loadAll)。
// 后端契约回源核对 NimoOS-Photos/route/v1/moments.go:39-73 momentResponse。
//
// 与 Vue2 的两处刻意差异(逐条登记):
//  1) Vue2 把列表状态放在视图组件里、把详情资产放在详情组件里,两边各自维护一份
//     asset_count 并靠 $emit('asset-count-changed') 手工同步。这里收进一个 store:
//     详情页写完直接调 applyAssetCount,列表项就是同一份数据,不存在同步这回事。
//  2) fetchMoments 带 epoch 过期守卫(Global Constraints §6)。Vue2 没有——它的
//     fetchMoments 只在 mounted 调一次,撞不上;New-UI 详情页返回列表会再拉一次,
//     两次交错时迟到的响应会覆盖新数据。
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { service } from '@nimotech/nimoos-service'
import { assetToPhoto, type Photo } from '../util/assetToPhoto'
import { assignMomentSizes, type MomentSize, type MomentTemplate } from '../util/momentLayout'

export interface Moment {
  id: string
  title: string
  subtitle: string
  place: string
  recipeKey: string
  coverAssetId: string
  featuredAssetIds: string[]
  assetCount: number
  addedThisWeek: number
  /** 封面宽高比 w/h;后端约定 0 = 未知。 */
  coverRatio: number
  timeFrom: string
  timeTo: string
  /** ⚠️ 后端 momentResponse **不含** updated_at,这里恒为空串;详情页据此渲染 '—'。
   *  保留字段是为后端将来补上时无需改类型,不是当下有数据。 */
  updatedAt: string
}

export interface MomentMember { assetId: string; manual: boolean; featured: boolean }
export interface MomentPlace { name: string; count: number }
export interface MomentDetailAssets { assets: Photo[]; members: MomentMember[]; places: MomentPlace[] }

interface RawMoment {
  id?: unknown; title?: unknown; subtitle?: unknown; place?: unknown
  recipe_key?: unknown; cover_asset_id?: unknown; featured_asset_ids?: unknown
  asset_count?: unknown; added_this_week?: unknown; cover_ratio?: unknown
  time_from?: unknown; time_to?: unknown; updated_at?: unknown
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

function toMoment(raw: RawMoment): Moment {
  return {
    id: str(raw.id),
    title: str(raw.title),
    subtitle: str(raw.subtitle),
    place: str(raw.place),
    recipeKey: str(raw.recipe_key),
    coverAssetId: str(raw.cover_asset_id),
    featuredAssetIds: Array.isArray(raw.featured_asset_ids) ? raw.featured_asset_ids.map(str) : [],
    assetCount: num(raw.asset_count),
    addedThisWeek: num(raw.added_this_week),
    coverRatio: num(raw.cover_ratio),
    timeFrom: str(raw.time_from),
    timeTo: str(raw.time_to),
    updatedAt: str(raw.updated_at),
  }
}

export const usePhotosMoments = defineStore('photosMoments', () => {
  const moments = ref<Moment[]>([])
  const listLoading = ref(false)
  const listLoaded = ref(false)
  // 过期守卫:每次 fetchMoments 自增,只有最新那一发的响应才准写 moments。
  let fetchEpoch = 0

  const sizeMap = computed(() =>
    assignMomentSizes(
      moments.value.map((m) => ({
        id: m.id, recipeKey: m.recipeKey, assetCount: m.assetCount,
        coverRatio: m.coverRatio, featuredAssetIds: m.featuredAssetIds,
      })),
    ) as Record<string, { size: MomentSize; template: MomentTemplate }>,
  )

  function byId(id: string): Moment | undefined {
    return moments.value.find((m) => m.id === String(id))
  }

  async function fetchMoments(): Promise<void> {
    const epoch = ++fetchEpoch
    listLoading.value = true
    try {
      const raw = await service.photos.listMoments()
      if (epoch !== fetchEpoch) return          // 迟到的响应,丢弃
      moments.value = (raw as RawMoment[]).map(toMoment)
    } catch (e) {
      // 失败保留旧列表(Vue2 同样只 console.error 不清空)——把界面清空会让一次网络
      // 抖动看起来像"时刻全没了"。
      console.error('[photos-moments] listMoments', e)
    } finally {
      if (epoch === fetchEpoch) {
        listLoading.value = false
        listLoaded.value = true
      }
    }
  }

  async function ensureLoaded(): Promise<void> {
    if (listLoaded.value || listLoading.value) return
    await fetchMoments()
  }

  /** 只改本地顺序,不发请求 —— 供 reorder 内部与测试使用。 */
  function setOrder(ids: string[]): boolean {
    const byIdMap = new Map(moments.value.map((m) => [m.id, m]))
    const next = ids.map((id) => byIdMap.get(id)).filter((m): m is Moment => m != null)
    if (next.length !== moments.value.length) return false  // 对不齐时保守放弃,避免丢条目
    moments.value = next
    return true
  }

  async function reorder(ids: string[]): Promise<boolean> {
    if (!setOrder(ids)) return false
    try {
      await service.photos.reorderMoments(ids)
      return true
    } catch (e) {
      console.error('[photos-moments] reorderMoments', e)
      await fetchMoments()   // 整体还原为服务端顺序
      return false
    }
  }

  async function loadDetail(id: string): Promise<MomentDetailAssets> {
    const data = await service.photos.getMomentAssets(String(id), true, true)
    // 旧后端(或部署窗口期)返回裸数组;两种形状都要能收。
    if (Array.isArray(data)) {
      return { assets: data.map(assetToPhoto), members: [], places: [] }
    }
    const d = (data ?? {}) as { assets?: unknown[]; members?: unknown[]; places?: unknown[] }
    return {
      assets: (d.assets ?? []).map(assetToPhoto),
      members: (d.members ?? []).map((m) => {
        const r = m as { asset_id?: unknown; manual?: unknown; featured?: unknown }
        return { assetId: str(r.asset_id), manual: !!r.manual, featured: !!r.featured }
      }),
      places: (d.places ?? []).map((p) => {
        const r = p as { name?: unknown; count?: unknown }
        return { name: str(r.name), count: num(r.count) }
      }),
    }
  }

  async function loadAll(id: string): Promise<Photo[]> {
    const data = await service.photos.getMomentAssets(String(id), false, false)
    return (Array.isArray(data) ? data : []).map(assetToPhoto)
  }

  /** 把最新张数写回列表项;后端没回 asset_count 时保持原值。 */
  function applyAssetCount(id: string, count: number | null | undefined): void {
    if (count == null) return
    const m = byId(id)
    if (m) m.assetCount = count
  }

  async function pin(id: string, assetIds: string[]): Promise<number | null> {
    const res = await service.photos.pinMomentAssets(String(id), assetIds)
    const count = typeof res.asset_count === 'number' ? res.asset_count : null
    applyAssetCount(id, count)
    return count
  }

  async function exclude(id: string, assetIds: string[]): Promise<number | null> {
    const res = await service.photos.excludeMomentAssets(String(id), assetIds)
    const count = typeof res.asset_count === 'number' ? res.asset_count : null
    applyAssetCount(id, count)
    return count
  }

  async function remove(id: string): Promise<void> {
    await service.photos.deleteMoment(String(id))
    moments.value = moments.value.filter((m) => m.id !== String(id))
  }

  async function exportAlbum(id: string): Promise<{ albumId?: string; name?: string; count?: number }> {
    return await service.photos.exportMomentAlbum(String(id))
  }

  return {
    moments, listLoading, listLoaded, sizeMap,
    fetchMoments, ensureLoaded, byId, setOrder, reorder,
    loadDetail, loadAll, pin, exclude, remove, exportAlbum, applyAssetCount,
  }
})
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/photos/stores/__tests__/moments.test.ts --reporter=verbose`
Expected: PASS，18 个用例

- [ ] **Step 5: 提交**

```bash
git add src/photos/stores/moments.ts src/photos/stores/__tests__/moments.test.ts
git commit -m "feat(photos): add the moments store

Vue 2 spread this state across two components and kept their asset counts in
sync by hand, through an asset-count-changed event. Folding it into one store
removes the synchronisation problem rather than reimplementing it.

fetchMoments carries a staleness epoch that Vue 2 does not need: it only ever
fetched once on mount, whereas the routed detail page here refetches on the way
back to the list, so two overlapping calls are reachable and a late response
would otherwise clobber the newer one."
```

---

