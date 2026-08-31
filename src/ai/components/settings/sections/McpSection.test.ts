import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import zh from '../../../../i18n/zh_cn'
import type { McpServer } from '../../../types/mcpServer'
import McpServerGroup from '../mcp/McpServerGroup.vue'
import McpServerDetail from '../mcp/McpServerDetail.vue'
import McpServerModal from '../mcp/McpServerModal.vue'

// Matches Vue2 src/views/AI/MCP/McpSection.vue (136 lines).
// The mock skeleton follows brief §Step1's "mock skeleton" section and public constraint
// §9 verbatim (vi.hoisted avoids the ESM hoisting TDZ, precedent agentStore.test.ts:4-19).
const h = vi.hoisted(() => ({
  listMCPServers: vi.fn(),
  createMCPServer: vi.fn(),
  updateMCPServer: vi.fn(),
  deleteMCPServer: vi.fn(),
  testMCPServer: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: h } }))

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

const mountSection = () => mount(McpSection, { global: { plugins: [i18n] }, attachTo: document.body })
const flush = async () => { await nextTick(); await nextTick(); await nextTick() }
// McpServerModal's open-state focus uses setTimeout(fn, 0) (a macrotask, see that
// component's header comment "reka initial-focus test findings") — a purely microtask-level
// flush() can't catch up with it; precedent: McpServerModal.test.ts::macroFlush.
const macroFlush = async () => { await flush(); await new Promise((r) => setTimeout(r, 0)); await flush() }

function modalNameInput() { return document.querySelector('.sk-modal [data-f="name"]') as HTMLInputElement }
function modalTitleEl() { return document.querySelector('.sk-modal .sk-modal-title') as HTMLElement }
function modalCloseBtn() { return document.querySelector('.sk-modal .sk-x') as HTMLButtonElement }
function modalSubmitBtn() { return document.querySelector('.sk-modal-foot .sk-btn.primary') as HTMLButtonElement }
function modalFieldErr() { return document.querySelector('.sk-modal .sk-field-err') as HTMLElement | null }
function setValue(el: HTMLInputElement, v: string) {
  el.value = v
  el.dispatchEvent(new Event('input'))
}

beforeEach(() => {
  setActivePinia(createPinia())
  Object.values(h).forEach((fn) => fn.mockReset())
  h.listMCPServers.mockResolvedValue([])
  h.updateMCPServer.mockResolvedValue(undefined) // 204
  h.deleteMCPServer.mockResolvedValue(undefined) // 204
  h.createMCPServer.mockResolvedValue({ id: 7 })
  withHost()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('McpSection', () => {
  // ===== Coverage point 1: reload's single-layer unwrap + first item auto-selected =====
  it('1. listMCPServers returns a bare array -> renders two group entries, first item auto-selected', async () => {
    h.listMCPServers.mockResolvedValue([srv(1), srv(2)])
    const w = mountSection()
    await flush()
    expect(w.findAll('.sk-item')).toHaveLength(2)
    // The first item (server-1) is auto-selected -- the detail panel shows its name.
    expect(w.find('.sk-name span').text()).toBe('server-1')
  })

  // ===== Coverage point 2: reload failure =====
  it('2. listMCPServers throws -> toast.show(aiMcpSrvLoadFailed, 3000, danger)', async () => {
    h.listMCPServers.mockRejectedValue(new Error('boom'))
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    expect(show).toHaveBeenCalledWith(zh.aiMcpSrvLoadFailed, 3000, 'danger')
  })

  // ===== Coverage point 3: grouping =====
  it('3. enabled goes into "Enabled servers", disabled goes into "Disabled servers", renders two McpServerGroup when both groups are non-empty', async () => {
    h.listMCPServers.mockResolvedValue([
      srv(1, { enabled: true }),
      srv(2, { enabled: false }),
    ])
    const w = mountSection()
    await flush()
    const groups = w.findAllComponents(McpServerGroup)
    expect(groups).toHaveLength(2)
    expect(groups[0].props('label')).toBe(zh.aiMcpSrvGroupEnabled)
    expect(groups[0].props('items').map((s: McpServer) => s.id)).toEqual([1])
    expect(groups[1].props('label')).toBe(zh.aiMcpSrvGroupDisabled)
    expect(groups[1].props('items').map((s: McpServer) => s.id)).toEqual([2])
  })

  // ===== Coverage point 4: search (name/url match + two empty states) =====
  it('4a. search matches by name', async () => {
    h.listMCPServers.mockResolvedValue([
      srv(1, { name: 'brave-search-token', url: 'https://a.example.com' }),
      srv(2, { name: 'notion', url: 'https://b.example.com' }),
    ])
    const w = mountSection()
    await flush()
    await w.find('.sk-col-search input').setValue('brave-search')
    await flush()
    expect(w.findAll('.sk-item')).toHaveLength(1)
    expect(w.find('.sk-item-name').text()).toBe('brave-search-token')
  })

  it('4b. search matches by url', async () => {
    h.listMCPServers.mockResolvedValue([
      srv(1, { name: 'aaa', url: 'https://unique-url-token.example.com' }),
      srv(2, { name: 'bbb', url: 'https://other.example.com' }),
    ])
    const w = mountSection()
    await flush()
    await w.find('.sk-col-search input').setValue('unique-url-token')
    await flush()
    expect(w.findAll('.sk-item')).toHaveLength(1)
    expect(w.find('.sk-item-name').text()).toBe('aaa')
  })

  it('4c. neither matches -> .sk-col-empty shows aiMcpSrvNoMatch + the query term inside <code>', async () => {
    h.listMCPServers.mockResolvedValue([srv(1), srv(2)])
    const w = mountSection()
    await flush()
    await w.find('.sk-col-search input').setValue('nope-nothing-matches')
    await flush()
    expect(w.find('.sk-col-empty').text()).toContain(zh.aiMcpSrvNoMatch)
    expect(w.find('.sk-col-empty code').text()).toBe('nope-nothing-matches')
  })

  it('4d. empty list with no query term -> aiMcpSrvEmpty', async () => {
    h.listMCPServers.mockResolvedValue([])
    const w = mountSection()
    await flush()
    expect(w.find('.sk-col-empty').text()).toBe(zh.aiMcpSrvEmpty)
  })

  // ===== Coverage point 5: search doesn't clear the right-hand detail panel (pins down N4) =====
  it('5. selecting an item then typing a query with no match -> list is empty, but detail panel still shows that server', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'alpha' }), srv(2, { name: 'beta' })])
    const w = mountSection()
    await flush()
    await w.findAll('.sk-item')[1].trigger('click')
    await flush()
    expect(w.find('.sk-name span').text()).toBe('beta')

    await w.find('.sk-col-search input').setValue('zzz-no-match')
    await flush()
    expect(w.findAll('.sk-item')).toHaveLength(0)
    expect(w.find('.sk-name span').text()).toBe('beta')
  })

  // ===== Coverage point 6: onToggle (204 return value not read + group move + toast comparison + failure) =====
  it('6a. toggle succeeds (enabled -> disabled): 204 return value not read, list item moves from the enabled group to the disabled group, toast aiMcpSrvDisabledToast', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'svc-a', enabled: true })])
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('toggle', 1, false)
    await flush()

    expect(h.updateMCPServer).toHaveBeenCalledWith(1, { enabled: false })
    const groups = w.findAllComponents(McpServerGroup)
    expect(groups).toHaveLength(1)
    expect(groups[0].props('label')).toBe(zh.aiMcpSrvGroupDisabled)
    expect(show).toHaveBeenCalledWith(zh.aiMcpSrvDisabledToast)
  })

  it('6b. toggle succeeds (disabled -> enabled): toast aiMcpSrvEnabledToast (comparison)', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'svc-a', enabled: false })])
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('toggle', 1, true)
    await flush()

    const groups = w.findAllComponents(McpServerGroup)
    expect(groups[0].props('label')).toBe(zh.aiMcpSrvGroupEnabled)
    expect(show).toHaveBeenCalledWith(zh.aiMcpSrvEnabledToast)
  })

  it('6c. toggle fails -> toast aiMcpSrvUpdateFailed danger, list unchanged', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'svc-a', enabled: true })])
    h.updateMCPServer.mockRejectedValue(new Error('boom'))
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('toggle', 1, false)
    await flush()

    expect(show).toHaveBeenCalledWith(zh.aiMcpSrvUpdateFailed, 3000, 'danger')
    // Still enabled, the enabled group is still present.
    const groups = w.findAllComponents(McpServerGroup)
    expect(groups[0].props('label')).toBe(zh.aiMcpSrvGroupEnabled)
  })

  // ===== Coverage point 7: onDelete success/failure =====
  it('7a. delete succeeds -> item disappears + toast aiMcpSrvRemovedName (includes the name)', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'to-remove' })])
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('delete', 1)
    await flush()

    expect(h.deleteMCPServer).toHaveBeenCalledWith(1)
    expect(w.findAll('.sk-item')).toHaveLength(0)
    expect(show).toHaveBeenCalledWith(zh.aiMcpSrvRemovedName.replace('{name}', 'to-remove'))
  })

  it('7b. delete fails -> toast aiCfgDeleteFailed danger', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'stays' })])
    h.deleteMCPServer.mockRejectedValue(new Error('boom'))
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('delete', 1)
    await flush()

    expect(show).toHaveBeenCalledWith(zh.aiCfgDeleteFailed, 3000, 'danger')
    expect(w.findAll('.sk-item')).toHaveLength(1)
  })

  // ===== Coverage point 8: selected-item placement after delete (two comparison cases) =====
  // Three-item fixture [a,b,c], first switch to c (not the first item of the remaining
  // list [a,c] after deletion) -- if the condition were removed / it unconditionally fell
  // back to skills[0], activeId would wrongly jump to a; with the condition in effect it
  // stays c.
  it('8a. the deleted item is the currently selected one -> activeId falls back to the first remaining item', async () => {
    h.listMCPServers.mockResolvedValue([
      srv(1, { name: 'svc-a' }), srv(2, { name: 'svc-b' }), srv(3, { name: 'svc-c' }),
    ])
    const w = mountSection()
    await flush()
    await w.findAll('.sk-item')[1].trigger('click') // Select b
    await flush()
    expect(w.find('.sk-name span').text()).toBe('svc-b')

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('delete', 2) // Delete exactly the currently selected b
    await flush()

    // Remaining [a, c], the first item is a.
    expect(w.find('.sk-name span').text()).toBe('svc-a')
  })

  it('8b. the deleted item is not the currently selected one -> activeId stays put', async () => {
    h.listMCPServers.mockResolvedValue([
      srv(1, { name: 'svc-a' }), srv(2, { name: 'svc-b' }), srv(3, { name: 'svc-c' }),
    ])
    const w = mountSection()
    await flush()
    await w.findAll('.sk-item')[2].trigger('click') // Select c
    await flush()
    expect(w.find('.sk-name span').text()).toBe('svc-c')

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('delete', 2) // Delete b, not the currently selected c
    await flush()

    // The first item of the remaining [a, c] is a -- an unconditional fallback would
    // wrongly jump to a; the correct implementation should still be c.
    expect(w.findAll('.sk-item')).toHaveLength(2)
    expect(w.find('.sk-name span').text()).toBe('svc-c')
  })

  // ===== Coverage point 9: onSave create's single-layer unwrap =====
  // Final review Important I1 (2026-07-31) -- the original fixture was "empty list ->
  // single item after create", so even if the implementation were written Vue2-style with
  // a double unwrap (`(created as any).data?.id` always undefined), `reload()`'s
  // `!activeId.value` fallback would **coincidentally** select that one-and-only record,
  // all 53 tests would still pass green, and the test case couldn't tell right from wrong
  // (see final review §5 RED probe A). Changed to "already 2 items before creating, one of
  // them already selected" -- the backend `service/mcp.go:63` is `ORDER BY id` ascending,
  // and the newly created server has the largest id, so it lands at the **end** of the
  // list on the second fetch, not at servers[0]. Under this setup, with the
  // double-unwrap defect `id` is always undefined and `activeId` stays put on the
  // previously selected svc-b (reload's `!activeId.value || !found` fallback won't
  // trigger either, since svc-b is still in the new list) -- the assertion fails
  // precisely; with the correct single-layer-unwrap implementation, `activeId` gets set
  // directly to 7 inside onSave -- the assertion passes precisely.
  it('9. createMCPServer returns a bare {id:7} -> activeId becomes 7 (not the previously selected item) + toast aiMcpSrvAddedName + dialog closes + reloads once', async () => {
    h.listMCPServers
      .mockResolvedValueOnce([srv(1, { name: 'svc-a' }), srv(2, { name: 'svc-b' })])
      .mockResolvedValueOnce([srv(1, { name: 'svc-a' }), srv(2, { name: 'svc-b' }), srv(7, { name: 'new-one' })])
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    expect(h.listMCPServers).toHaveBeenCalledTimes(1)

    // The normal real-world scenario: the user already has a server selected before
    // creating a new one (not the empty state).
    await w.findAll('.sk-item')[1].trigger('click')
    await flush()
    expect(w.find('.sk-name span').text()).toBe('svc-b')

    await w.find('.sk-add-btn').trigger('click')
    await macroFlush()
    expect(modalTitleEl().textContent).toBe(zh.aiMcpSrvAdd)

    setValue(modalNameInput(), 'new-one')
    const urlInput = document.querySelector('.sk-modal [data-f="url"]') as HTMLInputElement
    setValue(urlInput, 'https://example.com/new')
    await flush()
    modalSubmitBtn().click()
    await flush()

    expect(h.createMCPServer).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.sk-modal')).toBeNull() // Dialog already closed
    expect(show).toHaveBeenCalledWith(zh.aiMcpSrvAddedName.replace('{name}', 'new-one'))
    expect(h.listMCPServers).toHaveBeenCalledTimes(2) // Triggers one reload
    // activeId lands on the newly created 7, not the previously selected svc-b, and not
    // the first item in the list svc-a -- under the double-unwrap defect this would still
    // show svc-b (see this test case's header comment above).
    expect(w.find('.sk-name span').text()).toBe('new-one')
  })

  // ===== Coverage point 10: onSave edit =====
  it('10. saving an edit -> calls updateMCPServer(editingId, payload) + toast aiCfgSaved + dialog closes', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'svc-a', url: 'https://a.example.com' })])
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('edit', srv(1, { name: 'svc-a', url: 'https://a.example.com' }))
    await macroFlush()
    expect(modalTitleEl().textContent).toBe(zh.aiMcpSrvEditTitle)

    modalSubmitBtn().click()
    await flush()

    expect(h.updateMCPServer).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'svc-a' }))
    expect(show).toHaveBeenCalledWith(zh.aiCfgSaved)
    expect(document.querySelector('.sk-modal')).toBeNull()
  })

  // ===== Coverage point 11: on save failure the dialog stays open + inline localized error =====
  it('11. save fails -> dialog stays open, inline error goes through saveServerErrorKey localized copy, doesn\'t contain the raw backend English string', async () => {
    h.listMCPServers.mockResolvedValue([])
    h.createMCPServer.mockRejectedValue({ response: { data: { message: 'url required for http/sse' } } })
    const w = mountSection()
    await flush()

    await w.find('.sk-add-btn').trigger('click')
    await macroFlush()
    setValue(modalNameInput(), 'no-url')
    const urlInput = document.querySelector('.sk-modal [data-f="url"]') as HTMLInputElement
    setValue(urlInput, 'https://example.com/x')
    await flush()
    modalSubmitBtn().click()
    await flush()

    expect(document.querySelector('.sk-modal')).not.toBeNull() // Dialog still open
    expect(modalFieldErr()?.textContent).toBe(zh.aiMcpSrvErrUrlRequired)
    expect(document.body.textContent).not.toContain('url required for http/sse')
  })

  // ===== Coverage point 12: + opens create (server=null); edit event opens edit (server=that item) =====
  it('12a. clicking + opens the create dialog, server prop is null (name input is empty)', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'existing' })])
    const w = mountSection()
    await flush()
    await w.find('.sk-add-btn').trigger('click')
    await macroFlush()
    expect(modalTitleEl().textContent).toBe(zh.aiMcpSrvAdd)
    expect(modalNameInput().value).toBe('')
  })

  it('12b. the detail panel\'s edit event opens the edit dialog, server prop is that item (name input is backfilled)', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'existing-one' })])
    const w = mountSection()
    await flush()
    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('edit', srv(1, { name: 'existing-one' }))
    await macroFlush()
    expect(modalTitleEl().textContent).toBe(zh.aiMcpSrvEditTitle)
    expect(modalNameInput().value).toBe('existing-one')
  })

  // ===== Coverage point 13 (fix round M5, correcting an undeclared divergence) =====
  // Vue2's `closeModal()` (`:85`) is `{ this.modalOpen = false; this.editing = null }`
  // -- **every** close path clears `editing`. This repo previously only cleared it inside
  // `closeModal()` (only called after a successful save); the cancel/X/overlay close
  // paths all go through `v-model:open` setting `modalOpen` to false directly, bypassing
  // `closeModal()`, so `editing` would keep its stale value, and the `server` prop passed
  // to `McpServerModal` would keep it too -- this was moved into `watch(modalOpen)` to
  // clear it uniformly, pinning down this behavior.
  it('13. canceling out of the edit dialog (X button, not the save path) -> editing is cleared, McpServerModal\'s server prop becomes null', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'svc-a' })])
    const w = mountSection()
    await flush()

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('edit', srv(1, { name: 'svc-a' }))
    await macroFlush()
    const modal = w.findComponent(McpServerModal)
    expect(modal.props('server')?.id).toBe(1)

    modalCloseBtn().click() // Cancel path (X button), not save
    await flush()

    expect(modal.props('server')).toBeNull()
  })
})

// ============================================================================
// Two integration test cases the coordinator added (found during T8 review:
// McpServerModal's `watch(open)` true branch backfills from `props.server`, relying on
// the parent component setting the `server` + `open` props in sync -- a single-component
// test can't catch this, so an integration test had to be added here at the container
// level).
// ============================================================================
describe('McpSection -- form-leftover regression for the always-mounted dialog instance', () => {
  it('edit A -> close -> edit B: the name in the dialog is B\'s, not a leftover from A', async () => {
    h.listMCPServers.mockResolvedValue([
      srv(1, { name: 'server-A' }), srv(2, { name: 'server-B' }),
    ])
    const w = mountSection()
    await flush()

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('edit', srv(1, { name: 'server-A' }))
    await macroFlush()
    expect(modalNameInput().value).toBe('server-A')

    modalCloseBtn().click()
    await flush()
    expect(document.querySelector('.sk-modal')).toBeNull()

    detail.vm.$emit('edit', srv(2, { name: 'server-B' }))
    await macroFlush()
    expect(modalNameInput().value).toBe('server-B')
    expect(modalNameInput().value).not.toBe('server-A')
  })

  it('create -> close -> edit: the dialog shows that server\'s data, no leftover from the previous create', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'existing-server' })])
    const w = mountSection()
    await flush()

    await w.find('.sk-add-btn').trigger('click')
    await macroFlush()
    expect(modalNameInput().value).toBe('')
    setValue(modalNameInput(), 'leftover-draft-name')
    await flush()
    expect(modalNameInput().value).toBe('leftover-draft-name')

    modalCloseBtn().click()
    await flush()
    expect(document.querySelector('.sk-modal')).toBeNull()

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('edit', srv(1, { name: 'existing-server' }))
    await macroFlush()
    expect(modalNameInput().value).toBe('existing-server')
    expect(modalNameInput().value).not.toBe('leftover-draft-name')
  })
})

// ============================================================================
// Task 19 follow-up (review finding 1): the brief listed this file as a file
// to modify for the synchronous post-save probe (`probing` flag +
// `service.ai.testMCPServer` + `toTestView`/`toTestViewFromError` mapping),
// but the commit never added component-level coverage for it. These cases
// pin: the `probing` lifecycle around the in-flight request, the `finally`
// clearing it even when the probe throws, a `{ok:false}` resolution
// surfacing as a danger toast (never a success one), and `probeServer`
// receiving the right server id from both the create and the edit branch of
// `onSave`.
// ============================================================================
describe('McpSection — probe-on-save wiring (Task 19)', () => {
  function pendingTestMCPServer() {
    let resolve!: (v: unknown) => void
    const promise = new Promise((res) => { resolve = res })
    h.testMCPServer.mockReturnValue(promise)
    return { resolve }
  }

  function probingSpinner() {
    return document.querySelector('.sk-spinner[title]')
  }

  it('14. probing is true while testMCPServer is in flight, and false once it resolves', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'svc-a' })])
    const { resolve } = pendingTestMCPServer()
    const w = mountSection()
    await flush()

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('edit', srv(1, { name: 'svc-a' }))
    await macroFlush()
    modalSubmitBtn().click()
    await flush()
    await flush()

    // The save (updateMCPServer) and reload have both already resolved by
    // here -- the still-pending testMCPServer call is the only thing left
    // in flight, so the probing indicator must be up.
    expect(probingSpinner()).not.toBeNull()

    resolve({ ok: true, tool_count: 2, tools: [] })
    await flush()

    expect(probingSpinner()).toBeNull()
  })

  it('15. testMCPServer throwing still clears probing (finally path) -- no stuck "in progress" indicator', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'svc-a' })])
    h.testMCPServer.mockRejectedValue(new Error('network timeout'))
    const w = mountSection()
    await flush()

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('edit', srv(1, { name: 'svc-a' }))
    await macroFlush()
    modalSubmitBtn().click()
    await flush()
    await flush()

    expect(probingSpinner()).toBeNull()
  })

  it('16. a probe resolving with {ok:false} surfaces a danger toast, never a success one', async () => {
    h.listMCPServers.mockResolvedValue([srv(1, { name: 'svc-a' })])
    h.testMCPServer.mockResolvedValue({ ok: false, error_key: 'connect_failed', detail: 'x' })
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('edit', srv(1, { name: 'svc-a' }))
    await macroFlush()
    modalSubmitBtn().click()
    await flush()
    await flush()

    expect(show).toHaveBeenCalledWith(zh.aiMcpSrvTestErrConnect, 3000, 'danger')
    expect(show).not.toHaveBeenCalledWith(expect.stringContaining('已连接'))
  })

  it('17a. probeServer is invoked with the newly created server id (create branch)', async () => {
    h.listMCPServers
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([srv(9, { name: 'new-one' })])
    h.createMCPServer.mockResolvedValue({ id: 9 })
    h.testMCPServer.mockResolvedValue({ ok: true, tool_count: 1, tools: [] })
    const w = mountSection()
    await flush()

    await w.find('.sk-add-btn').trigger('click')
    await macroFlush()
    setValue(modalNameInput(), 'new-one')
    const urlInput = document.querySelector('.sk-modal [data-f="url"]') as HTMLInputElement
    setValue(urlInput, 'https://example.com/new')
    await flush()
    modalSubmitBtn().click()
    await flush()
    await flush()

    expect(h.testMCPServer).toHaveBeenCalledWith(9)
  })

  it('17b. probeServer is invoked with the edited server id (edit branch)', async () => {
    h.listMCPServers.mockResolvedValue([srv(4, { name: 'svc-d' })])
    h.testMCPServer.mockResolvedValue({ ok: true, tool_count: 1, tools: [] })
    const w = mountSection()
    await flush()

    const detail = w.findComponent(McpServerDetail)
    detail.vm.$emit('edit', srv(4, { name: 'svc-d' }))
    await macroFlush()
    modalSubmitBtn().click()
    await flush()
    await flush()

    expect(h.testMCPServer).toHaveBeenCalledWith(4)
  })
})
