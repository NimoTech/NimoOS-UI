import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import McpServerGroup from './McpServerGroup.vue'
import zh from '../../../../i18n/zh_cn'
import type { McpServer } from '../../../types/mcpServer'

// Align with Vue2 src/views/AI/MCP/McpServerGroup.vue (47 lines).
// brief Step 1 test copied verbatim (public constraint §2: brief test conflicts with 1:1 copy of Vue2 only if test is wrong,
// this task spec tests have no conflict with blueprint behavior, so no changes).

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function srv(p: Partial<McpServer> = {}): McpServer {
  return {
    id: 1, name: 'brave', transport: 'http', url: 'https://example.com/mcp',
    command: '', args: [], enabled: true, has_headers: false, has_env: false, ...p,
  }
}
const mountG = (items: McpServer[], activeId: number | null = null) =>
  mount(McpServerGroup, { props: { label: 'Enabled Services', items, activeId }, global: { plugins: [i18n] } })

describe('McpServerGroup', () => {
  it('render group title and count', () => {
    const w = mountG([srv(), srv({ id: 2, name: 'notion' })])
    expect(w.find('.sk-group-label').text()).toContain('Enabled Services')
    expect(w.find('.sk-group-count').text()).toBe('2')
  })

  it('each item renders name, transport label, url', () => {
    const w = mountG([srv({ name: 'brave', transport: 'sse', url: 'https://x/sse' })])
    expect(w.find('.sk-item-name').text()).toBe('brave')
    expect(w.find('.mcp-transport').text()).toBe('SSE')
    expect(w.find('.mcp-transport').attributes('data-t')).toBe('sse')
    expect(w.find('.sk-item-desc').text()).toBe('https://x/sse')
  })

  it('clicking item emits pick(id)', async () => {
    const w = mountG([srv({ id: 7 })])
    await w.find('.sk-item').trigger('click')
    expect(w.emitted('pick')).toEqual([[7]])
  })

  // discriminating power: two items with only second active — single-element array can't test if activeId actually matched id.
  it('only item with id matching activeId has data-active=true', () => {
    const w = mountG([srv({ id: 1 }), srv({ id: 2, name: 'b' })], 2)
    const items = w.findAll('.sk-item')
    expect(items[0].attributes('data-active')).toBe('false')
    expect(items[1].attributes('data-active')).toBe('true')
  })

  // discriminating power: two items, one enabled one disabled.
  it('disabled item has data-disabled=true and shows Off badge, enabled item doesn\'t', () => {
    const w = mountG([srv({ id: 1, enabled: true }), srv({ id: 2, name: 'b', enabled: false })])
    const items = w.findAll('.sk-item')
    expect(items[0].attributes('data-disabled')).toBe('false')
    expect(items[1].attributes('data-disabled')).toBe('true')
    expect(items[0].find('.sk-item-off').exists()).toBe(false)
    expect(items[1].find('.sk-item-off').text()).toBe(zh.aiSkOff)
  })

  it('clicking title collapses/expands (Vue2 :3 collapsed switch)', async () => {
    const w = mountG([srv(), srv({ id: 2, name: 'b' })])
    expect(w.findAll('.sk-item')).toHaveLength(2)
    await w.find('.sk-group-label').trigger('click')
    expect(w.findAll('.sk-item')).toHaveLength(0)
    expect(w.find('.sk-group-label').attributes('data-collapsed')).toBe('true')
    await w.find('.sk-group-label').trigger('click')
    expect(w.findAll('.sk-item')).toHaveLength(2)
  })

  it('same-named servers get same palette id (color block uses SkillTile)', () => {
    const w = mountG([srv({ id: 1, name: 'same' }), srv({ id: 2, name: 'same' })])
    const tiles = w.findAll('.sk-tile')
    expect(tiles[0].attributes('style')).toBe(tiles[1].attributes('style'))
  })
})
