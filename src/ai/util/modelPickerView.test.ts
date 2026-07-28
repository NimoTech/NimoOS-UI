import { describe, it, expect } from 'vitest'
import { splitModels, cloudGroups, formatModelSize } from './modelPickerView'
import type { AgentModel } from '../stores/agentStore'

function m(overrides: Partial<AgentModel>): AgentModel {
  return { key: 'x', source: 'cloud', displayName: 'X', ...overrides }
}

describe('splitModels', () => {
  it('按 source 拆成 { local, cloud } 两组,组内保持原顺序', () => {
    const list = [
      m({ key: 'l1', source: 'local' }),
      m({ key: 'c1', source: 'cloud' }),
      m({ key: 'l2', source: 'local' }),
    ]
    const { local, cloud } = splitModels(list)
    expect(local.map((x) => x.key)).toEqual(['l1', 'l2'])
    expect(cloud.map((x) => x.key)).toEqual(['c1'])
  })
})

describe('cloudGroups', () => {
  it('按 provider 首次出现顺序分组(Vue2 ModelPicker.vue:89-100 的 index 表逻辑)', () => {
    const list = [
      m({ key: 'a', providerId: 'p2', providerName: 'P2' }),
      m({ key: 'b', providerId: 'p1', providerName: 'P1' }),
      m({ key: 'c', providerId: 'p2', providerName: 'P2' }),
    ]
    const groups = cloudGroups(list, '')
    expect(groups.map((g) => g.providerId)).toEqual(['p2', 'p1'])
    expect(groups[0].models.map((x) => x.key)).toEqual(['a', 'c'])
    expect(groups[1].models.map((x) => x.key)).toEqual(['b'])
  })

  it('query 非空时只按 displayName 过滤,命中 provider 名但不命中任何 displayName 时返回空(Vue2 :84-100)', () => {
    const list = [
      m({ key: 'a', displayName: 'GPT-4', providerId: 'openai', providerName: 'OpenAI' }),
      m({ key: 'b', displayName: 'Claude', providerId: 'anthropic', providerName: 'Anthropic' }),
    ]
    // "openai" only matches providerName, never displayName — Vue2 never searches
    // providerName, so the filtered set (and therefore the groups) must be empty.
    expect(cloudGroups(list, 'openai')).toEqual([])
  })

  it('query 命中 displayName(大小写不敏感,两侧 trim)', () => {
    const list = [m({ key: 'a', displayName: 'GPT-4', providerId: 'p1' })]
    expect(cloudGroups(list, '  GPT ').map((g) => g.models.map((x) => x.key))).toEqual([['a']])
    expect(cloudGroups(list, 'nope')).toEqual([])
  })
})

describe('formatModelSize', () => {
  it('>=1GB 显示一位小数的 GB', () => {
    expect(formatModelSize(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB')
  })

  it('F7 补测:恰好 1024**3 字节(1GB 边界)按 >=1GB 分支显示"1.0 GB"', () => {
    expect(formatModelSize(1024 ** 3)).toBe('1.0 GB')
  })

  it('<1GB 显示取整的 MB', () => {
    expect(formatModelSize(500 * 1024 * 1024)).toBe('500 MB')
  })

  it('0 或 undefined 返回空串', () => {
    expect(formatModelSize(0)).toBe('')
    expect(formatModelSize(undefined)).toBe('')
  })
})
