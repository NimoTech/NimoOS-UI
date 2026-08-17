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

// Each toast self-removes after 1500ms, so reading store.msg under fake timers is unreliable — collect show()'s arguments directly instead.
function spyToast(mod: { useToast: () => { show: (t: string, d?: number) => void } }): string[] {
  const texts: string[] = []
  const toast = mod.useToast()
  vi.spyOn(toast, 'show').mockImplementation((text: string) => { texts.push(text) })
  return texts
}

describe('StorageRaid', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks(); vi.useFakeTimers() })
  afterEach(() => vi.useRealTimers())

  it('mount calls loadRaid, empty state shows raidNoArrays', async () => {
    await router.push('/storage/raid'); await router.isReady()
    const w = mount(StorageRaid, { global: { plugins: [router, i18n] } })
    await vi.runOnlyPendingTimersAsync()
    expect(raidList).toHaveBeenCalled()
    expect(w.text()).toContain(zh.raidNoArrays)
  })

  it('renders RaidCard when an array exists', async () => {
    raidList.mockResolvedValue([{ id: 1, name: 'md0', level: 1, state: 'active' }])
    await router.push('/storage/raid'); await router.isReady()
    const w = mount(StorageRaid, { global: { plugins: [router, i18n] } })
    await vi.runOnlyPendingTimersAsync(); await w.vm.$nextTick()
    expect(w.find('.raid-card').exists()).toBe(true)
    expect(w.text()).toContain('md0')
  })

  it('clicking RaidCard select -> navigates to the detail route', async () => {
    raidList.mockResolvedValue([{ id: 9, name: 'md9', level: 1, state: 'active' }])
    await router.push('/storage/raid'); await router.isReady()
    const w = mount(StorageRaid, { global: { plugins: [router, i18n] } })
    await vi.runOnlyPendingTimersAsync(); await w.vm.$nextTick()
    const push = vi.spyOn(router, 'push')
    await w.find('.raid-card').trigger('click')
    expect(push).toHaveBeenCalledWith('/storage/raid/9')
  })

  it('subscribes to hotplug events (via useDiskHotplug)', async () => {
    await router.push('/storage/raid'); await router.isReady()
    mount(StorageRaid, { global: { plugins: [router, i18n] } })
    expect(typeof handlers['local-storage:disk:added']).toBe('function')
    expect(typeof handlers['local-storage:disk:removed']).toBe('function')
  })

  it('mount probes for a creation task; starts a 1500ms poll when one is creating', async () => {
    listTasks.mockResolvedValue([{ task_id: 't2', status: 'creating', name: 'md1', level: 1, disk_count: 2, step: 1, progress: 5 }])
    getTaskFn.mockResolvedValue({ task_id: 't2', status: 'creating', step: 2, progress: 30 })
    await router.push('/storage/raid'); await router.isReady()
    mount(StorageRaid, { global: { plugins: [router, i18n] } })
    await vi.runOnlyPendingTimersAsync()
    const store = useStorageStore()
    expect(store.creatingTask?.taskId).toBe('t2')
  })

  // ── drive-replace dashboard card ───────────────────────────────────────────────────────
  const arrayRow = { id: 1, name: 'Main-storage', level: 5, state: 'degraded', member_disks: [{}, {}, {}] }
  const task = { arrayId: '1', arrayName: 'Main-storage', oldPath: '/dev/sda', newPath: '/dev/sdd' }

  it('replaceTask present -> renders the drive-replace dashboard card', async () => {
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

  it('replaceTask empty -> the dashboard card does not render', async () => {
    raidList.mockResolvedValue([arrayRow])
    await router.push('/storage/raid'); await router.isReady()
    const w = mount(StorageRaid, { global: { plugins: [router, i18n] } })
    await vi.runOnlyPendingTimersAsync()
    expect(w.findComponent({ name: 'RaidReplacingCard' }).exists()).toBe(false)
  })

  // Rebuild completion has no backend callback at all — it can only be discovered by polling. This pins down the fix for the "no notification once the swap is done" defect.
  it('polling discovers the new drive is already active sync -> dismisses the dashboard card + pops a completion toast', async () => {
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
    // The toast self-removes after 1500ms, so reading msg under fake timers would read an empty string — listening to show() is more reliable
    const shown = spyToast(await import('../stores/toast'))
    store.replaceTask = { ...task }
    const w = mount(StorageRaid, { global: { plugins: [router, i18n] } })
    await vi.runOnlyPendingTimersAsync()
    expect(store.replaceTask).toBeNull()
    expect(w.findComponent({ name: 'RaidReplacingCard' }).exists()).toBe(false)
    expect(shown.join('|')).toContain('阵列已恢复健康')
  })

  // Array health and "did this particular replacement finish" are two different things: the
  // newly swapped drive finished syncing, but another drive is also faulty — announcing
  // "restored to healthy" would be a lie.
  it('new drive is active sync but another drive is faulty -> dismisses the dashboard card, but the toast does not claim it is restored to healthy', async () => {
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

  it('the array has disappeared from the list (deleted) -> silently dismisses the dashboard card, no completion toast', async () => {
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
