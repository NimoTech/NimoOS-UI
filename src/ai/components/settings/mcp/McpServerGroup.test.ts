import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import McpServerGroup from './McpServerGroup.vue'
import zh from '../../../../i18n/zh_cn'
import type { McpServer } from '../../../types/mcpServer'

// SP8-P4 Task 5 —— 对齐 Vue2 src/views/AI/MCP/McpServerGroup.vue(47 行)。
// brief Step 1 给的测试逐字照抄(公共约束 §2:brief 测试与 1:1 照 Vue2 冲突才是测试错,
// 本任务书里的测试与蓝本行为核对无冲突,故不改)。

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function srv(p: Partial<McpServer> = {}): McpServer {
  return {
    id: 1, name: 'brave', transport: 'http', url: 'https://example.com/mcp',
    command: '', args: [], enabled: true, has_headers: false, has_env: false, ...p,
  }
}
const mountG = (items: McpServer[], activeId: number | null = null) =>
  mount(McpServerGroup, { props: { label: '已启用服务', items, activeId }, global: { plugins: [i18n] } })

describe('McpServerGroup', () => {
  it('渲染分组标题与计数', () => {
    const w = mountG([srv(), srv({ id: 2, name: 'notion' })])
    expect(w.find('.sk-group-label').text()).toContain('已启用服务')
    expect(w.find('.sk-group-count').text()).toBe('2')
  })

  it('每项渲染名称、transport 标签、url', () => {
    const w = mountG([srv({ name: 'brave', transport: 'sse', url: 'https://x/sse' })])
    expect(w.find('.sk-item-name').text()).toBe('brave')
    expect(w.find('.mcp-transport').text()).toBe('SSE')
    expect(w.find('.mcp-transport').attributes('data-t')).toBe('sse')
    expect(w.find('.sk-item-desc').text()).toBe('https://x/sse')
  })

  it('点击条目 emit pick(id)', async () => {
    const w = mountG([srv({ id: 7 })])
    await w.find('.sk-item').trigger('click')
    expect(w.emitted('pick')).toEqual([[7]])
  })

  // 判别力:两项且只有第二项是 active —— 单元素数组测不出 activeId 是否真的比对了 id。
  it('只有 id 命中 activeId 的那一项带 data-active=true', () => {
    const w = mountG([srv({ id: 1 }), srv({ id: 2, name: 'b' })], 2)
    const items = w.findAll('.sk-item')
    expect(items[0].attributes('data-active')).toBe('false')
    expect(items[1].attributes('data-active')).toBe('true')
  })

  // 判别力:两项一开一关。
  it('停用项带 data-disabled=true 并显示 Off 角标,启用项不显示', () => {
    const w = mountG([srv({ id: 1, enabled: true }), srv({ id: 2, name: 'b', enabled: false })])
    const items = w.findAll('.sk-item')
    expect(items[0].attributes('data-disabled')).toBe('false')
    expect(items[1].attributes('data-disabled')).toBe('true')
    expect(items[0].find('.sk-item-off').exists()).toBe(false)
    expect(items[1].find('.sk-item-off').text()).toBe(zh.aiSkOff)
  })

  it('点标题折叠/展开(Vue2 :3 的 collapsed 开关)', async () => {
    const w = mountG([srv(), srv({ id: 2, name: 'b' })])
    expect(w.findAll('.sk-item')).toHaveLength(2)
    await w.find('.sk-group-label').trigger('click')
    expect(w.findAll('.sk-item')).toHaveLength(0)
    expect(w.find('.sk-group-label').attributes('data-collapsed')).toBe('true')
    await w.find('.sk-group-label').trigger('click')
    expect(w.findAll('.sk-item')).toHaveLength(2)
  })

  it('同名服务器拿到同一个色板 id(色块走 SkillTile)', () => {
    const w = mountG([srv({ id: 1, name: 'same' }), srv({ id: 2, name: 'same' })])
    const tiles = w.findAll('.sk-tile')
    expect(tiles[0].attributes('style')).toBe(tiles[1].attributes('style'))
  })
})
