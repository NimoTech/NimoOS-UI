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

  // 测试同步:整体删除的 9 个(T13 填齐;Service 侧的 photos.test.ts 在 SERVICE_DELETE)
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
    replace: `// 本版没有需要回退的旧入口,恒 false(保留函数形状以免调用处发散)。
function cutoverDisabled(): boolean { return false }` },
  { path: 'src/home/composables/useOpenAction.ts',
    find: `      if (key === 'appstore' && !cutoverDisabled('/apps')) { router.push('/apps/store'); return }
      if (key === 'storage' && !cutoverDisabled('/storage')) { router.push('/storage'); return }
      window.location.href = SYS_ROUTE[key] || '/#/legacy'
      return`,
    replace: `      if (key === 'appstore' && !cutoverDisabled()) { router.push('/apps/store'); return }
      if (key === 'storage' && !cutoverDisabled()) { router.push('/storage'); return }
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
    replace: '// 后端(2026-08-01 实测 GET /v1/sys/paths)可能返回更多 key,而 Vue2 只渲染前 3 个。界面 1:1 → 这里也只产出 3 行。' },
  { path: 'src/apps/stores/installedApps.ts',
    find: '        // 系统幕后容器(nimoos.system=true,如 AI agent / Photos ML)不给用户看——\n        // 与桌面 appgrid 一致(后端 isSystemComposeApp 同款规则)。',
    replace: '        // 系统幕后容器(nimoos.system=true,供其他应用使用的内部服务容器)不给用户看——\n        // 与桌面 appgrid 一致(后端 isSystemComposeApp 同款规则)。' },
  { path: 'src/settings/panels/AppsPanel.vue',
    find: '// 「清理本地待上传缓存」= 政策三「做样子」:界面 1:1、按钮禁用、标注待相册区迁移完成后启用。\n//    数据源是**相册**的 IndexedDB 上传队列(Vue2 @/views/Photos/upload/idb.js),SP7 尚未迁。',
    replace: '// 「清理本地待上传缓存」= 政策三「做样子」:界面 1:1、按钮禁用——该功能依赖的后端能力尚未提供。\n//    数据源是本地 IndexedDB 上传队列(与文件区上传队列是两套独立实现,见下一行)。' },

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
]

/** Service 侧的锚点补丁(相对 packages/service/)。T7 填。 */
export const SERVICE_PATCH = [
  { path: 'src/index.ts', find: "import { createPhotos } from './photos.js'\n", replace: '' },
  { path: 'src/index.ts', find: 'PhotoAsset, ', replace: '' },
  { path: 'src/index.ts',
    find: '  get photos(): ReturnType<typeof createPhotos> {\n    return createPhotos(getHttp() as AxiosInstance, () => getConfig().getToken())\n  },\n',
    replace: '' },
  { path: 'src/types.ts',
    find: 'export interface PhotoAsset { id: string | number; [k: string]: unknown }\n', replace: '' },
]
