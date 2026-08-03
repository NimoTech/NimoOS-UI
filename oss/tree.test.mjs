import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { REPLACE } from './manifest.mjs'

const OSS = path.dirname(new URL(import.meta.url).pathname)
let tree

beforeAll(() => {
  tree = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-out-'))
  execFileSync('node', [path.join(OSS, 'export.mjs'), '--out', tree, '--skip-guard', '--no-commit', '--allow-dirty-oss'], {
    stdio: 'pipe', encoding: 'utf8',
  })
}, 180_000)
afterAll(() => fs.rmSync(tree, { recursive: true, force: true }))

const read = (rel) => fs.readFileSync(path.join(tree, rel), 'utf8')
const exists = (rel) => fs.existsSync(path.join(tree, rel))

describe('类 1 · 整体删除', () => {
  it('oss/ 自己不在产物里', () => expect(exists('oss')).toBe(false))

  it('AI/相册/搜索的组件与 store 全没了', () => {
    for (const rel of [
      'src/home/components/SearchDialog.vue',
      'src/home/components/PhotoTile.vue',
      'src/home/components/widgets/AiWidget.vue',
      'src/home/stores/photos.ts',
      'src/home/apps/icons/photos.svg',
      'src/home/apps/icons/ai.svg',
      'src/files/viewers/audioTranscripts.ts',
      'src/files/viewers/speakerWave.ts',
      'src/settings/panels/FolderPermissionsPanel.vue',
      'src/settings/panels/folderPerm',
      'src/settings/util/folderPermissions.ts',
      'src/settings/util/folderPermissionsSnapshot.ts',
      'src/settings/util/folderPermissionsView.ts',
      'src/settings/util/folderBrowser.ts',        // E3:零消费方,改为整体删除
      'src/settings/util/folderBrowser.test.ts',
      'public/demo/fish_video_poster.jpg',
      'src/home/util/isAssetId.ts',                // T7 尾巴4:bindPhotos/PhotoTile 都没了之后的孤儿
    ]) expect(exists(rel), rel).toBe(false)
  })

  it('保留面还在', () => {
    for (const rel of [
      'src/files/viewers/waveform.ts',                        // 真实波形,解码 PCM,不涉 AI
      'src/settings/panels/account/MemberFoldersView.vue',    // 成员文件夹授权
      'src/files/util/protect.ts',
      'src/apps/views/StorePage.vue',
      'scripts/deploy.sh',
      'public/widget-kit.css',
    ]) expect(exists(rel), rel).toBe(true)
  })

  it('文档与 AI 辅助开发痕迹整体不导出(E7/E8)', () => {
    expect(exists('docs')).toBe(false)
    expect(exists('CLAUDE.md')).toBe(false)
    expect(exists('design-export')).toBe(false)
  })
})

describe('内嵌共享包', () => {
  it('Service 落到 packages/service/,package.json 的 file: 指过去', () => {
    expect(exists('packages/service/src/index.ts')).toBe(true)
    expect(exists('packages/service/src/photos.ts')).toBe(false)
    const pkg = JSON.parse(read('package.json'))
    expect(pkg.dependencies['@nimotech/nimoos-service']).toBe('file:./packages/service')
  })

  it('lockfile 里不再有 ../NimoOS-Service 路径', () => {
    expect(read('pnpm-lock.yaml')).not.toContain('NimoOS-Service')
  })
})

describe('类 3 · 桌面侧补丁', () => {
  it('系统应用清单只剩 5 个,photos/ai 的 import 与 glyph 都没了', () => {
    const s = read('src/home/apps/systemApps.ts')
    expect(s).not.toMatch(/photos|iconAi|G\.ai/)
    expect(s.match(/\{ key: '/g)).toHaveLength(5)
    for (const k of ['files', 'storage', 'vm', 'settings', 'appstore']) expect(s).toContain(`key: '${k}'`)
  })

  it('Dock 默认收藏 = files/storage/vm/appstore', () => {
    expect(read('src/home/composables/useDock.ts'))
      .toContain("const DEFAULT_FAV = ['files', 'storage', 'vm', 'appstore']")
  })

  it('SYS_ROUTE 指内部路由,cutoverDisabled 恒 false,sendToAI 整个没了', () => {
    const s = read('src/home/composables/useOpenAction.ts')
    expect(s).toContain("vm: '/kvm', settings: '/settings'")
    expect(s).not.toMatch(/sendToAI|'#\/photos'|ai\/agent|strangler:disabled/)
    expect(s).toContain('function cutoverDisabled(): boolean { return false }')
  })

  it("Kind 联合类型去掉 'photo'", () => {
    expect(read('src/home/grid/types.ts'))
      .toContain("export type Kind = 'widget' | 'app' | 'folder' | 'appwidget'")
  })

  it('小组件注册表与 WidgetCard 不再有 ai', () => {
    expect(read('src/home/widgets/registry.ts')).not.toMatch(/\bai:/)
    expect(read('src/home/components/widgets/WidgetCard.vue')).not.toMatch(/AiWidget/)
  })

  it('GridItem / MobileHome 不再引用 PhotoTile', () => {
    for (const rel of ['src/home/components/GridItem.vue', 'src/home/components/MobileHome.vue']) {
      expect(read(rel), rel).not.toMatch(/PhotoTile|'photo'|m-photo/)
    }
  })

  it('layout store 去掉 bindPhotos,homeUi 去掉 search 四项', () => {
    expect(read('src/home/stores/layout.ts')).not.toMatch(/bindPhotos/)
    const h = read('src/home/stores/homeUi.ts')
    expect(h).not.toMatch(/searchOpen|setSearch|openSearch|closeSearch/)
  })

  it('顶栏没有搜索胶囊与 ⌘K 监听,Home.vue 不挂 SearchDialog', () => {
    const t = read('src/home/components/HomeTopbar.vue')
    expect(t).not.toMatch(/search-btn|topbarSearch|metaKey/)
    const h = read('src/views/Home.vue')
    expect(h).not.toMatch(/SearchDialog|usePhotosStore|loadAssets|bindPhotos/)
  })

  it('AddPanel 的 tab 联合类型与尺寸表去掉 photo', () => {
    const a = read('src/home/composables/useAddPanel.ts')
    expect(a).toContain("const curTab = ref<'widget' | 'app' | 'folder'>('widget')")
    expect(a).not.toMatch(/'photo'/)
  })

  it('复审修复:顶栏 ≤720px 注释不再提"搜索",且没有死 import', () => {
    const t = read('src/home/components/HomeTopbar.vue')
    expect(t).not.toMatch(/搜索/)
    expect(t).toContain('保留主题切换')
    expect(t).not.toMatch(/onMounted|onUnmounted/)
  })

  it('复审修复:layout.ts 不再 import isAssetId', () => {
    expect(read('src/home/stores/layout.ts')).not.toMatch(/isAssetId/)
  })

  it('T7 尾巴1:HomeTopbar 不再引用 homeUi(搜索按钮与 ⌘K 监听已被上面的补丁删完)', () => {
    expect(read('src/home/components/HomeTopbar.vue')).not.toMatch(/homeUi/)
  })
})

describe('类 3 · 设置与 Service 侧补丁', () => {
  it('设置 tab 从 9 降到 8,rail 从 7 降到 6,folder-permissions 全无', () => {
    const s = read('src/settings/util/tabs.ts')
    expect(s).not.toMatch(/folder-permissions|FolderPermissions/)
    expect(s).toContain('SETTINGS_TABS.slice(0, 6)')
    expect(read('src/settings/panels/index.ts')).not.toMatch(/FolderPermissions/)
  })

  it('railTabsFor 退化为恒等(不再按 admin 过滤)', () => {
    const s = read('src/settings/util/tabs.ts')
    expect(s).toContain('export function railTabsFor(): readonly SettingsTab[] {')
    expect(s).not.toMatch(/role === 'admin'/)
  })

  it('SettingsShell.vue 的唯一调用处跟着改签名,不再传 role 实参', () => {
    expect(read('src/settings/components/SettingsShell.vue'))
      .toContain('const railTabs = computed(() => railTabsFor())')
  })

  it('E2:systemConfig 不再有 search_switch', () => {
    expect(read('src/settings/util/systemConfig.ts')).not.toMatch(/search_switch/)
  })

  it('E13:Service 不再导出 photos / PhotoAsset', () => {
    const i = read('packages/service/src/index.ts')
    expect(i).not.toMatch(/createPhotos|PhotoAsset|get photos/)
    expect(read('packages/service/src/types.ts')).not.toMatch(/PhotoAsset/)
    // 保留面
    expect(read('packages/service/src/types.ts')).toContain('UserFolderPermission')
  })

  it('注释洗白:两处不再点名 AI agent / Photos ML / photos_data', () => {
    expect(read('src/apps/util/systemApp.ts')).not.toMatch(/AI agent|Photos ML/)
    expect(read('src/settings/util/appPaths.ts')).not.toMatch(/photos_data/)
  })

  it('T7 尾巴2:installedApps.ts 的注释不再点名 AI agent / Photos ML', () => {
    expect(read('src/apps/stores/installedApps.ts')).not.toMatch(/AI agent|Photos ML/)
  })

  it('T7 尾巴3:AppsPanel.vue 的注释不再提相册区迁移计划', () => {
    expect(read('src/settings/panels/AppsPanel.vue')).not.toMatch(/相册|SP7/)
  })

  it('E9:.gitignore 洗掉 4 行,加 .export-report.txt', () => {
    const g = read('.gitignore')
    for (const bad of ['.claude/', '.superpowers/', 'scripts/tmlab/', 'vite.config.tmlab.ts']) {
      expect(g, bad).not.toContain(bad)
    }
    expect(g).toContain('.export-report.txt')
    // E9:断言必须落在"独立一行",不能被写成 *.txt 之类的通配、也不能和别的内容挤在同一行
    expect(g.split('\n')).toContain('.export-report.txt')
  })
})

describe('类 3 · i18n 与主题 token', () => {
  const LOCALES = ['src/i18n/zh_cn.ts', 'src/i18n/en_us.ts', 'src/i18n/zh_cn.sp9.ts', 'src/i18n/en_us.sp9.ts']

  it('四个 locale 里 AI/相册/搜索/转录/文件夹权限的键全没了', () => {
    const DEAD = [
      // 桌面:系统应用名 / 组件(AiWidget.vue 已整体删除,widgetAi* 全部是孤儿,不止 brief 点名的 2 个)
      'appPhotos', 'appAi',
      'widgetAiTitle', 'widgetAiDesc', 'widgetAiGreetShort', 'widgetAiGreet',
      'widgetAiPlaceholder', 'widgetAiSend', 'widgetAiPrompt1', 'widgetAiPrompt2', 'widgetAiPrompt3',
      // AddPanel 照片 tab(T11 的活,这里先清 i18n 侧)
      'addPanelTabPhoto', 'addPanelNoPhotos',
      // 顶栏搜索胶囊 + 搜索面板整节(SearchDialog.vue 已整体删除,18 键全部是孤儿)
      'topbarSearch', 'topbarSearchKbd',
      'searchPlaceholder', 'searchClose', 'searchSearching', 'searchResultsCount',
      'searchOpenAlbum', 'searchAlbumMatches', 'searchOpenFolder', 'searchOpenFolderTitle',
      'searchAskTitle', 'searchAskSub', 'searchAskGo', 'searchAskButton', 'searchHint',
      'searchTabAll', 'searchTabDocuments', 'searchTabImages', 'searchTabAudio', 'searchTabVideos',
      // E1:spec 漏登记的 11 个 audio 转录键(audioSkipBack/Forward/Speed 播放器控件保留,见下一个 it)
      'audioSummary', 'audioTranscript', 'audioAsk', 'audioAskPlaceholder', 'audioAskEmpty', 'audioAskDemo',
      'audioHighlightsOnly', 'audioShowAll', 'audioSpeakerAll', 'audioChapters', 'audioAllChapters',
      // 文件夹权限四分区(FolderPermissionsPanel.vue + folderPerm/ 已整体删除):26 个键全是孤儿,
      // 不止 chinese-leaks.md 列出的 8-10 个中文候选词样本 —— 已逐一核实零消费方(见 task-8-report.md)
      'settingsTabFolderPermissions', 'settingsFpIntro', 'settingsFpDataPending', 'settingsFpFilenameIndex',
      'settingsFpServiceOffline', 'settingsFpFilenameDesc', 'settingsFpNoFolders', 'settingsFpKnowledge',
      'settingsFpKnowledgeDesc', 'settingsFpIndexedFolders', 'settingsFpExcludedSubfolders',
      'settingsFpAddExclusion', 'settingsFpNoExclusions', 'settingsFpAiHidden', 'settingsFpCurrentUserOnly',
      'settingsFpAiDesc', 'settingsFpNoAiBlocked', 'settingsFpPhotos', 'settingsFpUpdateRequired',
      'settingsFpPhotosDesc', 'settingsFpPhotosAuto', 'settingsFpSwitchManual', 'settingsFpPhotosStale',
      'settingsFpCoveredBy', 'settingsFpGlobRules', 'settingsFpAddFolder',
    ]
    for (const f of LOCALES) for (const k of DEAD) expect(read(f), `${f} :: ${k}`).not.toContain(`${k}:`)
  })

  it('播放器控件键与商店筛选键保留', () => {
    for (const f of ['src/i18n/zh_cn.ts', 'src/i18n/en_us.ts']) {
      for (const k of ['audioSkipBack', 'audioSkipForward', 'audioSpeed', 'appsStoreSearch']) {
        expect(read(f), `${f} :: ${k}`).toContain(`${k}:`)
      }
    }
  })

  it('zh_cn 与 en_us 键数仍然相等(parity 的前置)', () => {
    const keys = (f) => (read(f).match(/^\s{2}[a-zA-Z][a-zA-Z0-9]*:/gm) || []).length
    expect(keys('src/i18n/zh_cn.ts')).toBe(keys('src/i18n/en_us.ts'))
    expect(keys('src/i18n/zh_cn.sp9.ts')).toBe(keys('src/i18n/en_us.sp9.ts'))
  })

  it('theme.css:说话人/AI token 与照片磁贴样式删净,--wave-none 保留(E11)', () => {
    const c = read('src/styles/theme.css')
    for (const bad of ['--spk-', '--wave-dim', '--orb-core', '--orb-glow',
                       '@keyframes pulse', '.ic-photos', '.ic-ai', '.ic-search',
                       '.photo-thumb', '.kind-photo']) {
      expect(c, bad).not.toContain(bad)
    }
    // 两套主题块里都要还有 --wave-none
    expect(c.match(/--wave-none/g)?.length).toBe(2)
  })

  it('theme.sp9.css 不含任何 AI/相册/搜索/说话人相关 token(核查结论:干净,未改动)', () => {
    const c = read('src/styles/theme.sp9.css')
    for (const bad of ['spk', 'wave-', 'orb-', 'photo', 'knowledge', 'transcript', 'speaker',
                       '说话人', '转录', '相册', '智能', '照片', '搜索', '知识库']) {
      expect(c.toLowerCase(), bad).not.toContain(bad.toLowerCase())
    }
  })

  it('复审 Important:settingsAppsPendingDisabledHint 是活键(AppsPanel.vue 消费),必须保留键但值不能提相册/Photos', () => {
    const zh = read('src/i18n/zh_cn.sp9.ts')
    const en = read('src/i18n/en_us.sp9.ts')
    // 键仍在 —— 删了 AppsPanel.vue 这一行会拿到 undefined,是 Critical
    expect(zh).toContain('settingsAppsPendingDisabledHint:')
    expect(en).toContain('settingsAppsPendingDisabledHint:')
    // 值不再点名相册区 / Photos section,也不再暴露"本期新增/做样子"这类分期开发状态注释
    expect(zh).not.toMatch(/settingsAppsPendingDisabledHint:[^\n]*相册/)
    expect(en).not.toMatch(/settingsAppsPendingDisabledHint:[^\n]*Photos/)
    expect(zh).not.toMatch(/settingsAppsPendingDisabledHint:[^\n]*(本期|做样子)/)
  })

  it('复审第二轮:sp9 两个 locale 文件的头注释(仅前几行)不再泄露内部期号/被剔除功能名/分支代号,第 3 行保留', () => {
    // 只看文件头注释块(export default { 之前),不是整份文件 —— 文件里其余"SP9-P4 account"/
    // "SP9-P6 …"这类章节标题注释不在本轮范围内(coordinator 明确排除,属于全仓 30 文件那一大类)。
    const zhHeader = read('src/i18n/zh_cn.sp9.ts').split('export default {')[0]
    const enHeader = read('src/i18n/en_us.sp9.ts').split('export default {')[0]
    // SP9(?!\.ts):排除"zh_cn.sp9.ts / en_us.sp9.ts"这种指代文件名本身的合法引用
    // (第 1 行改写后仍会说"See zh_cn.sp9.ts."),不是内部期号泄漏。
    for (const bad of [/SP9(?!\.ts)/i, /Search/, /\bsp7\b/i, /\bsp8\b/i, /并行开发/, /spec §/]) {
      expect(zhHeader, bad).not.toMatch(bad)
      expect(enHeader, bad).not.toMatch(bad)
    }
    // 第 3 行(提 parity.test.ts,仓内正常引用)不构成泄漏,原样保留
    expect(zhHeader).toContain('parity.test.ts')
  })
})

describe('类 2 · 桌面默认布局', () => {
  it('不再导出 PHOTO_PLACEHOLDERS,没有 photo 磁贴与 ai 组件', () => {
    const s = read('src/home/grid/defaultLayout.ts')
    expect(s).not.toMatch(/PHOTO_PLACEHOLDERS|kind: 'photo'|key: 'ai'/)
  })

  it('占 69 格,全部落在 12×8 内且不重叠', () => {
    const s = read('src/home/grid/defaultLayout.ts')
    const items = [...s.matchAll(/c:\s*(\d+),\s*r:\s*(\d+),\s*w:\s*(\d+),\s*h:\s*(\d+)/g)]
      .map(([, c, r, w, h]) => ({ c: +c, r: +r, w: +w, h: +h }))
    expect(items.length).toBe(15)
    const seen = new Set()
    let cells = 0
    for (const it of items) {
      expect(it.c + it.w - 1, JSON.stringify(it)).toBeLessThanOrEqual(12)
      expect(it.r + it.h - 1, JSON.stringify(it)).toBeLessThanOrEqual(8)
      for (let x = it.c; x < it.c + it.w; x++) for (let y = it.r; y < it.r + it.h; y++) {
        const k = `${x},${y}`
        expect(seen.has(k), `重叠于 ${k}`).toBe(false)
        seen.add(k); cells++
      }
    }
    expect(cells).toBe(69)
  })

  it('最后两行(r7/r8)完全留空', () => {
    const s = read('src/home/grid/defaultLayout.ts')
    const items = [...s.matchAll(/r:\s*(\d+),\s*w:\s*\d+,\s*h:\s*(\d+)/g)].map(([, r, h]) => +r + +h - 1)
    expect(Math.max(...items)).toBe(6)
  })

  it('每个小组件的落位尺寸都在 registry 的 min/max 内', () => {
    const layout = read('src/home/grid/defaultLayout.ts')
    const reg = read('src/home/widgets/registry.ts')
    const ranges = {}
    for (const [, k, mw, mh, xw, xh] of reg.matchAll(
      /(\w+):\s*\{[^}]*min:\s*\[(\d+),\s*(\d+)\][^}]*max:\s*\[(\d+),\s*(\d+)\]/g)) {
      ranges[k] = { min: [+mw, +mh], max: [+xw, +xh] }
    }
    for (const [, key, w, h] of layout.matchAll(
      /kind:\s*'widget',\s*key:\s*'(\w+)',\s*c:\s*\d+,\s*r:\s*\d+,\s*w:\s*(\d+),\s*h:\s*(\d+)/g)) {
      const r = ranges[key]
      expect(r, `registry 里没有 ${key}`).toBeTruthy()
      expect(+w, `${key}.w`).toBeGreaterThanOrEqual(r.min[0]); expect(+w, `${key}.w`).toBeLessThanOrEqual(r.max[0])
      expect(+h, `${key}.h`).toBeGreaterThanOrEqual(r.min[1]); expect(+h, `${key}.h`).toBeLessThanOrEqual(r.max[1])
    }
  })
})

describe('类 2 · AddPanel 去照片 tab', () => {
  it('照片 tab 与 photos store 全无', () => {
    const s = read('src/home/components/AddPanel.vue')
    for (const bad of ['usePhotosStore', 'photosStore', "curTab.value === 'photo'",
                       'addPanelNoPhotos', 'addPanelTabPhoto', 'lib-photo']) {
      expect(s, bad).not.toContain(bad)
    }
  })

  it('三个 tab 都还在', () => {
    const s = read('src/home/components/AddPanel.vue')
    for (const k of ["key: 'widget'", "key: 'app'", "key: 'folder'"]) expect(s).toContain(k)
  })

  it('注释洗白:ic-photos 不再出现,ic-files 仍在原位', () => {
    const s = read('src/home/components/AddPanel.vue')
    expect(s).not.toMatch(/ic-photos/)
    expect(s).toContain('ic-files')
  })

  it('文件明显变短(519 行 → 490 行以内)', () => {
    expect(read('src/home/components/AddPanel.vue').split('\n').length).toBeLessThanOrEqual(490)
  })
})

describe('类 2 · MediaViewer 拆转录', () => {
  it('转录/说话人/Ask 的符号全无(speaker 是哨兵词)', () => {
    const s = read('src/files/viewers/MediaViewer.vue')
    for (const bad of ['audioTranscripts', 'speakerWave', 'lookupTranscript', 'TranscriptSegment',
                       'speakerToken', 'segMatches', 'barSpeakers', 'segChapterIndex', 'barChapterIndex',
                       'transcriptRows', 'highlightsOnly', 'pickedSpeakers', 'pickedChapters',
                       'askMsgs', 'sendAsk', 'PRESETS', 'answerFor', 'stopStream',
                       'ap-tabs', 'ap-transcript', 'spk-chip', 'audio-panel', 'has-panel',
                       '--spk-', '--wave-dim', 'DropdownMenu']) {
      expect(s, bad).not.toContain(bad)
    }
  })

  it('播放器与真实波形完整保留,静场 token 还在(E11)', () => {
    const s = read('src/files/viewers/MediaViewer.vue')
    for (const k of ['waveform', 'decodeWaveform', 'synthWaveform', 'waveCacheKey',
                     'np-wave-bar', 'playedBars', 'togglePlay', 'cycleRate',
                     'audioSkipBack', 'audioSkipForward', 'audioSpeed',
                     'var(--wave-none)', 'music-metadata-browser', 'artplayer']) {
      expect(s, k).toContain(k)
    }
  })

  it('文件明显变短(852 行 → 600 行以内)', () => {
    expect(read('src/files/viewers/MediaViewer.vue').split('\n').length).toBeLessThan(600)
  })
})

describe('类 2 · README', () => {
  it('不提 Vue2 / strangler / 同级克隆 Service', () => {
    const s = read('README.md')
    for (const bad of ['Vue 2', 'Vue2', 'strangler', 'Strangler', 'NimoOS-New-UI',
                       'file:../NimoOS-Service', '同级目录']) {
      expect(s, bad).not.toContain(bad)
    }
  })

  it('讲清安装、内嵌共享包与四条已知缺口', () => {
    const s = read('README.md')
    for (const k of ['pnpm', 'packages/service', '快照', '语言', '终端', '存储']) {
      expect(s, k).toContain(k)
    }
  })
})

describe('类 2 · 冻结分身注释不泄露内部开发状态', () => {
  // 固定清单(每次新增 REPLACE 条目都要过一遍,别为单个文件重开断言):
  // 内部任务追踪编号 / 期号 / 分支代号 / spec 章节号 / 分期开发措辞 / 旧版本代号 / 私有仓名。
  const FORBIDDEN = [/Task \d/, /SP\d/i, /\bsp[789]\b/i, /spec §/, /本期/, /做样子/, /Vue2/, /NimoOS-UI/]

  it('REPLACE 表里每一个冻结分身都不含固定清单里的词', () => {
    for (const { path: rel } of REPLACE) {
      const s = read(rel)
      for (const bad of FORBIDDEN) expect(s, `${rel} :: ${bad}`).not.toMatch(bad)
    }
  })
})
