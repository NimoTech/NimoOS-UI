import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'
import { defineComponent } from 'vue'
import StorageRaid from './StorageRaid.vue'
import { useStorageStore } from '../storage/stores/storage'
import zh from '../i18n/zh_cn'

const raidList = vi.fn().mockResolvedValue([])
const raidGetStatus = vi.fn().mockResolvedValue({ live_state: 'active', members: [], total_bytes: 0, used_bytes: 0, free_bytes: 0, rebuild_pct: 0 })
const listTasks = vi.fn().mockResolvedValue([])
const getTaskFn = vi.fn().mockResolvedValue({ status: 'creating' })
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    storage: { list: vi.fn().mockResolvedValue([]) },
    disks: { getDiskList: vi.fn().mockResolvedValue({ disks: [] }) },
    raid: { list: (...a: unknown[]) => raidList(...a), getStatus: (...a: unknown[]) => raidGetStatus(...a), listTasks: (...a: unknown[]) => listTasks(...a), getTask: (...a: unknown[]) => getTaskFn(...a) },
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

// toast 每条 1500ms 后自我移除,假定时器下读 store.msg 不可靠 —— 直接收集 show() 的入参。
function spyToast(mod: { useToast: () => { show: (t: string, d?: number) => void } }): string[] {
  const texts: string[] = []
  const toast = mod.useToast()
  vi.spyOn(toast, 'show').mockImplementation((text: string) => { texts.push(text) })
  return texts
}

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

  it('mount 探测创建任务;有 creating 时启动 1500ms 轮询', async () => {
    listTasks.mockResolvedValue([{ task_id: 't2', status: 'creating', name: 'md1', level: 1, disk_count: 2, step: 1, progress: 5 }])
    getTaskFn.mockResolvedValue({ task_id: 't2', status: 'creating', step: 2, progress: 30 })
    await router.push('/storage/raid'); await router.isReady()
    mount(StorageRaid, { global: { plugins: [router, i18n] } })
    await vi.runOnlyPendingTimersAsync()
    const store = useStorageStore()
    expect(store.creatingTask?.taskId).toBe('t2')
  })

  // ── 换盘看板卡 ───────────────────────────────────────────────────────
  const arrayRow = { id: 1, name: 'Main-storage', level: 5, state: 'degraded', member_disks: [{}, {}, {}] }
  const task = { arrayId: '1', arrayName: 'Main-storage', oldPath: '/dev/sda', newPath: '/dev/sdd' }

  it('replaceTask 在场 → 渲染换盘看板卡', async () => {
    raidList.mockResolvedValue([arrayRow])
    raidGetStatus.mockResolvedValue({
      live_state: 'clean, degraded', state: 'degraded', rebuild_pct: 42,
      rebuild_finish: '3.1min', rebuild_speed: '900K/sec', total_bytes: 100, used_bytes: 1, free_bytes: 99,
      members: [{ path: '/dev/sdd', state: 'spare rebuilding', number: 4 }],
    })
    await router.push('/storage/raid'); await router.isReady()
    const store = useStorageStore()
    store.replaceTask = { ...task }
    const w = mount(StorageRaid, { global: { plugins: [router, i18n] } })
    await vi.runOnlyPendingTimersAsync()
    expect(w.findComponent({ name: 'RaidReplacingCard' }).exists()).toBe(true)
    expect(w.text()).toContain('替换中')
    expect(w.find('.rpc-pct').text()).toBe('42%')
  })

  it('replaceTask 为空 → 不渲染看板卡', async () => {
    raidList.mockResolvedValue([arrayRow])
    await router.push('/storage/raid'); await router.isReady()
    const w = mount(StorageRaid, { global: { plugins: [router, i18n] } })
    await vi.runOnlyPendingTimersAsync()
    expect(w.findComponent({ name: 'RaidReplacingCard' }).exists()).toBe(false)
  })

  // 重建完成没有任何后端回调,只能靠轮询发现 —— 这条钉住「换完没提示」那条缺陷的修法。
  it('轮询发现新盘已 active sync → 撤看板 + 弹完成提示', async () => {
    raidList.mockResolvedValue([{ ...arrayRow, state: 'active' }])
    raidGetStatus.mockResolvedValue({
      live_state: 'clean', state: 'active', rebuild_pct: -1, total_bytes: 100, used_bytes: 1, free_bytes: 99,
      members: [
        { path: '/dev/sdd', state: 'active sync', number: 4 },
        { path: '/dev/sdb', state: 'active sync', number: 1 },
        { path: '/dev/sdc', state: 'active sync', number: 3 },
      ],
    })
    await router.push('/storage/raid'); await router.isReady()
    const store = useStorageStore()
    // toast 1500ms 后自我移除,假定时器下读 msg 会读到空串 —— 监听 show 更可靠
    const shown = spyToast(await import('../stores/toast'))
    store.replaceTask = { ...task }
    const w = mount(StorageRaid, { global: { plugins: [router, i18n] } })
    await vi.runOnlyPendingTimersAsync()
    expect(store.replaceTask).toBeNull()
    expect(w.findComponent({ name: 'RaidReplacingCard' }).exists()).toBe(false)
    expect(shown.join('|')).toContain('阵列已恢复健康')
  })

  // 阵列健康度与"这一次替换是否完成"是两件事:换上去的盘同步好了,但另一块盘也坏着,
  // 报"已恢复健康"就是撒谎。
  it('新盘 active sync 但另一块盘 faulty → 撤看板,但提示不声称已恢复健康', async () => {
    raidList.mockResolvedValue([arrayRow])
    raidGetStatus.mockResolvedValue({
      live_state: 'clean, degraded', state: 'degraded', rebuild_pct: -1, total_bytes: 100, used_bytes: 1, free_bytes: 99,
      members: [
        { path: '/dev/sdd', state: 'active sync', number: 4 },
        { path: '/dev/sdb', state: 'faulty', number: 1 },
      ],
    })
    await router.push('/storage/raid'); await router.isReady()
    const store = useStorageStore()
    const shown = spyToast(await import('../stores/toast'))
    store.replaceTask = { ...task }
    mount(StorageRaid, { global: { plugins: [router, i18n] } })
    await vi.runOnlyPendingTimersAsync()
    expect(store.replaceTask).toBeNull()
    expect(shown.join('|')).toContain('仍未恢复健康')
  })

  it('阵列已从列表消失(被删)→ 静默撤看板,不报完成', async () => {
    raidList.mockResolvedValue([])
    const store = useStorageStore()
    const shown = spyToast(await import('../stores/toast'))
    store.replaceTask = { ...task }
    await router.push('/storage/raid'); await router.isReady()
    mount(StorageRaid, { global: { plugins: [router, i18n] } })
    await vi.runOnlyPendingTimersAsync()
    expect(store.replaceTask).toBeNull()
    expect(shown.join('|')).not.toContain('更换完成')
  })
})
