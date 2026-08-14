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
      'src/home/util/isAssetId.ts',                // T7 尾巴4:bindPhotos/PhotoTile 都没了之后的孤儿
      // SP9-P7:搜索视图层整目录。前 5 个是词表命中的,后 4 个词表一个都不命中 ——
      // 但 useSearchQuery.ts import 了 buildSearchView,漏删就是产物构建断裂(见文件末尾的构建门)。
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
      // 内嵌共享包的 search 域(SERVICE_DELETE)
      'packages/service/src/search.ts',
      'packages/service/src/search.test.ts',
    ]) expect(exists(rel), rel).toBe(false)
    // fish_video_poster.jpg 不在上面这张表里:它已于终审 cleanup 批从私有仓直接删除
    // (私有版也是零引用孤儿),不再由本清单剥离,断言它"不在产物里"已经恒真、没有判别力。
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

  // ─── SP8-P6-T8 复审 Important 2:台账目录的**存在性**断言 ────────────────────
  // 为什么单列一条、而不是并进上面那条:
  //   · 上面第 243 行附近那条 E9 用例查的是产物树**根 .gitignore 的文本内容**里不含
  //     '.superpowers/' —— 那和「这个目录在不在产物树里」是两码事,此前全部 oss/*.mjs
  //     里**没有任何一条目录存在性断言**。
  //   · T8 实测:Service 仓的 32 份台账此前一直随 `git archive HEAD` 进产物树,能被发现
  //     纯属侥幸 —— 靠的是那 437 处**词表命中**。台账里恰好一个禁词都不含的那天(比如
  //     一份只写 "fix typo" 的报告),词表守卫会全绿,东西照样上公网。
  //   · 所以判据必须是「目录在不在」,不能是「里面有没有敏感词」。两个仓**各要一条**:
  //     两处台账由两条不同的清单条目(DELETE / SERVICE_DELETE)负责,漏哪条都可能。
  // 变异验证见 p6-task-8-report.md §11:手工造一个**不含任何禁词**的
  // packages/service/.superpowers/x.md,本条断言报红而泄漏守卫照样绿 —— 后者绿正是
  // 本条断言存在的全部理由。
  it('台账目录两个仓都不能进产物树(存在性判据,不依赖词表)', () => {
    expect(exists('.superpowers'), 'New-UI 侧台账进了产物树 —— DELETE 表的 .superpowers 条目没生效').toBe(false)
    expect(exists('packages/service/.superpowers'),
      'Service 侧台账进了产物树 —— SERVICE_DELETE 表的 .superpowers 条目没生效').toBe(false)
  })
})

describe('内嵌共享包', () => {
  it('Service 落到 packages/service/,package.json 的 file: 指过去', () => {
    expect(exists('packages/service/src/index.ts')).toBe(true)
    expect(exists('packages/service/src/photos.ts')).toBe(false)
    const pkg = JSON.parse(read('package.json'))
    expect(pkg.dependencies['@nimotech/nimoos-service']).toBe('file:packages/service')
  })

  // SP13 之后私有仓本身就写 file:packages/service,「不含 NimoOS-Service」变成没有任何
  // 路径能违反的恒真断言(守卫价值归零)。改成正向断言:锁文件必须真的指到内嵌包。
  it('lockfile 指向内嵌的 packages/service', () => {
    expect(read('pnpm-lock.yaml')).toContain('packages/service')
    expect(read('pnpm-lock.yaml')).not.toContain('NimoOS-Service')
  })
})

describe('类 3 · 桌面侧补丁', () => {
  it('系统应用清单只剩 6 个(含 terminal),photos/ai 的 import 与 glyph 都没了', () => {
    const s = read('src/home/apps/systemApps.ts')
    expect(s).not.toMatch(/photos|iconAi|G\.ai/)
    expect(s.match(/\{ key: '/g)).toHaveLength(6)
    for (const k of ['files', 'storage', 'vm', 'settings', 'appstore', 'terminal']) expect(s).toContain(`key: '${k}'`)
  })

  it('Dock 默认收藏 = files/storage/vm/appstore', () => {
    expect(read('src/home/composables/useDock.ts'))
      .toContain("const DEFAULT_FAV = ['files', 'storage', 'vm', 'appstore']")
  })

  // I4(final-review 发布前必修 ③):cutoverDisabled 是死代码(开源版没有旧入口可回退),
  // 整个函数连同调用点的恒 false 守卫一并删掉,不再保留"函数形状"。
  it('SYS_ROUTE 指内部路由,cutoverDisabled 死代码整块删除,sendToAI 整个没了', () => {
    const s = read('src/home/composables/useOpenAction.ts')
    expect(s).toContain("vm: '/kvm', settings: '/settings'")
    expect(s).not.toMatch(/sendToAI|'#\/photos'|ai\/agent|strangler:disabled|cutoverDisabled/)
    expect(s).toContain("if (key === 'appstore') { router.push('/apps/store'); return }")
    expect(s).toContain("if (key === 'storage') { router.push('/storage'); return }")
  })

  // SP9-P8:私有版的 settings / vm 两个磁贴各带一条 cutoverDisabled 判定。开源版没有 flag,
  // 而 SYS_ROUTE 已经把这两个 key 指向应用内路由 —— 所以产物里既不该有那两个 if,
  // 也必须仍然能把它们 push 出去(靠末尾那句兜底)。这两件事要一起断言:
  // 只断言"没有 cutoverDisabled"的话,补丁把整段 if 连兜底一起删掉也照样绿。
  it('SP9-P8:开源版 vm/settings 磁贴靠 SYS_ROUTE 兜底 push,且产物里不留任何回退 flag 痕迹', () => {
    const s = read('src/home/composables/useOpenAction.ts')
    expect(s).toContain("router.push(SYS_ROUTE[key] || '/')")
    expect(s).not.toContain("key === 'settings'")
    expect(s).not.toContain("key === 'vm'")
    expect(s).not.toContain("key === 'photos'")
    // 私有版注释里那段"回退目标 / 老桌面 / resolveEntryTarget"的来龙去脉也不该外泄
    expect(s).not.toMatch(/回退|legacy|resolveEntryTarget/)
  })

  // 测试文件侧:两条正向用例(settings→/settings、vm→/kvm)在开源版依然成立故保留;
  // 四条与 flag / photos 相关的整块删除。dock 那条链路级用例同理只保留正向。
  it('SP9-P8:useOpenAction.test.ts 与 HomeDock.test.ts 只留正向用例,flag 用例全删', () => {
    const t = read('src/home/composables/useOpenAction.test.ts')
    expect(t).toContain("router.push /settings")
    expect(t).toContain("router.push /kvm")
    expect(t).not.toMatch(/strangler:disabled|回退 flag|逐条独立|反向隔离/)
    const d = read('src/home/components/HomeDock.test.ts')
    expect(d).toContain("expect(router.push).toHaveBeenCalledWith('/settings')")
    expect(d).not.toMatch(/strangler:disabled|回退|legacy|SP9-P8/)
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
    // 2026-08-14:私有侧这条注释已译成英文,断言跟着换成英文措辞(语义不变:
    // 不能提搜索,只提主题切换)。
    expect(t).not.toMatch(/搜索|search/i)
    expect(t).toContain('keep the theme toggle')
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
  // SP17 起私有侧多了 lan-devices(第 10 个 tab,rail 里的第 8 项),这条断言的两个数字
  // 跟着往上挪一位;去掉的仍然只有 folder-permissions,数字本身不是要守的东西。
  it('设置 tab 从 10 降到 9,rail 从 8 降到 7,folder-permissions 全无', () => {
    const s = read('src/settings/util/tabs.ts')
    expect(s).not.toMatch(/folder-permissions|FolderPermissions/)
    expect(s).toContain('SETTINGS_TABS.slice(0, 7)')
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

describe('类 3 · i18n 与主题 token', () => {
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

describe('类 4 · 测试同步', () => {
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
