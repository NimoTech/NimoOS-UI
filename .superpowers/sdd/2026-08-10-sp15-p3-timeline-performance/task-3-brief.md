## Task 3: `gridMetrics.ts` 纯函数 + CSS 一致性守卫

**Files:**
- Create: `src/photos/util/gridMetrics.ts`
- Test: `src/photos/util/__tests__/gridMetrics.test.ts`
- Test: `src/photos/util/__tests__/gridMetricsCssParity.test.ts`

**Interfaces:**
- Produces:
  - `GRID_METRICS: Record<'comfortable' | 'compact' | 'loose', { minColWidth: number; gap: number }>`
  - `CONTENT_INSET: number` / `FALLBACK_CONTAINER_WIDTH: number` / `MONTH_HEAD_HEIGHT: number`
  - `columnsFor(containerWidth: number, density: string): number`
  - `tileEdge(containerWidth: number, density: string): number`
  - `estimateSectionBodyHeight(args: { containerWidth: number; density: string; itemCount: number }): number`
  - `skeletonItemCount(args: { tab: string; count?: number; videoCount?: number; loaded?: boolean; loadedLength: number }): number`

- [ ] **Step 1: 写几何失败测试**

```ts
// src/photos/util/__tests__/gridMetrics.test.ts
import { describe, it, expect } from 'vitest'
import {
  GRID_METRICS, CONTENT_INSET, FALLBACK_CONTAINER_WIDTH, MONTH_HEAD_HEIGHT,
  columnsFor, tileEdge, estimateSectionBodyHeight, skeletonItemCount,
} from '../gridMetrics'

describe('columnsFor', () => {
  it('mirrors repeat(auto-fill, minmax(min, 1fr)) for the default density', () => {
    // 800 usable px, min 140, gap 4 -> floor((800 + 4) / 144) = 5
    expect(columnsFor(800 + CONTENT_INSET, 'comfortable')).toBe(5)
  })
  it('packs more columns at compact and fewer at loose', () => {
    expect(columnsFor(800 + CONTENT_INSET, 'compact')).toBe(8)   // floor(802 / 98)
    expect(columnsFor(800 + CONTENT_INSET, 'loose')).toBe(3)     // floor(810 / 210)
  })
  it('never returns less than one column', () => {
    expect(columnsFor(10, 'loose')).toBe(1)
  })
  it('falls back to a nominal width when the container has not been laid out', () => {
    // jsdom reports clientWidth 0 for everything; a 0 here would make every
    // skeleton 0px tall and the on-demand loader would never see a scrollable page.
    expect(columnsFor(0, 'comfortable')).toBe(columnsFor(FALLBACK_CONTAINER_WIDTH, 'comfortable'))
  })
  it('treats an unknown density as the default', () => {
    expect(columnsFor(800 + CONTENT_INSET, 'nonsense')).toBe(columnsFor(800 + CONTENT_INSET, 'comfortable'))
  })
})

describe('tileEdge', () => {
  it('splits the usable width across columns minus the inter-column gaps', () => {
    // 5 columns, 4 gaps of 4px -> (800 - 16) / 5 = 156.8
    expect(tileEdge(800 + CONTENT_INSET, 'comfortable')).toBeCloseTo(156.8, 5)
  })
})

describe('estimateSectionBodyHeight', () => {
  it('is zero for an empty section', () => {
    expect(estimateSectionBodyHeight({ containerWidth: 868, density: 'comfortable', itemCount: 0 })).toBe(0)
  })
  it('counts rows and the gaps BETWEEN rows only', () => {
    // 12 items over 5 columns -> 3 rows -> 3 * 156.8 + 2 * 4 = 478.4
    expect(estimateSectionBodyHeight({ containerWidth: 868, density: 'comfortable', itemCount: 12 }))
      .toBeCloseTo(478.4, 5)
  })
  it('rounds partial rows up', () => {
    const one = estimateSectionBodyHeight({ containerWidth: 868, density: 'comfortable', itemCount: 1 })
    const five = estimateSectionBodyHeight({ containerWidth: 868, density: 'comfortable', itemCount: 5 })
    expect(one).toBeCloseTo(five, 5)
  })
})

describe('skeletonItemCount', () => {
  it('estimates the photo tab as count minus videoCount', () => {
    // The photo tab is the DEFAULT tab on this page (Photos.vue). Estimating 0
    // here would leave every month past the first viewport permanently unloaded.
    expect(skeletonItemCount({ tab: 'photo', count: 100, videoCount: 12, loaded: false, loadedLength: 0 })).toBe(88)
  })
  it('estimates the video tab from videoCount and the all tab from count', () => {
    expect(skeletonItemCount({ tab: 'video', count: 100, videoCount: 12, loaded: false, loadedLength: 0 })).toBe(12)
    expect(skeletonItemCount({ tab: 'all', count: 100, videoCount: 12, loaded: false, loadedLength: 0 })).toBe(100)
  })
  it('estimates nothing on the doc tab, which the directory has no counter for', () => {
    expect(skeletonItemCount({ tab: 'doc', count: 100, videoCount: 12, loaded: false, loadedLength: 0 })).toBe(0)
  })
  it('uses the real length for already-loaded groups that carry no directory counts', () => {
    // Favorites and the place-assets page feed synthetic month groups: no count,
    // no videoCount, already in hand. Their placeholders must keep a true height.
    expect(skeletonItemCount({ tab: 'photo', loaded: true, loadedLength: 7 })).toBe(7)
  })
  it('never returns a negative estimate when videoCount exceeds count', () => {
    expect(skeletonItemCount({ tab: 'photo', count: 2, videoCount: 5, loaded: false, loadedLength: 0 })).toBe(0)
  })
})

describe('constants', () => {
  it('exposes the three densities the grid CSS defines', () => {
    expect(Object.keys(GRID_METRICS).sort()).toEqual(['comfortable', 'compact', 'loose'])
  })
  it('keeps a positive month-head allowance', () => {
    expect(MONTH_HEAD_HEIGHT).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/photos/util/__tests__/gridMetrics.test.ts`
Expected: FAIL —— 模块不存在。

- [ ] **Step 3: 实现**

```ts
// src/photos/util/gridMetrics.ts
// SP15-P3 geometry. The photo grid is `repeat(auto-fill, minmax(Npx, 1fr))`, so
// its column count depends on the container width — an unloaded month's
// placeholder height can only be estimated, never read off a constant table.
// These are pure functions on purpose: jsdom has no layout engine, so geometry
// living inside the component could only ever be tested through its degenerate
// path.
//
// This table is the single source of truth for the numbers that also appear in
// PhotosGrid.vue's <style>. gridMetricsCssParity.test.ts fails if the two drift,
// because a silent drift here makes every placeholder the wrong height and no
// other gate can see it.
export const GRID_METRICS = {
  comfortable: { minColWidth: 140, gap: 4 },
  compact: { minColWidth: 96, gap: 2 },
  loose: { minColWidth: 200, gap: 10 },
} as const

export type Density = keyof typeof GRID_METRICS

// .photos-wrap has `padding-right: 68px` (the month scrubber floats over it), and
// clientWidth includes padding — subtract it to get the width the grid actually
// lays out in.
export const CONTENT_INSET = 68

// Used when the container reports width 0: jsdom always does, and a real
// container does momentarily while display:none. Estimating 0 there would give
// every skeleton zero height, leaving the page unscrollable and the on-demand
// loader with nothing to react to.
export const FALLBACK_CONTAINER_WIDTH = 1200

// .month-head is `padding: 4px 2px 10px` around a 15px/600 title — about 32px
// tall. Only an estimate, and only used until a section has rendered once: after
// that the grid remembers its measured height instead.
export const MONTH_HEAD_HEIGHT = 32

function metricsFor(density: string): { minColWidth: number; gap: number } {
  return GRID_METRICS[density as Density] ?? GRID_METRICS.comfortable
}

function usableWidth(containerWidth: number): number {
  const w = containerWidth > 0 ? containerWidth : FALLBACK_CONTAINER_WIDTH
  return Math.max(1, w - CONTENT_INSET)
}

export function columnsFor(containerWidth: number, density: string): number {
  const { minColWidth, gap } = metricsFor(density)
  const w = usableWidth(containerWidth)
  return Math.max(1, Math.floor((w + gap) / (minColWidth + gap)))
}

// Tiles are `aspect-ratio: 1`, so the edge length is also the row height.
export function tileEdge(containerWidth: number, density: string): number {
  const { gap } = metricsFor(density)
  const cols = columnsFor(containerWidth, density)
  const w = usableWidth(containerWidth)
  return (w - (cols - 1) * gap) / cols
}

export function estimateSectionBodyHeight(
  { containerWidth, density, itemCount }: { containerWidth: number; density: string; itemCount: number },
): number {
  if (itemCount <= 0) return 0
  const { gap } = metricsFor(density)
  const cols = columnsFor(containerWidth, density)
  const rows = Math.ceil(itemCount / cols)
  return rows * tileEdge(containerWidth, density) + (rows - 1) * gap
}

// How many tiles an unrendered section stands in for, on the current tab.
export function skeletonItemCount(
  { tab, count, videoCount, loaded, loadedLength }:
  { tab: string; count?: number; videoCount?: number; loaded?: boolean; loadedLength: number },
): number {
  // Synthetic groups (favorites, place assets) and legacy timeline groups carry
  // no directory counts and are always already in hand — their real length is
  // the honest estimate, and using 0 would collapse their placeholder.
  if (count == null) return loaded === false ? 0 : Math.max(0, loadedLength)
  const total = Math.max(0, count)
  const videos = Math.max(0, videoCount ?? 0)
  if (tab === 'all') return total
  if (tab === 'video') return videos
  // The photo tab is this page's default. The directory has no photo-only
  // counter, so it is derived — estimating 0 would stop every month past the
  // first viewport from ever being requested.
  if (tab === 'photo') return Math.max(0, total - videos)
  // The doc/OCR tab has no directory counter at all; unloaded months stay hidden
  // there (registered limitation, see the P3 spec).
  return 0
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/photos/util/__tests__/gridMetrics.test.ts`
Expected: PASS。

- [ ] **Step 5: 写 CSS 一致性守卫**

```ts
// src/photos/util/__tests__/gridMetricsCssParity.test.ts
// gridMetrics.ts duplicates three numbers that only CSS can actually enforce:
// each density's minmax() floor and its gap, plus .photos-wrap's padding-right.
// If either side is edited alone, every unloaded month gets the wrong height —
// and no other gate can see it: vue-tsc does not read CSS, the build does not
// care, color-guard only looks at colors, and jsdom does no layout at all.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { GRID_METRICS, CONTENT_INSET } from '../gridMetrics'

const SRC = readFileSync('src/photos/components/PhotosGrid.vue', 'utf8')

function ruleLine(startsWith: string): string {
  const line = SRC.split('\n').find((l) => l.trimStart().startsWith(startsWith))
  expect(line, `no CSS rule in PhotosGrid.vue starting with ${startsWith}`).toBeTruthy()
  return line as string
}
function numberAfter(line: string, re: RegExp): number {
  const m = re.exec(line)
  expect(m, `pattern ${re} did not match: ${line}`).toBeTruthy()
  return Number((m as RegExpExecArray)[1])
}

const RULES: Array<[keyof typeof GRID_METRICS, string]> = [
  ['comfortable', '.grid {'],
  ['compact', '.grid[data-density="compact"]'],
  ['loose', '.grid[data-density="loose"]'],
]

describe('gridMetrics matches PhotosGrid.vue CSS', () => {
  for (const [density, selector] of RULES) {
    it(`${density}: minmax floor and gap agree with the CSS`, () => {
      const line = ruleLine(selector)
      expect(numberAfter(line, /minmax\((\d+)px/)).toBe(GRID_METRICS[density].minColWidth)
      expect(numberAfter(line, /gap:\s*(\d+)px/)).toBe(GRID_METRICS[density].gap)
    })
  }
  it('CONTENT_INSET matches .photos-wrap padding-right', () => {
    expect(numberAfter(ruleLine('.photos-wrap {'), /padding-right:\s*(\d+)px/)).toBe(CONTENT_INSET)
  })
})
```

- [ ] **Step 6: 跑守卫，并做变异验证**

Run: `pnpm test src/photos/util/__tests__/gridMetricsCssParity.test.ts`
Expected: PASS（4 例）。

变异验证（必须做，证明守卫真的在起作用）：把 `GRID_METRICS.compact.gap` 临时改成 `3`，
重跑 → 必须**红**在 compact 那一例；改回来 → 绿。把 `.grid[data-density="loose"]` 的
`minmax(200px` 临时改成 `minmax(180px`，重跑 → 必须**红**；改回来。两次变异都要真的跑一遍，
不要只在报告里声称。

- [ ] **Step 7: 提交**

```bash
git add src/photos/util/gridMetrics.ts src/photos/util/__tests__/gridMetrics.test.ts src/photos/util/__tests__/gridMetricsCssParity.test.ts
git commit -m "feat(photos): add grid geometry helpers and a CSS parity guard

The photo grid is auto-fill/minmax, so an unloaded month's placeholder height
has to be computed from the container width rather than a fixed column count.
Keeping that math in pure functions is what makes it testable at all: jsdom has
no layout engine, so geometry inside the component could only be exercised
through its degenerate path. The parity test exists because the same three
numbers live in CSS too, and a one-sided edit would silently mis-size every
placeholder with no other gate able to notice."
```

---

