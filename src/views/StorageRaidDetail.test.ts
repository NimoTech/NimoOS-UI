import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'
import { defineComponent } from 'vue'
import StorageRaidDetail from './StorageRaidDetail.vue'
import zh from '../i18n/zh_cn'

const raidList = vi.fn().mockResolvedValue([{ id: 7, name: 'md7', level: 5, state: 'active', mount_point: '/DATA', uuid: 'u-7' }])
const raidGetStatus = vi.fn().mockResolvedValue({ live_state: 'active', state: 'active', rebuild_pct: 0, total_bytes: 100, used_bytes: 40, free_bytes: 60, members: [{ path: '/dev/sda', state: 'active sync', number: 0 }] })
const raidGetUsage = vi.fn().mockResolvedValue({ filesystem: 'btrfs', btrfs_usage: { free_estimated_bytes: 55, cached_at: 1700000000 } })
vi.mock('@nimotech/nimoos-service', () => ({ service: {
  storage: { list: vi.fn().mockResolvedValue([]) }, disks: { getDiskList: vi.fn().mockResolvedValue({ disks: [] }) },
  raid: { list: (...a: unknown[]) => raidList(...a), getStatus: (...a: unknown[]) => raidGetStatus(...a), getUsage: (...a: unknown[]) => raidGetUsage(...a) },
} }))
vi.mock('../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: () => vi.fn() }) }))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const Stub = defineComponent({ render: () => null })
const router = createRouter({ history: createMemoryHistory(), routes: [
  { path: '/storage/raid/:id', name: 'storage-raid-detail', component: StorageRaidDetail },
  { path: '/storage/raid', name: 'storage-raid', component: Stub }, { path: '/', component: Stub },
] })

describe('StorageRaidDetail', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
  it('加载详情:名称 + RAID 级别 + 用量 + 成员 + btrfs 行', async () => {
    await router.push('/storage/raid/7'); await router.isReady()
    const store = (await import('../storage/stores/storage')).useStorageStore()
    await store.loadRaid() // 先填 raidArrays 让 detail 找得到 array
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
    expect(w.text()).toContain('md7')
    expect(w.text()).toContain('RAID 5')
    expect(w.text()).toContain('/dev/sda')
    expect(raidGetUsage).toHaveBeenCalledWith('7')
  })
  it('不渲染写操作按钮(recover/delete/replace)——P4 边界', async () => {
    await router.push('/storage/raid/7'); await router.isReady()
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick()
    // P4 边界守卫:只读页只应有 2 个按钮(StorageShell 回主页 + rd-back 返回列表);新增任何写操作按钮(recover/delete/replace)会使计数上升而红
    expect(w.findAll('button').length).toBe(2)
    expect(w.find('.rd-back').exists()).toBe(true)
  })
})
