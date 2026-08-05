import path from 'node:path'

// ⚠️ 关于范围(E10):用户 2026-08-04 拍板 —— sp7-photos / sp8-ai 两支在快照发布后
// 仍要合进 master。本清单目前只覆盖 master 上的 AI/相册残留面;两支合流后必须为
// src/photos/** 与 src/ai/** 两个完整功能区扩张(路由、i18n 分片、数十个测试文件)。
// 单源 + 导出脚本这套架构正是为此选的,不要退回一次性快照。

const HERE = path.dirname(new URL(import.meta.url).pathname)
export const OSS_DIR = HERE
export const NEW_UI = path.resolve(HERE, '..')
export const SERVICE = path.resolve(HERE, '../../NimoOS-Service')
export const DEFAULT_OUT = path.resolve(HERE, '../../NimoOS-Web')

// 主工作树 index 里长期躺着 3 个 design-export/* 的删除态,不属任何一方(spec §10.3)
export const DIRTY_ALLOW = [/design-export\//]

/** 类 1 · 整体删除。路径不存在即 exit 1(清单过期了要知道)。 */
export const DELETE = [
  'oss',                                  // 第一条:机制自己不进产物

  // 主页:搜索面板 / 照片磁贴 / AI 组件
  'src/home/components/SearchDialog.vue',
  'src/home/components/PhotoTile.vue',
  'src/home/components/widgets/AiWidget.vue',
  'src/home/stores/photos.ts',
  'src/home/apps/icons/photos.svg',
  'src/home/apps/icons/ai.svg',
  // 零消费方孤儿工具(T6 删完 bindPhotos、PhotoTile.vue 已在本表):
  // src/home/stores/photos.test.ts 仍直接 import 它,但那份测试本身是
  // "测试同步:整体删除的 9 个"之一(T13 填齐),不在本任务改动范围。
  'src/home/util/isAssetId.ts',

  // 音频转录(waveform.ts 保留 —— 它解码 PCM 画真实波形,不涉 AI)
  'src/files/viewers/audioTranscripts.ts',
  'src/files/viewers/speakerWave.ts',

  // 设置「文件夹权限」整个 tab。folderBrowser 删完后零消费方(E3),一并删
  'src/settings/panels/FolderPermissionsPanel.vue',
  'src/settings/panels/folderPerm',
  'src/settings/util/folderPermissions.ts',
  'src/settings/util/folderPermissionsSnapshot.ts',
  'src/settings/util/folderPermissionsView.ts',
  'src/settings/util/folderBrowser.ts',
  'src/settings/util/folderBrowser.test.ts',

  // 文档 / AI 辅助开发痕迹 / 设计稿(E7/E8:用户拍板一份文档都不带)
  'docs',
  'CLAUDE.md',
  'design-export',

  // 各期台账(2026-08-05 起入库,见 .superpowers/.gitignore)。282 份报告里写满了
  // 内部决策、后端接口实测、AI/相册/搜索的设计过程 —— 属于 E7「一份文档都不带」的范围,
  // 只是它在 08-05 之前是 gitignore 的、git archive 拿不到,所以从前不用列。
  '.superpowers',

  // SP9-P7:搜索面板的视图层纯函数模块 + composable。唯一消费方 SearchDialog.vue /
  // SearchDialog.test.ts 都在本表里,整目录零消费方。
  // ⚠️ 必须整目录删,不能只删词表命中的那几个:词表(forbidden.mjs 的 search 条目)只
  //    命中 types.ts / reasons.ts / reasons.test.ts / buildSearchView.ts /
  //    buildSearchView.test.ts,而 degrade.ts / degrade.test.ts / useSearchQuery.ts /
  //    useSearchQuery.test.ts 一个词都不命中 —— 偏偏 useSearchQuery.ts 第 3 行
  //    `import { buildSearchView } from './buildSearchView'`。只删命中的那批,产出树
  //    的类型检查与测试必红,而泄漏守卫和 tree 测试全绿(它们只扫词、不构建产物)。
  //    这正是 tree.test.mjs 末尾那道"产物树能构建"门存在的理由。
  'src/home/search',

  // ═══ SP7-P8b 合流(2026-08-05):相册区整块不进开源版 ═══════════════════════
  // 本表开篇那条"两支合流后必须为 src/photos/** 扩张"的备注,兑现的就是这一段。
  // 相册面 = 一个域目录 + 13 个视图 + 16 个视图测试 + 2 个 i18n 分片 + 1 道分片守卫。
  // ⚠️ 逐条列、不用通配:DELETE 路径不存在即 exit 1,清单过期时要能立刻知道
  //    (2026-08-05 清点结果:`ls src/views | grep -i photo` = 13、
  //     `ls src/views/__tests__ | grep -i photo` = 16)。
  'src/photos',                                   // 组件/store/composable/灯箱/util 全区
  // i18n 分片:702 个 photos* 键。它们当初就是为了能在这里一行删掉才从主文件拆出来的
  // (拆之前散在 90 多个区段,剥它们要约 90 条锚点补丁 × 2 语言,改一条文案就打红导出)。
  'src/i18n/zh_cn.photos.ts',
  'src/i18n/en_us.photos.ts',
  'src/i18n/__tests__/photosSlice.test.ts',       // 守的是分片本身,分片没了它就无意义
  // 这两份是**纯相册键**的 i18n 守卫(P8a 的 71 键清单 / P5 人物键抽样),分片删掉之后
  // 它们断言的键一个都不存在,留着必红。
  'src/i18n/__tests__/p8aKeys.test.ts',
  'src/i18n/__tests__/people.i18n.test.ts',
  // 13 个视图
  'src/views/Photos.vue',
  'src/views/PhotosAlbumDetail.vue',
  'src/views/PhotosAlbums.vue',
  'src/views/PhotosFavorites.vue',
  'src/views/PhotosPeople.vue',
  'src/views/PhotosPersonDetail.vue',
  'src/views/PhotosPlaceAssets.vue',
  'src/views/PhotosPlaces.vue',
  'src/views/PhotosSearch.vue',
  'src/views/PhotosSettings.vue',
  'src/views/PhotosSmartViewDetail.vue',
  'src/views/PhotosSmartViews.vue',
  'src/views/PhotosTrash.vue',
  // 16 个视图测试
  'src/views/__tests__/Photos.integration.test.ts',
  'src/views/__tests__/Photos.lightbox.test.ts',
  'src/views/__tests__/Photos.route.test.ts',
  'src/views/__tests__/PhotosAlbumDetail.test.ts',
  'src/views/__tests__/PhotosAlbums.test.ts',
  'src/views/__tests__/PhotosFavorites.test.ts',
  'src/views/__tests__/photosGlassSurfaces.test.ts',
  'src/views/__tests__/photosLayoutHeightCap.test.ts',
  'src/views/__tests__/PhotosPeople.test.ts',
  'src/views/__tests__/PhotosPersonDetail.test.ts',
  'src/views/__tests__/PhotosPlaceAssets.test.ts',
  'src/views/__tests__/PhotosPlaces.test.ts',
  'src/views/__tests__/PhotosSearch.test.ts',
  'src/views/__tests__/PhotosSettings.test.ts',
  'src/views/__tests__/PhotosSmartViewDetail.test.ts',
  'src/views/__tests__/PhotosSmartViews.test.ts',
  'src/views/__tests__/PhotosTrash.test.ts',

  // (搜索 demo 的鱼 public/demo/fish_video_poster.jpg 已于终审 cleanup 批从私有仓
  //  直接删除 —— 它在私有版也是零引用的孤儿,不必再由本清单剥离。DELETE 条目路径
  //  不存在会 exit 1,所以这条必须一并撤掉。)

  // 测试同步:整体删除的 9 个孤儿测试(T13;每个都已核实其唯一/主要消费的模块已在
  // 上面 DELETE 掉,不是"混合型",不能靠 PATCH 抠用例保留部分覆盖率——见 task-13-report.md)
  'src/home/stores/photos.test.ts',                       // import photos.ts(已删)+ isAssetId.ts(已删)
  'src/home/components/PhotoTile.test.ts',                // import PhotoTile.vue(已删)
  'src/home/components/SearchDialog.test.ts',             // import SearchDialog.vue(已删)
  'src/home/components/widgets/AiWidget.test.ts',         // import AiWidget.vue(已删)
  'src/files/viewers/speakerWave.test.ts',                // import speakerWave.ts(已删)
  'src/settings/panels/FolderPermissionsPanel.test.ts',   // import FolderPermissionsPanel.vue(已删)
  'src/settings/util/folderPermissions.test.ts',          // import folderPermissions.ts(已删)
  'src/settings/util/folderPermissionsSnapshot.test.ts',  // import folderPermissionsSnapshot.ts(已删)
  'src/settings/util/folderPermissionsView.test.ts',      // import folderPermissionsView.ts(已删)
  // FolderPickerDialog.test.ts 不用单列:它在 'src/settings/panels/folderPerm'(上面已整目录删除)里面。
]

/** Service 侧的整体删除(相对 packages/service/)。 */
export const SERVICE_DELETE = [
  'src/photos.ts',
  'src/photos.test.ts',
  // SP7-P8b 合流(2026-08-05):P0 把 photos 域从 4 个方法扩到 60+,测试也跟着按子域拆成
  // 6 个文件。旧清单只列了 photos.test.ts,这 6 个是新增的 —— 漏了它们,内嵌共享包里会
  // 留下整套相册接口测试(泄漏守卫实测命中 303 处,过半出自这里)。
  'src/photos.albums.test.ts',
  'src/photos.favorites.test.ts',
  'src/photos.persons.test.ts',
  'src/photos.places.test.ts',
  'src/photos.uploads.test.ts',
  'src/photos.views.test.ts',
  // SP9-P7:search 域(agentTool 四源聚合 + 归一化)。开源版没有 Search/AI 服务,
  // 唯一消费方是已删的 SearchDialog.vue / src/home/search/**。
  // 光删这两个文件不够 —— index.ts 里还有三处接线(见下方 SERVICE_PATCH),
  // 不打那三个补丁的话内嵌共享包直接构建失败,而词表守卫与 tree 测试全绿。
  'src/search.ts',
  'src/search.test.ts',
]

/** 类 2 · 整文件替换,各带私有侧哈希钉。T10-T13 填。 */
export const REPLACE = [
  // T9:桌面默认布局重排(开源版无照片磁贴/AI 组件,坐标整体重排,PATCH 无可继承内容)
  { path: 'src/home/grid/defaultLayout.ts', from: 'defaultLayout.ts',
    privateSha256: '15da0c4b305f9cdf5cee5ce6a8126cc441d18a889eadc28681ee1b14785e87ed' },

  // T10:MediaViewer 拆转录面板(摘要/转录/Ask 三 tab、说话人分色、章节过滤全删;
  // 保留自绘播放器 + 真实波形 + 视频/图片通路 + 封面元数据)
  { path: 'src/files/viewers/MediaViewer.vue', from: 'MediaViewer.vue',
    privateSha256: 'a82ed56d908a27a0a00f4fa325c3d2d300fb551c453202af18732a8e88944031' },

  // T11:AddPanel 去照片 tab(模板块 + tab 定义 + usePhotosStore 声明/import +
  // .lib-photo-* 样式四处一并删除;409 行附近 ic-photos 注释改泛化措辞)
  { path: 'src/home/components/AddPanel.vue', from: 'AddPanel.vue',
    privateSha256: '948b9dcae47cef319b93342e551a4f1dd65e358c63174df525dd457f44d656fe' },

  // T12:README 重写(面向外部开发者,私有版讲的是与 Vue 2 并存/绞杀迁移/同级克隆
  // Service —— 受众不同且后两条在开源包里都是假的,没有可继承内容,整文件替换)
  { path: 'README.md', from: 'README.md',
    privateSha256: 'ae7e30a5e63f2c66af4e0ecbf7a08cd5500aec89e9d2de86d6db05b2b79027aa' },
]

/** 类 3 · 锚点补丁。命中次数必须恰好 1 次。T6-T9 填。 */
export const PATCH = [
  // ═══════════════════ T6:桌面(home)侧 ═══════════════════════════════════

  // ── systemApps.ts:去 photos / ai 两条系统应用 + import + glyph ──────────
  { path: 'src/home/apps/systemApps.ts',
    find: "import iconPhotos from './icons/photos.svg'\nimport iconAi from './icons/ai.svg'\n",
    replace: '' },
  { path: 'src/home/apps/systemApps.ts',
    find: "  photos: '<rect x=\"3.5\" y=\"4.5\" width=\"17\" height=\"15\" rx=\"3\"/><circle cx=\"8.8\" cy=\"9.3\" r=\"1.5\"/><path d=\"m4 17 5-4 3.5 2.6L16 13l4.5 3.5\"/>',\n",
    replace: '' },
  { path: 'src/home/apps/systemApps.ts',
    find: "  ai: '<path d=\"M12 3.5c.45 3.3 1.7 4.55 5 5-3.3.45-4.55 1.7-5 5-.45-3.3-1.7-4.55-5-5 3.3-.45 4.55-1.7 5-5Z\"/>',\n",
    replace: '' },
  { path: 'src/home/apps/systemApps.ts',
    find: "  { key: 'photos', name: 'Photos', label: 'appPhotos', cls: 'ic-photos', glyph: G.photos, icon: iconPhotos },\n  { key: 'ai', name: 'AI', label: 'appAi', cls: 'ic-ai', glyph: G.ai, icon: iconAi },\n",
    replace: '' },

  // ── useDock.ts:DEFAULT_FAV 换成开源版的 4 项(补上 storage —— 它在开源版
  //    的默认桌面上没有磁贴,Dock 是唯一入口) ─────────────────────────────
  { path: 'src/home/composables/useDock.ts',
    find: "const DEFAULT_FAV = ['files', 'photos', 'ai', 'vm', 'appstore']",
    replace: "const DEFAULT_FAV = ['files', 'storage', 'vm', 'appstore']" },

  // ── useOpenAction.ts:SYS_ROUTE 拍成内部路由(§8.2 的有意偏离)──────────
  { path: 'src/home/composables/useOpenAction.ts',
    find: `// 文件区(/files,SP4-P8)、应用区(/apps,SP5-P8)、存储区(/storage,SP6-P1)与相册区
// (/photos,SP7-P8b)已活在本应用;其余系统入口仍指 Vue2,各自 SP 迁移时再改。
// photos 这条留在表里不是死键 —— cutover 回退时(flag 置 1)就跳它,所以它是"回退目标"
// 而不是"主路径";这也是它与 appstore/storage 的区别(那两个在 Vue2 侧是模态弹窗、没有
// 自己的路由,回退只能落 /#/legacy 老桌面,故表里从来就没有它们的条目)。
// router 模块环(router→Home→…→本文件)只在运行时访问 push,ESM 延迟绑定安全。
const SYS_ROUTE: Record<string, string> = {
  photos: '/#/photos', ai: '/#/ai/agent', vm: '/#/kvm',
  settings: '/#/legacy',
}`,
    replace: `// 系统入口全部活在本应用内。
// router 模块环(router→Home→…→本文件)只在运行时访问 push,ESM 延迟绑定安全。
const SYS_ROUTE: Record<string, string> = {
  vm: '/kvm', settings: '/settings',
}` },
  { path: 'src/home/composables/useOpenAction.ts',
    find: `// 回退 flag(与 Vue2 strangler.js 的 strangler:disabled:<from> 命名一致):
// == '1' 时磁贴退回 Vue2 /#/legacy 老桌面,可逆 cutover。
// /apps = SP5-P8;/storage = SP6-P6(Vue2 桌面那三个存储入口共用同一把键,
// 同源共享 localStorage,所以置一次即两侧同时回退);/photos = SP7-P8b(与 Vue2
// strangler.js 的 migratedRoutes 里那条 /photos 共用同一把键,同理置一次两侧同时回退)。
function cutoverDisabled(from: string): boolean {
  try { return localStorage.getItem(\`strangler:disabled:\${from}\`) === '1' } catch { return false }
}`,
    replace: '' },
  { path: 'src/home/composables/useOpenAction.ts',
    find: `      if (key === 'appstore' && !cutoverDisabled('/apps')) { router.push('/apps/store'); return }
      if (key === 'storage' && !cutoverDisabled('/storage')) { router.push('/storage'); return }
      if (key === 'photos' && !cutoverDisabled('/photos')) { router.push('/photos'); return }
      window.location.href = SYS_ROUTE[key] || '/#/legacy'
      return`,
    replace: `      if (key === 'appstore') { router.push('/apps/store'); return }
      if (key === 'storage') { router.push('/storage'); return }
      router.push(SYS_ROUTE[key] || '/')
      return` },
  { path: 'src/home/composables/useOpenAction.ts',
    find: `    // 桌面照片磁贴:cutover 后进应用内时间线。刻意不带 asset —— Vue2 这里也只是跳
    // /#/photos、不定位到具体某张(桌面磁贴的 key 是渐变色字符串,不是资产 id),
    // 界面 1:1 就该保持"点进相册首页"。flag 置 1 时退回 Vue2 老相册。
    else if (it.kind === 'photo') {
      if (cutoverDisabled('/photos')) window.location.href = '/#/photos'
      else router.push('/photos')
    }
    else if (it.kind === 'widget' && it.key === 'ai') window.location.href = '/#/ai/agent'
  }

  function sendToAI(text?: string) {
    const q = (text || '').trim()
    window.location.href = '/#/ai/agent' + (q ? '?message=' + encodeURIComponent(q) : '')
  }

  return { openApp, openItem, sendToAI }`,
    replace: `  }

  return { openApp, openItem }` },

  // ── grid/types.ts:Kind 去 'photo' ────────────────────────────────────────
  { path: 'src/home/grid/types.ts',
    find: "export type Kind = 'widget' | 'app' | 'folder' | 'photo' | 'appwidget'",
    replace: "export type Kind = 'widget' | 'app' | 'folder' | 'appwidget'" },

  // ── registry.ts:WIDGETS.ai + ICON.ai ────────────────────────────────────
  { path: 'src/home/widgets/registry.ts',
    find: "  ai: '<path d=\"M12 3.5c.45 3.3 1.7 4.55 5 5-3.3.45-4.55 1.7-5 5-.45-3.3-1.7-4.55-5-5 3.3-.45 4.55-1.7 5-5Z\"/>',\n",
    replace: '' },
  { path: 'src/home/widgets/registry.ts',
    find: "  ai:      { title: 'widgetAiTitle', icon: ICON.ai, desc: 'widgetAiDesc', min: [2, 2], max: [4, 4], default: [4, 4] },\n",
    replace: '' },

  // ── WidgetCard.vue:一行 + import(churn 高,绝不整文件替换)──────────────
  { path: 'src/home/components/widgets/WidgetCard.vue',
    find: "import AiWidget from './AiWidget.vue'\n", replace: '' },
  { path: 'src/home/components/widgets/WidgetCard.vue',
    find: '  ai: AiWidget,\n', replace: '' },

  // ── GridItem.vue ────────────────────────────────────────────────────────
  { path: 'src/home/components/GridItem.vue',
    find: "    <PhotoTile v-else-if=\"item.kind === 'photo'\" :item=\"item\" />\n", replace: '' },
  { path: 'src/home/components/GridItem.vue',
    find: "import PhotoTile from './PhotoTile.vue'\n", replace: '' },
  { path: 'src/home/components/GridItem.vue',
    find: "  if (props.item.kind === 'app' || props.item.kind === 'folder' || props.item.kind === 'photo') openItem(props.item)",
    replace: "  if (props.item.kind === 'app' || props.item.kind === 'folder') openItem(props.item)" },

  // ── MobileHome.vue ──────────────────────────────────────────────────────
  { path: 'src/home/components/MobileHome.vue',
    find: "        class=\"m-tile\" :class=\"[`kind-${it.kind}`, { 'm-photo': it.kind === 'photo' }]\"",
    replace: '        class="m-tile" :class="[`kind-${it.kind}`]"' },
  { path: 'src/home/components/MobileHome.vue',
    find: "        <PhotoTile v-else :item=\"it\" />\n", replace: '' },
  { path: 'src/home/components/MobileHome.vue',
    find: "import PhotoTile from './PhotoTile.vue'\n", replace: '' },
  { path: 'src/home/components/MobileHome.vue',
    find: "const tiles = computed(() => ordered.value.filter((i) => i.kind === 'app' || i.kind === 'folder' || i.kind === 'photo'))",
    replace: "const tiles = computed(() => ordered.value.filter((i) => i.kind === 'app' || i.kind === 'folder'))" },
  { path: 'src/home/components/MobileHome.vue',
    find: '.m-photo { grid-column: span 2; grid-row: span 2; }\n', replace: '' },

  // ── layout.ts:bindPhotos 函数体 + return 导出 ──────────────────────────
  // brief 原锚点只摘了 return{} 里的导出名,函数体本身(第 87-97 行,引用
  // isAssetId 与 kind === 'photo')会留下来 —— 现场 sed 取出整段一并删除。
  { path: 'src/home/stores/layout.ts',
    find: `  function bindPhotos(ids: (string | number)[]) {
    let i = 0
    items.value = items.value.map((it) => {
      if (it.kind === 'photo' && !isAssetId(it.key) && ids[i] != null) {
        const next = { ...it, key: String(ids[i]) }
        i++
        return next
      }
      return it
    })
  }

`,
    replace: '' },
  { path: 'src/home/stores/layout.ts',
    find: ', bindPhotos,', replace: ',' },
  // 复审 Important③:bindPhotos 函数体没了之后,isAssetId 变成死 import(该文件
  // 只有 bindPhotos 用它)。isAssetId.ts 这个文件本身归 DELETE 表处理,不在此改。
  { path: 'src/home/stores/layout.ts',
    find: "import { isAssetId } from '../util/isAssetId'\n", replace: '' },

  // ── homeUi.ts:search 四项 ───────────────────────────────────────────────
  { path: 'src/home/stores/homeUi.ts',
    find: "  // Global search palette (SearchDialog). Opened by the topbar search button and ⌘K/Ctrl+K.\n  const searchOpen = ref(false)\n",
    replace: '' },
  { path: 'src/home/stores/homeUi.ts',
    find: "  function setSearch(v: boolean) { searchOpen.value = v }\n  function openSearch() { searchOpen.value = true }\n  function closeSearch() { searchOpen.value = false }\n",
    replace: '' },
  { path: 'src/home/stores/homeUi.ts',
    find: '  return { editing, searchOpen, spawnGhost, toggleEdit, setSearch, openSearch, closeSearch, showToast }',
    replace: '  return { editing, spawnGhost, toggleEdit, showToast }' },

  // ── HomeTopbar.vue:搜索胶囊按钮 + ⌘K 监听 + .search-btn 样式(brief 未给
  //    逐字文本,现场 sed 取出) ─────────────────────────────────────────
  { path: 'src/home/components/HomeTopbar.vue',
    find: `      <button class="bar-btn search-btn" :aria-label="t('topbarSearch')" :title="t('topbarSearchKbd')" @click="homeUi.openSearch()">
        <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
        <span>{{ t('topbarSearch') }}</span>
      </button>
`,
    replace: '' },
  { path: 'src/home/components/HomeTopbar.vue',
    find: `
// ⌘K / Ctrl+K opens the search palette. (Esc-to-close is handled by the dialog itself.)
function onKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); homeUi.openSearch() }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
`,
    replace: '' },
  { path: 'src/home/components/HomeTopbar.vue',
    find: `/* search-btn: glass pill with magnifier icon — matches 搜索组件.dc.html topbar button */
.search-btn { padding-left: 13px; }
.search-btn .ic { width: 17px; height: 17px; }

`,
    replace: '' },
  // 复审 Important①:上面 3 条删掉了搜索胶囊与 ⌘K 监听,但这条中文注释原文
  // "...保留搜索与主题切换" 完全没被摘到 —— 会作为静默泄漏(oss/forbidden.mjs
  // 的中文词表目前没有"搜索")随包发布。词表本身的修补是另一个任务的活,这里
  // 只改措辞,不提搜索。
  { path: 'src/home/components/HomeTopbar.vue',
    find: '保留搜索与主题切换', replace: '保留主题切换' },
  // 复审 Important②:上面删掉 onKey/onMounted/onUnmounted 三行后,这个 import
  // 变成死代码(全文件再无第二处使用 onMounted/onUnmounted,已用 grep 核实)。
  { path: 'src/home/components/HomeTopbar.vue',
    find: "import { onMounted, onUnmounted } from 'vue'\n", replace: '' },

  // ── views/Home.vue:SearchDialog 挂载 + 两个 import + photos store 用量
  //    (brief 未给逐字文本,现场 sed 取出四处) ─────────────────────────────
  { path: 'src/views/Home.vue',
    find: '    <SearchDialog />\n', replace: '' },
  { path: 'src/views/Home.vue',
    find: "import SearchDialog from '../home/components/SearchDialog.vue'\n", replace: '' },
  { path: 'src/views/Home.vue',
    find: "import { usePhotosStore } from '../home/stores/photos'\n", replace: '' },
  { path: 'src/views/Home.vue',
    find: 'const photos = usePhotosStore()\n', replace: '' },
  { path: 'src/views/Home.vue',
    find: `
  photos.loadAssets().then(() => layout.bindPhotos(photos.assets.map((a) => a.id))).catch((e) => console.warn('[home] photos', e))
`,
    replace: '' },

  // ── useAddPanel.ts:curTab 联合类型 + 尺寸表分支 ─────────────────────────
  { path: 'src/home/composables/useAddPanel.ts',
    find: "const curTab = ref<'widget' | 'app' | 'folder' | 'photo'>('widget')",
    replace: "const curTab = ref<'widget' | 'app' | 'folder'>('widget')" },
  { path: 'src/home/composables/useAddPanel.ts',
    find: "    if (kind === 'photo') return [2, 2]\n", replace: '' },

  // ═══════════════════ T7:设置侧 + Service 侧 + 注释洗白 + .gitignore ══════

  // ── HomeTopbar.vue:T6 删完搜索按钮与 ⌘K 监听后剩下的 2 行死代码 ─────────
  { path: 'src/home/components/HomeTopbar.vue',
    find: "import { useHomeUiStore } from '../stores/homeUi'\n", replace: '' },
  { path: 'src/home/components/HomeTopbar.vue',
    find: 'const homeUi = useHomeUiStore()\n', replace: '' },

  // ── tabs.ts:去 folder-permissions,rail 7→6,railTabsFor 退化为恒等 ──────
  // 头部映射注释也点了名(现场 sed 取出,brief 未给):按角色裁剪的那一整项功能
  // 已经不存在,继续保留具体名字和旧计数只是死文档,一并改写。
  { path: 'src/settings/util/tabs.ts',
    find: '//   - data().tabs (L855-863) —— 侧栏 rail 的 7 项\n//   - visibleTabs (L1034)    —— 非 admin 过滤掉 folder-permissions\n',
    replace: '//   - data().tabs (L855-863) / visibleTabs (L1034) —— 侧栏 rail 项与按角色的可见性裁剪\n' },
  { path: 'src/settings/util/tabs.ts',
    find: "  'system-status',\n  'folder-permissions',\n  'account',",
    replace: "  'system-status',\n  'account'," },
  { path: 'src/settings/util/tabs.ts',
    find: "/** 侧栏 rail 上可见的 7 项(account / developer 有各自入口,不在 rail 上)。 */\nexport const RAIL_TABS: readonly SettingsTab[] = SETTINGS_TABS.slice(0, 7)",
    replace: "/** 侧栏 rail 上可见的 6 项(account / developer 有各自入口,不在 rail 上)。 */\nexport const RAIL_TABS: readonly SettingsTab[] = SETTINGS_TABS.slice(0, 6)" },
  { path: 'src/settings/util/tabs.ts',
    find: "  'folder-permissions': 'settingsTabFolderPermissions',\n", replace: '' },
  { path: 'src/settings/util/tabs.ts',
    find: "/** Vue2 visibleTabs:只有 admin 能看到 folder-permissions。role 缺失按非 admin 处理。 */\nexport function railTabsFor(role: string | undefined): readonly SettingsTab[] {\n  if (role === 'admin') return RAIL_TABS\n  return RAIL_TABS.filter((t) => t !== 'folder-permissions')\n}",
    replace: "/** rail 上没有按角色隐藏的项,直接返回全集(保留函数形状以免调用处发散)。 */\nexport function railTabsFor(): readonly SettingsTab[] {\n  return RAIL_TABS\n}" },

  // ── panels/index.ts ─────────────────────────────────────────────────────
  { path: 'src/settings/panels/index.ts',
    find: "import FolderPermissionsPanel from './FolderPermissionsPanel.vue'\n", replace: '' },
  { path: 'src/settings/panels/index.ts',
    find: "  'folder-permissions': FolderPermissionsPanel,\n", replace: '' },

  // ── SettingsShell.vue:railTabsFor 的唯一非测试调用处,少一个实参 ─────────
  { path: 'src/settings/components/SettingsShell.vue',
    find: "const railTabs = computed(() =>\n  railTabsFor(typeof user.value.role === 'string' ? user.value.role : undefined),\n)",
    replace: 'const railTabs = computed(() => railTabsFor())' },

  // ── E2:systemConfig 的 search_switch(索引签名已保证读改写不丢未知字段)──
  { path: 'src/settings/util/systemConfig.ts',
    find: '  search_switch?: boolean\n', replace: '' },
  { path: 'src/settings/util/systemConfig.ts',
    find: '  search_switch: true,\n', replace: '' },

  // ── 注释洗白(代码一个字节不动)────────────────────────────────────────
  { path: 'src/apps/util/systemApp.ts',
    find: " *  compose 任一 service 的 label `nimoos.system == \"true\"` 即幕后组件(AI agent 运行时 /\n *  Photos ML 后端等),桌面 appgrid 已按此隐藏;应用管理页也须隐藏,不然会漏出用户没主动装的容器。",
    replace: " *  compose 任一 service 的 label `nimoos.system == \"true\"` 即幕后组件(供其他应用使用的\n *  内部服务容器),桌面 appgrid 已按此隐藏;应用管理页也须隐藏,不然会漏出用户没主动装的容器。" },
  { path: 'src/settings/util/appPaths.ts',
    find: '// 后端(2026-08-01 实测 GET /v1/sys/paths)返回 4 个 key —— app_data / images / database /\n// photos_data,而 Vue2 只渲染前 3 个。界面 1:1 → 这里也只产出 3 行。',
    // I5-guard(⑤b)复核:原 replace 仍带 "Vue2"(REPLACE-only 时代未覆盖到 PATCH,漏检)。
    replace: '// 后端(2026-08-01 实测 GET /v1/sys/paths)可能返回更多 key,但界面只渲染前 3 个,这里也只产出 3 行。' },
  { path: 'src/apps/stores/installedApps.ts',
    find: '        // 系统幕后容器(nimoos.system=true,如 AI agent / Photos ML)不给用户看——\n        // 与桌面 appgrid 一致(后端 isSystemComposeApp 同款规则)。',
    replace: '        // 系统幕后容器(nimoos.system=true,供其他应用使用的内部服务容器)不给用户看——\n        // 与桌面 appgrid 一致(后端 isSystemComposeApp 同款规则)。' },
  { path: 'src/settings/panels/AppsPanel.vue',
    find: '// 「清理本地待上传缓存」= 政策三「做样子」:界面 1:1、按钮禁用、标注待相册区迁移完成后启用。\n//    数据源是**相册**的 IndexedDB 上传队列(Vue2 @/views/Photos/upload/idb.js),SP7 尚未迁。',
    // I5-guard(⑤b)复核:原 replace 仍带 "政策三「做样子」"(内部分级术语,FORBIDDEN 清单
    // 里的"做样子"本就是冲它去的,REPLACE-only 时代未覆盖到 PATCH,漏检)。
    replace: '// 「清理本地待上传缓存」:界面 1:1、按钮禁用——该功能依赖的后端能力尚未提供。\n//    数据源是本地 IndexedDB 上传队列(与文件区上传队列是两套独立实现,见下一行)。' },

  // ── .gitignore(E9:用户 2026-08-04 拍板)─────────────────────────────────
  // 2026-08-05 私有侧把 .superpowers/ 从 gitignore 拿掉改成入库(台账丢过一次),
  // 锚点跟着改。开源侧两行都不需要:.claude/ 本就不导出,.superpowers/ 已在 DELETE 表。
  { path: '.gitignore',
    find: '\n# Claude Code 本地状态(隔离 worktree、会话配置),不入库\n.claude/\n# .superpowers/ **入库** —— 台账是各期唯一的决策记录。SP7 曾把整个目录弄丢且 git 救不回,\n# SP9-P7 又发现 P5/P6 的台账只活在 gitignore 里。规则见 .superpowers/.gitignore:\n# 台账(.md)与自查截图(.png)进库,评审 diff / 备份 / 快照环境这类机器产物不进。\n',
    replace: '' },
  { path: '.gitignore',
    find: '\n# 时间机器验收测试台(T12):假后端 + 专用 vite 配置,只在本机验收用,不进版本库\nscripts/tmlab/\nvite.config.tmlab.ts',
    replace: '\n# 导出报告(含上游 commit hash),仅供本地追溯\n.export-report.txt' },

  // ═══════════════════ T8:i18n 四个 locale + theme.css ═══════════════════

  // ── src/i18n/zh_cn.base.ts(全区文案基座,8 处锚点,共 44 键)────────────────
  //    2026-08-05(SP7-P8b):原 zh_cn.ts 已改名 base、并新增 3 行合并出口 zh_cn.ts,
  //    锚点路径跟着改。相册那 702 键不在这里剥 —— 它们整块进了 zh_cn.photos.ts,
  //    由 DELETE 表整体删掉(见类 1),这也是当初拆分片的目的。
  // 11 个 audio 转录键(brief 漏登记的部分;audioSkipBack/Forward/Speed 播放器控件保留)
  { path: 'src/i18n/zh_cn.base.ts',
    find: "  audioSummary: '摘要',\n  audioTranscript: '转录文稿',\n  audioAsk: '问 Nimo',\n  audioAskPlaceholder: '关于这段音频，尽管问…',\n  audioAskEmpty: '这段音频的转录已向量化 — 关于内容尽管问 Nimo。',\n  audioAskDemo: '(demo 占位) 转录已向量化。接入 AI 后端后，这里会根据音频内容作答，并附上可跳转的时间戳。',\n  audioHighlightsOnly: '只看重点',\n  audioShowAll: '显示全部',\n  audioSpeakerAll: '全部',\n  audioChapters: '章节',\n  audioAllChapters: '全部章节',\n",
    replace: "" },
  // appPhotos/appAi:systemApps.ts 对应条目已在 T6 删除
  { path: 'src/i18n/zh_cn.base.ts',
    find: "  appPhotos: '照片',\n  appAi: 'Nimo AI',\n",
    replace: "" },
  { path: 'src/i18n/zh_cn.base.ts',
    find: "  widgetAiTitle: 'AI 助手',\n  widgetAiDesc: '对话与智能建议',\n",
    replace: "" },
  // widgetAi* 其余 7 键:AiWidget.vue 已整体删除(DELETE 表),全部孤儿
  { path: 'src/i18n/zh_cn.base.ts',
    find: "  widgetAiGreetShort: '晚上好',\n  widgetAiGreet: '晚上好，有什么可以帮你？',\n  widgetAiPlaceholder: '发消息给 AI 助手…',\n  widgetAiSend: '发送',\n  widgetAiPrompt1: '整理最近的照片',\n  widgetAiPrompt2: '查找 2024 旅行视频',\n  widgetAiPrompt3: '分析存储使用情况',\n",
    replace: "" },
  // addPanelTabPhoto:T11 删 AddPanel 照片 tab 后的孤儿键,此处先清 i18n 侧
  { path: 'src/i18n/zh_cn.base.ts',
    find: "  addPanelTabPhoto: '照片',\n",
    replace: "" },
  { path: 'src/i18n/zh_cn.base.ts',
    find: "  addPanelNoPhotos: '暂无照片',\n",
    replace: "" },
  // topbarSearch(Kbd):HomeTopbar.vue 搜索胶囊按钮已在 T6 删除
  { path: 'src/i18n/zh_cn.base.ts',
    find: "  topbarSearch: '搜索',\n  topbarSearchKbd: '搜索 (⌘K)',\n",
    replace: "" },
  // "主页:搜索面板"整节 18 键:SearchDialog.vue 已整体删除(DELETE 表)
  { path: 'src/i18n/zh_cn.base.ts',
    find: "  // ── 主页:搜索面板 ──\n  searchPlaceholder: '你在找什么?',\n  searchClose: '关闭',\n  searchSearching: '搜索中…',\n  searchResultsCount: '{count} 条结果',\n  searchOpenAlbum: '打开相册 ›',\n  searchAlbumMatches: '在 AI 相册找到 {count} 个匹配(图片 / 视频)',\n  searchOpenFolder: '打开文件夹 ›',\n  searchOpenFolderTitle: '在文件中打开此文件夹',\n  searchAskTitle: '向 Nimo AI 询问「{query}」',\n  searchAskSub: '把它发送给 AI 助手,获得基于你文件的回答',\n  searchAskGo: '询问 ›',\n  searchAskButton: 'Ask Nimo',\n  searchHint: '输入关键词并回车,搜索图片、文档、视频、音频与设置',\n  searchTabAll: '全部结果',\n  searchTabDocuments: '文档',\n  searchTabImages: '图片',\n  searchTabAudio: '音频',\n  searchTabVideos: '视频',\n",
    replace: "" },

  // ── src/i18n/en_us.base.ts(与上面 8 条逐条成对,parity.test.ts 的前置)──────
  { path: 'src/i18n/en_us.base.ts',
    find: "  audioSummary: 'Summary',\n  audioTranscript: 'Transcript',\n  audioAsk: 'Ask Nimo',\n  audioAskPlaceholder: 'Ask anything about this audio…',\n  audioAskEmpty: 'This transcript is vectorized — ask Nimo about anything in it.',\n  audioAskDemo: '(demo) This transcript is vectorized. Once the AI backend is connected, answers grounded in the audio — with clickable timestamps — will appear here.',\n  audioHighlightsOnly: 'Highlights only',\n  audioShowAll: 'Show all',\n  audioSpeakerAll: 'All',\n  audioChapters: 'Chapters',\n  audioAllChapters: 'All chapters',\n",
    replace: "" },
  { path: 'src/i18n/en_us.base.ts',
    find: "  appPhotos: 'Photos',\n  appAi: 'Nimo AI',\n",
    replace: "" },
  { path: 'src/i18n/en_us.base.ts',
    find: "  widgetAiTitle: 'AI Assistant',\n  widgetAiDesc: 'Chat and smart suggestions',\n",
    replace: "" },
  { path: 'src/i18n/en_us.base.ts',
    find: "  widgetAiGreetShort: 'Good evening',\n  widgetAiGreet: 'Good evening — how can I help?',\n  widgetAiPlaceholder: 'Message the AI assistant…',\n  widgetAiSend: 'Send',\n  widgetAiPrompt1: 'Organize recent photos',\n  widgetAiPrompt2: 'Find 2024 travel videos',\n  widgetAiPrompt3: 'Analyze storage usage',\n",
    replace: "" },
  { path: 'src/i18n/en_us.base.ts',
    find: "  addPanelTabPhoto: 'Photos',\n",
    replace: "" },
  { path: 'src/i18n/en_us.base.ts',
    find: "  addPanelNoPhotos: 'No photos',\n",
    replace: "" },
  { path: 'src/i18n/en_us.base.ts',
    find: "  topbarSearch: 'Search',\n  topbarSearchKbd: 'Search (⌘K)',\n",
    replace: "" },
  // 交接清单盲区(E1):settingsFpIntro 那一条不在这批里,英文侧本身就没有任何词命中,靠这份成对表兜底,见下方 sp9 块
  { path: 'src/i18n/en_us.base.ts',
    find: "  // ── Home: search palette ──\n  searchPlaceholder: 'what are u looking for',\n  searchClose: 'Close',\n  searchSearching: 'Searching…',\n  searchResultsCount: '{count} results',\n  searchOpenAlbum: 'Open Album ›',\n  searchAlbumMatches: 'Found {count} matches in AI Album (images / videos)',\n  searchOpenFolder: 'Open folder ›',\n  searchOpenFolderTitle: 'Open this folder in Files',\n  searchAskTitle: 'Ask Nimo AI about “{query}”',\n  searchAskSub: 'Send this to the AI assistant for an answer grounded in your files',\n  searchAskGo: 'Ask ›',\n  searchAskButton: 'Ask Nimo',\n  searchHint: 'Type a keyword and press Enter to search images, documents, videos, audio and settings',\n  searchTabAll: 'All results',\n  searchTabDocuments: 'Documents',\n  searchTabImages: 'Images',\n  searchTabAudio: 'Audio',\n  searchTabVideos: 'Videos',\n",
    replace: "" },

  // ── 两处"保留文件里顺带提到相册"的注释,改写措辞(不删代码)────────────────
  //    stores/toast.ts:`action` 参数的来历注释举了相册回收站的撤销 pill 做例子;
  //    color-guard.test.ts:实测命中的 4 个文件名里有 3 个是相册组件。两处都只是**举例**,
  //    代码本身与相册无关且必须保留,故改写成不点名的等价说法。
  { path: 'src/stores/toast.ts',
    find: "// `action` (Task 9, SP7-P3 photos trash view): optional inline affordance (e.g.\n",
    replace: "// `action`: optional inline affordance (e.g.\n" },
  { path: 'src/styles/color-guard.test.ts',
    find: `// 静默失效。本期实测命中 4 个文件(ClusterActionDialog / PersonRelGraph / PersonPlacesTab /
// PhotosTrash),当时恰好是绿的(非假绿),但两个隐患都成立。
`,
    replace: `// 静默失效。当初实测命中 4 个组件文件,当时恰好是绿的(非假绿),但两个隐患都成立。
` },

  // ── src/styles/theme.css:相册专用 token 组整块删除 ─────────────────────────
  //    这些 token 的消费方(src/photos/** 与 13 个相册视图)已在 DELETE 表,删完全部成为
  //    孤儿;且它们的注释逐条引用 Vue2 photos.scss / photos-places.scss 的行号,属 E7
  //    「一份内部文档都不带」的范围。照既有 --spk-*/--orb-* 的处理方式整组删(注释与 token
  //    一起),而不是把注释改写成泛化措辞留下孤儿 token。
  //    深浅两套主题块各一份,逐块成对。**未删的相册孤儿 token**:--divider / --panel-bg-solid
  //    ——名字通用、无相册字样、不触发任何禁词,留着零成本,删了反而可能被后来人重新发明。
  // --album-cover-fallback(PhotosAlbums/PhotosAlbumDetail 专用)
  { path: 'src/styles/theme.css',
    find: `  /* 相册无封面渐变占位(PhotosAlbums.vue / PhotosAlbumDetail.vue 曾各写一份逐字相同的
     linear-gradient(135deg, color-mix(accent 35%, panel-bg), accent),提成本 token 消灭
     重复;两处均改用它,见 THEMING.md 例外清单外的普通语义 token 用法)。 */
  --album-cover-fallback: linear-gradient(135deg, color-mix(in srgb, var(--accent) 35%, var(--panel-bg)), var(--accent));
`,
    replace: '' },
  // --avatar-fallback(PersonAvatar 专用)
  { path: 'src/styles/theme.css',
    find: `  /* 人物头像三级兜底的渐变实底(PersonAvatar.vue,SP7-P5)。目标是贴近 Vue2 5 处重复的
     linear-gradient(135deg,#6E5BFF,#4A3BD1)/(135deg,#8950F2,#6c3bcd)(两套并存本身不一致,
     这里统一成一份 token)。用 --accent 混黑代替写死紫色,保持"颜色一律走 token"红线;
     对比度实算见 PersonAvatar.vue 顶部注释与任务报告。 */
  --avatar-fallback: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #000));
`,
    replace: '' },
  // --place-row-* 三色(PlacesRail)
  { path: 'src/styles/theme.css',
    find: `  /* PlacesRail.vue(P6a-T5)选中城市行三处——Vue2 photos-places.scss:153-156/:163-167
     的 rgba(var(--accent-rgb), 0.10/0.30/0.18) 精确复刻(该视图只有深色设计,数值级
     精度要求专用 token,不从 --accent-soft 三档就近凑,同 --drop-bg/--spark-fill/
     --orb-glow 的既有先例)。 */
  --place-row-bg: rgba(138, 180, 255, 0.10);
  --place-row-border: rgba(138, 180, 255, 0.30);
  --place-thumb-active: rgba(138, 180, 255, 0.18);
`,
    replace: '' },
  // --pin-* 六色 + --pin-cluster-stroke(PlacesMap 图钉)
  { path: 'src/styles/theme.css',
    find: `  /* PlacesMap.vue(P6a-T6)图钉——Vue2 photos-places.scss:366-411 的
     rgba(var(--accent-rgb), α) 精确复刻。--accent-rgb 在 Vue2 明确标注
     theme-invariant(恒为 110,91,255),即这些 alpha 层在深浅两套 app 主题下都不变——
     图钉铺的是地图预设自己的画布(4 套预设 + 自定义色,深浅与 app 主题无关,custom 模式
     恒为黑底),不能按 app 主题去降 alpha,否则「浅色 app 主题 + custom 黑底」会把图钉
     洗没。故两套主题块 alpha 完全相同,只有 RGB 跟随本仓 --accent-rgb 深浅两档。 */
  --pin-bg: rgba(138, 180, 255, 0.16);
  --pin-stroke: rgba(138, 180, 255, 0.55);
  --pin-active-bg: rgba(138, 180, 255, 0.30);
  --pin-pulse: rgba(138, 180, 255, 0.25);
  --pin-cluster-hover-bg: rgba(138, 180, 255, 0.42);
  --pin-glow: rgba(138, 180, 255, 0.7);
  /* Vue2 原值是比 accent 更浅的淡紫 rgba(196,184,255,0.85),让簇读作"一组"而非单点;
     这里 RGB 改取本仓 --accent-text(169,198,255)——语义正是"比 accent 更浅/更可读的
     accent 色",alpha 精确复刻原值 0.85。 */
  --pin-cluster-stroke: rgba(169, 198, 255, 0.85);
`,
    replace: '' },
  // --place-current-trip
  { path: 'src/styles/theme.css',
    find: `  /* Vue2 原值 #34c759(当前行程绿,图例第四组也用),两套主题下都用同一个值——不用
     本仓 --good(它是青绿 #5fe3b0/#15754c,与 iOS 绿不同,是近似不是精确复刻)。 */
  --place-current-trip: #34c759;
`,
    replace: '' },
  // --place-home-base(PlaceDetailPanel)
  { path: 'src/styles/theme.css',
    find: `  /* PlaceDetailPanel.vue(P6b-T3)「常驻地」标记色——新增 token,精确复刻 Vue2
     photos-places.scss 内联 \`style="color:#c4b8ff"\`(:1078)。偏离登记(brief 字面要求
     两套主题给不同值,深色浅紫、浅色改深色向,同 --accent-text 的做法):这里改成
     **两套主题同值**,不跟随 app 主题深浅——它与紧邻的 --place-current-trip 用在完全
     相同的语境(.ttl-region 内,叠在 hero 暗化封面照片之上,该遮罩本身钉死恒为深色,
     与 app 是深色皮肤还是纸感皮肤无关),若照字面给浅色主题一个深紫版本,会在浅色 app
     主题下把深紫字压在恒暗的照片渐变上,直接违反本任务"hero 前景色红线"的对比度要求。
     不用 --accent-text 就近凑:那是"比 accent 更浅更可读"的语义(蓝色调),这里要与
     「本次旅行」并列的第二个状态色(紫色调),同 --pin-cluster-stroke 换基色不换语义的
     既有先例,但这里连 alpha/精确色值都直接照抄 Vue2 字面量(theme-invariant,同
     --place-current-trip 的既有先例)。 */
  --place-home-base: #c4b8ff;
`,
    replace: '' },
  // --map-dot-bg-fallback(PlacesMap 陆地点阵)
  { path: 'src/styles/theme.css',
    find: `  /* PlacesMap.vue(P6a-T6)陆地点阵底色的 CSS 回落值——theme-invariant,两套主题块同值。
     精确复刻 Vue2 photos-places.scss:347 的字面量 rgba(255,255,255,0.10)(该视图刻意不走
     --ink/文字色系,因为这层压在地图预设自己的深色画布上,与 app 主题无关)。
     不能用本仓 --fg-faint 顶替:深色 --fg-faint 是 rgba(255,255,255,0.52)(0.52 vs 0.10,
     陆地点阵会亮到盖过 --map-dot 的已访问点),浅色 --fg-faint 更是不透明的暖灰 #9a958a
     (铺在 custom 模式的纯黑地图画布上会变成一块不透明灰块)——评审 I1 实测复核过这条
     失效路径确实可达(Vue2 :150/:137 两条最常见路径的 dotBg 都是 null,即都吃 CSS 回落,
     不是罕见分支)。 */
  --map-dot-bg-fallback: rgba(255, 255, 255, 0.10);
`,
    replace: '' },
  // --float-bg(PlacesZoomBar 浮动药丸底)
  { path: 'src/styles/theme.css',
    find: `  /* PlacesZoomBar.vue(P6a-T8)垂直缩放滑杆的浮动药丸底——新增 token,精确复刻 Vue2
     photos.scss:49(NimoOS-UI 全局浮动条/FAB 共用底,不是 photos-places.scss 自己定义的)。
     本仓之前没有等价的"半透明浮动工具条底"token,--panel-bg(0.1)/--popup-bg(渐变,
     ~0.9-0.95)/--tool-bg(0.16,不透明纯色)都对不上这个扁平 0.85 的量级,故新增而非近似。 */
  --float-bg: rgba(20, 20, 28, 0.85);
`,
    replace: '' },
  // --zb-hover-bg / --zb-track-bg
  { path: 'src/styles/theme.css',
    find: `  /* 同上组件——Vue2 用 rgba(var(--ink), 0.08/0.12) 给 .zb-btn:hover 背景与 .zb-track 底色
     做"跟随文字色的透明度斜坡";本仓没有 --ink 这个 RGB 三元组 token。alpha 精确复刻
     Vue2 的 0.08/0.12,RGB 改取本仓 --fg 的真实分解值(dark #ffffff→255,255,255)——不照抄
     Vue2 light 主题里 --ink 的 (35,37,43)(该值本身只是 Vue2 注释自称的"AI --text-primary
     近似",不是设计精确值),同 --pin-cluster-stroke 的换基色先例。 */
  --zb-hover-bg: rgba(255, 255, 255, 0.08);
  --zb-track-bg: rgba(255, 255, 255, 0.12);
`,
    replace: '' },
  // --zb-thumb-shadow
  { path: 'src/styles/theme.css',
    find: `  /* .zb-thumb 把手投影第二层——Vue2 photos-places.scss:281 的 box-shadow 里
     \`0 1px 4px rgba(0,0,0,0.4)\` 从未随 Vue2 自己的深浅主题变化,theme-invariant,
     两套主题块同值(先例见 --place-current-trip)。 */
  --zb-thumb-shadow: rgba(0, 0, 0, 0.4);
`,
    replace: '' },
  // --warn-*(人脸识别关闭 / Photos AI 离线两条横幅)
  { path: 'src/styles/theme.css',
    find: `  /* 警告/降级语义(SP7-P5:人脸识别关闭、Photos AI 后端离线两条横幅)。对齐 Vue2 的
     #FF9F0A 系;深色主题直接取原值,浅色主题按本仓 --dem-* 的既有做法压暗前景保证对比度。 */
  --warn-fg: #ff9f0a;
  --warn-bg: rgba(255, 159, 10, 0.08);
  --warn-border: rgba(255, 159, 10, 0.32);
`,
    replace: '' },
  // --badge-photo/video/ocr(搜索结果媒体类别徽标)
  { path: 'src/styles/theme.css',
    find: `  /* SP7-P7a-T15:搜索结果卡片左上角媒体类别徽标(.type-badge[data-type])三色——
     数据可视化类别色（THEMING.md §0 第三类例外的变体：同一批结果里要把"照片/视频/
     OCR 命中"这三种互不相同的类别互相区分开，颜色语义是"第几类"而非"主题强调色"）。
     精确复刻 Vue2 photos.scss:2768-2770 的字面量,两套主题块同值——不随皮肤深浅走,
     同 --place-current-trip/--console-bg 的既有先例(同类先例见 THEMING.md §6)。
     不用 --accent/--danger 就近凑:它们是三个并列的类别标识,不是"强调"或"危险"语义。 */
  --badge-photo: rgba(50, 190, 230, 0.9);   /* 青 cyan */
  --badge-video: rgba(255, 149, 10, 0.92);  /* 橙 orange */
  --badge-ocr: rgba(16, 185, 129, 0.92);    /* 翠绿 emerald */
`,
    replace: '' },
  // --photos-seg-*(设置页容量条分段色)
  { path: 'src/styles/theme.css',
    find: `  /* SP7-P8a-T3:设置页存储卡容量条分段色(PhotosStorageCard.vue,消费于
     src/photos/util/storagePalette.ts 的 STORAGE_SEG_COLORS)——同上一组一样是**数据可视化
     类别色**:同一条容量条上要把 videos/raw/ai/other 四个互不相同的数据段互相区分开,
     颜色语义是"第几类数据"而不是"主题强调色"。photos 段用 --accent、thumbs 段用 --success
     (既有语义 token 直接复用,不新增),这四个是 Vue2 内联的、本仓无对应语义 token 的字面量,
     故新增。深色精确复刻 Vue2 PhotosSettings.vue:320/321/323 的字面量;浅色不能照抄深色值——
     videos 的中蓝、raw 的浅粉柔和色铺在本主题纯白 --card-bg 上会偏灰、分段边界糊掉,故各自
     加深/提高饱和度保持在白底上可辨识(同 --warn-fg 浅色把 #FF9F0A 压成 #96610a 保对比度的
     既定手法,但这里是三个并列的类别色而非单一警告语义,故各给独立值而非借用 --warn-fg)。 */
  --photos-seg-video: #5e94ff;
  --photos-seg-raw: #ff9ac2;
  --photos-seg-ai: #ff9f0a;
  /* other 段 Vue2 原值是 rgba(var(--ink),0.25)("跟随文字色的透明度斜坡"),本仓无 --ink
     三元组 token——同 --zb-hover-bg/--zb-track-bg 的既定换基先例:alpha 精确复刻 0.25,
     RGB 改取本仓 --fg 的真实分解值(dark #ffffff→255,255,255)。 */
  --photos-seg-other: rgba(255, 255, 255, 0.25);
`,
    replace: '' },
  // light:--album-cover-fallback
  { path: 'src/styles/theme.css',
    find: `  /* 相册无封面渐变占位(见 :root 同名 token 注释),白色纸感主题下取值同一份公式,
     --accent/--panel-bg 各自已按本主题定义,结果自然是本主题配色。 */
  --album-cover-fallback: linear-gradient(135deg, color-mix(in srgb, var(--accent) 35%, var(--panel-bg)), var(--accent));
`,
    replace: '' },
  // light:--avatar-fallback
  { path: 'src/styles/theme.css',
    find: `  /* 见 :root 同名 token 注释;白色纸感主题下 accent 更深,mix 百分比调到 70% 才不至于
     整块糊成近黑(对比度实算见 PersonAvatar.vue / 任务报告)。 */
  --avatar-fallback: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #000));
`,
    replace: '' },
  // light:--place-row-*
  { path: 'src/styles/theme.css',
    find: `  /* Vue2 该视图仅有深色设计,浅色值没有原件可照——按 accent 家族深→浅收敛惯例推导
     (.14→.11、.24→.20、.36→.30,约 ×0.83):.10→.08、.30→.25、.18→.15。 */
  --place-row-bg: rgba(59, 91, 219, 0.08);
  --place-row-border: rgba(59, 91, 219, 0.25);
  --place-thumb-active: rgba(59, 91, 219, 0.15);
`,
    replace: '' },
  // light:--pin-*
  { path: 'src/styles/theme.css',
    find: `  /* PlacesMap.vue(P6a-T6)图钉——见 :root 同名 token 注释:alpha 与 :root 完全相同
     (theme-invariant,铺在地图预设自己的画布上,不随 app 主题降 alpha),RGB 换成本仓
     浅色 --accent-rgb(59,91,219)。 */
  --pin-bg: rgba(59, 91, 219, 0.16);
  --pin-stroke: rgba(59, 91, 219, 0.55);
  --pin-active-bg: rgba(59, 91, 219, 0.30);
  --pin-pulse: rgba(59, 91, 219, 0.25);
  --pin-cluster-hover-bg: rgba(59, 91, 219, 0.42);
  --pin-glow: rgba(59, 91, 219, 0.7);
`,
    replace: '' },
  // light:--pin-cluster-stroke
  { path: 'src/styles/theme.css',
    find: `  /* RGB 取本仓浅色 --accent-text(53,80,196),alpha 精确复刻 Vue2 原值 0.85(见 :root 同名注释)。 */
  --pin-cluster-stroke: rgba(53, 80, 196, 0.85);
`,
    replace: '' },
  // light:--place-current-trip
  { path: 'src/styles/theme.css',
    find: `  /* 两套主题同值,见 :root 同名注释。 */
  --place-current-trip: #34c759;
`,
    replace: '' },
  // light:--place-home-base
  { path: 'src/styles/theme.css',
    find: `  /* 两套主题同值,见 :root 同名注释(偏离登记:未按字面要求给浅色主题一个深紫版本,
     理由同 :root 块的完整登记——它与 --place-current-trip 语境完全相同,恒叠在
     hero 的固定暗化渐变之上,与 app 是深色还是纸感皮肤无关)。 */
  --place-home-base: #c4b8ff;
`,
    replace: '' },
  // light:--map-dot-bg-fallback
  { path: 'src/styles/theme.css',
    find: `  /* theme-invariant,两套主题块同值——见 :root 同名 token 注释(不用 --fg-faint 的理由同上,
     浅色 --fg-faint 是不透明暖灰 #9a958a,同样会在地图画布上变成一块不透明色块)。 */
  --map-dot-bg-fallback: rgba(255, 255, 255, 0.10);
`,
    replace: '' },
  // light:--float-bg
  { path: 'src/styles/theme.css',
    find: `  /* PlacesZoomBar.vue(P6a-T8)——见 :root 同名 token 注释。精确复刻 Vue2 photos.scss:84
     的浅色浮动条底字面量。 */
  --float-bg: rgba(255, 255, 255, 0.85);
`,
    replace: '' },
  // light:--zb-hover-bg / --zb-track-bg
  { path: 'src/styles/theme.css',
    find: `  /* 见 :root 同名 token 注释:alpha 与 :root 完全相同(0.08/0.12),RGB 换成本仓浅色
     --fg 的真实分解值(#1c1b19→28,27,25)。 */
  --zb-hover-bg: rgba(28, 27, 25, 0.08);
  --zb-track-bg: rgba(28, 27, 25, 0.12);
`,
    replace: '' },
  // light:--zb-thumb-shadow
  { path: 'src/styles/theme.css',
    find: `  /* 两套主题同值,见 :root 同名注释。 */
  --zb-thumb-shadow: rgba(0, 0, 0, 0.4);
`,
    replace: '' },
  // light:--warn-*
  { path: 'src/styles/theme.css',
    find: `  /* 警告/降级语义(见 :root 同名注释)。#FF9F0A 直接铺在纸感白底上只有 ~1.9:1,
     故前景压到深琥珀(同 --dem-fg 的 #92600c 一档),底/描边给纸感主题的实色。 */
  --warn-fg: #96610a;
  --warn-bg: #fdf3e2;
  --warn-border: #f0d7a6;
`,
    replace: '' },
  // light:--badge-*
  { path: 'src/styles/theme.css',
    find: `  /* SP7-P7a-T15:同 :root 同名注释——三个媒体类别徽标色,两套主题块同值,不随皮肤翻转。 */
  --badge-photo: rgba(50, 190, 230, 0.9);
  --badge-video: rgba(255, 149, 10, 0.92);
  --badge-ocr: rgba(16, 185, 129, 0.92);
`,
    replace: '' },
  // light:--photos-seg-*
  { path: 'src/styles/theme.css',
    find: `  /* SP7-P8a-T3:同 :root 同名注释——存储卡容量条分段色。浅色主题按可读性微调(不是照抄
     Vue2 唯一深色设计的原值):
     --photos-seg-video 从 Vue2 的中蓝 #5e94ff 加深到 #3560d8——纸感白底 --card-bg(#ffffff)
     上原值发灰、和相邻分段边界不够清楚,加深/提高饱和度后仍是同一色相的蓝。
     --photos-seg-raw 从 Vue2 的浅粉 #ff9ac2 加深到 #c93f79——浅粉铺在纯白底上几乎融进背景,
     压深成同色相的玫红以保证分段轮廓可辨。
     --photos-seg-ai 从 Vue2 的橙 #ff9f0a 压到 #a15f0a——同 --warn-fg 浅色档处理同一个字面量
     色值的既定手法(压暗保对比度),但这里是独立的类别标识 token,不直接借用 --warn-fg
     (那是"警告"语义,这里是"第几类数据"语义,同一个字面量色值、两个不同的 token)。 */
  --photos-seg-video: #3560d8;
  --photos-seg-raw: #c93f79;
  --photos-seg-ai: #a15f0a;
  /* alpha 与 :root 同为 0.25(精确复刻 Vue2 other 段 rgba(var(--ink),0.25)),RGB 换成本仓
     浅色 --fg 的真实分解值(#1c1b19→28,27,25)——同 --zb-hover-bg/--zb-track-bg 浅色档的既定
     换基公式。 */
  --photos-seg-other: rgba(28, 27, 25, 0.25);
`,
    replace: '' },

  // ── src/router/index.ts:13 个相册视图 import + 14 条 /photos* 路由 ────────────
  //    两段各自连续,整块摘。DELETE 表已删掉那 13 个 .vue 文件,不摘 import 的话开源侧
  //    vite build 直接找不到模块 —— 这两条补丁与 DELETE 是配对的,少一边都不行。
  { path: 'src/router/index.ts',
    find: `import Photos from '../views/Photos.vue'
import PhotosFavorites from '../views/PhotosFavorites.vue'
import PhotosTrash from '../views/PhotosTrash.vue'
import PhotosAlbums from '../views/PhotosAlbums.vue'
import PhotosAlbumDetail from '../views/PhotosAlbumDetail.vue'
import PhotosPeople from '../views/PhotosPeople.vue'
import PhotosPersonDetail from '../views/PhotosPersonDetail.vue'
import PhotosPlaces from '../views/PhotosPlaces.vue'
import PhotosPlaceAssets from '../views/PhotosPlaceAssets.vue'
import PhotosSmartViews from '../views/PhotosSmartViews.vue'
import PhotosSmartViewDetail from '../views/PhotosSmartViewDetail.vue'
import PhotosSearch from '../views/PhotosSearch.vue'
import PhotosSettings from '../views/PhotosSettings.vue'
`,
    replace: '' },
  { path: 'src/router/index.ts',
    find: `  { path: '/photos', name: 'photos', component: Photos },
  { path: '/photos/favorites', name: 'photos-favorites', component: PhotosFavorites },
  { path: '/photos/trash', name: 'photos-trash', component: PhotosTrash },
  { path: '/photos/albums', name: 'photos-albums', component: PhotosAlbums },
  { path: '/photos/albums/:id', name: 'photos-album-detail', component: PhotosAlbumDetail },
  { path: '/photos/people', name: 'photos-people', component: PhotosPeople },
  { path: '/photos/people/:id', name: 'photos-person-detail', component: PhotosPersonDetail },
  { path: '/photos/places', name: 'photos-places', component: PhotosPlaces },
  { path: '/photos/places/:key', name: 'photos-place-assets', component: PhotosPlaceAssets },
  { path: '/photos/smart-views', name: 'photos-smart-views', component: PhotosSmartViews },
  { path: '/photos/smart-views/:id', name: 'photos-smart-view-detail', component: PhotosSmartViewDetail },
  { path: '/photos/search', name: 'photos-search', component: PhotosSearch },
  // SP7-P8a-T5:只追加,不重排——须排在最后一条既有 /photos/* 之后(router/index.test.ts
  // 用 node:fs 读源文本行序断言,而非 router.getRoutes(),见该测试文件注释)。
  { path: '/photos/settings', name: 'photos-settings', component: PhotosSettings },
`,
    replace: '' },

  // ── src/components/AppToast.zIndex.test.ts:去相册两处点名 ──────────────────
  //    这道闸是**全仓约定守卫**(toast 必须高于所有模态遮罩),开源版要保留 —— 它 glob 全仓
  //    样式块、相册文件删掉后自然不再被扫到。要摘的只有两处点名:①文件头注释里举例的三条
  //    相册失败路径与 .pd-scrim/.cad-overlay ②末尾单独钉那两个相册遮罩的 it.each 块
  //    (整块删:它只有相册两条,前面那条 glob 全量断言仍在)。
  { path: 'src/components/AppToast.zIndex.test.ts',
    find: `// 为什么需要一条测试:遮罩都带 backdrop-filter,压在遮罩下方的 toast 不是"偏灰"而是
// **完全读不到**。本期评审抓到的真实后果 —— 三条「失败了但刻意保留弹窗让用户重试」的路径
// (人物改名失败 / 建相册失败 / 命名未命名人物失败)全部把失败原因藏在 z-index 220 的
// .pd-scrim / .cad-overlay 底下,用户只看到按钮"没反应",反复重试。
`,
    replace: `// 为什么需要一条测试:遮罩都带 backdrop-filter,压在遮罩下方的 toast 不是"偏灰"而是
// **完全读不到**——用户只看到按钮"没反应",反复重试。
` },
  { path: 'src/components/AppToast.zIndex.test.ts',
    find: `  // 本期评审命中的三条路径的两个具体遮罩,单独钉一遍(上一条即使被人放宽也还有这道)。
  it.each([
    ['src/views/PhotosPersonDetail.vue', '.pd-scrim'],
    ['src/photos/components/ClusterActionDialog.vue', '.cad-overlay'],
  ])('%s 的 %s 低于 toast', (rel, selector) => {
    const src = Object.entries(files).find(([p]) => relOf(p) === rel)?.[1]
    expect(src, \`\${rel} 未被 glob 收到\`).toBeTruthy()
    const css = styleText(rel, src as string)
    // 取该选择器所在规则块里的 z-index。
    const block = new RegExp(\`\\\\\${selector}\\\\s*\\\\{([^}]*)\\\\}\`).exec(css)
    expect(block, \`\${rel} 里找不到 \${selector} 规则块\`).toBeTruthy()
    const z = zIndexes((block as RegExpExecArray)[1])
    expect(z.length, \`\${selector} 规则块里没有 z-index\`).toBe(1)
    expect(z[0]).toBeLessThan(toastZ)
  })
`,
    replace: '' },

  // ── src/router/index.test.ts:相册路由的 14 条断言整块删除 ──────────────────
  //    本文件除开头两条 /files 用例外全是相册路由(命中 + "只追加不重排"顺序断言)。
  //    连带摘掉 `./index.ts?raw` 那个 import 与它上面的说明注释 —— 原文只被顺序断言用到,
  //    留着会是未使用变量(开源侧 vue-tsc 直接红)。
  { path: 'src/router/index.test.ts',
    find: `// 评审 M5:原来这里的注释声称"完整的顺序/未重排断言见 PhotosPlaces.test.ts",但那份文件
// 只用 \`?raw\` 取 PhotosPlaces.vue 自己的样式块做 pointer-events 断言,从未读过 router/index.ts
// 的源文本——那句话是不实的。真正的顺序/未重排断言就近放在这里,用 \`?raw\` 读原始文本核对。
import routerIndexRaw from './index.ts?raw'
`,
    replace: '' },
  { path: 'src/router/index.test.ts',
    find: `  it('/photos/favorites 命中 photos-favorites 路由', () => {
    const m = router.resolve('/photos/favorites')
    expect(m.name).toBe('photos-favorites')
  })
  it('/photos/trash 命中 photos-trash 路由', () => {
    const m = router.resolve('/photos/trash')
    expect(m.name).toBe('photos-trash')
  })
  it('/photos/albums 命中 photos-albums 路由', () => {
    const m = router.resolve('/photos/albums')
    expect(m.name).toBe('photos-albums')
  })
  it('/photos/albums/7 命中 photos-album-detail 路由,params.id 为字符串 "7"', () => {
    const m = router.resolve('/photos/albums/7')
    expect(m.name).toBe('photos-album-detail')
    expect(m.params.id).toBe('7')
  })
  it('/photos/people 命中 photos-people 路由', () => {
    const m = router.resolve('/photos/people')
    expect(m.name).toBe('photos-people')
  })
  it('/photos/people/7 命中 photos-person-detail 路由,params.id 为字符串 "7"', () => {
    const m = router.resolve('/photos/people/7')
    expect(m.name).toBe('photos-person-detail')
    expect(m.params.id).toBe('7')
  })
  it('/photos/places 命中 photos-places 路由', () => {
    const m = router.resolve('/photos/places')
    expect(m.name).toBe('photos-places')
  })

  // P6a-T11:只追加,不重排——新路由必须夹在 /photos/people/:id 与 /login 之间,且两者
  // 本身的相对顺序不能被打乱(评审 M5:之前这条断言只存在于一句不实的注释里,这里补真的)。
  it('/photos/places 追加在 /photos/people/:id 之后、/login 之前(只追加,不重排)', () => {
    const peopleDetailIdx = routerIndexRaw.indexOf(\`{ path: '/photos/people/:id'\`)
    const placesIdx = routerIndexRaw.indexOf(\`{ path: '/photos/places'\`)
    const loginIdx = routerIndexRaw.indexOf(\`{ path: '/login'\`)
    expect(peopleDetailIdx).toBeGreaterThan(-1)
    expect(placesIdx).toBeGreaterThan(peopleDetailIdx)
    expect(loginIdx).toBeGreaterThan(placesIdx)
  })

  // SP7-P7a-T4:/photos/smart-views 命中真实注册的路由(用产线单例 router.resolve 真解析,
  // 不是 spy push——同上面每一条既有路由断言的既定写法)。
  it('/photos/smart-views 命中 photos-smart-views 路由', () => {
    const m = router.resolve('/photos/smart-views')
    expect(m.name).toBe('photos-smart-views')
  })

  // 只追加,不重排——新路由必须夹在 /photos/places/:key 与 /login 之间,且两者本身的
  // 相对顺序不能被打乱(同上 P6a-T11 的既有手法,行序比较而非 getRoutes() 下标——vue-router 4
  // 会把动态段路由排到静态之前,P6b-T9 实测过,下标比较会得出错误结论)。
  it('/photos/smart-views 追加在 /photos/places/:key 之后、/login 之前(只追加,不重排)', () => {
    const placesKeyIdx = routerIndexRaw.indexOf(\`{ path: '/photos/places/:key'\`)
    const smartViewsIdx = routerIndexRaw.indexOf(\`{ path: '/photos/smart-views'\`)
    const loginIdx = routerIndexRaw.indexOf(\`{ path: '/login'\`)
    expect(placesKeyIdx).toBeGreaterThan(-1)
    expect(smartViewsIdx).toBeGreaterThan(placesKeyIdx)
    expect(loginIdx).toBeGreaterThan(smartViewsIdx)
  })

  // SP7-P7a-T6:/photos/smart-views/:id 详情路由,同上既定手法(行序比较 + 真 resolve)。
  it('/photos/smart-views/7 命中 photos-smart-view-detail 路由,params.id 为字符串 "7"', () => {
    const m = router.resolve('/photos/smart-views/7')
    expect(m.name).toBe('photos-smart-view-detail')
    expect(m.params.id).toBe('7')
  })

  it('/photos/smart-views/:id 追加在 /photos/smart-views 之后、/login 之前(只追加,不重排)', () => {
    const listIdx = routerIndexRaw.indexOf(\`{ path: '/photos/smart-views'\`)
    const detailIdx = routerIndexRaw.indexOf(\`{ path: '/photos/smart-views/:id'\`)
    const loginIdx = routerIndexRaw.indexOf(\`{ path: '/login'\`)
    expect(listIdx).toBeGreaterThan(-1)
    expect(detailIdx).toBeGreaterThan(listIdx)
    expect(loginIdx).toBeGreaterThan(detailIdx)
  })
`,
    replace: '' },

  // ── src/i18n/parity.test.ts:P6a/P6b 的地点域键守卫整块删除 ────────────────
  //    它断言 photosPlaces* 键齐备、中文不含工程词、insight 插值槽两语言一致 —— 分片删掉
  //    之后这些键一个都不存在。前半段(locale parity / 值非空 / 分片不覆盖基座)与相册无关,
  //    保留。这里连块首那行注释一起摘,免得留下悬空注释。
  { path: 'src/i18n/parity.test.ts',
    find: `/* P6a-T4:地点域键的完整性与术语守卫。 */
describe('photosPlaces 键(SP7-P6a)', () => {
  it('六个大洲键齐备,且 regionLabelKey 的返回值全部有译文', async () => {
    const { regionLabelKey } = await import('../photos/util/placesMap')
    for (const id of ['asia', 'americas', 'europe', 'africa', 'oceania', 'antarctica']) {
      const k = regionLabelKey(id)!
      expect(zh).toHaveProperty(k)
      expect(en).toHaveProperty(k)
    }
  })

  it('中文文案不含工程词「簇」「聚类」「气泡」', () => {
    const bad = Object.entries(zh)
      .filter(([k]) => k.startsWith('photosPlaces'))
      .filter(([, v]) => typeof v === 'string' && /簇|聚类|气泡/.test(v))
    expect(bad).toEqual([])
  })

  /* P6b-T1:地点详情面板键的完整性与插值槽守卫。 */
  it('P6b 地点键在两个 locale 都存在且无空值', () => {
    const keys = ['photosPlacesHomeBase', 'photosPlacesSpotResetName', 'photosPlacesCoverPageInfo',
      'photosPlacesInsightHome', 'photosPlacesInsightHomeBase', 'photosPlacesVisitHistory']
    for (const k of keys) {
      expect(String((zh as Record<string, unknown>)[k] ?? '')).not.toBe('')
      expect(String((en as Record<string, unknown>)[k] ?? '')).not.toBe('')
    }
  })
  it('insight 键的插值占位符两个 locale 完全一致(漏一个槽 <i18n-t> 会静默丢内容)', () => {
    const slots = (s: string) => (s.match(/\\{[a-zA-Z]+\\}/g) ?? []).sort()
    for (const k of ['photosPlacesInsightMostPhotographed', 'photosPlacesInsightTopSpot',
      'photosPlacesInsightCompanions', 'photosPlacesInsightHome']) {
      expect(slots(String((zh as Record<string, string>)[k]))).toEqual(slots(String((en as Record<string, string>)[k])))
    }
  })
})
`,
    replace: '' },

  // ── src/i18n/{zh_cn,en_us}.ts:3 行合并出口去掉 photos 那一路 ──────────────
  //    分片文件已在 DELETE 表,这里只需把出口里的 import 与展开摘掉。**改一行文案不会
  //    动这里** —— 这正是 SP7-P8b 把相册文案拆出去换来的:开源侧对相册文案的耦合从
  //    约 90 条锚点收敛成下面这 4 条,且锚的是结构、不是文案。
  { path: 'src/i18n/zh_cn.ts',
    find: "import base from './zh_cn.base'\nimport photos from './zh_cn.photos'\n\nexport default { ...base, ...photos }\n",
    replace: "import base from './zh_cn.base'\n\nexport default { ...base }\n" },
  { path: 'src/i18n/en_us.ts',
    find: "import base from './en_us.base'\nimport photos from './en_us.photos'\n\nexport default { ...base, ...photos }\n",
    replace: "import base from './en_us.base'\n\nexport default { ...base }\n" },
  //    出口文件头那段"为什么拆"的注释整段撤掉:开源版里没有相册区,解释"相册文案怎么
  //    剥离"既无意义又泄露内部流程(E7)。zh 侧是长段、en 侧是一行,分别处理。
  { path: 'src/i18n/zh_cn.ts',
    find: `// SP7-P8b:本文件从"一整份文案表"改成 3 行的**合并出口**,真正的内容拆成两块:
//   zh_cn.base.ts   —— 全区共用 + 各区自己的文案
//   zh_cn.photos.ts —— 相册区那 702 个 photos* 键
//
// 为什么拆:开源版没有相册区,\`oss/manifest.mjs\` 要把相册文案剥掉。原先那 702 个键散在
// 主文件 90 多个区段里,剥它们意味着 ~90 条锚点补丁 × 2 语言 —— 而 PATCH 要求锚点命中恰好
// 1 次,以后**改任何一条相册文案都会把开源导出打红**。拆开之后开源侧只需:删掉
// zh_cn.photos.ts 一个文件 + 把下面那行 photos 展开补丁掉。
//
// 为什么保留本文件作为出口(而不是让消费方各自 import 两块):全仓有 40+ 个测试
// \`import zh from '…/i18n/zh_cn'\` 自建 createI18n,把它们逐个改成"再多 import 一块"既吵
// 又会在下次分片时重演。出口不动,消费方就一行都不用改。
`,
    replace: `// 中文文案(默认 / fallback locale)。
` },
  { path: 'src/i18n/en_us.ts',
    find: `// SP7-P8b:合并出口 —— 拆分理由与结构说明见 zh_cn.ts 的文件头注释(两语言逐条成对)。
`,
    replace: `// English copy. Key set must stay in parity with zh_cn (see parity.test.ts).
` },

  // ── src/i18n/zh_cn.sp9.ts(folder-permissions 整个四分区,26 键;
  //    FolderPermissionsPanel.vue + folderPerm/ 已在 DELETE 表整体删除,
  //    这 26 个键零消费方——brief 原文只点了 8-10 个样本键,实数 26,已重新核验)──
  { path: 'src/i18n/zh_cn.sp9.ts',
    find: "  settingsTabFolderPermissions: '文件夹权限',\n",
    replace: "" },
  // settingsFpIntro 在这个块里(盲区键,英文侧值只含 smart,守卫不收,靠本条手动清)
  { path: 'src/i18n/zh_cn.sp9.ts',
    find: "  // ── SP9-P4 folder-permissions(四分区) ─────────────────────────────────\n  settingsFpIntro: '在下方各分区分别管理每个智能功能的文件夹。',\n  settingsFpDataPending: '数据源待相册区(SP7)与 AI 区(SP8)合并后接入。',  // 🆕本期新增\n  settingsFpFilenameIndex: '文件名索引',\n  settingsFpServiceOffline: '服务离线',\n  settingsFpFilenameDesc: '纳入文件名搜索索引的文件夹。',\n  settingsFpNoFolders: '暂无文件夹。',\n  settingsFpKnowledge: '知识库',\n  settingsFpKnowledgeDesc: '纳入知识库(RAG)索引的文件夹。',\n  settingsFpIndexedFolders: '索引目录',\n  settingsFpExcludedSubfolders: '排除的子目录',\n  settingsFpAddExclusion: '添加排除',\n  settingsFpNoExclusions: '暂无排除。',\n  settingsFpAiHidden: '禁止 AI 访问的文件夹',\n  settingsFpCurrentUserOnly: '仅当前用户',\n  settingsFpAiDesc: 'AI agent 永远无法看到这些文件夹。',\n  settingsFpNoAiBlocked: '未禁止任何文件夹——除内置系统黑名单外,AI 可访问全部。',\n  settingsFpPhotos: '照片',\n  settingsFpUpdateRequired: '需要更新',\n  settingsFpPhotosDesc: '照片库监视的文件夹。',\n  settingsFpPhotosAuto: '自动模式:Photos 当前监视以下文件夹(动态跟随挂载卷)。',\n  settingsFpSwitchManual: '转为手动管理',\n  settingsFpPhotosStale: 'Photos 服务需要更新后才能在此管理其目录。',\n  settingsFpCoveredBy: '已被 {p} 覆盖',\n  settingsFpGlobRules: '另有 {n} 条模式规则(如 *.key)在 AI 设置中管理。',\n  settingsFpAddFolder: '添加文件夹',\n\n",
    replace: "" },

  // ── src/i18n/en_us.sp9.ts(与上面成对)────────────────────────────────────
  { path: 'src/i18n/en_us.sp9.ts',
    find: "  settingsTabFolderPermissions: 'Folder Permissions',\n",
    replace: "" },
  { path: 'src/i18n/en_us.sp9.ts',
    find: "  // ── SP9-P4 folder-permissions ─────────────────────────────────────────\n  settingsFpIntro: 'Manage each smart feature\\'s folders in its own section below.',\n  settingsFpDataPending: 'Data source pending: to be wired after the Photos (SP7) and AI (SP8) areas are merged.',\n  settingsFpFilenameIndex: 'Filename index',\n  settingsFpServiceOffline: 'Service offline',\n  settingsFpFilenameDesc: 'Folders scanned into the filename search index.',\n  settingsFpNoFolders: 'No folders configured.',\n  settingsFpKnowledge: 'Knowledge base',\n  settingsFpKnowledgeDesc: 'Folders indexed into the knowledge base (RAG).',\n  settingsFpIndexedFolders: 'Indexed folders',\n  settingsFpExcludedSubfolders: 'Excluded subfolders',\n  settingsFpAddExclusion: 'Add exclusion',\n  settingsFpNoExclusions: 'No exclusions.',\n  settingsFpAiHidden: 'Folders hidden from AI',\n  settingsFpCurrentUserOnly: 'Current user only',\n  settingsFpAiDesc: 'The AI agent can never see these folders.',\n  settingsFpNoAiBlocked: 'No folders blocked — the AI may access everything except the built-in system blacklist.',\n  settingsFpPhotos: 'Photos',\n  settingsFpUpdateRequired: 'Update required',\n  settingsFpPhotosDesc: 'Folders watched for the photo library.',\n  settingsFpPhotosAuto: 'Automatic mode: Photos currently watches the folders below (follows mounted volumes).',\n  settingsFpSwitchManual: 'Switch to manual management',\n  settingsFpPhotosStale: 'Photos service needs an update before its column can be managed here.',\n  settingsFpCoveredBy: 'Covered by {p}',\n  settingsFpGlobRules: '{n} pattern rules (e.g. *.key) are managed in AI settings.',\n  settingsFpAddFolder: 'Add folder',\n\n",
    replace: "" },

  // ── SP9-P7:两个 sp9 分片里"Search"整节 20 键(searchReason* 7 / searchBadge* 3 /
  //    searchSource* 3 / searchNoticePrefix 1 / searchEmpty* 3 / searchError* 2 /
  //    searchRetry 1)。SearchDialog.vue 与 src/home/search/** 都已整体删除,20 键全是
  //    孤儿。连同小节标题注释一起删(注释里点名 SearchDialog / spec 章节号 / demo,
  //    本项目发布的是源码本身,注释会逐字进公开仓库)。
  //    锚点从小节前的空行开始吃,避免删完在 kvmToggleCustom 与 `}` 之间留一个空行。
  { path: 'src/i18n/zh_cn.sp9.ts',
    find: "\n  // ── SP9-P7 Search ──(SearchDialog 接真后端;spec §7.5/§7.6/§7.8)\n  // 排序理由标签(reasons.ts 产 key、这里给文案)。demo 时代那些带计数的英文标签\n  // (Body match ×9 / Transcript match ×3)后端根本不返回,是编的,故新标签不带数字。\n  searchReasonFilename: '文件名命中',\n  searchReasonFilenameFuzzy: '文件名相关',\n  searchReasonBody: '正文命中',\n  searchReasonTranscript: '转写命中',\n  searchReasonOcr: '图片文字命中',\n  searchReasonCaption: '图片内容命中',\n  searchReasonSemantic: '语义相关',\n  // 来源徽标(取代 demo 的「98%」准确率——四源分数互不可比,百分比是编的)。\n  // 中文取自 Vue2 zh_CN.json 的 \"Semantic\" / \"Filenames\";OCR 沿用现状不译。\n  searchBadgeSemantic: '语义',\n  searchBadgeFilename: '文件名',\n  searchBadgeOcr: 'OCR',\n  // 降级提示条:哪些源本次没参与。三条源文案逐字取自 Vue2 zh_CN.json。\n  searchSourceSemantic: '语义搜索不可用',\n  searchSourceImages: '图片搜索不可用',\n  searchSourceFilenames: '文件名搜索不可用',\n  searchNoticePrefix: '本次未参与搜索：',\n  // 三种空态(spec §7.8):「没搜到」与「后端没就绪」必须分得开。\n  searchEmptyNoMatch: '没有匹配的文件',   // Vue2 zh_CN.json 逐字\n  searchEmptyNoRoots: '没有可搜索的目录',\n  searchEmptyNotReady: '搜索后端未就绪',\n  // 错误态(请求失败)。标题逐字取自 Vue2 zh_CN.json。\n  searchErrorTitle: '搜索失败',\n  searchErrorHint: '搜索服务当前不可用,请稍后重试',\n  searchRetry: '重试',\n",
    replace: "" },
  { path: 'src/i18n/en_us.sp9.ts',
    find: "\n  // ── SP9-P7 Search ── (SearchDialog wired to the real backend; spec §7.5/§7.6/§7.8)\n  // Ranking-reason chips (reasons.ts produces the key, the copy lives here). The demo-era\n  // labels carried counts (Body match ×9 / Transcript match ×3) that the backend never\n  // returns — they were invented, so the new labels carry no numbers.\n  searchReasonFilename: 'Filename match',\n  searchReasonFilenameFuzzy: 'Filename related',\n  searchReasonBody: 'Body match',\n  searchReasonTranscript: 'Transcript match',\n  searchReasonOcr: 'Text in image',\n  searchReasonCaption: 'Image content match',\n  searchReasonSemantic: 'Semantically related',\n  // Source badges (replacing the demo's \"98%\" accuracy — the four sources' scores are\n  // not comparable, so the percentage was fabricated). Copy from Vue2's \"Semantic\" /\n  // \"Filenames\"; OCR keeps the existing wording.\n  searchBadgeSemantic: 'Semantic',\n  searchBadgeFilename: 'Filenames',\n  searchBadgeOcr: 'OCR',\n  // Degradation notice: which sources sat this search out.\n  searchSourceSemantic: 'Semantic search unavailable',\n  searchSourceImages: 'Photo search unavailable',\n  searchSourceFilenames: 'Filename search unavailable',\n  searchNoticePrefix: 'Not included in this search:',\n  // Three empty states (spec §7.8): \"found nothing\" must stay distinguishable from\n  // \"backend was not up\".\n  searchEmptyNoMatch: 'No matching files',\n  searchEmptyNoRoots: 'No searchable folders',\n  searchEmptyNotReady: 'Search backend not ready',\n  // Error state (request failed).\n  searchErrorTitle: 'Search failed',\n  searchErrorHint: 'The search service is unavailable, please retry',\n  searchRetry: 'Retry',\n",
    replace: "" },

  // ── 复审 Important:settingsAppsPendingDisabledHint 是活键(AppsPanel.vue 保留组件消费),
  //    不能删,但值里点名"相册区/Photos section"——改值不删键,措辞比照 T7 洗白先例
  //    (只说后端能力未就绪,不提功能区名字/迁移计划)。顺带清掉暴露分期开发状态的行内注释。
  { path: 'src/i18n/zh_cn.sp9.ts',
    find: "  settingsAppsPendingDisabledHint: '待相册区迁移完成后启用',                          // 🆕(本期新增标注,做样子)\n",
    replace: "  settingsAppsPendingDisabledHint: '该功能所需的后端能力尚未提供',\n" },
  { path: 'src/i18n/en_us.sp9.ts',
    find: "  settingsAppsPendingDisabledHint: 'Available after the Photos section is migrated',\n",
    replace: "  settingsAppsPendingDisabledHint: 'Requires backend support that is not available yet',\n" },

  // ── 复审第二轮:两个 sp9 locale 文件的头注释——本项目发布的是源码本身(export.mjs
  //    产出源码树,不经 vite 压缩),注释会逐字进公开仓库,不是"构建产物剥注释"就能豁免的。
  //    第 1 行直接点名被剔除的 Search 功能区(真实 scanner 命中),第 2 行提 sp7/sp8(相册/AI
  //    分支代号)+"并行开发"+ 内部 spec 章节号,守卫抓不到但同样是私有开发状态泄漏。
  //    第 3 行(提 parity.test.ts,仓内正常引用)不构成泄漏,保留不动。
  { path: 'src/i18n/zh_cn.sp9.ts',
    find: "// SP9(收尾视图:系统设置 / KVM / Search)文案分片。\n// 与 sp7/sp8 并行开发,分片可让三线几乎不在 i18n 上相撞(spec §4.2 / §9.3)。\n",
    replace: "// 设置 / KVM 等页面的文案分片。\n// 拆成独立文件是为了减少多人协作时的 i18n 合并冲突。\n" },
  { path: 'src/i18n/en_us.sp9.ts',
    find: "// SP9 (final views: Settings / KVM / Search) locale shard. See zh_cn.sp9.ts.\n",
    replace: "// Settings / KVM locale shard. See zh_cn.sp9.ts.\n" },

  // ── src/styles/theme.css(E11:说话人/orb/照片磁贴 token 与类,--wave-none 保留)──
  // 分节标题去掉"照片"(应用/文件夹磁贴结构本身保留)
  { path: 'src/styles/theme.css',
    find: "/* ---- P4c: 应用 / 文件夹 / 照片 磁贴结构 ---- */\n",
    replace: "/* ---- P4c: 应用 / 文件夹 磁贴结构 ---- */\n" },
  // :root 说话人配色注释 + --spk-1..5(锚点跨过 --wave-none,见下条单独删 --wave-dim)
  { path: 'src/styles/theme.css',
    find: "  /* 说话人配色(音频转录/波形,最多 5 色循环;dark 用亮版;避开金色以免与星标混淆) */\n  --spk-1: oklch(0.74 0.13 250);   /* 蓝 */\n  --spk-2: oklch(0.72 0.13 305);   /* 紫 */\n  --spk-3: oklch(0.77 0.12 190);   /* 青 */\n  --spk-4: oklch(0.73 0.15 18);    /* 珊瑚 */\n  --spk-5: oklch(0.79 0.14 150);   /* 绿 */\n",
    replace: "" },
  // :root --wave-dim(--wave-none 保留,两者不连续,分开删)
  { path: 'src/styles/theme.css',
    find: "  --wave-dim: var(--fg-faint);     /* 波形:过滤时被弱化的竖条 */\n",
    replace: "" },
  // light 主题同一批 --spk-1..5
  { path: 'src/styles/theme.css',
    find: "  /* 说话人配色(白色纸感用暗版,同 hue 系) */\n  --spk-1: oklch(0.52 0.15 255);\n  --spk-2: oklch(0.50 0.16 305);\n  --spk-3: oklch(0.53 0.12 200);\n  --spk-4: oklch(0.55 0.18 22);\n  --spk-5: oklch(0.52 0.15 150);\n",
    replace: "" },
  // light 主题 --wave-dim
  { path: 'src/styles/theme.css',
    find: "  --wave-dim: var(--fg-faint);\n",
    replace: "" },
  // :root --orb-core/--orb-glow,唯一消费方 AiWidget.vue 已删
  { path: 'src/styles/theme.css',
    find: "  --orb-core: #2a3566;\n  --orb-glow: rgba(138, 180, 255, 0.5);\n",
    replace: "" },
  // light 主题同一对
  { path: 'src/styles/theme.css',
    find: "  --orb-core: #d9def5;\n  --orb-glow: rgba(59, 91, 219, 0.4);\n",
    replace: "" },
  { path: 'src/styles/theme.css',
    find: "@keyframes pulse { 50% { box-shadow: 0 0 54px var(--orb-glow); } }\n",
    replace: "" },
  // "照片磁贴"分节标题 + .kind-photo + .photo-thumb
  { path: 'src/styles/theme.css',
    find: "/* 照片磁贴 */\n.kind-photo { padding: 0; }\n.photo-thumb { display: block; width: 100%; height: 100%; border-radius: var(--radius, 28px); border: 1px solid var(--card-border); box-shadow: var(--icon-shadow); }\n",
    replace: "" },
  { path: 'src/styles/theme.css',
    find: ".ic-photos   { background: conic-gradient(from 20deg, #ff735f, #ffd54f, #60e27c, #55baff, #ca83ff, #ff735f); }\n",
    replace: "" },
  // .ic-ai 消费的 --orb-core 已随上面删除,该规则本身也删
  { path: 'src/styles/theme.css',
    find: ".ic-ai       { background: radial-gradient(circle at 64% 24%, var(--accent2), transparent 40%), radial-gradient(circle at 28% 80%, var(--accent), transparent 46%), var(--orb-core, #1a2050); }\n",
    replace: "" },
  { path: 'src/styles/theme.css',
    find: ".ic-search   { background: linear-gradient(145deg, #c4b5fd, #8b5cf6 60%, #6d28d9); }\n",
    replace: "" },
  // .photo-thumb.has-img 两条
  { path: 'src/styles/theme.css',
    find: ".photo-thumb.has-img { background: none; overflow: hidden; }\n.photo-thumb.has-img img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; display: block; }\n",
    replace: "" },
  // 从共享 transition 规则的选择器列表里摘掉 .kind-photo .photo-thumb,其余 3 个选择器保留
  { path: 'src/styles/theme.css',
    find: ".kind-folder .folder-ic,\n.kind-photo .photo-thumb { transition: transform .18s var(--ease, ease), box-shadow .18s var(--ease, ease), filter .18s var(--ease, ease); }",
    replace: ".kind-folder .folder-ic { transition: transform .18s var(--ease, ease), box-shadow .18s var(--ease, ease), filter .18s var(--ease, ease); }" },
  // 同上,z-index 提升规则
  { path: 'src/styles/theme.css',
    find: ".grid-item:not(.editing).kind-folder:hover,\n.grid-item:not(.editing).kind-photo:hover { z-index: 6; }",
    replace: ".grid-item:not(.editing).kind-folder:hover { z-index: 6; }" },
  // 同上,悬停放大规则(声明体本身不含 photo 相关内容,保留)
  { path: 'src/styles/theme.css',
    find: ".grid-item:not(.editing).kind-folder:hover .folder-ic,\n.grid-item:not(.editing).kind-photo:hover .photo-thumb {",
    replace: ".grid-item:not(.editing).kind-folder:hover .folder-ic {" },
  // 同上,按压反馈规则
  { path: 'src/styles/theme.css',
    find: ".grid-item:not(.editing).kind-folder:active .folder-tile,\n.grid-item:not(.editing).kind-photo:active .photo-thumb { transform: scale(.95); transition: transform .1s var(--ease, ease); }",
    replace: ".grid-item:not(.editing).kind-folder:active .folder-tile { transform: scale(.95); transition: transform .1s var(--ease, ease); }" },

  // ═══════════════════ T13:测试同步(混合型文件抠用例/改内容) ══════════════

  // ── useOpenAction.test.ts:4 处断言 window.location.href 的用例,在开源版
  //    SYS_ROUTE/cutoverDisabled 改法下行为已变(§8.2 有意偏离),整块删除 ──────
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: `  it('settings 维持 /#/legacy(P8 cutover 不动它)', () => {
    const { openApp } = useOpenAction()
    openApp('settings'); expect(hrefs[0]).toBe('/#/legacy')
    expect(router.push).not.toHaveBeenCalled()
  })
`,
    replace: '' },
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: `  it('回退 flag strangler:disabled:/apps==1 时 appstore 退回 /#/legacy', () => {
    localStorage.setItem('strangler:disabled:/apps', '1')
    const { openApp } = useOpenAction()
    openApp('appstore')
    expect(hrefs[0]).toBe('/#/legacy')
    expect(router.push).not.toHaveBeenCalled()
    localStorage.removeItem('strangler:disabled:/apps')
  })
`,
    replace: '' },
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: `  it('回退 flag strangler:disabled:/storage==1 时 storage 退回 /#/legacy', () => {
    localStorage.setItem('strangler:disabled:/storage', '1')
    const { openApp } = useOpenAction()
    openApp('storage')
    expect(hrefs[0]).toBe('/#/legacy')
    expect(router.push).not.toHaveBeenCalled()
    localStorage.removeItem('strangler:disabled:/storage')
  })
`,
    replace: '' },
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: `  it('photo 磁贴应用内 push /photos(SP7-P8b cutover)', () => {
    const { openItem } = useOpenAction()
    openItem({ id: 'i', kind: 'photo', key: 'abc', c: 1, r: 1, w: 2, h: 2 } as LayoutItem)
    expect(router.push).toHaveBeenCalledWith('/photos')
    expect(hrefs.length).toBe(0)
  })
  it('photo 磁贴:回退 flag 置 1 时退回 Vue2 /#/photos', () => {
    localStorage.setItem('strangler:disabled:/photos', '1')
    const { openItem } = useOpenAction()
    openItem({ id: 'i', kind: 'photo', key: 'abc', c: 1, r: 1, w: 2, h: 2 } as LayoutItem)
    expect(hrefs[0]).toBe('/#/photos')
    expect(router.push).not.toHaveBeenCalled()
    localStorage.removeItem('strangler:disabled:/photos')
  })
`,
    replace: '' },
  // SP7-P8b 新增的三条 photos 磁贴用例:开源版没有相册区,'photos' 不是系统应用,
  // 三条全删(前两条断言相册路由,第三条断言"photos 的 flag 不影响别人")。
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: `  it('photos 磁贴应用内 router.push /photos(SP7-P8b cutover)', () => {
    const { openApp } = useOpenAction()
    openApp('photos')
    expect(router.push).toHaveBeenCalledWith('/photos')
    expect(hrefs.length).toBe(0)
  })
  it('回退 flag strangler:disabled:/photos==1 时 photos 退回 Vue2 /#/photos(不是 /#/legacy)', () => {
    localStorage.setItem('strangler:disabled:/photos', '1')
    const { openApp } = useOpenAction()
    openApp('photos')
    expect(hrefs[0]).toBe('/#/photos')
    expect(router.push).not.toHaveBeenCalled()
    localStorage.removeItem('strangler:disabled:/photos')
  })
  it('photos 那把 flag 不影响 storage / appstore', () => {
    localStorage.setItem('strangler:disabled:/photos', '1')
    const { openApp } = useOpenAction()
    openApp('storage')
    expect(router.push).toHaveBeenCalledWith('/storage')
    openApp('appstore')
    expect(router.push).toHaveBeenCalledWith('/apps/store')
    expect(hrefs.length).toBe(0)
    localStorage.removeItem('strangler:disabled:/photos')
  })
`,
    replace: '' },
  // beforeEach 里那把 /photos flag 的清理也跟着撤(开源版无此 flag)
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: "  localStorage.removeItem('strangler:disabled:/photos')\n",
    replace: '' },

  // ── HomeTopbar.test.ts:唯一的搜索胶囊用例,组件本身已在 T6 删掉 .search-btn ───
  { path: 'src/home/components/HomeTopbar.test.ts',
    find: `  it('search button opens the search palette', async () => {
    const ui = useHomeUiStore()
    const w = mount(HomeTopbar)
    expect(ui.searchOpen).toBe(false)
    await w.get('.search-btn').trigger('click')
    expect(ui.searchOpen).toBe(true)
  })
`,
    replace: '' },

  // ── GridItem.click.test.ts:唯一的照片瓦片点击用例,'photo' 已不是合法 Kind ──
  { path: 'src/home/components/GridItem.click.test.ts',
    find: `  it('clicking a photo pushes /photos(SP7-P8b cutover)', async () => {
    const item: LayoutItem = { id: 'p', kind: 'photo', key: 'linear-gradient(0,#000)', c: 1, r: 1, w: 2, h: 2 }
    const w = mount(GridItem, { props: { item } })
    await w.get('[data-id="p"]').trigger('click')
    expect(router.push).toHaveBeenCalledWith('/photos')
    expect(hrefs.length).toBe(0)
  })
`,
    replace: '' },

  // ── MobileHome.test.ts:mock 里的 sendToAI(T6 已删该函数)+ seed() 的照片项 +
  //    随之改变的瓦片计数/顺序断言 + 唯一的照片瓦片专项用例(整块删除)────────
  { path: 'src/home/components/MobileHome.test.ts',
    find: `vi.mock('../composables/useOpenAction', () => ({
  useOpenAction: () => ({ openItem, openApp: vi.fn(), sendToAI: vi.fn() }),
}))
`,
    replace: `vi.mock('../composables/useOpenAction', () => ({
  useOpenAction: () => ({ openItem, openApp: vi.fn() }),
}))
` },
  { path: 'src/home/components/MobileHome.test.ts',
    find: `  layout.items = [
    item({ id: 'w1', kind: 'widget', key: 'clock', c: 1, r: 1, w: 2, h: 2 }),
    item({ key: 'files', c: 3, r: 1 }),
    item({ id: 'ph', kind: 'photo', key: 'linear-gradient(#fff,#000)', c: 4, r: 2, w: 2, h: 2 }),
    item({ id: 'fd', kind: 'folder', key: 'Documents', c: 1, r: 3, path: '/DATA/Documents' }),
  ]
`,
    replace: `  layout.items = [
    item({ id: 'w1', kind: 'widget', key: 'clock', c: 1, r: 1, w: 2, h: 2 }),
    item({ key: 'files', c: 3, r: 1 }),
    item({ id: 'fd', kind: 'folder', key: 'Documents', c: 1, r: 3, path: '/DATA/Documents' }),
  ]
` },
  { path: 'src/home/components/MobileHome.test.ts',
    find: `  it('splits widgets (full-width) from tiles (icon grid) in desktop visual order', () => {
    seed()
    const w = mount(MobileHome, { global: { plugins: [i18n] } })
    expect(w.findAll('.m-widget')).toHaveLength(1)
    const tiles = w.findAll('.m-tile')
    expect(tiles).toHaveLength(3)
    expect(tiles.map((t) => t.classes().some((c) => c === 'kind-app' || c === 'kind-photo' || c === 'kind-folder')))
      .toEqual([true, true, true])
    // 顺序:files(r1) → photo(r2) → folder(r3)
    expect(tiles[0].classes()).toContain('kind-app')
    expect(tiles[1].classes()).toContain('kind-photo')
    expect(tiles[2].classes()).toContain('kind-folder')
  })
`,
    replace: `  it('splits widgets (full-width) from tiles (icon grid) in desktop visual order', () => {
    seed()
    const w = mount(MobileHome, { global: { plugins: [i18n] } })
    expect(w.findAll('.m-widget')).toHaveLength(1)
    const tiles = w.findAll('.m-tile')
    expect(tiles).toHaveLength(2)
    expect(tiles.map((t) => t.classes().some((c) => c === 'kind-app' || c === 'kind-folder')))
      .toEqual([true, true])
    // 顺序:files(r1) → folder(r3)
    expect(tiles[0].classes()).toContain('kind-app')
    expect(tiles[1].classes()).toContain('kind-folder')
  })
` },
  { path: 'src/home/components/MobileHome.test.ts',
    find: `  it('marks photo tiles as 2x2 spans', () => {
    seed()
    const w = mount(MobileHome, { global: { plugins: [i18n] } })
    expect(w.find('.m-photo').exists()).toBe(true)
    expect(w.find('.m-photo').classes()).toContain('kind-photo')
  })

`,
    replace: '' },

  // ── defaultLayout.test.ts:两条坐标无关的通用断言全部保留(覆盖新 15 项布局),
  //    只有 WIDGETS registry 计数从 7→6(ai 小组件已删)需要改 ──────────────────
  { path: 'src/home/grid/defaultLayout.test.ts',
    find: `  it('carries min/max/default for the 7 widgets', () => {
    expect(Object.keys(WIDGETS).sort()).toEqual(['ai', 'clock', 'cpu', 'events', 'gpu', 'network', 'storage'])
`,
    replace: `  it('carries min/max/default for the 6 widgets', () => {
    expect(Object.keys(WIDGETS).sort()).toEqual(['clock', 'cpu', 'events', 'gpu', 'network', 'storage'])
` },

  // ── tabs.test.ts:folder-permissions 已删(9→8 tab,7→6 rail),railTabsFor 退化
  //    为无参恒等 —— 4 处旧签名调用 railTabsFor(role) 会编译报错,连同它测的
  //    「按角色隐藏 folder-permissions」这整块行为(已不存在)一起删除 ──────────
  { path: 'src/settings/util/tabs.test.ts',
    find: `  isSettingsTab,
  railTabsFor,
} from './tabs'`,
    replace: `  isSettingsTab,
} from './tabs'` },
  { path: 'src/settings/util/tabs.test.ts',
    find: `  it('9 个 tab,顺序与 Vue2 一致(rail 7 项 + account + developer)', () => {
    expect(SETTINGS_TABS).toEqual([
      'general',
      'storage',
      'network',
      'apps',
      'terminal',
      'system-status',
      'folder-permissions',
      'account',
      'developer',
    ])
  })`,
    // I5-guard(⑤b)复核:原标题带 "Vue2"(REPLACE-only 时代未覆盖到 PATCH,漏检)。
    replace: `  it('8 个 tab,顺序固定(rail 6 项 + account + developer)', () => {
    expect(SETTINGS_TABS).toEqual([
      'general',
      'storage',
      'network',
      'apps',
      'terminal',
      'system-status',
      'account',
      'developer',
    ])
  })` },
  { path: 'src/settings/util/tabs.test.ts',
    find: `  it('rail 只有 7 项 —— account 走用户块、developer 走 general 页内入口(Vue2 L855-863/L13/L315)', () => {
    expect(RAIL_TABS).toEqual([
      'general',
      'storage',
      'network',
      'apps',
      'terminal',
      'system-status',
      'folder-permissions',
    ])
  })`,
    // I5-guard(⑤b)复核:原标题带 "Vue2 L855-863/L13/L315"(旧代码具体行号引用,
    // REPLACE-only 时代未覆盖到 PATCH,漏检)。
    replace: `  it('rail 只有 6 项 —— account 走用户块、developer 走 general 页内入口', () => {
    expect(RAIL_TABS).toEqual([
      'general',
      'storage',
      'network',
      'apps',
      'terminal',
      'system-status',
    ])
  })` },
  { path: 'src/settings/util/tabs.test.ts',
    find: `
  it('admin 看到全部 7 项', () => {
    expect(railTabsFor('admin')).toEqual(RAIL_TABS)
  })

  it('非 admin 看不到 folder-permissions(Vue2 visibleTabs L1034)', () => {
    expect(railTabsFor('user')).not.toContain('folder-permissions')
    expect(railTabsFor('user')).toHaveLength(6)
  })

  it('role 缺失按非 admin 处理(保守:不泄漏管理项)', () => {
    expect(railTabsFor(undefined)).not.toContain('folder-permissions')
  })
})
`,
    replace: `
})
` },

  // ── panels.test.ts:folder-permissions 那个 tab 没了,PANEL_BY_TAB 键数 9→8,
  //    历史注释里有一处点名了已删的 FolderPermissionsPanel.test.ts(悬空引用)───
  { path: 'src/settings/panels/panels.test.ts',
    find: '    expect(Object.keys(PANEL_BY_TAB)).toHaveLength(9)\n',
    replace: '    expect(Object.keys(PANEL_BY_TAB)).toHaveLength(8)\n' },
  { path: 'src/settings/panels/panels.test.ts',
    find: `  // P4 起 folder-permissions 与 account 也填了真实内容
  // (见 FolderPermissionsPanel.test.ts / AccountPanel.test.ts)——**至此 9 个 tab 全部实现完毕,
  // 骨架抽查已经没有对象了**(原来那条 it.each 与「骨架的文案 key 都有译文」两条随之收口)。`,
    replace: `  // account 也填了真实内容(见 AccountPanel.test.ts)——**至此所有 tab 全部实现完毕,
  // 骨架抽查已经没有对象了**(原来那条 it.each 与「骨架的文案 key 都有译文」两条随之收口)。` },

  // ── AppsPanel.test.ts:fixture 第 4 个 key 改名(photos_data 是 HARD 禁词,
  //    且组件本身只认 app_data/images/database,第 4 个 key 叫什么都无所谓)+
  //    待上传缓存禁用态标注的断言跟着 T7 洗白后的新文案走(HARD 禁词「相册」)──
  { path: 'src/settings/panels/AppsPanel.test.ts',
    find: "  photos_data: { path: '/DATA/.system_data/photos', size: 6242024935 },\n",
    replace: "  other_data: { path: '/DATA/.system_data/other', size: 6242024935 },\n" },
  { path: 'src/settings/panels/AppsPanel.test.ts',
    find: "  it('渲染三行数据位置 —— 后端给了 4 个 key(含 photos_data),界面 1:1 只显示 3 行', async () => {",
    replace: "  it('渲染三行数据位置 —— 后端给了 4 个 key(含未知的第 4 个 key),界面 1:1 只显示 3 行', async () => {" },
  { path: 'src/settings/panels/AppsPanel.test.ts',
    find: '  it(\'清理本地待上传缓存行:UI 在、按钮禁用、带待相册区迁移的标注(政策三"做样子")\', async () => {',
    // I5-guard(⑤b)复核:原标题仍带 "政策三"做样子""(REPLACE-only 时代未覆盖到 PATCH,漏检)。
    replace: '  it(\'清理本地待上传缓存行:UI 在、按钮禁用、带禁用态标注\', async () => {' },
  { path: 'src/settings/panels/AppsPanel.test.ts',
    find: "    expect(w.text()).toContain('待相册区迁移完成后启用')\n",
    replace: "    expect(w.text()).toContain('该功能所需的后端能力尚未提供')\n" },

  // ── appPaths.test.ts:同一份 fixture 的 photos_data 键改名(HARD 禁词)────────
  { path: 'src/settings/util/appPaths.test.ts',
    find: "  photos_data: { path: '/DATA/.system_data/photos', size: 6242024935 },\n",
    replace: "  other_data: { path: '/DATA/.system_data/other', size: 6242024935 },\n" },
  { path: 'src/settings/util/appPaths.test.ts',
    find: "  it('恒返回 3 行且顺序固定 —— 后端给了 4 个 key(含 photos_data),Vue2 只渲染 3 行', () => {",
    // I5-guard(⑤b)复核:原标题仍带 "Vue2"(REPLACE-only 时代未覆盖到 PATCH,漏检)。
    replace: "  it('恒返回 3 行且顺序固定 —— 后端给了 4 个 key(含未知的第 4 个 key),只渲染前 3 行', () => {" },

  // ── installedApps.test.ts:注释点名 AI agent / Photos ML,措辞对齐 T7 洗白后
  //    的孪生产品代码注释(installedApps.ts 同一行,已在上面改过) ─────────────
  { path: 'src/apps/stores/installedApps.test.ts',
    find: "  it('refresh 过滤系统幕后容器(nimoos.system=true,如 AI agent / Photos ML)', async () => {",
    replace: "  it('refresh 过滤系统幕后容器(nimoos.system=true,供其他应用使用的内部服务容器)', async () => {" },

  // ── systemApp.test.ts:文件头注释独立复述了同一段解释,同样点名 Photos ML,
  //    与 systemApp.ts 源文件那处 T7 洗白对齐(该文件本身不在 REPLACE/PATCH 表里
  //    改过,是测试文件自己写的第二份类似文案)─────────────────────────────────
  { path: 'src/apps/util/systemApp.test.ts',
    find: `// 后端 isSystemComposeApp(route/v2/internal_web.go)的前端等价物:
// compose 任一 service 的 label \`nimoos.system == "true"\` 即系统幕后组件,
// 应从面向用户的应用管理页隐藏(agent 运行时 / Photos ML 后端等)。
`,
    replace: `// 后端 isSystemComposeApp(route/v2/internal_web.go)的前端等价物:
// compose 任一 service 的 label \`nimoos.system == "true"\` 即系统幕后组件,
// 应从面向用户的应用管理页隐藏(供其他应用使用的内部服务容器等)。
` },

  // ── locale.test.ts:mock blob 里的 search_switch(E2 已从 systemConfig 类型删除
  //    该字段;这条用例本意是测"读-改-写保留未知字段",字段叫什么不影响语义,
  //    换个不涉及被删功能的占位字段名即可)────────────────────────────────────
  { path: 'src/stores/locale.test.ts',
    find: `    getCustomStorage.mockResolvedValueOnce({ timezone: 'UTC', search_switch: true })
    await useLocaleStore().persist('en_us')
    expect(setCustomStorage).toHaveBeenCalledTimes(1)
    expect(setCustomStorage.mock.calls[0]?.[0]).toBe('system')
    expect(setCustomStorage.mock.calls[0]?.[1]).toEqual({ timezone: 'UTC', search_switch: true, lang: 'en_us' })
`,
    replace: `    getCustomStorage.mockResolvedValueOnce({ timezone: 'UTC', other_flag: true })
    await useLocaleStore().persist('en_us')
    expect(setCustomStorage).toHaveBeenCalledTimes(1)
    expect(setCustomStorage.mock.calls[0]?.[0]).toBe('system')
    expect(setCustomStorage.mock.calls[0]?.[1]).toEqual({ timezone: 'UTC', other_flag: true, lang: 'en_us' })
` },

  // ── eventMap.test.ts:i18nName() 只是拿 JSON 取字段做单测,样本值恰好写成
  //    HARD 禁词「相册」,换成任意非候选词的中文即可(eventMap.ts 本身与 AI/相册
  //    无关,零消费方核实见 task-13-report.md/chinese-leaks.md T13 节)────────
  { path: 'src/home/util/eventMap.test.ts',
    find: `    expect(i18nName('{"zh_cn":"相册"}')).toBe('相册')
`,
    replace: `    expect(i18nName('{"zh_cn":"文档"}')).toBe('文档')
` },

  // ── useDock.test.ts / useDock.reorder.test.ts:DEFAULT_FAV 已从 5 项(含
  //    photos/ai)改成 4 项(files/storage/vm/appstore,T6),且 systemApps 里
  //    已经没有 photos/ai 这两个 key 了 —— apps.app('photos'/'ai') 恒 undefined,
  //    setFav 会把它们过滤掉,断言必须换成 oss 版仍然存在的 key ──────────────
  { path: 'src/home/composables/useDock.test.ts',
    find: `  it('defaults favKeys to the 5 dock keys and computes moreKeys as the rest', () => {
    useAppsStore() // 系统 6 应用就位
    const d = useDock()
    expect(d.favKeys.value).toEqual(['files', 'photos', 'ai', 'vm', 'appstore'])
    expect(d.moreKeys.value).toContain('settings') // 第 6 个系统应用进 more
    expect(d.moreKeys.value).not.toContain('files')
  })
  it('setFav persists to localStorage', () => {
    useAppsStore()
    const d = useDock()
    d.setFav(['files', 'photos'])
    expect(JSON.parse(localStorage.getItem('nimoos.home.dockfav')!)).toEqual(['files', 'photos'])
    expect(d.moreKeys.value).toContain('ai')
  })`,
    replace: `  it('defaults favKeys to the 4 dock keys and computes moreKeys as the rest', () => {
    useAppsStore() // 系统 5 应用就位
    const d = useDock()
    expect(d.favKeys.value).toEqual(['files', 'storage', 'vm', 'appstore'])
    expect(d.moreKeys.value).toContain('settings') // 第 5 个系统应用进 more
    expect(d.moreKeys.value).not.toContain('files')
  })
  it('setFav persists to localStorage', () => {
    useAppsStore()
    const d = useDock()
    d.setFav(['files', 'storage'])
    expect(JSON.parse(localStorage.getItem('nimoos.home.dockfav')!)).toEqual(['files', 'storage'])
    expect(d.moreKeys.value).toContain('vm')
  })` },
  { path: 'src/home/composables/useDock.reorder.test.ts',
    find: `  it('moves a more-key into favorites before a given key', () => {
    useAppsStore()
    const d = useDock()
    d.setFav(['files', 'photos'])
    d.reorder('settings', 'fav', 'photos') // settings(more) 插到 photos 前
    expect(d.favKeys.value).toEqual(['files', 'settings', 'photos'])
  })`,
    replace: `  it('moves a more-key into favorites before a given key', () => {
    useAppsStore()
    const d = useDock()
    d.setFav(['files', 'vm'])
    d.reorder('settings', 'fav', 'vm') // settings(more) 插到 vm 前
    expect(d.favKeys.value).toEqual(['files', 'settings', 'vm'])
  })` },
  { path: 'src/home/composables/useDock.reorder.test.ts',
    find: `  it('moves a fav-key out to more (drop at end of more)', () => {
    useAppsStore()
    const d = useDock()
    d.setFav(['files', 'photos', 'ai'])
    d.reorder('ai', 'more', null)
    expect(d.favKeys.value).not.toContain('ai')
  })`,
    replace: `  it('moves a fav-key out to more (drop at end of more)', () => {
    useAppsStore()
    const d = useDock()
    d.setFav(['files', 'storage', 'vm'])
    d.reorder('vm', 'more', null)
    expect(d.favKeys.value).not.toContain('vm')
  })` },
  // 复审:注释里点名的示例 key 'photos'/'ai' 也已经不存在了(纯注释,不影响断言,
  // 但会让人以为这两个 key 还在 —— 顺手换成仍然存在的示例)
  { path: 'src/home/composables/useDock.reorder.test.ts',
    find: "    // moreKeys should now contain all other apps including 'photos', 'ai', etc.\n",
    replace: "    // moreKeys should now contain all other apps besides 'files', etc.\n" },
  { path: 'src/home/composables/useDock.reorder.test.ts',
    find: `  it('reorder more→fav: inserts before a given fav key', () => {
    useAppsStore()
    const d = useDock()
    d.setFav(['files', 'photos'])
    // settings is in more; reorder into fav before 'photos'
    d.reorder('settings', 'fav', 'photos')
    expect(d.favKeys.value).toEqual(['files', 'settings', 'photos'])
    expect(d.moreKeys.value).not.toContain('settings')
  })`,
    replace: `  it('reorder more→fav: inserts before a given fav key', () => {
    useAppsStore()
    const d = useDock()
    d.setFav(['files', 'vm'])
    // settings is in more; reorder into fav before 'vm'
    d.reorder('settings', 'fav', 'vm')
    expect(d.favKeys.value).toEqual(['files', 'settings', 'vm'])
    expect(d.moreKeys.value).not.toContain('settings')
  })` },

  // ── 复审(实测 pnpm test 才发现,brief 原始清单没覆盖到)────────────────────
  // HomeDock.test.ts:点击 dock 上的 settings 图标,断言方式与 useOpenAction.test.ts
  // 里删掉的那条同源 —— SYS_ROUTE 改内部路由后不再走 window.location.href,
  // 改成断言 mock 的 router.push(同文件顶部已有 router mock,和 files 那条用例同款)。
  { path: 'src/home/components/HomeDock.test.ts',
    find: `  it('expanded: clicking an app opens it and auto-collapses the dock', async () => {
    useAppsStore()
    const hrefs: string[] = []
    Object.defineProperty(window, 'location', { configurable: true, value: { hostname: 'h', set href(v: string) { hrefs.push(v) }, get href() { return '' } } })
    const w = mount(HomeDock)
    await w.get('.dock-toggle').trigger('click')
    expect(w.get('.dock-toggle').attributes('aria-expanded')).toBe('true')
    await w.get('.dock-app[data-app="settings"]').trigger('click')
    expect(hrefs[0]).toBe('/#/legacy')
    expect(w.get('.dock-toggle').attributes('aria-expanded')).toBe('false')
  })`,
    replace: `  it('expanded: clicking an app opens it and auto-collapses the dock', async () => {
    useAppsStore()
    const w = mount(HomeDock)
    await w.get('.dock-toggle').trigger('click')
    expect(w.get('.dock-toggle').attributes('aria-expanded')).toBe('true')
    await w.get('.dock-app[data-app="settings"]').trigger('click')
    expect(router.push).toHaveBeenCalledWith('/settings')
    expect(w.get('.dock-toggle').attributes('aria-expanded')).toBe('false')
  })` },
  // 全部应用抽屉的应用总数:oss 只有 5 个系统应用(files/storage/vm/appstore/settings,
  // T6 删了 photos/ai),抽屉里 .dock-app 数量恒等于 apps.order.length = 5,不是私有版的 6
  { path: 'src/home/components/HomeDock.test.ts',
    find: `    // 全量 = fav(5) + more(≥1,含设置),多于 dock 条上的 4+1
    expect(sheet!.querySelectorAll('.dock-app').length).toBeGreaterThanOrEqual(6)`,
    replace: `    // 全量 = oss 全部 5 个系统应用(fav 4 + more 里的 settings),多于 dock 条上的 4+1
    expect(sheet!.querySelectorAll('.dock-app').length).toBeGreaterThanOrEqual(5)` },

  // ── SettingsShell.test.ts:railTabsFor 不再按角色过滤,"admin 看到 folder-
  //    permissions" 这整条用例测的行为已经不存在,整块删除(同 tabs.test.ts 那 3 条)──
  { path: 'src/settings/components/SettingsShell.test.ts',
    find: `  it('admin rail 有 7 项且含 folder-permissions', async () => {
    localStorage.setItem('user', JSON.stringify({ username: 'nimo', role: 'admin' }))
    const { w } = await mountShell()
    const items = w.findAll('.set-rail-item')
    expect(items).toHaveLength(7)
    expect(items.map((i) => i.attributes('data-tab'))).toContain('folder-permissions')
  })

`,
    replace: '' },

  // ═══════════════════ T14:守卫接入后新发现的真泄漏(注释/fixture 洗白) ══════
  // 这些都不是"该整块删除的功能"(那是 T6-T13 的活),而是散落的**文字残留**——
  // 注释里直接点名已删组件/服务,或测试 fixture 里混进了真机抓取的敏感值。
  // 词表本身不放宽(qdrant/相册等仍是硬/软禁词),这里只改导出产物里的这几行文字。

  // theme.css:全局滚动条注释列了三个复用场景,其中"搜索"指向已删的 SearchDialog——
  // 去掉这一个场景名,"文件预览/Welcome"两个保留场景不受影响。
  { path: 'src/styles/theme.css',
    find: '复用于搜索、文件预览、Welcome 等一切滚动区',
    replace: '复用于文件预览、Welcome 等一切滚动区' },
  // theme.css:"2.6 环形图 / 迷你图 / AI 光球"分节标题——AiWidget 的光球 token(--orb-core/
  // --orb-glow)T8 已经删了,但标题文字本身被漏网,直接点名"AI"。环形图/迷你图两个真实
  // token(--ring-*/--spark-*)与 AI 无关,标题掐掉后半截即可。
  { path: 'src/styles/theme.css',
    find: '/* 2.6 环形图 / 迷你图 / AI 光球 */',
    replace: '/* 2.6 环形图 / 迷你图 */' },
  // theme.css:两套主题块里"扩展/语义 token"注释各点名了一次 SearchDialog(已删组件)
  // 作为 token 的历史来源说明,MediaViewer 是仍然保留的真实消费方,原样留着。
  { path: 'src/styles/theme.css',
    find: '扩展/语义 token(SearchDialog·MediaViewer 提升为全局;每套主题都给值)。见 THEMING.md §2.12',
    replace: '扩展/语义 token(MediaViewer 提升为全局;每套主题都给值)。见 THEMING.md §2.12' },
  { path: 'src/styles/theme.css',
    find: '扩展/语义 token(白色纸感,取自 SearchDialog/MediaViewer 原浅色板)',
    replace: '扩展/语义 token(白色纸感,取自 MediaViewer 原浅色板)' },

  // StartAppDialog.vue:spinner 样式注释拿已删的 SearchDialog 当参照物,改成不点名。
  { path: 'src/home/components/StartAppDialog.vue',
    find: '/* 与 SearchDialog .spinner 同款:--ring-track 底圈 + --accent 顶弧 */',
    replace: '/* 复用统一 spinner 样式:--ring-track 底圈 + --accent 顶弧 */' },

  // GridItem.vue:CSS 注释里还留着"app/folder/photo"三态,但 'photo' 这个 kind 连同
  // PhotoTile 已经被前面的补丁删干净了——这句纯文字描述没跟着改,补上。
  { path: 'src/home/components/GridItem.vue',
    find: 'is not clipped on app/folder/photo items',
    replace: 'is not clipped on app/folder items' },
  // MobileHome.vue:同一处道理,"photo 磁贴占 2×2"这个分句描述的是已删的 photo 磁贴。
  { path: 'src/home/components/MobileHome.vue',
    find: '图标区:行高=列宽 → 格子恒为正方形;photo 磁贴占 2×2,dense 回填空洞',
    replace: '图标区:行高=列宽 → 格子恒为正方形,dense 回填空洞' },
  // gridMath.test.ts:clampSize 是通用的尺寸吸附逻辑,测试标题里仍在举例"photo"这个
  // 已经不存在的 kind——它不是测试内容(测试本体用的是 kind:'app'),只是标题文字。
  { path: 'src/home/grid/gridMath.test.ts',
    find: "it('snaps app/folder/photo to nearest of 1x1 or 2x2', () => {",
    replace: "it('snaps app/folder to nearest of 1x1 or 2x2', () => {" },

  // dropEntries.ts / dropEntries.test.ts:拖拽上传的通用文件收集逻辑,注释里拿已删的
  // Photos 模块的 collectFilesFromDataTransfer 函数名当对比对象——直接点名了私有功能
  // 内部的函数名,改成不点名的表述,行为对比本身(不按媒体类型过滤/不跳过隐藏文件)保留。
  { path: 'src/files/upload/dropEntries.ts',
    find: '。与 Photos 的 collectFilesFromDataTransfer 不同:不按媒体',
    replace: '。不按媒体' },
  { path: 'src/files/upload/dropEntries.test.ts',
    find: "    // Unlike Photos' collectFilesFromDataTransfer, the file manager's drop path",
    replace: '    // The file manager\'s drop path' },

  // Files.vue:旧格式深链来源说明里点名了 Vue2 时代的 "AI" 功能(打开文件位置的入口
  // 之一),AI 功能整个已经不存在,来源说明改成不点名的"旧版"。
  { path: 'src/views/Files.vue',
    find: '来源:Vue2 AI「打开文件位置」、上传通知、',
    replace: '来源:旧版「打开文件位置」、上传通知、' },

  // useIsoBrowser.test.ts:LISTING 是真机 curl 抓的 /DATA 根目录真实内容,其中
  // '.wiki.md' 是 NimoOS-Wiki 在真实设备上生成的文件——这份 fixture 只是用来验证
  // "只保留目录与 .iso"的过滤逻辑,任何一个非目录非 .iso 的文件名都能达到同样的测试
  // 效果,换成不影射真实设备文件的占位名,过滤逻辑(is_dir:false 且非 .iso → 被剔除)
  // 不受影响。
  { path: 'src/kvm/composables/useIsoBrowser.test.ts',
    find: "  { name: '.wiki.md', path: '/DATA/.wiki.md', is_dir: false, is_symlink: false, size: 2558 },",
    replace: "  { name: 'notes.txt', path: '/DATA/notes.txt', is_dir: false, is_symlink: false, size: 2558 }," },

  // SystemStatusPanel.test.ts / components.test.ts:GET /v1/gateway/components 的真机
  // fixture 里 'external' 分组下真实列出了 Qdrant——这暴露了私有部署真的跑着 Qdrant
  // (Search/Parser 的依赖,两者都已从这份导出里剔除)。分组渲染逻辑只关心 category 字段,
  // 具体服务名对测试断言无意义,换成不指向任何具体第三方服务的占位名。
  { path: 'src/settings/panels/SystemStatusPanel.test.ts',
    find: "  { name: 'Qdrant', category: 'external', version: '1.18.1', status: 'online', error: '', probed_at: '2026-08-01T02:15:55Z' },",
    replace: "  { name: 'External Component', category: 'external', version: '1.18.1', status: 'online', error: '', probed_at: '2026-08-01T02:15:55Z' }," },
  { path: 'src/settings/panels/SystemStatusPanel.test.ts',
    find: "    expect(w.text()).toContain('Qdrant')",
    replace: "    expect(w.text()).toContain('External Component')" },
  { path: 'src/settings/util/components.test.ts',
    find: "  { name: 'Qdrant', category: 'external', version: '1.18.1', status: 'online', error: '', probed_at: '2026-08-01T02:15:55Z' },",
    replace: "  { name: 'External Component', category: 'external', version: '1.18.1', status: 'online', error: '', probed_at: '2026-08-01T02:15:55Z' }," },

  // Home.integration.test.ts:vi.mock('@nimotech/nimoos-service') 里还 mock 着
  // service.photos——Home.vue 早就不导入 usePhotosStore 了(见上面 T7 的补丁与
  // tree.test.ts 的断言),这一行是纯粹的死 mock,顺手删掉而不是留着当活化石。
  { path: 'src/views/Home.integration.test.ts',
    find: "      photos: { listAssets: vi.fn(async () => []), thumbnailUrl: vi.fn(() => '') },\n",
    replace: '' },

  // ═══════════════════ 修复波(2026-08-04 final-review 发布前必修)═══════════

  // ── I3:theme.css 5 个孤儿 token(SearchDialog/MediaViewer/AiWidget 唯一消费方
  //    均已被本清单 DELETE/REPLACE 掉,定义留在门面文件 theme.css 里会误导读者
  //    以为还有搜索高亮/转录高光功能)。8 行 = 深色块 4 行 + 浅色块 4 行。────────
  { path: 'src/styles/theme.css',
    find: '  --hit-bg: rgba(255, 224, 138, 0.3); --hit-fg: #ffe08a;\n', replace: '' },
  { path: 'src/styles/theme.css',
    find: '  --hl-star: #e8c06a;\n', replace: '' },
  { path: 'src/styles/theme.css',
    find: '  --brand-shadow: 0 12px 30px rgba(120, 150, 255, 0.45);\n', replace: '' },
  { path: 'src/styles/theme.css',
    find: '  --inner-bg-hi: rgba(255, 255, 255, 0.22);\n', replace: '' },
  { path: 'src/styles/theme.css',
    find: '  --brand-shadow: 0 12px 30px rgba(59, 91, 219, 0.3);\n', replace: '' },
  { path: 'src/styles/theme.css',
    find: '  --inner-bg-hi: #f0eee8;\n', replace: '' },
  { path: 'src/styles/theme.css',
    find: '  --hit-bg: #fce8a6; --hit-fg: #5a4a12;\n', replace: '' },
  { path: 'src/styles/theme.css',
    find: '  --hl-star: #c9992f;\n', replace: '' },

  // ── I4:产出树里残留的 strangler/cutover 措辞与一条恒真测试。IDX 6/IDX 7 的
  //    replace payload 已在上面直接改掉(cutoverDisabled 死代码整块删除、
  //    调用点去掉恒 false 的守卫)。这里补 8 条:删恒真用例、清理 beforeEach、
  //    洗白 3 处 "P8 cutover:" 注释与 2 处 it() 标题、洗白 protocol.ts 注释。──
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: `  it('storage 与 apps 两把 flag 互不干扰', () => {
    localStorage.setItem('strangler:disabled:/apps', '1')
    const { openApp } = useOpenAction()
    openApp('storage')
    expect(router.push).toHaveBeenCalledWith('/storage')
    expect(hrefs.length).toBe(0)
    localStorage.removeItem('strangler:disabled:/apps')
  })
`, replace: '' },
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: `  hrefs = []; opens = []
  localStorage.removeItem('strangler:disabled:/apps')
  localStorage.removeItem('strangler:disabled:/storage')
`, replace: `  hrefs = []; opens = []
` },
  { path: 'src/home/components/HomeDock.test.ts',
    find: '// P8 cutover:dock 的 files 图标改应用内 router.push,需 mock 路由单例(vi.mock 会被提升到 import 前)。',
    replace: '// dock 的 files 图标走应用内 router.push,需 mock 路由单例(vi.mock 会被提升到 import 前)。' },
  { path: 'src/home/components/GridItem.click.test.ts',
    find: '// P8 cutover:文件夹瓦片改应用内 router.push,需 mock 路由单例(vi.mock 会被提升到 import 前)。',
    replace: '// 文件夹瓦片走应用内 router.push,需 mock 路由单例(vi.mock 会被提升到 import 前)。' },
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: '// P8 cutover:文件入口改应用内 router.push,需 mock 路由单例(vi.mock 会被提升到 import 前)。',
    replace: '// 文件入口走应用内 router.push,需 mock 路由单例(vi.mock 会被提升到 import 前)。' },
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: "  it('appstore 磁贴应用内 router.push /apps/store(SP5-P8 cutover)', () => {",
    replace: "  it('appstore 磁贴应用内 router.push /apps/store', () => {" },
  { path: 'src/home/composables/useOpenAction.test.ts',
    find: "  it('storage 磁贴应用内 router.push /storage(SP6-P6 cutover)', () => {",
    replace: "  it('storage 磁贴应用内 router.push /storage', () => {" },
  { path: 'src/files/drop/protocol.ts',
    find: '// 硬约束:P8 翻 strangler 前新旧页面并存互传,任何形状/数值改动都会破坏兼容。',
    replace: '// 硬约束:该协议用于页面间互传,任何形状/数值改动都会破坏兼容。' },

  // ── I6:vite.config.ts 直接点名 Claude Code,与「删 CLAUDE.md 因为它是最直白的
  //    AI 辅助开发标记」的理由自相矛盾。exclude 数组本身保留(功能无害)。────────
  { path: 'vite.config.ts',
    find: '    // Claude Code 的隔离 worktree 会出现在 .claude/worktrees/ 下(含整个仓库副本 + NimoOS-Service 软链),',
    replace: '    // 本机可能存在 .claude/ 等工具目录(含整个仓库副本),' },

  // ── I7a:注释里泄露内部 SDD 台账路径(.superpowers/sdd/sp9/...)与债务编号。──
  { path: 'src/settings/util/ifaceForm.ts',
    find: '// → 写路径的正确性只能靠这里的单测(见台账 .superpowers/sdd/sp9/03-p2.md 债务 D18)。',
    replace: '// → 写路径的正确性只能靠这里的单测(该接口没有安全的真机验证途径)。' },

  // ── M1:package.json 的 name 是私有仓名(new-ui 暗示存在一个 old UI)。────────
  { path: 'package.json',
    find: '  "name": "nimoos-new-ui",', replace: '  "name": "nimoos-web",' },

  // ── M2:scripts/deploy.sh 注释里写着私有仓名。──────────────────────────────
  { path: 'scripts/deploy.sh',
    find: '# 构建 NimoOS-New-UI 并部署到 Gateway 的 /app/ 静态目录。',
    replace: '# 构建本项目并部署到 Gateway 的 /app/ 静态目录。' },
]

/** Service 侧的锚点补丁(相对 packages/service/)。T7 填。 */
export const SERVICE_PATCH = [
  // ── T13 复审 Critical:内嵌包不带构建产物,`pnpm test` 编译不过 ─────────────
  // export.mjs 用 `git archive HEAD` 取源(见该文件"取源"注释),NimoOS-Service
  // 的 dist/ 是构建产物、.gitignore 里就没进 git,git archive 天然拿不到它 ——
  // package.json 却指向 ./dist/index.js,导致 pnpm install 按 "files": ["dist"]
  // 打包出的 @nimotech/nimoos-service 里只剩一个 package.json,任何消费它的测试
  // 文件全部 "Failed to resolve entry for package"(T13 是第一个真的在产出树里跑
  // `pnpm install && pnpm test` 的任务,此前 T5-T12 都没有实测暴露过这个洞)。
  // 修法:改 main/module/types/exports 直接指向 TS 源码入口,不依赖预构建产物 ——
  // 源文件内部互相 import 都写成 NodeNext 风格的 `./xxx.js`(为了配合 tsc 构建后
  // 的真实产物路径),Vite/esbuild 的 bundler 模式解析能把 `.js` 说明符按 TS 源码
  // 惯例映射回同名 `.ts` 文件(已实测 vitest 与 vue-tsc 都能正确解析,见
  // task-13-report.md)。这样出包既不需要在 export 流程里新增构建步骤,也不需要
  // 把构建产物提交进 git——两者都会违反"只改 manifest.mjs"的任务边界。
  { path: 'package.json',
    find: `  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
  "files": ["dist"],`,
    replace: `  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": { "types": "./src/index.ts", "import": "./src/index.ts" } },
  "files": ["src"],` },
  { path: 'src/index.ts', find: "import { createPhotos } from './photos.js'\n", replace: '' },
  { path: 'src/index.ts', find: 'PhotoAsset, ', replace: '' },
  { path: 'src/index.ts',
    find: '  get photos(): ReturnType<typeof createPhotos> {\n    return createPhotos(getHttp() as AxiosInstance, () => getConfig().getToken())\n  },\n',
    replace: '' },
  { path: 'src/types.ts',
    find: 'export interface PhotoAsset { id: string | number; [k: string]: unknown }\n', replace: '' },

  // ── SP9-P7:index.ts 的三处 search 接线(SERVICE_DELETE 删掉 src/search.ts 之后
  //    这三行全都指向不存在的模块,内嵌共享包直接构建失败)。────────────────────
  { path: 'src/index.ts', find: "import { createSearch } from './search.js'\n", replace: '' },
  { path: 'src/index.ts',
    find: "export type { SearchSource, SearchFilePath, SearchCite, SemanticHit, FileNameHit, ImageHit, NoteHit, NormalizedAggregate } from './search.js'\n",
    replace: '' },
  { path: 'src/index.ts',
    find: '  get search(): ReturnType<typeof createSearch> {\n    return createSearch(getHttp() as AxiosInstance)\n  },\n',
    replace: '' },
]
