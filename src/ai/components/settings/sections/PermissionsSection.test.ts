import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'

const h = vi.hoisted(() => ({
  getPermissionSettings: vi.fn(),
  putPermissionSettings: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    ai: {
      getPermissionSettings: h.getPermissionSettings,
      putPermissionSettings: h.putPermissionSettings,
    },
  },
}))

import PermissionsSection from './PermissionsSection.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountSection = () => mount(PermissionsSection, { global: { plugins: [i18n] } })
const flush = async () => { await nextTick(); await nextTick(); await nextTick() }

const DEFAULT_DOC = {
  preset: 'custom',
  gates: {
    apps: 'ask', message_bus: 'ask', notes: 'ask', wiki: 'ask',
    installs: 'ask', fs_access: 'ask', mcp_tools: 'ask',
    network: 'ask', upload: 'ask', shell: 'ask',
  },
  judges: { shell: true, egress: true },
  contexts: { tasks: 'strict', channels: 'strict' },
  proxy: { tofu_ttl_hours: 1, upload_threshold_kb: 64 },
}

const clone = (d: unknown) => JSON.parse(JSON.stringify(d))

describe('PermissionsSection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    h.getPermissionSettings.mockReset()
    h.putPermissionSettings.mockReset()
    h.getPermissionSettings.mockResolvedValue(clone(DEFAULT_DOC))
    // Echo what was sent (the real backend echoes the normalized doc).
    h.putPermissionSettings.mockImplementation(async (doc: unknown) => clone(doc))
  })

  it('loads the stored policy on mount', async () => {
    const w = mountSection()
    await flush()
    expect(h.getPermissionSettings).toHaveBeenCalled()
    const vm = w.vm as unknown as { gates: Record<string, string>; forbidden: boolean }
    expect(vm.gates.shell).toBe('ask')
    expect(vm.forbidden).toBe(false)
  })

  it('toggling a gate saves the whole document with that gate switched', async () => {
    const w = mountSection()
    await flush()
    const vm = w.vm as unknown as { setGate: (k: string, v: string) => void }
    vm.setGate('notes', 'auto')
    await flush()
    expect(h.putPermissionSettings).toHaveBeenCalledTimes(1)
    const sent = h.putPermissionSettings.mock.calls[0][0] as typeof DEFAULT_DOC
    expect(sent.gates.notes).toBe('auto')
    expect(sent.gates.apps).toBe('ask')
    expect(sent.preset).toBe('custom')
  })

  it('applying the trusted preset sets every switch and saves', async () => {
    const w = mountSection()
    await flush()
    const vm = w.vm as unknown as { applyPreset: (id: string) => void }
    vm.applyPreset('trusted')
    await flush()
    const sent = h.putPermissionSettings.mock.calls[0][0] as typeof DEFAULT_DOC
    expect(sent.preset).toBe('trusted')
    expect(sent.gates.shell).toBe('auto_all')
    expect(sent.judges).toEqual({ shell: false, egress: false })
    expect(sent.contexts).toEqual({ tasks: 'auto', channels: 'auto' })
  })

  it('renders from the normalized echo, not the request', async () => {
    const w = mountSection()
    await flush()
    h.putPermissionSettings.mockResolvedValue(clone(DEFAULT_DOC))
    const vm = w.vm as unknown as {
      setGate: (k: string, v: string) => void
      gates: Record<string, string>
    }
    vm.setGate('wiki', 'auto')
    await flush()
    expect(vm.gates.wiki).toBe('ask')
  })

  it('shows the admin-only banner on 403', async () => {
    h.getPermissionSettings.mockRejectedValue({ response: { status: 403 } })
    const w = mountSection()
    await flush()
    const vm = w.vm as unknown as { forbidden: boolean }
    expect(vm.forbidden).toBe(true)
    expect(w.text()).toContain('只有管理员')
  })
})
