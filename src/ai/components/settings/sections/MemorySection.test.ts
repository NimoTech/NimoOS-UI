import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'

// SP8-P2b Task 6 —— 承接 Vue2 sections/__tests__/MemorySection.spec.js(13 例,借
// `MemorySection.methods.load.call(ctx)` 直调 methods)。`<script setup>` 没有
// methods 对象可借,这里改成挂载组件 + spy service,断言内容逐条保留,只换驱动方式。
// 对照表见 .superpowers/sdd/p2b-task-6-report.md。

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
  it('load() 用后端数据填充设置与记忆列表', async () => {
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
  it('load() 填充 compaction_enabled 与 context_window', async () => {
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
  it('load() 缺 compaction_enabled/context_window 时归一为关闭/空串', async () => {
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
  it('load() 失败时显示「加载记忆失败。」且无 loading', async () => {
    h.getMemorySettings.mockRejectedValue(new Error('boom'))
    const w = mountSection()
    await flush()
    expect(w.find('.set-note').text()).toBe('加载记忆失败。')
  })

  // 5. remove() deletes and drops the item
  it('remove() 调 deleteUserMemory 并从列表移除该行', async () => {
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
  it('remove() 失败时保留该行', async () => {
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
  it('remove() 失败弹 danger toast（逻辑修正,Vue2 注释里只保留条目不提示）', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: true })
    h.listUserMemory.mockResolvedValue([{ id: 'a', kind: 'fact', text: 'x', source: 'auto' }])
    h.deleteUserMemory.mockRejectedValue({ response: { data: { message: '删不掉' } } })
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    await w.find('.mem-del').trigger('click')
    await flush()
    expect(show).toHaveBeenCalledWith('删不掉', 3000, 'danger')
  })

  // 7. saveEnabled() reverts the toggle on failure
  it('saveEnabled() 失败时把开关翻回去', async () => {
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
  it('saveEnabled() 失败弹 danger toast（逻辑修正,Vue2 静默回滚）', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: false })
    h.listUserMemory.mockResolvedValue([])
    h.putMemorySettings.mockRejectedValue({ response: { data: { message: '存不上' } } })
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    await w.find('.sw').trigger('click')
    await flush()
    expect(show).toHaveBeenCalledWith('存不上', 3000, 'danger')
  })

  // 8. saveEnabled() calls put… with 三个字段
  it('saveEnabled() 调 putMemorySettings 时三个字段齐全', async () => {
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

  // 9. saveCompaction() … compaction_enabled in payload
  it('saveCompaction() 调 putMemorySettings 时 payload 含 compaction_enabled 与 context_window:null', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: true, compaction_enabled: false })
    h.listUserMemory.mockResolvedValue([])
    h.putMemorySettings.mockResolvedValue({})
    const w = mountSection()
    await flush()
    const switches = w.findAll('.sw')
    await switches[1].trigger('click')
    await flush()
    expect(h.putMemorySettings).toHaveBeenCalledWith(
      expect.objectContaining({ compaction_enabled: true, context_window: null }),
    )
  })

  // 10. saveCompaction() reverts on failure
  it('saveCompaction() 失败时把压缩开关翻回去', async () => {
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
  it('saveCompaction() 失败弹 danger toast', async () => {
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

  // 11. saveContextWindow() … as number
  it('saveContextWindow() 把输入值当数字发送', async () => {
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

  // 12. saveContextWindow() sends null when blank
  it('saveContextWindow() 留空时发送 context_window:null', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: true, context_window: 8192 })
    h.listUserMemory.mockResolvedValue([])
    h.putMemorySettings.mockResolvedValue({})
    const w = mountSection()
    await flush()
    await w.find('.set-input.num').setValue('')
    await flush()
    expect(h.putMemorySettings).toHaveBeenCalledWith(
      expect.objectContaining({ context_window: null }),
    )
  })

  // 13. saveContextWindow() reverts to previous on failure (snapshot before await)
  it('saveContextWindow() 失败时回到发请求前的快照值(而不是当前值)', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: true, context_window: 4096 })
    h.listUserMemory.mockResolvedValue([])
    const w = mountSection()
    await flush()
    h.putMemorySettings.mockImplementation(async () => {
      // concurrent mutation during the await — simulated by writing to the input directly
      await w.find('.set-input.num').setValue('99999')
      throw new Error('boom')
    })
    await w.find('.set-input.num').setValue('8192')
    await flush()
    expect((w.find('.set-input.num').element as HTMLInputElement).value).toBe('8192')
  })

  // 18. saveContextWindow failure also toasts danger
  it('saveContextWindow() 失败弹 danger toast', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: true, context_window: 4096 })
    h.listUserMemory.mockResolvedValue([])
    h.putMemorySettings.mockRejectedValue({ response: { data: { message: '窗口非法' } } })
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    await w.find('.set-input.num').setValue('8192')
    await flush()
    expect(show).toHaveBeenCalledWith('窗口非法', 3000, 'danger')
  })

  // 15. off banner shown when disabled, hidden when enabled
  it('记忆关闭时显示警告条,开启时不显示', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: false })
    h.listUserMemory.mockResolvedValue([])
    const w = mountSection()
    await flush()
    expect(w.find('.set-banner.warn').exists()).toBe(true)
    expect(w.find('.set-banner.warn').text()).toBe(
      '记忆已关闭 —— 不再记录或注入新内容。已有条目保留,仍可删除。',
    )
  })

  it('记忆开启时不显示警告条（对照组）', async () => {
    h.getMemorySettings.mockResolvedValue({ enabled: true })
    h.listUserMemory.mockResolvedValue([])
    const w = mountSection()
    await flush()
    expect(w.find('.set-banner.warn').exists()).toBe(false)
  })

  // 20. localized tags: kind, source, recall count (+ recall_count missing -> 0)
  it('记忆条目的三个标签正确本地化,recall_count 缺失按 0 渲染', async () => {
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
