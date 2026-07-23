import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'
import { defineComponent } from 'vue'
import StorageRaid from './StorageRaid.vue'
import zh from '../i18n/zh_cn'

const raidList = vi.fn().mockResolvedValue([])
const raidGetStatus = vi.fn().mockResolvedValue({ live_state: 'active', members: [], total_bytes: 0, used_bytes: 0, free_bytes: 0, rebuild_pct: 0 })
const listTasks = vi.fn().mockResolvedValue([])
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    storage: { list: vi.fn().mockResolvedValue([]) },
    disks: { getDiskList: vi.fn().mockResolvedValue({ disks: [] }) },
    raid: { list: (...a: unknown[]) => raidList(...a), getStatus: (...a: unknown[]) => raidGetStatus(...a), listTasks: (...a: unknown[]) => listTasks(...a) },
  },
}))
const handlers: Record<string, (...a: unknown[]) => void> = {}
vi.mock('../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: (ev: string, cb: (...a: unknown[]) => void) => { handlers[ev] = cb; return vi.fn() } }) }))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const Stub = defineComponent({ render: () => null })
const router = createRouter({ history: createMemoryHistory(), routes: [
  { path: '/storage/raid', name: 'storage-raid', component: StorageRaid },
  { path: '/storage/raid/:id', name: 'storage-raid-detail', component: Stub },
  { path: '/', name: 'home', component: Stub },
] })

describe('StorageRaid', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks(); vi.useFakeTimers() })
  afterEach(() => vi.useRealTimers())

  it('mount 调 loadRaid,空态显示 raidNoArrays', async () => {
    await router.push('/storage/raid'); await router.isReady()
    const w = mount(StorageRaid, { global: { plugins: [router, i18n] } })
    await vi.runOnlyPendingTimersAsync()
    expect(raidList).toHaveBeenCalled()
    expect(w.text()).toContain(zh.raidNoArrays)
  })

  it('有阵列时渲染 RaidCard', async () => {
    raidList.mockResolvedValue([{ id: 1, name: 'md0', level: 1, state: 'active' }])
    await router.push('/storage/raid'); await router.isReady()
    const w = mount(StorageRaid, { global: { plugins: [router, i18n] } })
    await vi.runOnlyPendingTimersAsync(); await w.vm.$nextTick()
    expect(w.find('.raid-card').exists()).toBe(true)
    expect(w.text()).toContain('md0')
  })

  it('点击 RaidCard select → 跳详情路由', async () => {
    raidList.mockResolvedValue([{ id: 9, name: 'md9', level: 1, state: 'active' }])
    await router.push('/storage/raid'); await router.isReady()
    const w = mount(StorageRaid, { global: { plugins: [router, i18n] } })
    await vi.runOnlyPendingTimersAsync(); await w.vm.$nextTick()
    const push = vi.spyOn(router, 'push')
    await w.find('.raid-card').trigger('click')
    expect(push).toHaveBeenCalledWith('/storage/raid/9')
  })

  it('订阅热插拔事件(经 useDiskHotplug)', async () => {
    await router.push('/storage/raid'); await router.isReady()
    mount(StorageRaid, { global: { plugins: [router, i18n] } })
    expect(typeof handlers['local-storage:disk:added']).toBe('function')
    expect(typeof handlers['local-storage:disk:removed']).toBe('function')
  })
})
