import { describe, it, expect } from 'vitest'
import { formatRam, formatHostMem, osIconFor } from './format'
// Import icons directly for identity comparison. The brief's original draft used `.toContain('windows')`
// to assert string substring, but this repo's Vite defaults to inlining resources under 4KB as data URIs
// (raw SVG XML, url-encoded, without filenames), `vitest` goes through the same transformation pipeline—
// assertions are always false in this project environment, regardless of implementation correctness
// (the other 6 cases that don't rely on filename substrings are already all green). Changed to identity
// comparison of directly imported icon modules, verification strength not only maintained but enhanced
// (proves the selected is exactly that one icon, not just 'some word in the string').
import windowsIcon from '../assets/windows.svg'
import ubuntuIcon from '../assets/ubuntu.svg'
import debianIcon from '../assets/debian.svg'
import centosIcon from '../assets/centos.svg'
import alpineIcon from '../assets/alpine.svg'
import archIcon from '../assets/arch.svg'
import freebsdIcon from '../assets/freebsd.svg'

describe('formatRam (exactly matching Vue2 KVMFullPage.vue:1644-1647)', () => {
  it('>= 1024 MB convert to GB, one decimal place', () => {
    expect(formatRam(1024)).toBe('1.0 GB')
    expect(formatRam(2048)).toBe('2.0 GB')
    expect(formatRam(1536)).toBe('1.5 GB')
    expect(formatRam(10254)).toBe('10.0 GB')
  })
  it('< 1024 MB keep as MB', () => {
    expect(formatRam(512)).toBe('512 MB')
    expect(formatRam(1023)).toBe('1023 MB')
  })
  it('0 / NaN / undefined all return "0 MB" (Vue2\'s !mb branch)', () => {
    expect(formatRam(0)).toBe('0 MB')
    expect(formatRam(NaN)).toBe('0 MB')
    expect(formatRam(undefined as unknown as number)).toBe('0 MB')
  })
})

describe('formatHostMem and formatRam have consistent behavior (Vue2 has two methods with the same implementation)', () => {
  it('same input, same output', () => {
    for (const v of [0, 512, 1024, 10254]) expect(formatHostMem(v)).toBe(formatRam(v))
  })
})

describe('osIconFor (exactly matching Vue2 KVMFullPage.vue:1632-1642\'s matching order)', () => {
  it('hit each distribution by substring', () => {
    expect(osIconFor('Windows 11')).toBe(windowsIcon)
    expect(osIconFor('ubuntu-2404')).toBe(ubuntuIcon)
    expect(osIconFor('Debian 13')).toBe(debianIcon)
    expect(osIconFor('CentOS Stream 9')).toBe(centosIcon)
    expect(osIconFor('alpine-319')).toBe(alpineIcon)
    expect(osIconFor('Arch Linux')).toBe(archIcon)
    expect(osIconFor('FreeBSD 14')).toBe(freebsdIcon)
  })
  it('case-insensitive', () => {
    expect(osIconFor('UBUNTU')).toBe(osIconFor('ubuntu'))
  })
  it('unrecognized ones all fall back to linux icon; empty/undefined same', () => {
    const fallback = osIconFor('linux')
    expect(osIconFor('gentoo')).toBe(fallback)
    expect(osIconFor('')).toBe(fallback)
    expect(osIconFor(undefined as unknown as string)).toBe(fallback)
  })
  it('win takes priority over others: when name contains both win and arch, use windows', () => {
    // Vue2's if chain order: win is first
    expect(osIconFor('win-arch')).toBe(windowsIcon)
  })
})
