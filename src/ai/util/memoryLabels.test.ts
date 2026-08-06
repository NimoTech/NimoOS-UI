import { describe, it, expect } from 'vitest'
import { kindLabel, sourceLabel, KIND_LABEL_KEYS, SOURCE_LABEL_KEYS } from './memoryLabels'

// SP8-P2b Task 6 —— 对齐 Vue2 MemorySection.spec.js 第 14 条
// 'kindLabel/sourceLabel map known values and pass through unknown'。

describe('memoryLabels', () => {
  it('kindLabel 映射已知取值到 i18n 键名', () => {
    expect(kindLabel('preference')).toBe('aiCfgMemKindPreference')
    expect(kindLabel('fact')).toBe('aiCfgMemKindFact')
    expect(kindLabel('goal')).toBe('aiCfgMemKindGoal')
  })

  it('sourceLabel 映射已知取值到 i18n 键名', () => {
    expect(sourceLabel('auto')).toBe('aiCfgMemSourceAuto')
    expect(sourceLabel('tool')).toBe('aiCfgMemSourceTool')
    expect(sourceLabel('user')).toBe('aiCfgMemSourceUser')
  })

  it('未知取值原样返回（Vue2 同款兜底）', () => {
    expect(kindLabel('weird')).toBe('weird')
    expect(sourceLabel('weird')).toBe('weird')
  })

  it('映射表内容与 Vue2 KIND_LABELS/SOURCE_LABELS 的键集合一致', () => {
    expect(Object.keys(KIND_LABEL_KEYS)).toEqual(['preference', 'fact', 'goal'])
    expect(Object.keys(SOURCE_LABEL_KEYS)).toEqual(['auto', 'tool', 'user'])
  })
})
