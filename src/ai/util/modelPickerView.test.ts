import { describe, it, expect } from 'vitest'
import { splitModels, cloudGroups, formatModelSize } from './modelPickerView'
import type { AgentModel } from '../stores/agentStore'

function m(overrides: Partial<AgentModel>): AgentModel {
  return { key: 'x', source: 'cloud', displayName: 'X', ...overrides }
}

describe('splitModels', () => {
  it('Split by source into { local, cloud } two groups, preserve original order within groups', () => {
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
  it('Group by provider order of first appearance (Vue2 ModelPicker.vue:89-100 index table logic)', () => {
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

  it('When query is non-empty, filter by displayName only, return empty when matching provider name but no displayName (Vue2 :84-100)', () => {
    const list = [
      m({ key: 'a', displayName: 'GPT-4', providerId: 'openai', providerName: 'OpenAI' }),
      m({ key: 'b', displayName: 'Claude', providerId: 'anthropic', providerName: 'Anthropic' }),
    ]
    // "openai" only matches providerName, never displayName — Vue2 never searches
    // providerName, so the filtered set (and therefore the groups) must be empty.
    expect(cloudGroups(list, 'openai')).toEqual([])
  })

  it('query matches displayName (case-insensitive, trim both sides)', () => {
    const list = [m({ key: 'a', displayName: 'GPT-4', providerId: 'p1' })]
    expect(cloudGroups(list, '  GPT ').map((g) => g.models.map((x) => x.key))).toEqual([['a']])
    expect(cloudGroups(list, 'nope')).toEqual([])
  })
})

describe('formatModelSize', () => {
  it('>=1GB display GB with one decimal place', () => {
    expect(formatModelSize(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB')
  })

  it('F7 additional test: exactly 1024**3 bytes (1GB boundary) shows "1.0 GB" via >=1GB branch', () => {
    expect(formatModelSize(1024 ** 3)).toBe('1.0 GB')
  })

  it('<1GB display rounded MB', () => {
    expect(formatModelSize(500 * 1024 * 1024)).toBe('500 MB')
  })

  it('0 or undefined return empty string', () => {
    expect(formatModelSize(0)).toBe('')
    expect(formatModelSize(undefined)).toBe('')
  })
})
