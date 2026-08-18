import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'

// agent web tools Task 9 —— 承接 Vue2 sections/__tests__/WebSection.spec.js(a1de5fe2)
// 的三条等价行为断言:从不回显已存密钥、留空保存不带 api_key、真的输入了就带上。
// mock 骨架照抄同目录 MemorySection.test.ts(vi.hoisted + service.ai 单方法 mock +
// i18n/pinia 挂载),不自创。

const h = vi.hoisted(() => ({
  getWebSettings: vi.fn(),
  putWebSettings: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    ai: {
      getWebSettings: h.getWebSettings,
      putWebSettings: h.putWebSettings,
    },
  },
}))

import WebSection from './WebSection.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountSection = () => mount(WebSection, { global: { plugins: [i18n] } })
const flush = async () => { await nextTick(); await nextTick(); await nextTick() }

describe('WebSection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    h.getWebSettings.mockReset()
    h.putWebSettings.mockReset()
    h.getWebSettings.mockResolvedValue({
      backend: 'tavily', base_url: '', enabled: true, has_key: true,
    })
    h.putWebSettings.mockResolvedValue({
      backend: 'tavily', base_url: '', enabled: true, has_key: true,
    })
  })

  it('never renders the stored key', async () => {
    const w = mountSection()
    await flush()
    expect(h.getWebSettings).toHaveBeenCalled()
    expect(w.html()).not.toContain('tvly')
  })

  it('omits api_key when the field is blank', async () => {
    const w = mountSection()
    await flush()
    await w.find('[data-test="web-save"]').trigger('click')
    await flush()
    expect('api_key' in h.putWebSettings.mock.calls[0][0]).toBe(false)
  })

  it('sends a newly typed api_key', async () => {
    const w = mountSection()
    await flush()
    await w.find('[data-test="web-api-key"]').setValue('tvly-new')
    await w.find('[data-test="web-save"]').trigger('click')
    await flush()
    expect(h.putWebSettings.mock.calls[0][0].api_key).toBe('tvly-new')
  })
})
