import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'

const h = vi.hoisted(() => ({ listPromptRevisions: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({
  service: { ai: { listPromptRevisions: h.listPromptRevisions } },
}))

import PromptHistoryPanel from './PromptHistoryPanel.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountPanel(current = 'new\nsame') {
  return mount(PromptHistoryPanel, {
    props: { taskId: 't1', current },
    global: { plugins: [i18n] },
  })
}

describe('PromptHistoryPanel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders versions newest-first and diffs the selected one against the editor text', async () => {
    h.listPromptRevisions.mockResolvedValue({ revisions: [
      { id: 2, prompt: 'old\nsame', revised_by: 'agent', reason: 'too vague', created_at: 2 },
      { id: 1, prompt: 'v1', revised_by: 'user', reason: '', created_at: 1 },
    ] })
    const w = mountPanel()
    await flushPromises()
    const items = w.findAll('[data-test="ph-item"]')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('too vague')
    // Newest selected by default; its 'old' line is painted del, 'new' add.
    const del = w.find('.ph-cell[data-x="del"]')
    const add = w.find('.ph-cell[data-x="add"]')
    expect(del.text()).toBe('old')
    expect(add.text()).toBe('new')
  })

  it('revert emits the SELECTED version text', async () => {
    h.listPromptRevisions.mockResolvedValue({ revisions: [
      { id: 2, prompt: 'v2', revised_by: 'agent' },
      { id: 1, prompt: 'v1', revised_by: 'user' },
    ] })
    const w = mountPanel()
    await flushPromises()
    await w.findAll('[data-test="ph-item"]')[1].trigger('click')
    await w.find('[data-test="ph-revert"]').trigger('click')
    expect(w.emitted('revert')).toEqual([['v1']])
  })

  it('shows the empty note when the history has no rows', async () => {
    h.listPromptRevisions.mockResolvedValue({ revisions: [] })
    const w = mountPanel()
    await flushPromises()
    expect(w.text()).toContain('还没有历史版本')
  })
})
