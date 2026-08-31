import { describe, it, expect } from 'vitest'
import { GROUPS, ALL_ITEMS, VALID_SECTIONS, SPLIT_SECTIONS, DEFERRED_SECTIONS, groupOf } from './sections'

// Ported from Vue2 `src/views/AI/Settings/__tests__/SettingsRail.spec.js`
// three assertions on GROUPS (remaining methods assertions in this file go to SettingsRail.test.ts).

describe('sections navigation config', () => {
  it('four groups, order matches Vue2 sections.js:13-55', () => {
    expect(GROUPS.map((g) => g.id)).toEqual(['model', 'agent', 'plugin', 'channel'])
  })

  // Task 21 (mcp-progressive-disclosure) added 'mcpapprovals', agent web
  // tools Task 9 added 'web', permission policy added 'permissions', Vue2
  // parity added 'toolbox'/'lark', settings parity 2026-08-24 added
  // 'background' — now 19.
  it('still covers all 19 sections', () => {
    expect([...VALID_SECTIONS].sort()).toEqual([
      'background', 'blacklist', 'channels', 'execution', 'lark', 'mcp', 'mcpapprovals',
      'mcptokens', 'memory', 'models', 'observability', 'permissions', 'privacy', 'providers',
      'search', 'skills', 'thinking', 'toolbox', 'web',
    ])
  })

  it('groups with two-column full-height sections are swap mode, vertical groups are stack mode', () => {
    expect(GROUPS.find((g) => g.id === 'plugin')!.stack).toBe(false)
    expect(GROUPS.find((g) => g.id === 'channel')!.stack).toBe(false)
    expect(GROUPS.find((g) => g.id === 'model')!.stack).toBe(true)
    expect(GROUPS.find((g) => g.id === 'agent')!.stack).toBe(true)
  })

  it('each group\'s section order matches Vue2 exactly', () => {
    expect(GROUPS.find((g) => g.id === 'model')!.items.map((i) => i.id))
      .toEqual(['models', 'providers', 'privacy', 'thinking', 'background'])
    expect(GROUPS.find((g) => g.id === 'agent')!.items.map((i) => i.id))
      .toEqual(['permissions', 'blacklist', 'execution', 'search', 'memory', 'observability', 'web'])
    expect(GROUPS.find((g) => g.id === 'plugin')!.items.map((i) => i.id))
      .toEqual(['skills', 'mcp', 'mcpapprovals', 'mcptokens', 'toolbox', 'lark'])
    expect(GROUPS.find((g) => g.id === 'channel')!.items.map((i) => i.id))
      .toEqual(['channels'])
  })

  it('ALL_ITEMS is flat concatenation of four groups, length 19', () => {
    expect(ALL_ITEMS).toHaveLength(19)
    expect(ALL_ITEMS[0].id).toBe('models')
    expect(ALL_ITEMS[18].id).toBe('channels')
  })

  it('groupOf finds the group a section belongs to', () => {
    expect(groupOf('search').id).toBe('agent')
    expect(groupOf('channels').id).toBe('channel')
    expect(groupOf('models').id).toBe('model')
  })

  it('groupOf falls back to first group for unknown id (same fallback as Vue2 sections.js:62-64)', () => {
    expect(groupOf('nope').id).toBe('model')
  })

  it('SPLIT_SECTIONS is exactly skills / mcp', () => {
    expect([...SPLIT_SECTIONS].sort()).toEqual(['mcp', 'skills'])
  })

  // mcp has been integrated into real McpSection component, DEFERRED_SECTIONS is now empty.
  // Contract mechanism itself is preserved (user explicitly "keep don't delete"), this pins "no sections still in placeholder".
  it('DEFERRED_SECTIONS is empty (all 13 sections integrated into real components)', () => {
    expect(DEFERRED_SECTIONS).toEqual([])
  })

  // Pin for mechanism not deleted: constant still exported, still an array, and each element (if any in future) must be
  // valid section id.
  it('DEFERRED_SECTIONS mechanism still in place (exported as array, elements must be valid section ids)', () => {
    expect(Array.isArray(DEFERRED_SECTIONS)).toBe(true)
    for (const id of DEFERRED_SECTIONS) expect(VALID_SECTIONS).toContain(id)
  })

  it('each section has icon name and i18n key, labelKey uses aiCfg prefix', () => {
    for (const it of ALL_ITEMS) {
      expect(it.icon.length).toBeGreaterThan(0)
      expect(it.labelKey).toMatch(/^aiCfg/)
    }
  })

  // Task 9 (agent web tools) —— the web_search/web_fetch settings section is wired into the agent group.
  it('exposes the web section in the agent group', () => {
    const agent = GROUPS.find((g) => g.id === 'agent')!
    expect(agent.items.map((i) => i.id)).toContain('web')
  })
})
