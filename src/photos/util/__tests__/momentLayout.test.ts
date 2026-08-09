// SP15-P1-T2: 马赛克尺寸/模板纯函数。逐条照 Vue2 899af59b:src/views/Photos/
// PhotosSmartViewsView.vue:322-357(classifyMomentSize/pickMomentTemplate/
// assignMomentSizes)移植,规则一字不改。
import { describe, it, expect } from 'vitest'
import { classifyMomentSize, pickMomentTemplate, assignMomentSizes, type MomentLayoutInput } from '../momentLayout'

function m(over: Partial<MomentLayoutInput> = {}): MomentLayoutInput {
  return { id: 'x', recipeKey: 'theme:food', assetCount: 10, coverRatio: 1.5, featuredAssetIds: ['a', 'b'], ...over }
}

describe('classifyMomentSize', () => {
  it('竖版封面(0 < ratio < 0.85)判 tall,且优先于 wide', () => {
    expect(classifyMomentSize(m({ coverRatio: 0.6 }))).toBe('tall')
    // 同时满足 tall 与 wide 条件时,先判 tall(Vue2 是顺序判定,首个命中即返回)
    expect(classifyMomentSize(m({ coverRatio: 0.6, recipeKey: 'trip:1', assetCount: 200 }))).toBe('tall')
  })
  it('ratio 恰为 0 表示未知,不算 tall', () => {
    expect(classifyMomentSize(m({ coverRatio: 0 }))).toBe('standard')
  })
  it('ratio 恰为 0.85 是开区间上界,不算 tall', () => {
    expect(classifyMomentSize(m({ coverRatio: 0.85 }))).toBe('standard')
  })
  it('trip 前缀且 assetCount >= 100 判 wide;99 张不算', () => {
    expect(classifyMomentSize(m({ coverRatio: 1.5, recipeKey: 'trip', assetCount: 100 }))).toBe('wide')
    expect(classifyMomentSize(m({ coverRatio: 1.5, recipeKey: 'trip', assetCount: 99 }))).toBe('standard')
  })
  it('recipeKey 只是包含 trip(不是以它开头)不算 wide', () => {
    expect(classifyMomentSize(m({ coverRatio: 1.5, recipeKey: 'theme:trip', assetCount: 500 }))).toBe('standard')
  })
})

describe('pickMomentTemplate', () => {
  it('featured >= 2 时按档取 T2/T4/T1', () => {
    expect(pickMomentTemplate('tall', 2)).toBe('T2')
    expect(pickMomentTemplate('wide', 3)).toBe('T4')
    expect(pickMomentTemplate('standard', 2)).toBe('T1')
  })
  it('featured == 1 时任意档都落 T3(不掉单图)', () => {
    expect(pickMomentTemplate('tall', 1)).toBe('T3')
    expect(pickMomentTemplate('wide', 1)).toBe('T3')
    expect(pickMomentTemplate('standard', 1)).toBe('T3')
  })
  it('featured == 0 时落 single', () => {
    expect(pickMomentTemplate('wide', 0)).toBe('single')
  })
})

describe('assignMomentSizes', () => {
  it('间隔配额:距上一张 wide 不足 3 位的 wide 降级为 standard', () => {
    const wide = (id: string) => m({ id, coverRatio: 1.5, recipeKey: 'trip', assetCount: 200 })
    const out = assignMomentSizes([wide('a'), wide('b'), wide('c'), wide('d')])
    // idx0 通过(lastWide = -Infinity);idx1/idx2 距离不足 3 → 降级;idx3 距 idx0 恰好 3 → 通过
    expect([out.a.size, out.b.size, out.c.size, out.d.size]).toEqual(['wide', 'standard', 'standard', 'wide'])
  })
  it('间隔配额:距上一张 tall 不足 2 位的 tall 降级为 standard', () => {
    const tall = (id: string) => m({ id, coverRatio: 0.6 })
    const out = assignMomentSizes([tall('a'), tall('b'), tall('c')])
    expect([out.a.size, out.b.size, out.c.size]).toEqual(['tall', 'standard', 'tall'])
  })
  it('被降级的那张不更新"上一张 wide/tall 的位置"', () => {
    // 只有真正保留下来的尺寸才计入位置基准 —— 若降级项也计入,第 4 项会被错误降级
    const wide = (id: string) => m({ id, coverRatio: 1.5, recipeKey: 'trip', assetCount: 200 })
    const out = assignMomentSizes([wide('a'), wide('b'), wide('c'), wide('d')])
    expect(out.d.size).toBe('wide')
  })
  it('降级为 standard 后,模板按 standard 档重算', () => {
    const tall = (id: string) => m({ id, coverRatio: 0.6, featuredAssetIds: ['p', 'q'] })
    const out = assignMomentSizes([tall('a'), tall('b')])
    expect(out.a.template).toBe('T2')
    expect(out.b.template).toBe('T1') // 降级成 standard ⇒ T1 而不是 T2
  })
  it('featuredAssetIds 缺失时按 0 计,落 single', () => {
    const out = assignMomentSizes([{ id: 'a', recipeKey: 'theme:food', assetCount: 3, coverRatio: 1.5, featuredAssetIds: [] }])
    expect(out.a.template).toBe('single')
  })
  it('空列表返回空映射,不抛', () => {
    expect(assignMomentSizes([])).toEqual({})
  })
  it('是纯函数:同一输入两次调用结果深相等', () => {
    const list = [m({ id: 'a' }), m({ id: 'b', coverRatio: 0.6 })]
    expect(assignMomentSizes(list)).toEqual(assignMomentSizes(list))
  })
})
