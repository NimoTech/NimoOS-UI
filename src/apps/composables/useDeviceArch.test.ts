import { describe, it, expect, vi, beforeEach } from 'vitest'

const sysMock = vi.hoisted(() => ({ hardwareInfo: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({ service: { sys: sysMock } }))

import { useDeviceArch, __resetDeviceArchForTest } from './useDeviceArch'

beforeEach(() => {
  localStorage.clear()
  __resetDeviceArchForTest()
  sysMock.hardwareInfo.mockReset()
})

describe('useDeviceArch', () => {
  it('reads cached localStorage arch without fetching (Vue2 同 key)', () => {
    localStorage.setItem('arch', 'arm64')
    const { arch } = useDeviceArch()
    expect(arch.value).toBe('arm64')
    expect(sysMock.hardwareInfo).not.toHaveBeenCalled()
  })

  it('fetches once, caches to localStorage, second call does not refetch', async () => {
    sysMock.hardwareInfo.mockResolvedValue({ arch: 'amd64' })
    const { arch } = useDeviceArch()
    await vi.waitFor(() => expect(arch.value).toBe('amd64'))
    expect(localStorage.getItem('arch')).toBe('amd64')
    useDeviceArch()
    expect(sysMock.hardwareInfo).toHaveBeenCalledTimes(1)
  })

  it('isCompatible: 未声明/未知一律宽容,声明了才判 includes(Vue2 unuseable 同语义)', async () => {
    sysMock.hardwareInfo.mockResolvedValue({ arch: 'amd64' })
    const { arch, isCompatible } = useDeviceArch()
    expect(isCompatible(['arm64'])).toBe(true) // arch 未知(未返回)→ 宽容
    await vi.waitFor(() => expect(arch.value).toBe('amd64'))
    expect(isCompatible(undefined)).toBe(true)
    expect(isCompatible([])).toBe(true)
    expect(isCompatible(['amd64', 'arm64'])).toBe(true)
    expect(isCompatible(['arm64'])).toBe(false)
  })

  it('archLabel: arm 显示为 armv7(Vue2 archTitle 对齐)', () => {
    localStorage.setItem('arch', 'arm')
    const { archLabel } = useDeviceArch()
    expect(archLabel.value).toBe('armv7')
  })

  it('fetch 失败静默(console.warn),arch 留空=全宽容', async () => {
    sysMock.hardwareInfo.mockRejectedValue(new Error('down'))
    const { arch, isCompatible } = useDeviceArch()
    await Promise.resolve(); await Promise.resolve()
    expect(arch.value).toBe('')
    expect(isCompatible(['arm64'])).toBe(true)
  })
})
