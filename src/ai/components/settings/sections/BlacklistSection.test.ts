import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'
import BlacklistSection from './BlacklistSection.vue'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useToast } from '../../../../stores/toast'

// Use real zh_cn locale (don't hand-write i18n subset) — P1c2 accounting shows ContextTab/AgentTopbar
// hand-written subset caused "key name typo can't be found", from this phase onward use real package.
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountSection() {
  return mount(BlacklistSection, { global: { plugins: [i18n] } })
}

describe('BlacklistSection', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.restoreAllMocks() })

  it('loads list once on mount', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'loadBlacklist').mockResolvedValue(undefined)
    mountSection()
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('list API failure on mount does not throw, no toast (Vue2 mounted silently swallows)', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'loadBlacklist').mockRejectedValue(new Error('boom'))
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    mountSection()
    await nextTick(); await nextTick()
    expect(show).not.toHaveBeenCalled()
  })

  it('built-in patterns all render as read-only chips, count matches array length', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'loadBlacklist').mockResolvedValue(undefined)
    const w = mountSection()
    await nextTick()
    const chips = w.findAll('.fs-chip')
    expect(chips.length).toBe(27)          // BUILTIN array length, see component constant
    expect(chips[0].text()).toContain('**/.ssh/**')
    expect(w.find('.sk-section-hint').text()).toBe('27')
  })

  it('shows empty state when custom patterns are empty', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'loadBlacklist').mockResolvedValue(undefined)
    store.blacklist = []
    const w = mountSection()
    await nextTick()
    expect(w.find('.fs-empty').text()).toBe('还没有自定义 pattern。')
    expect(w.findAll('.fs-userrow')).toHaveLength(0)
  })

  it('renders line-by-line when custom patterns exist', async () => {
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

  it('add button is disabled when input is empty', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'loadBlacklist').mockResolvedValue(undefined)
    const w = mountSection()
    await nextTick()
    expect(w.find('.set-addbtn').attributes('disabled')).toBeDefined()
    await w.find('.set-input').setValue('*.tmp')
    expect(w.find('.set-addbtn').attributes('disabled')).toBeUndefined()
  })

  it('clears input after successful add', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'loadBlacklist').mockResolvedValue(undefined)
    const add = vi.spyOn(store, 'addBlacklist').mockResolvedValue(undefined)
    const w = mountSection()
    await nextTick()
    const input = w.find('.set-input')
    await input.setValue('  *.tmp  ')
    await w.find('.set-addbtn').trigger('click')
    await nextTick()
    expect(add).toHaveBeenCalledWith('*.tmp')      // leading/trailing spaces trimmed
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('can also add with Enter key (Vue2 @keydown.enter)', async () => {
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

  it('whitespace-only input does not make request', async () => {
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

  it('add failure shows danger toast, uses backend message, input not cleared', async () => {
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

  it('uses fallback text when add fails and backend has no message', async () => {
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

  it('button disabled and shows "Adding..." during add process', async () => {
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

  it('clicking delete button calls store by id', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'loadBlacklist').mockResolvedValue(undefined)
    const rm = vi.spyOn(store, 'removeBlacklist').mockResolvedValue(undefined)
    store.blacklist = [{ id: 7, pattern: 'x' }] as never
    const w = mountSection()
    await nextTick()
    await w.find('.dir-del').trigger('click')
    expect(rm).toHaveBeenCalledWith(7)
  })

  it('delete failure shows danger toast', async () => {
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
  it('when delete fails and backend has no message, fallback to "Delete failed" (not "Delete")', async () => {
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
