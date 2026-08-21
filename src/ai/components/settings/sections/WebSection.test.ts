import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'

// agent web tools Task 9 —— 承接 Vue2 sections/__tests__/WebSection.spec.js(a1de5fe2)
// 的三条等价行为断言:密钥输入框从不预填回显、留空保存不带 api_key、真的输入了就带上。
// mock 骨架照抄同目录 MemorySection.test.ts(vi.hoisted + service.ai 单方法 mock +
// i18n/pinia 挂载),不自创。
//
// fix round 2(协调者确认,2026-08-18)—— 组件已从"批量保存按钮"改回逐字段自动保存
// (对齐 Vue2 a1de5fe2 与本仓 MemorySection.vue 的既定约定),`data-test="web-save"`
// 随保存按钮一起撤走,测试改成直接对 `web-backend` / `web-api-key` 触发 `change`
// 事件来驱动真实的自动保存路径,而不是再点一个已经不存在的按钮。
// 同时把"从不回显密钥"那条从"HTML 里不出现 'tvly' 字样"(mock 响应本来就不含
// 密钥值,这条断言对任何 fixture 都成立,测不出问题)改成直接断言密钥输入框
// 自身的 value 在 load() 之后是空串——这才是真正要守住的属性:输入框永远不会
// 被预填。

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

  it('never pre-fills the api-key input from the loaded (has_key-only) settings', async () => {
    const w = mountSection()
    await flush()
    expect(h.getWebSettings).toHaveBeenCalled()
    const input = w.find('[data-test="web-api-key"]').element as HTMLInputElement
    expect(input.value).toBe('')
  })

  it('omits api_key when the field is blank', async () => {
    const w = mountSection()
    await flush()
    // Drive a real autosave via a different field's change event — the key
    // input is still blank, so the outgoing payload must not carry api_key.
    await w.find('[data-test="web-backend"]').setValue('brave')
    await flush()
    expect('api_key' in h.putWebSettings.mock.calls[0][0]).toBe(false)
  })

  it('sends a newly typed api_key', async () => {
    const w = mountSection()
    await flush()
    await w.find('[data-test="web-api-key"]').setValue('tvly-new')
    await flush()
    expect(h.putWebSettings.mock.calls[0][0].api_key).toBe('tvly-new')
  })
})
