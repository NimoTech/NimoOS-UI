import { describe, it, expect } from 'vitest'
import { isIsoFile, formatFileSize, filterByCategory, matchTemplateByFilename, osTemplateDefaults } from './isoMatch'
import type { KvmISO } from '@nimotech/nimoos-service'

// 真机 2026-08-03 `curl /v1/kvm/isos` 的 8 条里取 5 条(逐字,未手编)。
const T = (over: Partial<KvmISO>): KvmISO => ({
  id: 'x', name: 'X', version: '1', category: 'linux', size: '1 GB', status: 'available',
  progress: 0, recommendedVcpu: 2, recommendedMemory: 2048, minMemory: 512, minDisk: 8, ...over,
})
const TEMPLATES: KvmISO[] = [
  T({ id: 'debian-13', name: 'Debian', version: '13 (Trixie)', category: 'linux', size: '676 MB', minDisk: 8, minMemory: 512, recommendedMemory: 2048 }),
  T({ id: 'ubuntu-2404', name: 'Ubuntu', version: '24.04.4 LTS', category: 'linux', size: '6.2 GB', minDisk: 10, minMemory: 1024, recommendedMemory: 4096 }),
  T({ id: 'win10', name: 'Windows 10', version: '22H2', category: 'windows', size: '6.7 GB', minDisk: 60, minMemory: 2048, recommendedMemory: 4096 }),
  T({ id: 'win11', name: 'Windows 11', version: '24H2', category: 'windows', size: '5.8 GB', minDisk: 60, minMemory: 4096, recommendedMemory: 8192 }),
  T({ id: 'freebsd-14', name: 'FreeBSD', version: '14', category: 'bsd', size: '1.2 GB', minDisk: 10 }),
  T({ id: 'alpine-319', name: 'Alpine', version: '3.19', category: 'linux', size: '60 MB', status: 'downloaded', path: '/DATA/KVM/isos/alpine-319.iso', minDisk: 2, minMemory: 256 }),
]

describe('isIsoFile', () => {
  it('大小写不敏感地认 .iso', () => {
    expect(isIsoFile('Alpine.ISO')).toBe(true)
    expect(isIsoFile('a.iso')).toBe(true)
    expect(isIsoFile('a.img')).toBe(false)
    expect(isIsoFile('isolate.txt')).toBe(false)
  })
})

describe('formatFileSize', () => {
  it('照 Vue2 OSSelector:1024 进制、一位小数、空/0 返回空串', () => {
    expect(formatFileSize(undefined)).toBe('')
    expect(formatFileSize(0)).toBe('')
    expect(formatFileSize(512)).toBe('512.0 B')
    expect(formatFileSize(1048576)).toBe('1.0 MB')
    expect(formatFileSize(1610612736)).toBe('1.5 GB')
  })
})

describe('filterByCategory', () => {
  it('all 返回全部,其余按 category 精确过滤', () => {
    expect(filterByCategory(TEMPLATES, 'all')).toHaveLength(6)
    expect(filterByCategory(TEMPLATES, 'windows').map((t) => t.id)).toEqual(['win10', 'win11'])
    expect(filterByCategory(TEMPLATES, 'bsd').map((t) => t.id)).toEqual(['freebsd-14'])
  })
})

describe('matchTemplateByFilename', () => {
  it('文件名含模板 id 时直接命中(照 Vue2 :335-340)', () => {
    expect(matchTemplateByFilename('my-debian-13-netinst.iso', TEMPLATES)?.id).toBe('debian-13')
  })
  it('win11 / win10 / 泛 win 三级兜底(照 Vue2 :343-345)', () => {
    expect(matchTemplateByFilename('Win11_24H2.iso', TEMPLATES)?.id).toBe('win11')
    expect(matchTemplateByFilename('win10_x64.iso', TEMPLATES)?.id).toBe('win10')
    expect(matchTemplateByFilename('windows-server.iso', TEMPLATES)?.id).toBe('win11')
  })
  it('认不出来返回 null', () => {
    expect(matchTemplateByFilename('haiku-r1.iso', TEMPLATES)).toBeNull()
  })
})

describe('osTemplateDefaults', () => {
  it('generic-linux → bios/linux/Linux(照 Vue2 :722-725)', () => {
    expect(osTemplateDefaults('generic-linux', TEMPLATES))
      .toMatchObject({ osType: 'linux', firmware: 'bios', os: 'Linux' })
  })
  it('generic-windows → uefi/windows/Windows(照 Vue2 :726-729)', () => {
    expect(osTemplateDefaults('generic-windows', TEMPLATES))
      .toMatchObject({ osType: 'windows', firmware: 'uefi', os: 'Windows' })
  })
  it('真实模板:id 或 name 含 win 即判 windows + uefi,并带出推荐规格(照 Vue2 :731-743)', () => {
    expect(osTemplateDefaults('win10', TEMPLATES)).toMatchObject({
      osType: 'windows', firmware: 'uefi', os: 'Windows 10', vcpu: 2, memory: 4096, minDisk: 60,
    })
    expect(osTemplateDefaults('ubuntu-2404', TEMPLATES)).toMatchObject({
      osType: 'linux', firmware: 'bios', os: 'Ubuntu', vcpu: 2, memory: 4096, minDisk: 10,
    })
  })
  it('未知 id 回落 generic-linux', () => {
    expect(osTemplateDefaults('nope', TEMPLATES)).toMatchObject({ osType: 'linux', firmware: 'bios' })
  })
})
