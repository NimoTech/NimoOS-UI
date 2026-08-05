## Task 9: `dashboardHelpers.ts`

**Files:**
- Create: `src/ai/knowledge/util/dashboardHelpers.ts`
- Create: `src/ai/knowledge/util/dashboardHelpers.test.ts`

**Interfaces:**
- Produces: `updatePeak(peak: number, backlog: number): number` · `progressPercent(backlog: number, peak: number): number` · `summarizeNotes(notes: {status?: string}[] | undefined | null): {total: number; draft: number; curated: number; archived: number}` · `fmtEta(etaS: number | null | undefined): string`

- [ ] **Step 1: 读蓝本 + 原测试**

```bash
git -C /home/nimo/NimoTech/NimoOS-UI show main:src/views/AI/Knowledge/dashboardHelpers.js
git -C /home/nimo/NimoTech/NimoOS-UI show main:src/views/AI/Knowledge/__tests__/dashboardHelpers.spec.js
```

- [ ] **Step 2: 写失败测试**(逐条移植 Vue2 那 6 条,并补 3 条边界)

```ts
import { describe, it, expect } from 'vitest'
import { progressPercent, fmtEta, updatePeak, summarizeNotes } from './dashboardHelpers'

describe('dashboard progress helpers', () => {
  it('updatePeak 是滚动最大值', () => {
    expect(updatePeak(0, 50)).toBe(50)
    expect(updatePeak(50, 30)).toBe(50)
    expect(updatePeak(50, 80)).toBe(80)
  })

  it('updatePeak 容忍 0/NaN 缺省', () => {
    expect(updatePeak(undefined as unknown as number, 5)).toBe(5)
    expect(updatePeak(5, undefined as unknown as number)).toBe(5)
  })

  it('progressPercent 夹在 0..100,且 backlog 变大时回落', () => {
    expect(progressPercent(0, 0)).toBe(0)
    expect(progressPercent(100, 100)).toBe(0)
    expect(progressPercent(25, 100)).toBe(75)
    expect(progressPercent(0, 100)).toBe(100)
    const peak = updatePeak(100, 120)
    expect(progressPercent(120, peak)).toBe(0)
  })

  it('progressPercent 对负 peak 返回 0(不产生负值)', () => {
    expect(progressPercent(10, -5)).toBe(0)
  })

  it('fmtEta 渲染人类可读时长', () => {
    expect(fmtEta(null)).toBe('')
    expect(fmtEta(0)).toBe('')
    expect(fmtEta(45)).toBe('<1m')
    expect(fmtEta(150)).toBe('2m')
    expect(fmtEta(5400)).toBe('1h 30m')
    expect(fmtEta(3600)).toBe('1h 0m')
  })
})

describe('summarizeNotes', () => {
  it('按状态计数', () => {
    expect(summarizeNotes([{ status: 'draft' }, { status: 'draft' }, { status: 'curated' }, { status: 'archived' }]))
      .toEqual({ total: 4, draft: 2, curated: 1, archived: 1 })
  })

  it('未知状态只加 total(分布条不虚报)', () => {
    expect(summarizeNotes([{ status: 'weird' }, null as never, { status: 'draft' }]))
      .toEqual({ total: 2, draft: 1, curated: 0, archived: 0 })
  })

  it('空输入与缺省输入都是全 0', () => {
    expect(summarizeNotes([])).toEqual({ total: 0, draft: 0, curated: 0, archived: 0 })
    expect(summarizeNotes(undefined)).toEqual({ total: 0, draft: 0, curated: 0, archived: 0 })
  })
})
```

- [ ] **Step 3: 跑测试确认失败**
- [ ] **Step 4: 实现**(逐字移植,注释一起搬;`fmtEta` 的 `'<1m'`/`'2m'`/`'1h 30m'` 是**英文缩写字面量、非 i18n**,蓝本如此,**照抄**并注释说明)
- [ ] **Step 5: 跑测试 + 三门**
- [ ] **Step 6: 提交**

```bash
git add src/ai/knowledge/util/dashboardHelpers.ts src/ai/knowledge/util/dashboardHelpers.test.ts
git commit -m "feat(knowledge): SP8-P5a dashboardHelpers 移植(带原测试)"
```

---

