import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'

// agent web tools Task 9 —— carries forward the three equivalent behavior assertions from Vue2's
// sections/__tests__/WebSection.spec.js (a1de5fe2): the secret input never gets pre-filled/echoed
// back, saving with it left blank omits api_key, and actually typing one in includes it.
// The mock scaffold is copied as-is from MemorySection.test.ts in the same directory (vi.hoisted +
// a single service.ai method mock + i18n/pinia mounting) — nothing invented here.
//
// Fix round 2 (confirmed in review, 2026-08-18) — the component was changed back from a "batch
// save button" to per-field auto-save (aligning with Vue2's a1de5fe2 and this repo's established
// MemorySection.vue convention); `data-test="web-save"` was removed along with the save button, so
// the tests now trigger `change` directly on `web-backend` / `web-api-key` to drive the real
// auto-save path, instead of clicking a button that no longer exists.
// At the same time, the "secret is never echoed back" assertion was changed from "the string 'tvly'
// never appears in the HTML" (the mock response never contained the secret value to begin with, so
// that assertion would pass against any fixture and catches nothing) to directly asserting that the
// secret input's own `value` is an empty string after `load()` — that's the property that actually
// matters: the input must never be pre-filled.

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
