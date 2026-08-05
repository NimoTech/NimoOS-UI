import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
// 2026-08-05(SP7-P8b):两个 locale 主文件改名 *.base.ts(内容原地未动,只是多了 3 行合并
// 出口 zh_cn.ts/en_us.ts,好让开源侧能整体删掉相册文案分片)。本文件所有取样路径与
// forbidden.mjs 的白名单路径一起改名 —— **词表与白名单的内容一个字没动**。
import { describe, it, expect } from 'vitest'
import { scanText, scanTree, isExpectedSkip, SKIP_REASON_SYMLINK, SKIP_REASON_BINARY } from './forbidden.mjs'

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
      // T14 复审:旧样本是编造的简化文本,只碰巧匹配旧的"文件+子串"松口径;换成
      // 逐字摘自源码的真实行,匹配新的整行精确白名单(收紧口径见 forbidden.mjs 里
      // search 词条 T14 复审注释)。
      ['src/apps/views/StorePage.vue', "const search = computed(() => (typeof route.query.search === 'string' && route.query.search) || '')"],
      ['src/apps/views/StorePage.vue', 'const searchInput = ref(search.value)'],
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
    expect(scanText('src/home/components/Foo.vue', 'const searchInput = ref(search.value)').length).toBeGreaterThan(0)
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
  // 里的原样文本(逐字摘自 src/i18n/zh_cn.base.ts:258-259、en_us.ts:259-260、
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
      // 逐字摘自 src/i18n/zh_cn.base.ts:37-41
      ['src/i18n/zh_cn.base.ts', "  audioTranscript: '转录文稿',"],
      ['src/i18n/zh_cn.base.ts', "  audioAsk: '问 Nimo',"],
      ['src/i18n/zh_cn.base.ts', "  audioAskEmpty: '这段音频的转录已向量化 — 关于内容尽管问 Nimo。',"],
      ['src/i18n/zh_cn.base.ts', "  audioAskDemo: '(demo 占位) 转录已向量化。接入 AI 后端后，这里会根据音频内容作答，并附上可跳转的时间戳。',"],
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
    // 逐字摘自 src/i18n/zh_cn.base.ts:235
    expect(scanText('src/i18n/zh_cn.base.ts', "  widgetAiDesc: '对话与智能建议',").length).toBeGreaterThan(0)
  })
})

describe('合法中文用法零误报(T6.5 新增)', () => {
  it('appsStoreSearch / raidLevel1Usecase / CSS 语义 token 注释都不命中', () => {
    const keep = [
      // brief 指定的保留面,逐字摘自 src/i18n/zh_cn.base.ts:392、:700
      ['src/i18n/zh_cn.base.ts', "  appsStoreSearch: '搜索应用…',"],
      ['src/i18n/zh_cn.base.ts', "  raidLevel1Usecase: '照片库、个人 NAS、启动卷',"],
      // 「语义」不收单字词:CSS 设计系统里的"语义"用语与 AI 语义搜索无关。
      // 逐字摘自 src/styles/theme.css:79/298(P6 终端语义色,与 AI 无关)。
      ['src/styles/theme.css', '  /* P6 终端/日志控制台(终端语义固定深色,不随主题翻转;两套主题块同值,与 Vue2 旧实现一致) */'],
    ]
    for (const [file, text] of keep) {
      expect(scanText(file, text), `${file} :: ${text}`).toEqual([])
    }
  })

  it('转录 的白名单是精确到内容的:RAID 文案来源说明不命中,同文件里真正的音频转录键仍命中', () => {
    // 逐字摘自 src/i18n/zh_cn.base.ts:663/678/682
    const raidDocs = [
      '  // 逐字转录自 NimoOS-UI RaidDetailPanel.vue L267-290(levelFaultTolerance/levelReadSpeed/levelWriteSpeed,按 level 0/1/5/6)',
      '  // read/write 为该表原始 1-5 评分(5、4),转录为评分文本。',
      "  // desc:raidUtils.js 源文件中 desc 字段本身即占位字符串(如 'RAID 0 Description'),逐字转录(非我方发明)",
    ]
    for (const text of raidDocs) {
      expect(scanText('src/i18n/zh_cn.base.ts', text), text).toEqual([])
    }
    // 白名单按内容精确匹配,不是给整个文件开洞:同一文件里真正的音频转录键必须继续命中。
    expect(scanText('src/i18n/zh_cn.base.ts', "  audioTranscript: '转录文稿',").length).toBeGreaterThan(0)
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

// ─── 复审修复(2026-08-04):白名单收紧为整行精确匹配 ─────────────────────────
// Critical:最初 搜索/照片 的白名单按「文件+键名子串」(/appsStoreSearch/、
// /raidLevel1Usecase/)或「文件+单字」(StorePage.vue 整体 /搜索/)豁免,等于对
// 整行/整个文件开洞——只要在被豁免的那一行追加真实 AI 泄漏也照样放行。下面用
// 复审给出的两条构造样本(标注为"构造样本",不是摘自真实文件——它们本来就不存在,
// 存在了就是缺陷)证明:同样的合法前缀 + 追加一段可信的 AI 泄漏后,新写法必须命中。
describe('复审修复:白名单收紧为整行精确匹配,不给整行/整文件开洞(2026-08-04)', () => {
  it('raidLevel1Usecase 被追加真实泄漏后必须命中(构造样本,复现评审 Critical)', () => {
    // 构造样本:在合法值后面追加一段可信的 AI 向量检索描述,刻意避开「向量化」
    // 「语义搜索」「相册」的精确串——专门用来验证"整行精确匹配"而不是"关键词碰运气"。
    const adversarial = "  raidLevel1Usecase: '照片库、个人 NAS、启动卷(这里的照片会自动生成向量做相似检索)',"
    expect(scanText('src/i18n/zh_cn.base.ts', adversarial).length, adversarial).toBeGreaterThan(0)
    // 合法原文继续不受影响
    expect(scanText('src/i18n/zh_cn.base.ts', "  raidLevel1Usecase: '照片库、个人 NAS、启动卷',")).toEqual([])
  })

  it('StorePage.vue 注释被追加真实泄漏后必须命中(构造样本,复现评审 Critical)', () => {
    // 构造样本:整文件通配 /搜索/ 曾经会放行这整行,包括后面那句真泄漏。
    const adversarial = '// 商店页新增语音搜索:识别用户说的话,自动填充搜索框(接入 Nimo 大模型做语义排序)'
    expect(scanText('src/apps/views/StorePage.vue', adversarial).length, adversarial).toBeGreaterThan(0)
    // 合法原文(逐字摘自 StorePage.vue:59)继续不受影响
    expect(scanText('src/apps/views/StorePage.vue', '// 搜索输入:250ms 防抖(Vue2 同款)后写 query;外部 query 变化(后退)回灌输入框')).toEqual([])
  })

  it('转录/照片/搜索 全部 13 条白名单逐条自查:合法原文不误报,同一行追加泄漏后必须命中', () => {
    // 每条 [文件, 合法原文(逐字摘自源码), 追加泄漏后的构造样本]。
    const rows = [
      ['src/i18n/zh_cn.base.ts',
        '  // 逐字转录自 NimoOS-UI RaidDetailPanel.vue L267-290(levelFaultTolerance/levelReadSpeed/levelWriteSpeed,按 level 0/1/5/6)',
        '  // 逐字转录自 NimoOS-UI RaidDetailPanel.vue L267-290(levelFaultTolerance/levelReadSpeed/levelWriteSpeed,按 level 0/1/5/6)(顺带把这段转录接入向量化知识库)'],
      ['src/i18n/zh_cn.base.ts',
        '  // read/write 为该表原始 1-5 评分(5、4),转录为评分文本。',
        '  // read/write 为该表原始 1-5 评分(5、4),转录为评分文本。(顺带做语义搜索索引)'],
      ['src/i18n/zh_cn.base.ts',
        "  // desc:raidUtils.js 源文件中 desc 字段本身即占位字符串(如 'RAID 0 Description'),逐字转录(非我方发明)",
        "  // desc:raidUtils.js 源文件中 desc 字段本身即占位字符串(如 'RAID 0 Description'),逐字转录(非我方发明,后续接入知识库)"],
      ['src/i18n/zh_cn.base.ts',
        "  raidLevel1Usecase: '照片库、个人 NAS、启动卷',",
        "  raidLevel1Usecase: '照片库、个人 NAS、启动卷(这里的照片会自动生成向量做相似检索)',"],
      ['src/files/viewers/ImageViewer.vue',
        '     瓦片接缝会在照片上显出白色网格细线(真机截图实证过);去掉后缩放会触发重绘,无缝。 */',
        '     瓦片接缝会在照片上显出白色网格细线(真机截图实证过);去掉后缩放会触发重绘,无缝。这些照片会喂给知识库做向量化。 */'],
      ['src/styles/theme.css',
        '  /* 媒体(照片/视频)上方浮层的投影:内容颜色不可控,白图上纯白浮层会隐形,',
        '  /* 媒体(照片/视频)上方浮层的投影:内容颜色不可控,白图上纯白浮层会隐形,顺带给 AI 相册用,'],
      ['src/i18n/zh_cn.base.ts',
        "  appsStoreSearch: '搜索应用…',",
        "  appsStoreSearch: '搜索应用…(基于语义搜索的应用推荐)',"],
      ['src/apps/views/StorePage.vue',
        '// 搜索输入:250ms 防抖(Vue2 同款)后写 query;外部 query 变化(后退)回灌输入框',
        '// 搜索输入:250ms 防抖(Vue2 同款)后写 query;外部 query 变化(后退)回灌输入框,并送 Nimo AI 做语义排序'],
      ['src/apps/views/StorePage.vue',
        '// 分类/作者是后端参数:query 变化即重拉;搜索纯前端不重拉',
        '// 分类/作者是后端参数:query 变化即重拉;搜索纯前端不重拉(未来接知识库做语义搜索)'],
      ['src/apps/views/StorePage.vue',
        '// 推荐带只在「未过滤未搜索」的首屏语境显示——过滤/搜索时列表就是用户要的答案,带子是噪音',
        '// 推荐带只在「未过滤未搜索」的首屏语境显示——过滤/搜索时列表就是用户要的答案,带子是噪音;新增语音搜索接入 Nimo AI'],
      ['src/apps/views/StorePage.test.ts',
        "  it('搜索输入 250ms 防抖后 replace 路由 query(前端过滤,深链)', async () => {",
        "  it('搜索输入 250ms 防抖后 replace 路由 query(前端过滤,深链,语义搜索兜底)', async () => {"],
      ['src/apps/views/StorePage.test.ts',
        "  it('Featured 带只在 无搜索+全部分类+全部来源 时显示', async () => {",
        "  it('Featured 带只在 无搜索+全部分类+全部来源 时显示(含 AI 相册联动)', async () => {"],
      ['src/views/Files.vue',
        '// 焦点在输入框(重命名/搜索等)时不抢浏览器默认粘贴;剪贴板只有文字时静默忽略。',
        '// 焦点在输入框(重命名/搜索等)时不抢浏览器默认粘贴;剪贴板只有文字时静默忽略。(搜索接入知识库向量化)'],
    ]
    expect(rows.length, '13 条白名单,一条不能漏自查').toBe(13)
    for (const [file, legit, adversarial] of rows) {
      expect(scanText(file, legit), `legit :: ${file} :: ${legit}`).toEqual([])
      expect(scanText(file, adversarial).length, `adversarial :: ${file} :: ${adversarial}`).toBeGreaterThan(0)
    }
  })
})

describe('英文侧补词:knowledge / RAG 收 HARD,smart 明确不收(T6.5 复审 Important③)', () => {
  it('knowledge / RAG 命中(逐字摘自 en_us.sp9.ts:244-245、zh_cn.sp9.ts:253)', () => {
    for (const [file, text] of [
      ['src/i18n/en_us.sp9.ts', "  settingsFpKnowledge: 'Knowledge base',"],
      ['src/i18n/en_us.sp9.ts', "  settingsFpKnowledgeDesc: 'Folders indexed into the knowledge base (RAG).',"],
      ['src/i18n/zh_cn.sp9.ts', "  settingsFpKnowledgeDesc: '纳入知识库(RAG)索引的文件夹。',"],
    ]) {
      expect(scanText(file, text).length, `${file} :: ${text}`).toBeGreaterThan(0)
    }
  })

  it('smart 故意不收:SMART 磁盘健康检测文案不被误伤(逐字摘自 raidLevels.ts/RaidDriveCard.test.ts)', () => {
    for (const [file, text] of [
      // 逐字摘自 src/storage/util/raidLevels.ts:126-127
      ['src/storage/util/raidLevels.ts', '//   · data.disks[*].health = "true"   ← SMART 通过'],
      ['src/storage/util/raidLevels.ts', '//   · 同上                  "false"   ← SMART 未过(strconv.FormatBool,必小写)'],
      // 逐字摘自 src/storage/components/RaidDriveCard.test.ts:95
      ['src/storage/components/RaidDriveCard.test.ts', '  it(\'SMART 未过("false")→ 风险边框 + 色点 bad + 0%\', () => {'],
    ]) {
      expect(scanText(file, text), `${file} :: ${text}`).toEqual([])
    }
  })
})

// ─── T14:接上导出流程后新增的白名单 —— 每条都要能证明"同文件真泄漏仍被抓" ──────
describe('T14:新增白名单的合法原文放行 + 同文件真泄漏仍被抓', () => {
  it('StorePage.vue/test.ts 的应用商店过滤器代码放行,追加真实泄漏后仍命中(exactLine 结构性保证)', () => {
    const legit = "const search = computed(() => (typeof route.query.search === 'string' && route.query.search) || '')"
    expect(scanText('src/apps/views/StorePage.vue', legit)).toEqual([])
    // exactLine 要求整行掐头去尾等于原文 —— 追加任何内容都会让匹配失效,回落到"未豁免"
    expect(scanText('src/apps/views/StorePage.vue', legit + ' // 顺带接入 Nimo AI 语义排序').length).toBeGreaterThan(0)
  })

  it('Gallery/Photos 系统目录测试镜像放行,追加真实泄漏后仍命中(exactLine 结构性保证)', () => {
    const legit = "expect(PROTECTED).toEqual(['AppData', 'Documents', 'Downloads', 'Gallery', 'Media'])"
    expect(scanText('src/files/util/protect.test.ts', legit)).toEqual([])
    expect(scanText('src/files/util/protect.test.ts', legit + ' // 相册功能也用这份保护名单').length).toBeGreaterThan(0)
    const legitPhoto = "useFilesStore().currentPath = '/DATA/Photos'"
    expect(scanText('src/files/composables/useFileOps.test.ts', legitPhoto)).toEqual([])
    expect(scanText('src/files/composables/useFileOps.test.ts', legitPhoto + ' // AI 相册联动').length).toBeGreaterThan(0)
  })

  it('fileCategories.ts 的 Illustrator 扩展名放行,同文件混入真实 AI 泄漏仍命中', () => {
    const legit = "export const APPLICATION_ILLUSTRATOR = ['ai', 'eps']"
    expect(scanText('src/files/util/fileCategories.ts', legit)).toEqual([])
    expect(scanText('src/files/util/fileCategories.ts', 'const askNimoAi = true').length).toBeGreaterThan(0)
  })

  it('三个图标 svg 的 base64 续行放行,但换成同一文件里的一句真实注释仍命中(不是给整个文件开洞)', () => {
    for (const file of ['src/files/assets/icons/folder-hdd.svg', 'src/files/assets/icons/folder-usb.svg']) {
      expect(scanText(file, 'F1o5zB3OHX7weyEuuiOcePowIkeQ+OrwwWEKkdATnopORR7K2C2Rv1g2gNQNbsog88AiIffmmreQ')).toEqual([])
      // 纯 base64 字符集规则要求整行只有 [A-Za-z0-9+/=] —— 混入空格/中文/标签就不再匹配
      expect(scanText(file, '<!-- 这里也集成了 AI 图标生成 -->').length).toBeGreaterThan(0)
    }
    expect(scanText('src/files/assets/icons/folder-root.svg',
      '\t\t   xlink:href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAA7DAAAOwwHHb6hkAAAA"/>')).toEqual([])
    // folder-root 的规则要求出现 data:image/png;base64, 这个字面标记 —— 换成别的注释就不豁免
    expect(scanText('src/files/assets/icons/folder-root.svg', '<!-- 这里也集成了 AI 图标生成 -->').length).toBeGreaterThan(0)
  })

  it('pnpm-lock.yaml:ai/search 的宽口径放行第三方包记录行,但一句夹在其中的真实 AI 注释仍命中', () => {
    for (const file of ['pnpm-lock.yaml', 'packages/service/pnpm-lock.yaml']) {
      expect(scanText(file, "  '@codemirror/search@6.7.1':")).toEqual([])
      expect(scanText(file, '  resolution: {integrity: sha512-ZUKRh6/kUFoAiTAtTYPZJ3hw9wNxx+BIBOijnlG9PnrJsCcSjs1wyyD6vJpaYtgnzDrKYRSqf3OO6Rfa93xsRg==}')).toEqual([])
      // 不是"这一整行开洞"——一行不符合 resolution/version/specifier/包名 这个形状的
      // 手写注释,即便混在 lockfile 里也照样命中。
      expect(scanText(file, '  // 这里我们悄悄集成了 AI 智能推荐').length).toBeGreaterThan(0)
    }
  })

  it('pnpm-lock.yaml:parser 是窄口径按包名精确枚举 —— 已知的 7 个第三方包放行,虚构的 nimoos-parser 依赖仍命中', () => {
    for (const legit of [
      "  '@babel/parser@7.29.7':", '  engine.io-parser@2.2.1:', '  socket.io-parser@3.3.5:',
      '  yargs-parser: 13.1.2', "  '@csstools/css-parser-algorithms@3.0.5':",
      "  '@csstools/css-color-parser@3.1.0':", "  '@babel/helper-string-parser@7.29.7': {}",
    ]) {
      expect(scanText('pnpm-lock.yaml', legit), legit).toEqual([])
    }
    // parser 的窄口径不认"像不像 lockfile 记录行"的形状,只认上面 7 个具体包名 ——
    // 假如私有的 NimoOS-Parser 哪天真的作为依赖出现在 lockfile 里,必须被抓到。
    expect(scanText('pnpm-lock.yaml', "  nimoos-parser@1.0.0:").length).toBeGreaterThan(0)
    expect(scanText('pnpm-lock.yaml', "  '@nimotech/nimoos-parser@0.1.0':").length).toBeGreaterThan(0)
  })
})

// ─── T14(B2):锁住"预期内跳过 vs 预期外跳过"的分类,不能只靠 --skip-guard 的
// 导出跑一遍就当测过了(tree.test.mjs 走 --skip-guard,根本不经过这段分类逻辑,
// 见 export.mjs 里的注释)。isExpectedSkip 现在从 forbidden.mjs 导出,直接单测。
describe('isExpectedSkip:预期内(二进制/符号链接)只警告,预期外(读取/stat/超限/目录读取失败)仍 fatal', () => {
  it('scanTree 实际写入的两条固定文案判定为预期内', () => {
    expect(isExpectedSkip(SKIP_REASON_SYMLINK)).toBe(true)
    expect(isExpectedSkip(SKIP_REASON_BINARY)).toBe(true)
    // 双重锁定:常量的字面值就是 scanTree 里真正 skip() 出去的那两句文案,
    // 防止"常量改了但 scanTree 没跟着改"这种漂移。
    expect(SKIP_REASON_SYMLINK).toBe('符号链接,未跟随、未扫描')
    expect(SKIP_REASON_BINARY).toBe('判定为二进制,未扫描')
  })

  it('其余四类跳过原因(读取/stat/目录读取失败/超过体积上限)一律判定为预期外', () => {
    for (const excerpt of [
      '读取失败,未扫描:EACCES: permission denied',
      'stat 失败,未扫描:ENOENT: no such file or directory',
      '目录读取失败,未扫描:EACCES: permission denied',
      '超过 2097152 字节上限,未扫描',
    ]) {
      expect(isExpectedSkip(excerpt), excerpt).toBe(false)
    }
  })

  it('改一个标点(顿号→逗号)就不再判定为预期内 —— 证明这不是子串/宽松匹配', () => {
    expect(isExpectedSkip('符号链接,未跟随,未扫描')).toBe(false) // 顿号改逗号
    expect(isExpectedSkip('判定为二进制未扫描')).toBe(false) // 少一个逗号
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
