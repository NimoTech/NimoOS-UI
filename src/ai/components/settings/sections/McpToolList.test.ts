import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import zh from '../../../../i18n/zh_cn'
import type { McpToolRow } from '@nimotech/nimoos-service'

// Task 20 (2026-08-13 mcp-progressive-disclosure plan) -- per-server tool
// list with per-tool and server-level approval toggles. The first four
// `it(...)` blocks below are the brief's Step-1 contract, reproduced
// verbatim (assertions untouched); the surrounding harness (i18n plugin,
// pinia, service mock, `nowSec()` helper) follows this repo's existing
// McpSection.test.ts / McpServerDetail.test.ts conventions -- the brief's
// code block did not show that boilerplate, only the assertions.

const h = vi.hoisted(() => ({ setMCPApproval: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: h } }))

import McpToolList from './McpToolList.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function nowSec(): number {
  return Math.floor(Date.now() / 1000)
}

function mountList(props: { serverId: number | string; tools: McpToolRow[]; showServerLevel?: boolean }) {
  return mount(McpToolList, { props, global: { plugins: [i18n] } })
}

const tools: McpToolRow[] = [
  { name: 'create_issue', approved: true, last_seen_at: nowSec(), desc_changed: false },
  { name: 'old_tool', approved: true, last_seen_at: nowSec() - 40 * 86400, desc_changed: false },
  { name: 'changed', approved: true, last_seen_at: nowSec(), desc_changed: true },
]

beforeEach(() => {
  setActivePinia(createPinia())
  h.setMCPApproval.mockReset()
  h.setMCPApproval.mockResolvedValue(undefined)
})

describe('McpToolList', () => {
  it('每个工具渲染一个「不再询问」开关', () => {
    const w = mountList({ serverId: 1, tools })
    expect(w.findAll('[data-test=approval-toggle]')).toHaveLength(3)
  })

  it('长期未见的工具标灰并注明不在服务器上', () => {
    const w = mountList({ serverId: 1, tools })
    const row = w.find('[data-test=tool-row-old_tool]')
    expect(row.classes()).toContain('is-missing')
  })

  it('description 变更的工具打角标', () => {
    const w = mountList({ serverId: 1, tools })
    expect(w.find('[data-test=tool-row-changed] [data-test=desc-changed-badge]').exists()).toBe(true)
  })

  it('服务级开关的文案必须写明包含日后新增的工具', () => {
    const w = mountList({ serverId: 1, tools, showServerLevel: true })
    expect(w.find('[data-test=server-level-hint]').text()).toMatch(/新增|future|added later/)
  })
})

// Additional coverage beyond the brief's four verbatim tests -- English
// names/messages per the repo-wide convention for newly written tests.
describe('McpToolList -- additional behavior (Task 20)', () => {
  it('a recently-seen tool does not get the is-missing class', () => {
    const w = mountList({ serverId: 1, tools })
    expect(w.find('[data-test=tool-row-create_issue]').classes()).not.toContain('is-missing')
  })

  it('the server-level hint is absent when showServerLevel is not passed (defaults to false)', () => {
    const w = mountList({ serverId: 1, tools })
    expect(w.find('[data-test=server-level-hint]').exists()).toBe(false)
  })

  it('a non-empty stale_reason renders a per-row explanation, visually distinct from the desc-changed badge', () => {
    const staleTools: McpToolRow[] = [{
      name: 'voided_tool', approved: true, last_seen_at: nowSec(), desc_changed: false,
      stale_reason: 'config changed: server identity no longer matches the approved one',
    }]
    const w = mountList({ serverId: 1, tools: staleTools })
    const staleEl = w.find('[data-test=tool-row-voided_tool] [data-test=stale-reason]')
    expect(staleEl.exists()).toBe(true)
    expect(staleEl.text()).toBe('config changed: server identity no longer matches the approved one')
    // Distinct from the desc-changed badge: different class, and not rendered
    // as that badge even though this row's desc_changed is false.
    expect(staleEl.classes()).not.toContain('mcp-tool-badge-desc-changed')
    expect(w.find('[data-test=tool-row-voided_tool] [data-test=desc-changed-badge]').exists()).toBe(false)
  })

  it('a tool with no stale_reason renders no stale explanation', () => {
    const w = mountList({ serverId: 1, tools })
    expect(w.find('[data-test=tool-row-create_issue] [data-test=stale-reason]').exists()).toBe(false)
  })

  it('clicking a tool toggle calls setMCPApproval(serverId, name, !approved) and flips it optimistically', async () => {
    const w = mountList({
      serverId: 3,
      tools: [{ name: 'search', approved: false, last_seen_at: nowSec(), desc_changed: false }],
    })
    const toggle = w.find('[data-test=approval-toggle]')
    expect(toggle.attributes('data-on')).toBe('false')
    await toggle.trigger('click')
    expect(w.find('[data-test=approval-toggle]').attributes('data-on')).toBe('true')
    expect(h.setMCPApproval).toHaveBeenCalledWith(3, 'search', true)
  })

  it('a rejected setMCPApproval reverts the toggle (e.g. 403 for a server the caller does not own)', async () => {
    h.setMCPApproval.mockRejectedValueOnce(
      Object.assign(new Error('forbidden'), { response: { status: 403 } }),
    )
    const w = mountList({
      serverId: 3,
      tools: [{ name: 'search', approved: false, last_seen_at: nowSec(), desc_changed: false }],
    })
    await w.find('[data-test=approval-toggle]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test=approval-toggle]').attributes('data-on')).toBe('false')
  })

  it('the server-level toggle calls setMCPApproval(serverId, "*", true) when turned on', async () => {
    const w = mountList({ serverId: 9, tools: [], showServerLevel: true })
    await w.find('[data-test=server-level-toggle]').trigger('click')
    expect(h.setMCPApproval).toHaveBeenCalledWith(9, '*', true)
  })
})
