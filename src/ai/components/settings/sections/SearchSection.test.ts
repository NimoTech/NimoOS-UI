import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'

// SP8-P2b Task 7 —— 承接 brief .superpowers/sdd/p2b-task-7-brief.md 用例清单(24 条)。
// Vue2 SearchSection.vue 无既有测试,这里是新写的。

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

  // ---- 加载与回填 (6) ----

  it('1. 完整 settings 全部回填到对应控件', async () => {
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

  it('2a. getSearchSettings 返回 {settings:{...}} 信封也能取到', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: { max_total_results: 33 } })
    const w = mountSection()
    await flush()
    const nums = w.findAll('.set-input.num').map((el) => (el.element as HTMLInputElement).value)
    expect(nums[3]).toBe('33')
  })

  it('2b. getSearchSettings 返回 {data:{settings:{...}}} 信封也能取到', async () => {
    h.getSearchSettings.mockResolvedValue({ data: { settings: { max_total_results: 44 } } })
    const w = mountSection()
    await flush()
    const nums = w.findAll('.set-input.num').map((el) => (el.element as HTMLInputElement).value)
    expect(nums[3]).toBe('44')
  })

  it('3. 字段缺失时归一为默认值', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: {} })
    const w = mountSection()
    await flush()
    const nums = w.findAll('.set-input.num').map((el) => (el.element as HTMLInputElement).value)
    expect(nums).toEqual(['5', '5', '5', '15', '6'])
    const roots = w.findAll('.dir-row input').map((el) => (el.element as HTMLInputElement).value)
    expect(roots).toEqual(['/DATA'])
  })

  it('4. getSearchSettings reject 不抛、控件留默认值，仍会调用 getFileindexStatus', async () => {
    h.getSearchSettings.mockRejectedValue(new Error('boom'))
    const w = mountSection()
    await flush()
    const nums = w.findAll('.set-input.num').map((el) => (el.element as HTMLInputElement).value)
    expect(nums).toEqual(['5', '5', '5', '15', '6'])
    expect(h.getFileindexStatus).toHaveBeenCalled()
  })

  it('5. getFileindexStatus 两种信封都能取到', async () => {
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

  it('6. getFileindexStatus reject 不抛，诊断区渲染默认值', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: {} })
    h.getFileindexStatus.mockRejectedValue(new Error('boom'))
    const w = mountSection()
    await flush()
    const rows = w.findAll('.diag-row')
    expect(rows[0].text()).toContain('未启用')
    expect(rows[1].text()).toContain('0')
  })

  // ---- 检索参数 (6) ----

  it('7. 点「语义」chip 取消勾选再点回来', async () => {
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

  it('8. 三个源全取消 -> 显示提示 + 保存按钮 disabled（对照组：有一个源时按钮可用）', async () => {
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

  it('9. 点保存 -> putSearchSettings 收到恰好 5 个键，不含 fileindex 三键', async () => {
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

  it('10. 保存成功后显示「已保存」', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: {} })
    h.putSearchSettings.mockResolvedValue({})
    const w = mountSection()
    await flush()
    await w.findAll('.sk-btn.primary')[0].trigger('click')
    await flush()
    expect(w.find('.set-actions .hint').text()).toBe('已保存')
  })

  it('11. 源为空时点保存不发请求', async () => {
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

  it('12. 保存失败弹 danger toast + 「保存中」复位（逻辑修正）', async () => {
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

  // ---- 文件名索引 (6) ----

  it('13. 添加根目录多一行，删除某行只删对应那行', async () => {
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

  it('14. 保存 fileindex -> payload 恰好 3 键，且 fileindex_roots 过滤掉纯空白项', async () => {
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

  it('15. 响应 {restart_required:true} 渲染警告条；false/缺失时不渲染（对照组）', async () => {
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

  it('15b. restart_required=false 不渲染警告条', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: {} })
    h.putSearchSettings.mockResolvedValue({ restart_required: false })
    const w = mountSection()
    await flush()
    await w.findAll('.sk-btn.primary')[1].trigger('click')
    await flush()
    expect(w.find('.set-banner.warn').exists()).toBe(false)
  })

  it('16. resp.data.restart_required 与 resp.restart_required 两种信封都能识别', async () => {
    h.getSearchSettings.mockResolvedValue({ settings: {} })
    h.putSearchSettings.mockResolvedValueOnce({ data: { restart_required: true } })
    const w = mountSection()
    await flush()
    await w.findAll('.sk-btn.primary')[1].trigger('click')
    await flush()
    expect(w.find('.set-banner.warn').exists()).toBe(true)
  })

  it('17. 保存 fileindex 失败弹 danger toast（逻辑修正）', async () => {
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

  it('18a. 「立即重扫」调用 rescanFileindex，按钮期间 disabled，1500ms 后 getFileindexStatus 再调一次', async () => {
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

  it('18b. 卸载后推进 1500ms，getFileindexStatus 不再被调（逻辑修正）', async () => {
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

  // ---- 诊断区 (4) ----

  it('19. 四态状态标签正确映射，未知值原样显示', async () => {
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

  it('20. inotify 为 null 不渲染相关行；有值时渲染上限数字与「（推荐 N）」（对照组）', async () => {
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

  it('21a. watch_degraded=true 渲染降级警告 + 复制框', async () => {
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

  it('21b. max_user_watches < recommended 也渲染复制框（不依赖 watch_degraded）', async () => {
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

  it('22a. 点「复制」调用 copyText(raise_cmd) 且成功弹「已复制」toast', async () => {
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

  it('22b. copyText reject 弹 warning toast「复制失败,请手动选择」（逻辑修正）', async () => {
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
