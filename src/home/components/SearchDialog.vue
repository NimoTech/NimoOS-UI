<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { DialogRoot, DialogPortal, DialogContent, DialogTitle, VisuallyHidden } from 'reka-ui'
import { useHomeUiStore } from '../stores/homeUi'
import { useOpenAction } from '../composables/useOpenAction'
import { iconNameFor, iconUrl } from '../../files/util/icons'
import ViewerHost from '../../files/viewers/ViewerHost.vue'
import { useViewer } from '../../files/viewers/useViewer'
import type { FileEntry } from '../../files/stores/files'

// 弹窗内的统一搜索：⌘K 打开这个玻璃命令面板，回车（或点建议词）后在下方显示分组结果。
// 当前为「写死 demo」——暂不接后端(NimoOS-Search)，按查询词二选一：
//   demo 1 "fish"：跨模态排序（1-2 文档 · 3 相册卡 · 4 起文档/音频正常排序）。
//   demo 2 搬家小票：描述式查询(receipts from when I moved house last winter)，
//     命中 /DATA/Documents/Recipes/ 下 5 张真实小票照片(全 OCR)——无文档行，
//     All 标签相册卡排第 1，Images 标签拆单行按名次排序；文案/跳转与 fish 完全一致(进 AI 相册)。
// Ask Nimo AI 入口在搜索输入框右侧：渐变胶囊按钮(星标图标 + “Ask Nimo”文字，仿 Gemini)，高度与关闭(✕)按钮一致(36px)。
// 交互：左键点击结果 = 直接复用文件页的 ViewerHost 就地预览（docx/pdf/xlsx/图片/视频/音频/文本全支持）；
//       每行右上「打开文件夹」= 新窗口跳到该文件所在文件夹；相册卡 = 进 AI 相册并搜索。
// 弹窗设为非模态(modal=false)，这样 ViewerHost 的全屏浮层不会被模态置为 inert；预览打开期间拦截外部点击/Esc，避免误关搜索。
// 展示文案统一用英文。
const homeUi = useHomeUiStore()
const { t } = useI18n()
const { sendToAI } = useOpenAction()
const viewer = useViewer()

const TAB_LABEL_KEYS: Record<string, string> = {
  all: 'searchTabAll', Documents: 'searchTabDocuments', Images: 'searchTabImages', Audio: 'searchTabAudio', Videos: 'searchTabVideos',
}
const tabLabel = (key: string) => t(TAB_LABEL_KEYS[key] ?? key)
const query = ref('')
const searched = ref(false)
const searching = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | undefined
const SEARCH_DELAY_MS = 1000

// 建议词（空态展示）；点击即填入并直接搜索，方便演示。第一个 chip 即 demo 2 的入口。
const suggestions = ['receipts from when I moved house last winter', 'product spec', 'launch replay', 'morning podcast', 'wallpaper']

type Category = 'Documents' | 'Audio'

// 排序理由标签语义色：primary=文件名精确命中，normal=正文/转写命中，semantic=语义相关，demote=降权。
type ReasonKind = 'primary' | 'normal' | 'semantic' | 'demote'
interface Reason { label: string; kind: ReasonKind }
// realPath = 磁盘真实路径（预览/取文件用）；folder = 前端文件页虚拟路由（打开文件夹用，NimoOS-HD ↔ /DATA）。
interface DocResult { name: string; realPath: string; folder: string; category: Category; reasons: Reason[]; snippet: string }

// 文档/音频结果（顺序即排名）。文件已按主题分散到不同文件夹（模拟真实检索）。
// 负样本 Q3_financial_report.md 混在 Projects 里但不召回。
const DOCS: DocResult[] = [
  {
    name: 'fish_recipe.docx',
    realPath: '/DATA/Documents/Recipes/fish_recipe.docx',
    folder: '/files/NimoOS-HD/Documents/Recipes',
    category: 'Documents',
    reasons: [
      { label: 'Exact filename match', kind: 'primary' },
      { label: 'Body match ×9', kind: 'normal' },
    ],
    snippet:
      'Pan-seared fish with lemon butter: pat the fish completely dry, then sear skin-side down until golden — the most popular fish dish in our house, served with seasonal vegetables.',
  },
  {
    name: 'aquarium_care_guide.md',
    realPath: '/DATA/Documents/Aquarium/aquarium_care_guide.md',
    folder: '/files/NimoOS-HD/Documents/Aquarium',
    category: 'Documents',
    reasons: [{ label: 'Dense body cluster', kind: 'normal' }],
    snippet:
      "Beginner's guide to keeping fish: keep the tank at 24–26℃, change the water for your fish regularly, and watch each fish every day to judge whether it is healthy.",
  },
  {
    name: 'scattered_vs_clustered.docx',
    realPath: '/DATA/Documents/Projects/scattered_vs_clustered.docx',
    folder: '/files/NimoOS-HD/Documents/Projects',
    category: 'Documents',
    reasons: [{ label: 'Body match ×2 · scattered', kind: 'normal' }],
    snippet:
      'Chapter 1 uses the word fish as a throwaway placeholder value … (dozens of unrelated pages) … and Appendix B lists fish again in the sample-value catalogue.',
  },
  {
    name: 'fish_market_note.wav',
    realPath: '/DATA/Media/Recordings/fish_market_note.wav',
    folder: '/files/NimoOS-HD/Media/Recordings',
    category: 'Audio',
    reasons: [{ label: 'Transcript match ×3', kind: 'normal' }],
    snippet:
      "(transcript) Today's main target was this big fish; when I reeled it in the fish fought hard, and back at the dock we cleaned the fish and got it ready to steam.",
  },
  {
    name: 'family_trip_diary.docx',
    realPath: '/DATA/Documents/Travel/family_trip_diary.docx',
    folder: '/files/NimoOS-HD/Documents/Travel',
    category: 'Documents',
    reasons: [{ label: 'Body match ×1', kind: 'normal' }],
    snippet:
      'On day three at the tide pools, a single bright, colorful fish leapt clear of the water — the kids’ favorite moment; that evening we grilled dinner on the porch.',
  },
  {
    name: 'seafood_shopping_list.txt',
    realPath: '/DATA/Documents/Shopping/seafood_shopping_list.txt',
    folder: '/files/NimoOS-HD/Documents/Shopping',
    category: 'Documents',
    reasons: [{ label: 'Semantically related', kind: 'semantic' }],
    snippet:
      'This week: salmon 2kg, tuna 1kg, shrimp, scallops, plus everything for the Sunday seafood platter. (The word "fish" never appears literally.)',
  },
  {
    name: 'Fish_Project_2023.docx',
    realPath: '/DATA/Documents/Projects/Fish_Project_2023.docx',
    folder: '/files/NimoOS-HD/Documents/Projects',
    category: 'Documents',
    reasons: [{ label: 'Likely a person name · demoted', kind: 'demote' }],
    snippet:
      'Project charter: sponsored by Mr. Michael Fish, who leads the overall plan … here "Fish" is a surname, not the aquatic animal.',
  },
]

// 相册媒体（图片 + 视频合并），按准确率排序。真实文件在 /DATA/Gallery/Fishing/。
// 视频用预抽的海报帧（/app/demo/），图片走缩略图接口。
const GALLERY = '/DATA/Gallery/Fishing'
const VIDEO_POSTER = import.meta.env.BASE_URL + 'demo/fish_video_poster.jpg'
// ocr=true 的媒体表示「靠 OCR 文字识别命中」——徽标显示 "OCR" 而非准确率百分比。
// desc = Images 标签单行里 OCR 徽标旁的一行小字（店名 + 关键商品 + 金额 + 日期），仅小票 demo 用。
interface Media { name: string; path: string; accuracy: number; isVideo?: boolean; ocr?: boolean; desc?: string }
const ALBUM: Media[] = [
  // 收据图片：靠图片内 OCR 文字命中（放第一张，徽标标 OCR）。真实文件在 /DATA/Documents/life/。
  { name: "Nick's receipt.jpg", path: "/DATA/Documents/life/Nick's receipt.jpg", accuracy: 0, ocr: true },
  { name: 'images.jpg', path: `${GALLERY}/images.jpg`, accuracy: 98 },
  { name: '16240722_2160_3840_30fps.mp4', path: `${GALLERY}/16240722_2160_3840_30fps.mp4`, accuracy: 95, isVideo: true },
  { name: 'images (2).jpg', path: `${GALLERY}/images (2).jpg`, accuracy: 94 },
  { name: 'images (1).jpg', path: `${GALLERY}/images (1).jpg`, accuracy: 90 },
  { name: 'images (3).jpg', path: `${GALLERY}/images (3).jpg`, accuracy: 85 },
]

// ── demo 2:搬家小票 ─────────────────────────────────────────────────────
// 全部为 /DATA/Documents/Recipes/ 下真实小票照片，靠 OCR 文字命中；顺序即排名：
// 1 "moving boxes" 字面直接命中 → 2-3 同日(12/27)采购链 → 4 新家置办(语义) → 5 同店工具弱相关垫底。
const RECEIPTS_DIR = '/DATA/Documents/Recipes'
const RECEIPTS: Media[] = [
  { name: '20260722-031032.jpg', path: `${RECEIPTS_DIR}/20260722-031032.jpg`, accuracy: 0, ocr: true, desc: 'Home Depot · moving boxes ×6 + rolling trash can · $55.72 · Dec 27, 2024' },
  { name: '20260722-031024.jpg', path: `${RECEIPTS_DIR}/20260722-031024.jpg`, accuracy: 0, ocr: true, desc: 'Walmart · OFFICE CHAIR $75 ×4 + trash bags · $389.87 · Dec 27, 2024' },
  { name: '20260722-031029.jpg', path: `${RECEIPTS_DIR}/20260722-031029.jpg`, accuracy: 0, ocr: true, desc: 'Staples · desk + standing desk riser + mouse · $124.19 · Dec 27, 2024' },
  { name: '20260722-031001.jpg', path: `${RECEIPTS_DIR}/20260722-031001.jpg`, accuracy: 0, ocr: true, desc: 'Walmart · bedding set + floor lamp + pillow · $73.48 · Jan 12, 2025' },
  { name: '20260722-030940.jpg', path: `${RECEIPTS_DIR}/20260722-030940.jpg`, accuracy: 0, ocr: true, desc: 'Home Depot · Bosch rotary hammer + drill bit · $217.22 · Jan 16, 2025' },
]

// 查询词含搬家/小票/冬天类关键词 → demo 2；其余一律 fish（demo 1）。
const isReceiptDemo = computed(() => /\b(receipts?|move|moved|moving|winter)\b/i.test(query.value))
const activeDocs = computed<DocResult[]>(() => (isReceiptDemo.value ? [] : DOCS))
const activeAlbum = computed<Media[]>(() => (isReceiptDemo.value ? RECEIPTS : ALBUM))

function mediaThumb(m: Media): string {
  return m.isVideo ? VIDEO_POSTER : service.image.thumbUrl(m.path)
}
function onThumbErr(e: Event, m: Media): void {
  const img = e.target as HTMLImageElement
  const fallback = iconUrl(iconNameFor({ name: m.name, is_dir: false }))
  if (img.src !== fallback) img.src = fallback
}

// ── 标签（全部结果 + 按命中数排序的分类）────────────────────────────────────
interface Tab { key: string; label: string; count: number }
const docCount = (c: Category) => activeDocs.value.filter((r) => r.category === c).length
const tabs = computed<Tab[]>(() => {
  const cats = [
    { key: 'Documents', count: docCount('Documents') },
    { key: 'Images', count: activeAlbum.value.filter((m) => !m.isVideo).length },
    { key: 'Audio', count: docCount('Audio') },
    { key: 'Videos', count: activeAlbum.value.filter((m) => m.isVideo).length },
  ]
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((c) => ({ key: c.key, label: tabLabel(c.key), count: c.count }))
  return [{ key: 'all', label: tabLabel('all'), count: activeDocs.value.length + activeAlbum.value.length }, ...cats]
})

const activeTab = ref('all')

// 组装当前标签下要展示的列表项：文档/音频行 + 相册卡，相册卡在「全部结果」里排第 3 位。
// 「图片 / 视频」标签下不再合并成相册卡，而是每张单独成行、按准确率排名 1-2-3-4。
type ListItem = { type: 'row'; row: DocResult } | { type: 'album'; media: Media[] } | { type: 'media'; media: Media }
const displayList = computed<(ListItem & { rank: number })[]>(() => {
  const tab = activeTab.value
  const docs =
    tab === 'all' ? activeDocs.value
    : tab === 'Documents' ? activeDocs.value.filter((r) => r.category === 'Documents')
    : tab === 'Audio' ? activeDocs.value.filter((r) => r.category === 'Audio')
    : []
  const media =
    tab === 'all' ? activeAlbum.value
    : tab === 'Images' ? activeAlbum.value.filter((m) => !m.isVideo)
    : tab === 'Videos' ? activeAlbum.value.filter((m) => m.isVideo)
    : []
  const out: ListItem[] = []
  if (tab === 'all') {
    docs.slice(0, 2).forEach((row) => out.push({ type: 'row', row }))
    if (media.length) out.push({ type: 'album', media })
    docs.slice(2).forEach((row) => out.push({ type: 'row', row }))
  } else if (tab === 'Images' || tab === 'Videos') {
    media.forEach((m) => out.push({ type: 'media', media: m }))
  } else {
    docs.forEach((row) => out.push({ type: 'row', row }))
  }
  return out.map((it, i) => ({ ...it, rank: i + 1 }))
})
const resultCount = computed(() => displayList.value.reduce((n, it) => n + (it.type === 'album' ? it.media.length : 1), 0))

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
  if (!query.value.trim()) return
  activeTab.value = 'all'
  // 演示：搜索后先进入「Searching…」态，延迟 2s 再出结果。
  if (searchTimer) clearTimeout(searchTimer)
  searched.value = false
  searching.value = true
  searchTimer = setTimeout(() => {
    searching.value = false
    searched.value = true
  }, SEARCH_DELAY_MS)
}
function pickSuggestion(s: string): void {
  query.value = s
  performSearch()
}
// 左键点击结果 = 复用文件页 ViewerHost 就地预览（不支持的类型直接打开文件夹兜底）。
function openResult(row: DocResult): void {
  const entry: FileEntry = { name: row.name, path: row.realPath, is_dir: false }
  if (!viewer.openItem(entry, [entry])) openFolder(row.folder)
}
// 单张图片 / 视频行：左键就地预览（不支持则回退进 AI 相册）。
function openMedia(m: Media): void {
  const entry: FileEntry = { name: m.name, path: m.path, is_dir: false }
  if (!viewer.openItem(entry, [entry])) openPhotos()
}
// 打开文件夹：新窗口跳到前端文件页对应目录（/app/#/files/...）。
function openFolder(folder: string): void {
  window.open(`${window.location.origin}${import.meta.env.BASE_URL}#${folder}`, '_blank', 'noopener')
}
// 进入 AI 相册并按关键词智能搜索（用同事已跑通 embedding 的图库）。
function openPhotos(): void {
  const q = query.value.trim() || 'fish'
  homeUi.closeSearch()
  window.location.href = `http://192.168.1.115/#/photos?q=${encodeURIComponent(q)}`
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
function onEscapeKeyDown(e: Event): void {
  if (viewer.open.value) e.preventDefault() // 交给 ViewerHost 自己的 Esc 关闭预览
}

// 每次打开面板都重置状态。
watch(
  () => homeUi.searchOpen,
  (open) => {
    if (searchTimer) clearTimeout(searchTimer)
    if (open) {
      query.value = ''
      searched.value = false
      searching.value = false
      activeTab.value = 'all'
    } else {
      viewer.close()
    }
  },
)
// 编辑关键词后回到空态，需再次搜索。
watch(query, () => {
  if (searched.value || searching.value) {
    if (searchTimer) clearTimeout(searchTimer)
    searched.value = false
    searching.value = false
  }
})

const showResults = computed(() => searched.value && !!query.value.trim())
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

        <!-- 搜索中：延迟出结果，先显示 Searching… -->
        <div v-if="searching" class="searching">
          <span class="spinner" />
          <span class="searching-text">{{ t('searchSearching') }}</span>
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

          <div class="results-meta">{{ t('searchResultsCount', { count: resultCount }) }}</div>

          <div class="results">
            <template v-for="it in displayList" :key="it.type === 'album' ? 'album' : it.type === 'media' ? it.media.name : it.row.name">
              <!-- 相册卡：图片+视频合并，缩略图按准确率排序，点击进 AI 相册 -->
              <button v-if="it.type === 'album'" class="album" @click="openPhotos">
                <span class="rank">{{ it.rank }}</span>
                <span class="album-body">
                  <span class="album-head">
                    <span class="album-title">{{ t('searchAlbumMatches', { count: it.media.length }) }}</span>
                    <span class="album-go">{{ t('searchOpenAlbum') }}</span>
                  </span>
                  <span class="album-strip">
                    <span v-for="m in it.media" :key="m.name" class="album-thumb">
                      <img :src="mediaThumb(m)" alt="" @error="onThumbErr($event, m)" />
                      <span class="album-acc" :class="{ 'album-acc-ocr': m.ocr }">{{ m.ocr ? 'OCR' : m.accuracy + '%' }}</span>
                    </span>
                  </span>
                </span>
              </button>

              <!-- 图片 / 视频单行：排名 + 缩略图 + 准确率，点击就地预览 -->
              <div v-else-if="it.type === 'media'" class="media-row" role="button" tabindex="0" @click="openMedia(it.media)" @keyup.enter="openMedia(it.media)">
                <span class="rank">{{ it.rank }}</span>
                <span class="media-thumb">
                  <img :src="mediaThumb(it.media)" alt="" @error="onThumbErr($event, it.media)" />
                  <span v-if="it.media.isVideo" class="media-play">▶</span>
                </span>
                <span class="media-info">
                  <span class="media-acc-num" :class="{ 'media-acc-ocr': it.media.ocr }">{{ it.media.ocr ? 'OCR' : it.media.accuracy + '%' }}</span>
                  <span class="media-acc-label">{{ it.media.ocr ? 'text recognized' : 'match accuracy' }}</span>
                  <span v-if="it.media.desc" class="media-desc">{{ it.media.desc }}</span>
                </span>
                <button class="row-open" @click.stop="openPhotos">{{ t('searchOpenAlbum') }}</button>
              </div>

              <!-- 文档 / 音频行：左键预览，右上「打开文件夹」新窗口 -->
              <div v-else class="result" role="button" tabindex="0" @click="openResult(it.row)" @keyup.enter="openResult(it.row)">
                <span class="rank">{{ it.rank }}</span>
                <img class="result-ic" :src="iconUrl(iconNameFor({ name: it.row.name, is_dir: false }))" alt="" />
                <span class="result-body">
                  <span class="result-head">
                    <span class="result-name">{{ it.row.name }}</span>
                    <span v-for="(rz, ri) in it.row.reasons" :key="ri" class="rz" :class="`rz-${rz.kind}`">{{ rz.label }}</span>
                  </span>
                  <span class="result-path">{{ it.row.folder.replace('/files/', '') }}</span>
                  <span class="result-snippet">
                    <template v-for="(p, pi) in highlightParts(it.row.snippet)" :key="pi"><mark v-if="p.hit" class="hit">{{ p.text }}</mark><template v-else>{{ p.text }}</template></template>
                  </span>
                </span>
                <button class="row-open" :title="t('searchOpenFolderTitle')" @click.stop="openFolder(it.row.folder)">{{ t('searchOpenFolder') }}</button>
              </div>
            </template>
          </div>
        </template>

        <!-- 未搜索时的空态提示 -->
        <div v-else class="idle">
          <div class="chips">
            <button v-for="s in suggestions" :key="s" class="chip" @click="pickSuggestion(s)">{{ s }}</button>
          </div>
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
/* theme-exception: 准确率徽标叠在任意用户相册缩略图之上（非页面背景），需固定深色底+亮色字保证在任意照片内容上都可读，与页面主题无关 */
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
.media-acc-num { font-size: 18px; font-weight: 700; color: var(--success); }
.media-acc-num.media-acc-ocr { color: var(--accent-text); letter-spacing: 0.03em; }
.media-acc-label { font-size: 12px; color: var(--fg-muted); }
.media-desc { font-size: 12.5px; color: var(--fg-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 排序理由标签（primary 跟随强调色；其余用固定语义色） */
.rz { font-size: 11.5px; padding: 2px 9px; border-radius: 999px; white-space: nowrap; border: 1px solid transparent; }
.rz-primary { background: var(--accent-soft); color: var(--accent-text); border-color: var(--accent-soft-bd); }
.rz-normal { background: var(--nrm-bg); color: var(--nrm-fg); border-color: var(--nrm-bd); }
.rz-semantic { background: var(--sem-bg); color: var(--sem-fg); border-color: var(--sem-bd); }
.rz-demote { background: var(--dem-bg); color: var(--dem-fg); border-color: var(--dem-bd); }

.result-path { font-size: 12.5px; color: var(--sem-fg); opacity: 0.9; }
.result-snippet { font-size: 13.5px; line-height: 1.5; color: var(--fg-muted); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
.hit { background: var(--hit-bg); color: var(--hit-fg); border-radius: 3px; padding: 0 1px; font-weight: 600; }

/* 搜索中 */
.searching { padding: 52px 26px 54px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.spinner { width: 30px; height: 30px; border-radius: 50%; border: 3px solid var(--ring-track); border-top-color: var(--accent); animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 1.6s; } }
.searching-text { font-size: 14.5px; color: var(--fg-muted); letter-spacing: 0.02em; }

/* 空态 / 占位 */
.idle { padding: 44px 26px 46px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.chips { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
.chip { padding: 8px 15px; border-radius: 999px; font-size: 14px; background: var(--card); border: 1px solid var(--border); color: var(--fg-muted); cursor: pointer; transition: background 0.2s, border-color 0.2s, color 0.2s; }
.chip:hover { background: var(--accent-soft); border-color: var(--accent-soft-bd); color: var(--accent-text); }
.hint { font-size: 13px; color: var(--fg-subtle); }
</style>
