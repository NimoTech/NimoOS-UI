import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { messages } from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({ list: vi.fn().mockResolvedValue({}) }))
vi.mock('@nimotech/nimoos-service', () => ({ service: { compose: svc } }))

const busOn = vi.hoisted(() => vi.fn((..._args: unknown[]) => () => {}))
vi.mock('../../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: busOn }) }))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ name: 'apps', fullPath: '/apps' }),
}))

import InstalledAppsPage from './InstalledAppsPage.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages })

describe('InstalledAppsPage', () => {
  beforeEach(() => { setActivePinia(createPinia()); svc.list.mockClear(); busOn.mockClear() })

  it('进区拉列表;空列表渲染空态;订阅容器事件与 app 生命周期事件', async () => {
    const w = mount(InstalledAppsPage, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(svc.list).toHaveBeenCalledTimes(1)
    expect(w.text()).toContain('还没有安装任何应用')
    const events = busOn.mock.calls.map((c) => c[0])
    expect(events).toContain('docker:container:state-changed')
    expect(events).toContain('app:start-begin')
    expect(events).toContain('app:uninstall-end')
    expect(events).toContain('app:install-end')
  })

  it('有应用时渲染卡片网格', async () => {
    svc.list.mockResolvedValue({
      jellyfin: { store_info: { title: { en_US: 'Jellyfin' }, icon: '', port_map: '8096', index: '/', scheme: 'http' }, status: 'running' },
    })
    const w = mount(InstalledAppsPage, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(w.find('.apps-grid').exists()).toBe(true)
    expect(w.text()).toContain('Jellyfin')
  })
})
