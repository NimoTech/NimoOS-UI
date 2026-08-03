import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

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
})
