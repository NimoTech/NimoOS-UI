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
  it('reads cached localStorage arch without fetching (Vue2 same key)', () => {
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

  it('isCompatible: undeclared/unknown always permit, judge includes only when declared (Vue2 unuseable same semantics)', async () => {
    sysMock.hardwareInfo.mockResolvedValue({ arch: 'amd64' })
    const { arch, isCompatible } = useDeviceArch()
    expect(isCompatible(['arm64'])).toBe(true) // arch unknown (not returned) → permit
    await vi.waitFor(() => expect(arch.value).toBe('amd64'))
    expect(isCompatible(undefined)).toBe(true)
    expect(isCompatible([])).toBe(true)
    expect(isCompatible(['amd64', 'arm64'])).toBe(true)
    expect(isCompatible(['arm64'])).toBe(false)
  })

  it('archLabel: arm displays as armv7 (Vue2 archTitle aligned)', () => {
    localStorage.setItem('arch', 'arm')
    const { archLabel } = useDeviceArch()
    expect(archLabel.value).toBe('armv7')
  })

  it('fetch fails silently (console.warn), arch empty = fully permit', async () => {
    sysMock.hardwareInfo.mockRejectedValue(new Error('down'))
    const { arch, isCompatible } = useDeviceArch()
    await Promise.resolve(); await Promise.resolve()
    expect(arch.value).toBe('')
    expect(isCompatible(['arm64'])).toBe(true)
  })
})
