### Task 1: `photosFilterUtils.ts` 纯函数谓词

**Files:**
- Create: `src/photos/util/photosFilterUtils.ts`
- Test: `src/photos/util/__tests__/photosFilterUtils.test.ts`

**Interfaces:**
- Consumes: `Photo` 类型(`src/photos/util/assetToPhoto.ts:267`,只用其 `date`/`place`/`camera` 三个字段,结构上兼容本任务定义的 `FilterablePhoto`)。
- Produces: `FilterablePhoto` / `ExifFilters` 两个类型 + `photoYear` / `matchesExifFilters` / `applyExifFilters` 三个函数(签名见上方「接口总览」)。T2 用 `photoYear` + `FilterablePhoto`;T4/T5 用 `applyExifFilters` + `ExifFilters`。

**背景(实现者必读)**:`Photo.date` 不是 ISO 串,是 `assetToPhoto` 用 `toLocaleDateString('en', { year:'numeric', month:'long', day:'numeric' })` 生成的本地化串,形如 `"May 1, 2023"`(`assetToPhoto.ts:336`)。Vue2 同源同形态,所以 `new Date(photo.date).getFullYear()` 这个写法可以照抄,**不要**擅自改成读 `takenAt`(那是另一个字段,行为会变)。

- [ ] **Step 1: 写失败的测试**

创建 `src/photos/util/__tests__/photosFilterUtils.test.ts`:

```ts
// SP7-P7b-T1: EXIF 过滤谓词。
// 移植自 Vue2 NimoOS-UI tests/photosFilterUtils.test.js(58 行),按 D17/F2 裁掉
// 「excludes archived ids」一条(归档六环在 Vue2 已全死、New-UI 未迁),另加 F1 回归。
import { describe, expect, it } from 'vitest'
import { applyExifFilters, matchesExifFilters, photoYear } from '../photosFilterUtils'

// 用本地化日期串(与 assetToPhoto 产出的 `date` 同形态),这样 getFullYear() 返回的
// 是名义年份,不受测试机时区影响。
const p = (over: Record<string, unknown> = {}) => ({
  id: 'x', date: 'May 1, 2023', place: 'Tokyo, Japan', camera: 'Sony A7 · 35mm', ...over,
})

describe('photosFilterUtils', () => {
  it('photoYear 取出年份,无日期时返回空串', () => {
    expect(photoYear(p())).toBe('2023')
    expect(photoYear(p({ date: '' }))).toBe('')
  })

  it('photoYear 对 Invalid Date 返回空串', () => {
    expect(photoYear({ date: 'not-a-date' })).toBe('')
  })

  it('photoYear 对 null/undefined 返回空串', () => {
    expect(photoYear(null)).toBe('')
    expect(photoYear(undefined)).toBe('')
  })

  it('未设任何筛选时全部通过', () => {
    expect(matchesExifFilters(p(), {})).toBe(true)
    expect(matchesExifFilters(p())).toBe(true)
  })

  it('按年份 / 城市名段 / 机身名段过滤', () => {
    expect(matchesExifFilters(p(), { years: ['2023'] })).toBe(true)
    expect(matchesExifFilters(p(), { years: ['2024'] })).toBe(false)
    expect(matchesExifFilters(p(), { places: ['Tokyo'] })).toBe(true)
    expect(matchesExifFilters(p(), { places: ['Osaka'] })).toBe(false)
    expect(matchesExifFilters(p(), { cameras: ['Sony A7'] })).toBe(true)
    expect(matchesExifFilters(p(), { cameras: ['Canon'] })).toBe(false)
  })

  it('多个维度同时生效时是 AND 语义', () => {
    expect(matchesExifFilters(p(), { years: ['2023'], places: ['Osaka'] })).toBe(false)
    expect(matchesExifFilters(p(), { years: ['2023'], places: ['Tokyo'] })).toBe(true)
    expect(matchesExifFilters(p(), { years: ['2022'], places: ['Tokyo'] })).toBe(false)
  })

  it('无日期的照片只在年份筛选生效时才被排除', () => {
    expect(matchesExifFilters(p({ date: '' }), {})).toBe(true)
    expect(matchesExifFilters(p({ date: '' }), { years: ['2023'] })).toBe(false)
  })

  it('place/camera 为 null 时按空串参与匹配,不抛错', () => {
    expect(matchesExifFilters(p({ place: null }), { places: ['Tokyo'] })).toBe(false)
    expect(matchesExifFilters(p({ camera: null }), { cameras: ['Sony A7'] })).toBe(false)
    expect(matchesExifFilters(p({ place: null, camera: null }), {})).toBe(true)
  })

  it('applyExifFilters 过滤列表并容忍 null 入参', () => {
    const list = [
      p({ id: '1', date: 'January 1, 2023' }),
      p({ id: '2', date: 'January 1, 2022' }),
    ]
    expect(applyExifFilters(list, { years: ['2023'] }).map(x => x.id)).toEqual(['1'])
    expect(applyExifFilters(null, { years: ['2023'] })).toEqual([])
    expect(applyExifFilters(undefined, { years: ['2023'] })).toEqual([])
  })

  it('D17/F2:archiveIds 分支已移除——传了也不生效', () => {
    // Vue2 版本会因 archiveIds 命中而返回 false;本仓已把该分支整条删掉,
    // 多余的键必须被忽略(而不是悄悄恢复归档语义)。
    expect(matchesExifFilters(p({ id: 'arch' }), { archiveIds: ['arch'] } as never)).toBe(true)
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

Run: `cd /home/nimo/NimoTech/.sp7/NimoOS-New-UI && pnpm exec vitest run src/photos/util/__tests__/photosFilterUtils.test.ts`
Expected: FAIL — `Failed to resolve import "../photosFilterUtils"`。

- [ ] **Step 3: 写实现**

创建 `src/photos/util/photosFilterUtils.ts`:

```ts
// SP7-P7b-T1:EXIF / 图库筛选谓词——时间线页与跳库页共用同一套判定,保证两边过滤口径一致。
// Ported from Vue2 NimoOS-UI src/views/Photos/photosFilterUtils.js(27 行),逻辑逐行对应。
//
// D17 / F2 偏离登记:去掉 Vue2 的 `archiveIds` 形参与分支。回源 grep 实证归档六环全死
// (PhotosGrid 从不 emit batch-archive → PhotosTimeline 的监听 / onBatchArchive /
// archiveBatch action / ARCHIVE_BATCH mutation 逐级不可达,`archiveIds` 恒 []),
// New-UI 未迁归档功能,本仓零写入方。相应地 Vue2 那 58 行测试里的 archiveIds 用例也裁掉。
//
// 注意 `date` 的形态:它不是 ISO 串,而是 assetToPhoto(:336)用
// toLocaleDateString('en', { year:'numeric', month:'long', day:'numeric' }) 生成的
// 本地化串(如 "May 1, 2023")。Vue2 同源同形态,所以 new Date(date) 这个解析方式照抄,
// 不改读 takenAt(那是另一个字段,行为会变)。

/** 参与 EXIF 过滤的最小照片形状——`Photo`(assetToPhoto.ts:267)结构上兼容。 */
export interface FilterablePhoto {
  date?: string | null
  place?: string | null
  camera?: string | null
}

export interface ExifFilters {
  years?: string[]
  places?: string[]
  cameras?: string[]
}

export function photoYear(photo: FilterablePhoto | null | undefined): string {
  if (!photo || !photo.date) return ''
  const y = new Date(photo.date).getFullYear()
  return Number.isNaN(y) ? '' : String(y)
}

export function matchesExifFilters(
  photo: FilterablePhoto,
  { years = [], places = [], cameras = [] }: ExifFilters = {},
): boolean {
  if (years.length && !years.includes(photoYear(photo))) return false
  if (places.length && !places.includes((photo.place || '').split(',')[0].trim())) return false
  if (cameras.length && !cameras.includes((photo.camera || '').split('·')[0].trim())) return false
  return true
}

export function applyExifFilters<T extends FilterablePhoto>(
  photos: T[] | null | undefined,
  filters: ExifFilters = {},
): T[] {
  return (photos || []).filter(p => matchesExifFilters(p, filters))
}
```

- [ ] **Step 4: 跑测试确认它绿 + 类型检查**

Run: `pnpm exec vitest run src/photos/util/__tests__/photosFilterUtils.test.ts && pnpm exec vue-tsc --noEmit`
Expected: 10 passed;tsc exit 0。

- [ ] **Step 5: 提交**

```bash
git add src/photos/util/photosFilterUtils.ts src/photos/util/__tests__/photosFilterUtils.test.ts
git commit -m "feat(photos): P7b-T1 EXIF 过滤谓词 —— 移植 photosFilterUtils,去 archiveIds 死分支(D17/F2)"
```

---

