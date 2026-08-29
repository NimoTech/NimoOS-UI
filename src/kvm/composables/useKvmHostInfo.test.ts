import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useKvmHostInfo } from './useKvmHostInfo'

const api = { getSettings: vi.fn(), updateSettings: vi.fn() }
vi.mock('@nimotech/nimoos-service', () => ({ service: { get kvm() { return api } } }))

// Live measured values from 2026-08-03 (spec §1.15), not hand-crafted fixture.
const REAL = {
  autostart: false, availableDiskGB: 263, availableMemoryMB: 9234, cpuCores: 6,
  defaultDiskSize: 20, defaultMemory: 2048, defaultVcpu: 2,
  networkInterfaces: ['enp2s0', 'enp4s0', 'wlp1s0'], storagePath: '/DATA/KVM',
}

beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()) })

describe('useKvmHostInfo', () => {
  it('initial value is 0 / empty array, not Vue2 hardcoded mock values (spec §12 #6)', () => {
    const s = useKvmHostInfo()
    expect(s.host.value.cpuCores).toBe(0)
    expect(s.host.value.networkInterfaces).toEqual([])
    expect(s.loaded.value).toBe(false)
  })

  it('after fetch, read-only and writable halves go to their respective slots', async () => {
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

  it('fetch failure swallowed, loaded stays false (mirrors Vue2 .catch(() => {}))', async () => {
    api.getSettings.mockRejectedValue(new Error('boom'))
    const s = useKvmHostInfo()
    await s.fetch()
    expect(s.loaded.value).toBe(false)
    expect(s.host.value.cpuCores).toBe(0)
  })

  it('save sends only 4 writable fields (PUT /settings only recognizes these)', async () => {
    api.updateSettings.mockResolvedValue({})
    const s = useKvmHostInfo()
    const err = await s.save({ storagePath: '/x', defaultVcpu: 4, defaultMemory: 4096, autostart: true })
    expect(err).toBe('')
    expect(api.updateSettings).toHaveBeenCalledWith({
      storagePath: '/x', defaultVcpu: 4, defaultMemory: 4096, autostart: true,
    })
  })

  it('save failure returns backend message (hard constraint 7: prefer backend text)', async () => {
    api.updateSettings.mockRejectedValue(new Error('storage path not writable'))
    const s = useKvmHostInfo()
    expect(await s.save({ storagePath: '/x', defaultVcpu: 1, defaultMemory: 256, autostart: false }))
      .toBe('storage path not writable')
  })

  it('after dispose, fetch response does not write state (expiry guard; interleaved path)', async () => {
    let release: (v: unknown) => void = () => {}
    api.getSettings.mockReturnValue(new Promise((r) => { release = r }))
    const s = useKvmHostInfo()
    const p = s.fetch()
    s.dispose()            // Component unmounts while request in flight
    release(REAL)
    await p
    expect(s.loaded.value).toBe(false)
    expect(s.host.value.cpuCores).toBe(0)
  })

  // Review fix (Important #3): save() does not write any shared ref, so should not have an
  // expiry guard conflating "component unmounted" with "this call actually failed" into the
  // same '' — that would lie about failure as success. Interleaved path: dispose while save
  // in flight, then let request settle with **failure**, assert return is real error message,
  // not ''.
  it('after dispose, save settles and fails → returns real error message, not empty string (expiry guard should not lie about success)', async () => {
    let reject: (e: unknown) => void = () => {}
    api.updateSettings.mockReturnValue(new Promise((_r, j) => { reject = j }))
    const s = useKvmHostInfo()
    const p = s.save({ storagePath: '/x', defaultVcpu: 1, defaultMemory: 256, autostart: false })
    s.dispose()             // Component unmounts while request in flight
    reject(new Error('storage path not writable'))
    expect(await p).toBe('storage path not writable')
  })
})
