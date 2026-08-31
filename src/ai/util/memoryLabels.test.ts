import { describe, it, expect } from 'vitest'
import { kindLabel, sourceLabel, KIND_LABEL_KEYS, SOURCE_LABEL_KEYS } from './memoryLabels'

// Aligns with Vue2 MemorySection.spec.js item 14
// 'kindLabel/sourceLabel map known values and pass through unknown'.

describe('memoryLabels', () => {
  it('kindLabel maps known values to i18n key names', () => {
    expect(kindLabel('preference')).toBe('aiCfgMemKindPreference')
    expect(kindLabel('fact')).toBe('aiCfgMemKindFact')
    expect(kindLabel('goal')).toBe('aiCfgMemKindGoal')
  })

  it('sourceLabel maps known values to i18n key names', () => {
    expect(sourceLabel('auto')).toBe('aiCfgMemSourceAuto')
    expect(sourceLabel('tool')).toBe('aiCfgMemSourceTool')
    expect(sourceLabel('user')).toBe('aiCfgMemSourceUser')
  })

  it('unknown values pass through as-is (Vue2 fallback)', () => {
    expect(kindLabel('weird')).toBe('weird')
    expect(sourceLabel('weird')).toBe('weird')
  })

  it('mapping table content matches Vue2 KIND_LABELS/SOURCE_LABELS key sets', () => {
    expect(Object.keys(KIND_LABEL_KEYS)).toEqual(['preference', 'fact', 'goal'])
    expect(Object.keys(SOURCE_LABEL_KEYS)).toEqual(['auto', 'tool', 'user'])
  })
})
