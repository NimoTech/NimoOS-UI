<script setup lang="ts">
// SP7-P7a-T16: PhotosSearch.vue —— 搜索容器接线(路由 /photos/search)。
// 兑现本期挂账的三件事:①T6「在搜索中细化」按钮的落点(见 PhotosSmartViewDetail.vue)
// ②灯箱 OCR 高亮激活(@open 传 query 给 useLightbox().openAt 第四参)③D12「保存为
// 智能视图」的宿主接线(.save-smart 按钮 + SearchSaveSmartView)。
// Read-only 参考: Vue2 NimoOS-UI src/views/Photos/PhotosSearchView.vue 全文、
// PhotosTopbar.vue、PhotosTimeline.vue:208-215(searchActive/history)、:650-668
// (onSearch + 历史写入)。
//
// ★ 架构差异(结构规格 7,§7e-3):Vue2 里 `query` 是父组件(PhotosTimeline)下发的
// prop,真正触发 smartSearch 的是 `onSearch()`(提交时一次性 dispatch),`query` 自身
// 的 watcher 只负责"重置筛选 chip + 套用 understood 预填"。New-UI 是真路由,地址栏的
// `q` 才是唯一真相来源(浏览器前进/后退、直接改地址栏、刷新都要让结果对得上)——因此
// 这里把"触发 smartSearch/clear"也并入同一个 `watch(query, ..., {immediate:true})`,
// 这是相对 Vue2 的刻意架构调整,不是漏抄。
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AreaShell from '../components/shell/AreaShell.vue'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosSearchBar from '../photos/components/PhotosSearchBar.vue'
import PhotosFilterChip from '../photos/components/PhotosFilterChip.vue'
import PhotosFilterPopover from '../photos/components/PhotosFilterPopover.vue'
import SearchDatePopover from '../photos/components/SearchDatePopover.vue'
import SearchPeoplePopover from '../photos/components/SearchPeoplePopover.vue'
import SearchSaveSmartView from '../photos/components/SearchSaveSmartView.vue'
import PhotosSearchGrid from '../photos/components/PhotosSearchGrid.vue'
import { usePhotosSearch } from '../photos/stores/search'
import { usePhotosPeople } from '../photos/stores/people'
import { usePhotosAlbums } from '../photos/stores/albums'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { understood, type PersonOption, type UnderstoodKind, type UnderstoodToken } from '../photos/util/searchUnderstood'
import { queryParts } from '../photos/util/searchQueryParts'
import { sortResults, splitTiers, matchPct, type ScoredPhoto, type SortKey } from '../photos/util/searchSort'
import { dateInRange, quickRange, yearRange, type DateRange } from '../photos/util/dateRange'
import type { Photo } from '../photos/util/assetToPhoto'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const search = usePhotosSearch()
const people = usePhotosPeople()
const albums = usePhotosAlbums()
const lb = useLightbox()

// ── query:从路由读,只读 computed,永远不直接赋值(§7e-3 的可证伪守卫)───────────
const query = computed(() => String(route.query.q ?? ''))

// ── 本地 state(结构规格 9)───────────────────────────────────────────────────
interface SearchFilters {
  date: DateRange | null
  people: string[]
  place: string[]
  type: string | null
  album: string | null
}
function emptyFilters(): SearchFilters {
  return { date: null, people: [], place: [], type: null, album: null }
}
function cloneVal<T>(v: T): T {
  if (Array.isArray(v)) return [...v] as unknown as T
  if (v && typeof v === 'object') return { ...(v as object) } as T
  return v
}

const sort = ref<SortKey>('relevance')
const filters = ref<SearchFilters>(emptyFilters())
const draft = ref<SearchFilters>(emptyFilters())
const openPop = ref<string | null>(null)
const moreExpanded = ref(false)
const saveOpen = ref(false)
const saved = ref(false)
const albumAssetIds = ref<Set<string> | null>(null)

const filterbarRef = ref<HTMLElement | null>(null)
const saveBtnRef = ref<HTMLElement | null>(null)

// ── 搜索历史(结构规格 16,与 Vue2 同 localStorage key)──────────────────────
const HISTORY_KEY = 'nimo_search_history' // 与 Vue2 同键:cutover 期间两边历史互通是好事。
function readHistory(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw.map(String).slice(0, 6)
  } catch {
    return []
  }
}
const history = ref<string[]>(readHistory())
function writeHistory(q: string): void {
  try {
    const prev = readHistory()
    const next = [q, ...prev.filter((h) => h !== q)].slice(0, 6)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
    history.value = next
  } catch {
    // 照搬 Vue2 PhotosTimeline.vue:658 的整体吞错:写失败不崩、也不影响当前搜索流程。
  }
}

// 提交一个词:写历史(非空时)→ 用路由 replace 同步地址栏。onSubmit(PhotosSearchBar)、
// 预搜索态的最近搜索 chip、hero 里的历史词,三处入口共用同一份逻辑(照 Vue2 三处都走
// 同一个 onSearch() 的先例)。
function submitQuery(q: string): void {
  if (q) writeHistory(q)
  void router.replace({ path: '/photos/search', query: q ? { q } : {} })
}

// ── 数据源三处(结构规格 11)──────────────────────────────────────────────────
// people.named 的过滤口径(p.name && p.name.trim() !== '')与 Vue2 realPeopleList 的
// `.filter(p => p.name && p.name.trim())` 逐字一致(E5 已回源核对,见任务报告),直接
// 复用,不再自己过滤一遍。排序(按人脸数降序)与 → PersonOption 的映射仍由本文件做
// (SearchPeoplePopover 的 people prop 依赖调用方已排好序,组件自己不排序)。
const realPeopleList = computed<PersonOption[]>(() =>
  people.named
    .map((p) => ({
      id: String(p.id),
      name: p.name.trim(),
      count: p.count || 0,
      coverFaceId: p.coverFaceId ? String(p.coverFaceId) : '',
    }))
    .sort((a, b) => b.count - a.count),
)

const realAlbumItems = computed<string[]>(() =>
  albums.albums.map((a) => (typeof a.name === 'string' ? a.name : '')).filter(Boolean),
)

// 照搬 Vue2 :452-465 连注释:从**当前搜索结果**(过滤前)统计地名首段频次,按频次降序。
const realPlaceItems = computed<string[]>(() => {
  const freq = new Map<string, number>()
  for (const r of results.value) {
    if (!r.p.place) continue
    const city = r.p.place.split(',')[0].trim()
    freq.set(city, (freq.get(city) || 0) + 1)
  }
  return Array.from(freq.keys()).sort((a, b) => (freq.get(b) || 0) - (freq.get(a) || 0))
})

// File type 是资产内禀属性,不接后端——照搬 Vue2 typeItems 静态数组。
const TYPE_ITEMS = ['Photos', 'OCR', 'Videos'] as const
// 'photosSearchType' + v 的直接拼接在 OCR 上会拼出 'photosSearchTypeOCR'(大写),与
// 真实键名 'photosSearchTypeOcr' 大小写不同——不能靠字符串拼接,须显式映射表(本任务
// 回源核对时查实的一处会致命的拼接坑,若照抄 brief 字面公式实现会在 OCR 类型上悄悄
// 掉回英文原文,和 §7e-13 要修的缺陷是同一类问题)。
const TYPE_LABEL_KEYS: Record<string, string> = {
  Photos: 'photosSearchTypePhotos',
  OCR: 'photosSearchTypeOcr',
  Videos: 'photosSearchTypeVideos',
}
function typeLabel(v: string): string {
  return t(TYPE_LABEL_KEYS[v] ?? v)
}

// ── chip 定义(结构规格 10,顺序照搬 Vue2 :564-572)────────────────────────────
type ChipKey = 'date' | 'people' | 'place' | 'album' | 'type'
const chips = computed(() => [
  { key: 'date' as ChipKey, icon: 'clock', label: t('photosSearchDate') },
  { key: 'people' as ChipKey, icon: 'person', label: t('photosSearchPeople') },
  { key: 'place' as ChipKey, icon: 'map', label: t('photosSearchPlaces') },
  { key: 'album' as ChipKey, icon: 'album', label: t('photosSearchAlbums') },
  { key: 'type' as ChipKey, icon: 'video', label: t('photosSearchFileType') },
])

function chipLabel(chip: { key: ChipKey; label: string }): string {
  const v = filters.value[chip.key]
  if (chip.key === 'date') return (v as DateRange | null)?.label || chip.label
  if (chip.key === 'type') return v ? typeLabel(v as string) : chip.label
  if (Array.isArray(v)) return v.length ? v.join(', ') : chip.label
  return v ? String(v) : chip.label
}
function chipActive(key: ChipKey): boolean {
  const v = filters.value[key]
  return Array.isArray(v) ? v.length > 0 : !!v
}

// ── 结果推导(结构规格 12,顺序照搬 Vue2 :339-404:results → filteredResults →
//    sortedResults → 双档,双档切分在排序之后)────────────────────────────────
const results = computed<ScoredPhoto[]>(() => {
  if (!query.value) return []
  // 在途窗口(路由 q 已更新、store 仍是旧词/从未搜过)返回空,杜绝把上一次结果闪现。
  if (!search.matchesQuery(query.value)) return []
  return search.results.map((p) => ({ p, score: p.matchScore ?? null }))
})

// 在途态:已有查询词但 store 结果尚不属于它。用于抑制空态文案。
const searching = computed(() => !!query.value && !search.matchesQuery(query.value))

const filteredResults = computed<ScoredPhoto[]>(() => {
  let arr = results.value
  const f = filters.value
  if (f.type === 'Photos') arr = arr.filter((r) => !r.p.isVideo && !r.p.hasOcr)
  else if (f.type === 'OCR') arr = arr.filter((r) => r.p.hasOcr)
  else if (f.type === 'Videos') arr = arr.filter((r) => r.p.isVideo)
  if (f.people.length) {
    arr = arr.filter((r) => {
      const faces = Array.isArray(r.p.faces) ? (r.p.faces as unknown[]) : []
      return f.people.some((name) => faces.includes(name))
    })
  }
  // String() 兜底:Photo.takenAt 类型是 string | number | null(真实数据恒为 ISO 字符串,
  // number 只是防御性类型宽容——同款处理见 peopleView.ts:330-337 的既有先例注释)。
  if (f.date) arr = arr.filter((r) => dateInRange(r.p.takenAt != null ? String(r.p.takenAt) : null, f.date))
  if (f.place.length) arr = arr.filter((r) => f.place.includes((r.p.place || '').split(',')[0].trim()))
  if (f.album && albumAssetIds.value) {
    const ids = albumAssetIds.value
    arr = arr.filter((r) => ids.has(String(r.p.id)))
  }
  return arr
})

const sortedResults = computed(() => sortResults(filteredResults.value, sort.value))
const tiers = computed(() => splitTiers(sortedResults.value, sort.value))
const best = computed(() => tiers.value.best)
const more = computed(() => tiers.value.more)

// 照搬 Vue2 :413-415。
const showSentinel = computed(() => moreExpanded.value && !search.exhausted && more.value.length > 0)

const topScore = computed(() => {
  if (!sortedResults.value.length) return null
  const pct = matchPct(sortedResults.value[0].score)
  return pct != null ? pct + '%' : null
})

// ── hero:query 高亮 + Nimo 理解为(结构规格 15)──────────────────────────────
const understoodTokens = computed<UnderstoodToken[]>(() => understood(query.value, realPeopleList.value))
const queryPartsComputed = computed(() => queryParts(query.value, understoodTokens.value.map((tk) => tk.v.toLowerCase())))

function understoodKeyFor(k: UnderstoodKind): string {
  if (k === 'person') return 'photosSearchTokPerson'
  if (k === 'type') return 'photosSearchTokType'
  return 'photosSearchTokTime'
}
// 第 13 条 Vue2 缺陷修复(§7e-13):Vue2 `:44` 是 `<b>{{ t.v }}</b>` 直出英文
// (如查 'my videos' 显示 'Videos'),中文界面下出英文。这里按 token 种类做本地化映射:
// person → 人名原样;type → t('photosSearchType'+v);time → quick 是数字(年份)则原样,
// 是 QuickKey 字符串则 v 本身就是 i18n 键名,t() 一下。
function understoodValueFor(tok: UnderstoodToken): string {
  if (tok.k === 'person') return tok.v
  if (tok.k === 'type') return typeLabel(tok.v)
  if (typeof tok.quick === 'number') return tok.v
  return t(tok.v)
}

// ── applyUnderstood(结构规格 14,照搬 Vue2 :659-672)──────────────────────────
function applyUnderstood(): void {
  const u = understoodTokens.value
  if (!u.length) return
  const peopleNames = u.filter((tk) => tk.k === 'person').map((tk) => tk.v)
  const timeTok = u.find((tk) => tk.k === 'time')
  const typeTok = u.find((tk) => tk.k === 'type')
  if (peopleNames.length) {
    filters.value.people = Array.from(new Set([...filters.value.people, ...peopleNames]))
  }
  if (timeTok && !filters.value.date) {
    const now = new Date()
    if (typeof timeTok.quick === 'number') {
      filters.value.date = yearRange(timeTok.quick, timeTok.v)
    } else if (timeTok.quick) {
      filters.value.date = quickRange(timeTok.quick, now, t(timeTok.v))
    }
  }
  if (typeTok && !filters.value.type) {
    filters.value.type = typeTok.v
  }
}

// ── 主 watcher(结构规格 7+8+21,§7e-3/§7e-14):合并路由驱动的搜索 dispatch、
//    chip 重置、understood 预填、saved 复位 ──────────────────────────────────
watch(
  query,
  (q, old) => {
    if (old !== undefined && q !== old) {
      filters.value = emptyFilters()
      moreExpanded.value = false
      saved.value = false // 第 14 条 Vue2 缺陷修复(§7e-14):换查询词后「已保存」复位。
    }
    applyUnderstood()
    if (q) void search.smartSearch(q)
    else search.clear()
  },
  { immediate: true },
)

// 人物异步加载完成后重跑一次 understood 预填(照搬 Vue2 :591)。
watch(
  () => people.peopleLoaded,
  (loaded) => {
    if (loaded) applyUnderstood()
  },
)

// filters.album 的相册资产拉取(结构规格 13,E4):按 name 反查 id(albumIdByName 不
// 存在,自己从 albums.albums 里查),再走 fetchAlbumAssets + assetsOf(String() 归一)。
// seq 守卫挡"快速切两个不同相册时旧响应后到"——store 自身的 isLoadingAssets 只挡同一个
// id 的重复请求,挡不住这种跨相册竞态。
let albumSeq = 0
watch(
  () => filters.value.album,
  (name) => {
    const mine = ++albumSeq
    if (!name) {
      albumAssetIds.value = null
      return
    }
    const found = albums.albums.find((a) => (typeof a.name === 'string' ? a.name : '') === name)
    if (!found) {
      albumAssetIds.value = new Set()
      return
    }
    const id = found.id as string | number
    void albums.fetchAlbumAssets(id).then(() => {
      if (mine !== albumSeq) return // 旧响应作废
      albumAssetIds.value = new Set(albums.assetsOf(id).map((a) => String(a.id)))
    })
  },
)

// ── chip / popover 交互(结构规格 20,照搬 Vue2 :739-753 + :783-797)──────────
function togglePop(key: string): void {
  if (openPop.value === key) {
    openPop.value = null
    return
  }
  openPop.value = key
  draft.value = { ...draft.value, [key]: cloneVal((filters.value as Record<string, unknown>)[key]) } as SearchFilters
}
function applyPop(key: keyof SearchFilters): void {
  filters.value = { ...filters.value, [key]: cloneVal(draft.value[key]) }
  openPop.value = null
}
function cancelPop(): void {
  openPop.value = null
}
function clearFilter(key: keyof SearchFilters): void {
  const cur = filters.value[key]
  filters.value = { ...filters.value, [key]: Array.isArray(cur) ? [] : null }
}
function clearAll(): void {
  filters.value = emptyFilters()
}
const anyFilter = computed(() => {
  const f = filters.value
  return !!(f.date || f.people.length || f.place.length || f.type || f.album)
})

// 单选类 chip(album/type)在 filters/draft 里存的是 string|null,但
// PhotosFilterPopover 的 selected 是 string[]——这里做双向适配。
function singleSelected(v: string | null): string[] {
  return v ? [v] : []
}

// ── activeConditions(结构规格 18,照搬 Vue2 :498-508;'type: '/'album: ' 前缀发给
//    后端 parser,不进 i18n)──────────────────────────────────────────────────
const activeConditions = computed<string[]>(() => {
  const out: string[] = []
  const f = filters.value
  if (f.date) out.push(f.date.label || t('photosSearchDate'))
  f.people.forEach((p) => out.push(p))
  f.place.forEach((p) => out.push(p))
  if (f.type) out.push('type: ' + f.type)
  if (f.album) out.push('album: ' + f.album)
  return out
})

// ── defaultSaveName(结构规格 17,照搬 Vue2 :550-559)──────────────────────────
const defaultSaveName = computed(() => {
  const q = (query.value || '').trim().replace(/^['"]|['"]$/g, '')
  if (q.length < 40) return q
  const parts: string[] = []
  if (filters.value.people[0]) parts.push(filters.value.people[0])
  if (filters.value.place[0]) parts.push(filters.value.place[0].split(',')[0])
  const ql = (query.value || '').toLowerCase()
  if (ql.includes('sunset')) parts.push(t('photosSearchSunsets'))
  return parts.length ? parts.join(' · ') : t('photosSvNewSmartView')
})

function openSave(): void {
  if (saved.value) return
  saveOpen.value = true
}
function onSaved(_id: string): void {
  saved.value = true
}

// ── 浮层统一治理(结构规格 19,硬约束):一个 mousedown + 一个 keydown,禁止早退。
//    保存弹层自己的点外部/Esc 已经由 SearchSaveSmartView 内部处理(ignoreEl 判据)——
//    这里的 keydown 仍然显式也去关 saveOpen,保证"chip 弹层与保存弹层同开时一次 Esc
//    两者都关"这条硬约束在宿主层面也成立,不完全依赖子组件的内部实现。
function onDocKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  if (openPop.value !== null) openPop.value = null
  if (saveOpen.value) saveOpen.value = false
  // 偏离登记(结构规格 19):Vue2 的 Esc 是 exitSearch()(退出搜索,:834),这里不迁——
  // New-UI 用 Esc 关浮层(与本仓其余页面一致),退出搜索走侧栏/浏览器后退键。
}
function onDocMousedown(e: MouseEvent): void {
  const target = e.target as Node
  if (openPop.value !== null) {
    const bar = filterbarRef.value
    if (bar && !bar.contains(target)) openPop.value = null
  }
}
const anyOverlayOpen = computed(() => openPop.value !== null || saveOpen.value)
watch(anyOverlayOpen, (open) => {
  if (open) {
    document.addEventListener('keydown', onDocKeydown)
    document.addEventListener('mousedown', onDocMousedown)
  } else {
    document.removeEventListener('keydown', onDocKeydown)
    document.removeEventListener('mousedown', onDocMousedown)
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocKeydown)
  document.removeEventListener('mousedown', onDocMousedown)
})

// ── 结果打开(结构规格 15,§7e-3/E3 的核心接线):第四参传 query 激活灯箱 OCR 高亮;
//    翻页集是 sortedResults 而非 filteredResults(照搬 Vue2 :725)。────────────
function onOpen(photo: Photo): void {
  lb.openAt(photo, sortedResults.value.map((r) => r.p), 0, query.value)
}

// onMounted 若 people/albums 未加载则各拉一次(照搬 Vue2 :817-818)。用 New-UI store
// 自带的 loaded 门控标志,不是 Vue2 的 `!array.length`(避免"确实零条"与"还没拉过"
// 混淆——store 已经为此专门做了区分,直接复用)。
onMounted(() => {
  if (!people.peopleLoaded) void people.fetchPeople()
  if (!albums.albumsLoaded) void albums.fetchAlbums()
})
</script>

<template>
  <AreaShell :title="t('photosTitle')">
    <div class="photos-layout">
      <PhotosSidebar />
      <main class="photos-main">
        <PhotosSearchBar :value="query" autofocus @submit="submitQuery" />

        <!-- 预搜索态(结构规格 15)-->
        <div v-if="!query" class="search-prestate" data-test="search-prestate">
          <div class="nimo-orb" />
          <h2>{{ t('photosSearchSearchLibrary') }}</h2>
          <p>{{ t('photosSearchDescribeReLookingPeople') }}</p>
          <div v-if="history.length" class="prestate-recent">
            <span class="prestate-recent-label">{{ t('photosSearchRecentSearches') }}</span>
            <div class="prestate-chips">
              <button
                v-for="h in history.slice(0, 6)" :key="h" type="button" class="prestate-chip"
                data-test="prestate-chip" @click="submitQuery(h)"
              >
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
                ><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                <span>{{ h }}</span>
              </button>
            </div>
          </div>
        </div>

        <template v-else>
          <!-- hero(结构规格 15)-->
          <div class="search-hero" data-test="search-hero">
            <div class="search-query-row">
              <div class="search-query" data-test="search-query">
                "<span
                  v-for="(part, i) in queryPartsComputed" :key="i"
                  :class="part.hl ? 'kw' : null"
                >{{ part.text }}</span>"
              </div>
              <div v-if="!searching" class="search-meta" data-test="search-meta">
                {{ t('photosSearchCountResultsSecondsS', { count: filteredResults.length, seconds: (search.ms / 1000).toFixed(2) }) }}
              </div>
            </div>
            <div v-if="history.length > 1" class="search-history">
              <span class="search-history-label">{{ t('photosSearchRecent') }}</span>
              <template v-for="h in history.slice(0, 5)" :key="h">
                <span v-if="h !== query" class="search-history-item" @click="submitQuery(h)">{{ h }}</span>
              </template>
            </div>
            <div v-if="understoodTokens.length > 0" class="understood" data-test="understood">
              <span class="nimo-orb" />
              {{ t('photosSearchNimoUnderstood') }}
              <template v-for="(tok, i) in understoodTokens" :key="i">
                <span class="understood-k">{{ (i > 0 ? '· ' : '') + t(understoodKeyFor(tok.k)) }}</span>
                <b class="understood-v" data-test="understood-v">{{ understoodValueFor(tok) }}</b>
              </template>
            </div>
          </div>

          <!-- chip 栏(结构规格 10、19、20)-->
          <div ref="filterbarRef" class="filterbar" data-test="filterbar">
            <PhotosFilterChip
              v-for="chip in chips" :key="chip.key" :label="chipLabel(chip)" :active="chipActive(chip.key)"
              :open="openPop === chip.key" :data-test="'chip-' + chip.key"
              @toggle="togglePop(chip.key)" @clear="clearFilter(chip.key)"
            >
              <template #icon>
                <svg
                  v-if="chip.icon === 'clock'" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
                ><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                <svg
                  v-else-if="chip.icon === 'person'" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
                ><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
                <svg
                  v-else-if="chip.icon === 'map'" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
                ><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></svg>
                <svg
                  v-else-if="chip.icon === 'album'" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
                ><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 14l5-4 4 3 3-2 6 5" /></svg>
                <svg
                  v-else viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
                ><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3z" /></svg>
              </template>

              <SearchDatePopover
                v-if="openPop === 'date' && chip.key === 'date'" :draft="draft.date" :committed="filters.date"
                @update:draft="(v) => (draft.date = v)" @apply="applyPop('date')" @cancel="cancelPop"
              />
              <SearchPeoplePopover
                v-if="openPop === 'people' && chip.key === 'people'" :people="realPeopleList" :selected="draft.people"
                @update:selected="(v) => (draft.people = v)" @apply="applyPop('people')" @cancel="cancelPop"
              />
              <PhotosFilterPopover
                v-if="openPop === 'place' && chip.key === 'place'" :title="chip.label" :items="realPlaceItems"
                :selected="draft.place" :search-placeholder="t('photosSearchSearchLabel', { label: chip.label })"
                :empty-hint="t('photosSearchNoLocationDataYet')"
                @update:selected="(v) => (draft.place = v)" @apply="applyPop('place')" @cancel="cancelPop"
              />
              <PhotosFilterPopover
                v-if="openPop === 'album' && chip.key === 'album'" :title="chip.label" :items="realAlbumItems"
                :multiple="false" :selected="singleSelected(draft.album)"
                :search-placeholder="t('photosSearchSearchLabel', { label: chip.label })"
                :empty-hint="t('photosSearchNothingHereYet')"
                @update:selected="(v) => (draft.album = v[0] ?? null)" @apply="applyPop('album')" @cancel="cancelPop"
              />
              <PhotosFilterPopover
                v-if="openPop === 'type' && chip.key === 'type'" :title="chip.label" :items="[...TYPE_ITEMS]"
                :multiple="false" :selected="singleSelected(draft.type)" :label-for="typeLabel"
                :search-placeholder="t('photosSearchSearchLabel', { label: chip.label })"
                :empty-hint="t('photosSearchNothingHereYet')"
                @update:selected="(v) => (draft.type = v[0] ?? null)" @apply="applyPop('type')" @cancel="cancelPop"
              />
            </PhotosFilterChip>

            <div class="filterbar-spacer" />
            <button v-if="anyFilter" type="button" class="clear" data-test="clear-all" @click="clearAll">
              {{ t('photosSearchClearAll') }}
            </button>
            <div style="position: relative">
              <button
                ref="saveBtnRef" type="button" class="save-smart" data-test="save-smart"
                :data-saved="saved ? 'true' : 'false'" :disabled="saved" @click="openSave"
              >
                <svg
                  v-if="!saved" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                ><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
                <svg
                  v-else viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
                  stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
                ><path d="m5 12 5 5L20 7" /></svg>
                {{ saved ? t('photosSearchSaved') : t('photosSearchSaveSmartView') }}
              </button>
              <SearchSaveSmartView
                v-model:open="saveOpen" :query="query" :conditions="activeConditions"
                :default-name="defaultSaveName" :ignore-el="saveBtnRef" @saved="onSaved"
              />
            </div>
          </div>

          <!-- 排序 / 计数栏(结构规格 15)-->
          <div class="results-bar" data-test="results-bar">
            <span>{{ t('photosSearchSort') }}</span>
            <div class="sort">
              <button
                type="button" :data-active="sort === 'relevance' ? 'true' : 'false'" data-test="sort-relevance"
                @click="sort = 'relevance'"
              >{{ t('photosSearchRelevance') }}</button>
              <button
                type="button" :data-active="sort === 'newest' ? 'true' : 'false'" data-test="sort-newest"
                @click="sort = 'newest'"
              >{{ t('photosSearchNewest') }}</button>
              <button
                type="button" :data-active="sort === 'oldest' ? 'true' : 'false'" data-test="sort-oldest"
                @click="sort = 'oldest'"
              >{{ t('photosSearchOldest') }}</button>
            </div>
            <div style="flex: 1" />
            <span v-if="!searching" data-test="results-count">
              {{ t('photosSearchCountMatches', { count: filteredResults.length.toLocaleString() }) }}
              <template v-if="topScore"> · {{ t('photosSearchTopScoreScore', { score: topScore }) }}</template>
            </span>
          </div>

          <!-- 空态(结构规格 15,D1:不建 Ask Nimo 按钮)-->
          <div v-if="filteredResults.length === 0 && !searching" class="empty-search" data-test="empty-search">
            <div class="nimo-orb" />
            <h2>{{ t('photosSearchNoMatches') }}</h2>
            <p>{{ t('photosSearchCouldnTFindPhotos') }}</p>
            <div class="conditions">
              <div v-for="c in activeConditions" :key="c" class="fchip" data-on="true">{{ c }}</div>
            </div>
          </div>

          <!-- 结果网格 -->
          <PhotosSearchGrid
            v-else :best="best" :more="more" :more-expanded="moreExpanded" :show-sentinel="showSentinel"
            :loading-more="search.loadingMore" @open="onOpen" @update:more-expanded="(v) => (moreExpanded = v)"
            @load-more="search.loadMore()"
          />
        </template>
      </main>
    </div>
  </AreaShell>
</template>

<style scoped>
.photos-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

/* ── 自绘 nimo-orb(本仓没有,brief E 段裁定自绘,颜色全走 accent 家族 token)──
   Vue2 是一张紫色系 logo 图(url(./nimo-logo.png)),本仓改成径向渐变 + 既有
   --orb-glow token 的 drop-shadow(AiWidget.vue:37 的 .ai-orb 已是同一个 token 的
   既定先例,不新增 token)。 */
.nimo-orb {
  display: inline-block;
  border-radius: 50%;
  background: radial-gradient(circle at 34% 32%, var(--accent-soft-2), var(--accent) 72%);
}

/* ── 预搜索态(photos.scss:2779-2793)── */
.search-prestate { text-align: center; padding: 96px 32px 40px; max-width: 560px; margin: 0 auto; }
.search-prestate .nimo-orb { width: 68px; height: 68px; margin: 0 auto 16px; filter: drop-shadow(0 0 24px var(--orb-glow)); }
.search-prestate h2 { font-family: var(--font-display, var(--font)); font-size: 22px; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 6px; color: var(--fg); }
.search-prestate p { color: var(--fg-faint); font-size: 13.5px; line-height: 1.5; margin: 0 0 28px; }
.search-prestate .prestate-recent { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.search-prestate .prestate-recent-label { font-size: 11px; color: var(--fg-faint); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
.search-prestate .prestate-chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.search-prestate .prestate-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: 99px;
  background: var(--chip-bg); border: 1px solid var(--chip-border); color: var(--fg-muted);
  font-size: 12.5px; cursor: pointer; transition: all 0.12s;
}
.search-prestate .prestate-chip:hover { background: var(--accent-soft); border-color: var(--accent); color: var(--accent-text); }
.search-prestate .prestate-chip span { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ── hero(photos.scss:2577-2608)── */
.search-hero { padding: 28px 32px 8px; border-bottom: 1px solid var(--divider); }
.search-query-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.search-query { font-family: var(--font-display, var(--font)); font-size: 26px; font-weight: 600; letter-spacing: -0.02em; color: var(--fg); }
.search-query .kw { color: var(--accent-text); }
.search-meta { color: var(--fg-faint); font-size: 13px; font-variant-numeric: tabular-nums; }

.search-history { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.search-history-label { font-size: 11px; color: var(--fg-faint); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; margin-right: 4px; }
.search-history-item {
  padding: 3px 10px; border-radius: 99px; background: var(--chip-bg); border: 1px solid var(--chip-border);
  color: var(--fg-muted); font-size: 11.5px; white-space: nowrap; max-width: 240px; overflow: hidden;
  text-overflow: ellipsis; transition: all 0.12s; cursor: pointer;
}
.search-history-item:hover { background: var(--accent-soft); border-color: var(--accent); color: var(--accent-text); }

.understood {
  display: inline-flex; align-items: center; gap: 6px; margin-top: 12px;
  padding: 4px 10px 4px 8px; border-radius: 999px;
  background: var(--accent-soft); border: 1px solid var(--accent-soft-bd); color: var(--accent-text);
  font-size: 11.5px; font-weight: 500;
}
.understood .nimo-orb { width: 18px; height: 18px; }
.understood-k { color: var(--fg-faint); }
.understood-v { margin: 0 4px; }

/* ── filterbar(photos.scss:2610-2657)── */
.filterbar {
  padding: 12px 32px; border-bottom: 1px solid var(--divider);
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  background: var(--bg); position: sticky; top: 0; z-index: 6;
}
.filterbar-spacer { flex: 1; }
.clear { font-size: 12px; color: var(--fg-faint); padding: 6px 8px; background: none; border: 0; cursor: pointer; }
.clear:hover { color: var(--accent-text); }

/* save-smart:E9,accent 家族映射(渐变 0.20/0.08 两档均值≈--accent-soft 的 .14 挡)+
   [data-saved] 态复用 T3 already 建立的 --success token(见 SmartViewCard.vue),不
   照抄 Vue2 三个 !important——scoped SFC 内没有别的规则与之打特异性战,不需要。 */
.save-smart {
  display: inline-flex; align-items: center; gap: 6px;
  height: 30px; padding: 0 12px; border-radius: 999px;
  background: var(--accent-soft); border: 1px solid var(--accent-soft-bd);
  color: var(--accent-text); font-size: 12px; font-weight: 500; cursor: pointer;
}
.save-smart:hover { background: var(--accent-soft-2); }
.save-smart[data-saved='true'] {
  background: color-mix(in srgb, var(--success) 14%, transparent);
  border-color: color-mix(in srgb, var(--success) 35%, transparent);
  color: var(--success);
  cursor: default;
}
.save-smart[data-saved='true']:hover {
  background: color-mix(in srgb, var(--success) 14%, transparent);
  border-color: color-mix(in srgb, var(--success) 35%, transparent);
  color: var(--success);
}

/* ── results-bar(photos.scss:2702-2708)。Vue2 的 .sort button 没有任何 :hover
   反馈——本仓其余可点按钮一律有 hover,这里补上(加性 UX 改进,登记见报告),并让
   [data-active] 变体自带 :hover 满足本仓"胜出规则须含 :hover"的硬约束。 */
.results-bar { display: flex; align-items: center; gap: 12px; padding: 10px 32px; font-size: 12.5px; color: var(--fg-faint); }
.sort { display: inline-flex; gap: 0; background: var(--chip-bg); padding: 2px; border-radius: 99px; }
.sort button {
  padding: 4px 10px; font-size: 11.5px; border-radius: 99px; color: var(--fg-faint); font-weight: 500;
  background: transparent; border: 0; cursor: pointer; transition: background 0.15s, color 0.15s;
}
.sort button:hover { color: var(--fg); }
.sort button[data-active='true'] { background: var(--chip-bg-hi); color: var(--fg); }
.sort button[data-active='true']:hover { background: var(--chip-bg-hi); color: var(--fg); }

/* ── 空态(photos.scss:2771-2776)── */
.empty-search { text-align: center; padding: 80px 32px; max-width: 480px; margin: 0 auto; }
.empty-search .nimo-orb { width: 68px; height: 68px; margin: 0 auto 16px; filter: drop-shadow(0 0 24px var(--orb-glow)); }
.empty-search h2 { font-family: var(--font-display, var(--font)); font-size: 22px; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 6px; color: var(--fg); }
.empty-search p { color: var(--fg-faint); font-size: 13.5px; line-height: 1.5; margin: 0 0 24px; }
.empty-search .conditions { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-bottom: 24px; }
/* E10(T12 交接):空态里 chip 的紧凑变体归本任务实现。这里没有共享的 .fchip 基类可继承
   (PhotosFilterChip 的 .fchip 是它自己 scoped 样式,跨组件不可见),直接以"已选中"的
   视觉(accent-soft 底 + accent-soft-bd 边)按 photos.scss:2776 的紧凑尺寸整条写出。 */
.empty-search .conditions .fchip {
  display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border-radius: 99px;
  background: var(--accent-soft); border: 1px solid var(--accent-soft-bd); color: var(--fg); font-size: 11.5px;
}

/* ≤768px:侧栏已收抽屉,布局单列(本区既定形态)。 */
@media (max-width: 768px) {
  .photos-layout { gap: 0; }
}
</style>
