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
  it('全部合法返回 null', () => {
    expect(validateCreateVm(F(), OS(), HOST)).toBeNull()
  })
  it('名字空白 → kvmErrNoName(照 Vue2 :1451)', () => {
    expect(validateCreateVm(F({ name: '   ' }), OS(), HOST)?.key).toBe('kvmErrNoName')
  })
  it('没选 OS → kvmErrNoOs(照 Vue2 :1454)', () => {
    expect(validateCreateVm(F(), null, HOST)?.key).toBe('kvmErrNoOs')
  })

  // ⚠️ 这条是「改正确」:Vue2 只判 os.minDisk(:1458),alpine-319.minDisk=2 会放行
  // disk=2,而后端 vm_service.go:286-310 硬要求 disk>=8,请求必被拒。取 max(8, minDisk)。
  it('磁盘下限取 max(8, os.minDisk) —— minDisk=2 时仍要求 8', () => {
    const r = validateCreateVm(F({ disk: 4 }), OS({ minDisk: 2 }), HOST)
    expect(r).toEqual({ key: 'kvmErrDiskMin', arg: '8 GB' })
    expect(validateCreateVm(F({ disk: 8 }), OS({ minDisk: 2 }), HOST)).toBeNull()
  })
  it('minDisk 大于 8 时以 minDisk 为准', () => {
    expect(validateCreateVm(F({ disk: 20 }), OS({ minDisk: 60 }), HOST))
      .toEqual({ key: 'kvmErrDiskMin', arg: '60 GB' })
  })

  it('内存低于 os.minMemory → kvmErrMemoryMin(照 Vue2 :1461)', () => {
    expect(validateCreateVm(F({ memory: 128 }), OS({ minMemory: 256 }), HOST))
      .toEqual({ key: 'kvmErrMemoryMin', arg: '256 MB' })
  })
  it('磁盘超可用 → kvmErrDiskMax(照 Vue2 :1464)', () => {
    expect(validateCreateVm(F({ disk: 999 }), OS(), HOST))
      .toEqual({ key: 'kvmErrDiskMax', arg: '263 GB' })
  })
  it('内存超可用 → kvmErrMemoryMax,单位按 formatHostMem 换 GB(照 Vue2 :1467,:1649)', () => {
    expect(validateCreateVm(F({ memory: 99999 }), OS(), HOST))
      .toEqual({ key: 'kvmErrMemoryMax', arg: '9.0 GB' })
  })
  it('vCPU 超核心数 → kvmErrVcpuMax(照 Vue2 :1470)', () => {
    expect(validateCreateVm(F({ vcpu: 8 }), OS(), HOST))
      .toEqual({ key: 'kvmErrVcpuMax', arg: '6' })
  })
  it('host 值为 0(settings 还没回来)时不拿 0 当上限拒人(照 Vue2 的真值判断)', () => {
    const empty = { cpuCores: 0, availableMemoryMB: 0, availableDiskGB: 0, networkInterfaces: [], defaultDiskSize: 0 }
    expect(validateCreateVm(F(), OS(), empty)).toBeNull()
  })
  it('校验顺序照 Vue2:名字 → OS → 磁盘下限 → 内存下限 → 三个上限', () => {
    // 名字空 + 磁盘也不合法 → 先报名字
    expect(validateCreateVm(F({ name: '', disk: 1 }), OS(), HOST)?.key).toBe('kvmErrNoName')
  })
})
