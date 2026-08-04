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

  // 搜索 demo 的鱼(SearchDialog 写死的 demo 素材)
  'public/demo/fish_video_poster.jpg',

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
    find: `// 文件区(/files,SP4-P8)、应用区(/apps,SP5-P8)与存储区(/storage,SP6-P1)已活在本应用;
// 其余系统入口仍指 Vue2,各自 SP 迁移时再改。
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
// 同源共享 localStorage,所以置一次即两侧同时回退)。
function cutoverDisabled(from: string): boolean {
  try { return localStorage.getItem(\`strangler:disabled:\${from}\`) === '1' } catch { return false }
}`,
    replace: '' },
  { path: 'src/home/composables/useOpenAction.ts',
    find: `      if (key === 'appstore' && !cutoverDisabled('/apps')) { router.push('/apps/store'); return }
      if (key === 'storage' && !cutoverDisabled('/storage')) { router.push('/storage'); return }
      window.location.href = SYS_ROUTE[key] || '/#/legacy'
      return`,
    replace: `      if (key === 'appstore') { router.push('/apps/store'); return }
      if (key === 'storage') { router.push('/storage'); return }
      router.push(SYS_ROUTE[key] || '/')
      return` },
  { path: 'src/home/composables/useOpenAction.ts',
    find: `    else if (it.kind === 'photo') window.location.href = '/#/photos'
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
  { path: '.gitignore',
    find: '\n# Claude Code 本地状态(隔离 worktree、会话配置),不入库\n.claude/\n.superpowers/\n',
    replace: '' },
  { path: '.gitignore',
    find: '\n# 时间机器验收测试台(T12):假后端 + 专用 vite 配置,只在本机验收用,不进版本库\nscripts/tmlab/\nvite.config.tmlab.ts',
    replace: '\n# 导出报告(含上游 commit hash),仅供本地追溯\n.export-report.txt' },

  // ═══════════════════ T8:i18n 四个 locale + theme.css ═══════════════════

  // ── src/i18n/zh_cn.ts(主分片,8 处锚点,共 44 键)──────────────────────
  // 11 个 audio 转录键(brief 漏登记的部分;audioSkipBack/Forward/Speed 播放器控件保留)
  { path: 'src/i18n/zh_cn.ts',
    find: "  audioSummary: '摘要',\n  audioTranscript: '转录文稿',\n  audioAsk: '问 Nimo',\n  audioAskPlaceholder: '关于这段音频，尽管问…',\n  audioAskEmpty: '这段音频的转录已向量化 — 关于内容尽管问 Nimo。',\n  audioAskDemo: '(demo 占位) 转录已向量化。接入 AI 后端后，这里会根据音频内容作答，并附上可跳转的时间戳。',\n  audioHighlightsOnly: '只看重点',\n  audioShowAll: '显示全部',\n  audioSpeakerAll: '全部',\n  audioChapters: '章节',\n  audioAllChapters: '全部章节',\n",
    replace: "" },
  // appPhotos/appAi:systemApps.ts 对应条目已在 T6 删除
  { path: 'src/i18n/zh_cn.ts',
    find: "  appPhotos: '照片',\n  appAi: 'Nimo AI',\n",
    replace: "" },
  { path: 'src/i18n/zh_cn.ts',
    find: "  widgetAiTitle: 'AI 助手',\n  widgetAiDesc: '对话与智能建议',\n",
    replace: "" },
  // widgetAi* 其余 7 键:AiWidget.vue 已整体删除(DELETE 表),全部孤儿
  { path: 'src/i18n/zh_cn.ts',
    find: "  widgetAiGreetShort: '晚上好',\n  widgetAiGreet: '晚上好，有什么可以帮你？',\n  widgetAiPlaceholder: '发消息给 AI 助手…',\n  widgetAiSend: '发送',\n  widgetAiPrompt1: '整理最近的照片',\n  widgetAiPrompt2: '查找 2024 旅行视频',\n  widgetAiPrompt3: '分析存储使用情况',\n",
    replace: "" },
  // addPanelTabPhoto:T11 删 AddPanel 照片 tab 后的孤儿键,此处先清 i18n 侧
  { path: 'src/i18n/zh_cn.ts',
    find: "  addPanelTabPhoto: '照片',\n",
    replace: "" },
  { path: 'src/i18n/zh_cn.ts',
    find: "  addPanelNoPhotos: '暂无照片',\n",
    replace: "" },
  // topbarSearch(Kbd):HomeTopbar.vue 搜索胶囊按钮已在 T6 删除
  { path: 'src/i18n/zh_cn.ts',
    find: "  topbarSearch: '搜索',\n  topbarSearchKbd: '搜索 (⌘K)',\n",
    replace: "" },
  // "主页:搜索面板"整节 18 键:SearchDialog.vue 已整体删除(DELETE 表)
  { path: 'src/i18n/zh_cn.ts',
    find: "  // ── 主页:搜索面板 ──\n  searchPlaceholder: '你在找什么?',\n  searchClose: '关闭',\n  searchSearching: '搜索中…',\n  searchResultsCount: '{count} 条结果',\n  searchOpenAlbum: '打开相册 ›',\n  searchAlbumMatches: '在 AI 相册找到 {count} 个匹配(图片 / 视频)',\n  searchOpenFolder: '打开文件夹 ›',\n  searchOpenFolderTitle: '在文件中打开此文件夹',\n  searchAskTitle: '向 Nimo AI 询问「{query}」',\n  searchAskSub: '把它发送给 AI 助手,获得基于你文件的回答',\n  searchAskGo: '询问 ›',\n  searchAskButton: 'Ask Nimo',\n  searchHint: '输入关键词并回车,搜索图片、文档、视频、音频与设置',\n  searchTabAll: '全部结果',\n  searchTabDocuments: '文档',\n  searchTabImages: '图片',\n  searchTabAudio: '音频',\n  searchTabVideos: '视频',\n",
    replace: "" },

  // ── src/i18n/en_us.ts(与上面 8 条逐条成对,parity.test.ts 的前置)────────
  { path: 'src/i18n/en_us.ts',
    find: "  audioSummary: 'Summary',\n  audioTranscript: 'Transcript',\n  audioAsk: 'Ask Nimo',\n  audioAskPlaceholder: 'Ask anything about this audio…',\n  audioAskEmpty: 'This transcript is vectorized — ask Nimo about anything in it.',\n  audioAskDemo: '(demo) This transcript is vectorized. Once the AI backend is connected, answers grounded in the audio — with clickable timestamps — will appear here.',\n  audioHighlightsOnly: 'Highlights only',\n  audioShowAll: 'Show all',\n  audioSpeakerAll: 'All',\n  audioChapters: 'Chapters',\n  audioAllChapters: 'All chapters',\n",
    replace: "" },
  { path: 'src/i18n/en_us.ts',
    find: "  appPhotos: 'Photos',\n  appAi: 'Nimo AI',\n",
    replace: "" },
  { path: 'src/i18n/en_us.ts',
    find: "  widgetAiTitle: 'AI Assistant',\n  widgetAiDesc: 'Chat and smart suggestions',\n",
    replace: "" },
  { path: 'src/i18n/en_us.ts',
    find: "  widgetAiGreetShort: 'Good evening',\n  widgetAiGreet: 'Good evening — how can I help?',\n  widgetAiPlaceholder: 'Message the AI assistant…',\n  widgetAiSend: 'Send',\n  widgetAiPrompt1: 'Organize recent photos',\n  widgetAiPrompt2: 'Find 2024 travel videos',\n  widgetAiPrompt3: 'Analyze storage usage',\n",
    replace: "" },
  { path: 'src/i18n/en_us.ts',
    find: "  addPanelTabPhoto: 'Photos',\n",
    replace: "" },
  { path: 'src/i18n/en_us.ts',
    find: "  addPanelNoPhotos: 'No photos',\n",
    replace: "" },
  { path: 'src/i18n/en_us.ts',
    find: "  topbarSearch: 'Search',\n  topbarSearchKbd: 'Search (⌘K)',\n",
    replace: "" },
  // 交接清单盲区(E1):settingsFpIntro 那一条不在这批里,英文侧本身就没有任何词命中,靠这份成对表兜底,见下方 sp9 块
  { path: 'src/i18n/en_us.ts',
    find: "  // ── Home: search palette ──\n  searchPlaceholder: 'what are u looking for',\n  searchClose: 'Close',\n  searchSearching: 'Searching…',\n  searchResultsCount: '{count} results',\n  searchOpenAlbum: 'Open Album ›',\n  searchAlbumMatches: 'Found {count} matches in AI Album (images / videos)',\n  searchOpenFolder: 'Open folder ›',\n  searchOpenFolderTitle: 'Open this folder in Files',\n  searchAskTitle: 'Ask Nimo AI about “{query}”',\n  searchAskSub: 'Send this to the AI assistant for an answer grounded in your files',\n  searchAskGo: 'Ask ›',\n  searchAskButton: 'Ask Nimo',\n  searchHint: 'Type a keyword and press Enter to search images, documents, videos, audio and settings',\n  searchTabAll: 'All results',\n  searchTabDocuments: 'Documents',\n  searchTabImages: 'Images',\n  searchTabAudio: 'Audio',\n  searchTabVideos: 'Videos',\n",
    replace: "" },

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
    find: `  it('photo navigates to /#/photos', () => {
    const { openItem } = useOpenAction()
    openItem({ id: 'i', kind: 'photo', key: 'abc', c: 1, r: 1, w: 2, h: 2 } as LayoutItem)
    expect(hrefs[0]).toBe('/#/photos')
  })
`,
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
    find: `  it('clicking a photo navigates to /#/photos', async () => {
    const item: LayoutItem = { id: 'p', kind: 'photo', key: 'linear-gradient(0,#000)', c: 1, r: 1, w: 2, h: 2 }
    const w = mount(GridItem, { props: { item } })
    await w.get('[data-id="p"]').trigger('click')
    expect(hrefs[0]).toBe('/#/photos')
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
]
