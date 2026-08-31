import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'

// Follows Vue2 sections/__tests__/MemorySection.spec.js (13 cases, using
// `MemorySection.methods.load.call(ctx)` to directly call methods). `<script setup>` has no
// methods object to borrow, so here we mount component + spy service, keep assertion content
// as-is, just change the driving approach.

const h = vi.hoisted(() => ({
  getMemorySettings: vi.fn(),
  listUserMemory: vi.fn(),
  putMemorySettings: vi.fn(),
  deleteUserMemory: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    ai: {
      getMemorySettings: h.getMemorySettings,
      listUserMemory: h.listUserMemory,
      putMemorySettings: h.putMemorySettings,
      deleteUserMemory: h.deleteUserMemory,
    },
  },
}))

import MemorySection from './MemorySection.vue'
import { useToast } from '../../../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountSection = () => mount(MemorySection, { global: { plugins: [i18n] } })
const flush = async () => { await nextTick(); await nextTick(); await nextTick() }

describe('MemorySection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    h.getMemorySettings.mockReset()
    h.listUserMemory.mockReset()
    h.putMemorySettings.mockReset()
    h.deleteUserMemory.mockReset()
  })

  // 1. load() fills settings + memories
  it('load() populates settings and memory list with backend data', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: false })
    h.listUserMemory.mockResolvedValue([
      { id: 'a', kind: 'fact', text: 'x', source: 'auto', priority: 0, recall_count: 2, updated_at: 1 },
    ])
    const w = mountSection()
    await flush()
    expect(w.find('.sw').attributes('data-on')).toBe('false')
    expect(w.findAll('.mem-row')).toHaveLength(1)
    expect(w.find('.set-note').exists()).toBe(false)
  })

  // 2. load() fills compaction_enabled and context_window
  it('load() populates compaction_enabled and context_window', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: true, compaction_enabled: true, context_window: 8192 })
    h.listUserMemory.mockResolvedValue([])
    const w = mountSection()
    await flush()
    const switches = w.findAll('.sw')
    expect(switches[1].attributes('data-on')).toBe('true') // compaction switch
    const input = w.find('.set-input.num').element as HTMLInputElement
    expect(input.value).toBe('8192')
  })

  // 3. load() … false + empty when absent
  it('load() missing compaction_enabled/context_window normalizes to off/empty string', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: true })
    h.listUserMemory.mockResolvedValue([])
    const w = mountSection()
    await flush()
    const switches = w.findAll('.sw')
    expect(switches[1].attributes('data-on')).toBe('false')
    const input = w.find('.set-input.num').element as HTMLInputElement
    expect(input.value).toBe('')
  })

  // 4. load() sets error on failure
  it('load() failure shows "load memory failed." with no loading', async () => {
    h.getMemorySettings.mockRejectedValue(new Error('boom'))
    const w = mountSection()
    await flush()
    expect(w.find('.set-note').text()).toBe('加载记忆失败。')
  })

  // 5. remove() deletes and drops the item
  it('remove() calls deleteUserMemory and removes that row from list', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: true })
    h.listUserMemory.mockResolvedValue([
      { id: 'a', kind: 'fact', text: 'x', source: 'auto' },
      { id: 'b', kind: 'fact', text: 'y', source: 'auto' },
    ])
    h.deleteUserMemory.mockResolvedValue({ status: 'deleted' })
    const w = mountSection()
    await flush()
    await w.findAll('.mem-del')[0].trigger('click')
    await flush()
    expect(h.deleteUserMemory).toHaveBeenCalledWith('a')
    expect(w.findAll('.mem-row')).toHaveLength(1)
    expect(w.find('.mem-text').text()).toBe('y')
  })

  // 6. remove() keeps the item on failure
  it('remove() failure keeps that row', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: true })
    h.listUserMemory.mockResolvedValue([{ id: 'a', kind: 'fact', text: 'x', source: 'auto' }])
    h.deleteUserMemory.mockRejectedValue(new Error('boom'))
    const w = mountSection()
    await flush()
    await w.find('.mem-del').trigger('click')
    await flush()
    expect(w.findAll('.mem-row')).toHaveLength(1)
  })

  // 19. remove failure also toasts danger (new behavior, Vue2 was silent)
  it('remove() failure shows danger toast (logic fix, Vue2 comment only kept item without notification)', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: true })
    h.listUserMemory.mockResolvedValue([{ id: 'a', kind: 'fact', text: 'x', source: 'auto' }])
    h.deleteUserMemory.mockRejectedValue({ response: { data: { message: 'cannot delete' } } })
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    await w.find('.mem-del').trigger('click')
    await flush()
    expect(show).toHaveBeenCalledWith('cannot delete', 3000, 'danger')
  })

  // final review Fix 2 — pin the no-message fallback so it can't silently drift back to
  // t('aiCfgSaveFailed') "save failed" (this is a delete path, not a save path): must be
  // t('aiCfgDeleteFailed') "delete failed", matching McpTokensSection.vue:146 /
  // ChannelsSection.vue:223,276.
  it('remove() failure with no backend message uses fallback "delete failed" (not "save failed")', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: true })
    h.listUserMemory.mockResolvedValue([{ id: 'a', kind: 'fact', text: 'x', source: 'auto' }])
    h.deleteUserMemory.mockRejectedValue({})
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    await w.find('.mem-del').trigger('click')
    await flush()
    expect(show).toHaveBeenCalledWith('删除失败', 3000, 'danger')
  })

  // 7. saveEnabled() reverts the toggle on failure
  it('saveEnabled() failure reverts the toggle', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: false })
    h.listUserMemory.mockResolvedValue([])
    h.putMemorySettings.mockRejectedValue(new Error('boom'))
    const w = mountSection()
    await flush()
    expect(w.find('.sw').attributes('data-on')).toBe('false')
    await w.find('.sw').trigger('click') // -> true, triggers saveEnabled()
    await flush()
    expect(w.find('.sw').attributes('data-on')).toBe('false') // reverted back
  })

  // 16. saveEnabled failure also toasts danger
  it('saveEnabled() failure shows danger toast (logic fix, Vue2 silently reverted)', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: false })
    h.listUserMemory.mockResolvedValue([])
    h.putMemorySettings.mockRejectedValue({ response: { data: { message: 'cannot save' } } })
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    await w.find('.sw').trigger('click')
    await flush()
    expect(show).toHaveBeenCalledWith('cannot save', 3000, 'danger')
  })

  // 8. saveEnabled() calls put... with three fields
  it('saveEnabled() calls putMemorySettings with all three fields complete', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: false, compaction_enabled: true, context_window: 4096 })
    h.listUserMemory.mockResolvedValue([])
    h.putMemorySettings.mockResolvedValue({})
    const w = mountSection()
    await flush()
    await w.find('.sw').trigger('click')
    await flush()
    expect(h.putMemorySettings).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, compaction_enabled: true, context_window: 4096 }),
    )
  })

  // 9. saveCompaction() ... compaction_enabled in payload
  it('saveCompaction() calls putMemorySettings with payload containing compaction_enabled and context_window:0 (clear)', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: true, compaction_enabled: false })
    h.listUserMemory.mockResolvedValue([])
    h.putMemorySettings.mockResolvedValue({})
    const w = mountSection()
    await flush()
    const switches = w.findAll('.sw')
    await switches[1].trigger('click')
    await flush()
    expect(h.putMemorySettings).toHaveBeenCalledWith(
      expect.objectContaining({ compaction_enabled: true, context_window: 0 }),
    )
  })

  // 10. saveCompaction() reverts on failure
  it('saveCompaction() failure reverts the compaction toggle', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: true, compaction_enabled: false })
    h.listUserMemory.mockResolvedValue([])
    h.putMemorySettings.mockRejectedValue(new Error('boom'))
    const w = mountSection()
    await flush()
    const switches = w.findAll('.sw')
    await switches[1].trigger('click')
    await flush()
    expect(w.findAll('.sw')[1].attributes('data-on')).toBe('false')
  })

  // 17. saveCompaction failure also toasts danger
  it('saveCompaction() failure shows danger toast', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: true, compaction_enabled: false })
    h.listUserMemory.mockResolvedValue([])
    h.putMemorySettings.mockRejectedValue({})
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    const switches = w.findAll('.sw')
    await switches[1].trigger('click')
    await flush()
    expect(show).toHaveBeenCalledWith('保存失败', 3000, 'danger')
  })

  // 11. saveContextWindow() ... as number
  it('saveContextWindow() sends input value as number', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: true })
    h.listUserMemory.mockResolvedValue([])
    h.putMemorySettings.mockResolvedValue({})
    const w = mountSection()
    await flush()
    await w.find('.set-input.num').setValue('8192')
    await flush()
    expect(h.putMemorySettings).toHaveBeenCalledWith(
      expect.objectContaining({ context_window: 8192 }),
    )
  })

  // 12. blank sends 0 — the backend treats null as "don't touch", so null never cleared
  it('saveContextWindow() sends context_window:0 (clear) when left empty', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: true, context_window: 8192 })
    h.listUserMemory.mockResolvedValue([])
    h.putMemorySettings.mockResolvedValue({})
    const w = mountSection()
    await flush()
    await w.find('.set-input.num').setValue('')
    await flush()
    expect(h.putMemorySettings).toHaveBeenCalledWith(
      expect.objectContaining({ context_window: 0 }),
    )
  })

  // 13. saveContextWindow() reverts to previous on failure (snapshot before await)
  it('saveContextWindow() failure reverts to snapshot value before request (not current value)', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: true, context_window: 4096 })
    h.listUserMemory.mockResolvedValue([])
    const w = mountSection()
    await flush()
    h.putMemorySettings.mockImplementation(async () => {
      // concurrent mutation during the await — write the input's value and fire only
      // 'input' (mirrors what v-model itself listens to), not `setValue()`, which is
      // VTU's trigger('input') + trigger('change'). The component's @change handler is
      // saveContextWindow, so re-firing 'change' here would re-enter saveContextWindow
      // synchronously (its own mock calls back into itself) → unbounded recursion →
      // RangeError: Maximum call stack size exceeded as an unhandled rejection on every
      // run. Firing only 'input' updates contextWindow (simulating the concurrent
      // mutation) without re-triggering the save path.
      const input = w.find('.set-input.num')
      ;(input.element as HTMLInputElement).value = '99999'
      await input.trigger('input')
      throw new Error('boom')
    })
    await w.find('.set-input.num').setValue('8192')
    await flush()
    expect((w.find('.set-input.num').element as HTMLInputElement).value).toBe('8192')
  })

  // 18. saveContextWindow failure also toasts danger
  it('saveContextWindow() failure shows danger toast', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: true, context_window: 4096 })
    h.listUserMemory.mockResolvedValue([])
    h.putMemorySettings.mockRejectedValue({ response: { data: { message: 'invalid window' } } })
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    await w.find('.set-input.num').setValue('8192')
    await flush()
    expect(show).toHaveBeenCalledWith('invalid window', 3000, 'danger')
  })

  // 15. off banner shown when disabled, hidden when enabled
  it('Memory disabled shows warning banner, enabled hides it', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: false })
    h.listUserMemory.mockResolvedValue([])
    const w = mountSection()
    await flush()
    expect(w.find('.set-banner.warn').exists()).toBe(true)
    expect(w.find('.set-banner.warn').text()).toBe(
      '记忆已关闭 —— 不再记录或注入新内容。已有条目保留,仍可删除。',
    )
  })

  it('Memory enabled hides warning banner (control group)', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: true })
    h.listUserMemory.mockResolvedValue([])
    const w = mountSection()
    await flush()
    expect(w.find('.set-banner.warn').exists()).toBe(false)
  })

  // 20. localized tags: kind, source, recall count (+ recall_count missing -> 0)
  it('Memory entry three tags correctly localized, recall_count missing renders as 0', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: true })
    h.listUserMemory.mockResolvedValue([
      { id: 'a', kind: 'preference', text: 'x', source: 'auto', recall_count: 3 },
      { id: 'b', kind: 'fact', text: 'y', source: 'tool' },
    ])
    const w = mountSection()
    await flush()
    const rows = w.findAll('.mem-row')
    const tagsA = rows[0].findAll('.mem-tag')
    expect(tagsA[0].text()).toBe('偏好')
    expect(tagsA[1].text()).toBe('自动')
    expect(tagsA[2].text()).toBe('被召回 3 次')
    const tagsB = rows[1].findAll('.mem-tag')
    expect(tagsB[1].text()).toBe('已保存') // aiCfgMemSourceTool
    expect(tagsB[2].text()).toBe('被召回 0 次') // recall_count missing -> 0
  })
})
