import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useKvmHostInfo } from './useKvmHostInfo'

const api = { getSettings: vi.fn(), updateSettings: vi.fn() }
vi.mock('@nimotech/nimoos-service', () => ({ service: { get kvm() { return api } } }))

// 真机 2026-08-03 实测值(spec §1.15),不是手编 fixture。
const REAL = {
  autostart: false, availableDiskGB: 263, availableMemoryMB: 9234, cpuCores: 6,
  defaultDiskSize: 20, defaultMemory: 2048, defaultVcpu: 2,
  networkInterfaces: ['enp2s0', 'enp4s0', 'wlp1s0'], storagePath: '/DATA/KVM',
}

beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()) })

describe('useKvmHostInfo', () => {
  it('初值是 0 / 空数组,不是 Vue2 那组硬编码假值(spec §12 #6)', () => {
    const s = useKvmHostInfo()
    expect(s.host.value.cpuCores).toBe(0)
    expect(s.host.value.networkInterfaces).toEqual([])
    expect(s.loaded.value).toBe(false)
  })

  it('fetch 后只读半与可写半各就各位', async () => {
    api.getSettings.mockResolvedValue(REAL)
    const s = useKvmHostInfo()
    await s.fetch()
    expect(s.host.value).toEqual({
      cpuCores: 6, availableMemoryMB: 9234, availableDiskGB: 263,
      networkInterfaces: ['enp2s0', 'enp4s0', 'wlp1s0'], defaultDiskSize: 20,
    })
    expect(s.settings.value).toEqual({
      storagePath: '/DATA/KVM', defaultVcpu: 2, defaultMemory: 2048, autostart: false,
    })
    expect(s.loaded.value).toBe(true)
  })

  it('fetch 失败吞掉、loaded 保持 false(照 Vue2 .catch(() => {}))', async () => {
    api.getSettings.mockRejectedValue(new Error('boom'))
    const s = useKvmHostInfo()
    await s.fetch()
    expect(s.loaded.value).toBe(false)
    expect(s.host.value.cpuCores).toBe(0)
  })

  it('save 只发 4 个可写字段(PUT /settings 只认这些)', async () => {
    api.updateSettings.mockResolvedValue({})
    const s = useKvmHostInfo()
    const err = await s.save({ storagePath: '/x', defaultVcpu: 4, defaultMemory: 4096, autostart: true })
    expect(err).toBe('')
    expect(api.updateSettings).toHaveBeenCalledWith({
      storagePath: '/x', defaultVcpu: 4, defaultMemory: 4096, autostart: true,
    })
  })

  it('save 失败返回后端 message(硬约束 7:优先显示后端原文)', async () => {
    api.updateSettings.mockRejectedValue(new Error('storage path not writable'))
    const s = useKvmHostInfo()
    expect(await s.save({ storagePath: '/x', defaultVcpu: 1, defaultMemory: 256, autostart: false }))
      .toBe('storage path not writable')
  })

  it('dispose 后 fetch 落定不再写 state(过期守卫;交错路径)', async () => {
    let release: (v: unknown) => void = () => {}
    api.getSettings.mockReturnValue(new Promise((r) => { release = r }))
    const s = useKvmHostInfo()
    const p = s.fetch()
    s.dispose()            // 请求在途时组件卸载
    release(REAL)
    await p
    expect(s.loaded.value).toBe(false)
    expect(s.host.value.cpuCores).toBe(0)
  })

  // 评审修复(Important #3):save() 不写任何共享 ref,所以不该有过期守卫把"组件已卸载"
  // 和"这次调用真的失败了"混成同一个 ''——那样会把失败谎报成成功。交错路径:save 在途时
  // dispose(),随后让请求以**失败**落定,断言返回的是真实错误文案,不是 ''。
  it('dispose 后 save 落定且失败 → 返回真实错误文案,不是空字符串(过期守卫不该谎报成功)', async () => {
    let reject: (e: unknown) => void = () => {}
    api.updateSettings.mockReturnValue(new Promise((_r, j) => { reject = j }))
    const s = useKvmHostInfo()
    const p = s.save({ storagePath: '/x', defaultVcpu: 1, defaultMemory: 256, autostart: false })
    s.dispose()             // 请求在途时组件卸载
    reject(new Error('storage path not writable'))
    expect(await p).toBe('storage path not writable')
  })
})
