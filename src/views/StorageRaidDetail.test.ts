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
  it('写操作按钮边界:active 阵列头部写按钮 = [delete](P4 T8 回填:recover 缺席)', async () => {
    // P3 终审加的是硬计数不变式(===2);P4 T6 加了 .rd-delete 后计数必然变化,
    // 改为语义化断言:该出现的(back + delete)出现,不该出现的(recover/replace)缺席。
    await router.push('/storage/raid/7'); await router.isReady()
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick()
    expect(w.find('.rd-back').exists()).toBe(true)
    expect(w.find('.rd-delete').exists()).toBe(true)
    expect(w.find('.rd-recover').exists()).toBe(false)
    expect(w.find('.rd-replace').exists()).toBe(false)
  })
  it('写操作按钮边界:retrying 阵列头部写按钮 = [delete, recover]', async () => {
    // getStatus 被调两次:loadRaid() 拉列表状态一次 + loadRaidDetail() 拉详情状态一次——两次都须是 retrying
    const retryingStatus = { live_state: 'retrying', state: 'retrying', rebuild_pct: 0, total_bytes: 100, used_bytes: 40, free_bytes: 60, members: [] }
    raidGetStatus.mockResolvedValueOnce(retryingStatus).mockResolvedValueOnce(retryingStatus)
    await router.push('/storage/raid/7'); await router.isReady()
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick()
    expect(w.find('.rd-delete').exists()).toBe(true)
    expect(w.find('.rd-recover').exists()).toBe(true)
    expect(w.find('.rd-replace').exists()).toBe(false)
  })
  it('recover 按钮:failed 也渲染;点击调用 store.recoverRaid(id) 一次;busy 时禁用', async () => {
    const failedStatus = { live_state: 'failed', state: 'failed', rebuild_pct: 0, total_bytes: 100, used_bytes: 40, free_bytes: 60, members: [] }
    raidGetStatus.mockResolvedValueOnce(failedStatus).mockResolvedValueOnce(failedStatus)
    await router.push('/storage/raid/7'); await router.isReady()
    const store = (await import('../storage/stores/storage')).useStorageStore()
    const recoverSpy = vi.spyOn(store, 'recoverRaid').mockResolvedValue({ state: 'active' })
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick()
    const btn = w.find('.rd-recover')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(recoverSpy).toHaveBeenCalledTimes(1)
    expect(recoverSpy).toHaveBeenCalledWith('7')

    store.raidRecovering = true
    await w.vm.$nextTick()
    expect(w.find('.rd-recover').attributes('disabled')).toBeDefined()
  })
})
