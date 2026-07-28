// SP8-P2a Task 10 — 移植自 Vue2 src/views/AI/Settings/sections/ProvidersSection.vue
// (249 行)。brief Step 1 的 29 条用例清单,逐条落地(部分拆成多个 it() 便于
// 精确定位失败点,数量只增不减)。
//
// 真 store(setActivePinia + useSettingsStore()),不 mock @nimotech/nimoos-service
// —— 组件从不直接调 service,只调 store 的 action,spy store 方法即可隔离网络层
// (同 ModelsSection.test.ts 的既定写法)。
//
// 真 i18n(zh_cn 完整 locale,不手写子集)—— P1c-2 记账过手写子集会让拼错的键名
// 抓不到。
//
// AlertDialog / PromptDialog 走真实挂载 + attachTo document.body(不 mock
// reka-ui)—— 同 ModelsSection.test.ts / AgentSidebar.test.ts 的既定手法:reka
// 的 AlertDialogAction 点击时先 update:open(false) 再派发 confirm,deleteDlg /
// addModelDlg 把 open 与关联对象打包在同一个 ref、v-model:open 只改 .open,故
// confirm 处理器仍能读到正确的关联对象。

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

  // ── 1. 空态 / 加载中 / 有数据三态 ──

  it('1a. providers 为空 → 渲染空态文案,不渲染 .set-table', () => {
    const w = mountSection()
    expect(w.text()).toContain('暂无已配置提供商')
    expect(w.find('.set-table').exists()).toBe(false)
  })

  it('1b. providersLoading → 渲染「加载中…」', () => {
    const store = useSettingsStore()
    store.providersLoading = true
    const w = mountSection()
    expect(w.text()).toContain('加载中…')
    expect(w.find('.set-table').exists()).toBe(false)
  })

  it('1c. 有数据 → 渲染 .set-table,行数正确', () => {
    const store = useSettingsStore()
    store.providers = [makeProvider({ id: 'p1' }), makeProvider({ id: 'p2', name: 'My Anthropic' })]
    const w = mountSection()
    expect(w.find('.set-table').exists()).toBe(true)
    expect(w.findAll('.set-table tbody tr[data-section-id], .set-table tbody > tr').length).toBeGreaterThanOrEqual(2)
  })

  // ── 2. 卡头计数 ──

  it('2. 卡头计数等于 providers.length', () => {
    const store = useSettingsStore()
    store.providers = [makeProvider({ id: 'p1' }), makeProvider({ id: 'p2' }), makeProvider({ id: 'p3' })]
    const w = mountSection()
    expect(w.find('.set-cardhead .ct').text()).toBe('3')
  })

  // ── 3. 表格列渲染 ──

  it('3. 名称 / base_url(.mono)/ 协议徽章(.set-proto),缺协议时兜底 openai', () => {
    const store = useSettingsStore()
    store.providers = [makeProvider({ protocol: undefined })]
    const w = mountSection()
    const row = w.find('.set-table tbody tr')
    expect(row.text()).toContain('My OpenAI')
    expect(row.find('.mono').text()).toBe('https://api.openai.com/v1')
    expect(row.find('.set-proto').text()).toBe('openai')
  })

  // ── 4. 启用开关 ──

  it('4a. 启用开关反映 p.enabled', () => {
    const store = useSettingsStore()
    store.providers = [makeProvider({ enabled: false })]
    const w = mountSection()
    expect(w.find('.sw').attributes('aria-checked')).toBe('false')
  })

  it('4b. 拨动开关调 store.toggleProvider(id, v)', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'toggleProvider').mockResolvedValue()
    store.providers = [makeProvider({ id: 'p1', enabled: false })]
    const w = mountSection()
    await w.find('.sw').trigger('click')
    expect(spy).toHaveBeenCalledWith('p1', true)
  })

  // ── 5. toggleProvider reject → danger toast ──

  it('5. toggleProvider reject → danger 档 toast', async () => {
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

  // ── 6-7. 添加/编辑按钮 ──

  it('6. 「添加」按钮调 store.showProviderForm()(无参)', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'showProviderForm')
    const w = mountSection()
    await w.find('.set-cardhead .sk-btn.primary').trigger('click')
    expect(spy).toHaveBeenCalledWith()
  })

  it('7. 「编辑」按钮调 store.showProviderForm(p)(带参)', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'showProviderForm')
    const p = makeProvider({ id: 'p1' })
    store.providers = [p]
    const w = mountSection()
    const editBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('编辑'))[0]
    await editBtn.trigger('click')
    expect(spy).toHaveBeenCalledWith(p)
  })

  // ── 8. 删除先弹确认,确认后才调 deleteProvider ──

  it('8a. 删除按钮先弹确认框,此时还没调 store.deleteProvider', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'deleteProvider').mockResolvedValue()
    store.providers = [makeProvider({ id: 'p1', name: 'My OpenAI' })]
    const w = mountSection()
    const delBtn = w.findAll('.set-tbtn.danger')[0]
    await delBtn.trigger('click')
    await nextTick()
    expect(document.body.textContent).toContain('确定删除提供商 "My OpenAI"')
    expect(spy).not.toHaveBeenCalled()
    // 同 ModelsSection.test.ts 6-8 的既定手法:AlertDialog 走真实挂载 +
    // attachTo document.body,不 unmount 会把对话框 DOM 留在 body 里污染
    // 下一个 it() 的 querySelectorAll('button') 查找(会命中上一个测试遗留
    // 的按钮,points 到已失效的 spy 上,导致下一条用例误判为"未调用")。
    w.unmount()
  })

  it('8b. 确认后才调 store.deleteProvider(id)', async () => {
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

  // ── 9. providerForm.visible 为 false → 不渲染表单卡(对照组) ──

  it('9. providerForm.visible=false → 不渲染 .set-form', () => {
    const w = mountSection()
    expect(w.find('.set-form').exists()).toBe(false)
  })

  // ── 10. 新建态渲染预设 chip;编辑态不渲染(对照组) ──

  it('10a. 新建态(editing=null)→ 渲染 4 个预设 chip', () => {
    const store = useSettingsStore()
    store.showProviderForm()
    const w = mountSection()
    expect(w.findAll('.preset-chip')).toHaveLength(4)
  })

  it('10b. 编辑态(editing 非空)→ 不渲染预设 chip', () => {
    const store = useSettingsStore()
    store.showProviderForm(makeProvider({ id: 'p1' }))
    const w = mountSection()
    expect(w.findAll('.preset-chip')).toHaveLength(0)
  })

  // ── 11. 点预设 chip 调 store.applyProviderPreset(preset) ──

  it('11. 点第一个预设 chip 调 store.applyProviderPreset,断言 base_url 精确值', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'applyProviderPreset')
    store.showProviderForm()
    const w = mountSection()
    await w.findAll('.preset-chip')[0].trigger('click')
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'OpenAI', base_url: 'https://api.openai.com/v1', default_model: 'gpt-4o', protocol: 'openai' }),
    )
  })

  // ── 12. API Key 输入框 type=password;两种 placeholder ──

  it('12a. API Key 输入框 type="password"', () => {
    const store = useSettingsStore()
    store.showProviderForm()
    const w = mountSection()
    expect(w.find('input[type="password"]').exists()).toBe(true)
  })

  it('12b. 编辑态 placeholder 为「留空则不修改」;新建态为「API Key」', () => {
    const store = useSettingsStore()
    store.showProviderForm(makeProvider({ id: 'p1' }))
    const editing = mountSection()
    expect(editing.find('input[type="password"]').attributes('placeholder')).toBe('留空则不修改')

    store.hideProviderForm()
    store.showProviderForm()
    const adding = mountSection()
    expect(adding.find('input[type="password"]').attributes('placeholder')).toBe('API Key')
  })

  // ── 13. 协议单选两项,绑 providerForm.data.protocol ──

  it('13. 协议单选两项,绑 store.providerForm.data.protocol', async () => {
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

  // ── 14. 保存按钮 saving 时 disabled;点击调 store.saveProvider ──

  it('14a. saving=true → 保存按钮 disabled', () => {
    const store = useSettingsStore()
    store.showProviderForm()
    store.providerForm.saving = true
    const w = mountSection()
    const saveBtn = w.findAll('.set-actions .sk-btn.primary')[0]
    expect(saveBtn.attributes('disabled')).toBeDefined()
  })

  it('14b. 点击保存按钮调 store.saveProvider', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'saveProvider').mockResolvedValue()
    store.showProviderForm()
    const w = mountSection()
    await w.findAll('.set-actions .sk-btn.primary')[0].trigger('click')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  // ── 15. saveProvider reject:带 message 用 message,不带用兜底(两条对照) ──

  it('15a. saveProvider reject 带 message → toast 用该 message', async () => {
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

  it('15b. saveProvider reject 不带 message → toast 用兜底「保存失败」', async () => {
    const store = useSettingsStore()
    // 模拟一个没有 message 的错误对象(非 Error 实例,e.g. 网络层裸字符串)。
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

  it('15c. saveProvider reject 用一个「非 Error 实例但带 message 字段」的普通对象 → 仍取其 message(duck-typing,非 instanceof Error 收窄)', async () => {
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

  // ── 16. 取消按钮调 store.hideProviderForm ──

  it('16. 取消按钮调 store.hideProviderForm', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'hideProviderForm')
    store.showProviderForm()
    const w = mountSection()
    await w.findAll('.set-actions .sk-btn.ghost')[0].trigger('click')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  // ── 17-18. 展开模型:首次拉取,再次点击收起 ──

  it('17. 首次点击「展开模型」→ 渲染子面板且调 store.loadProviderModels(id)', async () => {
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

  it('18. 再次点击「展开模型」→ 收起子面板', async () => {
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

  // ── 19. 已有缓存时展开 → 不再调 loadProviderModels(懒加载守卫,对照组) ──

  it('19. providerModels[id] 已缓存 → 展开不再调 loadProviderModels', async () => {
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

  it('20. loadProviderModels reject → danger 档 toast', async () => {
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

  // ── 21. 子面板:loading / 空态 / 有模型(三条) ──

  function expandWith(entry: ProviderModelsEntry) {
    const store = useSettingsStore()
    store.providers = [makeProvider({ id: 'p1' })]
    store.providerModels['p1'] = entry
    return mountSection()
  }

  it('21a. loading → 「加载中…」', async () => {
    const w = expandWith({ loading: true, models: [] })
    const showBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('模型'))[0]
    await showBtn.trigger('click')
    expect(w.find('.pm-panel .set-note').text()).toBe('加载中…')
  })

  it('21b. 模型为空 → 空态提示', async () => {
    const w = expandWith({ loading: false, models: [] })
    const showBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('模型'))[0]
    await showBtn.trigger('click')
    expect(w.find('.pm-list .set-note').text()).toContain('暂无模型')
  })

  it('21c. 有模型 → 渲染列表', async () => {
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

  // ── 22. 收藏开关调 store.toggleModelFavorite ──

  it('22. 模型收藏开关调 store.toggleModelFavorite(providerId, name, v)', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'toggleModelFavorite').mockResolvedValue()
    const w = expandWith({ loading: false, models: [{ name: 'gpt-4o', source: 'auto', favorite: false }] })
    const showBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('模型'))[0]
    await showBtn.trigger('click')
    await w.find('.pm-item .sw').trigger('click')
    expect(spy).toHaveBeenCalledWith('p1', 'gpt-4o', true)
  })

  // ── 23. supports_thinking 为 true 才渲染 🧠(两条对照) ──

  it('23a. supports_thinking=true → 渲染 🧠', async () => {
    const w = expandWith({ loading: false, models: [{ name: 'gpt-4o', source: 'auto', favorite: true, supports_thinking: true }] })
    const showBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('模型'))[0]
    await showBtn.trigger('click')
    expect(w.find('.pm-item').text()).toContain('🧠')
  })

  it('23b. supports_thinking 缺省/false → 不渲染 🧠', async () => {
    const w = expandWith({ loading: false, models: [{ name: 'gpt-4o', source: 'auto', favorite: true }] })
    const showBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('模型'))[0]
    await showBtn.trigger('click')
    expect(w.find('.pm-item').text()).not.toContain('🧠')
  })

  // ── 24. source==='manual' 才渲染删除按钮(两条对照) ──

  it('24a. source=manual → 渲染删除按钮,点击调 store.removeManualModel', async () => {
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

  it('24b. source!==manual → 不渲染删除按钮', async () => {
    const w = expandWith({ loading: false, models: [{ name: 'gpt-4o', source: 'auto', favorite: true }] })
    const showBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('模型'))[0]
    await showBtn.trigger('click')
    expect(w.find('.pm-item .dir-del').exists()).toBe(false)
  })

  // ── 25. 刷新模型:成功 info,失败 warning(不是 danger) ──

  it('25a. 刷新模型成功 → info 档 toast', async () => {
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

  it('25b. 刷新模型失败 → warning 档 toast(不是 danger)', async () => {
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

  // ── 26. 「+ 手动添加」打开 PromptDialog ──

  it('26. 「+ 手动添加」打开 PromptDialog(open 为 true)', async () => {
    const w = expandWith({ loading: false, models: [] })
    const showBtn = w.findAll('.set-tbtn').filter((b) => b.text().includes('模型'))[0]
    await showBtn.trigger('click')
    const addBtn = w.findAll('.pm-head .set-minibtn').filter((b) => b.text().includes('手动添加'))[0]
    await addBtn.trigger('click')
    await nextTick()
    expect(document.body.textContent).toContain('输入模型名')
    // 同 8a/8b 的既定手法(见该处注释):PromptDialog 走真实挂载 + attachTo
    // document.body,不 unmount 会把 [data-testid="prompt-confirm"] 留在 body
    // 里,污染下一条用例的 querySelector(总是命中最早挂载、先出现在 DOM
    // 顺序里的那个)。
    w.unmount()
  })

  // ── 27-28. PromptDialog 确认:非空 trim 调 addManualModel;空白不调(对照组) ──

  it('27. 确认非空值(带空格)→ 调 store.addManualModel(id, trimmed)', async () => {
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

  it('28. 确认空白值("   ")→ 不调 store.addManualModel(对照组)', async () => {
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

  it('29. addManualModel reject → danger 档 toast', async () => {
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
