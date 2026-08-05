### Task 1: `photosFavorites` Pinia store + `groupPhotosByMonth` 纯函数

**Files:**
- Create: `src/photos/stores/favorites.ts`
- Create: `src/photos/util/groupPhotosByMonth.ts`
- Test: `src/photos/stores/__tests__/favorites.test.ts`、`src/photos/util/__tests__/groupPhotosByMonth.test.ts`

**Interfaces:**
- Consumes:`service.photos.listFavoriteIds()`(裸数组,`?? []`)、`listFavorites(limit=0,offset=0)`(裸数组,`?? []`)、`favorite(id)`/`unfavorite(id)`、`recordView(id)`、`exportFavoritesUrl(): string`;`assetToPhoto`(`src/photos/util/assetToPhoto.ts:311`)、`Photo`/`Month`(`assetToPhoto.ts:264,399`)、`MONTH_NAMES`(在 `assetToPhoto.ts`,若未 export 则本任务加 `export`)。
- Produces(T4/T5/T8 消费,Pinia setup store,`defineStore('photosFavorites', () => {...})`):
  - state:`favIds: Ref<Set<string>>`、`favoritesList: Ref<Photo[] | null>`(null=未加载)、`favoritesLoaded: Ref<boolean>`、`favIdsLoaded: Ref<boolean>`;**非响应式** `const _viewTs = new Map<string, number>()`(节流时间戳,**不用 ref**——照 Vue2 `state._viewReportTs` 非响应式,避免无谓渲染)。
  - getters:`isFav(id: string | number): boolean`(`favIds.value.has(String(id))`——**方法式 getter**,供逐 tile 调用)、`favoritesMonths: ComputedRef<Month[]>`(`groupPhotosByMonth(favoritesList.value ?? [])`)。
  - actions:`reconcileFavIds(): Promise<void>`、`fetchFavorites(): Promise<void>`、`toggle(id: string | number): Promise<void>`、`recordView(id: string | number): void`、`exportZip(): void`、`__resetForTest(): void`。
- `groupPhotosByMonth(photos: Photo[]): Month[]` —— 按 `photo.takenAt` 的 `YYYY-MM` 分组,组按 key **降序**(新月在前),无/非法 `takenAt` 归 `key='unknown'`/`title='Unknown Date'` 组排最后;每组 `{ key, title, loc: '', photos }`,组内保持传入顺序。title 用 `MONTH_NAMES[m-1] + ' ' + year`(与 `groupToMonth` 一致)。

- [ ] **Step 1: 写失败测试 — `groupPhotosByMonth.test.ts`**
```ts
import { describe, it, expect } from 'vitest'
import { groupPhotosByMonth } from '../groupPhotosByMonth'
const P = (id: string, takenAt: string | null) => ({ id, takenAt, isVideo: false } as any)

describe('groupPhotosByMonth', () => {
  it('按月分组、组降序(新月在前)、组内保序', () => {
    const out = groupPhotosByMonth([
      P('a', '2026-03-10T00:00:00Z'),
      P('b', '2026-05-02T00:00:00Z'),
      P('c', '2026-05-20T00:00:00Z'),
    ])
    expect(out.map((m) => m.key)).toEqual(['2026-05', '2026-03'])
    expect(out[0].photos.map((p) => p.id)).toEqual(['b', 'c'])
    expect(out[0].title).toBe('May 2026')
  })
  it('缺/非法 takenAt 归 unknown 组并排最后', () => {
    const out = groupPhotosByMonth([P('x', null), P('y', '2026-01-01T00:00:00Z')])
    expect(out.map((m) => m.key)).toEqual(['2026-01', 'unknown'])
    expect(out[1].title).toBe('Unknown Date')
  })
  it('空列表返回空数组', () => {
    expect(groupPhotosByMonth([])).toEqual([])
  })
})
```

- [ ] **Step 2: 写失败测试 — `favorites.test.ts`**(`setActivePinia(createPinia())`,mock 共享包)
```ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
vi.mock('@nimotech/nimoos-service', () => ({
  service: { photos: {
    listFavoriteIds: vi.fn(() => Promise.resolve(['a', 'b'])),
    listFavorites: vi.fn(() => Promise.resolve([{ id: 'a', takenAt: '2026-05-01T00:00:00Z' }])),
    favorite: vi.fn(() => Promise.resolve()),
    unfavorite: vi.fn(() => Promise.resolve()),
    recordView: vi.fn(() => Promise.resolve()),
    exportFavoritesUrl: vi.fn(() => '/v1/photos/favorites/export?token=T1'),
  } },
}))
import { service } from '@nimotech/nimoos-service'
import { usePhotosFavorites } from '../favorites'

describe('photosFavorites store', () => {
  beforeEach(() => { setActivePinia(createPinia()) })
  afterEach(() => vi.restoreAllMocks())

  it('reconcileFavIds 播种 favIds(String 归一)、isFav 按值比较', async () => {
    const s = usePhotosFavorites()
    await s.reconcileFavIds()
    expect(s.isFav('a')).toBe(true)
    expect(s.isFav('zzz')).toBe(false)
  })
  it('reconcileFavIds 容忍 null(?? [])', async () => {
    ;(service.photos.listFavoriteIds as any).mockResolvedValueOnce(null)
    const s = usePhotosFavorites()
    await s.reconcileFavIds()
    expect(s.favIds.size).toBe(0)
  })
  it('toggle 乐观翻转 + 成功后失效 favoritesList', async () => {
    const s = usePhotosFavorites()
    await s.fetchFavorites()
    expect(s.favoritesLoaded).toBe(true)
    await s.toggle('a')
    expect(s.isFav('a')).toBe(true)
    expect(service.photos.favorite).toHaveBeenCalledWith('a')
    expect(s.favoritesLoaded).toBe(false) // 失效,下次重取
  })
  it('toggle 失败回滚', async () => {
    ;(service.photos.favorite as any).mockRejectedValueOnce(new Error('x'))
    const s = usePhotosFavorites()
    await s.toggle('new1')
    expect(s.isFav('new1')).toBe(false) // 回滚
  })
  it('recordView 60s 节流:窗口内同 id 只上报一次', () => {
    vi.useFakeTimers(); vi.setSystemTime(0)
    const s = usePhotosFavorites()
    s.recordView('a'); s.recordView('a')
    expect(service.photos.recordView).toHaveBeenCalledTimes(1)
    vi.setSystemTime(60_001)
    s.recordView('a')
    expect(service.photos.recordView).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
  it('fetchFavorites 映射 assetToPhoto + favoritesMonths 分组', async () => {
    const s = usePhotosFavorites()
    await s.fetchFavorites()
    expect(s.favoritesList?.length).toBe(1)
    expect(s.favoritesMonths[0].key).toBe('2026-05')
  })
  it('exportZip 走 exportFavoritesUrl', () => {
    const s = usePhotosFavorites()
    s.exportZip()
    expect(service.photos.exportFavoritesUrl).toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: RED** — `pnpm vitest run src/photos/stores/__tests__/favorites.test.ts src/photos/util/__tests__/groupPhotosByMonth.test.ts` 失败(模块不存在)。

- [ ] **Step 4: 实现 `groupPhotosByMonth.ts`**
```ts
import { assetToPhoto, groupToMonth, type Photo, type Month } from './assetToPhoto'
// 复用 groupToMonth 的 title 规则:先把扁平 Photo[] 分桶为 {year,month} 再走它,
// 但 groupToMonth 会对 assets 再跑一次 assetToPhoto——所以本函数自己拼 title,不复用 groupToMonth 主体。
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

export function groupPhotosByMonth(photos: Photo[]): Month[] {
  const buckets = new Map<string, Photo[]>()
  for (const p of photos) {
    const t = p.takenAt
    const d = t != null ? new Date(t) : null
    const valid = d != null && !Number.isNaN(d.getTime())
    const key = valid ? `${d!.getFullYear()}-${String(d!.getMonth() + 1).padStart(2, '0')}` : 'unknown'
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(p)
  }
  const keys = [...buckets.keys()].sort((a, b) => {
    if (a === 'unknown') return 1
    if (b === 'unknown') return -1
    return a < b ? 1 : a > b ? -1 : 0 // 降序
  })
  return keys.map((key) => {
    let title = 'Unknown Date'
    if (key !== 'unknown') {
      const [y, m] = key.split('-')
      title = `${MONTH_NAMES[Number(m) - 1]} ${y}`
    }
    return { key, title, loc: '', photos: buckets.get(key)! }
  })
}
```
> 注:`assetToPhoto`/`groupToMonth` import 仅为类型与规则对齐参考;若 lint 报未使用,去掉 runtime import 只留 `import type { Photo, Month }`。**MONTH_NAMES 与 `assetToPhoto.ts` 内保持一致**(该文件若已 export MONTH_NAMES 则直接引,不重复定义)。

- [ ] **Step 5: 实现 `favorites.ts`**（乐观回滚忠于 Vue2 `store/modules/photos.js:743-755`;节流忠于 `:727-734` `VIEW_THROTTLE_MS=60000`）
```ts
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { service } from '@nimotech/nimoos-service'
import { assetToPhoto, type Photo, type Month } from '../util/assetToPhoto'
import { groupPhotosByMonth } from '../util/groupPhotosByMonth'

const VIEW_THROTTLE_MS = 60_000

export const usePhotosFavorites = defineStore('photosFavorites', () => {
  const favIds = ref<Set<string>>(new Set())
  const favIdsLoaded = ref(false)
  const favoritesList = ref<Photo[] | null>(null)
  const favoritesLoaded = ref(false)
  const _viewTs = new Map<string, number>() // 非响应式:节流簿,不触发渲染

  function isFav(id: string | number): boolean {
    return favIds.value.has(String(id))
  }
  const favoritesMonths = computed<Month[]>(() => groupPhotosByMonth(favoritesList.value ?? []))

  async function reconcileFavIds(): Promise<void> {
    try {
      const ids = await service.photos.listFavoriteIds()
      favIds.value = new Set(((ids as unknown[]) ?? []).map((v) => String(v)))
      favIdsLoaded.value = true
    } catch { /* leave as-is */ }
  }

  async function fetchFavorites(): Promise<void> {
    try {
      const list = (await service.photos.listFavorites()) as unknown[]
      favoritesList.value = (list ?? []).map((a) => assetToPhoto(a as Record<string, unknown>))
    } catch {
      favoritesList.value = []
    }
    favoritesLoaded.value = true
  }

  // 单项乐观翻转 + 失败回滚(忠于 Vue2 toggleFav:再次翻转回滚,不是快照恢复)
  async function toggle(id: string | number): Promise<void> {
    const key = String(id)
    const wasFav = favIds.value.has(key)
    const flipped = new Set(favIds.value)
    if (wasFav) flipped.delete(key)
    else flipped.add(key)
    favIds.value = flipped
    try {
      if (wasFav) await service.photos.unfavorite(id)
      else await service.photos.favorite(id)
      favoritesLoaded.value = false // INVALIDATE_FAVORITES_LIST:标记失效,下次进视图重取
    } catch {
      const rollback = new Set(favIds.value)
      if (wasFav) rollback.add(key)
      else rollback.delete(key)
      favIds.value = rollback
    }
  }

  function recordView(id: string | number): void {
    if (id == null) return
    const key = String(id)
    const now = Date.now()
    const last = _viewTs.has(key) ? (_viewTs.get(key) as number) : -Infinity
    if (now - last < VIEW_THROTTLE_MS) return
    _viewTs.set(key, now)
    void service.photos.recordView(id).then(undefined, () => {})
  }

  function exportZip(): void {
    const url = service.photos.exportFavoritesUrl()
    if (typeof window !== 'undefined') window.location.href = url
  }

  function __resetForTest(): void {
    favIds.value = new Set()
    favIdsLoaded.value = false
    favoritesList.value = null
    favoritesLoaded.value = false
    _viewTs.clear()
  }

  return {
    favIds, favIdsLoaded, favoritesList, favoritesLoaded,
    isFav, favoritesMonths,
    reconcileFavIds, fetchFavorites, toggle, recordView, exportZip, __resetForTest,
  }
})
```
> `Date.now()` 在生产走真实时钟,测试用 `vi.useFakeTimers()+setSystemTime` 控制(见测试)。`exportZip` 的 `window.location.href` 赋值 jsdom 会 warn 不 fail,测试只断言 `exportFavoritesUrl` 被调。

- [ ] **Step 6: GREEN + 全量 + tsc** — 两测试全过;`pnpm test` 全绿;`pnpm exec vue-tsc --noEmit` 干净。
- [ ] **Step 7: Commit** — `feat(photos): photosFavorites store + groupPhotosByMonth 纯函数(P3 收藏基础)`

---

