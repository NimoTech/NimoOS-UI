import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { scanDist } from './forbidden.mjs'

// T15: dist scan criteria differs from source scan (scanText/scanTree) — uses only HARD (all) +
// SOFT entries with Chinese chars in word, excludes pure-ASCII SOFT words (reason in long comment
// above scanDist in forbidden.mjs). Here uses real compressed-artifact "shapes" (whole module on one line,
// third-party lib substrings, whitelist text and real leak on same line) to verify criteria doesn't walk away.

let tmp
const write = (rel, content) => {
  const abs = path.join(tmp, rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content)
}

beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-scan-')) })
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }))

describe('scanDist: hard forbiddings still caught', () => {
  it('compressed to one line still catches hard forbidding', () => {
    write('assets/index-abc123.js', 'var x=1;const q="qdrant";function f(){return x}')
    const findings = scanDist(tmp)
    expect(findings.some((f) => f.word === 'qdrant')).toBe(true)
  })
})

describe('scanDist: Chinese soft forbiddings still caught', () => {
  it('Chinese soft forbidding hit (transcript)', () => {
    write('assets/index-abc123.js', 'const _leakProbe="真实转录内容测试";')
    const findings = scanDist(tmp)
    expect(findings.some((f) => f.word === '转录')).toBe(true)
  })
})

describe('scanDist: ASCII soft forbiddings excluded', () => {
  it('photo/gallery/search/ai/parser/wiki in third-party lib / minified names no longer hit', () => {
    // Simulate four real noise shapes T15 tested
    write('assets/pdf.worker.min.mjs', 'class Parser{constructor(){this.p=1}}new Parser()')
    write('assets/xlsx.min.js', 'var GALLERY={AREA:1,"3D":{BAR:2}};var t="image/vnd.ms-photo"')
    write('assets/index-def456.js', 'import{foo as ai,bar as search}from"./chunk.js"')
    write('assets/index-def456.js.map', 'wiki-format-tag-noop')
    const findings = scanDist(tmp)
    const leaks = findings.filter((f) => f.word !== '__skipped__')
    expect(leaks).toEqual([])
  })

  it('standalone sentinel words speaker/folderPermission (pure ASCII) no longer hit', () => {
    write('assets/index-xyz.js', 'function speakerColor(){}\nconst folderPermission=1')
    const findings = scanDist(tmp)
    expect(findings.filter((f) => f.word !== '__skipped__')).toEqual([])
  })
})

describe('scanDist: content whitelist only hollows matched substring, doesn\'t pass other content on same line', () => {
  it('legitimate photos library text alone doesn\'t report', () => {
    write('assets/index-abc.js', 'const o={raidLevel1Usecase:"照片库、个人 NAS、启动卷"};')
    const findings = scanDist(tmp)
    expect(findings.filter((f) => f.word !== '__skipped__')).toEqual([])
  })

  it('legitimate search box placeholder text alone doesn\'t report', () => {
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

  it('legit wallpaper theme menu entry (themePhoto, SP11) passes, but a bare photo still trips', () => {
    write('assets/index-abc.js', 'const o={themePhoto:"照片…"};')
    expect(scanDist(tmp).filter((f) => f.word !== '__skipped__')).toEqual([])
    // The allowlist entry is key-qualified: the same copy under another key must not pass.
    write('assets/index-abc.js', 'const o={somethingElse:"照片…"};')
    expect(scanDist(tmp).some((f) => f.word === '照片')).toBe(true)
  })

  it('legit Google Drive guide sentence passes', () => {
    write('guide/google-drive.html', '<p>Left menu <span class="path">APIs & Services → Library</span>, search <b>Google Drive API</b>, enter → <b>Enable</b>.</p>')
    const findings = scanDist(tmp)
    expect(findings.filter((f) => f.word !== '__skipped__')).toEqual([])
  })

  it('★ Key case: when whitelist text and real leak squeezed on same compressed line, real leak must still be caught', () => {
    // Simulate "whole module on one line" compressed product: same line has both legitimate photos library text
    // and a real photos/transcript leak passage. If whitelist is "whole-line exemption" not "hollow substring",
    // this real leak would pass too — exactly the "false negative" this project abhors.
    write(
      'assets/index-onebigline.js',
      'const o={raidLevel1Usecase:"照片库、个人 NAS、启动卷",leakProbe:"这里混进了一句真实转录泄漏"};',
    )
    const findings = scanDist(tmp)
    const leaks = findings.filter((f) => f.word !== '__skipped__')
    expect(leaks.some((f) => f.word === '转录')).toBe(true)
  })
})

describe('scanDist: brand/private-path grep (T15-b)', () => {
  it('private service name literal hit, marked as brand-leak', () => {
    write('assets/index-abc.js', 'fetch("http://x/nimoos-search/v1/ping")')
    const findings = scanDist(tmp)
    expect(findings.some((f) => f.word === 'brand-leak')).toBe(true)
  })

  it('removed service gateway route prefix hit', () => {
    for (const p of ['/v1/ai/', '/v1/search/', '/v1/photos/', '/v1/parser/']) {
      write('assets/routes.js', `const ROUTE="${p}chat"`)
      const findings = scanDist(tmp)
      expect(findings.some((f) => f.word === 'brand-leak'), p).toBe(true)
      fs.rmSync(path.join(tmp, 'assets/routes.js'))
    }
  })

  it('legitimate inline @nimotech/nimoos-service shared package not harmed', () => {
    write('assets/index-abc.js', 'console.log("@nimotech/nimoos-service: initService() not called")')
    const findings = scanDist(tmp)
    expect(findings.filter((f) => f.word !== '__skipped__')).toEqual([])
  })
})

describe('scanDist: size limit relaxed only for dist (real vendor chunk often exceeds 2MB)', () => {
  it('exceeds source-tree 2MB limit but within dist 64MB limit; large file scans normally, not skipped', () => {
    const filler = 'x'.repeat(3 * 1024 * 1024) // 3MB, exceeds source-tree MAX_BYTES (2MB)
    write('assets/index-big.js', `${filler}\nconst q="qdrant";`)
    const findings = scanDist(tmp)
    expect(findings.some((f) => f.word === '__skipped__')).toBe(false)
    expect(findings.some((f) => f.word === 'qdrant')).toBe(true)
  })
})

describe('scanDist: binary/symlink still leaves skip trace, not silent', () => {
  it('binary file skipped and logged', () => {
    write('assets/icon.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00]))
    const findings = scanDist(tmp)
    expect(findings.some((f) => f.word === '__skipped__')).toBe(true)
  })
})
