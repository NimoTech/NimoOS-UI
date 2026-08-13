// 1:1 port from Vue2 src/views/AI/Agent/tabs/SystemTab.vue (56 lines). SP8-P1c2 Task 11.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'

const getUtilization = vi.hoisted(() => vi.fn())
vi.mock('@nimotech/nimoos-service', async () => {
  const actual = await vi.importActual<typeof import('@nimotech/nimoos-service')>('@nimotech/nimoos-service')
  return { ...actual, service: { sys: { getUtilization } } }
})

// Same convention as existing tests on apps/ side (installProgress.test.ts etc.): directly
// mock useMessageBus to avoid real socket.io-client connection.
vi.mock('../../../composables/useMessageBus', () => ({
  useMessageBus: () => ({ on: vi.fn(() => () => {}) }),
}))

import SystemTab from './SystemTab.vue'
import StorageCard from '../blocks/StorageCard.vue'
import { useUtilizationStore } from '../../../stores/utilization'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountTab(props: Record<string, unknown> = {}) {
  return mount(SystemTab, { props, global: { plugins: [i18n] } })
}

describe('SystemTab', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getUtilization.mockReset()
    getUtilization.mockResolvedValue({ cpu: null, mem: null, disk: null, gpu: null, net: null, usb: null })
  })

  it('with storage → renders StorageCard, breakdown[0].color as string var(--accent) written to inline style', async () => {
    const storage = {
      used: 5,
      total: 12,
      breakdown: [{ name: 'Used', value: 5, color: 'var(--accent)' }],
      label: 'NimoOS Storage',
    }
    const w = mountTab({ storage })
    await flushPromises()
    const card = w.findComponent(StorageCard)
    expect(card.exists()).toBe(true)
    expect(card.props('breakdown')).toEqual(storage.breakdown)
    const seg = w.find('.storage-seg')
    expect(seg.exists()).toBe(true)
    // color is a string token, not a parsed concrete color value — appears as-is in inline style
    expect(seg.attributes('style')).toContain('var(--accent)')
    // Code review F2: original assertion `w.find('[data-testid], .empty-storage').exists()`
    // — both selectors don't exist in SystemTab.vue/StorageCard.vue, always false, always passes.
    // Changed to assertion that actually distinguishes v-if/v-else branches — when storage present,
    // "storage info unavailable" empty state text (same sentence asserted in null case below) should not appear.
    expect(w.text()).not.toContain('存储信息不可用')
  })

  it('without storage (null) → does not render StorageCard, renders "storage info unavailable" empty state', async () => {
    const w = mountTab({ storage: null })
    await flushPromises()
    expect(w.findComponent(StorageCard).exists()).toBe(false)
    expect(w.text()).toContain('存储信息不可用')
  })

  it('tiles update as useUtilizationStore data changes (real-time channel, not one-time fetch)', async () => {
    const w = mountTab({ storage: null })
    await flushPromises()
    // Initially (mocked getUtilization returns all null) → CPU tile should show '—'
    expect(w.text()).toContain('—')

    const store = useUtilizationStore()
    store.applySocket({
      sys_cpu: JSON.stringify({ percent: 61, temperature: 50.2, model: 'amd' }),
      sys_mem: JSON.stringify({ used: 4_000_000_000, total: 8_000_000_000 }),
      sys_net: JSON.stringify([{ speed: 500 }]),
    })
    await flushPromises()
    expect(w.text()).toContain('61%')
    expect(w.text()).toContain('4.0 GB')
    expect(w.text()).toContain('500')
    expect(w.text()).toContain('50.2°C')
  })
})
