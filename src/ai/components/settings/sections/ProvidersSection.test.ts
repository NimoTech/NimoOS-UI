// Ported from Vue2 src/views/AI/Settings/sections/ProvidersSection.vue
// (249 lines). Brief Step 1's 29 test cases list, landing each one (some split into
// multiple it() for precise failure location, quantity only increases not decreases).
//
// Real store (setActivePinia + useSettingsStore()), not mocking @nimotech/nimoos-service
// — component never calls service directly, only calls store actions, spying store
// methods suffices to isolate network layer (same established pattern as ModelsSection.test.ts).
//
// Real i18n (zh_cn complete locale, not hand-writing subset) — P1c-2 accounting showed
// that hand-written subsets let misspelled keys slip through undetected.
//
// AlertDialog / PromptDialog use real mounting + attachTo document.body (not mocking
// reka-ui) — same established technique as ModelsSection.test.ts / AgentSidebar.test.ts:
// reka's AlertDialogAction on click first update:open(false) then dispatch confirm,
// deleteDlg / addModelDlg bundle open and associated object in same ref, v-model:open
// only modifies .open, so confirm handler can still read correct associated object.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'
import ProvidersSection from './ProvidersSection.vue'
import { useSettingsStore, type Provider, type ProviderModelsEntry } from '../../../stores/settingsStore'
import { useToast } from '../../../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountSection() {
  return mount(ProvidersSection, { global: { plugins: [i18n] }, attachTo: document.body })
}

function makeProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: 'p1',
    name: 'My OpenAI',
    base_url: 'https://api.openai.com/v1',
    protocol: 'openai',
    enabled: true,
    default_model: 'gpt-4o',
    ...overrides,
  }
}

/** Click the reka-ui AlertDialogAction whose visible text matches `label`. */
function clickDialogAction(label: string) {
  const btn = Array.from(document.body.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === label && b.className.includes('ui-btn') && !b.dataset.testid,
  )
  expect(btn).toBeTruthy()
  btn!.click()
}

/** Click PromptDialog's confirm button (identified by data-testid, distinct
 *  from AlertDialog's plain `.ui-btn` — PromptDialog.vue:57-58). */
function clickPromptConfirm() {
  const btn = document.body.querySelector('[data-testid="prompt-confirm"]') as HTMLButtonElement | null
  expect(btn).toBeTruthy()
  btn!.click()
}

describe('ProvidersSection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // ── 1. empty / loading / has data — three states ──

  it('1a. providers empty → renders empty state text, not .set-table', () => {
    const w = mountSection()
    expect(w.text()).toContain('暂无已配置提供商')
    expect(w.find('.set-table').exists()).toBe(false)
  })

  it('1b. providersLoading → renders "loading…"', () => {
    const store = useSettingsStore()
    store.providersLoading = true
    const w = mountSection()
    expect(w.text()).toContain('加载中…')
    expect(w.find('.set-table').exists()).toBe(false)
  })

  it('1c. has data → renders .set-table, row count correct', () => {
    const store = useSettingsStore()
    store.providers = [makeProvider({ id: 'p1' }), makeProvider({ id: 'p2', name: 'My Anthropic' })]
    const w = mountSection()
    expect(w.find('.set-table').exists()).toBe(true)
    expect(w.findAll('.set-table tbody tr[data-section-id], .set-table tbody > tr').length).toBeGreaterThanOrEqual(2)
  })

  // ── 2. card head count ──

  it('2. card head count equals providers.length', () => {
    const store = useSettingsStore()
    store.providers = [makeProvider({ id: 'p1' }), makeProvider({ id: 'p2' }), makeProvider({ id: 'p3' })]
    const w = mountSection()
    expect(w.find('.set-cardhead .ct').text()).toBe('3')
  })

  // ── 3. table column rendering ──

  it('3. name / base_url (.mono) / protocol badge (.set-proto), fallback to openai when missing protocol', () => {
    const store = useSettingsStore()
    store.providers = [makeProvider({ protocol: undefined })]
    const w = mountSection()
    const row = w.find('.set-table tbody tr')
    expect(row.text()).toContain('My OpenAI')
    expect(row.find('.mono').text()).toBe('https://api.openai.com/v1')
    expect(row.find('.set-proto').text()).toBe('openai')
  })

  // ── 4. enable toggle ──

  it('4a. enable toggle reflects p.enabled', () => {
    const store = useSettingsStore()
    store.providers = [makeProvider({ enabled: false })]
    const w = mountSection()
    expect(w.find('.sw').attributes('aria-checked')).toBe('false')
  })

  it('4b. toggling switch calls store.toggleProvider(id, v)', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'toggleProvider').mockResolvedValue()
    store.providers = [makeProvider({ id: 'p1', enabled: false })]
    const w = mountSection()
    await w.find('.sw').trigger('click')
    expect(spy).toHaveBeenCalledWith('p1', true)
  })

  // ── 5. toggleProvider reject → danger toast ──

  it('5. toggleProvider reject → danger tier toast', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'toggleProvider').mockRejectedValue(new Error('boom'))
    const toast = useToast()
    store.providers = [makeProvider({ id: 'p1' })]
    const w = mountSection()
    await w.find('.sw').trigger('click')
    await nextTick()
    await nextTick()
    expect(toast.toasts[0].text).toBe('切换失败')
    expect(toast.toasts[0].tier).toBe('danger')
  })

  // ── 6-7. add / edit buttons ──

  it('6. "add" button calls store.showProviderForm() (no args)', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'showProviderForm')
    const w = mountSection()
    await w.find('.set-cardhead .sk-btn.primary').trigger('click')
    expect(spy).toHaveBeenCalledWith()
  })

  it('7. "edit" button calls store.showProviderForm(p) (with arg)', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'showProviderForm')
    const p = makeProvider({ id: 'p1' })
    store.providers = [p]
    const w = mountSection()
    const editBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('编辑'))[0]
    await editBtn.trigger('click')
    expect(spy).toHaveBeenCalledWith(p)
  })

  // ── 8. delete first shows confirm, then calls deleteProvider ──

  it('8a. delete button first shows confirm dialog, has not yet called store.deleteProvider', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'deleteProvider').mockResolvedValue()
    store.providers = [makeProvider({ id: 'p1', name: 'My OpenAI' })]
    const w = mountSection()
    const delBtn = w.findAll('.set-tbtn.danger')[0]
    await delBtn.trigger('click')
    await nextTick()
    expect(document.body.textContent).toContain('确定删除提供商 "My OpenAI"')
    expect(spy).not.toHaveBeenCalled()
    // Same established technique as ModelsSection.test.ts 6-8: AlertDialog uses real
    // mounting + attachTo document.body, not unmounting leaves dialog DOM in body
    // polluting next it()'s querySelectorAll('button') query (will hit button from
    // previous test, points to invalidated spy, causes next case to false-report
    // "not called").
    w.unmount()
  })

  it('8b. only calls store.deleteProvider(id) after confirm', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'deleteProvider').mockResolvedValue()
    store.providers = [makeProvider({ id: 'p1' })]
    const w = mountSection()
    await w.findAll('.set-tbtn.danger')[0].trigger('click')
    await nextTick()
    clickDialogAction('删除')
    await nextTick()
    await nextTick()
    expect(spy).toHaveBeenCalledWith('p1')
    w.unmount()
  })

  // ── 9. providerForm.visible false → not render form card (control group) ──

  it('9. providerForm.visible=false → not render .set-form', () => {
    const w = mountSection()
    expect(w.find('.set-form').exists()).toBe(false)
  })

  // ── 10. new mode renders preset chips; edit mode not renders (control group) ──

  it('10a. new mode (editing=null) → renders 4 preset chips', () => {
    const store = useSettingsStore()
    store.showProviderForm()
    const w = mountSection()
    expect(w.findAll('.preset-chip')).toHaveLength(4)
  })

  it('10b. edit mode (editing non-empty) → not render preset chips', () => {
    const store = useSettingsStore()
    store.showProviderForm(makeProvider({ id: 'p1' }))
    const w = mountSection()
    expect(w.findAll('.preset-chip')).toHaveLength(0)
  })

  // ── 11. click preset chip calls store.applyProviderPreset(preset) ──

  it('11. click first preset chip calls store.applyProviderPreset, assert exact base_url value', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'applyProviderPreset')
    store.showProviderForm()
    const w = mountSection()
    await w.findAll('.preset-chip')[0].trigger('click')
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'OpenAI', base_url: 'https://api.openai.com/v1', default_model: 'gpt-4o', protocol: 'openai' }),
    )
  })

  // ── 12. API Key input type=password; two kinds of placeholder ──

  it('12a. API Key input type="password"', () => {
    const store = useSettingsStore()
    store.showProviderForm()
    const w = mountSection()
    expect(w.find('input[type="password"]').exists()).toBe(true)
  })

  it('12b. edit mode placeholder is "leave blank to not change"; new mode is "API Key"', () => {
    const store = useSettingsStore()
    store.showProviderForm(makeProvider({ id: 'p1' }))
    const editing = mountSection()
    expect(editing.find('input[type="password"]').attributes('placeholder')).toBe('留空则不修改')

    store.hideProviderForm()
    store.showProviderForm()
    const adding = mountSection()
    expect(adding.find('input[type="password"]').attributes('placeholder')).toBe('API Key')
  })

  // ── 13. protocol radio two options, bind providerForm.data.protocol ──

  it('13. protocol radio two options, bind store.providerForm.data.protocol', async () => {
    const store = useSettingsStore()
    store.showProviderForm()
    const w = mountSection()
    const radios = w.findAll('input[type="radio"]')
    expect(radios).toHaveLength(2)
    expect(radios[0].attributes('value')).toBe('openai')
    expect(radios[1].attributes('value')).toBe('anthropic')
    await radios[1].setValue()
    expect(store.providerForm.data.protocol).toBe('anthropic')
  })

  // ── 14. save button disabled when saving; click calls store.saveProvider ──

  it('14a. saving=true → save button disabled', () => {
    const store = useSettingsStore()
    store.showProviderForm()
    store.providerForm.saving = true
    const w = mountSection()
    const saveBtn = w.findAll('.set-actions .sk-btn.primary')[0]
    expect(saveBtn.attributes('disabled')).toBeDefined()
  })

  it('14b. click save button calls store.saveProvider', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'saveProvider').mockResolvedValue()
    store.showProviderForm()
    const w = mountSection()
    await w.findAll('.set-actions .sk-btn.primary')[0].trigger('click')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  // ── 15. saveProvider reject: use message if present, fallback otherwise (two control cases) ──

  it('15a. saveProvider reject with message → toast uses that message', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'saveProvider').mockRejectedValue(new Error('名称和 Base URL 为必填项'))
    const toast = useToast()
    store.showProviderForm()
    const w = mountSection()
    await w.findAll('.set-actions .sk-btn.primary')[0].trigger('click')
    await nextTick()
    await nextTick()
    expect(toast.toasts[0].text).toBe('名称和 Base URL 为必填项')
    expect(toast.toasts[0].tier).toBe('danger')
  })

  it('15b. saveProvider reject without message → toast uses fallback "save failed"', async () => {
    const store = useSettingsStore()
    // Simulate error object without message (not Error instance, e.g. raw network string).
    vi.spyOn(store, 'saveProvider').mockRejectedValue('network down')
    const toast = useToast()
    store.showProviderForm()
    const w = mountSection()
    await w.findAll('.set-actions .sk-btn.primary')[0].trigger('click')
    await nextTick()
    await nextTick()
    expect(toast.toasts[0].text).toBe('保存失败')
    expect(toast.toasts[0].tier).toBe('danger')
  })

  it('15c. saveProvider reject with plain object (not Error instance but has message field) → still read its message (duck-typing, not instanceof Error narrowing)', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'saveProvider').mockRejectedValue({ message: '后端拒绝' })
    const toast = useToast()
    store.showProviderForm()
    const w = mountSection()
    await w.findAll('.set-actions .sk-btn.primary')[0].trigger('click')
    await nextTick()
    await nextTick()
    expect(toast.toasts[0].text).toBe('后端拒绝')
    expect(toast.toasts[0].tier).toBe('danger')
  })

  // ── 16. cancel button calls store.hideProviderForm ──

  it('16. cancel button calls store.hideProviderForm', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'hideProviderForm')
    store.showProviderForm()
    const w = mountSection()
    await w.findAll('.set-actions .sk-btn.ghost')[0].trigger('click')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  // ── 17-18. expand models: first fetch, next click collapse ──

  it('17. first click "expand models" → renders sub-panel and calls store.loadProviderModels(id)', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'loadProviderModels').mockResolvedValue()
    store.providers = [makeProvider({ id: 'p1' })]
    const w = mountSection()
    expect(w.find('.pm-panel').exists()).toBe(false)
    const showBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('模型'))[0]
    await showBtn.trigger('click')
    expect(w.find('.pm-panel').exists()).toBe(true)
    expect(spy).toHaveBeenCalledWith('p1')
  })

  it('18. click "expand models" again → collapse sub-panel', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'loadProviderModels').mockResolvedValue()
    store.providers = [makeProvider({ id: 'p1' })]
    const w = mountSection()
    const showBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('模型'))[0]
    await showBtn.trigger('click')
    expect(w.find('.pm-panel').exists()).toBe(true)
    await showBtn.trigger('click')
    expect(w.find('.pm-panel').exists()).toBe(false)
  })

  // ── 19. when cached, expand → not call loadProviderModels (lazy-load guard, control group) ──

  it('19. providerModels[id] cached → expand not call loadProviderModels', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'loadProviderModels').mockResolvedValue()
    store.providers = [makeProvider({ id: 'p1' })]
    store.providerModels['p1'] = { loading: false, models: [{ name: 'gpt-4o', source: 'auto', favorite: true }] }
    const w = mountSection()
    const showBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('模型'))[0]
    await showBtn.trigger('click')
    expect(w.find('.pm-panel').exists()).toBe(true)
    expect(spy).not.toHaveBeenCalled()
  })

  // ── 20. loadProviderModels reject → danger toast ──

  it('20. loadProviderModels reject → danger tier toast', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'loadProviderModels').mockRejectedValue(new Error('boom'))
    const toast = useToast()
    store.providers = [makeProvider({ id: 'p1' })]
    const w = mountSection()
    const showBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('模型'))[0]
    await showBtn.trigger('click')
    await nextTick()
    await nextTick()
    expect(toast.toasts[0].text).toBe('加载模型失败')
    expect(toast.toasts[0].tier).toBe('danger')
  })

  // ── 21. sub-panel: loading / empty / has models (three cases) ──

  function expandWith(entry: ProviderModelsEntry) {
    const store = useSettingsStore()
    store.providers = [makeProvider({ id: 'p1' })]
    store.providerModels['p1'] = entry
    return mountSection()
  }

  it('21a. loading → "loading…"', async () => {
    const w = expandWith({ loading: true, models: [] })
    const showBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('模型'))[0]
    await showBtn.trigger('click')
    expect(w.find('.pm-panel .set-note').text()).toBe('加载中…')
  })

  it('21b. models empty → empty state tip', async () => {
    const w = expandWith({ loading: false, models: [] })
    const showBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('模型'))[0]
    await showBtn.trigger('click')
    expect(w.find('.pm-list .set-note').text()).toContain('暂无模型')
  })

  it('21c. has models → renders list', async () => {
    const w = expandWith({
      loading: false,
      models: [
        { name: 'gpt-4o', source: 'auto', favorite: true },
        { name: 'gpt-4o-mini', source: 'auto', favorite: false },
      ],
    })
    const showBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('模型'))[0]
    await showBtn.trigger('click')
    expect(w.findAll('.pm-item')).toHaveLength(2)
  })

  // ── 22. favorite toggle calls store.toggleModelFavorite ──

  it('22. model favorite toggle calls store.toggleModelFavorite(providerId, name, v)', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'toggleModelFavorite').mockResolvedValue()
    const w = expandWith({ loading: false, models: [{ name: 'gpt-4o', source: 'auto', favorite: false }] })
    const showBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('模型'))[0]
    await showBtn.trigger('click')
    await w.find('.pm-item .sw').trigger('click')
    expect(spy).toHaveBeenCalledWith('p1', 'gpt-4o', true)
  })

  // ── 23. supports_thinking true renders 🧠 (two control cases) ──

  it('23a. supports_thinking=true → renders 🧠', async () => {
    const w = expandWith({ loading: false, models: [{ name: 'gpt-4o', source: 'auto', favorite: true, supports_thinking: true }] })
    const showBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('模型'))[0]
    await showBtn.trigger('click')
    expect(w.find('.pm-item').text()).toContain('🧠')
  })

  it('23b. supports_thinking default/false → not render 🧠', async () => {
    const w = expandWith({ loading: false, models: [{ name: 'gpt-4o', source: 'auto', favorite: true }] })
    const showBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('模型'))[0]
    await showBtn.trigger('click')
    expect(w.find('.pm-item').text()).not.toContain('🧠')
  })

  // ── 24. source==='manual' renders delete button (two control cases) ──

  it('24a. source=manual → renders delete button, click calls store.removeManualModel', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'removeManualModel').mockResolvedValue()
    const w = expandWith({ loading: false, models: [{ name: 'custom-model', source: 'manual', favorite: true }] })
    const showBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('模型'))[0]
    await showBtn.trigger('click')
    const delBtn = w.find('.pm-item .dir-del')
    expect(delBtn.exists()).toBe(true)
    await delBtn.trigger('click')
    expect(spy).toHaveBeenCalledWith('p1', 'custom-model')
  })

  it('24b. source!==manual → not render delete button', async () => {
    const w = expandWith({ loading: false, models: [{ name: 'gpt-4o', source: 'auto', favorite: true }] })
    const showBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('模型'))[0]
    await showBtn.trigger('click')
    expect(w.find('.pm-item .dir-del').exists()).toBe(false)
  })

  // ── 25. refresh models: success info, fail warning (not danger) ──

  it('25a. refresh models success → info tier toast', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'refreshProviderModels').mockResolvedValue()
    const toast = useToast()
    const w = expandWith({ loading: false, models: [] })
    const showBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('模型'))[0]
    await showBtn.trigger('click')
    await w.find('.pm-head .set-minibtn').trigger('click')
    await nextTick()
    await nextTick()
    expect(toast.toasts[0].text).toBe('已刷新')
    expect(toast.toasts[0].tier).toBe('info')
  })

  it('25b. refresh models fail → warning tier toast (not danger)', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'refreshProviderModels').mockRejectedValue(new Error('boom'))
    const toast = useToast()
    const w = expandWith({ loading: false, models: [] })
    const showBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('模型'))[0]
    await showBtn.trigger('click')
    await w.find('.pm-head .set-minibtn').trigger('click')
    await nextTick()
    await nextTick()
    expect(toast.toasts[0].text).toBe('自动拉取失败，可手动添加')
    expect(toast.toasts[0].tier).toBe('warning')
  })

  // ── 26. "+ manual add" opens PromptDialog ──

  it('26. "+ manual add" opens PromptDialog (open is true)', async () => {
    const w = expandWith({ loading: false, models: [] })
    const showBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('模型'))[0]
    await showBtn.trigger('click')
    const addBtn = w.findAll('.pm-head .set-minibtn').filter((b) => b.text().includes('手动添加'))[0]
    await addBtn.trigger('click')
    await nextTick()
    expect(document.body.textContent).toContain('输入模型名')
    // Same established technique as 8a/8b (see that comment): PromptDialog uses real
    // mounting + attachTo document.body, not unmounting leaves [data-testid="prompt-confirm"]
    // in body, polluting next case's querySelector (always hits earliest mounted,
    // first appearing in DOM order).
    w.unmount()
  })

  // ── 27-28. PromptDialog confirm: non-empty trim calls addManualModel; empty not calls (control group) ──

  it('27. confirm non-empty value (with spaces) → calls store.addManualModel(id, trimmed)', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'addManualModel').mockResolvedValue()
    const w = expandWith({ loading: false, models: [] })
    const showBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('模型'))[0]
    await showBtn.trigger('click')
    const addBtn = w.findAll('.pm-head .set-minibtn').filter((b) => b.text().includes('手动添加'))[0]
    await addBtn.trigger('click')
    await nextTick()
    const input = document.body.querySelector('.ui-dialog-input') as HTMLInputElement
    input.value = '  gpt-4o-custom  '
    input.dispatchEvent(new Event('input'))
    await nextTick()
    clickPromptConfirm()
    await nextTick()
    await nextTick()
    expect(spy).toHaveBeenCalledWith('p1', 'gpt-4o-custom')
    w.unmount()
  })

  it('28. confirm empty value ("   ") → not call store.addManualModel (control group)', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'addManualModel').mockResolvedValue()
    const w = expandWith({ loading: false, models: [] })
    const showBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('模型'))[0]
    await showBtn.trigger('click')
    const addBtn = w.findAll('.pm-head .set-minibtn').filter((b) => b.text().includes('手动添加'))[0]
    await addBtn.trigger('click')
    await nextTick()
    const input = document.body.querySelector('.ui-dialog-input') as HTMLInputElement
    input.value = '   '
    input.dispatchEvent(new Event('input'))
    await nextTick()
    clickPromptConfirm()
    await nextTick()
    await nextTick()
    expect(spy).not.toHaveBeenCalled()
    w.unmount()
  })

  // ── 29. addManualModel reject → danger toast ──

  it('29. addManualModel reject → danger tier toast', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'addManualModel').mockRejectedValue(new Error('boom'))
    const toast = useToast()
    const w = expandWith({ loading: false, models: [] })
    const showBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('模型'))[0]
    await showBtn.trigger('click')
    const addBtn = w.findAll('.pm-head .set-minibtn').filter((b) => b.text().includes('手动添加'))[0]
    await addBtn.trigger('click')
    await nextTick()
    const input = document.body.querySelector('.ui-dialog-input') as HTMLInputElement
    input.value = 'gpt-4o-custom'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    clickPromptConfirm()
    await nextTick()
    await nextTick()
    expect(toast.toasts[0].text).toBe('添加失败')
    expect(toast.toasts[0].tier).toBe('danger')
    w.unmount()
  })
})
