import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { scanDist } from './forbidden.mjs'

// T15:dist 扫描判据与源码树扫描(scanText/scanTree)不同——只用 HARD(全部)+
// SOFT 里 word 含中文字符的条目,排除纯 ASCII 的 SOFT 词(理由见 forbidden.mjs
// scanDist 上方的长注释)。这里用真实压缩产物会出现的"形状"（整个模块挤成一行、
// 第三方库子串、内嵌白名单文本与真实泄漏同处一行）来验证判据不会走样。

let tmp
const write = (rel, content) => {
  const abs = path.join(tmp, rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content)
}

beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-scan-')) })
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }))

describe('scanDist:硬禁词照常抓', () => {
  it('压缩成一行也能抓到硬禁词', () => {
    write('assets/index-abc123.js', 'var x=1;const q="qdrant";function f(){return x}')
    const findings = scanDist(tmp)
    expect(findings.some((f) => f.word === 'qdrant')).toBe(true)
  })
})

describe('scanDist:中文软禁词照常抓', () => {
  it('中文软禁词命中(转录)', () => {
    write('assets/index-abc123.js', 'const _leakProbe="真实转录内容测试";')
    const findings = scanDist(tmp)
    expect(findings.some((f) => f.word === '转录')).toBe(true)
  })
})

describe('scanDist:ASCII 软禁词被排除', () => {
  it('第三方库/压缩别名里的 photo/gallery/search/ai/parser/wiki 不再命中', () => {
    // 模拟 T15 实测过的四类真实噪音形态
    write('assets/pdf.worker.min.mjs', 'class Parser{constructor(){this.p=1}}new Parser()')
    write('assets/xlsx.min.js', 'var GALLERY={AREA:1,"3D":{BAR:2}};var t="image/vnd.ms-photo"')
    write('assets/index-def456.js', 'import{foo as ai,bar as search}from"./chunk.js"')
    write('assets/index-def456.js.map', 'wiki-format-tag-noop')
    const findings = scanDist(tmp)
    const leaks = findings.filter((f) => f.word !== '__skipped__')
    expect(leaks).toEqual([])
  })

  it('单独的哨兵词 speaker/folderPermission(纯 ASCII)不再命中', () => {
    write('assets/index-xyz.js', 'function speakerColor(){}\nconst folderPermission=1')
    const findings = scanDist(tmp)
    expect(findings.filter((f) => f.word !== '__skipped__')).toEqual([])
  })
})

describe('scanDist:内容白名单只挖空匹配到的子串,不放过同一行其余内容', () => {
  it('合法的照片库文案单独出现时不报', () => {
    write('assets/index-abc.js', 'const o={raidLevel1Usecase:"照片库、个人 NAS、启动卷"};')
    const findings = scanDist(tmp)
    expect(findings.filter((f) => f.word !== '__skipped__')).toEqual([])
  })

  it('合法的搜索框占位符文案单独出现时不报', () => {
    write('assets/index-abc.js', 'const o={appsStoreSearch:"搜索应用…"};')
    const findings = scanDist(tmp)
    expect(findings.filter((f) => f.word !== '__skipped__')).toEqual([])
  })

  it('legit wallpaper theme menu entry (themePhoto, SP11) passes, but a bare 照片 still trips', () => {
    write('assets/index-abc.js', 'const o={themePhoto:"照片…"};')
    expect(scanDist(tmp).filter((f) => f.word !== '__skipped__')).toEqual([])
    // The allowlist entry is key-qualified: the same copy under another key must not pass.
    write('assets/index-abc.js', 'const o={somethingElse:"照片…"};')
    expect(scanDist(tmp).some((f) => f.word === '照片')).toBe(true)
  })

  it('legit Google Drive guide sentence ("搜索 <b>Google Drive API</b>") passes', () => {
    write('guide/google-drive.html', '<p>左侧菜单 <span class="path">API 和服务 → 库</span>,搜索 <b>Google Drive API</b>,点进去 → <b>启用</b>。</p>')
    const findings = scanDist(tmp)
    expect(findings.filter((f) => f.word !== '__skipped__')).toEqual([])
  })

  it('★ 关键用例:白名单文本与真实泄漏挤在同一压缩行时,真实泄漏仍必须被抓到', () => {
    // 模拟"整个模块挤成一行"的压缩产物:同一行里既有合法的照片库说明,又有一段
    // 真实的相册/转录相关泄漏文案。如果白名单是"整行豁免"而不是"挖空子串"，
    // 这条真实泄漏会被连带放过——这正是本项目最忌讳的"漏报"。
    write(
      'assets/index-onebigline.js',
      'const o={raidLevel1Usecase:"照片库、个人 NAS、启动卷",leakProbe:"这里混进了一句真实转录泄漏"};',
    )
    const findings = scanDist(tmp)
    const leaks = findings.filter((f) => f.word !== '__skipped__')
    expect(leaks.some((f) => f.word === '转录')).toBe(true)
  })
})

describe('scanDist:品牌/私有路径 grep(T15-b)', () => {
  it('私有服务名字面量命中,标记为 brand-leak', () => {
    write('assets/index-abc.js', 'fetch("http://x/nimoos-search/v1/ping")')
    const findings = scanDist(tmp)
    expect(findings.some((f) => f.word === 'brand-leak')).toBe(true)
  })

  it('被剥离服务的网关路由前缀命中', () => {
    for (const p of ['/v1/ai/', '/v1/search/', '/v1/photos/', '/v1/parser/']) {
      write('assets/routes.js', `const ROUTE="${p}chat"`)
      const findings = scanDist(tmp)
      expect(findings.some((f) => f.word === 'brand-leak'), p).toBe(true)
      fs.rmSync(path.join(tmp, 'assets/routes.js'))
    }
  })

  it('合法内嵌的 @nimotech/nimoos-service 共享包不被误伤', () => {
    write('assets/index-abc.js', 'console.log("@nimotech/nimoos-service: initService() not called")')
    const findings = scanDist(tmp)
    expect(findings.filter((f) => f.word !== '__skipped__')).toEqual([])
  })
})

describe('scanDist:体积上限单独放宽(真实 vendor chunk 常超 2MB)', () => {
  it('超过源码树的 2MB 上限、但在 dist 的 64MB 上限内的大文件正常扫描,不被跳过', () => {
    const filler = 'x'.repeat(3 * 1024 * 1024) // 3MB,超过源码树 MAX_BYTES(2MB)
    write('assets/index-big.js', `${filler}\nconst q="qdrant";`)
    const findings = scanDist(tmp)
    expect(findings.some((f) => f.word === '__skipped__')).toBe(false)
    expect(findings.some((f) => f.word === 'qdrant')).toBe(true)
  })
})

describe('scanDist:二进制/符号链接仍然留痕跳过,不静默', () => {
  it('二进制文件被跳过并记录', () => {
    write('assets/icon.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00]))
    const findings = scanDist(tmp)
    expect(findings.some((f) => f.word === '__skipped__')).toBe(true)
  })
})
