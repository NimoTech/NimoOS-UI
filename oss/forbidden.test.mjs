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

// ─── T6.5:中文痕迹 ──────────────────────────────────────────────────────────
// 背景:本库注释与界面文案全中文,原词表只有「相册」一个中文词。以下样本全部
// 逐字摘自本仓真实文件(私有侧原文,未做任何简化改写)——本项目手编 fixture
// 栽过三次,这里不重蹈。
describe('中文痕迹必须命中(T6.5 新增)', () => {
  it('T6 评审抓到的静默泄漏:HomeTopbar.vue 那句"保留搜索与主题切换"(私有侧原文,' +
     '导出树里这句已被 Task 6 的 PATCH 改掉,但守卫必须能在改之前拦住它)', () => {
    // 逐字摘自 src/home/components/HomeTopbar.vue:57(git show HEAD 原文)
    const text = '/* ≤720px 手机启动器为只读:隐藏添加/编辑入口(排序增删在桌面做),保留搜索与主题切换 */'
    expect(scanText('src/home/components/HomeTopbar.vue', text).length, text).toBeGreaterThan(0)
  })

  it('转录 / 说话人 / 知识库 / 向量化 / 问 Nimo 一律命中', () => {
    for (const [file, text] of [
      // 逐字摘自 src/i18n/zh_cn.ts:37-41
      ['src/i18n/zh_cn.ts', "  audioTranscript: '转录文稿',"],
      ['src/i18n/zh_cn.ts', "  audioAsk: '问 Nimo',"],
      ['src/i18n/zh_cn.ts', "  audioAskEmpty: '这段音频的转录已向量化 — 关于内容尽管问 Nimo。',"],
      ['src/i18n/zh_cn.ts', "  audioAskDemo: '(demo 占位) 转录已向量化。接入 AI 后端后，这里会根据音频内容作答，并附上可跳转的时间戳。',"],
      // 逐字摘自 src/i18n/zh_cn.sp9.ts:252-253
      ["src/i18n/zh_cn.sp9.ts", "  settingsFpKnowledge: '知识库',"],
      ["src/i18n/zh_cn.sp9.ts", "  settingsFpKnowledgeDesc: '纳入知识库(RAG)索引的文件夹。',"],
      // 逐字摘自 src/files/viewers/MediaViewer.vue:282(说话人分离注释)
      ['src/files/viewers/MediaViewer.vue', '// 说话人分离：id → 显示名 / 颜色 token(--spk-N,5 色循环;波形与转录共用同一映射)。'],
    ]) {
      expect(scanText(file, text).length, `${file} :: ${text}`).toBeGreaterThan(0)
    }
  })

  it('智能 命中(候选软禁词,当前全仓无白名单)', () => {
    // 逐字摘自 src/i18n/zh_cn.ts:235
    expect(scanText('src/i18n/zh_cn.ts', "  widgetAiDesc: '对话与智能建议',").length).toBeGreaterThan(0)
  })
})

describe('合法中文用法零误报(T6.5 新增)', () => {
  it('appsStoreSearch / raidLevel1Usecase / CSS 语义 token 注释都不命中', () => {
    const keep = [
      // brief 指定的保留面,逐字摘自 src/i18n/zh_cn.ts:392、:700
      ['src/i18n/zh_cn.ts', "  appsStoreSearch: '搜索应用…',"],
      ['src/i18n/zh_cn.ts', "  raidLevel1Usecase: '照片库、个人 NAS、启动卷',"],
      // 「语义」不收单字词:CSS 设计系统里的"语义"用语与 AI 语义搜索无关。
      // 逐字摘自 src/styles/theme.css:79/298(P6 终端语义色,与 AI 无关)。
      ['src/styles/theme.css', '  /* P6 终端/日志控制台(终端语义固定深色,不随主题翻转;两套主题块同值,与 Vue2 旧实现一致) */'],
    ]
    for (const [file, text] of keep) {
      expect(scanText(file, text), `${file} :: ${text}`).toEqual([])
    }
  })

  it('转录 的白名单是精确到内容的:RAID 文案来源说明不命中,同文件里真正的音频转录键仍命中', () => {
    // 逐字摘自 src/i18n/zh_cn.ts:663/678/682
    const raidDocs = [
      '  // 逐字转录自 NimoOS-UI RaidDetailPanel.vue L267-290(levelFaultTolerance/levelReadSpeed/levelWriteSpeed,按 level 0/1/5/6)',
      '  // read/write 为该表原始 1-5 评分(5、4),转录为评分文本。',
      "  // desc:raidUtils.js 源文件中 desc 字段本身即占位字符串(如 'RAID 0 Description'),逐字转录(非我方发明)",
    ]
    for (const text of raidDocs) {
      expect(scanText('src/i18n/zh_cn.ts', text), text).toEqual([])
    }
    // 白名单按内容精确匹配,不是给整个文件开洞:同一文件里真正的音频转录键必须继续命中。
    expect(scanText('src/i18n/zh_cn.ts', "  audioTranscript: '转录文稿',").length).toBeGreaterThan(0)
  })

  it('照片 的白名单:ImageViewer(通用图片查看器)与 --media-overlay-shadow 注释不命中', () => {
    // 逐字摘自 src/files/viewers/ImageViewer.vue:207-209
    const text = '     瓦片接缝会在照片上显出白色网格细线(真机截图实证过);去掉后缩放会触发重绘,无缝。 */'
    expect(scanText('src/files/viewers/ImageViewer.vue', text)).toEqual([])
    // 换个文件就不再豁免(按文件限定,不是按文本全局豁免)
    expect(scanText('src/home/components/PhotoTile.vue', text).length).toBeGreaterThan(0)
  })

  it('搜索 的白名单:StorePage(应用商店过滤)与 Files.vue(重命名/搜索输入焦点)不命中', () => {
    // 逐字摘自 src/apps/views/StorePage.vue:59
    expect(scanText('src/apps/views/StorePage.vue', '// 搜索输入:250ms 防抖(Vue2 同款)后写 query;外部 query 变化(后退)回灌输入框')).toEqual([])
    // 逐字摘自 src/views/Files.vue:208
    expect(scanText('src/views/Files.vue', '// 焦点在输入框(重命名/搜索等)时不抢浏览器默认粘贴;剪贴板只有文字时静默忽略。')).toEqual([])
    // 白名单按文件限定:同一串文本出现在别的文件里仍然报
    expect(scanText('src/home/components/SearchDialog.vue', '// 搜索输入:250ms 防抖(Vue2 同款)后写 query;外部 query 变化(后退)回灌输入框').length).toBeGreaterThan(0)
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
