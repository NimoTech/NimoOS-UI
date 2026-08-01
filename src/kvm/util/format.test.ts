import { describe, it, expect } from 'vitest'
import { formatRam, formatHostMem, osIconFor } from './format'
// 直接导入图标做恒等比较。brief 原稿用 `.toContain('windows')` 断言字符串子串,
// 但本仓库 Vite 默认对 4KB 以下资源内联为 data URI(原始 SVG XML,url-encode,
// 不含文件名),`vitest` 走同一条转换管线 —— 断言在本项目环境下恒假,与实现
// 对错无关(其余 6 条不依赖文件名子串的用例本就全绿)。改为对直接导入的图标模块
// 做恒等比较,验证强度不降反升(证明选中的正是那一个图标,而不只是"字符串里有某词")。
import windowsIcon from '../assets/windows.svg'
import ubuntuIcon from '../assets/ubuntu.svg'
import debianIcon from '../assets/debian.svg'
import centosIcon from '../assets/centos.svg'
import alpineIcon from '../assets/alpine.svg'
import archIcon from '../assets/arch.svg'
import freebsdIcon from '../assets/freebsd.svg'

describe('formatRam(逐字对 Vue2 KVMFullPage.vue:1644-1647)', () => {
  it('>= 1024 MB 换算成 GB,一位小数', () => {
    expect(formatRam(1024)).toBe('1.0 GB')
    expect(formatRam(2048)).toBe('2.0 GB')
    expect(formatRam(1536)).toBe('1.5 GB')
    expect(formatRam(10254)).toBe('10.0 GB')
  })
  it('< 1024 MB 保持 MB', () => {
    expect(formatRam(512)).toBe('512 MB')
    expect(formatRam(1023)).toBe('1023 MB')
  })
  it('0 / NaN / undefined 一律 "0 MB"(Vue2 的 !mb 分支)', () => {
    expect(formatRam(0)).toBe('0 MB')
    expect(formatRam(NaN)).toBe('0 MB')
    expect(formatRam(undefined as unknown as number)).toBe('0 MB')
  })
})

describe('formatHostMem 与 formatRam 行为一致(Vue2 里是两个同实现的方法)', () => {
  it('同输入同输出', () => {
    for (const v of [0, 512, 1024, 10254]) expect(formatHostMem(v)).toBe(formatRam(v))
  })
})

describe('osIconFor(逐字对 Vue2 KVMFullPage.vue:1632-1642 的匹配顺序)', () => {
  it('按子串命中各发行版', () => {
    expect(osIconFor('Windows 11')).toBe(windowsIcon)
    expect(osIconFor('ubuntu-2404')).toBe(ubuntuIcon)
    expect(osIconFor('Debian 13')).toBe(debianIcon)
    expect(osIconFor('CentOS Stream 9')).toBe(centosIcon)
    expect(osIconFor('alpine-319')).toBe(alpineIcon)
    expect(osIconFor('Arch Linux')).toBe(archIcon)
    expect(osIconFor('FreeBSD 14')).toBe(freebsdIcon)
  })
  it('大小写不敏感', () => {
    expect(osIconFor('UBUNTU')).toBe(osIconFor('ubuntu'))
  })
  it('认不出来的一律回退 linux 图标;空/undefined 同样', () => {
    const fallback = osIconFor('linux')
    expect(osIconFor('gentoo')).toBe(fallback)
    expect(osIconFor('')).toBe(fallback)
    expect(osIconFor(undefined as unknown as string)).toBe(fallback)
  })
  it('win 优先于其它:名字里同时含 win 和 arch 时取 windows', () => {
    // Vue2 的 if 链顺序:win 在最前
    expect(osIconFor('win-arch')).toBe(windowsIcon)
  })
})
