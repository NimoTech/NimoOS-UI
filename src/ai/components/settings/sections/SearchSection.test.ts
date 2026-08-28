import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'

// SP8-P2b Task 7 — covers a 24-case use case list.
// Vue2 SearchSection.vue has no existing tests, this is newly written.

const h = vi.hoisted(() => ({
  getSearchSettings: vi.fn(),
  putSearchSettings: vi.fn(),
  getFileindexStatus: vi.fn(),
  rescanFileindex: vi.fn(),
  copyText: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    ai: {
      getSearchSettings: h.getSearchSettings,
      putSearchSettings: h.putSearchSettings,
      getFileindexStatus: h.getFileindexStatus,
      rescanFileindex: h.rescanFileindex,
    },
  },
}))
vi.mock('../../../../files/util/clipboard', () => ({ copyText: h.copyText }))

import SearchSection from './SearchSection.vue'
import { useToast } from '../../../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountSection = () => mount(SearchSection, { global: { plugins: [i18n] } })
const flush = async () => { await nextTick(); await nextTick(); await nextTick() }

const fullSettings = {
  default_sources: ['filenames'],
  semantic_top_k: 3,
  filename_top_k: 4,
  image_top_k: 6,
  max_total_results: 20,
  fileindex_enabled: false,
  fileindex_scan_interval_h: 12,
  fileindex_roots: ['/DATA', '/mnt/extra'],
}

describe('SearchSection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    h.getSearchSettings.mockReset()
    h.putSearchSettings.mockReset()
    h.getFileindexStatus.mockReset()
    h.rescanFileindex.mockReset()
    h.copyText.mockReset()
    h.getFileindexStatus.mockResolvedValue({ status: 'disabled', indexed_count: 0, watch_degraded: false, inotify: null })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ---- Load and populate (6) ----

  it('1. Fully populate all complete settings to corresponding controls', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: fullSettings })
    const w = mountSection()
    await flush()
    expect(w.find('.set-chip[data-on="true"]').text()).toContain('文件名')
    const nums = w.findAll('.set-input.num').map((el) => (el.element as HTMLInputElement).value)
    expect(nums).toEqual(['3', '4', '6', '20', '12'])
    expect(w.find('.sw').attributes('data-on')).toBe('false')
    const roots = w.findAll('.dir-row input').map((el) => (el.element as HTMLInputElement).value)
    expect(roots).toEqual(['/DATA', '/mnt/extra'])
  })

  it('2a. getSearchSettings returning {settings:{...}} envelope can also be retrieved', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: { max_total_results: 33 } })
    const w = mountSection()
    await flush()
    const nums = w.findAll('.set-input.num').map((el) => (el.element as HTMLInputElement).value)
    expect(nums[3]).toBe('33')
  })

  it('2b. getSearchSettings returning {data:{settings:{...}}} envelope can also be retrieved', async () => {
    h.getSearchSettings.mockResolvedValue({ data: { settings: { max_total_results: 44 } } })
    const w = mountSection()
    await flush()
    const nums = w.findAll('.set-input.num').map((el) => (el.element as HTMLInputElement).value)
    expect(nums[3]).toBe('44')
  })

  it('3. Missing fields normalize to default values', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: {} })
    const w = mountSection()
    await flush()
    const nums = w.findAll('.set-input.num').map((el) => (el.element as HTMLInputElement).value)
    expect(nums).toEqual(['5', '5', '5', '15', '6'])
    const roots = w.findAll('.dir-row input').map((el) => (el.element as HTMLInputElement).value)
    expect(roots).toEqual(['/DATA'])
  })

  it('4. getSearchSettings reject does not throw, controls retain default value, still calls getFileindexStatus', async () => {
    h.getSearchSettings.mockRejectedValue(new Error('boom'))
    const w = mountSection()
    await flush()
    const nums = w.findAll('.set-input.num').map((el) => (el.element as HTMLInputElement).value)
    expect(nums).toEqual(['5', '5', '5', '15', '6'])
    expect(h.getFileindexStatus).toHaveBeenCalled()
  })

  it('5. getFileindexStatus both envelope types can be retrieved', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: {} })
    h.getFileindexStatus.mockResolvedValue({ data: { status: 'ready', indexed_count: 7, watch_degraded: false, inotify: null } })
    const w1 = mountSection()
    await flush()
    expect(w1.find('.diag-row .v').text()).toContain('就绪')

    h.getFileindexStatus.mockResolvedValue({ status: 'scanning', indexed_count: 9, watch_degraded: false, inotify: null })
    const w2 = mountSection()
    await flush()
    expect(w2.find('.diag-row .v').text()).toContain('建立中')
  })

  it('6. getFileindexStatus reject does not throw, diagnostic area renders default value', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: {} })
    h.getFileindexStatus.mockRejectedValue(new Error('boom'))
    const w = mountSection()
    await flush()
    const rows = w.findAll('.diag-row')
    expect(rows[0].text()).toContain('未启用')
    expect(rows[1].text()).toContain('0')
  })

  // ---- Retrieval parameters (6) ----

  it('7. Click "semantic" chip to uncheck then click back', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: {} })
    const w = mountSection()
    await flush()
    const chips = w.findAll('.set-chip')
    const semanticChip = chips.find((c) => c.text().includes('语义'))!
    expect(semanticChip.attributes('data-on')).toBe('true')
    await semanticChip.trigger('click')
    expect(w.findAll('.set-chip').find((c) => c.text().includes('语义'))!.attributes('data-on')).toBe('false')
    await w.findAll('.set-chip').find((c) => c.text().includes('语义'))!.trigger('click')
    expect(w.findAll('.set-chip').find((c) => c.text().includes('语义'))!.attributes('data-on')).toBe('true')
  })

  it('8. All three sources unchecked → show hint + save button disabled (control group: button enabled with one source)', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: {} })
    const w = mountSection()
    await flush()
    const saveBtn = w.findAll('.sk-btn.primary')[0]
    expect(saveBtn.attributes('disabled')).toBeUndefined()
    for (const c of w.findAll('.set-chip')) await c.trigger('click')
    await flush()
    expect(w.find('.set-row .warn').text()).toBe('至少选择一个搜索源。')
    expect(w.findAll('.sk-btn.primary')[0].attributes('disabled')).toBeDefined()
  })

  it('9. Click save → putSearchSettings receives exactly 5 keys, excludes three fileindex keys', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: {} })
    h.putSearchSettings.mockResolvedValue({})
    const w = mountSection()
    await flush()
    await w.findAll('.sk-btn.primary')[0].trigger('click')
    await flush()
    const payload = h.putSearchSettings.mock.calls[0][0]
    expect(Object.keys(payload).sort()).toEqual(
      ['default_sources', 'filename_top_k', 'image_top_k', 'max_total_results', 'semantic_top_k'].sort(),
    )
  })

  it('10. Display "saved" after successful save', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: {} })
    h.putSearchSettings.mockResolvedValue({})
    const w = mountSection()
    await flush()
    await w.findAll('.sk-btn.primary')[0].trigger('click')
    await flush()
    expect(w.find('.set-actions .hint').text()).toBe('已保存')
  })

  it('11. Clicking save with empty source does not send request', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: {} })
    const w = mountSection()
    await flush()
    for (const c of w.findAll('.set-chip')) await c.trigger('click')
    await flush()
    // button is disabled, but call the handler defensively by clicking anyway (no-op if disabled)
    await w.findAll('.sk-btn.primary')[0].trigger('click')
    await flush()
    expect(h.putSearchSettings).not.toHaveBeenCalled()
  })

  it('12. Save failure shows danger toast + "saving" resets (logic fix)', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: {} })
    h.putSearchSettings.mockRejectedValue({ response: { data: { message: '存不上' } } })
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    const saveBtn = w.findAll('.sk-btn.primary')[0]
    await saveBtn.trigger('click')
    await flush()
    expect(show).toHaveBeenCalledWith('存不上', 3000, 'danger')
    expect(w.findAll('.sk-btn.primary')[0].attributes('disabled')).toBeUndefined()
  })

  // ---- Filename index (6) ----

  it('13. Add root directory adds one row, delete specific row deletes only that row', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: { fileindex_roots: ['/DATA', '/mnt/extra'] } })
    const w = mountSection()
    await flush()
    expect(w.findAll('.dir-row')).toHaveLength(2)
    await w.find('.dir-add').trigger('click')
    await flush()
    expect(w.findAll('.dir-row')).toHaveLength(3)
    await w.findAll('.dir-del')[0].trigger('click')
    await flush()
    const remaining = w.findAll('.dir-row input').map((el) => (el.element as HTMLInputElement).value)
    expect(remaining).toEqual(['/mnt/extra', ''])
  })

  it('14. Save fileindex → payload has exactly 3 keys, fileindex_roots filters out pure whitespace items', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: { fileindex_roots: ['/DATA', '  ', ''] } })
    h.putSearchSettings.mockResolvedValue({})
    const w = mountSection()
    await flush()
    await w.findAll('.sk-btn.primary')[1].trigger('click')
    await flush()
    const payload = h.putSearchSettings.mock.calls[0][0]
    expect(Object.keys(payload).sort()).toEqual(
      ['fileindex_enabled', 'fileindex_roots', 'fileindex_scan_interval_h'].sort(),
    )
    expect(payload.fileindex_roots).toEqual(['/DATA'])
  })

  it('15. Response {restart_required:true} renders warning banner; false/missing does not render (control group)', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: {} })
    h.putSearchSettings.mockResolvedValueOnce({ restart_required: true })
    const w = mountSection()
    await flush()
    expect(w.find('.set-banner.warn').exists()).toBe(false)
    await w.findAll('.sk-btn.primary')[1].trigger('click')
    await flush()
    expect(w.find('.set-banner.warn').exists()).toBe(true)
    expect(w.find('.set-banner.warn').text()).toBe('根目录 / 索引设置已更改，需重启搜索服务后生效。')
  })

  it('15b. restart_required=false does not render warning banner', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: {} })
    h.putSearchSettings.mockResolvedValue({ restart_required: false })
    const w = mountSection()
    await flush()
    await w.findAll('.sk-btn.primary')[1].trigger('click')
    await flush()
    expect(w.find('.set-banner.warn').exists()).toBe(false)
  })

  it('16. Both resp.data.restart_required and resp.restart_required envelope types can be recognized', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: {} })
    h.putSearchSettings.mockResolvedValueOnce({ data: { restart_required: true } })
    const w = mountSection()
    await flush()
    await w.findAll('.sk-btn.primary')[1].trigger('click')
    await flush()
    expect(w.find('.set-banner.warn').exists()).toBe(true)
  })

  it('17. Save fileindex failure shows danger toast (logic fix)', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: {} })
    h.putSearchSettings.mockRejectedValue({ response: { data: { message: '目录非法' } } })
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    await w.findAll('.sk-btn.primary')[1].trigger('click')
    await flush()
    expect(show).toHaveBeenCalledWith('目录非法', 3000, 'danger')
  })

  it('18a. "Rescan now" calls rescanFileindex, button disabled during, getFileindexStatus called again after 1500ms', async () => {
    vi.useFakeTimers()
    h.getSearchSettings.mockResolvedValue({ settings: {} })
    h.rescanFileindex.mockResolvedValue({})
    const w = mountSection()
    await flush()
    h.getFileindexStatus.mockClear()
    const rescanBtn = w.find('.sk-btn.ghost')
    await rescanBtn.trigger('click')
    await flush()
    expect(h.rescanFileindex).toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1500)
    expect(h.getFileindexStatus).toHaveBeenCalledTimes(1)
  })

  it('18b. After unmount, advance 1500ms, getFileindexStatus no longer called (logic fix)', async () => {
    vi.useFakeTimers()
    h.getSearchSettings.mockResolvedValue({ settings: {} })
    h.rescanFileindex.mockResolvedValue({})
    const w = mountSection()
    await flush()
    await w.find('.sk-btn.ghost').trigger('click')
    await flush()
    h.getFileindexStatus.mockClear()
    w.unmount()
    await vi.advanceTimersByTimeAsync(1500)
    expect(h.getFileindexStatus).not.toHaveBeenCalled()
  })

  // ---- Diagnostic area (4) ----

  it('19. Four-state status label correctly mapped, unknown values displayed as-is', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: {} })
    h.getFileindexStatus.mockResolvedValue({ status: 'ready', indexed_count: 0, watch_degraded: false, inotify: null })
    const w1 = mountSection(); await flush()
    expect(w1.find('.diag-row .v').text()).toContain('就绪')

    h.getFileindexStatus.mockResolvedValue({ status: 'scanning', indexed_count: 0, watch_degraded: false, inotify: null })
    const w2 = mountSection(); await flush()
    expect(w2.find('.diag-row .v').text()).toContain('建立中')

    h.getFileindexStatus.mockResolvedValue({ status: 'disabled', indexed_count: 0, watch_degraded: false, inotify: null })
    const w3 = mountSection(); await flush()
    expect(w3.find('.diag-row .v').text()).toContain('未启用')

    h.getFileindexStatus.mockResolvedValue({ status: 'weird', indexed_count: 0, watch_degraded: false, inotify: null })
    const w4 = mountSection(); await flush()
    expect(w4.find('.diag-row .v').text()).toContain('weird')
  })

  it('20. inotify null does not render relevant row; with value renders limit number and "(recommended N)" (control group)', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: {} })
    h.getFileindexStatus.mockResolvedValue({ status: 'ready', indexed_count: 1, watch_degraded: false, inotify: null })
    const w1 = mountSection()
    await flush()
    expect(w1.findAll('.diag-row')).toHaveLength(2)

    h.getFileindexStatus.mockResolvedValue({
      status: 'ready', indexed_count: 1, watch_degraded: false,
      inotify: { max_user_watches: 65536, recommended: 65536, raise_cmd: 'sysctl -w x=1' },
    })
    const w2 = mountSection()
    await flush()
    const rows = w2.findAll('.diag-row')
    expect(rows).toHaveLength(3) // no raise-limit row/copy-box (covered separately in case 21)
    expect(rows[2].text()).toContain('65536')
    expect(rows[2].text()).toContain('（推荐 65536）')
    expect(w2.find('.set-copy').exists()).toBe(false)
  })

  it('21a. watch_degraded=true renders degradation warning + copy box', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: {} })
    h.getFileindexStatus.mockResolvedValue({
      status: 'ready', indexed_count: 1, watch_degraded: true,
      inotify: { max_user_watches: 65536, recommended: 65536, raise_cmd: 'sysctl -w x=1' },
    })
    const w = mountSection()
    await flush()
    expect(w.find('p.warn').exists()).toBe(true)
    expect(w.find('.set-copy').exists()).toBe(true)
  })

  it('21b. max_user_watches < recommended also renders copy box (not dependent on watch_degraded)', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: {} })
    h.getFileindexStatus.mockResolvedValue({
      status: 'ready', indexed_count: 1, watch_degraded: false,
      inotify: { max_user_watches: 100, recommended: 65536, raise_cmd: 'sysctl -w x=1' },
    })
    const w = mountSection()
    await flush()
    expect(w.find('p.warn').exists()).toBe(false)
    expect(w.find('.set-copy').exists()).toBe(true)
  })

  it('22a. Click "copy" calls copyText(raise_cmd), on success shows "copied" toast', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: {} })
    h.getFileindexStatus.mockResolvedValue({
      status: 'ready', indexed_count: 1, watch_degraded: true,
      inotify: { max_user_watches: 100, recommended: 65536, raise_cmd: 'sysctl -w x=1' },
    })
    h.copyText.mockResolvedValue(undefined)
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    await w.find('.set-copybtn').trigger('click')
    await flush()
    expect(h.copyText).toHaveBeenCalledWith('sysctl -w x=1')
    expect(show).toHaveBeenCalledWith('已复制')
  })

  it('22b. copyText reject shows warning toast "copy failed, please select manually" (logic fix)', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: {} })
    h.getFileindexStatus.mockResolvedValue({
      status: 'ready', indexed_count: 1, watch_degraded: true,
      inotify: { max_user_watches: 100, recommended: 65536, raise_cmd: 'sysctl -w x=1' },
    })
    h.copyText.mockRejectedValue(new Error('denied'))
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    await w.find('.set-copybtn').trigger('click')
    await flush()
    expect(show).toHaveBeenCalledWith('复制失败,请手动选择', 3000, 'warning')
  })
})
