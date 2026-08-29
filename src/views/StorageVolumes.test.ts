import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { defineComponent } from 'vue'

// The parent disk path (GROUP.path) and the partition path (child.path) are deliberately
// different, to verify that unmount forwards the parent disk path.
const GROUP = {
  path: '/dev/sda', // parent disk path — unmount must forward this, not child.path
  disk_name: 'WD',
  children: [
    { uuid: 'u1', label: 'Vol-A', type: 'ext4', size: '100', avail: '40', path: '/dev/sda1', mount_point: '/mnt/a' },
  ],
}

const storageList = vi.fn().mockResolvedValue([GROUP])
const raidList = vi.fn().mockResolvedValue([])
const getDiskList = vi.fn().mockResolvedValue({ disks: [], avail: [] })
const umount = vi.fn()
const createMock = vi.fn()
const formatMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    storage: {
      list: (...a: unknown[]) => storageList(...a),
      create: (...a: unknown[]) => createMock(...a),
      format: (...a: unknown[]) => formatMock(...a),
    },
    raid: { list: (...a: unknown[]) => raidList(...a) },
    disks: { getDiskList: (...a: unknown[]) => getDiskList(...a), umount: (...a: unknown[]) => umount(...a) },
  },
}))

vi.mock('../composables/useMessageBus', () => ({
  useMessageBus: () => ({ on: () => vi.fn() }),
}))

import StorageVolumes from './StorageVolumes.vue'
import { i18n } from '../i18n'

// A candidate drive available for creating storage (needs formatting); its path is deliberately different from the volume partition's path.
const AVAIL_DISK = { path: '/dev/sdb', name: 'sdb', model: 'WD-Blue', size: '200', need_format: 'true', serial: 's-b' }

const Stub = defineComponent({ template: '<div />' })

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Stub },
      { path: '/storage', component: Stub },
      { path: '/storage/volumes', component: StorageVolumes },
    ],
  })
  await router.push('/storage/volumes')
  await router.isReady()
  const w = mount(StorageVolumes, { global: { plugins: [router] } })
  await flushAll()
  return w
}

async function flushAll() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  storageList.mockResolvedValue([GROUP])
  raidList.mockResolvedValue([])
  getDiskList.mockResolvedValue({ disks: [], avail: [] })
  createMock.mockResolvedValue(undefined)
  formatMock.mockResolvedValue(undefined)
  document.body.innerHTML = ''
})

describe('StorageVolumes unmount dialog wiring', () => {
  it('unmount forwards v.disk (parent disk path) rather than the partition path (P1 debt item 2)', async () => {
    umount.mockResolvedValue(undefined)
    const w = await mountView()

    // Click the remove button on VolumeCard (danger-colored .vc-act.danger) to open the dialog
    const removeBtn = w.find('.vc-act.danger')
    expect(removeBtn.exists()).toBe(true)
    await removeBtn.trigger('click')
    await w.vm.$nextTick()

    // The dialog renders on body (teleport); enter the password then click confirm
    const input = document.body.querySelector<HTMLInputElement>('.ud-input')!
    expect(input).toBeTruthy()
    input.value = 'pw'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    document.body.querySelector<HTMLButtonElement>('.ud-btn.danger')!.click()
    await flushAll()

    expect(umount).toHaveBeenCalledWith({ path: '/dev/sda', password: 'pw' })
  })

  it('the confirm button is disabled while unmounting=true (guards against double-click while in flight)', async () => {
    let resolveUmount: (() => void) | undefined
    umount.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUmount = resolve
        }),
    )
    const w = await mountView()

    await w.find('.vc-act.danger').trigger('click')
    await w.vm.$nextTick()

    const input = document.body.querySelector<HTMLInputElement>('.ud-input')!
    input.value = 'pw'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()

    document.body.querySelector<HTMLButtonElement>('.ud-btn.danger')!.click()
    await flushAll() // let store.unmount's internals advance to the pending point at await service.disks.umount(...)
    await w.vm.$nextTick()

    const okBtn = document.body.querySelector<HTMLButtonElement>('.ud-btn.danger')!
    const cancelBtn = document.body.querySelector<HTMLButtonElement>('.ud-btn:not(.danger)')!
    expect(okBtn.disabled).toBe(true)
    expect(cancelBtn.disabled).toBe(true)

    // Cleanup: resolve the pending promise so it doesn't pollute later tests (not an assertion)
    resolveUmount?.()
    await flushAll()
  })
})

describe('StorageVolumes create + format wiring', () => {
  it('the create button is disabled with a hint title when there are no candidate drives', async () => {
    getDiskList.mockResolvedValue({ disks: [], avail: [] })
    const w = await mountView()

    const btn = w.find('.sv-create')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.attributes('title')).toBe(i18n.global.t('storageCreateNoDisk'))
  })

  it('create flow: click create -> dialog -> confirm -> service.storage.create receives {path,name,format}', async () => {
    getDiskList.mockResolvedValue({ disks: [], avail: [AVAIL_DISK] })
    const w = await mountView()

    // A candidate drive exists -> button enabled, no title hint
    const btn = w.find('.sv-create')
    expect(btn.attributes('disabled')).toBeUndefined()
    await btn.trigger('click')
    await w.vm.$nextTick()

    // The dialog renders on body (teleport): name defaults to Main-storage (doesn't clash with the existing Vol-A volume)
    const nameInput = document.body.querySelector<HTMLInputElement>('input.cs-input')!
    expect(nameInput).toBeTruthy()
    expect(nameInput.value).toBe('Main-storage')

    // Candidate drive has need_format=true -> only the "format and create" button (.cs-btn.danger)
    document.body.querySelector<HTMLButtonElement>('.cs-btn.danger')!.click()
    await flushAll()

    expect(createMock).toHaveBeenCalledWith({ path: '/dev/sdb', name: 'Main-storage', format: true })
  })

  it('default name shares dedup with existing volume names + RAID names: Main-storage volume + Main-storage1 RAID -> defaults to Main-storage2', async () => {
    // The existing volume is named Main-storage
    storageList.mockResolvedValue([
      {
        path: '/dev/sda',
        disk_name: 'WD',
        children: [{ uuid: 'u1', label: 'Main-storage', type: 'ext4', size: '100', avail: '40', path: '/dev/sda1', mount_point: '/mnt/a' }],
      },
    ])
    // A RAID name takes up Main-storage1 -> volume dedup alone would land on Main-storage1, adding RAID pushes it to Main-storage2
    raidList.mockResolvedValue([{ name: 'Main-storage1', mount_point: '/mnt/raid' }])
    getDiskList.mockResolvedValue({ disks: [], avail: [AVAIL_DISK] })
    const w = await mountView()

    await w.find('.sv-create').trigger('click')
    await w.vm.$nextTick()

    const nameInput = document.body.querySelector<HTMLInputElement>('input.cs-input')!
    expect(nameInput.value).toBe('Main-storage2')
  })

  it('format flow: VolumeCard format -> FormatDialog password -> service.storage.format receives {path: v.path, volume: v.mountPoint, password}', async () => {
    const w = await mountView()

    // The format button on VolumeCard (the non-danger .vc-act)
    const formatBtn = w.findAll('.vc-act').find((b) => !b.classes().includes('danger'))!
    expect(formatBtn).toBeTruthy()
    await formatBtn.trigger('click')
    await w.vm.$nextTick()

    // Enter the password in the format dialog then confirm
    const input = document.body.querySelector<HTMLInputElement>('.fd-input')!
    expect(input).toBeTruthy()
    input.value = 'pw'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    document.body.querySelector<HTMLButtonElement>('.fd-btn.danger')!.click()
    await flushAll()

    // path is the partition path (/dev/sda1), volume is the mount point (/mnt/a) — distinct from the parent disk path /dev/sda used for unmount
    expect(formatMock).toHaveBeenCalledWith({ path: '/dev/sda1', volume: '/mnt/a', password: 'pw' })
  })
})
