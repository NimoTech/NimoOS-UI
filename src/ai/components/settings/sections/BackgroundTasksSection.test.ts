// Settings parity (2026-08-24) — ported from Vue2
// BackgroundTasksSection.spec.js (the behaviorally load-bearing cases). Vue2
// tests were method-style on the options object; <script setup> exposes no
// internals, so each assertion is rewritten against rendered DOM or service
// mock calls (same convention as ChannelsSection.test.ts).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'

const h = vi.hoisted(() => ({
  getNotesSettings: vi.fn(),
  putNotesSettings: vi.fn(),
  listModels: vi.fn(),
  listProviders: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    ai: { listModels: h.listModels, listProviders: h.listProviders },
    notes: { getNotesSettings: h.getNotesSettings, putNotesSettings: h.putNotesSettings },
  },
}))

import BackgroundTasksSection from './BackgroundTasksSection.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
// load() chains three awaited service calls (settings → local models → cloud
// providers) before its finally unlocks Save — the usual 3-tick flush leaves
// it mid-chain, so drain more microtask turns than the chain is long.
const flush = async () => {
  for (let i = 0; i < 8; i++) await nextTick()
}

function mountSection() {
  return mount(BackgroundTasksSection, { global: { plugins: [i18n] } })
}

describe('BackgroundTasksSection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    for (const fn of Object.values(h)) fn.mockReset()
    h.getNotesSettings.mockResolvedValue({ backgroundModel: '' })
    h.putNotesSettings.mockResolvedValue({ backgroundModel: '' })
    h.listModels.mockResolvedValue({ models: [] })
    h.listProviders.mockResolvedValue([])
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('loads the current background model and the model options', async () => {
    h.getNotesSettings.mockResolvedValue({ backgroundModel: 'local:llama3' })
    h.listModels.mockResolvedValue({ models: [{ name: 'llama3' }] })
    const w = mountSection()
    await flush()
    const sel = w.find('[data-test="bg-model"]').element as HTMLSelectElement
    expect(sel.value).toBe('local:llama3')
    // First option is always the explicit "not configured" (empty value) one.
    expect(sel.options[0].value).toBe('')
    expect(sel.options[0].text).toBe('未配置（后台任务将保持关闭）')
    expect(Array.from(sel.options).map((o) => o.value)).toContain('local:llama3')
    w.unmount()
  })

  it('unconfigured → shows the "distillation will not run" banner', async () => {
    const w = mountSection()
    await flush()
    expect(w.text()).toContain('选定模型前，文档沉淀不会运行。')
    w.unmount()
  })

  it('save sends {backgroundModel} with the selected key', async () => {
    h.getNotesSettings.mockResolvedValue({ backgroundModel: '' })
    h.listModels.mockResolvedValue({ models: [{ name: 'qwen3' }] })
    h.putNotesSettings.mockResolvedValue({ backgroundModel: 'local:qwen3' })
    const w = mountSection()
    await flush()
    await w.find('[data-test="bg-model"]').setValue('local:qwen3')
    await w.find('[data-test="bg-save"]').trigger('click')
    await flush()
    expect(h.putNotesSettings).toHaveBeenCalledWith({ backgroundModel: 'local:qwen3' })
    w.unmount()
  })

  it('saving the empty string (feature stays off) is a valid selection', async () => {
    const w = mountSection()
    await flush()
    await w.find('[data-test="bg-save"]').trigger('click')
    await flush()
    expect(h.putNotesSettings).toHaveBeenCalledWith({ backgroundModel: '' })
    expect(w.find('[data-test="bg-error"]').exists()).toBe(false)
    w.unmount()
  })

  it('save failure surfaces the error inline instead of throwing', async () => {
    h.putNotesSettings.mockRejectedValue(new Error('boom'))
    const w = mountSection()
    await flush()
    await w.find('[data-test="bg-save"]').trigger('click')
    await flush()
    expect(w.find('[data-test="bg-error"]').text()).toContain('boom')
    w.unmount()
  })

  it('save stays disabled until the initial load resolves — even a failed one', async () => {
    // A pre-load click would silently PUT backgroundModel: '' and wipe a
    // previously-configured value; the button unlocks only in load()'s finally.
    let release!: (v: { backgroundModel: string }) => void
    h.getNotesSettings.mockReturnValue(new Promise((r) => (release = r)))
    const w = mountSection()
    await flush()
    expect((w.find('[data-test="bg-save"]').element as HTMLButtonElement).disabled).toBe(true)
    release({ backgroundModel: '' })
    await flush()
    expect((w.find('[data-test="bg-save"]').element as HTMLButtonElement).disabled).toBe(false)
    w.unmount()
  })

  it('cloud options are disambiguated with the provider name', async () => {
    h.listProviders.mockResolvedValue([
      {
        id: 7,
        name: 'OpenAI',
        provider_type: 'openai',
        enabled: true,
        // buildCloudModelList only surfaces favorited models.
        models: [{ name: 'gpt-4o', favorite: true }],
      },
    ])
    const w = mountSection()
    await flush()
    const sel = w.find('[data-test="bg-model"]').element as HTMLSelectElement
    const cloud = Array.from(sel.options).find((o) => o.value.startsWith('cloud:'))
    expect(cloud).toBeTruthy()
    expect(cloud!.text).toBe('gpt-4o (OpenAI)')
    w.unmount()
  })
})
