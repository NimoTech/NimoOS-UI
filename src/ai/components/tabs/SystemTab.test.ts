// 1:1 移植自 Vue2 src/views/AI/Agent/tabs/SystemTab.vue(56 行)。SP8-P1c2 Task 11。
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

// 与 apps/ 侧既有测试(installProgress.test.ts 等)同款约定:直接 mock
// useMessageBus,避免真实 socket.io-client 连接。
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

  it('有 storage → 渲染 StorageCard,breakdown[0].color 作为字符串 var(--accent) 写进 inline style', async () => {
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
    // color 是字符串 token,不是被解析过的具体色值——原样出现在内联 style 里
    expect(seg.attributes('style')).toContain('var(--accent)')
    expect(w.find('[data-testid], .empty-storage').exists()).toBe(false)
  })

  it('无 storage(null)→ 不渲染 StorageCard,渲染"存储信息不可用"空态', async () => {
    const w = mountTab({ storage: null })
    await flushPromises()
    expect(w.findComponent(StorageCard).exists()).toBe(false)
    expect(w.text()).toContain('存储信息不可用')
  })

  it('磁贴随 useUtilizationStore 的数据变化而更新(实时通道,而非一次性拉取)', async () => {
    const w = mountTab({ storage: null })
    await flushPromises()
    // 初始(mock 的 getUtilization 返回全 null)→ CPU 磁贴应显示 '—'
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
