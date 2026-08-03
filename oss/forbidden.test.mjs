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

  // 第二轮复审 Important:第一轮的 ai 正则只认"AI 打头"的驼峰(AIService),漏掉
  // "AI 结尾"的驼峰。sendToAI 是本仓真实存在的函数名(useOpenAction.ts:54 等 8 处),
  // 正是这次要清除的 AI 链路核心入口,必须命中。同时 Asia/Shanghai、Asia/Dubai(本仓
  // timezones.ts 里真实存在的时区字符串)、Thai、bonsai 这类合法词必须继续不命中。
  it('驼峰词尾的 AI(sendToAI/chatAI)必须命中,真实时区/地名字符串不能被误伤', () => {
    for (const text of [
      'function sendToAI(text?: string) {',
      'const { sendToAI } = useOpenAction()',
      'const chatAI = 1',
      'const openAIRequest = 1',
    ]) {
      expect(scanText('src/x.ts', text).length, text).toBeGreaterThan(0)
    }
    for (const text of [
      "{ label: '(GMT+08:00) Beijing, Chongqing, Hong Kong, Urumqi', value: 'Asia/Shanghai' },",
      "{ label: '(GMT+04:00) Abu Dhabi, Muscat', value: 'Asia/Dubai' },",
      'const country = "Thai"',
      'const plant = "bonsai"',
    ]) {
      expect(scanText('src/settings/util/timezones.ts', text), text).toEqual([])
    }
  })

  // 第三轮复审 Important:brief §6.3 纪律 3 明文要求"孤儿 i18n 键不需要另写检查——
  // 键名本身就是禁词",这套设计显式依赖守卫能按键名抓到 Ai 这种首字母大写、第二个字母
  // 小写的驼峰(不是全大写 AI)。原规则的 alt2 只认全大写 AI,漏掉了本仓真实存在的
  // widgetAiSend / pathFromAiPattern / askNimoAi 等 i18n 键与函数名。以下全部用真实文件
  // 里的原样文本(逐字摘自 src/i18n/zh_cn.ts:258-259、en_us.ts:259-260、
  // FolderPermissionsPanel.vue:146、folderPermissions.test.ts:29-30、SearchDialog.vue:265),
  // 不是自己编的简化版。
  it('驼峰词尾的 Ai(首字母大写、第二字母小写)必须命中,真实机场/航空类词不能被误伤', () => {
    for (const text of [
      "  widgetAiSend: '发送',",
      "  widgetAiPrompt1: '整理最近的照片',",
      "  widgetAiSend: 'Send',",
      "        <span class=\"set-fp-title\">{{ t('settingsFpAiHidden') }}</span>",
      "  it('pathFromAiPattern 反解出目录', () => {",
      "    expect(pathFromAiPattern('/DATA/Docs/**')).toBe('/DATA/Docs')",
      'function askNimoAi(): void {',
    ]) {
      expect(scanText('src/x.ts', text).length, text).toBeGreaterThan(0)
    }
    for (const text of [
      "{ label: '(GMT+08:00) Beijing, Chongqing, Hong Kong, Urumqi', value: 'Asia/Shanghai' },",
      "{ label: '(GMT+04:00) Abu Dhabi, Muscat', value: 'Asia/Dubai' },",
      'const country = "Thai"',
      'const plant = "bonsai"',
      'useAirport()',
      'const x: Aircraft = load()',
    ]) {
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

  // 第二轮复审 Important:指向目录的符号链接原本会让 scanTree 整体抛 EISDIR 崩掉
  // (本仓 .claude/worktrees/NimoOS-Service 就是这么个链接,复审拿真实仓库复现的)。
  // 修复后必须优雅跳过并留痕,而不是抛异常。
  it('指向目录的符号链接不应让 scanTree 抛异常,而是留下 __skipped__ 痕迹;真实目录仍被正常扫描', () => {
    const dir = mktmp()
    try {
      const realDir = path.join(dir, 'real-target')
      fs.mkdirSync(realDir)
      fs.writeFileSync(path.join(realDir, 'inner.ts'), 'const q = "qdrant"\n')
      const linkPath = path.join(dir, 'link-to-dir')
      fs.symlinkSync(realDir, linkPath, 'dir')

      let findings
      expect(() => {
        findings = scanTree(dir)
      }).not.toThrow()

      expect(findings.some((f) => f.file === 'link-to-dir' && f.word === '__skipped__')).toBe(true)
      // 真实目录是通过它自己的真实路径被正常遍历到的(不是通过链接),
      // 证明"跳过链接本身"没有连带漏扫链接指向的真实内容。
      const innerFile = path.join('real-target', 'inner.ts')
      expect(findings.some((f) => f.file === innerFile && f.word === 'qdrant')).toBe(true)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  // 第三轮复审顺带加固:子目录的 readdirSync 之前没包 try/catch,遇到无读权限的目录
  // (权限问题、竞态删除等)会像符号链接那次一样让整个 scanTree 崩掉。
  // 用真实的 chmod 000 目录复现——不是 mock,是真的把权限位清零。
  // root 用户不受 chmod 限制(DAC 对 root 不生效),这条测试在以 root 跑测试的环境下
  // 没有意义,跳过。
  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0
  it.skipIf(isRoot)('无读权限的子目录不应让 scanTree 抛异常,而是留下 __skipped__ 痕迹', () => {
    const dir = mktmp()
    const lockedDir = path.join(dir, 'locked')
    try {
      fs.mkdirSync(lockedDir)
      fs.writeFileSync(path.join(lockedDir, 'x.ts'), 'const q = "qdrant"\n')
      fs.writeFileSync(path.join(dir, 'clean.ts'), 'export const x = 1\n')
      fs.chmodSync(lockedDir, 0o000)

      let findings
      expect(() => {
        findings = scanTree(dir)
      }).not.toThrow()

      expect(findings.some((f) => f.file === 'locked' && f.word === '__skipped__')).toBe(true)
    } finally {
      fs.chmodSync(lockedDir, 0o755) // 恢复权限,否则 rmSync 递归删除会失败
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
