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
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    storage: { list: (...a: unknown[]) => storageList(...a) },
    raid: { list: (...a: unknown[]) => raidList(...a) },
    disks: { getDiskList: (...a: unknown[]) => getDiskList(...a), umount: (...a: unknown[]) => umount(...a) },
  },
}))

vi.mock('../composables/useMessageBus', () => ({
  useMessageBus: () => ({ on: () => vi.fn() }),
}))

import StorageVolumes from './StorageVolumes.vue'

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
  document.body.innerHTML = ''
})

describe('StorageVolumes 卸载弹窗接线', () => {
  it('卸载转发 v.disk(父盘路径)而非分区 path(P1 债②)', async () => {
    umount.mockResolvedValue(undefined)
    const w = await mountView()

    // 点 VolumeCard 上的移除按钮打开弹窗
    const removeBtn = w.find('.vc-remove')
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

    await w.find('.vc-remove').trigger('click')
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
