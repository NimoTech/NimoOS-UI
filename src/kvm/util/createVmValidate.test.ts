import { describe, it, expect } from 'vitest'
import { validateCreateVm, type CreateVmForm } from './createVmValidate'
import type { KvmISO } from '@nimotech/nimoos-service'

const HOST = { cpuCores: 6, availableMemoryMB: 9234, availableDiskGB: 263, networkInterfaces: [], defaultDiskSize: 20 }
const OS = (over: Partial<KvmISO> = {}): KvmISO => ({
  id: 'alpine-319', name: 'Alpine', version: '3.19', category: 'linux', size: '60 MB',
  status: 'downloaded', progress: 0, path: '/DATA/KVM/isos/alpine-319.iso',
  recommendedVcpu: 1, recommendedMemory: 512, minMemory: 256, minDisk: 2, ...over,
})
const F = (over: Partial<CreateVmForm> = {}): CreateVmForm => ({
  name: 'test-vm', vcpu: 2, memory: 1024, disk: 8, iso: '/DATA/KVM/isos/alpine-319.iso',
  os: 'Alpine', osType: 'linux', networkMode: 'nat', firmware: 'bios', ...over,
})

describe('validateCreateVm', () => {
  it('All valid return null', () => {
    expect(validateCreateVm(F(), OS(), HOST)).toBeNull()
  })
  it('Name is blank → kvmErrNoName (per Vue2 :1451)', () => {
    expect(validateCreateVm(F({ name: '   ' }), OS(), HOST)?.key).toBe('kvmErrNoName')
  })
  it('No OS selected → kvmErrNoOs (per Vue2 :1454)', () => {
    expect(validateCreateVm(F(), null, HOST)?.key).toBe('kvmErrNoOs')
  })

  // ⚠️ This case is a deliberate fix (not a 1:1 port): Vue2 only checks os.minDisk (:1458), so alpine-319.minDisk=2
  // would allow disk=2, but the backend vm_service.go:286-310 hard-requires disk>=8 and would always reject. Use max(8, minDisk).
  it('Disk minimum is max(8, os.minDisk) — still requires 8 when minDisk=2', () => {
    const r = validateCreateVm(F({ disk: 4 }), OS({ minDisk: 2 }), HOST)
    expect(r).toEqual({ key: 'kvmErrDiskMin', arg: '8 GB' })
    expect(validateCreateVm(F({ disk: 8 }), OS({ minDisk: 2 }), HOST)).toBeNull()
  })
  it('When minDisk is greater than 8, use minDisk as the standard', () => {
    expect(validateCreateVm(F({ disk: 20 }), OS({ minDisk: 60 }), HOST))
      .toEqual({ key: 'kvmErrDiskMin', arg: '60 GB' })
  })

  it('Memory below os.minMemory → kvmErrMemoryMin (per Vue2 :1461)', () => {
    expect(validateCreateVm(F({ memory: 128 }), OS({ minMemory: 256 }), HOST))
      .toEqual({ key: 'kvmErrMemoryMin', arg: '256 MB' })
  })
  it('Disk exceeds available → kvmErrDiskMax (per Vue2 :1464)', () => {
    expect(validateCreateVm(F({ disk: 999 }), OS(), HOST))
      .toEqual({ key: 'kvmErrDiskMax', arg: '263 GB' })
  })
  it('Memory exceeds available → kvmErrMemoryMax, unit converted to GB per formatHostMem (per Vue2 :1467,:1649)', () => {
    expect(validateCreateVm(F({ memory: 99999 }), OS(), HOST))
      .toEqual({ key: 'kvmErrMemoryMax', arg: '9.0 GB' })
  })
  it('vCPU exceeds core count → kvmErrVcpuMax (per Vue2 :1470)', () => {
    expect(validateCreateVm(F({ vcpu: 8 }), OS(), HOST))
      .toEqual({ key: 'kvmErrVcpuMax', arg: '6' })
  })
  it('When host value is 0 (settings not yet returned), do not treat 0 as a limit to reject (per Vue2 truthiness check)', () => {
    const empty = { cpuCores: 0, availableMemoryMB: 0, availableDiskGB: 0, networkInterfaces: [], defaultDiskSize: 0 }
    expect(validateCreateVm(F(), OS(), empty)).toBeNull()
  })
  it('Validation order per Vue2: name → OS → disk minimum → memory minimum → three maximums', () => {
    // Empty name + invalid disk → the name error is reported first
    expect(validateCreateVm(F({ name: '', disk: 1 }), OS(), HOST)?.key).toBe('kvmErrNoName')
  })
})
