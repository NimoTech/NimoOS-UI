// Ported from Vue2 src/views/AI/Settings/sections/ModelsSection.vue
// (222 lines). Implements the brief Step 3 list of 21 test cases one by one (some split
// into multiple it() blocks to pinpoint failures precisely; the count only grows, never shrinks).
//
// Real store (setActivePinia + useSettingsStore()), not mocking @nimotech/nimoos-service
// — the component never calls service directly, only store actions, so spying on store
// methods is enough to isolate the network layer, same convention as settingsStore.test.ts.
//
// Real i18n (full zh_cn locale, not a hand-written subset) — P1c-2 recorded that a hand-written
// subset lets misspelled keys slip through undetected.
//
// AlertDialog is mounted for real + attachTo document.body (not mocking reka-ui) — same
// approach as AgentSidebar.test.ts:60-91: reka's AlertDialogAction click first fires
// update:open(false) then dispatches confirm; deleteDlg packs open and the pending delete
// name into the same ref, and v-model:open only touches .open, so the confirm handler can
// still read the correct name.

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

/** ImportJob type requires all fields; tests override only the fields they care about via overrides, the rest get minimal valid defaults. */
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

  // ── 1. Installed models: empty state / loading / has data ──

  it('1. installedModels empty → renders empty-state copy, does not render .set-table', () => {
    const w = mountSection()
    expect(w.text()).toContain('暂无已安装模型')
    expect(w.find('.set-table').exists()).toBe(false)
  })

  it('2. modelsLoading → renders "loading…"', () => {
    const store = useSettingsStore()
    store.modelsLoading = true
    const w = mountSection()
    expect(w.text()).toContain('加载中…')
    expect(w.find('.set-table').exists()).toBe(false)
  })

  it('3. has models → correct row count, size column uses formatModelSize', () => {
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

  it('4. card-head count equals installedModels.length', () => {
    const store = useSettingsStore()
    store.installedModels = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
    const w = mountSection()
    expect(w.find('.set-cardhead .ct').text()).toBe('3')
  })

  it('5. refresh button calls store.loadModels', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'loadModels').mockResolvedValue()
    const w = mountSection()
    await w.find('.set-cardhead .set-minibtn').trigger('click')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  // ── 6-8. Delete model: confirm dialog → deleteModel → toast ──

  it('6. delete button first pops the confirm dialog (AlertDialog open turns true), deleteModel is not called yet at this point', async () => {
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

  it('7. store.deleteModel(name) is only called after confirming, and pops a success toast', async () => {
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

  it('8. deleteModel reject → pops a danger-tier toast', async () => {
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

  // ── 9-11. Pulling from Ollama ──

  it('9. pull: button is disabled when input is empty', () => {
    const w = mountSection()
    expect(w.find('.set-addbtn:not(.ghost)').attributes('disabled')).toBeDefined()
  })

  it('10. pull: has input → click calls store.pullModel, pops a success toast', async () => {
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

  it('11. pull: Enter is equivalent to clicking', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'pullModel').mockResolvedValue()
    store.pullModelInput = 'llama3:8b'
    const w = mountSection()
    await w.find('.set-input.mono').trigger('keydown.enter')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('12. pullingModels non-empty → renders in-progress hint; empty → does not render (control case)', () => {
    const empty = mountSection()
    expect(empty.find('.set-actions .hint').exists()).toBe(false)

    const store = useSettingsStore()
    store.pullingModels = { 'llama3:8b': true }
    const w = mountSection()
    expect(w.find('.set-actions .hint').text()).toContain('llama3:8b')
  })

  // ── 13-17. HuggingFace import ──

  it('13a. HF search: button is disabled when query is empty', () => {
    const w = mountSection()
    expect(w.find('.set-addbtn.ghost').attributes('disabled')).toBeDefined()
  })

  it('13b. HF search: click calls store.searchHF when there is a query', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'searchHF').mockResolvedValue()
    store.hfQuery = 'qwen gguf'
    const w = mountSection()
    const btn = w.find('.set-addbtn.ghost')
    expect(btn.attributes('disabled')).toBeUndefined()
    await btn.trigger('click')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('14. HF searching → renders "searching…"', () => {
    const store = useSettingsStore()
    store.hfSearchLoading = true
    const w = mountSection()
    expect(w.text()).toContain('搜索中…')
  })

  it('15. HF result list renders; clicking an item calls store.selectHFRepo(id); selected item gets data-active="true"', async () => {
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

  it('16. after selecting a repo the file area renders; clicking "load files" calls store.loadHFFiles', async () => {
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

  it('17. the import button on each file-list item calls store.importHF(file)', async () => {
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

  // ── 18. Download-progress banner, four states (four independent cases) ──

  it('18a. downloading → title "importing", has the "do not power off" warning, cancel button reads "cancel"', () => {
    const store = useSettingsStore()
    store.hfImportJobs = { 'model.gguf': makeJob({ status: 'downloading' }) }
    const w = mountSection()
    const banner = w.find('.dl-banner')
    expect(banner.find('.dl-banner-title').text()).toContain('正在导入')
    expect(banner.find('.dl-warn').exists()).toBe(true)
    expect(banner.find('.dl-cancel-btn').text()).toBe('取消')
  })

  it('18b. creating model → title "registering model…", still has the warning', () => {
    const store = useSettingsStore()
    store.hfImportJobs = { 'model.gguf': makeJob({ status: 'creating model' }) }
    const w = mountSection()
    const banner = w.find('.dl-banner')
    expect(banner.find('.dl-banner-title').text()).toContain('正在注册模型…')
    expect(banner.find('.dl-warn').exists()).toBe(true)
    expect(banner.find('.dl-cancel-btn').text()).toBe('取消')
  })

  it('18c. success → title "import complete", no cancel button, no warning', () => {
    const store = useSettingsStore()
    store.hfImportJobs = { 'model.gguf': makeJob({ status: 'success', completed: 100, total: 100 }) }
    const w = mountSection()
    const banner = w.find('.dl-banner')
    expect(banner.find('.dl-banner-title').text()).toContain('导入完成')
    expect(banner.find('.dl-cancel-btn').exists()).toBe(false)
    expect(banner.find('.dl-warn').exists()).toBe(false)
  })

  it('18d. error → title "import failed", button reads "close", renders the error text, no stats row', () => {
    const store = useSettingsStore()
    store.hfImportJobs = { 'model.gguf': makeJob({ status: 'error', error: 'disk full' }) }
    const w = mountSection()
    const banner = w.find('.dl-banner')
    expect(banner.find('.dl-banner-title').text()).toContain('导入失败')
    expect(banner.find('.dl-cancel-btn').text()).toBe('关闭')
    expect(banner.find('.dl-stats').text()).toBe('disk full')
    // error state has no percent/speed/ETA stats row (those fields all sit inside v-if="status !== 'error'").
    expect(banner.find('.dl-stats b').exists()).toBe(false)
  })

  // ── 19. Progress-bar width: total===0 divide-by-zero guard (control case, Step 7 has a dedicated RED check) ──

  it('19a. total > 0 → progress-bar width follows the percentage (one decimal place)', () => {
    const store = useSettingsStore()
    // Deliberately pick numbers that don't divide evenly (1/3 → 33.3%), instead of 30/120 → 25.0%:
    // jsdom (matching real-browser CSSOM serialization rules) normalizes an integer-valued
    // percentage string "25.0%" down to "25%", the trailing .0 doesn't round-trip, so that
    // assertion couldn't tell toFixed(1) apart from toFixed(0). 33.3% is not an integer, so
    // serialization keeps it as-is, and it genuinely exercises the one-decimal-place logic.
    store.hfImportJobs = { 'model.gguf': makeJob({ completed: 1, total: 3 }) }
    const w = mountSection()
    expect((w.find('.dl-prog-fill').element as HTMLElement).style.width).toBe('33.3%')
  })

  it('19b. total === 0 → progress-bar width is 0%, not NaN% (control case)', () => {
    const store = useSettingsStore()
    store.hfImportJobs = { 'model.gguf': makeJob({ completed: 0, total: 0 }) }
    const w = mountSection()
    expect((w.find('.dl-prog-fill').element as HTMLElement).style.width).toBe('0%')
  })

  // ── 20. speed / eta each have their own independent render toggle (two control cases) ──

  it('20a. speed > 0 renders the speed row; speed === 0 does not', () => {
    const store = useSettingsStore()
    store.hfImportJobs = { 'model.gguf': makeJob({ speed: 3.2 }) }
    const withSpeed = mountSection()
    expect(withSpeed.find('.dl-stats').text()).toContain('3.2 MB/s')

    store.hfImportJobs = { 'model.gguf': makeJob({ speed: 0 }) }
    const noSpeed = mountSection()
    expect(noSpeed.find('.dl-stats').text()).not.toContain('MB/s')
  })

  it('20b. etaSecs renders ETA only when non-null; null does not render it', () => {
    const store = useSettingsStore()
    store.hfImportJobs = { 'model.gguf': makeJob({ etaSecs: 90 }) }
    const withEta = mountSection()
    expect(withEta.find('.dl-stats').text()).toContain('约 2 分钟')

    store.hfImportJobs = { 'model.gguf': makeJob({ etaSecs: null }) }
    const noEta = mountSection()
    expect(noEta.find('.dl-stats').text()).not.toContain('约')
  })

  // ── 21. Cancel/close button branching (two cases proving error goes through dismiss, the rest through cancel) ──

  it('21a. error state clicking "close" calls store.dismissImportJob(filename)', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'dismissImportJob')
    store.hfImportJobs = { 'model.gguf': makeJob({ status: 'error', error: 'x' }) }
    const w = mountSection()
    await w.find('.dl-cancel-btn').trigger('click')
    expect(spy).toHaveBeenCalledWith('model.gguf')
  })

  it('21b. downloading state clicking "cancel" calls store.cancelImportJob(filename)', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'cancelImportJob').mockResolvedValue()
    store.hfImportJobs = { 'model.gguf': makeJob({ status: 'downloading' }) }
    const w = mountSection()
    await w.find('.dl-cancel-btn').trigger('click')
    expect(spy).toHaveBeenCalledWith('model.gguf')
  })
})
