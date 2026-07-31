import { describe, it, expect } from 'vitest'
import { GROUPS, ALL_ITEMS, VALID_SECTIONS, SPLIT_SECTIONS, DEFERRED_SECTIONS, groupOf } from './sections'

// SP8-P2a Task 3 —— 移植自 Vue2 `src/views/AI/Settings/__tests__/SettingsRail.spec.js`
// 里针对 GROUPS 的三条断言(该文件其余的 methods 断言归 Task 7 的 SettingsRail.test.ts)。

describe('sections 导航配置', () => {
  it('四个分组,顺序照 Vue2 sections.js:13-55', () => {
    expect(GROUPS.map((g) => g.id)).toEqual(['model', 'agent', 'plugin', 'channel'])
  })

  it('仍然覆盖全部 13 个分区', () => {
    expect([...VALID_SECTIONS].sort()).toEqual([
      'blacklist', 'channels', 'execution', 'mcp', 'mcptokens', 'memory',
      'models', 'observability', 'privacy', 'providers', 'search', 'skills', 'thinking',
    ])
  })

  it('双栏满高分区所在的组是 swap 模式,竖排组是 stack 模式', () => {
    expect(GROUPS.find((g) => g.id === 'plugin')!.stack).toBe(false)
    expect(GROUPS.find((g) => g.id === 'channel')!.stack).toBe(false)
    expect(GROUPS.find((g) => g.id === 'model')!.stack).toBe(true)
    expect(GROUPS.find((g) => g.id === 'agent')!.stack).toBe(true)
  })

  it('每个组的分区顺序逐字对齐 Vue2', () => {
    expect(GROUPS.find((g) => g.id === 'model')!.items.map((i) => i.id))
      .toEqual(['models', 'providers', 'privacy', 'thinking'])
    expect(GROUPS.find((g) => g.id === 'agent')!.items.map((i) => i.id))
      .toEqual(['blacklist', 'execution', 'search', 'memory', 'observability'])
    expect(GROUPS.find((g) => g.id === 'plugin')!.items.map((i) => i.id))
      .toEqual(['skills', 'mcp', 'mcptokens'])
    expect(GROUPS.find((g) => g.id === 'channel')!.items.map((i) => i.id))
      .toEqual(['channels'])
  })

  it('ALL_ITEMS 是四个组的扁平拼接,长度 13', () => {
    expect(ALL_ITEMS).toHaveLength(13)
    expect(ALL_ITEMS[0].id).toBe('models')
    expect(ALL_ITEMS[12].id).toBe('channels')
  })

  it('groupOf 找到分区所属的组', () => {
    expect(groupOf('search').id).toBe('agent')
    expect(groupOf('channels').id).toBe('channel')
    expect(groupOf('models').id).toBe('model')
  })

  it('groupOf 对未知 id 回落到第一个组(Vue2 sections.js:62-64 同款兜底)', () => {
    expect(groupOf('nope').id).toBe('model')
  })

  it('SPLIT_SECTIONS 恰为 skills / mcp', () => {
    expect([...SPLIT_SECTIONS].sort()).toEqual(['mcp', 'skills'])
  })

  // SP8-P4 —— mcp 已接入真组件 McpSection,DEFERRED_SECTIONS 就此清空。
  // 契约机制本身保留(用户明示「反转不删」),这条钉住「没有任何分区还在占位」。
  it('DEFERRED_SECTIONS 为空(SP8-P4 起 13 个分区全部接入真组件)', () => {
    expect(DEFERRED_SECTIONS).toEqual([])
  })

  // 机制没被删掉的钉子:常量仍然导出、仍是数组、且每个元素(若将来有)都必须是
  // 合法 section id。
  it('DEFERRED_SECTIONS 机制仍在(导出为数组,元素必须是合法 section id)', () => {
    expect(Array.isArray(DEFERRED_SECTIONS)).toBe(true)
    for (const id of DEFERRED_SECTIONS) expect(VALID_SECTIONS).toContain(id)
  })

  it('每个分区都有图标名与 i18n 键,且 labelKey 走 aiCfg 前缀', () => {
    for (const it of ALL_ITEMS) {
      expect(it.icon.length).toBeGreaterThan(0)
      expect(it.labelKey).toMatch(/^aiCfg/)
    }
  })
})
