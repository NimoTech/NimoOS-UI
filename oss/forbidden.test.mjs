import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { scanText, scanTree } from './forbidden.mjs'

describe('硬禁词', () => {
  it('相册 / Nimo AI / transcript / qdrant / 内网 IP 一律命中,不给白名单', () => {
    for (const [file, text] of [
      ['src/x.ts', '// 打开相册'],
      ['src/x.ts', "t('Nimo AI')"],
      ['src/x.ts', 'import { lookupTranscript } from "./audioTranscripts"'],
      ['src/x.ts', 'const q = "qdrant"'],
      ['src/x.vue', 'http://192.168.1.115/v1'],
      ['src/x.ts', 'immich-ml'],
    ]) {
      expect(scanText(file, text).length, `${file} :: ${text}`).toBeGreaterThan(0)
    }
  })
})

describe('软禁词的精确白名单', () => {
  it('保留面不许误报', () => {
    const keep = [
      ['src/files/util/fileCategories.ts', "export const APPLICATION_PHOTOSHOP = ['psd','psb']"],
      ['src/files/util/icons.ts', "Gallery: 'folder-pictures',"],
      ['src/files/util/protect.ts', "'/DATA/Gallery',"],
      ['src/settings/util/migrateBrowse.ts', "const SYS = ['Gallery']"],
      ['src/apps/views/StorePage.vue', "route.query.search as string"],
      ['src/apps/views/StorePage.vue', 'const searchInput = ref("")'],
      // E5:局部变量 ai = anchorIndex,会被 \bai\b 硬词误伤
      ['src/files/stores/files.ts', 'const ai = list.findIndex((e) => e.path === anchor)'],
      // E6:Vue2 逐字移植的路径归一 + 系统目录显示串
      ['src/apps/util/importNormalize.ts', "{ keywords: ['pictures', 'photo'], value: '/DATA/Gallery' },"],
      ['src/settings/panels/AppsPanel.vue', 'return `${virtual}/Documents & Downloads & Gallery & Media`'],
      // E4:成员文件夹授权的类型名,必须保留
      ['src/settings/panels/account/MemberFoldersView.vue', 'type UserFolderPermission } from "@nimotech/nimoos-service"'],
      ['packages/service/src/types.ts', 'export interface UserFolderPermission {'],
      // 保留的波形 token
      ['src/files/viewers/MediaViewer.vue', "return 'var(--wave-none)'"],
    ]
    for (const [file, text] of keep) {
      expect(scanText(file, text), `${file} :: ${text}`).toEqual([])
    }
  })

  it('白名单是按文件限定的 —— 同一串出现在别的文件里仍然报', () => {
    expect(scanText('src/home/components/Foo.vue', 'const searchInput = ref("")').length).toBeGreaterThan(0)
  })

  it('speaker 是哨兵:拆完应零命中', () => {
    expect(scanText('src/files/viewers/MediaViewer.vue', 'function speakerColor(id) {}').length).toBeGreaterThan(0)
  })

  it('词边界:parse / chain / main / 中文不被误伤', () => {
    for (const [file, text] of [
      ['src/x.ts', 'JSON.parse(raw)'],
      ['src/x.ts', 'const chain = []'],
      ['src/x.ts', 'export function main() {}'],
      ['src/x.ts', '// 布局重排'],
    ]) {
      expect(scanText(file, text), text).toEqual([])
    }
  })

  // 评审 Important #1 复现用例:原正则没有大小写标志,独立大写 AI(类名/注释/裸词)
  // 完全漏检。修复后必须命中;同时确认 chain/main/Chairman 这类仍然不受影响。
  it('独立大写 AI 必须命中(类名前缀、裸词、注释三种形态),chain/main/Chairman 依然不命中', () => {
    for (const text of [
      'class AIService {}',
      '// 我们集成了 AI 总结功能',
      'const AI = 1',
      '// AI-powered',
    ]) {
      expect(scanText('src/x.ts', text).length, text).toBeGreaterThan(0)
    }
    for (const text of ['const chain = []', 'export function main() {}', 'class Chairman {}']) {
      expect(scanText('src/x.ts', text), text).toEqual([])
    }
  })
})

describe('scanTree:排除法,不是扩展名白名单', () => {
  const mktmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'oss-forbidden-'))

  // 评审 Important #2 复现用例:原实现按 TEXT_EXT 扩展名白名单跳过文件,
  // .env / Dockerfile 这类没有被枚举到扩展名的文件会被整体放过、连读都不读。
  it('.env / 无扩展名文件必须被扫描到 —— 不能按扩展名放过', () => {
    const dir = mktmp()
    try {
      fs.writeFileSync(path.join(dir, '.env'), 'AI_ENDPOINT=http://192.168.1.115\n')
      fs.writeFileSync(path.join(dir, 'Dockerfile'), 'ENV NIMO_QDRANT_URL=qdrant://x\n')
      const findings = scanTree(dir)
      expect(findings.some((f) => f.file === '.env' && f.word === '192.168.1.115')).toBe(true)
      expect(findings.some((f) => f.file === 'Dockerfile' && f.word === 'qdrant')).toBe(true)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('二进制文件不产生内容误报,但会留下 __skipped__ 痕迹,不是静默跳过', () => {
    const dir = mktmp()
    try {
      // 假 PNG:开头几个字节含 NUL,足以触发 looksBinary
      fs.writeFileSync(path.join(dir, 'icon.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d, 0x0a, 0x1a]))
      const findings = scanTree(dir)
      expect(findings.some((f) => f.file === 'icon.png' && f.word === '__skipped__')).toBe(true)
      expect(findings.some((f) => f.file === 'icon.png' && f.word !== '__skipped__')).toBe(false)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('node_modules 与 .git 目录下的文件不被扫描', () => {
    const dir = mktmp()
    try {
      fs.mkdirSync(path.join(dir, 'node_modules'))
      fs.writeFileSync(path.join(dir, 'node_modules', 'x.js'), 'qdrant')
      fs.mkdirSync(path.join(dir, '.git'))
      fs.writeFileSync(path.join(dir, '.git', 'CONFIG'), 'qdrant')
      fs.writeFileSync(path.join(dir, 'clean.ts'), 'export const x = 1\n')
      const findings = scanTree(dir)
      expect(findings).toEqual([])
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
