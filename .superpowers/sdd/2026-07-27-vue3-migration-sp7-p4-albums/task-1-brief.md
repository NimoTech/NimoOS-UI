### Task 1: `albumView.ts` 纯函数(映射 + 两套排序)

**Files:**
- Create: `src/photos/util/albumView.ts`
- Test: `src/photos/util/__tests__/albumView.test.ts`

**Interfaces:**
- Consumes:`Photo`(`src/photos/util/assetToPhoto.ts:264`,含 `takenAt` / `indexedAt` 字段,`:270-271`)。
- Produces(T2/T7/T8 消费):

```ts
export interface AlbumView {
  id: string | number
  title: string
  cover: string | number | null   // = coverAssetId,资产 id 而非 URL
  count: number
  dateRange: string               // formatAlbumSpan 结果,无法解析时 ''
  createdAt: string | null
  dateEnd: string | null          // 供 sortAlbums 的 'date' 分支用
}

export function albumToView(a: Record<string, unknown>, untitled: string): AlbumView
export function formatAlbumSpan(startRaw: unknown, endRaw: unknown): string
export function sortAlbums(list: AlbumView[], sort: string): AlbumView[]   // 返回新数组,不原地改
export function sortAlbumPhotos(photos: Photo[], sortBy: string): Photo[]  // 返回新数组('manual' 原样返回同一引用可,但统一返回新数组更安全)
```

- **`albumToView` 逐字段(照 Vue2 `PhotosAlbumsView.vue:216-224` 的 `userAlbums` computed)**:
  - `id: a.id`
  - `title: a.name || a.title || untitled`(后端字段是 `name`,`title` 只是兜底;`untitled` 由调用方传 `t('photosAlbumUntitled')`,**纯函数不依赖 i18n**)
  - `cover: a.coverAssetId ?? null`
  - `count: a.assetCount != null ? a.assetCount : ((a.assets && a.assets.length) || 0)`
  - `dateRange: formatAlbumSpan(a.dateStart, a.dateEnd)`
  - `createdAt: a.createdAt || null`
  - `dateEnd: a.dateEnd || null`(P4 新增字段,供排序;Vue2 的 view 对象里没有,但 `dateEnd` 在原始对象上)
  - Vue2 的 `kind: 'user'` 不迁(共享相册分区不做,见范围收口)。
- **`formatAlbumSpan`**:**逐字符照抄** Vue2 `PhotosAlbumsView.vue:282-301`(含 `parseYearMonth` 内联为模块私有函数)。规则:正则 `/^(\d{4})-(\d{2})/` 抽 `{year, month}`(不依赖 `Date` 解析);任一端解析失败 → `''`;跨年 → `` `${a.year}-${b.year}` ``;同年同月 → `` `${MONTHS[a.month-1]} ${a.year}` ``;同年跨月 → `` `${MONTHS[a.month-1]} - ${MONTHS[b.month-1]} ${a.year}` ``。**`MONTHS` 是三字母缩写数组** `['Jan','Feb',…,'Dec']`(**注意与 `assetToPhoto.ts:6` / `groupPhotosByMonth.ts:11` 的全称 `MONTH_NAMES` 不是同一个**,不要复用错)。
- **`sortAlbums(list, sort)`**:`name` → `a.title.localeCompare(b.title)`;`name-r` → `b.title.localeCompare(a.title)`;`count` → `b.count - a.count`;`created` → `ts(b) - ts(a)`(`ts(x)` = `x.createdAt ? Date.parse(x.createdAt) : NaN`,`isNaN → 0`,逐字照抄 Vue2 `:361-364` 的 `ts` 辅助);`date` → 同款 `ts` 但取 `dateEnd`;**其它值(含 `updated`)→ 原序返回**。**必须返回新数组**(Vue2 `applySort` 原地 `arr.sort()` 改的是 computed 里刚 map 出来的临时数组,New-UI 里若原地排会污染 store 数据)。
- **`sortAlbumPhotos(photos, sortBy)`**:照抄 Vue2 `PhotosAlbumDetail.vue:224-242`。`taken` → 按 `Date.parse(takenAt)` 降序(缺失记 0);`added` → 按 `Date.parse(indexedAt)` 降序(缺失记 0);其它(含 `manual`)→ 原序。

- [ ] **Step 1: 写失败测试 — `albumView.test.ts`**
```ts
import { describe, it, expect } from 'vitest'
import { albumToView, formatAlbumSpan, sortAlbums, sortAlbumPhotos } from '../albumView'

describe('formatAlbumSpan', () => {
  it('同年同月 → "May 2026"', () => { expect(formatAlbumSpan('2026-05-02', '2026-05-20')).toBe('May 2026') })
  it('同年跨月 → "Jun - Dec 2025"', () => { expect(formatAlbumSpan('2025-06-03', '2025-12-31')).toBe('Jun - Dec 2025') })
  it('跨年 → "2023-2025"', () => { expect(formatAlbumSpan('2023-01-01', '2025-08-09')).toBe('2023-2025') })
  it('缺任一端或非法格式 → 空串', () => {
    expect(formatAlbumSpan(null, '2025-01-01')).toBe('')
    expect(formatAlbumSpan('2025-01-01', undefined)).toBe('')
    expect(formatAlbumSpan('bad', 'bad')).toBe('')
  })
  it('带时间的 RFC3339 也能解析(不依赖 Date)', () => {
    expect(formatAlbumSpan('2026-05-02T10:00:00Z', '2026-05-20T23:59:59Z')).toBe('May 2026')
  })
})

describe('albumToView', () => {
  it('映射后端字段(name/coverAssetId/assetCount/dateStart..dateEnd)', () => {
    const v = albumToView({ id: 7, name: '旅行', coverAssetId: 'a1', assetCount: 12, dateStart: '2025-06-01', dateEnd: '2025-06-30', createdAt: '2025-07-01T00:00:00Z' }, '未命名')
    expect(v).toMatchObject({ id: 7, title: '旅行', cover: 'a1', count: 12, dateRange: 'Jun 2025', createdAt: '2025-07-01T00:00:00Z', dateEnd: '2025-06-30' })
  })
  it('无 name 用 title 兜底,再无则用传入的 untitled', () => {
    expect(albumToView({ id: 1, title: 'T' }, '未命名').title).toBe('T')
    expect(albumToView({ id: 1 }, '未命名').title).toBe('未命名')
  })
  it('assetCount 缺失时回退 assets.length,再缺回 0', () => {
    expect(albumToView({ id: 1, assets: [{}, {}] }, 'x').count).toBe(2)
    expect(albumToView({ id: 1 }, 'x').count).toBe(0)
  })
  it('coverAssetId 缺失 → null', () => { expect(albumToView({ id: 1 }, 'x').cover).toBeNull() })
})

describe('sortAlbums', () => {
  const V = (id: string, title: string, count: number, createdAt: string | null, dateEnd: string | null) =>
    ({ id, title, count, createdAt, dateEnd, cover: null, dateRange: '' })
  const list = [V('a', 'Beta', 3, '2025-01-01', '2024-05-01'), V('b', 'Alpha', 9, '2026-01-01', '2026-09-01'), V('c', 'Gamma', 1, null, null)]

  it('name 正序 / name-r 逆序', () => {
    expect(sortAlbums(list, 'name').map((x) => x.title)).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(sortAlbums(list, 'name-r').map((x) => x.title)).toEqual(['Gamma', 'Beta', 'Alpha'])
  })
  it('count 降序', () => { expect(sortAlbums(list, 'count').map((x) => x.id)).toEqual(['b', 'a', 'c']) })
  it('created 按 createdAt 降序,缺失记 0 排最后', () => { expect(sortAlbums(list, 'created').map((x) => x.id)).toEqual(['b', 'a', 'c']) })
  it('date 按 dateEnd 降序(不是 createdAt),缺失排最后', () => { expect(sortAlbums(list, 'date').map((x) => x.id)).toEqual(['b', 'a', 'c']) })
  it('updated / 未知值 → 原序', () => {
    expect(sortAlbums(list, 'updated').map((x) => x.id)).toEqual(['a', 'b', 'c'])
    expect(sortAlbums(list, 'zzz').map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })
  it('不原地修改入参数组', () => {
    const src = [...list]
    sortAlbums(src, 'name')
    expect(src.map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('sortAlbumPhotos', () => {
  const P = (id: string, takenAt: string | null, indexedAt: string | null) => ({ id, takenAt, indexedAt } as never)
  const ps = [P('a', '2024-01-01', '2026-01-01'), P('b', '2026-01-01', '2024-01-01'), P('c', null, null)]
  it('taken 按 takenAt 降序', () => { expect(sortAlbumPhotos(ps, 'taken').map((p) => p.id)).toEqual(['b', 'a', 'c']) })
  it('added 按 indexedAt 降序', () => { expect(sortAlbumPhotos(ps, 'added').map((p) => p.id)).toEqual(['a', 'b', 'c']) })
  it('manual 原序', () => { expect(sortAlbumPhotos(ps, 'manual').map((p) => p.id)).toEqual(['a', 'b', 'c']) })
})
```
- [ ] **Step 2: RED** — `pnpm vitest run src/photos/util/__tests__/albumView.test.ts` 全红(模块不存在)。
- [ ] **Step 3: 实现** — 实现前**打开 Vue2 源逐字符比对**(`PhotosAlbumsView.vue:282-301,216-224,359-370`、`PhotosAlbumDetail.vue:224-242`);P2 Task 1 的教训:保真移植的守卫条件(`<` / `!==` / falsy vs `> 0`)极易被「看起来等价」放过,**比 Vue2 源,不要比本计划的快照**。三处刻意偏离(`created` 补实现、`date` 改 `dateEnd`、返回新数组)各写一行注释登记。
- [ ] **Step 4: GREEN + 全量 + tsc**。
- [ ] **Step 5: Commit** — `feat(photos): 相册视图映射与排序纯函数(albumToView/formatAlbumSpan/sortAlbums/sortAlbumPhotos)`

---

