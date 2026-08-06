import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'
import BlacklistSection from './BlacklistSection.vue'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useToast } from '../../../../stores/toast'

// 用真 zh_cn 语言包(不用手写 i18n 子集)——P1c2 记账里 ContextTab/AgentTopbar 用
// 手写子集导致「键名拼错抓不到」,本期起改用真包。
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountSection() {
  return mount(BlacklistSection, { global: { plugins: [i18n] } })
}

describe('BlacklistSection', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.restoreAllMocks() })

  it('挂载时拉一次列表', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'loadBlacklist').mockResolvedValue(undefined)
    mountSection()
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('挂载时列表接口失败不抛、不弹 toast（Vue2 mounted 就是静默吞）', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'loadBlacklist').mockRejectedValue(new Error('boom'))
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    mountSection()
    await nextTick(); await nextTick()
    expect(show).not.toHaveBeenCalled()
  })

  it('内置 pattern 全部渲染成只读 chip，计数与数组长度一致', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'loadBlacklist').mockResolvedValue(undefined)
    const w = mountSection()
    await nextTick()
    const chips = w.findAll('.fs-chip')
    expect(chips.length).toBe(27)          // BUILTIN 数组长度,见组件常量
    expect(chips[0].text()).toContain('**/.ssh/**')
    expect(w.find('.sk-section-hint').text()).toBe('27')
  })

  it('自定义 pattern 为空时显示空态', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'loadBlacklist').mockResolvedValue(undefined)
    store.blacklist = []
    const w = mountSection()
    await nextTick()
    expect(w.find('.fs-empty').text()).toBe('还没有自定义 pattern。')
    expect(w.findAll('.fs-userrow')).toHaveLength(0)
  })

  it('有自定义 pattern 时逐行渲染', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'loadBlacklist').mockResolvedValue(undefined)
    store.blacklist = [{ id: 1, pattern: '/DATA/private/**' }, { id: 2, pattern: '*.bak' }] as never
    const w = mountSection()
    await nextTick()
    const rows = w.findAll('.fs-userrow')
    expect(rows).toHaveLength(2)
    expect(rows[1].find('.pat').text()).toBe('*.bak')
    expect(w.find('.fs-empty').exists()).toBe(false)
  })

  it('输入为空时添加按钮禁用', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'loadBlacklist').mockResolvedValue(undefined)
    const w = mountSection()
    await nextTick()
    expect(w.find('.set-addbtn').attributes('disabled')).toBeDefined()
    await w.find('.set-input').setValue('*.tmp')
    expect(w.find('.set-addbtn').attributes('disabled')).toBeUndefined()
  })

  it('添加成功后清空输入框', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'loadBlacklist').mockResolvedValue(undefined)
    const add = vi.spyOn(store, 'addBlacklist').mockResolvedValue(undefined)
    const w = mountSection()
    await nextTick()
    const input = w.find('.set-input')
    await input.setValue('  *.tmp  ')
    await w.find('.set-addbtn').trigger('click')
    await nextTick()
    expect(add).toHaveBeenCalledWith('*.tmp')      // 前后空格被 trim
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('回车也能添加（Vue2 @keydown.enter）', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'loadBlacklist').mockResolvedValue(undefined)
    const add = vi.spyOn(store, 'addBlacklist').mockResolvedValue(undefined)
    const w = mountSection()
    await nextTick()
    await w.find('.set-input').setValue('*.tmp')
    await w.find('.set-input').trigger('keydown', { key: 'Enter' })
    await nextTick()
    expect(add).toHaveBeenCalledWith('*.tmp')
  })

  it('只有空格的输入不发请求', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'loadBlacklist').mockResolvedValue(undefined)
    const add = vi.spyOn(store, 'addBlacklist').mockResolvedValue(undefined)
    const w = mountSection()
    await nextTick()
    await w.find('.set-input').setValue('   ')
    await w.find('.set-input').trigger('keydown', { key: 'Enter' })
    await nextTick()
    expect(add).not.toHaveBeenCalled()
  })

  it('添加失败弹 danger toast，用后端 message，且输入不清空', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'loadBlacklist').mockResolvedValue(undefined)
    vi.spyOn(store, 'addBlacklist').mockRejectedValue({ response: { data: { message: 'pattern 非法' } } })
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await nextTick()
    await w.find('.set-input').setValue('[[[')
    await w.find('.set-addbtn').trigger('click')
    await nextTick(); await nextTick()
    expect(show).toHaveBeenCalledWith('pattern 非法', 3000, 'danger')
    expect((w.find('.set-input').element as HTMLInputElement).value).toBe('[[[')
  })

  it('添加失败且后端没给消息时用兜底文案', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'loadBlacklist').mockResolvedValue(undefined)
    vi.spyOn(store, 'addBlacklist').mockRejectedValue({})
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await nextTick()
    await w.find('.set-input').setValue('x')
    await w.find('.set-addbtn').trigger('click')
    await nextTick(); await nextTick()
    expect(show).toHaveBeenCalledWith('添加失败', 3000, 'danger')
  })

  it('添加过程中按钮禁用并显示「添加中…」', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'loadBlacklist').mockResolvedValue(undefined)
    let release: () => void = () => {}
    vi.spyOn(store, 'addBlacklist').mockImplementation(
      () => new Promise<void>((r) => { release = r }) as never,
    )
    const w = mountSection()
    await nextTick()
    await w.find('.set-input').setValue('x')
    await w.find('.set-addbtn').trigger('click')
    await nextTick()
    expect(w.find('.set-addbtn').text()).toBe('添加中…')
    expect(w.find('.set-addbtn').attributes('disabled')).toBeDefined()
    release()
    await nextTick(); await nextTick()
    expect(w.find('.set-addbtn').text()).toBe('+ 添加')
  })

  it('点删除按钮按 id 调 store', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'loadBlacklist').mockResolvedValue(undefined)
    const rm = vi.spyOn(store, 'removeBlacklist').mockResolvedValue(undefined)
    store.blacklist = [{ id: 7, pattern: 'x' }] as never
    const w = mountSection()
    await nextTick()
    await w.find('.dir-del').trigger('click')
    expect(rm).toHaveBeenCalledWith(7)
  })

  it('删除失败弹 danger toast', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'loadBlacklist').mockResolvedValue(undefined)
    vi.spyOn(store, 'removeBlacklist').mockRejectedValue(new Error('删不掉'))
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    store.blacklist = [{ id: 7, pattern: 'x' }] as never
    const w = mountSection()
    await nextTick()
    await w.find('.dir-del').trigger('click')
    await nextTick(); await nextTick()
    expect(show).toHaveBeenCalledWith('删不掉', 3000, 'danger')
  })

  // final review Fix 2 — pin the no-message fallback so it can't silently drift back to
  // the bare noun t('aiCfgDelete')「删除」(brief's original choice, superseded by final
  // review in favor of aiCfgDeleteFailed「删除失败」, matching McpTokensSection.vue:146 /
  // ChannelsSection.vue:223,276).
  it('删除失败且后端无 message 时兜底「删除失败」（而非「删除」）', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'loadBlacklist').mockResolvedValue(undefined)
    vi.spyOn(store, 'removeBlacklist').mockRejectedValue({})
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    store.blacklist = [{ id: 7, pattern: 'x' }] as never
    const w = mountSection()
    await nextTick()
    await w.find('.dir-del').trigger('click')
    await nextTick(); await nextTick()
    expect(show).toHaveBeenCalledWith('删除失败', 3000, 'danger')
  })
})
