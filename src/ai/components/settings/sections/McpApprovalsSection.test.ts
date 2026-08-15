// Task 21 (2026-08-13 mcp-progressive-disclosure plan) -- cross-server
// approvals overview + cascade-aware delete confirmation.
//
// Brief §Step1 sketched both tests with `global: { provide: fakeService(...) }`,
// but this repo never injects `service.ai.*` through provide/inject -- every
// sibling section (McpSection.test.ts, McpTokensSection.test.ts, ...) mocks the
// module directly with `vi.mock('@nimotech/nimoos-service', ...)` +
// `vi.hoisted`. Followed the real pattern here instead of the brief's sketch
// (same "assume the real code, not the brief's guess" latitude the task
// description gives for sections.ts).
//
// Both brief tests live in this one file (not a new McpSection.test.ts entry):
// the brief's own Step 5 `git add` list never mentions touching
// `McpSection.test.ts`, only creating this file -- so the second test (which
// mounts the real `McpSection`) is a second `describe` block here, with its
// own service mock shared with the first.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import zh from '../../../../i18n/zh_cn'
import type { McpServer } from '../../../types/mcpServer'

const h = vi.hoisted(() => ({
  listMCPApprovals: vi.fn(),
  clearMCPApprovals: vi.fn(),
  listMCPServers: vi.fn(),
  listMCPTools: vi.fn(),
  createMCPServer: vi.fn(),
  updateMCPServer: vi.fn(),
  deleteMCPServer: vi.fn(),
  testMCPServer: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: h } }))

import McpApprovalsSection from './McpApprovalsSection.vue'
import McpSection from './McpSection.vue'
import { useToast } from '../../../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function withHost() {
  const host = document.createElement('div')
  host.className = 'set-app'
  document.body.appendChild(host)
  return host
}

function srv(id: number, overrides: Partial<McpServer> = {}): McpServer {
  return {
    id,
    name: `server-${id}`,
    transport: 'http',
    url: `https://example.com/mcp-${id}`,
    command: '',
    args: [],
    enabled: true,
    has_headers: false,
    has_env: false,
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  Object.values(h).forEach((fn) => fn.mockReset())
  withHost()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('McpApprovalsSection', () => {
  function mountSection() {
    return mount(McpApprovalsSection, { global: { plugins: [i18n] }, attachTo: document.body })
  }

  // ===== Brief Step 1, test 1 (verbatim behavior) =====
  it('summarizes approvals grouped by server, with per-server revocation', async () => {
    h.listMCPApprovals.mockResolvedValue({
      items: [
        { server_id: 1, server_handle: 'github', tool_name: 'create_issue' },
        { server_id: 1, server_handle: 'github', tool_name: '*' },
        { server_id: 2, server_handle: 'notion', tool_name: 'search' },
      ],
    })
    const cleared: number[] = []
    h.clearMCPApprovals.mockImplementation((id: number) => {
      cleared.push(id)
      return Promise.resolve(undefined)
    })

    const w = mountSection()
    await flushPromises()

    expect(w.findAll('[data-test=approval-group]')).toHaveLength(2)

    await w.find('[data-test=revoke-server-1]').trigger('click')
    await flushPromises()
    expect(cleared).toContain(1)
  })

  it('renders the "*" row as a human sentence, not a bare asterisk', async () => {
    h.listMCPApprovals.mockResolvedValue({
      items: [{ server_id: 1, server_handle: 'github', tool_name: '*' }],
    })
    const w = mountSection()
    await flushPromises()

    const group = w.find('[data-test=approval-group]')
    expect(group.text()).not.toContain('*')
    expect(group.text()).toContain(zh.aiMcpApprovalsAllTools)
  })

  it('shows the server handle as the group label', async () => {
    h.listMCPApprovals.mockResolvedValue({
      items: [{ server_id: 7, server_handle: 'brave-search', tool_name: 'web_search' }],
    })
    const w = mountSection()
    await flushPromises()
    expect(w.find('[data-test=approval-group]').text()).toContain('brave-search')
  })

  it('empty state when there are no approvals at all', async () => {
    h.listMCPApprovals.mockResolvedValue({ items: [] })
    const w = mountSection()
    await flushPromises()
    expect(w.findAll('[data-test=approval-group]')).toHaveLength(0)
    expect(w.text()).toContain(zh.aiMcpApprovalsEmpty)
  })

  it('a listMCPApprovals rejection shows the load-failed note, not a crash', async () => {
    h.listMCPApprovals.mockRejectedValue(new Error('boom'))
    const w = mountSection()
    await flushPromises()
    expect(w.text()).toContain(zh.aiCfgLoadFailed)
  })

  it('a rejected clearMCPApprovals keeps the group visible and shows a danger toast, instead of silently pretending the revoke worked', async () => {
    h.listMCPApprovals.mockResolvedValue({
      items: [{ server_id: 1, server_handle: 'github', tool_name: 'create_issue' }],
    })
    h.clearMCPApprovals.mockRejectedValue(new Error('boom'))
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flushPromises()

    await w.find('[data-test=revoke-server-1]').trigger('click')
    await flushPromises()

    expect(w.findAll('[data-test=approval-group]')).toHaveLength(1)
    expect(show).toHaveBeenCalledWith(zh.aiMcpApprovalsRevokeFailed, 3000, 'danger')
  })
})

// ============================================================================
// Brief Step 1, test 2 (verbatim behavior): the delete confirmation must name
// the cascade -- how many stored approvals CASCADE will drop along with the
// server row. See McpServerDetail.vue's header comment for why the honest
// count comes from `listMCPTools` (stored truth, not the gated
// `listMCPApprovals` set) and where its `data-test` hooks actually live.
// ============================================================================
describe('McpSection — delete confirmation names the cascade (Task 21)', () => {
  function mountFullSection() {
    return mount(McpSection, { global: { plugins: [i18n] }, attachTo: document.body })
  }

  // The confirm dialog is a reka `DialogPortal to=".set-app"` (D6 in
  // McpServerDetail.vue's header comment -- required so its `var(--…)` theme
  // tokens resolve), so once open it lives under the manually-created
  // `.set-app` host, not under `w`'s own mounted subtree -- same reason
  // McpServerDetail.test.ts's own 9a-9c cases query `host.querySelector(...)`
  // rather than `w.find(...)` for it. `w.find` still works fine for the
  // (non-portaled) trigger button below.
  function confirmDialog(): HTMLElement {
    const el = document.querySelector('[data-test=delete-confirm]')
    if (!el) throw new Error('delete-confirm dialog not found')
    return el as HTMLElement
  }

  it('deleting a server warns it will also delete its approvals', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'github' })])
    // Stored truth per listMCPTools's contract: `approved` on a tool row and
    // `server_level_approved` both reflect a persisted approval row
    // regardless of gating -- one approved tool + a server-level grant = 2
    // rows CASCADE will delete.
    h.listMCPTools.mockResolvedValue({
      tools: [
        { name: 'create_issue', approved: true, last_seen_at: Date.now() / 1000, desc_changed: false },
        { name: 'close_issue', approved: false, last_seen_at: Date.now() / 1000, desc_changed: false },
      ],
      server_level_approved: true,
    })

    const w = mountFullSection()
    await flushPromises()

    await w.find('[data-test=delete-server-1]').trigger('click')
    await flushPromises()
    expect(confirmDialog().textContent).toMatch(/2\s*条|2 approvals/)
  })

  it('a server with zero stored approvals gets no cascade line at all (nothing to lose, nothing to warn about)', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'github' })])
    h.listMCPTools.mockResolvedValue({ tools: [], server_level_approved: false })

    const w = mountFullSection()
    await flushPromises()

    await w.find('[data-test=delete-server-1]').trigger('click')
    await flushPromises()
    expect(confirmDialog().textContent).not.toMatch(/approvals|条/)
  })
})
