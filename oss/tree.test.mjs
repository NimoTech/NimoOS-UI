import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { REPLACE, PATCH } from './manifest.mjs'

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

describe('Class 1 · Wholesale removal', () => {
  it('oss/ itself not in artifacts', () => expect(exists('oss')).toBe(false))

  it('AI/photo/search components and stores all gone', () => {
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
      'src/settings/util/folderBrowser.ts',        // E3: zero consumers, changed to wholesale removal
      'src/settings/util/folderBrowser.test.ts',
      'src/home/util/isAssetId.ts',                // T7 tail-4: orphan after bindPhotos/PhotoTile removed
      // SP9-P7: search view entire directory. First 5 hit word list, last 4 don't hit at all ——
      // but useSearchQuery.ts imported buildSearchView, missing this is build artifact breakage (see build gate at file end).
      'src/home/search',
      'src/home/search/types.ts',
      'src/home/search/reasons.ts',
      'src/home/search/reasons.test.ts',
      'src/home/search/buildSearchView.ts',
      'src/home/search/buildSearchView.test.ts',
      'src/home/search/degrade.ts',
      'src/home/search/degrade.test.ts',
      'src/home/search/useSearchQuery.ts',
      'src/home/search/useSearchQuery.test.ts',
      // search domain in embedded shared package (SERVICE_DELETE)
      'packages/service/src/search.ts',
      'packages/service/src/search.test.ts',
    ]) expect(exists(rel), rel).toBe(false)
    // fish_video_poster.jpg not in above list: already deleted directly from private repo in final review cleanup batch
    // (private version also zero-reference orphan), no longer removed by this list, assertion "not in artifacts" already
    // eternally true, has no discriminative power.
  })

  it('reserved surfaces still there', () => {
    for (const rel of [
      'src/files/viewers/waveform.ts',                        // real waveform, decode PCM, unrelated to AI
      'src/settings/panels/account/MemberFoldersView.vue',    // member folder permissions
      'src/files/util/protect.ts',
      'src/apps/views/StorePage.vue',
      'scripts/deploy.sh',
      'public/widget-kit.css',
    ]) expect(exists(rel), rel).toBe(true)
  })

  it('documentation and AI dev-assist traces not exported wholesale (E7/E8)', () => {
    expect(exists('docs')).toBe(false)
    expect(exists('CLAUDE.md')).toBe(false)
    expect(exists('design-export')).toBe(false)
  })

  // ─── SP8-P6-T8 Review Important 2: ledger directory **existence** assertion ────────────────────
  // Why separate line, not combined with above:
  //   · Above line ~243 E9 case checks artifact tree **root .gitignore text content** doesn't contain
  //     '.superpowers/' — different from "is this directory in artifact tree", previously all oss/*.mjs
  //     **had no directory-existence assertions**.
  //   · T8 real test: Service repo's 32 ledgers always went into artifact tree via `git archive HEAD`,
  //     being caught purely luck — relied on 437 **word-list hits**. Day when ledger perfectly has no forbidden word
  //     (e.g. report just says "fix typo"), word-list guard turns green, stuff still goes public.
  //   · So criterion must be "directory exists or not", not "does it have sensitive words". **Each repo one case**:
  //     both ledgers responsible by different list entries (DELETE / SERVICE_DELETE), missing either is possible.
  // Mutation verification in p6-task-8-report.md §11: hand-create **forbidden-word-free**
  // packages/service/.superpowers/x.md, this assertion turns red while leak guard stays green — latter green is exactly
  // entire reason this assertion exists.
  it('ledger directories both repos can\'t enter artifact tree (existence criterion, independent of word-list)', () => {
    expect(exists('.superpowers'), 'New-UI side ledger entered artifact tree — DELETE list .superpowers entry ineffective').toBe(false)
    expect(exists('packages/service/.superpowers'),
      'Service side ledger entered artifact tree — SERVICE_DELETE list .superpowers entry ineffective').toBe(false)
  })
})

describe('Embedded shared package', () => {
  it('Service lands in packages/service/, package.json file: points there', () => {
    expect(exists('packages/service/src/index.ts')).toBe(true)
    expect(exists('packages/service/src/photos.ts')).toBe(false)
    const pkg = JSON.parse(read('package.json'))
    expect(pkg.dependencies['@nimotech/nimoos-service']).toBe('file:packages/service')
  })

  // After SP13 private repo itself writes file:packages/service, "doesn't contain NimoOS-Service" becomes eternally-true
  // assertion no path can violate (guard value zero). Changed to positive assertion: lockfile must really point to embedded package.
  it('lockfile points to embedded packages/service', () => {
    expect(read('pnpm-lock.yaml')).toContain('packages/service')
    expect(read('pnpm-lock.yaml')).not.toContain('NimoOS-Service')
  })
})

describe('Class 3 · Desktop-side patches', () => {
  it('system app list down to 6 (including terminal), photos/ai import and glyph all gone', () => {
    const s = read('src/home/apps/systemApps.ts')
    expect(s).not.toMatch(/photos|iconAi|G\.ai/)
    expect(s.match(/\{ key: '/g)).toHaveLength(6)
    for (const k of ['files', 'storage', 'vm', 'settings', 'appstore', 'terminal']) expect(s).toContain(`key: '${k}'`)
  })

  it('Dock default favorites = files/storage/vm/appstore', () => {
    expect(read('src/home/composables/useDock.ts'))
      .toContain("const DEFAULT_FAV = ['files', 'storage', 'vm', 'appstore']")
  })

  // I4(final-review pre-release required ③): cutoverDisabled is dead code (OSS has no old entry to fallback),
  // entire function along with call-site's always-false guard deleted, don't preserve "function shape".
  it('SYS_ROUTE points internal routes, cutoverDisabled dead code wholesale deleted, sendToAI completely gone', () => {
    const s = read('src/home/composables/useOpenAction.ts')
    expect(s).toContain("vm: '/kvm', settings: '/settings'")
    expect(s).not.toMatch(/sendToAI|'#\/photos'|ai\/agent|strangler:disabled|cutoverDisabled/)
    expect(s).toContain("if (key === 'appstore') { router.push('/apps/store'); return }")
    expect(s).toContain("if (key === 'storage') { router.push('/storage'); return }")
  })

  // SP9-P8: private version's settings / vm two tiles each carry one cutoverDisabled check. OSS has no flag,
  // and SYS_ROUTE already points these two keys to in-app routes — so artifacts shouldn't have those two ifs,
  // but must still be able to push them (via fallback at end). These two things assert together:
  // if only assert "no cutoverDisabled", patch could delete entire if-block with fallback also green.
  it('SP9-P8: OSS vm/settings tiles rely on SYS_ROUTE fallback push, artifacts have no fallback flag traces', () => {
    const s = read('src/home/composables/useOpenAction.ts')
    expect(s).toContain("router.push(SYS_ROUTE[key] || '/')")
    expect(s).not.toContain("key === 'settings'")
    expect(s).not.toContain("key === 'vm'")
    expect(s).not.toContain("key === 'photos'")
    // private version's comments about "fallback target / old desktop / resolveEntryTarget" backstory shouldn't leak
    expect(s).not.toMatch(/回退|legacy|resolveEntryTarget/)
  })

  // Test file side: two positive cases (settings→/settings、vm→/kvm) still apply in OSS so keep;
  // four cases related to flag / photos wholesale deleted. Dock's route-level case similarly keeps only positive.
  it('SP9-P8: useOpenAction.test.ts and HomeDock.test.ts keep only positive cases, flag cases all deleted', () => {
    const t = read('src/home/composables/useOpenAction.test.ts')
    expect(t).toContain("router.push /settings")
    expect(t).toContain("router.push /kvm")
    expect(t).not.toMatch(/strangler:disabled|回退 flag|逐条独立|反向隔离/)
    const d = read('src/home/components/HomeDock.test.ts')
    expect(d).toContain("expect(router.push).toHaveBeenCalledWith('/settings')")
    expect(d).not.toMatch(/strangler:disabled|回退|legacy|SP9-P8/)
  })

  it("Kind union type removes 'photo'", () => {
    expect(read('src/home/grid/types.ts'))
      .toContain("export type Kind = 'widget' | 'app' | 'folder' | 'appwidget'")
  })

  it('widget registry and WidgetCard no longer have ai', () => {
    expect(read('src/home/widgets/registry.ts')).not.toMatch(/\bai:/)
    expect(read('src/home/components/widgets/WidgetCard.vue')).not.toMatch(/AiWidget/)
  })

  it('GridItem / MobileHome no longer reference PhotoTile', () => {
    for (const rel of ['src/home/components/GridItem.vue', 'src/home/components/MobileHome.vue']) {
      expect(read(rel), rel).not.toMatch(/PhotoTile|'photo'|m-photo/)
    }
  })

  it('layout store removes bindPhotos, homeUi removes search four items', () => {
    expect(read('src/home/stores/layout.ts')).not.toMatch(/bindPhotos/)
    const h = read('src/home/stores/homeUi.ts')
    expect(h).not.toMatch(/searchOpen|setSearch|openSearch|closeSearch/)
  })

  it('topbar has no search capsule or ⌘K listener, Home.vue doesn\'t mount SearchDialog', () => {
    const t = read('src/home/components/HomeTopbar.vue')
    expect(t).not.toMatch(/search-btn|topbarSearch|metaKey/)
    const h = read('src/views/Home.vue')
    expect(h).not.toMatch(/SearchDialog|usePhotosStore|loadAssets|bindPhotos/)
  })

  it('AddPanel tab union type and size table remove photo', () => {
    const a = read('src/home/composables/useAddPanel.ts')
    expect(a).toContain("const curTab = ref<'widget' | 'app' | 'folder'>('widget')")
    expect(a).not.toMatch(/'photo'/)
  })

  it('review fix: topbar ≤720px comment no longer mentions "search", no dead imports', () => {
    const t = read('src/home/components/HomeTopbar.vue')
    expect(t).not.toMatch(/搜索/)
    expect(t).toContain('保留主题切换')
    expect(t).not.toMatch(/onMounted|onUnmounted/)
  })

  it('review fix: layout.ts no longer imports isAssetId', () => {
    expect(read('src/home/stores/layout.ts')).not.toMatch(/isAssetId/)
  })

  it('T7 tail-1: HomeTopbar no longer references homeUi (search button and ⌘K listener deleted by above patches)', () => {
    expect(read('src/home/components/HomeTopbar.vue')).not.toMatch(/homeUi/)
  })
})

describe('Class 3 · Settings and Service-side patches', () => {
  // SP17 起私有侧多了 lan-devices(第 10 个 tab,rail 里的第 8 项),这条断言的两个数字
  // 跟着往上挪一位;去掉的仍然只有 folder-permissions,数字本身不是要守的东西。
  it('settings tab down from 10 to 9, rail from 8 to 7, folder-permissions completely gone', () => {
    const s = read('src/settings/util/tabs.ts')
    expect(s).not.toMatch(/folder-permissions|FolderPermissions/)
    expect(s).toContain('SETTINGS_TABS.slice(0, 7)')
    expect(read('src/settings/panels/index.ts')).not.toMatch(/FolderPermissions/)
  })

  it('railTabsFor degenerates to identity (no longer filters by admin)', () => {
    const s = read('src/settings/util/tabs.ts')
    expect(s).toContain('export function railTabsFor(): readonly SettingsTab[] {')
    expect(s).not.toMatch(/role === 'admin'/)
  })

  it('SettingsShell.vue\'s sole call site signature changed, no longer passes role argument', () => {
    expect(read('src/settings/components/SettingsShell.vue'))
      .toContain('const railTabs = computed(() => railTabsFor())')
  })

  it('E2:systemConfig 不再有 search_switch', () => {
    expect(read('src/settings/util/systemConfig.ts')).not.toMatch(/search_switch/)
  })

  it('E13:Service 不再导出 photos / PhotoAsset', () => {
    const i = read('packages/service/src/index.ts')
    expect(i).not.toMatch(/createPhotos|PhotoAsset|get photos/)
    // SP9-P7:三处 search 接线(import / export type / getter)必须一起拆掉 ——
    // 只删 src/search.ts 而留着这三行,内嵌包直接构建失败,而词表守卫全绿。
    expect(i).not.toMatch(/createSearch|get search|NormalizedAggregate|SemanticHit|FileNameHit|ImageHit|NoteHit|SearchSource/)
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

describe('Class 3 · i18n and theme tokens', () => {
  // 2026-08-05(SP7-P8b):主文件改名 *.base.ts —— 原 zh_cn.ts/en_us.ts 现在是 3 行合并出口
  // (import base + import photos + 一行展开),相册那 702 键整块进了 *.photos.ts、由 DELETE 表
  // 删掉。故"键在不在"这类断言一律取 *.base.ts;出口本身没有键定义,另有专项断言(见下)。
  const LOCALES = ['src/i18n/zh_cn.base.ts', 'src/i18n/en_us.base.ts', 'src/i18n/zh_cn.sp9.ts', 'src/i18n/en_us.sp9.ts']

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
      // SP9-P7 搜索面板的 20 键(两个 sp9 分片)。SearchDialog.vue + src/home/search/**
      // 全部删除后无一消费方。
      'searchReasonFilename', 'searchReasonFilenameFuzzy', 'searchReasonBody',
      'searchReasonTranscript', 'searchReasonOcr', 'searchReasonCaption', 'searchReasonSemantic',
      'searchBadgeSemantic', 'searchBadgeFilename', 'searchBadgeOcr',
      'searchSourceSemantic', 'searchSourceImages', 'searchSourceFilenames', 'searchNoticePrefix',
      'searchEmptyNoMatch', 'searchEmptyNoRoots', 'searchEmptyNotReady',
      'searchErrorTitle', 'searchErrorHint', 'searchRetry',
    ]
    for (const f of LOCALES) for (const k of DEAD) expect(read(f), `${f} :: ${k}`).not.toContain(`${k}:`)
  })

  it('播放器控件键与商店筛选键保留', () => {
    for (const f of ['src/i18n/zh_cn.base.ts', 'src/i18n/en_us.base.ts']) {
      for (const k of ['audioSkipBack', 'audioSkipForward', 'audioSpeed', 'appsStoreSearch']) {
        expect(read(f), `${f} :: ${k}`).toContain(`${k}:`)
      }
    }
  })

  // SP7-P8b:相册文案的剥离方式是"删分片文件 + 摘出口那一行",两边都要钉。
  it('相册文案分片不在产物里,且出口已摘掉 photos 那一路', () => {
    expect(exists('src/i18n/zh_cn.photos.ts')).toBe(false)
    expect(exists('src/i18n/en_us.photos.ts')).toBe(false)
    for (const f of ['src/i18n/zh_cn.ts', 'src/i18n/en_us.ts']) {
      const src = read(f)
      expect(src, `${f} 还 import 着已删的分片`).not.toContain('.photos')
      expect(src, `${f} 的展开里还留着 photos`).not.toContain('...photos')
      // 出口仍必须是有效的合并(只剩 base 一路)
      expect(src).toContain('...base')
    }
  })

  it('产物里没有任何 /photos 路由与相册视图', () => {
    const router = read('src/router/index.ts')
    expect(router).not.toMatch(/\/photos/)
    expect(router).not.toMatch(/Photos/)
    for (const rel of ['src/photos', 'src/views/Photos.vue', 'src/views/PhotosSettings.vue',
      'src/views/__tests__/PhotosAlbums.test.ts']) {
      expect(exists(rel), rel).toBe(false)
    }
  })

  it('theme.css 里相册专用 token 组已删净(深浅两套都查)', () => {
    const css = read('src/styles/theme.css')
    for (const t of ['--photos-seg-video', '--photos-seg-raw', '--photos-seg-ai', '--photos-seg-other',
      '--badge-photo', '--badge-video', '--badge-ocr', '--album-cover-fallback', '--avatar-fallback',
      '--place-row-bg', '--pin-bg', '--pin-cluster-stroke', '--place-current-trip', '--place-home-base',
      '--map-dot-bg-fallback', '--float-bg', '--zb-hover-bg', '--zb-track-bg', '--zb-thumb-shadow',
      '--warn-fg', '--warn-bg', '--warn-border']) {
      expect(css, `theme.css 残留 ${t}`).not.toContain(`${t}:`)
    }
  })

  it('zh_cn 与 en_us 键数仍然相等(parity 的前置)', () => {
    const keys = (f) => (read(f).match(/^\s{2}[a-zA-Z][a-zA-Z0-9]*:/gm) || []).length
    expect(keys('src/i18n/zh_cn.base.ts')).toBe(keys('src/i18n/en_us.base.ts'))
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

describe('Class 2 · Desktop default layout', () => {
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

describe('Class 2 · AddPanel remove photo tab', () => {
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

describe('Class 2 · MediaViewer remove transcripts', () => {
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

describe('Class 2 · README', () => {
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

describe('Class 2 · Frozen copy comments don\'t leak internal dev state', () => {
  // 固定清单(每次新增 REPLACE 条目都要过一遍,别为单个文件重开断言):
  // 内部任务追踪编号 / 期号 / 分支代号 / spec 章节号 / 分期开发措辞 / 旧版本代号 / 私有仓名。
  // T14(B4):/SP\d/i 原来没有 \b 词边界,会误伤 "wasp7"/"grasp789" 这类纯属巧合含有
  // "sp" + 数字子串的英文单词——当前仓库里恰好零命中,但这是隐患,不是等出现了再补。
  // I5-guard(final-review 发布前必修 ⑤):补三条词(开源版/本版/社区版 —— ④ 的教训)
  // + strangler/cutover(③ 的教训),并把 NimoOS-UI 放宽到能抓 NimoOS-New-UI
  // (原正则是精确子串匹配,"NimoOS-New-UI" 不含 "NimoOS-UI" 这个连续子串,抓不到)。
  // (?!\.ts) 沿用下方"复审第二轮"用例(:287-288)已经裁定的同一条豁免:zh_cn.sp9.ts /
  // en_us.sp9.ts 互相指代对方文件名本身是合法引用,不是内部期号泄漏——这两个文件名
  // 本身带 sp9(M11,已裁定的范围外大类,产出树文件名洗期号是独立一期的工作),
  // 把断言作用域扩到 PATCH 的 replace payload 后(见下方 b 部分),这条豁免必须同步
  // 搬过来,否则会对一个已经裁定"不算泄漏"的地方误报。
  const FORBIDDEN = [/Task \d/, /\bSP\d(?!\.ts)/i, /\bsp[789]\b(?!\.ts)/i, /spec §/, /本期/, /做样子/, /Vue2/,
                     /NimoOS-(New-)?UI/, /开源版?/, /本版/, /社区版/, /strangler/i, /cutover/i]

  it('REPLACE 表里每一个冻结分身都不含固定清单里的词', () => {
    for (const { path: rel } of REPLACE) {
      const s = read(rel)
      for (const bad of FORBIDDEN) expect(s, `${rel} :: ${bad}`).not.toMatch(bad)
    }
  })

  // I5-guard 第 2 部分:REPLACE 只覆盖 4 个冻结分身,PATCH 写入产出树的内容此前完全
  // 不受这条守卫约束(I5b 的"本版"就是这么从 IDX 6 的 replace payload 里漏出去的)。
  it('PATCH 的 replace 内容也不含固定清单里的词', () => {
    for (const [i, p] of PATCH.entries()) {
      for (const bad of FORBIDDEN) {
        expect(String(p.replace), `PATCH[${i}] ${p.path} :: ${bad}`).not.toMatch(bad)
      }
    }
  })

  // T14(B4):直接对着正则做边界测试,不依赖"仓库里恰好有没有这种词"——
  // wasp7/grasp789 这类词缀撞车的英文单词必须放行,真实的 SP9/sp7 提法必须仍然命中。
  it('/\\bSP\\d/i 词边界:wasp7/grasp789 不误伤,真实 SP9/sp7 仍然命中', () => {
    const SP_DIGIT = /\bSP\d/i
    for (const text of ['a wasp7 crawled by', 'grasp789 the concept', 'crisp42 response']) {
      expect(SP_DIGIT.test(text), text).toBe(false)
    }
    for (const text of ['SP9 收尾视图', 'this is sp7 photos work', '(SP8)']) {
      expect(SP_DIGIT.test(text), text).toBe(true)
    }
  })
})

describe('Class 4 · Test synchronization', () => {
  it('被删功能的测试文件整体不在', () => {
    for (const rel of [
      'src/home/components/PhotoTile.test.ts',
      'src/home/components/SearchDialog.test.ts',
      'src/home/components/widgets/AiWidget.test.ts',
      'src/home/stores/photos.test.ts',
      'src/files/viewers/speakerWave.test.ts',
      'src/settings/panels/FolderPermissionsPanel.test.ts',
      'src/settings/util/folderPermissions.test.ts',
      'src/settings/util/folderPermissionsSnapshot.test.ts',
      'src/settings/util/folderPermissionsView.test.ts',
      // 不是 DELETE 表单独一条 —— 整个 'src/settings/panels/folderPerm' 目录已删
      'src/settings/panels/folderPerm/FolderPickerDialog.test.ts',
      'packages/service/src/photos.test.ts',
    ]) expect(exists(rel), rel).toBe(false)
  })

  it('混合型测试文件保留,但里面不再提被删的东西', () => {
    for (const rel of [
      'src/home/components/HomeTopbar.test.ts',
      'src/home/components/MobileHome.test.ts',
      'src/home/components/GridItem.click.test.ts',
      'src/home/composables/useDock.test.ts',
      'src/home/composables/useDock.reorder.test.ts',
      'src/home/composables/useOpenAction.test.ts',
      'src/home/grid/defaultLayout.test.ts',
      'src/home/stores/homeUi.test.ts',
      'src/home/components/HomeDock.test.ts',
      'src/settings/components/SettingsShell.test.ts',
      'src/settings/panels/panels.test.ts',
      'src/settings/panels/AppsPanel.test.ts',
      'src/settings/util/appPaths.test.ts',
      'src/settings/util/tabs.test.ts',
      'src/apps/stores/installedApps.test.ts',
      'src/apps/util/systemApp.test.ts',
      'src/home/util/eventMap.test.ts',
      'src/views/Home.integration.test.ts',
      'src/stores/locale.test.ts',
    ]) {
      expect(exists(rel), rel).toBe(true)
      const s = read(rel)
      for (const bad of ['PhotoTile', 'SearchDialog', 'AiWidget', 'usePhotosStore',
                         'search_switch', 'FolderPermissionsPanel', 'folderPermissions',
                         'sendToAI', "kind: 'photo'", 'photos_data', '相册']) {
        expect(s, `${rel} :: ${bad}`).not.toContain(bad)
      }
      // UserFolderPermission(成员文件夹授权)是保留面,不在上面的禁列里 —— 见 E4
    }
  })

  it('tabs.test.ts 不再以旧签名调用 railTabsFor(role),tab 计数跟着降', () => {
    const s = read('src/settings/util/tabs.test.ts')
    expect(s).not.toMatch(/railTabsFor\(/) // 按角色过滤的三条用例已随功能一起删除
    expect(s).not.toContain('folder-permissions')
    expect(read('src/settings/panels/panels.test.ts')).toContain('toHaveLength(9)')
  })

  it('复审:HomeDock/SettingsShell 两个实测才暴露的漏网之鱼(brief 原始清单未覆盖)', () => {
    const dock = read('src/home/components/HomeDock.test.ts')
    expect(dock).not.toMatch(/hrefs\[0\]\)\.toBe\('\/#\/legacy'\)/) // settings 已改 router.push
    expect(dock).toContain("expect(router.push).toHaveBeenCalledWith('/settings')")
    expect(dock).not.toContain('toBeGreaterThanOrEqual(6)') // oss 只有 5 个系统应用
    const shell = read('src/settings/components/SettingsShell.test.ts')
    expect(shell).not.toContain('folder-permissions')
    // 8 was the admin-only rail count (deleted along with its test block); 7 is the
    // legitimate universal rail count post-redaction (SP17 added lan-devices) and is
    // expected to remain in the other, untouched assertions.
    expect(shell).not.toMatch(/toHaveLength\(8\)/)
  })

  it('内嵌 Service 不依赖预构建 dist/:package.json 指向 TS 源码入口', () => {
    const pkg = JSON.parse(read('packages/service/package.json'))
    expect(pkg.main).toBe('./src/index.ts')
    expect(pkg.exports['.'].import).toBe('./src/index.ts')
    expect(pkg.files).toEqual(['src'])
    expect(exists('packages/service/dist')).toBe(false) // 从不依赖它存在
  })

  it('useDock 相关测试不再引用 photos/ai 这两个已删的系统应用 key', () => {
    for (const rel of ['src/home/composables/useDock.test.ts', 'src/home/composables/useDock.reorder.test.ts']) {
      const s = read(rel)
      expect(s, rel).not.toContain("'photos'")
      expect(s, rel).not.toContain("'ai'")
    }
  })

  it('defaultLayout.test.ts 的 widget 计数降到 6(ai 小组件已删)', () => {
    expect(read('src/home/grid/defaultLayout.test.ts')).toContain('for the 6 widgets')
  })
})

// ─── T14:泄漏守卫真正接进导出流程(Task 14 brief §Step 1)────────────────────
describe('泄漏守卫', () => {
  it('不带 --skip-guard 也能跑通', () => {
    const guardOut = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-guard-'))
    try {
      // --allow-dirty-oss:见 export.mjs 里的注释,只放行 oss/ 下的未提交改动(开发期
      // 迭代常态),不削弱 checkClean 对 src/** 的检查——同验收标准 §11 第 4 条的调用形式。
      const out = execFileSync('node', [path.join(OSS, 'export.mjs'), '--out', guardOut,
        '--no-commit', '--allow-dirty-oss'],
        { encoding: 'utf8', stdio: 'pipe' })
      expect(out).toContain('零真实泄漏命中')
    } finally {
      fs.rmSync(guardOut, { recursive: true, force: true })
    }
  }, 180_000)

  it('手工抽查:产出树里一律扫不到相册/Nimo AI/transcript/qdrant/内网 IP(独立于 forbidden.mjs 词表的第二重验证)', () => {
    const hits = []
    const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'node_modules') continue
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(ts|vue|css|json|md|svg|html|yaml|sh)$/.test(e.name)) {
        const t = fs.readFileSync(p, 'utf8')
        if (/相册|nimo ai|transcript|qdrant|192\.168\.1\.115/i.test(t)) hits.push(path.relative(tree, p))
      }
    } }
    walk(tree)
    expect(hits).toEqual([])
  })
})

// ─── 产物树能构建(SP9-P7 终审 F2 新增)──────────────────────────────────────
// 为什么需要这道门:上面所有守卫 —— forbidden.mjs 的词表、tree.test.mjs 的字符串断言、
// "手工抽查"的第二重 grep —— **全都只扫词**。它们能回答"产物里还有没有不该有的字",
// 回答不了"产物还能不能用"。SP9-P7 剥离时真实踩到的坑正是后者:
//   · src/home/search/ 九个文件里,词表只命中五个;剩下的 useSearchQuery.ts 第 3 行
//     import 了会被删掉的 buildSearchView —— 只删命中的那批,词表绿、tree 测试绿,
//     产物却连类型检查都过不去。
//   · packages/service/src/index.ts 的三处 search 接线同理:只删 src/search.ts 不打补丁,
//     内嵌共享包直接构建失败,而所有扫词类守卫依旧全绿。
// 判据因此定成"产物树能构建",不是"词表不命中"。
describe('产物树能构建', () => {
  it('pnpm install + vue-tsc --noEmit 在产物树上全绿(只扫词的守卫抓不到构建断裂)', () => {
    const run = (file, args, what) => {
      try {
        execFileSync(file, args, { cwd: tree, stdio: 'pipe', encoding: 'utf8', env: { ...process.env, CI: '' } })
      } catch (e) {
        // stdio:'pipe' 会把编译器输出吞进子进程,不手动带出来的话只剩一句
        // "Command failed",诊断价值为零 —— 本项目的纪律是"错误消息本身就是产品"。
        throw new Error(`产物树 ${what} 失败:\n${e.stdout || ''}${e.stderr || ''}`)
      }
    }
    // --prefer-offline:本机 pnpm store 命中时约 1s;冷 store 才会回落到网络。
    // --no-frozen-lockfile:产物树的 lockfile 刚被 export.mjs 改写过 file: 路径,
    //   CI 环境下 pnpm 默认 --frozen-lockfile 会因此拒绝安装。
    run('pnpm', ['install', '--prefer-offline', '--ignore-scripts', '--no-frozen-lockfile'], 'pnpm install')
    run('pnpm', ['exec', 'vue-tsc', '--noEmit'], 'vue-tsc --noEmit')
  }, 600_000)
})
