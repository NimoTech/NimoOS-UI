import { describe, it, expect } from 'vitest'
import {
  isIsoFile, formatFileSize, filterByCategory, matchTemplateByFilename, matchTemplateByFamily,
  osTemplateDefaults,
} from './isoMatch'
import type { KvmISO } from '@nimotech/nimoos-service'

// From 8 results of real device 2026-08-03 `curl /v1/kvm/isos`, took 5 (verbatim, not hand-edited).
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
  it('case-insensitive recognition of .iso', () => {
    expect(isIsoFile('Alpine.ISO')).toBe(true)
    expect(isIsoFile('a.iso')).toBe(true)
    expect(isIsoFile('a.img')).toBe(false)
    expect(isIsoFile('isolate.txt')).toBe(false)
  })
})

describe('formatFileSize', () => {
  it('following Vue2 OSSelector: 1024 base, one decimal place, empty/0 returns empty string', () => {
    expect(formatFileSize(undefined)).toBe('')
    expect(formatFileSize(0)).toBe('')
    expect(formatFileSize(512)).toBe('512.0 B')
    expect(formatFileSize(1048576)).toBe('1.0 MB')
    expect(formatFileSize(1610612736)).toBe('1.5 GB')
  })
})

describe('filterByCategory', () => {
  it("'all' returns all, rest filters exactly by category", () => {
    expect(filterByCategory(TEMPLATES, 'all')).toHaveLength(6)
    expect(filterByCategory(TEMPLATES, 'windows').map((t) => t.id)).toEqual(['win10', 'win11'])
    expect(filterByCategory(TEMPLATES, 'bsd').map((t) => t.id)).toEqual(['freebsd-14'])
  })
})

describe('matchTemplateByFilename', () => {
  it('direct hit when filename contains template id (following Vue2 :335-340)', () => {
    expect(matchTemplateByFilename('my-debian-13-netinst.iso', TEMPLATES)?.id).toBe('debian-13')
  })
  it('win11 / win10 / generic win three-level fallback (following Vue2 :343-345)', () => {
    expect(matchTemplateByFilename('Win11_24H2.iso', TEMPLATES)?.id).toBe('win11')
    expect(matchTemplateByFilename('win10_x64.iso', TEMPLATES)?.id).toBe('win10')
    expect(matchTemplateByFilename('windows-server.iso', TEMPLATES)?.id).toBe('win11')
  })
  it('returns null if not recognized', () => {
    expect(matchTemplateByFilename('haiku-r1.iso', TEMPLATES)).toBeNull()
  })
})

// Full-branch review fix B1: family-prefix ('looser') matcher, following Vue2 KVMFullPage.vue:1392-1403.
// Key difference with matchTemplateByFilename above—this uses 'real device naming without complete
// template id, but contains family prefix' such cases, strict version would miss, family version can hit.
describe('matchTemplateByFamily', () => {
  it("filename without complete template id, but contains family prefix alpine → hits alpine-319", () => {
    // 'alpine-standard-3.19.1-x86_64.iso' doesn't contain substring 'alpine-319' (strict version
    // would miss), but contains family prefix 'alpine'.
    expect(matchTemplateByFamily('alpine-standard-3.19.1-x86_64.iso', TEMPLATES)?.id).toBe('alpine-319')
  })
  it("filename without complete template id, but contains family prefix ubuntu → hits ubuntu-2404", () => {
    expect(matchTemplateByFamily('ubuntu-server-24.04.iso', TEMPLATES)?.id).toBe('ubuntu-2404')
  })
  it('family prefix debian → hits debian-13', () => {
    expect(matchTemplateByFamily('debian-13-netinst.iso', TEMPLATES)?.id).toBe('debian-13')
  })
  it('win* series requires filename to contain both "win" and version number digit → Win11_24H2.iso hits win11, doesn\'t misconfig to win10', () => {
    expect(matchTemplateByFamily('Win11_24H2.iso', TEMPLATES)?.id).toBe('win11')
  })
  it('returns null if not recognized', () => {
    expect(matchTemplateByFamily('haiku-r1.iso', TEMPLATES)).toBeNull()
  })
})

describe('osTemplateDefaults', () => {
  it('generic-linux → bios/linux/Linux (following Vue2 :722-725)', () => {
    expect(osTemplateDefaults('generic-linux', TEMPLATES))
      .toMatchObject({ osType: 'linux', firmware: 'bios', os: 'Linux' })
  })
  it('generic-windows → uefi/windows/Windows (following Vue2 :726-729)', () => {
    expect(osTemplateDefaults('generic-windows', TEMPLATES))
      .toMatchObject({ osType: 'windows', firmware: 'uefi', os: 'Windows' })
  })
  it('real templates: if id or name contains win, determine windows + uefi, and bring out recommended specs (following Vue2 :731-743)', () => {
    expect(osTemplateDefaults('win10', TEMPLATES)).toMatchObject({
      osType: 'windows', firmware: 'uefi', os: 'Windows 10', vcpu: 2, memory: 4096, minDisk: 60,
    })
    expect(osTemplateDefaults('ubuntu-2404', TEMPLATES)).toMatchObject({
      osType: 'linux', firmware: 'bios', os: 'Ubuntu', vcpu: 2, memory: 4096, minDisk: 10,
    })
  })
  it('unknown id falls back to generic-linux', () => {
    expect(osTemplateDefaults('nope', TEMPLATES)).toMatchObject({ osType: 'linux', firmware: 'bios', os: 'Linux' })
  })
})
