<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import { DialogRoot, DialogPortal, DialogContent, DialogTitle, VisuallyHidden } from 'reka-ui'
import { useHomeUiStore } from '../stores/homeUi'
import { useOpenAction } from '../composables/useOpenAction'
import { iconNameFor, iconUrl } from '../../files/util/icons'
import ViewerHost from '../../files/viewers/ViewerHost.vue'
import { useViewer } from '../../files/viewers/useViewer'
import { useFilesStore, type FileEntry } from '../../files/stores/files'
import { toVirtualPath, virtualPathToRouteParam } from '../../files/util/pathUtils'
import { useSearchQuery } from '../search/useSearchQuery'
import type { ResultRow, SourceBadge } from '../search/types'

// 弹窗内的统一搜索：⌘K 打开这个玻璃命令面板，回车后在下方显示分组结果。
//
// ── 数据流（SP9-P7 起接真后端，两套写死 demo 已删）────────────────────────
//   useSearchQuery（请求生命周期 + 过期守卫）
//     → service.search.agentTool（POST /v1/ai/search/agent/tool，四源聚合）
//     → buildSearchView（合并去重 + 五层排名 + 分类/标签派生）+ deriveDegrade（降级/空态状态码）
//     → 本组件只负责渲染与交互，不含任何检索逻辑。
//
// ⚠️ **渲染以 `state` 为唯一开关**（上游交接契约）：useSearchQuery 在失败时和新一轮查询
//    开始时都**不清 view** —— 上一次的结果会一直活着。所以任何「显示结果」的判断都必须
//    带上 `state === 'done'`，绝不能写成 `v-if="view"`：否则请求失败时会把上一轮结果和
//    错误态一起显示，或者搜索中还挂着旧结果。
//
// ── 七处「界面照 Vue2 / 逻辑照正确」的申报偏离 ─────────────────────────────
//   1. openPhotos() 原来写死了同事那台机器的局域网 IP 作为跳转 origin（demo 残留，在任何
//      别的机器上都跳错地方）→ 改同源相对跳转。这是**修真缺陷**，不是改界面（spec §7.9）。
//   2. 媒体行的副标题 `.media-acc-label`（"match accuracy" / "text recognized"）删除：
//      准确率百分比已换成来源徽标，"匹配准确率" 这个说明已无意义。同时 `.media-acc-num`
//      的 18px 字号是给 "98%" 设计的，对 "文件名" 这种短徽标偏大 → 改 13px。
//   3. `row.thumbnailUrl`（images 源给的 Photos 缩略图 URL）**本期不消费**，媒体缩略图
//      统一走 service.image.thumbUrl(realPath)：Photos 缩略图的鉴权方式本机验不了
//      （images 源在本机恒不可用），贸然改会引入验不了的路径。数据仍在 ResultRow 上，不丢。
//   4. 跳 /files 的 hash 过 `virtualPathToRouteParam`（逐段 encodeURIComponent），不裸拼
//      （详见 openFilesAt 处注释）。demo 期这里喂的是写死常量，接真后端后第一次喂用户
//      真实路径，裸拼就成了可触发缺陷 → **修真缺陷**，不是改界面。
//   5. `.result-path` 现在显示 `folderOf()` 的结果，**带前导斜杠**（`/NimoOS-HD/Documents/…`）；
//      旧的 `it.row.folder.replace('/files/', '')` 出来的是无前导斜杠的
//      `NimoOS-HD/Documents/…`。这是肉眼可见的一处字符差异，登记在案（真机自查时不是新缺陷）。
//   6. **相册卡只收 images / OCR 源的行；文件名命中的图片改走媒体单行**（机主 2026-08-04
//      拍板，方案 a）。**为什么这不是改界面而是行为修正**：spec §7.10g 写着「相册卡本机
//      跑不到」，据此把所有 isMedia 行一股脑塞进相册卡是安全的 —— 这个前提是**错的**。
//      本机 images 源恒不可用，于是唯一能产出媒体行的就是 filenames 源，相册卡不但跑得到，
//      还是默认体验；而 filenames 命中的图片（实测 /DATA/Documents/life/Nick's receipt.jpg）
//      不在相册库里，「打开相册」点过去必然是空页。也就是说旧渲染给出的是一个**恒定失效的
//      入口**，属于「Vue2 的 bug 不照抄」那一类，不是把界面改成另一个样子。
//      两处落点：displayList 的 'all' 分支（分流）、`.media-row` 的左键与右上 CTA（openMediaRow /
//      按 badge 二选一的按钮）。后者顺带影响 Images / Videos 两个 tab 下**文件名命中**的媒体行
//      （CTA 由「打开相册 ›」变成「打开文件夹 ›」）—— 同一条理由，一并登记。
//   7. **`.media-row` 补上文件名 + 所在文件夹两行文字**（机主 2026-08-04 拍板）。这是上面
//      第 6 条分流的**副作用修补**：`.media-row` 原本是给相册 / OCR 命中设计的 —— 那类行里
//      缩略图就是重点，所以只画缩略图 + 来源徽标，不显示文件名也不显示路径。分流之后
//      **文件名命中的图片改走这一行**，于是出现了「用户搜 receipt 命中 Nick's receipt.jpg，
//      却在那行里看不到自己搜的这个名字」。按 `.result` 行的同款排版（`.result-name` /
//      `.result-path`，同一套 token）在缩略图右侧补两行。相册 / OCR 命中的行也会跟着显示
//      文件名与路径 —— 拍板时已知并接受，不再按来源分两种排版。
//
// Ask Nimo AI 入口在搜索输入框右侧：渐变胶囊按钮(星标图标 + “Ask Nimo”文字，仿 Gemini)，高度与关闭(✕)按钮一致(36px)。
// 交互：左键点击结果 = 直接复用文件页的 ViewerHost 就地预览（docx/pdf/xlsx/图片/视频/音频/文本全支持）；
//       目录行没有预览可言，左键直接进该目录；每行右上「打开文件夹」= 新窗口跳到该文件所在文件夹；相册卡 = 进 AI 相册并搜索。
// 弹窗设为非模态(modal=false)，这样 ViewerHost 的全屏浮层不会被模态置为 inert；预览打开期间拦截外部点击/Esc，避免误关搜索。
const homeUi = useHomeUiStore()
const { t } = useI18n()
const { sendToAI } = useOpenAction()
const viewer = useViewer()
const files = useFilesStore()

// ⚠️ 解构成顶层 ref：Vue 模板只对**顶层 setup 绑定**做 ref 自动解包，
//    留成 `const s = useSearchQuery()` 后模板里的 `s.state` 拿到的是 Ref 对象本身
//    （`s.state === 'error'` 恒 false、`v-model="s.query"` 会把 Ref 覆盖成字符串）。
const { query, state, view, degrade, errorDetail, run, reset } = useSearchQuery()

// displayNames 就绪后 toVirtualPath 才能把 /DATA/... 翻成 /NimoOS-HD/...；
// 未就绪时 toVirtualPath 原样返回真实路径，不阻塞渲染。
// ⚠️ 必须带 `!files.disks.length` 守卫（照 SharesPage.vue:24 / DropPage.vue:50 的既有写法）：
//    本组件在 Home.vue 里是**无条件挂载**的，没有守卫的话每次进桌面都多打一次
//    service.storage.list —— 而这份盘符列表全站共用，别处已经拉过就不必再拉。
onMounted(() => { if (!files.disks.length) void files.loadRoots() })

const TAB_LABEL_KEYS: Record<string, string> = {
  all: 'searchTabAll', Documents: 'searchTabDocuments', Images: 'searchTabImages', Audio: 'searchTabAudio', Videos: 'searchTabVideos',
}
const tabLabel = (key: string) => t(TAB_LABEL_KEYS[key] ?? key)

// 来源徽标（spec §7.6）：取代 demo 时代那个编出来的准确率百分比。
const BADGE_KEYS: Record<SourceBadge, string> = {
  semantic: 'searchBadgeSemantic', filename: 'searchBadgeFilename', ocr: 'searchBadgeOcr',
}
const badgeLabel = (row: ResultRow) => t(BADGE_KEYS[row.badge])

function mediaThumb(row: ResultRow): string {
  return service.image.thumbUrl(row.realPath)
}
function onThumbErr(e: Event, row: ResultRow): void {
  const img = e.target as HTMLImageElement
  const fallback = iconUrl(iconNameFor({ name: row.name, is_dir: false }))
  if (img.src !== fallback) img.src = fallback
}

// ── 标签（全部结果 + 按命中数排序的分类）────────────────────────────────────
// 计数与排序在 buildSearchView 里算好（spec §7.7），这里只贴文案。
interface Tab { key: string; label: string; count: number }
const tabs = computed<Tab[]>(() => (view.value?.tabs ?? []).map((tb) => ({ key: tb.key, label: tabLabel(tb.key), count: tb.count })))

const activeTab = ref('all')

// 组装当前标签下要展示的列表项：文档/音频行 + 相册卡，相册卡在「全部结果」里排第 3 位。
// 「图片 / 视频」标签下不再合并成相册卡，而是每张单独成行、按名次排序。
type ListItem = { type: 'row'; row: ResultRow } | { type: 'album'; media: ResultRow[] } | { type: 'media'; media: ResultRow }
const displayList = computed<(ListItem & { rank: number })[]>(() => {
  const v = view.value
  if (!v) return []
  const tab = activeTab.value
  const out: ListItem[] = []
  if (tab === 'all') {
    // ⚠️ 申报偏离 6 —— 相册卡的分流（机主 2026-08-04 拍板，方案 a）。见文件头第 6 条。
    //    相册卡（「相册匹配 N 张」→「打开相册」→ /#/photos?q=）只对**真的在相册库里**的
    //    命中成立，也就是 images 源（CLIP）与 semantic 的 OCR 命中。filenames 源命中的
    //    图片可能躺在任何目录（真机实测：/DATA/Documents/life/Nick's receipt.jpg），
    //    相册库里根本搜不到，塞进相册卡等于给用户一个必然跳空页的入口。
    //    判据用 badge：'filename' 表示该行有 filenames 源参与（badgeOf 里 filename 优先），
    //    其余（'ocr' / 'semantic'）才是相册能认的。**不改 buildSearchView**（Task 2 交付物）。
    const albumMedia = v.mediaRows.filter((m) => m.badge !== 'filename')
    const fileMedia = v.mediaRows.filter((m) => m.badge === 'filename')
    v.docRows.slice(0, 2).forEach((row) => out.push({ type: 'row', row }))
    // 组装顺序与 tab 计数都不动（spec §7.7）：媒体块整体仍占原相册卡那一段位置，
    // 相册卡输入为空时就不渲染相册卡，那些图片按媒体单行接在同一段里。
    if (albumMedia.length) out.push({ type: 'album', media: albumMedia })
    fileMedia.forEach((m) => out.push({ type: 'media', media: m }))
    v.docRows.slice(2).forEach((row) => out.push({ type: 'row', row }))
  } else if (tab === 'Images' || tab === 'Videos') {
    v.mediaRows.filter((r) => r.category === tab).forEach((m) => out.push({ type: 'media', media: m }))
  } else {
    v.docRows.filter((r) => r.category === tab).forEach((row) => out.push({ type: 'row', row }))
  }
  return out.map((it, i) => ({ ...it, rank: i + 1 }))
})
const resultCount = computed(() => displayList.value.reduce((n, it) => n + (it.type === 'album' ? it.media.length : 1), 0))

// ── 降级提示条 / 空态 / 结果开关 ─────────────────────────────────────────
const SOURCE_KEYS: Record<string, string> = {
  semantic: 'searchSourceSemantic', images: 'searchSourceImages', filenames: 'searchSourceFilenames',
}
// 不可用源的文案；认不出的 warning 原样附在后面，不静默丢（deriveDegrade 已分好类）。
const noticeItems = computed<string[]>(() => {
  const d = degrade.value
  if (!d) return []
  return [...d.unavailableSources.map((src) => t(SOURCE_KEYS[src] ?? src)), ...d.unknownWarnings]
})
const showNotice = computed(() => state.value === 'done' && noticeItems.value.length > 0)

const EMPTY_KEYS: Record<string, string> = {
  no_roots: 'searchEmptyNoRoots', backend_not_ready: 'searchEmptyNotReady', no_match: 'searchEmptyNoMatch',
}
const showEmpty = computed(() => state.value === 'done' && view.value?.total === 0)
const emptyText = computed(() => t(EMPTY_KEYS[degrade.value?.empty ?? 'no_match'] ?? 'searchEmptyNoMatch'))
// 空态时光说一句标题还不够，得指出到底哪几源没参与。
// ⚠️ 条件不能钉死在 'backend_not_ready'：warnings = ['no_accessible_roots','images_unavailable']
//    时 deriveDegrade 给出的是 empty='no_roots'，noticeItems 明明算出来了却无处渲染
//    （降级提示条 .search-notice 只在有结果时才画）—— 那几行信息就这么被吞掉。
//    放宽成「任何非 none 的空态 + 有内容」。
const showEmptySources = computed(() => degrade.value?.empty !== 'none' && noticeItems.value.length > 0)

const showResults = computed(() => state.value === 'done' && !!view.value && view.value.total > 0)

// ── 高亮：把摘要里与查询词匹配的片段标黄（大小写不敏感）───────────────────────
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
interface Part { text: string; hit: boolean }
function highlightParts(text: string): Part[] {
  const q = query.value.trim()
  if (!q) return [{ text, hit: false }]
  const re = new RegExp(`(${escapeRegExp(q)})`, 'ig')
  const lc = q.toLowerCase()
  return text
    .split(re)
    .filter((s) => s.length > 0)
    .map((s) => ({ text: s, hit: s.toLowerCase() === lc }))
}

// ── 行为 ────────────────────────────────────────────────────────────────
function performSearch(): void {
  activeTab.value = 'all'
  void run() // 空查询词由 run() 自己挡掉
}
// 文件所在文件夹的虚拟路径（用于展示 + 打开文件夹）。
function folderOf(realPath: string): string {
  const dir = realPath.slice(0, realPath.lastIndexOf('/')) || '/'
  return toVirtualPath(dir, files.displayNames)
}
// 新窗口跳到前端文件页对应目录（/app/#/files/...）。
// ⚠️ 申报偏离 4（修真缺陷，不是改界面）：路径必须过 virtualPathToRouteParam（逐段
//    encodeURIComponent），与仓库其它所有跳 /files 的地方一致（Files.vue / SharesPage.vue /
//    DropPage.vue 的 goVirtual）。裸拼 hash 会让目录名里的 `#` 截断 hash（跳到父目录）、
//    `?` 被当成 query、`%` 让 vue-router 解码失败（列表空白）。demo 期这里喂的是写死常量，
//    接真后端后第一次喂用户真实路径，裸拼就成了可触发缺陷。
function openFilesAt(virtualPath: string): void {
  const param = virtualPathToRouteParam(virtualPath)
  window.open(`${window.location.origin}${import.meta.env.BASE_URL}#/files/${param}`, '_blank', 'noopener')
}
function openFolder(realPath: string): void {
  openFilesAt(folderOf(realPath))
}
// 左键点击结果：目录直接进该目录（目录没有预览可言）；文件复用文件页 ViewerHost 就地预览，
// 不支持的类型退回打开所在文件夹。
function openRow(row: ResultRow): void {
  if (row.isDir) { openFilesAt(toVirtualPath(row.realPath, files.displayNames)); return }
  const entry: FileEntry = { name: row.name, path: row.realPath, is_dir: false }
  if (!viewer.openItem(entry, [entry])) openFolder(row.realPath)
}
// 单张图片 / 视频行：左键就地预览（不支持则回退进 AI 相册）。
function openMedia(row: ResultRow): void {
  const entry: FileEntry = { name: row.name, path: row.realPath, is_dir: false }
  if (!viewer.openItem(entry, [entry])) openPhotos()
}
// 媒体单行的左键入口。⚠️ 申报偏离 6 的第二半：**相册相关的兜底与 CTA 只给相册认得的行**。
//   文件名命中的图片走 openRow（就地预览，打不开则回退到「所在文件夹」）——它可能躺在
//   任何目录，回退进相册同样是跳空页；images / OCR 命中仍走 openMedia（回退进相册）。
function openMediaRow(row: ResultRow): void {
  if (row.badge === 'filename') { openRow(row); return }
  openMedia(row)
}
// 进入 AI 相册并按关键词智能搜索。
// ⚠️ 申报偏离 1（修真缺陷，不是改界面）：原实现把跳转 origin 写死成同事那台机器的局域网
//    IP（demo 残留），且查询词兜底成 `|| 'fish'`（demo 1 的关键词）。
//    改成同源相对跳转、不再兜底（spec §7.9）。
function openPhotos(): void {
  const q = query.value.trim()
  homeUi.closeSearch()
  window.location.href = `${window.location.origin}/#/photos?q=${encodeURIComponent(q)}`
}
// Ask Nimo AI：把当前输入发给 AI 并跳到 AI 对话页（复用桌面 AI 组件同一逻辑 sendToAI）。
function askNimoAi(): void {
  const q = query.value.trim()
  homeUi.closeSearch()
  sendToAI(q)
}

// 预览浮层开启时，拦截弹窗的「点击外部 / Esc」默认关闭，避免顺带关掉搜索面板。
function onInteractOutside(e: Event): void {
  if (viewer.open.value) e.preventDefault()
}
// 预览的 Esc 处理器与 reka 的都挂在 window 的**冒泡**阶段,所以谁先跑完全取决于注册
// 顺序 —— 而 Home 挂载时就已经有一个 ViewerHost 注册好了,远早于这个弹窗打开。它因此
// 先把预览关掉、把 viewer.open 清成 false,守卫再去读时已经是 false,于是不拦,弹窗
// 跟着一起 dismiss,搜索结果全丢。capture 阶段的监听**必然**早于这两者,所以在这里把
// "按下这一刻预览是否开着"拍个快照,判断就不再依赖注册顺序。
//
// 不改 ViewerHost 让它 stopPropagation():同目标同阶段拦不住(得用
// stopImmediatePropagation),而且那样是把正确性押在"ViewerHost 恰好先注册"上。
let viewerOpenAtKeydown = false
function snapshotViewerState(e: KeyboardEvent): void {
  if (e.key === 'Escape') viewerOpenAtKeydown = viewer.open.value
}
onMounted(() => window.addEventListener('keydown', snapshotViewerState, true))
onBeforeUnmount(() => window.removeEventListener('keydown', snapshotViewerState, true))

function onEscapeKeyDown(e: Event): void {
  if (viewerOpenAtKeydown) e.preventDefault() // 交给 ViewerHost 自己的 Esc 关闭预览
}

// 每次打开面板都重置状态；关闭时同样 reset()，让在途请求作废（不许再往关掉的面板里写）。
watch(
  () => homeUi.searchOpen,
  (open) => {
    if (open) {
      query.value = ''
      reset()
      activeTab.value = 'all'
    } else {
      viewer.close()
      reset()
    }
  },
)
// 编辑关键词后回到空态，需再次回车搜索。reset() 不清 query 本身。
watch(query, () => {
  if (state.value !== 'idle') reset()
})

// ── 深链 ?q=（SP9-P8 cutover）────────────────────────────────────────────────
// Vue2 的 /search?q=… 被绞杀到 /app/#/?q=…（strangler.js 里那条 passQuery 条目）：新应用
// 没有搜索页面，搜索就是桌面上的这个面板，所以深链参数落在桌面路由 '/' 上，由本组件自己消费。
// 「q 键存在」就开面板（值为空也开 —— 对位 Vue2 裸 /search 那张空搜索页）；词非空才自动搜一次。
//
// ⚠️ 两次 await nextTick() 各在等一个**上面已有的 watcher** 冲刷完，顺序不能合并、不能省：
//   ① 等 searchOpen watcher —— 它在开面板时会把 query 清空（`query.value = ''`）。不等它跑完
//      就种词，种进去的词会被它抹掉：输入框空、不搜。
//   ② 等 query watcher —— 它看到 query 变化且 state !== 'idle' 就 reset()，而 reset() 会
//      epoch++ 让在途请求的结果作废。若在它冲刷前就 performSearch()，请求照样发出去、结果
//      却被丢掉，面板停在空态提示语上 —— **外观酷似「搜了但什么都没搜到」**。
//   两条都有专门的回归用例（SearchDialog.test.ts「深链 ?q=」一节），删掉任一 tick 必红。
// 消费后立即把 q 从地址栏摘掉：① 用户关掉面板再刷新不会又弹出来；② 重新输入同一个 ?q= 时
// watcher 仍能再次触发（值没被卡在旧值上）。
const route = useRoute()
const router = useRouter()
watch(() => route.query.q, (raw) => {
  if (raw === undefined) return
  // ⚠️ `?q`（有键但没有等号）时 vue-router 给的是 **null**，不是 ''；`?q=a&q=b` 给的是数组。
  //    判据是「键在不在」，值一律归一成字符串 —— 键在就开面板，词为空就只开不搜。
  //    早先只挡 undefined 的写法会让 seed 拿到 null，后面 seed.trim() 直接抛 TypeError、
  //    面板连开都开不出来（vue-tsc TS18047 先逮到，已补回归用例）。
  const first = Array.isArray(raw) ? raw[0] : raw
  const seed = first ?? ''
  homeUi.openSearch()
  void (async () => {
    await nextTick() // ① 让 searchOpen watcher 先把 query 清空
    query.value = seed
    await nextTick() // ② 让 query watcher 冲刷完（此刻 state 仍是 idle，它不会 reset 掉下面这一轮）
    if (seed.trim()) performSearch()
  })()
  void router.replace({ query: { ...route.query, q: undefined } })
}, { immediate: true })
</script>

<template>
  <DialogRoot :open="homeUi.searchOpen" :modal="false" @update:open="homeUi.setSearch($event)">
    <DialogPortal>
      <div v-if="homeUi.searchOpen" class="search-overlay" @click="homeUi.closeSearch()" />
      <DialogContent
        class="search-panel"
        :aria-describedby="undefined"
        @open-auto-focus.prevent
        @interact-outside="onInteractOutside"
        @escape-key-down="onEscapeKeyDown"
      >
        <VisuallyHidden as-child><DialogTitle>{{ t('topbarSearch') }}</DialogTitle></VisuallyHidden>

        <!-- 搜索输入行 -->
        <div class="search-row">
          <button class="search-ic-btn" :aria-label="t('topbarSearch')" @click="performSearch">
            <svg class="search-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
          </button>
          <input
            v-model="query"
            class="searchbox"
            autofocus
            :placeholder="t('searchPlaceholder')"
            :aria-label="t('topbarSearch')"
            @keyup.enter="performSearch"
          />
          <button class="ask-nimo-btn" :aria-label="t('searchAskButton')" :title="t('searchAskButton')" @click="askNimoAi">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15l-1.9-4.1L5.5 9l4.6-1.4L12 3z" /><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" /></svg>
            <span class="ask-nimo-label">{{ t('searchAskButton') }}</span>
          </button>
          <button class="close-btn" :aria-label="t('searchClose')" @click="homeUi.closeSearch()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
          </button>
        </div>

        <!-- 请求在途：只显示 Searching…（上一轮结果此时还活着，但 state 是唯一开关，不许渲染） -->
        <div v-if="state === 'searching'" class="searching">
          <span class="spinner" />
          <span class="searching-text">{{ t('searchSearching') }}</span>
        </div>

        <!-- 请求失败：内联错误块 + 重试。不用 toast —— toast 是 z-index 60，会被本弹窗的
             遮罩（z-index 1000 + blur）压住并糊掉。绝不退化成一个看起来像「没搜到」的空列表。 -->
        <div v-else-if="state === 'error'" class="search-error">
          <div class="search-error-title">{{ t('searchErrorTitle') }}</div>
          <div class="search-error-hint">{{ t('searchErrorHint') }}</div>
          <div v-if="errorDetail" class="search-error-detail">{{ errorDetail }}</div>
          <button class="search-retry" @click="run()">{{ t('searchRetry') }}</button>
        </div>

        <!-- 搜到零条：三种空态分开说（「没搜到」≠「后端没就绪」≠「没有可搜索的目录」） -->
        <div v-else-if="showEmpty" class="search-empty">
          <div class="search-empty-title">{{ emptyText }}</div>
          <div v-if="showEmptySources" class="search-empty-sub">{{ noticeItems.join('、') }}</div>
        </div>

        <!-- 已搜索：分类标签 + 结果列表 -->
        <template v-else-if="showResults">
          <div class="tabs">
            <button
              v-for="tb in tabs"
              :key="tb.key"
              class="tab"
              :class="{ active: activeTab === tb.key }"
              @click="activeTab = tb.key"
            >
              {{ tb.label }}<span class="tab-count">{{ tb.count }}</span>
            </button>
          </div>

          <!-- 降级提示条：本次哪几源没参与搜索（本机四源里两源常年不可用，
               用户必须看得出「这次只搜了文件名」，而不是以为搜索就这点结果） -->
          <div v-if="showNotice" class="search-notice">{{ t('searchNoticePrefix') }}{{ noticeItems.join('、') }}</div>

          <div class="results-meta">{{ t('searchResultsCount', { count: resultCount }) }}</div>

          <div class="results">
            <template v-for="it in displayList" :key="it.type === 'album' ? 'album' : it.type === 'media' ? it.media.realPath : it.row.realPath">
              <!-- 相册卡：图片+视频合并，按名次排序，点击进 AI 相册 -->
              <button v-if="it.type === 'album'" class="album" @click="openPhotos">
                <span class="rank">{{ it.rank }}</span>
                <span class="album-body">
                  <span class="album-head">
                    <span class="album-title">{{ t('searchAlbumMatches', { count: it.media.length }) }}</span>
                    <span class="album-go">{{ t('searchOpenAlbum') }}</span>
                  </span>
                  <span class="album-strip">
                    <span v-for="m in it.media" :key="m.realPath" class="album-thumb">
                      <img :src="mediaThumb(m)" alt="" @error="onThumbErr($event, m)" />
                      <span class="album-acc" :class="{ 'album-acc-ocr': m.badge === 'ocr' }">{{ badgeLabel(m) }}</span>
                    </span>
                  </span>
                </span>
              </button>

              <!-- 图片 / 视频单行：排名 + 缩略图 + 来源徽标，点击就地预览 -->
              <div v-else-if="it.type === 'media'" class="media-row" role="button" tabindex="0" @click="openMediaRow(it.media)" @keyup.enter="openMediaRow(it.media)">
                <span class="rank">{{ it.rank }}</span>
                <span class="media-thumb">
                  <img :src="mediaThumb(it.media)" alt="" @error="onThumbErr($event, it.media)" />
                  <span v-if="it.media.category === 'Videos'" class="media-play">▶</span>
                </span>
                <span class="media-info">
                  <!-- 申报偏离 7：文件名 + 所在文件夹两行，复用 .result 行的同款类名与排版。
                       路径走已有的 folderOf()（内部 toVirtualPath，把 /DATA 翻成 /NimoOS-HD），
                       与 .result-path 是同一个来源，不另写一份。 -->
                  <span class="result-name">{{ it.media.name }}</span>
                  <span class="result-path">{{ folderOf(it.media.realPath) }}</span>
                  <!-- 申报偏离 2：原来这里还有一行 .media-acc-label 副标题（"match accuracy"），
                       准确率百分比换成来源徽标后已无意义，删除。 -->
                  <span class="media-acc-num" :class="{ 'media-acc-ocr': it.media.badge === 'ocr' }">{{ badgeLabel(it.media) }}</span>
                </span>
                <!-- 申报偏离 6：右上 CTA 也跟着来源走 —— 文件名命中的图片给「打开文件夹」，
                     只有相册认得的行才给「打开相册」。否则 F1 只修掉一半：主入口不跳空相册了，
                     旁边这颗按钮照样把用户送进空相册页。 -->
                <button v-if="it.media.badge === 'filename'" class="row-open" :title="t('searchOpenFolderTitle')" @click.stop="openFolder(it.media.realPath)">{{ t('searchOpenFolder') }}</button>
                <button v-else class="row-open" @click.stop="openPhotos">{{ t('searchOpenAlbum') }}</button>
              </div>

              <!-- 文档 / 音频行：左键预览（目录则直接进目录），右上「打开文件夹」新窗口 -->
              <div v-else class="result" role="button" tabindex="0" @click="openRow(it.row)" @keyup.enter="openRow(it.row)">
                <span class="rank">{{ it.rank }}</span>
                <img class="result-ic" :src="iconUrl(iconNameFor({ name: it.row.name, is_dir: it.row.isDir }))" alt="" />
                <span class="result-body">
                  <span class="result-head">
                    <span class="result-name">{{ it.row.name }}</span>
                    <span v-for="rz in it.row.reasons" :key="rz.key" class="rz" :class="`rz-${rz.kind}`">{{ t(rz.key) }}</span>
                  </span>
                  <span class="result-path">{{ folderOf(it.row.realPath) }}</span>
                  <span v-if="it.row.snippet" class="result-snippet">
                    <template v-for="(p, pi) in highlightParts(it.row.snippet)" :key="pi"><mark v-if="p.hit" class="hit">{{ p.text }}</mark><template v-else>{{ p.text }}</template></template>
                  </span>
                </span>
                <button class="row-open" :title="t('searchOpenFolderTitle')" @click.stop="openFolder(it.row.realPath)">{{ t('searchOpenFolder') }}</button>
              </div>
            </template>
          </div>
        </template>

        <!-- 未搜索时的空态提示 -->
        <div v-else class="idle">
          <div class="hint">{{ t('searchHint') }}</div>
        </div>
      </DialogContent>

      <!-- 复用文件页的预览浮层（全屏 z-index:200，覆盖在搜索面板之上） -->
      <ViewerHost />
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
/* ── 设计令牌 ────────────────────────────────────────────────────────────────
   颜色全部消费全局 theme token（见 src/styles/theme.css）：白色模式=米白暖纸背景 +
   纯白搜索卡；蓝色模式=深色玻璃。语义色（相关绿 / 降权琥珀 / 正文灰 / 命中高亮）与
   强调色(Azure)均由全局 token 按主题提供。 */

/* 遮罩 — 整屏虚化让桌面淡出（全局 overlay token：白色模式米白纸感、蓝色模式深色玻璃） */
.search-overlay {
  position: fixed; inset: 0; z-index: 20;
  background: var(--overlay-bg);
  backdrop-filter: var(--overlay-blur);
}

/* 面板 — 顶部锚定的浅色命令面板（浮在米白遮罩上，靠柔和阴影 + 描边分层） */
.search-panel {
  position: fixed; z-index: 21; top: 80px; left: 50%; transform: translateX(-50%);
  width: min(1000px, calc(100vw - 48px));
  max-height: calc(100vh - 120px);
  display: flex; flex-direction: column; overflow: hidden;
  border-radius: 26px;
  background: var(--bg);
  border: 1px solid var(--border);
  box-shadow: var(--card-shadow-hi);
  color: var(--fg);
}
.search-panel[data-state='open'] { animation: search-in 0.42s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes search-in {
  from { opacity: 0; transform: translateX(-50%) translateY(-24px) scale(0.94); }
  to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}
/* 键盘焦点环（可访问性）——仅按钮/可点行，输入框不画框（点击输入不出现方框） */
.search-panel :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.searchbox:focus, .searchbox:focus-visible { outline: none; }
@media (prefers-reduced-motion: reduce) {
  .search-panel[data-state='open'] { animation: none; }
}

/* 输入行 — 浮在米白面板上的一张独立白卡（仿照片里的白搜索框） */
.search-row {
  display: flex; align-items: center; gap: 14px;
  margin: 16px 16px 8px; padding: 14px 16px 14px 18px;
  background: var(--card); border: 1px solid var(--border); border-radius: 20px;
  box-shadow: var(--card-shadow);
}
.search-ic-btn { flex: 0 0 auto; display: flex; padding: 0; background: none; border: none; cursor: pointer; color: var(--fg-muted); transition: color 0.18s; }
.search-ic-btn:hover { color: var(--accent-text); }
.search-ic { width: 23px; height: 23px; }
.searchbox { flex: 1; min-width: 0; background: transparent; border: none; outline: none; color: var(--fg); font: inherit; font-size: 22px; letter-spacing: 0.005em; }
.searchbox::placeholder { color: var(--fg-subtle); }
.close-btn { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: var(--tool-bg); border: 1px solid var(--border); color: var(--fg-muted); cursor: pointer; transition: background 0.2s, color 0.2s; }
.close-btn:hover { background: var(--tool-bg-hi); color: var(--fg); }
.close-btn svg { width: 16px; height: 16px; }

/* Ask Nimo AI —— 输入框右侧的入口按钮，高度与关闭(✕)按钮一致(36px)；
   胶囊形，内含渐变星标图标 + “Ask Nimo”文字，仿 Gemini 的 Ask 按钮（渐变随主题） */
.ask-nimo-btn {
  flex: 0 0 auto; display: inline-flex; align-items: center; gap: 7px;
  height: 36px; padding: 0 15px; border-radius: 999px; cursor: pointer; white-space: nowrap;
  font-size: 13.5px; font-weight: 600; letter-spacing: 0.01em;
  color: #fff; /* theme-exception: 渐变胶囊按钮文字，背景恒为彩色渐变(--grad-a/--grad-b)，两套主题下白字对比度都稳定 */
  background: linear-gradient(135deg, var(--grad-a), var(--grad-b));
  border: 1px solid rgba(0, 0, 0, 0.06); /* theme-exception: 彩色胶囊边缘的纯中性压边，非页面主题色 */
  box-shadow: var(--brand-shadow);
  transition: filter 0.18s, box-shadow 0.18s, transform 0.18s;
}
.ask-nimo-btn:hover { filter: brightness(1.06); box-shadow: var(--brand-shadow); transform: translateY(-1px); }
.ask-nimo-btn:active { transform: translateY(0); }
.ask-nimo-btn svg { flex: 0 0 auto; width: 17px; height: 17px; }
.ask-nimo-label { line-height: 1; }

/* 分类标签 */
.tabs { display: flex; gap: 8px; flex-wrap: wrap; padding: 8px 24px 4px; }
.tab {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 8px 16px; border-radius: 999px; font-size: 14px; cursor: pointer;
  background: transparent; border: 1px solid var(--border);
  color: var(--fg-muted); transition: background 0.2s, border-color 0.2s, color 0.2s;
}
.tab:hover { background: var(--hover); color: var(--fg); }
.tab.active { background: var(--accent-soft); border-color: var(--accent-soft-bd); color: var(--accent-text); }
.tab-count { font-size: 12px; padding: 1px 7px; border-radius: 999px; background: var(--nrm-bg); color: var(--fg-muted); }
.tab.active .tab-count { background: var(--accent-soft-2); color: var(--accent-text); }

.results-meta { padding: 8px 26px 4px; font-size: 12.5px; color: var(--fg-subtle); }

/* 结果列表（滚动条走全局 theme.css 的统一样式） */
.results { flex: 1 1 auto; overflow-y: auto; padding: 6px 14px 18px; display: flex; flex-direction: column; gap: 2px; }
.result {
  display: flex; align-items: flex-start; gap: 14px; width: 100%; text-align: left;
  padding: 13px 14px; border-radius: 16px; background: none; border: none; cursor: pointer;
  color: inherit; font: inherit; transition: background 0.16s;
}
.result:hover { background: var(--hover); }
.rank { flex: 0 0 auto; width: 20px; text-align: center; font-size: 13px; color: var(--fg-subtle); line-height: 30px; }
.result-ic { flex: 0 0 auto; width: 30px; height: 30px; object-fit: contain; margin-top: 1px; }
.result-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.result-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.result-name { font-size: 15.5px; font-weight: 600; color: var(--fg); }

/* 每行右上「打开文件夹」——仿相册卡的进入按钮 */
.row-open {
  flex: 0 0 auto; align-self: flex-start; margin-top: 2px;
  padding: 5px 12px; border-radius: 999px; cursor: pointer; white-space: nowrap;
  font-size: 12.5px; font-weight: 600; color: var(--accent-text);
  background: var(--accent-soft); border: 1px solid var(--accent-soft-bd);
  transition: background 0.16s, border-color 0.16s;
}
.row-open:hover { background: var(--accent-soft-2); border-color: var(--accent-soft-bd); }

/* 相册卡 */
.album {
  display: flex; align-items: flex-start; gap: 14px; width: 100%; text-align: left; cursor: pointer;
  padding: 13px 14px; border-radius: 16px; color: inherit; font: inherit;
  background: var(--accent-soft); border: 1px solid var(--accent-soft-bd);
  transition: background 0.16s, border-color 0.16s;
}
.album:hover { background: var(--accent-soft-2); }
.album-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.album-head { display: flex; align-items: center; gap: 10px; }
.album-title { flex: 1; font-size: 15px; font-weight: 600; color: var(--fg); }
.album-go { flex: 0 0 auto; font-size: 13.5px; font-weight: 600; color: var(--accent-text); }
.album-strip { display: flex; gap: 10px; flex-wrap: wrap; }
.album-thumb { position: relative; width: 76px; height: 76px; border-radius: 12px; overflow: hidden; border: 1px solid var(--border); background: var(--hover); }
.album-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
/* theme-exception: 来源徽标叠在任意用户相册缩略图之上（非页面背景），需固定深色底+亮色字保证在任意照片内容上都可读，与页面主题无关 */
.album-acc { position: absolute; right: 4px; bottom: 4px; font-size: 10.5px; font-weight: 700; padding: 1px 6px; border-radius: 999px; background: rgba(12, 14, 20, 0.68); color: #8ff0c4; border: 1px solid rgba(95, 227, 176, 0.5); }
.album-acc.album-acc-ocr { color: #cdd7ff; border-color: rgba(140, 162, 255, 0.6); letter-spacing: 0.04em; } /* theme-exception: 叠在缩略图上的徽标, 皮肤无关 */

/* 图片 / 视频单行（Images / Videos 标签下，按准确率排名） */
.media-row {
  display: flex; align-items: center; gap: 14px; width: 100%; text-align: left; cursor: pointer;
  padding: 10px 14px; border-radius: 16px; background: none; border: none; color: inherit; font: inherit;
  transition: background 0.16s;
}
.media-row:hover { background: var(--hover); }
.media-thumb { position: relative; flex: 0 0 auto; width: 64px; height: 64px; border-radius: 12px; overflow: hidden; border: 1px solid var(--border); background: var(--hover); }
.media-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
/* theme-exception: 播放三角叠在任意视频缩略图之上（非页面背景），固定白字+深色暗角保证可读，与页面主题无关 */
.media-play { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #fff; background: rgba(6, 10, 24, 0.32); text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6); }
.media-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
/* 申报偏离 2：18px 是给 "98%" 这种两三字符的数字设计的，换成「文件名 / 语义 / OCR」这类
   短徽标后偏大 → 13px。同批删掉了下面那行 .media-acc-label 副标题（"match accuracy"）。 */
.media-acc-num { font-size: 13px; font-weight: 700; color: var(--success); }
.media-acc-num.media-acc-ocr { color: var(--accent-text); letter-spacing: 0.03em; }
/* 申报偏离 7：文件名 / 路径两行的字号与颜色全部沿用 .result-name / .result-path（同一套
   token，不新增）。这里只补一条布局约束：媒体行是「定高缩略图 + 右上 CTA」的紧凑单行，
   长文件名必须单行省略而不是像 .result 行那样折行 —— 否则行被撑高、右上 CTA 跟着往下掉。
   .media-info 已有 min-width: 0，省略号才生效。 */
.media-info .result-name,
.media-info .result-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 排序理由标签（primary 跟随强调色；其余用固定语义色）。
   demote 档随 spec §7.5 一起删掉了——后端没有任何降权信号，demo 那个「疑似人名·已降权」是编的。 */
.rz { font-size: 11.5px; padding: 2px 9px; border-radius: 999px; white-space: nowrap; border: 1px solid transparent; }
.rz-primary { background: var(--accent-soft); color: var(--accent-text); border-color: var(--accent-soft-bd); }
.rz-normal { background: var(--nrm-bg); color: var(--nrm-fg); border-color: var(--nrm-bd); }
.rz-semantic { background: var(--sem-bg); color: var(--sem-fg); border-color: var(--sem-bd); }

.result-path { font-size: 12.5px; color: var(--sem-fg); opacity: 0.9; }
.result-snippet { font-size: 13.5px; line-height: 1.5; color: var(--fg-muted); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
.hit { background: var(--hit-bg); color: var(--hit-fg); border-radius: 3px; padding: 0 1px; font-weight: 600; }

/* 搜索中 */
.searching { padding: 52px 26px 54px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.spinner { width: 30px; height: 30px; border-radius: 50%; border: 3px solid var(--ring-track); border-top-color: var(--accent); animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 1.6s; } }
.searching-text { font-size: 14.5px; color: var(--fg-muted); letter-spacing: 0.02em; }

/* 降级提示条 —— 「本次未参与搜索：…」，挂在结果计数之上。复用 .rz-semantic 的语义色系 */
.search-notice {
  margin: 4px 26px; padding: 8px 14px; border-radius: 12px; font-size: 12.5px;
  background: var(--sem-bg); color: var(--sem-fg); border: 1px solid var(--sem-bd);
}

/* 搜到零条 */
.search-empty { padding: 44px 26px 46px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.search-empty-title { font-size: 15px; font-weight: 600; color: var(--fg-muted); }
.search-empty-sub { font-size: 12.5px; color: var(--fg-subtle); text-align: center; }

/* 请求失败 —— 面板内联展示（不用 toast，见模板处注释） */
.search-error { padding: 40px 26px 44px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.search-error-title { font-size: 16px; font-weight: 600; color: var(--fg); }
.search-error-hint { font-size: 13.5px; color: var(--fg-muted); }
.search-error-detail { max-width: 620px; text-align: center; font-size: 12px; color: var(--fg-subtle); word-break: break-word; }
/* 重试按钮：与每行右上「打开文件夹」(.row-open) 同款胶囊 */
.search-retry {
  margin-top: 6px; padding: 5px 12px; border-radius: 999px; cursor: pointer; white-space: nowrap;
  font-size: 12.5px; font-weight: 600; color: var(--accent-text);
  background: var(--accent-soft); border: 1px solid var(--accent-soft-bd);
  transition: background 0.16s, border-color 0.16s;
}
.search-retry:hover { background: var(--accent-soft-2); border-color: var(--accent-soft-bd); }

/* 空态 / 占位（未搜索时） */
.idle { padding: 44px 26px 46px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.hint { font-size: 13px; color: var(--fg-subtle); }
</style>
