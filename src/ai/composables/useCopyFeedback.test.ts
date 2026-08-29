import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import { useToast } from '../../stores/toast'
import { useCopyFeedback } from './useCopyFeedback'

// SP8-P2b acceptance round 5 — see original requirement in useCopyFeedback.ts header comment.
const h = vi.hoisted(() => ({ copyText: vi.fn() }))
vi.mock('../../files/util/clipboard', () => ({ copyText: h.copyText }))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

/** Wrap composable in a real component to run (useI18n needs component context). */
function setup() {
  let api!: ReturnType<typeof useCopyFeedback>
  const C = defineComponent({
    setup() { api = useCopyFeedback(); return () => null },
  })
  const w = mount(C, { global: { plugins: [i18n] }, globalProperties: {} } as never)
  return { api, w }
}

describe('useCopyFeedback', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    h.copyText.mockReset()
    h.copyText.mockResolvedValue(undefined)
  })

  it('initially no button is checked', () => {
    const { api } = setup()
    expect(api.copiedKey.value).toBeNull()
  })

  it('on success → that key is checked, and "Copied" toast appears', async () => {
    const { api } = setup()
    const show = vi.spyOn(useToast(), 'show')
    await api.copy('http://x/v1/ai/mcp-rpc/', 'endpoint')
    expect(h.copyText).toHaveBeenCalledWith('http://x/v1/ai/mcp-rpc/')
    expect(api.copiedKey.value).toBe('endpoint')
    expect(show).toHaveBeenCalledWith(zh.aiCopied)
  })

  it('copying something else → check moves there (old auto-unchecks, only one at a time)', async () => {
    const { api } = setup()
    await api.copy('a', 'endpoint')
    await api.copy('b', 'json')
    expect(api.copiedKey.value).toBe('json')
  })

  it('on failure → does not check, and unchecks old one too (no contradictory signals)', async () => {
    const { api } = setup()
    await api.copy('a', 'endpoint')
    expect(api.copiedKey.value).toBe('endpoint')
    h.copyText.mockRejectedValueOnce(new Error('nope'))
    const show = vi.spyOn(useToast(), 'show')
    await api.copy('b', 'json')
    expect(api.copiedKey.value).toBeNull()
    expect(show).toHaveBeenCalledWith(zh.aiCfgCopyFailed, 3000, 'warning')
  })

  it('resetCopied unchecks (called when dialog closes)', async () => {
    const { api } = setup()
    await api.copy('a', 'endpoint')
    api.resetCopied()
    expect(api.copiedKey.value).toBeNull()
  })
})
