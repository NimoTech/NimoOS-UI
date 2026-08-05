### Task 1: 纯函数移植 — OCR 高亮 / 浏览器可解码判定 / OSM 地址 / 翻页索引

**Files:**
- Create: `src/photos/lightbox/util/ocrHighlight.ts`、`src/photos/lightbox/util/osmMap.ts`、`src/photos/lightbox/util/photoNav.ts`、`src/photos/util/browserCanDisplayImage.ts`
- Test: `src/photos/lightbox/util/__tests__/ocrHighlight.test.ts`、`osmMap.test.ts`、`photoNav.test.ts`、`src/photos/util/__tests__/browserCanDisplayImage.test.ts`

**Interfaces:**
- Consumes(逐字移植源,逻辑不得改):Vue2 `src/views/Photos/photosOcrHighlight.js:11-48`、`src/views/Photos/PhotosLightbox.vue:226-230`(mapSrc)、`src/store/modules/photos.js:83-90`(browserCanDisplayImage)。翻页索引照 `src/files/viewers/imageNav.ts:12-15` 但改按 `id` 比对。
- Produces(T2/T5/T6/T7 消费):
  - `containContentRect(elemW:number, elemH:number, natW:number, natH:number): {x:number;y:number;w:number;h:number} | null`
  - `quadBounds(box:number[]): {x0:number;y0:number;x1:number;y1:number} | null`
  - `mapOcrBoxesToRects(lines:Array<{box:number[]}>, elemW:number, elemH:number, natW:number, natH:number): Array<{left:number;top:number;width:number;height:number}>`
  - `browserCanDisplayImage(mimeType:string|null|undefined): boolean`
  - `osmEmbedSrc(lat:number|null|undefined, lon:number|null|undefined, delta?:number): string`(缺经纬度返 `''`)
  - `photoIndexById<T extends { id:string|number }>(list:T[], current:{id:string|number}): number`(找不到返 0)

- [ ] **Step 1: 写失败测试**

`ocrHighlight.test.ts`(逐字对齐 Vue2 语义):
```ts
import { describe, it, expect } from 'vitest'
import { containContentRect, quadBounds, mapOcrBoxesToRects } from '../ocrHighlight'

describe('containContentRect', () => {
  it('宽图信箱:横向铺满、纵向居中留边', () => {
    // 元素 200x200,自然 100x50(2:1)→ 缩放 min(200/100,200/50)=2,内容 200x100,居中 y=50
    expect(containContentRect(200, 200, 100, 50)).toEqual({ x: 0, y: 50, w: 200, h: 100 })
  })
  it('退化尺寸返 null', () => {
    expect(containContentRect(0, 200, 100, 50)).toBeNull()
    expect(containContentRect(200, 200, 0, 50)).toBeNull()
  })
})

describe('quadBounds', () => {
  it('8 点归一四边形取轴对齐外接并钳到 [0,1]', () => {
    expect(quadBounds([0.1, 0.2, 0.5, 0.2, 0.5, 0.6, 0.1, 0.6])).toEqual({ x0: 0.1, y0: 0.2, x1: 0.5, y1: 0.6 })
  })
  it('畸形/零面积返 null', () => {
    expect(quadBounds([0.1, 0.2])).toBeNull()
    expect(quadBounds([0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3])).toBeNull()
  })
})

describe('mapOcrBoxesToRects', () => {
  it('把归一 box 映射到内容框像素矩形', () => {
    const rects = mapOcrBoxesToRects([{ box: [0, 0, 1, 0, 1, 1, 0, 1] }], 200, 200, 100, 50)
    // 内容框 x0,y0=0,50 w,h=200,100;整框 → left0 top50 width200 height100
    expect(rects).toEqual([{ left: 0, top: 50, width: 200, height: 100 }])
  })
})
```

`browserCanDisplayImage.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { browserCanDisplayImage } from '../browserCanDisplayImage'
it('允许常见可解码类型(大小写不敏感)', () => {
  expect(browserCanDisplayImage('image/JPEG')).toBe(true)
  expect(browserCanDisplayImage('image/webp')).toBe(true)
  expect(browserCanDisplayImage('image/avif')).toBe(true)
})
it('HEIC/TIFF/RAW/空 → false(须回退大图缩略图)', () => {
  expect(browserCanDisplayImage('image/heic')).toBe(false)
  expect(browserCanDisplayImage('image/tiff')).toBe(false)
  expect(browserCanDisplayImage('')).toBe(false)
  expect(browserCanDisplayImage(null)).toBe(false)
})
```

`osmMap.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { osmEmbedSrc } from '../osmMap'
it('构造 OSM embed URL,默认 bbox 半径 0.02、带 marker', () => {
  // 用同一算术构造期望值,避免 JS 浮点(120-0.02 可能不是精确 "119.98")导致假失败;
  // 忠于 Vue2 的裸算术 `${lon-d}`(不四舍五入),OSM 容忍长小数。
  const d = 0.02
  const bbox = `${120 - d},${30 - d},${120 + d},${30 + d}`
  expect(osmEmbedSrc(30, 120)).toBe(
    `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=30,120`,
  )
})
it('缺经纬度返空串', () => {
  expect(osmEmbedSrc(null, 120)).toBe('')
  expect(osmEmbedSrc(30, undefined)).toBe('')
})
```

`photoNav.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { photoIndexById } from '../photoNav'
it('按 id 定位当前项', () => {
  expect(photoIndexById([{ id: 'a' }, { id: 'b' }, { id: 'c' }], { id: 'b' })).toBe(2 - 1)
})
it('找不到返 0(不用对象引用比较)', () => {
  const list = [{ id: 'a' }, { id: 'b' }]
  expect(photoIndexById(list, { id: 'zzz' })).toBe(0)
  // 同 id 不同对象也能命中(响应式重建免疫)
  expect(photoIndexById(list, { id: 'b' })).toBe(1)
})
```

- [ ] **Step 2: RED** — `pnpm vitest run src/photos/lightbox/util src/photos/util/__tests__/browserCanDisplayImage.test.ts` 失败(模块不存在)。

- [ ] **Step 3: 实现**

`ocrHighlight.ts`(逐字移植 Vue2 `photosOcrHighlight.js:11-48`,只加类型):
```ts
export function containContentRect(elemW: number, elemH: number, natW: number, natH: number): { x: number; y: number; w: number; h: number } | null {
  if (!elemW || !elemH || !natW || !natH) return null
  const scale = Math.min(elemW / natW, elemH / natH)
  const w = natW * scale
  const h = natH * scale
  return { x: (elemW - w) / 2, y: (elemH - h) / 2, w, h }
}

export function quadBounds(box: number[]): { x0: number; y0: number; x1: number; y1: number } | null {
  if (!Array.isArray(box) || box.length < 8) return null
  const xs = [box[0], box[2], box[4], box[6]]
  const ys = [box[1], box[3], box[5], box[7]]
  const x0 = Math.max(0, Math.min(...xs))
  const y0 = Math.max(0, Math.min(...ys))
  const x1 = Math.min(1, Math.max(...xs))
  const y1 = Math.min(1, Math.max(...ys))
  if (x1 <= x0 || y1 <= y0) return null
  return { x0, y0, x1, y1 }
}

export function mapOcrBoxesToRects(
  lines: Array<{ box: number[] }>,
  elemW: number, elemH: number, natW: number, natH: number,
): Array<{ left: number; top: number; width: number; height: number }> {
  const content = containContentRect(elemW, elemH, natW, natH)
  if (!content) return []
  const rects: Array<{ left: number; top: number; width: number; height: number }> = []
  for (const line of lines || []) {
    const b = quadBounds(line && line.box)
    if (!b) continue
    rects.push({
      left: content.x + b.x0 * content.w,
      top: content.y + b.y0 * content.h,
      width: (b.x1 - b.x0) * content.w,
      height: (b.y1 - b.y0) * content.h,
    })
  }
  return rects
}
```
> 移植核对:与 Vue2 `photosOcrHighlight.js:11-48` 三函数逐行等价;若 Vue2 实现细节(如 clamp 顺序)与上有出入,**以 Vue2 为准**并在报告注明。

`browserCanDisplayImage.ts`(Vue2 `store/modules/photos.js:83-90`):
```ts
const BROWSER_IMAGE_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'image/avif', 'image/bmp', 'image/svg+xml',
])
export function browserCanDisplayImage(mimeType: string | null | undefined): boolean {
  return BROWSER_IMAGE_MIME.has((mimeType || '').toLowerCase())
}
```

`osmMap.ts`(Vue2 `PhotosLightbox.vue:226-230`,`d` 默认 0.02):
```ts
export function osmEmbedSrc(lat: number | null | undefined, lon: number | null | undefined, delta = 0.02): string {
  if (lat == null || lon == null) return ''
  const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`
}
```

`photoNav.ts`:
```ts
export function photoIndexById<T extends { id: string | number }>(list: T[], current: { id: string | number }): number {
  const i = list.findIndex((x) => x.id === current.id)
  return i >= 0 ? i : 0
}
```

- [ ] **Step 4: GREEN + 全量 + tsc** — `pnpm vitest run src/photos/lightbox/util src/photos/util/__tests__/browserCanDisplayImage.test.ts` 全过;`pnpm test` 全绿;`pnpm exec vue-tsc --noEmit` 干净。
- [ ] **Step 5: Commit** — `feat(photos): 灯箱纯函数移植(OCR 高亮/浏览器解码判定/OSM 地址/翻页索引)`

---

