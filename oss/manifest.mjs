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
export const REPLACE = []

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
]

/** Service 侧的锚点补丁(相对 packages/service/)。T7 填。 */
export const SERVICE_PATCH = []
