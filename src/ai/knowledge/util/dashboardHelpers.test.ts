// SP8-P5a Task 9 —— 移植自 Vue2 `src/views/AI/Knowledge/__tests__/dashboardHelpers.spec.js`
// (main@7a6ee6b7)。原 spec 实际 6 条用例(updatePeak 1 条 · progressPercent
// 1 条 · fmtEta 1 条 · summarizeNotes 3 条),brief 逐字给出的测试代码在此基础上
// 补了 3 条边界(updatePeak 缺省容忍 · progressPercent 负 peak · fmtEta 的 0/
// 3600 两个新断言点),brief 的代码本文件逐字照用、一字不改。
//
// 在 brief 代码之后另加一组「分支切换点两侧」补充用例(治理文件 §9 硬要求:
// 凡「A/B 二选一」分支必须两边都有对照断言)——这些是本次移植新增的覆盖,
// 不属于 brief 逐字部分,单独分组并注明理由。
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

// ---- 补充:分支切换点两侧对照(本次移植新增,非 brief 逐字部分) ----

describe('updatePeak 分支边界补充', () => {
  it('backlog 等于 peak 时保持不变(既非"超过"也非"低于"的临界)', () => {
    // dashboardHelpers.ts:9 `Math.max` —— 相等时两侧结果一致,专门钉住这一刻
    // 不会被误改成 `>` 严格大于才更新之类的变体(那样 50,50 仍是 50,和
    // Math.max 语义一致,但下面 RED 探针会验证真正抓错的是比较符方向)。
    expect(updatePeak(50, 50)).toBe(50)
  })
})

describe('progressPercent 分支边界补充', () => {
  it('非整除结果四舍五入(Math.round,不是截断)', () => {
    // (1 - 1/3) * 100 = 66.666...7 → round 到 67,若实现误用 Math.floor
    // 会得到 66,用这条钉住取整方式。
    expect(progressPercent(1, 3)).toBe(67)
    // (1 - 2/3) * 100 = 33.333...3 → round 到 33,floor 同样是 33,配合上面
    // 一条互为两侧(round 上舍入 vs 下舍入各命中一次)。
    expect(progressPercent(2, 3)).toBe(33)
  })
})

describe('fmtEta 分支边界补充', () => {
  it('<1m 与 {m}m 的分钟边界两侧(59s vs 60s)', () => {
    expect(fmtEta(59)).toBe('<1m')
    expect(fmtEta(60)).toBe('1m')
  })

  it('{m}m 与 {h}h {m}m 的小时边界两侧(59 分 vs 60 分)', () => {
    expect(fmtEta(3540)).toBe('59m') // 59*60 = 3540s
    expect(fmtEta(3600)).toBe('1h 0m') // 60*60 = 3600s,已在上方 brief 用例覆盖,这里成对复述以标注边界语义
  })

  it('etaS<=0 分支两侧:0 与负数都回空串,undefined 与 null 同归一支', () => {
    expect(fmtEta(-10)).toBe('')
    expect(fmtEta(undefined)).toBe('')
  })
})

describe('summarizeNotes(null) 输入', () => {
  it('null 与 undefined 同归一支,都回全 0', () => {
    // 蓝本 `for (const n of notes || [])`——null 与 undefined 都会被 `||[]`
    // 兜底,是同一条分支;brief 只测了 undefined,这里补 null 一侧。
    expect(summarizeNotes(null)).toEqual({ total: 0, draft: 0, curated: 0, archived: 0 })
  })
})
