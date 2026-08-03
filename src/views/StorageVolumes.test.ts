import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { defineComponent } from 'vue'

// 父盘路径(GROUP.path)与分区路径(child.path)刻意不同,用来验证卸载转发的是父盘路径。
const GROUP = {
  path: '/dev/sda', // 父盘路径 —— 卸载必须转发这个,不是 child.path
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

// 一块可用于创建存储的候选盘(需格式化);path 与卷分区 path 刻意不同。
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

describe('StorageVolumes 卸载弹窗接线', () => {
  it('卸载转发 v.disk(父盘路径)而非分区 path(P1 债②)', async () => {
    umount.mockResolvedValue(undefined)
    const w = await mountView()

    // 点 VolumeCard 上的移除按钮(危险色 .vc-act.danger)打开弹窗
    const removeBtn = w.find('.vc-act.danger')
    expect(removeBtn.exists()).toBe(true)
    await removeBtn.trigger('click')
    await w.vm.$nextTick()

    // 弹窗渲染在 body(teleport),输入密码后点确认
    const input = document.body.querySelector<HTMLInputElement>('.ud-input')!
    expect(input).toBeTruthy()
    input.value = 'pw'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    document.body.querySelector<HTMLButtonElement>('.ud-btn.danger')!.click()
    await flushAll()

    expect(umount).toHaveBeenCalledWith({ path: '/dev/sda', password: 'pw' })
  })

  it('unmounting=true 时确认按钮禁用(在途防连点)', async () => {
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
    await flushAll() // 让 store.unmount 内部推进到 await service.disks.umount(...) 的挂起点
    await w.vm.$nextTick()

    const okBtn = document.body.querySelector<HTMLButtonElement>('.ud-btn.danger')!
    const cancelBtn = document.body.querySelector<HTMLButtonElement>('.ud-btn:not(.danger)')!
    expect(okBtn.disabled).toBe(true)
    expect(cancelBtn.disabled).toBe(true)

    // 收尾:释放挂起的 promise,避免污染后续测试(不属于断言)
    resolveUmount?.()
    await flushAll()
  })
})

describe('StorageVolumes 创建 + 格式化接线', () => {
  it('无候选盘时创建按钮禁用并带提示 title', async () => {
    getDiskList.mockResolvedValue({ disks: [], avail: [] })
    const w = await mountView()

    const btn = w.find('.sv-create')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.attributes('title')).toBe(i18n.global.t('storageCreateNoDisk'))
  })

  it('创建链路:点创建→弹窗→确认→service.storage.create 收到 {path,name,format}', async () => {
    getDiskList.mockResolvedValue({ disks: [], avail: [AVAIL_DISK] })
    const w = await mountView()

    // 有候选盘 → 按钮可用,无 title 提示
    const btn = w.find('.sv-create')
    expect(btn.attributes('disabled')).toBeUndefined()
    await btn.trigger('click')
    await w.vm.$nextTick()

    // 弹窗渲染在 body(teleport):名称默认 Main-storage(与现有 Vol-A 卷不冲突)
    const nameInput = document.body.querySelector<HTMLInputElement>('input.cs-input')!
    expect(nameInput).toBeTruthy()
    expect(nameInput.value).toBe('Main-storage')

    // 候选盘 need_format=true → 仅「格式化并创建」按钮(.cs-btn.danger)
    document.body.querySelector<HTMLButtonElement>('.cs-btn.danger')!.click()
    await flushAll()

    expect(createMock).toHaveBeenCalledWith({ path: '/dev/sdb', name: 'Main-storage', format: true })
  })

  it('默认名与现有卷名+RAID 名共享去重:Main-storage 卷 + Main-storage1 RAID → 默认填 Main-storage2', async () => {
    // 现有卷叫 Main-storage
    storageList.mockResolvedValue([
      {
        path: '/dev/sda',
        disk_name: 'WD',
        children: [{ uuid: 'u1', label: 'Main-storage', type: 'ext4', size: '100', avail: '40', path: '/dev/sda1', mount_point: '/mnt/a' }],
      },
    ])
    // RAID 名占用 Main-storage1 → 只有卷去重会得 Main-storage1,加上 RAID 才推到 Main-storage2
    raidList.mockResolvedValue([{ name: 'Main-storage1', mount_point: '/mnt/raid' }])
    getDiskList.mockResolvedValue({ disks: [], avail: [AVAIL_DISK] })
    const w = await mountView()

    await w.find('.sv-create').trigger('click')
    await w.vm.$nextTick()

    const nameInput = document.body.querySelector<HTMLInputElement>('input.cs-input')!
    expect(nameInput.value).toBe('Main-storage2')
  })

  it('格式化链路:VolumeCard format → FormatDialog 密码 → service.storage.format 收到 {path: v.path, volume: v.mountPoint, password}', async () => {
    const w = await mountView()

    // VolumeCard 上的格式化按钮(非 danger 的 .vc-act)
    const formatBtn = w.findAll('.vc-act').find((b) => !b.classes().includes('danger'))!
    expect(formatBtn).toBeTruthy()
    await formatBtn.trigger('click')
    await w.vm.$nextTick()

    // 格式化弹窗输入密码后确认
    const input = document.body.querySelector<HTMLInputElement>('.fd-input')!
    expect(input).toBeTruthy()
    input.value = 'pw'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    document.body.querySelector<HTMLButtonElement>('.fd-btn.danger')!.click()
    await flushAll()

    // path 是分区路径(/dev/sda1),volume 是挂载点(/mnt/a) —— 与卸载用的父盘路径 /dev/sda 区分
    expect(formatMock).toHaveBeenCalledWith({ path: '/dev/sda1', volume: '/mnt/a', password: 'pw' })
  })
})
