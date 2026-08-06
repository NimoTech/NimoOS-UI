// SP8-P2a Task 9 —— 移植自 Vue2 src/views/AI/Settings/sections/ModelsSection.vue
// (222 行)。brief Step 3 的 21 条用例清单,逐条落地(部分拆成多个 it() 便于
// 精确定位失败点,数量只增不减)。
//
// 真 store(setActivePinia + useSettingsStore()),不 mock @nimotech/nimoos-service
// ——组件从不直接调 service,只调 store 的 action,故 spy store 方法即可隔离
// 网络层,同 settingsStore.test.ts 的既定写法。
//
// 真 i18n(zh_cn 完整 locale,不手写子集)——P1c-2 记账过手写子集会让拼错的键名
// 抓不到。
//
// AlertDialog 走真实挂载 + attachTo document.body(不 mock reka-ui)——同
// AgentSidebar.test.ts:60-91 的既定手法:reka 的 AlertDialogAction 点击时先
// update:open(false) 再派发 confirm,deleteDlg 把 open 与待删 name 打包在同一个
// ref、v-model:open 只改 .open,故 confirm 处理器仍能读到正确的 name。

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'
import ModelsSection from './ModelsSection.vue'
import { useSettingsStore, type ImportJob } from '../../../stores/settingsStore'
import { useToast } from '../../../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountSection() {
  return mount(ModelsSection, { global: { plugins: [i18n] }, attachTo: document.body })
}

/** ImportJob 类型要求全字段;测试只关心的字段用 overrides 覆盖,其余给最小合法默认值。 */
function makeJob(overrides: Partial<ImportJob>): ImportJob {
  return {
    repo: 'qwen/Qwen2.5',
    filename: 'model.gguf',
    status: 'downloading',
    completed: 0,
    total: 0,
    error: '',
    speed: 0,
    etaSecs: null,
    _prevCompleted: 0,
    _prevTime: Date.now(),
    _timer: null,
    ...overrides,
  }
}

describe('ModelsSection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // ── 1. 已装模型:空态 / 加载中 / 有数据 ──

  it('1. installedModels 为空 → 渲染空态文案,不渲染 .set-table', () => {
    const w = mountSection()
    expect(w.text()).toContain('暂无已安装模型')
    expect(w.find('.set-table').exists()).toBe(false)
  })

  it('2. modelsLoading → 渲染「加载中…」', () => {
    const store = useSettingsStore()
    store.modelsLoading = true
    const w = mountSection()
    expect(w.text()).toContain('加载中…')
    expect(w.find('.set-table').exists()).toBe(false)
  })

  it('3. 有模型 → 表格行数正确,体积列走 formatModelSize', () => {
    const store = useSettingsStore()
    store.installedModels = [
      { name: 'llama3:8b', size_bytes: 4.7 * 1024 ** 3 },
      { name: 'phi3:mini', size_bytes: 500 * 1024 ** 2 },
    ]
    const w = mountSection()
    const rows = w.findAll('.set-table tbody tr')
    expect(rows).toHaveLength(2)
    const cells = rows[0].findAll('td')
    expect(cells[0].text()).toBe('llama3:8b')
    expect(cells[1].text()).toBe('4.7 GB')
    expect(rows[1].findAll('td')[1].text()).toBe('500 MB')
  })

  it('4. 卡头计数等于 installedModels.length', () => {
    const store = useSettingsStore()
    store.installedModels = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
    const w = mountSection()
    expect(w.find('.set-cardhead .ct').text()).toBe('3')
  })

  it('5. 刷新按钮调 store.loadModels', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'loadModels').mockResolvedValue()
    const w = mountSection()
    await w.find('.set-cardhead .set-minibtn').trigger('click')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  // ── 6-8. 删除模型:确认框 → deleteModel → toast ──

  it('6. 删除按钮先弹确认框(AlertDialog open 变 true),此时还没调 deleteModel', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'deleteModel').mockResolvedValue()
    store.installedModels = [{ name: 'llama3:8b' }]
    const w = mountSection()
    await w.find('.set-tbtn.danger').trigger('click')
    await nextTick()
    expect(document.body.textContent).toContain('确定删除模型 "llama3:8b"')
    expect(spy).not.toHaveBeenCalled()
    w.unmount()
  })

  it('7. 确认后才调 store.deleteModel(name) 并弹成功 toast', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'deleteModel').mockResolvedValue()
    const toast = useToast()
    store.installedModels = [{ name: 'llama3:8b' }]
    const w = mountSection()
    await w.find('.set-tbtn.danger').trigger('click')
    await nextTick()
    const confirmBtn = Array.from(document.body.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === '删除' && b.className.includes('ui-btn'))
    expect(confirmBtn).toBeTruthy()
    confirmBtn!.click()
    await nextTick()
    await nextTick()
    expect(spy).toHaveBeenCalledWith('llama3:8b')
    expect(toast.toasts[0].text).toBe('已删除 llama3:8b')
    expect(toast.toasts[0].tier).toBe('info')
    w.unmount()
  })

  it('8. deleteModel reject → 弹 danger 档 toast', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'deleteModel').mockRejectedValue(new Error('boom'))
    const toast = useToast()
    store.installedModels = [{ name: 'llama3:8b' }]
    const w = mountSection()
    await w.find('.set-tbtn.danger').trigger('click')
    await nextTick()
    const confirmBtn = Array.from(document.body.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === '删除' && b.className.includes('ui-btn'))
    confirmBtn!.click()
    await nextTick()
    await nextTick()
    expect(toast.toasts[0].text).toBe('删除失败')
    expect(toast.toasts[0].tier).toBe('danger')
    w.unmount()
  })

  // ── 9-11. 从 Ollama 拉取 ──

  it('9. 拉取:输入为空时按钮 disabled', () => {
    const w = mountSection()
    expect(w.find('.set-addbtn:not(.ghost)').attributes('disabled')).toBeDefined()
  })

  it('10. 拉取:有输入 → 点击调 store.pullModel,成功弹 toast', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'pullModel').mockResolvedValue()
    const toast = useToast()
    store.pullModelInput = 'llama3:8b'
    const w = mountSection()
    const btn = w.find('.set-addbtn:not(.ghost)')
    expect(btn.attributes('disabled')).toBeUndefined()
    await btn.trigger('click')
    expect(spy).toHaveBeenCalledTimes(1)
    await nextTick()
    await nextTick()
    expect(toast.toasts[0].text).toBe('已发起拉取 llama3:8b')
  })

  it('11. 拉取:回车等同点击', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'pullModel').mockResolvedValue()
    store.pullModelInput = 'llama3:8b'
    const w = mountSection()
    await w.find('.set-input.mono').trigger('keydown.enter')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('12. pullingModels 非空 → 渲染在途提示;为空 → 不渲染(对照组)', () => {
    const empty = mountSection()
    expect(empty.find('.set-actions .hint').exists()).toBe(false)

    const store = useSettingsStore()
    store.pullingModels = { 'llama3:8b': true }
    const w = mountSection()
    expect(w.find('.set-actions .hint').text()).toContain('llama3:8b')
  })

  // ── 13-17. HuggingFace 导入 ──

  it('13a. HF 搜索:空 query 时按钮 disabled', () => {
    const w = mountSection()
    expect(w.find('.set-addbtn.ghost').attributes('disabled')).toBeDefined()
  })

  it('13b. HF 搜索:有 query 时点击调 store.searchHF', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'searchHF').mockResolvedValue()
    store.hfQuery = 'qwen gguf'
    const w = mountSection()
    const btn = w.find('.set-addbtn.ghost')
    expect(btn.attributes('disabled')).toBeUndefined()
    await btn.trigger('click')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('14. HF 搜索中 → 渲染「搜索中…」', () => {
    const store = useSettingsStore()
    store.hfSearchLoading = true
    const w = mountSection()
    expect(w.text()).toContain('搜索中…')
  })

  it('15. HF 结果列表渲染,点某项调 store.selectHFRepo(id),选中项 data-active="true"', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'selectHFRepo')
    store.hfResults = [
      { id: 'qwen/Qwen2.5', downloads: 120 },
      { id: 'meta/llama3', downloads: 50 },
    ]
    store.hfSelectedRepo = 'meta/llama3'
    const w = mountSection()
    const repos = w.findAll('.hf-repo')
    expect(repos).toHaveLength(2)
    expect(repos[0].attributes('data-active')).toBe('false')
    expect(repos[1].attributes('data-active')).toBe('true')
    await repos[0].trigger('click')
    expect(spy).toHaveBeenCalledWith('qwen/Qwen2.5')
  })

  it('16. 选中 repo 后渲染文件区;点「加载文件」调 store.loadHFFiles', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'loadHFFiles').mockResolvedValue()
    const none = mountSection()
    expect(none.find('.hf-files-area').exists()).toBe(false)

    store.hfSelectedRepo = 'qwen/Qwen2.5'
    const w = mountSection()
    expect(w.find('.hf-files-area').exists()).toBe(true)
    await w.find('.hf-files-header .set-minibtn').trigger('click')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('17. 文件列表每项的导入按钮调 store.importHF(file)', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'importHF').mockResolvedValue()
    store.hfSelectedRepo = 'qwen/Qwen2.5'
    store.hfFiles = ['a.gguf', 'b.gguf']
    const w = mountSection()
    const files = w.findAll('.hf-file')
    expect(files).toHaveLength(2)
    await files[1].find('.set-tbtn').trigger('click')
    expect(spy).toHaveBeenCalledWith('b.gguf')
  })

  // ── 18. 下载进度横幅四态(四条独立用例) ──

  it('18a. downloading → 标题「正在导入」、有「勿关机」警告、取消按钮文案「取消」', () => {
    const store = useSettingsStore()
    store.hfImportJobs = { 'model.gguf': makeJob({ status: 'downloading' }) }
    const w = mountSection()
    const banner = w.find('.dl-banner')
    expect(banner.find('.dl-banner-title').text()).toContain('正在导入')
    expect(banner.find('.dl-warn').exists()).toBe(true)
    expect(banner.find('.dl-cancel-btn').text()).toBe('取消')
  })

  it('18b. creating model → 标题「正在注册模型…」、仍有警告', () => {
    const store = useSettingsStore()
    store.hfImportJobs = { 'model.gguf': makeJob({ status: 'creating model' }) }
    const w = mountSection()
    const banner = w.find('.dl-banner')
    expect(banner.find('.dl-banner-title').text()).toContain('正在注册模型…')
    expect(banner.find('.dl-warn').exists()).toBe(true)
    expect(banner.find('.dl-cancel-btn').text()).toBe('取消')
  })

  it('18c. success → 标题「导入完成」、无取消按钮、无警告', () => {
    const store = useSettingsStore()
    store.hfImportJobs = { 'model.gguf': makeJob({ status: 'success', completed: 100, total: 100 }) }
    const w = mountSection()
    const banner = w.find('.dl-banner')
    expect(banner.find('.dl-banner-title').text()).toContain('导入完成')
    expect(banner.find('.dl-cancel-btn').exists()).toBe(false)
    expect(banner.find('.dl-warn').exists()).toBe(false)
  })

  it('18d. error → 标题「导入失败」、按钮文案「关闭」、渲染错误文本、无统计行', () => {
    const store = useSettingsStore()
    store.hfImportJobs = { 'model.gguf': makeJob({ status: 'error', error: 'disk full' }) }
    const w = mountSection()
    const banner = w.find('.dl-banner')
    expect(banner.find('.dl-banner-title').text()).toContain('导入失败')
    expect(banner.find('.dl-cancel-btn').text()).toBe('关闭')
    expect(banner.find('.dl-stats').text()).toBe('disk full')
    // error 态无百分比/速度/ETA 统计行(那些字段全部套在 v-if="status !== 'error'" 里)。
    expect(banner.find('.dl-stats b').exists()).toBe(false)
  })

  // ── 19. 进度条宽度:total===0 防除零(对照组,Step 7 有专门 RED 验证) ──

  it('19a. total > 0 → 进度条宽度按百分比(一位小数)', () => {
    const store = useSettingsStore()
    // 特意选不能整除的一组数字(1/3 → 33.3%),而不是 30/120 → 25.0%:jsdom(与真
    // 实浏览器 CSSOM 序列化规则一致)会把整数值的百分比字符串 "25.0%" 规整成
    // "25%",尾随的 .0 读不回来,导致这条断言测不出 toFixed(1) 与 toFixed(0)
    // 的区别。33.3% 不是整数,序列化后原样保留,能真正验证一位小数逻辑。
    store.hfImportJobs = { 'model.gguf': makeJob({ completed: 1, total: 3 }) }
    const w = mountSection()
    expect((w.find('.dl-prog-fill').element as HTMLElement).style.width).toBe('33.3%')
  })

  it('19b. total === 0 → 进度条宽度是 0%,不是 NaN%(对照组)', () => {
    const store = useSettingsStore()
    store.hfImportJobs = { 'model.gguf': makeJob({ completed: 0, total: 0 }) }
    const w = mountSection()
    expect((w.find('.dl-prog-fill').element as HTMLElement).style.width).toBe('0%')
  })

  // ── 20. speed / eta 各自独立的渲染开关(两条对照) ──

  it('20a. speed > 0 才渲染速度行;speed === 0 不渲染', () => {
    const store = useSettingsStore()
    store.hfImportJobs = { 'model.gguf': makeJob({ speed: 3.2 }) }
    const withSpeed = mountSection()
    expect(withSpeed.find('.dl-stats').text()).toContain('3.2 MB/s')

    store.hfImportJobs = { 'model.gguf': makeJob({ speed: 0 }) }
    const noSpeed = mountSection()
    expect(noSpeed.find('.dl-stats').text()).not.toContain('MB/s')
  })

  it('20b. etaSecs 非 null 才渲染 ETA;null 不渲染', () => {
    const store = useSettingsStore()
    store.hfImportJobs = { 'model.gguf': makeJob({ etaSecs: 90 }) }
    const withEta = mountSection()
    expect(withEta.find('.dl-stats').text()).toContain('约 2 分钟')

    store.hfImportJobs = { 'model.gguf': makeJob({ etaSecs: null }) }
    const noEta = mountSection()
    expect(noEta.find('.dl-stats').text()).not.toContain('约')
  })

  // ── 21. 取消/关闭按钮的分流(两条,证明 error 走 dismiss、其余走 cancel) ──

  it('21a. error 态点「关闭」调 store.dismissImportJob(filename)', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'dismissImportJob')
    store.hfImportJobs = { 'model.gguf': makeJob({ status: 'error', error: 'x' }) }
    const w = mountSection()
    await w.find('.dl-cancel-btn').trigger('click')
    expect(spy).toHaveBeenCalledWith('model.gguf')
  })

  it('21b. downloading 态点「取消」调 store.cancelImportJob(filename)', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'cancelImportJob').mockResolvedValue()
    store.hfImportJobs = { 'model.gguf': makeJob({ status: 'downloading' }) }
    const w = mountSection()
    await w.find('.dl-cancel-btn').trigger('click')
    expect(spy).toHaveBeenCalledWith('model.gguf')
  })
})
