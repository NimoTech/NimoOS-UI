import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'
import { defineComponent } from 'vue'
import StorageRaidCreate from './StorageRaidCreate.vue'
import { useStorageStore } from '../storage/stores/storage'
import type { RaidArray, RaidTask } from '../storage/util/raidView'
import zh from '../i18n/zh_cn'

const getDiskList = vi.fn().mockResolvedValue({ disks: [], avail: [] })
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    storage: { list: vi.fn().mockResolvedValue([]) },
    raid: { list: vi.fn().mockResolvedValue([]) },
    disks: { getDiskList: (...a: unknown[]) => getDiskList(...a) },
  },
}))
vi.mock('../composables/useMessageBus', () => ({
  useMessageBus: () => ({ on: () => vi.fn() }),
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const Stub = defineComponent({ render: () => null })

// RaidDriveBay/RaidMatrix 内部逻辑已在各自测试里覆盖(T3/T4);这里只 stub 掉,
// 聚焦向导编排(选盘→选级别→确认→body 组装→task 接线)。
const RaidDriveBayStub = defineComponent({
  props: { disks: { type: Array, default: () => [] }, modelValue: { type: Array, default: () => [] } },
  emits: ['update:modelValue'],
  template: '<div class="stub-bay"></div>',
})
const RaidMatrixStub = defineComponent({
  props: { diskCount: Number, sizeBytes: Number, selectedLevel: [Number, null] },
  emits: ['update:selectedLevel', 'details'],
  template: '<div class="stub-matrix"></div>',
})

async function flushAll() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/storage/raid', name: 'storage-raid', component: Stub },
      { path: '/storage/raid/create', name: 'storage-raid-create', component: StorageRaidCreate },
    ],
  })
  return { router }
}

const DISK_A = { path: '/dev/sda', name: 'sda', model: 'WD-Blue', size: 1000, needFormat: false, serial: 's-a' }
const DISK_B = { path: '/dev/sdb', name: 'sdb', model: 'WD-Blue', size: 1000, needFormat: false, serial: 's-b' }
const DISK_C = { path: '/dev/sdc', name: 'sdc', model: 'WD-Blue', size: 1000, needFormat: false, serial: 's-c' }

async function mountReady(avail: unknown[] = [DISK_A, DISK_B, DISK_C]) {
  getDiskList.mockResolvedValue({ disks: [], avail })
  const { router } = mountView()
  await router.push('/storage/raid/create')
  await router.isReady()
  const w = mount(StorageRaidCreate, {
    global: {
      plugins: [router, i18n],
      stubs: { RaidDriveBay: RaidDriveBayStub, RaidMatrix: RaidMatrixStub },
    },
  })
  await flushAll()
  return { w, router }
}

async function selectDisks(w: ReturnType<typeof mount>, disks: unknown[]) {
  await w.findComponent(RaidDriveBayStub).vm.$emit('update:modelValue', disks)
}
async function selectLevel(w: ReturnType<typeof mount>, id: number) {
  if (!w.find('.stub-matrix').exists()) await w.find('.rcv-matrix-toggle').trigger('click')
  await w.findComponent(RaidMatrixStub).vm.$emit('update:selectedLevel', id)
}
async function setName(w: ReturnType<typeof mount>, name: string) {
  const input = w.find<HTMLInputElement>('.rcv-name-input')
  input.element.value = name
  await input.trigger('input')
}

describe('StorageRaidCreate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  it('无可用盘 → 空态提示 + 下一步按钮禁用', async () => {
    const { w } = await mountReady([])
    expect(w.find('.rcv-nodisk').exists()).toBe(true)
    expect(w.find('.rcv-next').attributes('disabled')).toBeDefined()
  })

  it('选 3 盘 + 级别 5 + btrfs + 快照勾选(默认)→ 确认 → createRaid 收到逐字 body', async () => {
    const { w, router } = await mountReady()
    const store = useStorageStore()
    const task: RaidTask = {
      taskId: 't1', name: 'MyArray', level: 5, filesystem: 'btrfs', diskCount: 3,
      step: 0, stepName: '', progress: 0, elapsedSeconds: 0, error: '', status: 'creating',
    }
    const createRaidSpy = vi.spyOn(store, 'createRaid').mockResolvedValue(task)
    const startCreateTaskSpy = vi.spyOn(store, 'startCreateTask').mockImplementation(() => {})
    const pushSpy = vi.spyOn(router, 'push')

    await selectDisks(w, [DISK_A, DISK_B, DISK_C])
    await selectLevel(w, 5)
    expect(w.find('.rcv-next').attributes('disabled')).toBeUndefined()
    await w.find('.rcv-next').trigger('click')

    await setName(w, 'MyArray')
    expect(w.find('.rcv-snapshot-checkbox').exists()).toBe(true)
    expect((w.find<HTMLInputElement>('.rcv-snapshot-checkbox').element).checked).toBe(true)

    expect(w.find('.rcv-confirm').attributes('disabled')).toBeUndefined()
    await w.find('.rcv-confirm').trigger('click')
    await w.vm.$nextTick()
    document.body.querySelector<HTMLButtonElement>('.rcv-dialog-create')!.click()
    await flushAll()

    expect(createRaidSpy).toHaveBeenCalledWith({
      name: 'MyArray',
      level: 5,
      disk_paths: ['/dev/sda', '/dev/sdb', '/dev/sdc'],
      chunk_kb: 512,
      filesystem: 'btrfs',
      enable_snapshots: true,
      wipe_raid_residue: false, // 无 residue 盘时不带清除授权
    })
    expect(startCreateTaskSpy).toHaveBeenCalledWith(task)
    expect(pushSpy).toHaveBeenCalledWith('/storage/raid')
  })

  // ── RAID 残留(2026-08-11):residue 盘可选,但确认页点名清除 + 请求带 wipe_raid_residue ──
  const RESIDUE = {
    role: 'residue' as const, array_name: 'zimaos:fc5616382c017331', array_uuid: 'u', level: 'raid5',
    registered: false, active: false,
    created_at: 'Thu Aug  6 21:54:49 2026', updated_at: 'Fri Aug  7 00:29:17 2026',
  }
  const DISK_R = { path: '/dev/sdr', name: 'sdr', model: 'WD-Blue', size: 1000, needFormat: true, serial: 's-r', raid: RESIDUE }

  it('选中 residue 盘 → 确认弹窗列出将被清除的残留(path + 阵列名),body 带 wipe_raid_residue:true', async () => {
    document.body.innerHTML = ''
    const { w } = await mountReady([DISK_A, DISK_B, DISK_R])
    const store = useStorageStore()
    const createRaidSpy = vi.spyOn(store, 'createRaid').mockResolvedValue(null)

    await selectDisks(w, [DISK_A, DISK_B, DISK_R])
    await selectLevel(w, 5)
    await w.find('.rcv-next').trigger('click')
    await setName(w, 'MyArray3')
    await w.find('.rcv-confirm').trigger('click')
    await w.vm.$nextTick()

    // 确认弹窗经 reka-ui Portal Teleport 到 body(同目录 Dialog 测试同款教训)
    const warn = document.body.querySelector('.rcv-residue-warn')
    expect(warn, '残留清除警告未渲染').not.toBeNull()
    expect(warn!.textContent).toContain('/dev/sdr')
    expect(warn!.textContent).toContain('zimaos:fc5616382c017331')

    document.body.querySelector<HTMLButtonElement>('.rcv-dialog-create')!.click()
    await flushAll()
    expect(createRaidSpy).toHaveBeenCalledWith(expect.objectContaining({ wipe_raid_residue: true }))
  })

  it('未选 residue 盘 → 确认弹窗不渲染残留警告', async () => {
    document.body.innerHTML = ''
    const { w } = await mountReady()
    await selectDisks(w, [DISK_A, DISK_B, DISK_C])
    await selectLevel(w, 5)
    await w.find('.rcv-next').trigger('click')
    await setName(w, 'MyArray4')
    await w.find('.rcv-confirm').trigger('click')
    await w.vm.$nextTick()
    expect(document.body.querySelector('.rcv-dialog-create'), '确认弹窗未渲染').not.toBeNull()
    expect(document.body.querySelector('.rcv-residue-warn')).toBeNull()
  })

  it('切 ext4 → 快照复选框隐藏,enable_snapshots 强制 false', async () => {
    const { w } = await mountReady()
    const store = useStorageStore()
    const task: RaidTask = {
      taskId: 't2', name: 'MyArray2', level: 5, filesystem: 'ext4', diskCount: 3,
      step: 0, stepName: '', progress: 0, elapsedSeconds: 0, error: '', status: 'creating',
    }
    const createRaidSpy = vi.spyOn(store, 'createRaid').mockResolvedValue(task)
    vi.spyOn(store, 'startCreateTask').mockImplementation(() => {})

    await selectDisks(w, [DISK_A, DISK_B, DISK_C])
    await selectLevel(w, 5)
    await w.find('.rcv-next').trigger('click')
    await setName(w, 'MyArray2')

    await w.find('.rcv-fs-select').setValue('ext4')
    expect(w.find('.rcv-snapshot-checkbox').exists()).toBe(false)

    await w.find('.rcv-confirm').trigger('click')
    await w.vm.$nextTick()
    document.body.querySelector<HTMLButtonElement>('.rcv-dialog-create')!.click()
    await flushAll()

    expect(createRaidSpy).toHaveBeenCalledWith(
      expect.objectContaining({ filesystem: 'ext4', enable_snapshots: false }),
    )
  })

  it('盘数 < 所选级别 min → 确认按钮禁用', async () => {
    const { w } = await mountReady([DISK_A, DISK_B, DISK_C])
    // 只选 3 盘,但(经由 stub 的 RaidMatrix)强选级别 6(min 4)—— 3 < 4
    await selectDisks(w, [DISK_A, DISK_B, DISK_C])
    await selectLevel(w, 6)
    expect(w.find('.rcv-next').attributes('disabled')).toBeDefined()
  })

  it('选盘变化 → selectedLevel 自动设为 recommendRaidLevel(盘数)(Vue2 watcher 逐字对齐)', async () => {
    const DISK_D = { path: '/dev/sdd', name: 'sdd', model: 'WD-Blue', size: 1000, needFormat: false, serial: 's-d' }
    const { w } = await mountReady([DISK_A, DISK_B, DISK_C, DISK_D])
    await selectDisks(w, [DISK_A, DISK_B, DISK_C, DISK_D])
    // recommendRaidLevel(4) === 10(偶数盘);未手动选级别时 watcher 自动拉到推荐级别。
    expect(w.find('[data-level="10"]').classes()).toContain('rcv-lv-card--selected')
  })

  it('阵列名与已有阵列重名 → canCreate 为 false + 错误文案渲染;改唯一名 → 恢复可提交', async () => {
    const { w } = await mountReady()
    const store = useStorageStore()
    const existing: RaidArray = { id: 1, name: 'Taken', level: 5, state: 'active' }
    store.raidArrays = [existing]

    await selectDisks(w, [DISK_A, DISK_B, DISK_C])
    await selectLevel(w, 5)
    await w.find('.rcv-next').trigger('click')

    await setName(w, 'Taken')
    expect(w.find('.rcv-confirm').attributes('disabled')).toBeDefined()
    const errNodes = w.findAll('.rc-name-error')
    expect(errNodes.length).toBeGreaterThan(0)
    expect(errNodes[errNodes.length - 1].text()).toBe(zh.raidCreateNameExists)

    await setName(w, 'UniqueName')
    expect(w.find('.rc-name-error').exists()).toBe(false)
    expect(w.find('.rcv-confirm').attributes('disabled')).toBeUndefined()
  })
})
