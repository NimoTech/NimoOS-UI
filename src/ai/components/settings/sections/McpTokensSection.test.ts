import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'

// SP8-P2b Task 10 — Follow Vue2 sections/__tests__/McpTokensSection.spec.js 's 5 tests
// Component-level tests (1 load three tests + createToken + doDelete + onRevealClosed total 6 tests, brief counted
// 5 by treating load's 3 as 1 group; here land all by Vue2 blueprint's it() count, cases 1-6 below),
// plus brief's newly added 11 tests (7-17). Pure function assertions (endpointUrl/buildInstruction/buildJson/
// fmtCreated/fmtLastUsed) already covered by Task 9's mcpConnect.test.ts, not repeated here.

const h = vi.hoisted(() => ({
  listMCPTokens: vi.fn(),
  createMCPToken: vi.fn(),
  deleteMCPToken: vi.fn(),
  copyText: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    ai: {
      listMCPTokens: h.listMCPTokens,
      createMCPToken: h.createMCPToken,
      deleteMCPToken: h.deleteMCPToken,
    },
  },
}))
vi.mock('../../../../files/util/clipboard', () => ({ copyText: h.copyText }))

import McpTokensSection from './McpTokensSection.vue'
import { useToast } from '../../../../stores/toast'
import AgentIcon from '../../icons/AgentIcon.vue'
import { mcpEndpointUrl } from '../../../util/mcpConnect'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountSection() {
  return mount(McpTokensSection, { global: { plugins: [i18n] }, attachTo: document.body })
}

const flush = async () => { await nextTick(); await nextTick(); await nextTick() }

/** Click the reka-ui AlertDialogAction whose visible text matches `label`
 *  (excludes PromptDialog's data-testid buttons, same technique as ProvidersSection.test.ts). */
function clickAlertAction(label: string) {
  const btn = Array.from(document.body.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === label && b.className.includes('ui-btn') && !b.dataset.testid,
  ) as HTMLButtonElement | undefined
  expect(btn).toBeTruthy()
  btn!.click()
}

function typePromptValue(value: string) {
  const input = document.body.querySelector('.ui-dialog-input') as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input'))
}

function clickPromptConfirm() {
  const btn = document.body.querySelector('[data-testid="prompt-confirm"]') as HTMLButtonElement | null
  expect(btn).toBeTruthy()
  btn!.click()
}

function clickPromptCancel() {
  const btn = document.body.querySelector('[data-testid="prompt-cancel"]') as HTMLButtonElement | null
  expect(btn).toBeTruthy()
  btn!.click()
}

describe('McpTokensSection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    h.listMCPTokens.mockReset()
    h.createMCPToken.mockReset()
    h.deleteMCPToken.mockReset()
    h.copyText.mockReset()
    h.listMCPTokens.mockResolvedValue({ tokens: [] })
    // SkModal's plaintext modal portal target defaults to '.set-app' (see SkModal.vue header comment D1).
    // Target element must exist in DOM before component mount, same pattern as SkModal.test.ts withHost().
    const host = document.createElement('div')
    host.className = 'set-app'
    document.body.appendChild(host)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  // ---- Following Vue2 6 tests ----

  it('1. load() populates list with res.tokens (this repo service.ai.* already stripped Vue2\'s axios .data layer, see component header)', async () => {
    h.listMCPTokens.mockResolvedValue({
      tokens: [{ id: 'a', label: 'laptop', created_at: 1710000000000, last_used_at: null }],
    })
    const w = mountSection()
    await flush()
    const rows = w.findAll('.tok-row')
    expect(rows).toHaveLength(1)
    expect(rows[0].find('.tok-name').text()).toBe('laptop')
    expect(w.find('.set-note').exists()).toBe(false)
  })

  it('2. Missing tokens key normalizes to empty array, renders empty state text', async () => {
    h.listMCPTokens.mockResolvedValue({})
    const w = mountSection()
    await flush()
    expect(w.findAll('.tok-row')).toHaveLength(0)
    expect(w.find('.set-note').text()).toBe('还没有令牌。创建一个,让外部 AI agent 能连接你的 NAS。')
  })

  it('3. load() failure renders "load failed."', async () => {
    h.listMCPTokens.mockRejectedValue(new Error('boom'))
    const w = mountSection()
    await flush()
    expect(w.find('.set-note').text()).toBe('加载失败。')
  })

  it('4. createToken() shows plaintext once, does not enter list, does not re-fetch list', async () => {
    h.createMCPToken.mockResolvedValue({ id: 'b', token: 'nimoos_mcp_secret', label: 'x' })
    const w = mountSection()
    await flush()
    await w.find('.sk-btn.primary').trigger('click')
    await flush()
    typePromptValue('x')
    await nextTick()
    h.listMCPTokens.mockClear()
    clickPromptConfirm()
    await flush()
    expect(h.createMCPToken).toHaveBeenCalledWith({ label: 'x' })
    expect(h.listMCPTokens).not.toHaveBeenCalled()
    // Plaintext sits on <input readonly>'s .value property, not text node, cannot grab with textContent
    const revealInput = document.querySelector('.sk-modal input.set-input.full.mono') as HTMLInputElement
    expect(revealInput.value).toBe('nimoos_mcp_secret')
    // Component's own subtree (excluding teleported modal content to .set-app) has no plaintext, proves list was not written
    expect(w.html()).not.toContain('nimoos_mcp_secret')
  })

  it('5. doDelete() calls API and removes that row, keeps other rows', async () => {
    h.listMCPTokens.mockResolvedValue({
      tokens: [{ id: 'a', label: 'one' }, { id: 'b', label: 'two' }],
    })
    h.deleteMCPToken.mockResolvedValue({ revoked: true })
    const w = mountSection()
    await flush()
    await w.findAll('.tok-del')[0].trigger('click')
    await flush()
    clickAlertAction('删除')
    await flush()
    expect(h.deleteMCPToken).toHaveBeenCalledWith('a')
    expect(w.findAll('.tok-name').map((el) => el.text())).toEqual(['two'])
  })

  it('6. onRevealClose() (Done button) clears plaintext and re-fetches list', async () => {
    h.createMCPToken.mockResolvedValue({ id: 'b', token: 'nimoos_mcp_secret', label: 'x' })
    const w = mountSection()
    await flush()
    await w.find('.sk-btn.primary').trigger('click')
    await flush()
    typePromptValue('x')
    await nextTick()
    clickPromptConfirm()
    await flush()
    let revealInput = document.querySelector('.sk-modal input.set-input.full.mono') as HTMLInputElement
    expect(revealInput.value).toBe('nimoos_mcp_secret')

    h.listMCPTokens.mockResolvedValueOnce({
      tokens: [{ id: 'b', label: 'x', created_at: 2, last_used_at: null }],
    })
    const doneBtn = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '完成' && b.className.includes('sk-btn'),
    ) as HTMLButtonElement
    expect(doneBtn).toBeTruthy()
    doneBtn.click()
    await flush()
    expect(document.querySelector('.sk-modal')).toBeNull() // Modal closed, plaintext not even in DOM anymore
    expect(h.listMCPTokens).toHaveBeenCalledTimes(2) // Called once at mount + once again after closing modal
    expect(w.findAll('.tok-name').map((el) => el.text())).toEqual(['x'])
  })

  // ---- Added 11 tests ----

  it('7. Endpoint URL read-only input displays value of mcpEndpointUrl()', async () => {
    const w = mountSection()
    await flush()
    const input = w.find('.set-row.top .set-input.full.mono')
    expect((input.element as HTMLInputElement).value).toBe(mcpEndpointUrl())
    expect(input.attributes('readonly')).toBeDefined()
  })

  it('8. Endpoint copy button calls copyText(endpointUrl) and shows "copied"', async () => {
    h.copyText.mockResolvedValue(undefined)
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    await w.findAll('.set-copybtn')[0].trigger('click')
    await flush()
    expect(h.copyText).toHaveBeenCalledWith(mcpEndpointUrl())
    expect(show).toHaveBeenCalledWith('已复制')
  })

  // [SP8-P2b acceptance round 5, user requirement 2026-07-30] "After clicking copy, put a checkmark on
  // the corresponding copy button, indicating already copied, reset when clicking copy for something else".
  // Only one button shows checkmark at a time.
  // Checkmark state reuses `.set-copybtn.done` from settings-styles.scss:115 (both repos had dead styles originally,
  // see useCopyFeedback.ts header), icon changes from copy to check.
  it('8b. After successful copy, that button shows checkmark (.done + check icon); checkmark moves when copying something else', async () => {
    h.copyText.mockResolvedValue(undefined)
    const w = mountSection()
    await flush()
    const btns = () => w.findAll('.set-copybtn')
    const iconName = (i: number) =>
      btns()[i].findComponent(AgentIcon).props('name')

    // Initially: no one has checkmark, icons are all copy
    expect(btns()[0].classes()).not.toContain('done')
    expect(iconName(0)).toBe('copy')

    await btns()[0].trigger('click')
    await flush()
    expect(btns()[0].classes()).toContain('done')
    expect(iconName(0)).toBe('check')
    expect(btns()[1].classes()).not.toContain('done')

    // Copy something else → checkmark moves, old one removed
    await btns()[1].trigger('click')
    await flush()
    expect(btns()[1].classes()).toContain('done')
    expect(iconName(1)).toBe('check')
    expect(btns()[0].classes()).not.toContain('done')
    expect(iconName(0)).toBe('copy')
  })

  it('8c. Copy failure does not show checkmark, removes old checkmark', async () => {
    h.copyText.mockResolvedValue(undefined)
    const w = mountSection()
    await flush()
    await w.findAll('.set-copybtn')[0].trigger('click')
    await flush()
    expect(w.findAll('.set-copybtn')[0].classes()).toContain('done')

    h.copyText.mockRejectedValueOnce(new Error('trap'))
    await w.findAll('.set-copybtn')[1].trigger('click')
    await flush()
    const btns = w.findAll('.set-copybtn')
    expect(btns[0].classes()).not.toContain('done')
    expect(btns[1].classes()).not.toContain('done')
  })

  it('9. Persistent onboarding instruction box uses placeholder token <YOUR_TOKEN> (not real token)', async () => {
    const w = mountSection()
    await flush()
    const textareas = w.findAll('textarea.set-input.code')
    expect(textareas).toHaveLength(2)
    expect((textareas[0].element as HTMLTextAreaElement).value).toContain('<YOUR_TOKEN>')
    expect((textareas[1].element as HTMLTextAreaElement).value).toContain('<YOUR_TOKEN>')
  })

  it('10. Two persistent copy buttons respectively copy instruction text (template start) and valid config JSON', async () => {
    h.copyText.mockResolvedValue(undefined)
    const w = mountSection()
    await flush()
    const copyBtns = w.findAll('.set-copybtn')
    await copyBtns[1].trigger('click')
    await flush()
    const instrArg = h.copyText.mock.calls[0][0] as string
    expect(instrArg.startsWith('你将获得一台 NimoOS 个人云 MCP 服务器的访问权限')).toBe(true)

    h.copyText.mockClear()
    await copyBtns[2].trigger('click')
    await flush()
    const jsonArg = h.copyText.mock.calls[0][0] as string
    const parsed = JSON.parse(jsonArg)
    expect(parsed.mcpServers.nimoos.url).toBe(mcpEndpointUrl())
  })

  it('11. copyText failure shows "copy failed, please select manually" warning toast', async () => {
    h.copyText.mockRejectedValue(new Error('denied'))
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    await w.findAll('.set-copybtn')[0].trigger('click')
    await flush()
    expect(show).toHaveBeenCalledWith('复制失败,请手动选择', 3000, 'warning')
  })

  it('12. Token row metadata: created at / never used (.never) / last used', async () => {
    h.listMCPTokens.mockResolvedValue({
      tokens: [
        { id: 'a', label: 'never-one', created_at: 1710000000000, last_used_at: null },
        { id: 'b', label: 'used-one', created_at: 1710000000000, last_used_at: 1720000000000 },
      ],
    })
    const w = mountSection()
    await flush()
    const rows = w.findAll('.tok-row')

    expect(rows[0].findAll('.tok-meta span')[0].text()).toBe(`创建于: ${new Date(1710000000000).toLocaleString()}`)
    const neverSpan = rows[0].find('.tok-meta .never')
    expect(neverSpan.exists()).toBe(true)
    expect(neverSpan.text()).toBe('从未使用')

    const usedSpans = rows[1].findAll('.tok-meta span')
    const usedSpan = usedSpans[usedSpans.length - 1]
    expect(usedSpan.text()).toBe(`最近使用: ${new Date(1720000000000).toLocaleString()}`)
    expect(usedSpan.classes()).not.toContain('never')
  })

  it('13. When label is empty, show "(no label)"', async () => {
    h.listMCPTokens.mockResolvedValue({
      tokens: [{ id: 'a', label: '', created_at: 1, last_used_at: null }],
    })
    const w = mountSection()
    await flush()
    expect(w.find('.tok-name').text()).toBe('(无标签)')
  })

  it('14. Token count rendered in .sk-section-hint', async () => {
    h.listMCPTokens.mockResolvedValue({
      tokens: [{ id: 'a', label: 'x' }, { id: 'b', label: 'y' }],
    })
    const w = mountSection()
    await flush()
    expect(w.find('.sk-section-hint').text()).toBe('2')
  })

  it('15. Click cancel on create token modal → createMCPToken not called', async () => {
    const w = mountSection()
    await flush()
    await w.find('.sk-btn.primary').trigger('click')
    await flush()
    clickPromptCancel()
    await flush()
    expect(h.createMCPToken).not.toHaveBeenCalled()
  })

  it('16. PromptDialog input with spaces before/after → label passed to API is trimmed', async () => {
    h.createMCPToken.mockResolvedValue({ id: 'c', token: 'sek', label: 'x' })
    const w = mountSection()
    await flush()
    await w.find('.sk-btn.primary').trigger('click')
    await flush()
    typePromptValue('  x  ')
    await nextTick()
    clickPromptConfirm()
    await flush()
    expect(h.createMCPToken).toHaveBeenCalledWith({ label: 'x' })
  })

  it('17. Create/delete failure shows danger toast (backend message first, fallback text)', async () => {
    h.listMCPTokens.mockResolvedValue({ tokens: [{ id: 'a', label: 'one' }] })
    h.createMCPToken.mockRejectedValueOnce({ response: { data: { message: 'quota full' } } })
    h.deleteMCPToken.mockRejectedValueOnce({}) // No response.data.message, no .message → use fallback text
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()

    await w.find('.sk-btn.primary').trigger('click')
    await flush()
    typePromptValue('x')
    await nextTick()
    clickPromptConfirm()
    await flush()
    expect(show).toHaveBeenCalledWith('quota full', 3000, 'danger')

    show.mockClear()
    await w.find('.tok-del').trigger('click')
    await flush()
    clickAlertAction('删除')
    await flush()
    expect(show).toHaveBeenCalledWith('删除失败', 3000, 'danger')
  })
})
