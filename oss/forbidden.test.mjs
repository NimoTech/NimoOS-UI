import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
// 2026-08-05(SP7-P8b): two locale main files renamed to *.base.ts (content unchanged in place, just added 3 lines for merged
// exit zh_cn.ts/en_us.ts, so OSS side can delete photo copy fragments entirely). All sample paths in this file renamed together
// with forbidden.mjs whitelist paths — **word list and whitelist content unchanged**.
import { describe, it, expect } from 'vitest'
import { scanText, scanTree, isExpectedSkip, SKIP_REASON_SYMLINK, SKIP_REASON_BINARY } from './forbidden.mjs'

describe('Hard forbidden words', () => {
  it('photo album / Nimo AI / transcript / qdrant / private IP all hit, no whitelist', () => {
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

describe('Soft forbidden words exact whitelist', () => {
  it('reserved surface must not false positive', () => {
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

  it('whitelist is file-scoped — same string elsewhere still hits', () => {
    expect(scanText('src/home/components/Foo.vue', 'const searchInput = ref(search.value)').length).toBeGreaterThan(0)
  })

  it('speaker is sentinel: should zero-hit after removal', () => {
    expect(scanText('src/files/viewers/MediaViewer.vue', 'function speakerColor(id) {}').length).toBeGreaterThan(0)
  })

  it('word boundaries: parse / chain / main / Chinese not harmed', () => {
    for (const [file, text] of [
      ['src/x.ts', 'JSON.parse(raw)'],
      ['src/x.ts', 'const chain = []'],
      ['src/x.ts', 'export function main() {}'],
      ['src/x.ts', '// 布局重排'],
    ]) {
      expect(scanText(file, text), text).toEqual([])
    }
  })

  // Review Important #1 repro case: original regex lacked case flag, standalone uppercase AI (class names/comments/bare word)
  // completely missed. After fix must hit; meanwhile confirm chain/main/Chairman still not affected.
  it('standalone uppercase AI must hit (class prefix, bare word, comment three forms), chain/main/Chairman still not hit', () => {
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

  // Second review Important: first-round ai regex only recognized "AI-prefixed" camelCase (AIService), missed
  // "AI-suffixed" camelCase. sendToAI is real function name in this repo (useOpenAction.ts:54 etc 8 places),
  // exactly the AI link's core entry to be removed, must hit. Meanwhile Asia/Shanghai、Asia/Dubai (real timezone
  // strings in this repo's timezones.ts)、Thai、bonsai such legitimate words must continue not hitting.
  it('camelCase suffix-AI (sendToAI/chatAI) must hit, real timezone/place-name strings not hurt', () => {
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

  // Third review Important: brief §6.3 Discipline 3 explicitly requires "orphan i18n keys need no separate check——
  // key name itself is forbidden word", this design explicitly depends on guard catching Ai-form (first letter uppercase,
  // second letter lowercase) camelCase (not all-uppercase AI). Original rule alt2 only recognized all-caps AI, missed
  // real i18n keys and function names in this repo like widgetAiSend / pathFromAiPattern / askNimoAi. All below use
  // verbatim text from real files (copied from src/i18n/zh_cn.base.ts:258-259、en_us.ts:259-260、
  // FolderPermissionsPanel.vue:146、folderPermissions.test.ts:29-30、SearchDialog.vue:265),
  // not simplified versions made up.
  it('camelCase suffix-Ai (first uppercase, second lowercase) must hit, real airport/aviation words not hurt', () => {
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

// ─── T6.5: Chinese traces ──────────────────────────────────────────────────────────
// Context: this repo's comments and UI copy are all Chinese, original word list had only one Chinese word "photo album".
// All samples below copied verbatim from real files in this repo (original private version, no simplified rewrites) ——
// this project hand-edited fixtures three times, not repeating here.
describe('Chinese traces must hit (T6.5 new)', () => {
  it('T6 review caught silent leak: HomeTopbar.vue that sentence "retain search and theme toggle" (original private version,' +
     'in export tree this sentence already changed by Task 6 PATCH, but guard must catch it before the change)', () => {
    // 逐字摘自 src/home/components/HomeTopbar.vue:57(git show HEAD 原文)
    const text = '/* ≤720px 手机启动器为只读:隐藏添加/编辑入口(排序增删在桌面做),保留搜索与主题切换 */'
    expect(scanText('src/home/components/HomeTopbar.vue', text).length, text).toBeGreaterThan(0)
  })

  it('transcript / speaker / knowledge-base / vectorization / ask Nimo all hit', () => {
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

  it('smart hits (candidate soft-forbidden, currently no repo-wide whitelist)', () => {
    // 逐字摘自 src/i18n/zh_cn.base.ts:235
    expect(scanText('src/i18n/zh_cn.base.ts', "  widgetAiDesc: '对话与智能建议',").length).toBeGreaterThan(0)
  })
})

describe('Legitimate Chinese usage zero false positives (T6.5 new)', () => {
  it('appsStoreSearch / raidLevel1Usecase / CSS semantic token comments all not hit', () => {
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

  it('transcript whitelist is content-precise: RAID copy source note doesn\'t hit, real audio-transcript key in same file still hits', () => {
    // 逐字摘自 src/i18n/zh_cn.base.ts:663/678/682
    const raidDocs = [
      '  // 逐字转录自 Vue2 面板的 RaidDetailPanel.vue L267-290(levelFaultTolerance/levelReadSpeed/levelWriteSpeed,按 level 0/1/5/6)',
      '  // read/write 为该表原始 1-5 评分(5、4),转录为评分文本。',
      "  // desc:raidUtils.js 源文件中 desc 字段本身即占位字符串(如 'RAID 0 Description'),逐字转录(非我方发明)",
    ]
    for (const text of raidDocs) {
      expect(scanText('src/i18n/zh_cn.base.ts', text), text).toEqual([])
    }
    // 白名单按内容精确匹配,不是给整个文件开洞:同一文件里真正的音频转录键必须继续命中。
    expect(scanText('src/i18n/zh_cn.base.ts', "  audioTranscript: '转录文稿',").length).toBeGreaterThan(0)
  })

  it('photo whitelist: ImageViewer (generic image viewer) and --media-overlay-shadow comment don\'t hit', () => {
    // 逐字摘自 src/files/viewers/ImageViewer.vue:207-209
    const text = '     瓦片接缝会在照片上显出白色网格细线(真机截图实证过);去掉后缩放会触发重绘,无缝。 */'
    expect(scanText('src/files/viewers/ImageViewer.vue', text)).toEqual([])
    // 换个文件就不再豁免(按文件限定,不是按文本全局豁免)
    expect(scanText('src/home/components/PhotoTile.vue', text).length).toBeGreaterThan(0)
  })

  it('search whitelist: StorePage (app store filtering) and Files.vue (rename/search input focus) don\'t hit', () => {
    // 逐字摘自 src/apps/views/StorePage.vue:59
    expect(scanText('src/apps/views/StorePage.vue', '// 搜索输入:250ms 防抖(Vue2 同款)后写 query;外部 query 变化(后退)回灌输入框')).toEqual([])
    // 逐字摘自 src/views/Files.vue:208
    expect(scanText('src/views/Files.vue', '// 焦点在输入框(重命名/搜索等)时不抢浏览器默认粘贴;剪贴板只有文字时静默忽略。')).toEqual([])
    // 白名单按文件限定:同一串文本出现在别的文件里仍然报
    expect(scanText('src/home/components/SearchDialog.vue', '// 搜索输入:250ms 防抖(Vue2 同款)后写 query;外部 query 变化(后退)回灌输入框').length).toBeGreaterThan(0)
  })
})

// ─── Review fix (2026-08-04): whitelist tightened to exact line match ─────────────────────────
// Critical: initially search/photo whitelists by "file + key-name substring" (/appsStoreSearch/,
// /raidLevel1Usecase/) or "file + single character" (StorePage.vue entire /search/) exemption, equivalent to
// opening entire line/file — mix real AI leak into exempted line and it still passes. Below use two
// constructed samples from review (marked "constructed sample", not copied from real files — they don't
// exist, if they did it's a defect) to prove: same legitimate prefix + append believable AI leak, new
// method must hit.
describe('Review fix: whitelist tightened to exact line match, no entire-line/file holes (2026-08-04)', () => {
  it('raidLevel1Usecase with real leak appended must hit (constructed sample, repro review Critical)', () => {
    // Constructed sample: append believable AI vector search description after legitimate value, deliberately
    // avoid exact strings "vectorization" "semantic search" "photo" — specifically to verify "exact line match"
    // not "keyword luck".
    const adversarial = "  raidLevel1Usecase: '照片库、个人 NAS、启动卷(这里的照片会自动生成向量做相似检索)',"
    expect(scanText('src/i18n/zh_cn.base.ts', adversarial).length, adversarial).toBeGreaterThan(0)
    // 合法原文继续不受影响
    expect(scanText('src/i18n/zh_cn.base.ts', "  raidLevel1Usecase: '照片库、个人 NAS、启动卷',")).toEqual([])
  })

  it('StorePage.vue comment with real leak appended must hit (constructed sample, repro review Critical)', () => {
    // Constructed sample: entire-file wildcard /search/ used to pass this whole line, including real leak after.
    const adversarial = '// 商店页新增语音搜索:识别用户说的话,自动填充搜索框(接入 Nimo 大模型做语义排序)'
    expect(scanText('src/apps/views/StorePage.vue', adversarial).length, adversarial).toBeGreaterThan(0)
    // 合法原文(逐字摘自 StorePage.vue:59)继续不受影响
    expect(scanText('src/apps/views/StorePage.vue', '// 搜索输入:250ms 防抖(Vue2 同款)后写 query;外部 query 变化(后退)回灌输入框')).toEqual([])
  })

  it('transcript/photo/search all 13 whitelists self-check per line: legitimate original no false pos, leak appended on same line must hit', () => {
    // Each [file, legitimate original (copied from source), constructed sample with leak appended].
    const rows = [
      ['src/i18n/zh_cn.base.ts',
        '  // 逐字转录自 Vue2 面板的 RaidDetailPanel.vue L267-290(levelFaultTolerance/levelReadSpeed/levelWriteSpeed,按 level 0/1/5/6)',
        '  // 逐字转录自 Vue2 面板的 RaidDetailPanel.vue L267-290(levelFaultTolerance/levelReadSpeed/levelWriteSpeed,按 level 0/1/5/6)(顺带把这段转录接入向量化知识库)'],
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

describe('English side additions: knowledge / RAG in HARD, smart explicitly not (T6.5 review Important③)', () => {
  it('knowledge / RAG hit (copied from en_us.sp9.ts:244-245、zh_cn.sp9.ts:253)', () => {
    for (const [file, text] of [
      ['src/i18n/en_us.sp9.ts', "  settingsFpKnowledge: 'Knowledge base',"],
      ['src/i18n/en_us.sp9.ts', "  settingsFpKnowledgeDesc: 'Folders indexed into the knowledge base (RAG).',"],
      ['src/i18n/zh_cn.sp9.ts', "  settingsFpKnowledgeDesc: '纳入知识库(RAG)索引的文件夹。',"],
    ]) {
      expect(scanText(file, text).length, `${file} :: ${text}`).toBeGreaterThan(0)
    }
  })

  it('smart intentionally not collected: SMART disk health-check copy not harmed (copied from raidLevels.ts/RaidDriveCard.test.ts)', () => {
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

// ─── T14: new whitelists after export flow — each must prove "real leak in same file still caught" ──────
describe('T14: new whitelist legitimate original passes + real leak in same file still caught', () => {
  it('StorePage.vue/test.ts app store filter code passes, real leak appended still hits (exactLine structural guarantee)', () => {
    const legit = "const search = computed(() => (typeof route.query.search === 'string' && route.query.search) || '')"
    expect(scanText('src/apps/views/StorePage.vue', legit)).toEqual([])
    // exactLine requires entire line with ends trimmed equals original — append anything breaks match, falls back to "not exempted"
    expect(scanText('src/apps/views/StorePage.vue', legit + ' // bonus add Nimo AI semantic sort').length).toBeGreaterThan(0)
  })

  it('Gallery/Photos system directory test mirror passes, real leak appended still hits (exactLine structural guarantee)', () => {
    const legit = "expect(PROTECTED).toEqual(['AppData', 'Documents', 'Downloads', 'Gallery', 'Media'])"
    expect(scanText('src/files/util/protect.test.ts', legit)).toEqual([])
    expect(scanText('src/files/util/protect.test.ts', legit + ' // photos feature also uses this protect list').length).toBeGreaterThan(0)
    const legitPhoto = "useFilesStore().currentPath = '/DATA/Photos'"
    expect(scanText('src/files/composables/useFileOps.test.ts', legitPhoto)).toEqual([])
    expect(scanText('src/files/composables/useFileOps.test.ts', legitPhoto + ' // AI 相册联动').length).toBeGreaterThan(0)
  })

  it('fileCategories.ts Illustrator extension passes, real AI leak mixed in same file still hits', () => {
    const legit = "export const APPLICATION_ILLUSTRATOR = ['ai', 'eps']"
    expect(scanText('src/files/util/fileCategories.ts', legit)).toEqual([])
    expect(scanText('src/files/util/fileCategories.ts', 'const askNimoAi = true').length).toBeGreaterThan(0)
  })

  it('three icon SVG base64 continuation lines pass, but swap for real comment in same file still hits (not entire file hole)', () => {
    for (const file of ['src/files/assets/icons/folder-hdd.svg', 'src/files/assets/icons/folder-usb.svg']) {
      expect(scanText(file, 'F1o5zB3OHX7weyEuuiOcePowIkeQ+OrwwWEKkdATnopORR7K2C2Rv1g2gNQNbsog88AiIffmmreQ')).toEqual([])
      // Pure base64 charset rule requires entire line only [A-Za-z0-9+/=] — mix spaces/Chinese/tags no longer match
      expect(scanText(file, '<!-- here also integrated AI icon generation -->').length).toBeGreaterThan(0)
    }
    expect(scanText('src/files/assets/icons/folder-root.svg',
      '\t\t   xlink:href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAA7DAAAOwwHHb6hkAAAA"/>')).toEqual([])
    // folder-root rule requires appearance of data:image/png;base64, this literal marker — swap to different comment not exempt
    expect(scanText('src/files/assets/icons/folder-root.svg', '<!-- here also integrated AI icon generation -->').length).toBeGreaterThan(0)
  })

  it('pnpm-lock.yaml: ai/search broad-scope passes third-party package record line, but real AI comment mixed in still hits', () => {
    for (const file of ['pnpm-lock.yaml', 'packages/service/pnpm-lock.yaml']) {
      expect(scanText(file, "  '@codemirror/search@6.7.1':")).toEqual([])
      expect(scanText(file, '  resolution: {integrity: sha512-ZUKRh6/kUFoAiTAtTYPZJ3hw9wNxx+BIBOijnlG9PnrJsCcSjs1wyyD6vJpaYtgnzDrKYRSqf3OO6Rfa93xsRg==}')).toEqual([])
      // Not "this entire line is a hole" — hand-written comment not matching resolution/version/specifier/package-name shape,
      // even mixed in lockfile still hits.
      expect(scanText(file, '  // here we quietly integrated smart AI recommendations').length).toBeGreaterThan(0)
    }
  })

  it('pnpm-lock.yaml: parser is narrow-scope exact package-name enumeration — known 7 third-party packages pass, fictional nimoos-parser dependency still hits', () => {
    for (const legit of [
      "  '@babel/parser@7.29.7':", '  engine.io-parser@2.2.1:', '  socket.io-parser@3.3.5:',
      '  yargs-parser: 13.1.2', "  '@csstools/css-parser-algorithms@3.0.5':",
      "  '@csstools/css-color-parser@3.1.0':", "  '@babel/helper-string-parser@7.29.7': {}",
    ]) {
      expect(scanText('pnpm-lock.yaml', legit), legit).toEqual([])
    }
    // parser's narrow scope doesn't recognize "looks like lockfile record line" shape, only above 7 specific package names ——
    // if private NimoOS-Parser really appears as dependency in lockfile someday, must be caught.
    expect(scanText('pnpm-lock.yaml', "  nimoos-parser@1.0.0:").length).toBeGreaterThan(0)
    expect(scanText('pnpm-lock.yaml', "  '@nimotech/nimoos-parser@0.1.0':").length).toBeGreaterThan(0)
  })
})

// ─── T14(B2): Lock down "expected skip vs unexpected skip" classification, can't rely only on --skip-guard
// export run once as tested (tree.test.mjs uses --skip-guard, never goes through this classification logic,
// see comments in export.mjs). isExpectedSkip now exported from forbidden.mjs, direct unit test.
describe('isExpectedSkip: expected (binary/symlink) warning-only, unexpected (read/stat/over-limit/dir-read failure) still fatal', () => {
  it('two fixed messages scanTree actually writes judged as expected', () => {
    expect(isExpectedSkip(SKIP_REASON_SYMLINK)).toBe(true)
    expect(isExpectedSkip(SKIP_REASON_BINARY)).toBe(true)
    // 双重锁定:常量的字面值就是 scanTree 里真正 skip() 出去的那两句文案,
    // 防止"常量改了但 scanTree 没跟着改"这种漂移。
    expect(SKIP_REASON_SYMLINK).toBe('symbolic link, not followed, not scanned')
    expect(SKIP_REASON_BINARY).toBe('determined to be binary, not scanned')
  })

  it('remaining four skip reasons (read/stat/directory-read failure/over-size-limit) all judged as unexpected', () => {
    for (const excerpt of [
      'read failed, not scanned: EACCES: permission denied',
      'stat failed, not scanned: ENOENT: no such file or directory',
      'directory read failed, not scanned: EACCES: permission denied',
      'exceeded 2097152 byte limit, not scanned',
    ]) {
      expect(isExpectedSkip(excerpt), excerpt).toBe(false)
    }
  })

  it('dropping one punctuation mark no longer judged as expected — proves not substring/loose match', () => {
    expect(isExpectedSkip('symbolic link not followed, not scanned')).toBe(false) // missing comma
    expect(isExpectedSkip('determined to be binary not scanned')).toBe(false) // missing comma
  })
})

describe('scanTree: exclusion-based, not extension whitelist', () => {
  const mktmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'oss-forbidden-'))

  // Review Important #2 repro case: original implementation skipped files by TEXT_EXT extension whitelist,
  // .env / Dockerfile type files not enumerated in extension would be wholly passed, not even read.
  it('.env / no-extension files must be scanned — can\'t skip by extension', () => {
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

  it('binary files produce no content false positives, but leave __skipped__ trace, not silent skip', () => {
    const dir = mktmp()
    try {
      // Fake PNG: first few bytes contain NUL, enough to trigger looksBinary
      fs.writeFileSync(path.join(dir, 'icon.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d, 0x0a, 0x1a]))
      const findings = scanTree(dir)
      expect(findings.some((f) => f.file === 'icon.png' && f.word === '__skipped__')).toBe(true)
      expect(findings.some((f) => f.file === 'icon.png' && f.word !== '__skipped__')).toBe(false)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('files under node_modules and .git directories not scanned', () => {
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

  // Second review Important: symlink pointing to directory used to crash scanTree with EISDIR
  // (this repo's .claude/worktrees/NimoOS-Service is such link, review reproduced with real repo).
  // After fix must gracefully skip with trace, not throw.
  it('symlink pointing to directory shouldn\'t crash scanTree, should leave __skipped__ trace; real directory still normally scanned', () => {
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
      // Real directory traversed normally through its own real path (not through link),
      // proves "skip link itself" didn't miss scanning the real content it points to.
      const innerFile = path.join('real-target', 'inner.ts')
      expect(findings.some((f) => f.file === innerFile && f.word === 'qdrant')).toBe(true)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  // Third review bonus hardening: subdirectory's readdirSync previously had no try/catch, encountering unreadable directory
  // (permission issues, race deletion) would crash entire scanTree like symlinks. Reproduced with real chmod 000 directory —
  // not mock, actually clear permission bits. Root user not limited by chmod (DAC doesn't apply to root), this test
  // meaningless when run as root, skip.
  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0
  it.skipIf(isRoot)('unreadable subdirectory shouldn\'t crash scanTree, should leave __skipped__ trace', () => {
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

  // 2026-08-07: SP11 Task 1 added wallpaper01.jpg (2,281,371 bytes) is over-limit **binary** file,
  // old implementation mistakenly judged as "over size limit" (unexpected, fatal), caused oss/tree.test.mjs red,
  // export.mjs refused export. MAX_BYTES is scan-cost limit, not trust boundary — over-limit binary files
  // should get same classification as sub-limit binary files (SKIP_REASON_BINARY, expected).
  it('file over size-limit but first 8KB judged binary, classified as SKIP_REASON_BINARY (expected), not "over-limit" (unexpected)', () => {
    const dir = mktmp()
    try {
      const size = 2 * 1024 * 1024 + 1 // MAX_BYTES + 1
      const buf = Buffer.alloc(size, 0x61) // 'a' 填充
      buf[100] = 0 // NUL 字节落在 looksBinary 只嗅探的开头 8KB 范围内
      fs.writeFileSync(path.join(dir, 'big.bin'), buf)
      const findings = scanTree(dir)
      const hit = findings.find((f) => f.file === 'big.bin')
      expect(hit).toBeTruthy()
      expect(hit.word).toBe('__skipped__')
      expect(hit.excerpt).toBe(SKIP_REASON_BINARY)
      expect(isExpectedSkip(hit.excerpt)).toBe(true)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  // Reverse assertion: prove limit itself not quietly turned off — over-limit **text** files (first 8KB no NUL)
  // must still fall back to "over size limit" (unexpected, still fatal), because such files could really hide
  // leaks in unread regions. This passed in old implementation (old never distinguished binary/text, all classified
  // as over-limit), must continue passing after fix, prevent regression "after reorder text over-limit also wrongly passed".
  it('over-size-limit text file not binary, still classified as "over size limit" (unexpected) — prove limit not quietly turned off', () => {
    const dir = mktmp()
    try {
      const size = 2 * 1024 * 1024 + 1
      const text = 'a'.repeat(size)
      fs.writeFileSync(path.join(dir, 'big.txt'), text)
      const findings = scanTree(dir)
      const hit = findings.find((f) => f.file === 'big.txt')
      expect(hit).toBeTruthy()
      expect(hit.word).toBe('__skipped__')
      expect(hit.excerpt).toBe('exceeded 2097152 byte limit, not scanned')
      expect(isExpectedSkip(hit.excerpt)).toBe(false)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  // When sniffing over-limit files only read file start (fs.openSync/readSync), this head-read step itself can fail
  // (permission issues) — must still report "read failed" (unexpected), can't silently swallow just because it's new
  // head-read branch. Reproduced with real chmod 000 file, same technique as unreadable directory case above.
  it.skipIf(isRoot)('over-size-limit file with failed head-read (no-read permission), report "read failed" (unexpected), don\'t silently swallow', () => {
    const dir = mktmp()
    const bigPath = path.join(dir, 'big-locked.bin')
    try {
      const size = 2 * 1024 * 1024 + 1
      fs.writeFileSync(bigPath, Buffer.alloc(size, 0x61))
      fs.chmodSync(bigPath, 0o000)

      let findings
      expect(() => {
        findings = scanTree(dir)
      }).not.toThrow()

      const hit = findings.find((f) => f.file === 'big-locked.bin')
      expect(hit).toBeTruthy()
      expect(hit.word).toBe('__skipped__')
      expect(hit.excerpt.startsWith('read failed, not scanned: ')).toBe(true)
      expect(isExpectedSkip(hit.excerpt)).toBe(false)
    } finally {
      fs.chmodSync(bigPath, 0o644) // 恢复权限,否则 rmSync 递归删除会失败
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
