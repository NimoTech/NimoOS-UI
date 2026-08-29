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

// RaidDriveBay/RaidMatrix's internal logic is already covered by their own tests (T3/T4);
// here they are just stubbed out, focusing on wizard orchestration (choose drives -> choose
// level -> confirm -> body assembly -> task wiring).
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

  it('no drives available -> empty-state prompt + next button disabled', async () => {
    const { w } = await mountReady([])
    expect(w.find('.rcv-nodisk').exists()).toBe(true)
    expect(w.find('.rcv-next').attributes('disabled')).toBeDefined()
  })

  it('select 3 drives + level 5 + btrfs + snapshot checked (default) -> confirm -> createRaid receives the exact body', async () => {
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
      wipe_raid_residue: false, // no wipe authorization when there are no residue drives
    })
    expect(startCreateTaskSpy).toHaveBeenCalledWith(task)
    expect(pushSpy).toHaveBeenCalledWith('/storage/raid')
  })

  // ── RAID residue (2026-08-11): residue drives are selectable, but the confirm page calls out
  // the wipe + the request carries wipe_raid_residue ──
  const RESIDUE = {
    role: 'residue' as const, array_name: 'zimaos:fc5616382c017331', array_uuid: 'u', level: 'raid5',
    registered: false, active: false,
    created_at: 'Thu Aug  6 21:54:49 2026', updated_at: 'Fri Aug  7 00:29:17 2026',
  }
  const DISK_R = { path: '/dev/sdr', name: 'sdr', model: 'WD-Blue', size: 1000, needFormat: true, serial: 's-r', raid: RESIDUE }

  it('selecting a residue drive -> the confirm dialog lists the residue that will be wiped (path + array name), body carries wipe_raid_residue:true', async () => {
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

    // The confirm dialog is teleported to body via reka-ui's Portal (same lesson learned from
    // the Dialog test in this directory)
    const warn = document.body.querySelector('.rcv-residue-warn')
    expect(warn, 'residue-wipe warning did not render').not.toBeNull()
    expect(warn!.textContent).toContain('/dev/sdr')
    expect(warn!.textContent).toContain('zimaos:fc5616382c017331')

    document.body.querySelector<HTMLButtonElement>('.rcv-dialog-create')!.click()
    await flushAll()
    expect(createRaidSpy).toHaveBeenCalledWith(expect.objectContaining({ wipe_raid_residue: true }))
  })

  it('no residue drive selected -> the confirm dialog does not render the residue warning', async () => {
    document.body.innerHTML = ''
    const { w } = await mountReady()
    await selectDisks(w, [DISK_A, DISK_B, DISK_C])
    await selectLevel(w, 5)
    await w.find('.rcv-next').trigger('click')
    await setName(w, 'MyArray4')
    await w.find('.rcv-confirm').trigger('click')
    await w.vm.$nextTick()
    expect(document.body.querySelector('.rcv-dialog-create'), 'confirm dialog did not render').not.toBeNull()
    expect(document.body.querySelector('.rcv-residue-warn')).toBeNull()
  })

  it('switching to ext4 -> snapshot checkbox hidden, enable_snapshots forced to false', async () => {
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

  it('drive count < selected level min -> confirm button disabled', async () => {
    const { w } = await mountReady([DISK_A, DISK_B, DISK_C])
    // Only 3 drives selected, but (via the stubbed RaidMatrix) level 6 is force-selected (min 4) — 3 < 4
    await selectDisks(w, [DISK_A, DISK_B, DISK_C])
    await selectLevel(w, 6)
    expect(w.find('.rcv-next').attributes('disabled')).toBeDefined()
  })

  it('drive selection changes -> selectedLevel automatically set to recommendRaidLevel(drive count) (matches the Vue2 watcher verbatim)', async () => {
    const DISK_D = { path: '/dev/sdd', name: 'sdd', model: 'WD-Blue', size: 1000, needFormat: false, serial: 's-d' }
    const { w } = await mountReady([DISK_A, DISK_B, DISK_C, DISK_D])
    await selectDisks(w, [DISK_A, DISK_B, DISK_C, DISK_D])
    // recommendRaidLevel(4) === 10 (an even drive count); when no level has been manually chosen, the watcher automatically pulls it to the recommended level.
    expect(w.find('[data-level="10"]').classes()).toContain('rcv-lv-card--selected')
  })

  it('array name duplicates an existing array -> canCreate is false + error copy renders; changing to a unique name -> submittable again', async () => {
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
