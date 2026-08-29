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

// Unified search in the dialog: ⌘K opens this glass command panel, Enter displays grouped results below.
//
// ── Data flow (from SP9-P7 using real backend; two hardcoded demos removed) ──────────────────
//   useSearchQuery (request lifecycle + expiry guard)
//     → service.search.agentTool (POST /v1/ai/search/agent/tool, four-source aggregation)
//     → buildSearchView (merge dedup + five-level ranking + category/tag derivation) + deriveDegrade (downgrade/empty-state status codes)
//     → This component only handles rendering and interaction; contains no search logic.
//
// ⚠️ **Rendering uses `state` as the only switch** (upstream handoff contract): useSearchQuery neither clears
//    the view when it fails nor when a new query round starts — the previous results stay alive. Any
//    "display results" check must include `state === 'done'`, never write `v-if="view"`; otherwise failed requests
//    will display previous results alongside error state, or search-in-progress shows stale results.
//
// ── Seven declared deviations from "visual 1:1 to Vue2 / logic correctness" ─────────────────
//   1. openPhotos() used to hardcode a colleague's machine's LAN IP as the jump origin (demo residue, broken
//      on any other machine) → changed to same-origin relative redirect. This is **fixing a real defect**, not
//      changing the UI (spec §7.9).
//   2. Media row subtitle `.media-acc-label` ("match accuracy" / "text recognized") removed: accuracy percent
//      replaced with source badge, so "matching accuracy" label is now meaningless. Also `.media-acc-num`'s
//      18px was designed for "98%"; for short badges like "filename" it's too large → changed to 13px.
//   3. `row.thumbnailUrl` (Photos thumbnail URL from images source) **not consumed this cycle**; media thumbnails
//      all use service.image.thumbUrl(realPath): Photos thumbnail auth cannot be validated locally (images
//      source always unavailable locally), premature changes would introduce unvalidatable paths. Data still
//      on ResultRow, not discarded.
//   4. Jump to /files via `virtualPathToRouteParam` (per-segment encodeURIComponent), not raw string concatenation
//      (see comment at openFilesAt). Demo phase fed hardcoded constants; first real paths after backend integration
//      would trigger the defect via raw concatenation → **fixing a real defect**, not changing UI.
//   5. `.result-path` now displays `folderOf()` result **with leading slash** (`/NimoOS-HD/Documents/…`);
//      old `it.row.folder.replace('/files/', '')` produced no leading slash (`NimoOS-HD/Documents/…`).
//      This is a visibly different character, noted on record (not a new defect in real-device checks).
//   6. **Album card accepts only images / OCR source rows; filename-matched images move to media single-line**
//      (decided 2026-08-04, plan a). **Why this is behavior correction, not UI change**: spec §7.10g says
//      "album card cannot run locally", so stuffing all isMedia rows into album card was safe — that premise
//      is **wrong**. Images source is always unavailable locally, so the only media rows come from filenames source;
//      album card not only runs, it's the default experience. But filename-matched images (real test:
//      /DATA/Documents/life/Nick's receipt.jpg) are not in the album library, so "open album" inevitably lands
//      on empty page. That is, old rendering gave an **always-broken entry**, which belongs to "don't copy Vue2 bugs",
//      not "changed the UI to something else". Two points of change: displayList 'all' branch (routing) and
//      `.media-row` left-click and top-right CTA (openMediaRow / button choosing by badge). The latter also
//      affects **filename-matched** media rows under Images / Videos tabs (CTA changes from "open album ›" to
//      "open folder ›") — same reason, both noted.
//   7. **`.media-row` adds filename + containing folder two lines** (decided 2026-08-04). This is the **side-effect patch**
//      from #6 above: `.media-row` was originally designed for album / OCR matches — those rows prioritize thumbnails,
//      so only thumbnail + source badge, no filename or path. After routing, **filename-matched images now use this row**,
//      creating "user searches receipt and hits Nick's receipt.jpg but doesn't see the searched name on that row".
//      Matching `.result` row styling (`.result-name` / `.result-path`, same token set) add two lines to the right of
//      thumbnail. Album / OCR match rows also show filename and path — decided with that understood and accepted,
//      no longer two separate layouts by source.
//
// Ask Nimo AI entry on the right of search input: gradient capsule button (star icon + "Ask Nimo" text, like Gemini),
// height matches close (✕) button (36px).
// Interactions: left-click result = reuse file page's ViewerHost for in-place preview (docx/pdf/xlsx/images/video/audio/text all supported);
//            directory row has no preview, left-click goes into that directory; each row's top-right "open folder" = new window
//            to the file's containing folder; album card = enter AI photo library and search.
// Dialog is non-modal (modal=false), so ViewerHost's fullscreen layer won't be made inert by modality; when preview is open,
// intercept outside clicks/Esc to avoid accidentally closing the search.
const homeUi = useHomeUiStore()
const { t } = useI18n()
const { sendToAI } = useOpenAction()
const viewer = useViewer()
const files = useFilesStore()

// ⚠️ Destructure to top-level ref: Vue templates only auto-unwrap refs on **top-level setup bindings**;
//    leaving it as `const s = useSearchQuery()` means template's `s.state` gets the Ref object itself
//    (`s.state === 'error'` is always false, `v-model="s.query"` overwrites the Ref with a string).
const { query, state, view, degrade, errorDetail, run, reset } = useSearchQuery()

// displayNames must be ready before toVirtualPath can translate /DATA/... to /NimoOS-HD/...;
// before ready, toVirtualPath returns real paths as-is, doesn't block rendering.
// ⚠️ Must include `!files.disks.length` guard (following pattern in SharesPage.vue:24 / DropPage.vue:50):
//    this component is **unconditionally mounted** in Home.vue, without the guard every desktop entry
//    would call service.storage.list again — but this disk list is shared sitewide, already fetched elsewhere.
onMounted(() => { if (!files.disks.length) void files.loadRoots() })

const TAB_LABEL_KEYS: Record<string, string> = {
  all: 'searchTabAll', Documents: 'searchTabDocuments', Images: 'searchTabImages', Audio: 'searchTabAudio', Videos: 'searchTabVideos',
}
const tabLabel = (key: string) => t(TAB_LABEL_KEYS[key] ?? key)

// Source badges (spec §7.6): replace the invented accuracy percent from demo days.
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

// ── Tabs (all results + categories sorted by match count) ──────────────────────────────────
// Counting and sorting computed in buildSearchView (spec §7.7); here we just render labels.
interface Tab { key: string; label: string; count: number }
const tabs = computed<Tab[]>(() => (view.value?.tabs ?? []).map((tb) => ({ key: tb.key, label: tabLabel(tb.key), count: tb.count })))

const activeTab = ref('all')

// Assemble display items for current tab: document/audio rows + album card, card ranks 3rd in "all results".
// Under "Images / Videos" tabs, no longer merge into album card; each image is its own row sorted by rank.
type ListItem = { type: 'row'; row: ResultRow } | { type: 'album'; media: ResultRow[] } | { type: 'media'; media: ResultRow }
const displayList = computed<(ListItem & { rank: number })[]>(() => {
  const v = view.value
  if (!v) return []
  const tab = activeTab.value
  const out: ListItem[] = []
  if (tab === 'all') {
    // ⚠️ Declared deviation 6 — album card routing (decided 2026-08-04, plan a). See item 6 at file head.
    //    Album card ("Album matches N images" → "open album" → /#/photos?q=) only applies to items
    //    **actually in the album library**, i.e. images source (CLIP) and semantic OCR hits. Images from
    //    filenames source may live anywhere (real test: /DATA/Documents/life/Nick's receipt.jpg), completely
    //    unsearchable in the album library; stuffing them in the album card is an entry that definitely
    //    lands on empty page.
    //    Decision criterion is badge: 'filename' means this row involves filenames source (filename has priority
    //    in badgeOf); others ('ocr' / 'semantic') are what album recognizes. **Don't change buildSearchView**
    //    (Task 2 deliverable).
    const albumMedia = v.mediaRows.filter((m) => m.badge !== 'filename')
    const fileMedia = v.mediaRows.filter((m) => m.badge === 'filename')
    v.docRows.slice(0, 2).forEach((row) => out.push({ type: 'row', row }))
    // Assembly order and tab counts unchanged (spec §7.7): media block as a whole still occupies the original
    // album card position; when album card input is empty, don't render album card, those images appear as media single-rows in the same segment.
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

// ── Downgrade notice / empty state / results switch ────────────────────────────────────────
const SOURCE_KEYS: Record<string, string> = {
  semantic: 'searchSourceSemantic', images: 'searchSourceImages', filenames: 'searchSourceFilenames',
}
// Text for unavailable sources; unrecognized warnings are appended as-is, not silently dropped (deriveDegrade already categorized).
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
// Just saying one title for empty state is not enough; must clarify which sources didn't participate.
// ⚠️ Cannot hardcode condition to 'backend_not_ready': when warnings = ['no_accessible_roots','images_unavailable'],
//    deriveDegrade gives empty='no_roots', noticeItems is computed but nowhere to render it
//    (downgrade notice .search-notice only draws when there are results) — that info is swallowed.
//    Relax to "any non-'none' empty state + has content".
const showEmptySources = computed(() => degrade.value?.empty !== 'none' && noticeItems.value.length > 0)

const showResults = computed(() => state.value === 'done' && !!view.value && view.value.total > 0)

// ── Highlight: yellow-mark snippets in summary matching query term (case-insensitive) ────────────────
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

// ── Behavior ────────────────────────────────────────────────────────────────────
function performSearch(): void {
  activeTab.value = 'all'
  void run() // Empty query term blocked by run() itself
}
// Virtual path of file's containing folder (for display + open folder).
function folderOf(realPath: string): string {
  const dir = realPath.slice(0, realPath.lastIndexOf('/')) || '/'
  return toVirtualPath(dir, files.displayNames)
}
// New window jump to corresponding directory on frontend file page (/#/files/...).
// ⚠️ Declared deviation 4 (fixing real defect, not changing UI): path must go through virtualPathToRouteParam
//    (per-segment encodeURIComponent), consistent with all other /files jumps in the repo (Files.vue / SharesPage.vue /
//    DropPage.vue goVirtual). Raw string concatenation lets `#` in directory names truncate the hash (jump to parent),
//    `?` treated as query, `%` causes vue-router decode failure (empty list). Demo phase fed hardcoded constants;
//    first real user paths after backend integration would trigger the defect via raw concatenation.
function openFilesAt(virtualPath: string): void {
  const param = virtualPathToRouteParam(virtualPath)
  window.open(`${window.location.origin}${import.meta.env.BASE_URL}#/files/${param}`, '_blank', 'noopener')
}
function openFolder(realPath: string): void {
  openFilesAt(folderOf(realPath))
}
// Left-click result: directory goes directly into that directory (no preview for directories);
// file reuses file page's ViewerHost for in-place preview, unsupported types fall back to open containing folder.
function openRow(row: ResultRow): void {
  if (row.isDir) { openFilesAt(toVirtualPath(row.realPath, files.displayNames)); return }
  const entry: FileEntry = { name: row.name, path: row.realPath, is_dir: false }
  if (!viewer.openItem(entry, [entry])) openFolder(row.realPath)
}
// Single image / video row: left-click for in-place preview (unsupported falls back to AI photo library).
function openMedia(row: ResultRow): void {
  const entry: FileEntry = { name: row.name, path: row.realPath, is_dir: false }
  if (!viewer.openItem(entry, [entry])) openPhotos()
}
// Left-click entry for media single-row. ⚠️ Second half of declared deviation 6: **album-related fallback and CTA
//   only for rows album recognizes**. Filename-matched images use openRow (in-place preview, open folder on unsupported)
//   — they may live anywhere, falling back to album is also landing on empty page; images / OCR matches still use openMedia (fallback to album).
function openMediaRow(row: ResultRow): void {
  if (row.badge === 'filename') { openRow(row); return }
  openMedia(row)
}
// Enter AI photo library and search by keyword intelligently.
// ⚠️ Declared deviation 1 (fixing real defect, not changing UI): original implementation hardcoded jump origin
//    as a colleague's machine's LAN IP (demo residue), fallback query to `|| 'fish'` (demo 1 keyword).
//    Changed to same-origin relative redirect, no fallback (spec §7.9).
function openPhotos(): void {
  const q = query.value.trim()
  homeUi.closeSearch()
  window.location.href = `${window.location.origin}/#/photos?q=${encodeURIComponent(q)}`
}
// Ask Nimo AI: send current input to AI and jump to AI chat page (reuse same logic as desktop AI component sendToAI).
function askNimoAi(): void {
  const q = query.value.trim()
  homeUi.closeSearch()
  sendToAI(q)
}

// When preview layer is open, intercept dialog's "click outside / Esc" default close to avoid closing search panel too.
function onInteractOutside(e: Event): void {
  if (viewer.open.value) e.preventDefault()
}
// Preview Esc handler and reka's both attach to window **bubbling phase**, so execution order depends entirely on
// registration order — Home already has a ViewerHost registered when it mounts, long before this dialog opens. It thus
// closes preview first, clears viewer.open to false, the guard reads it as false and doesn't block, dialog dismisses too,
// search results are lost. Capture phase listeners are **necessarily** earlier than both, so here we snapshot
// "whether preview was open when key was pressed", judgment no longer depends on registration order.
//
// Don't change ViewerHost to stopPropagation(): can't block at same target same phase (need
// stopImmediatePropagation), and that would bet correctness on "ViewerHost happened to register first".
let viewerOpenAtKeydown = false
function snapshotViewerState(e: KeyboardEvent): void {
  if (e.key === 'Escape') viewerOpenAtKeydown = viewer.open.value
}
onMounted(() => window.addEventListener('keydown', snapshotViewerState, true))
onBeforeUnmount(() => window.removeEventListener('keydown', snapshotViewerState, true))

function onEscapeKeyDown(e: Event): void {
  if (viewerOpenAtKeydown) e.preventDefault() // Let ViewerHost's own Esc close preview
}

// Reset state each time panel opens; also reset() on close to invalidate in-flight requests (no writes to closed panel).
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
// After editing keyword, return to idle state, need to press Enter again to search. reset() doesn't clear query itself.
watch(query, () => {
  if (state.value !== 'idle') reset()
})

// ── Deep link ?q= ──────────────────────────────────────────────────────
// This app has no dedicated search page; search is this panel on the desktop, so the
// ?q= deep link param lands on the desktop route '/', consumed by this component itself.
// "q key exists" opens panel (even if empty — mirrors Vue2's old bare /search empty page);
// non-empty word auto-searches once.
//
// ⚠️ Two await nextTick() each wait for an **already-present watcher** above to flush; order cannot be combined or skipped:
//   ① Wait for searchOpen watcher — it clears query when opening panel (`query.value = ''`). If seed word set before it
//      completes, the word is wiped: input empty, no search.
//   ② Wait for query watcher — it resets when it sees query change and state !== 'idle', and reset() increments epoch
//      to invalidate in-flight request results. If performSearch() runs before it flushes, request still sends but result
//      is discarded, panel shows empty-state message — **appearance exactly like "searched but found nothing"**.
//   Both have dedicated regression cases (SearchDialog.test.ts "deep link ?q=" section); deleting either tick must fail.
// Consume then immediately remove q from address bar: ① user closing panel and refreshing won't pop open again;
// ② re-entering same ?q= still triggers watcher (value not stuck on old value).
const route = useRoute()
const router = useRouter()
watch(() => route.query.q, (raw) => {
  if (raw === undefined) return
  // ⚠️ `?q` (key present but no equals sign) vue-router gives **null**, not ''; `?q=a&q=b` gives array.
  //    Decision criterion is "key present or not"; always normalize value to string — key present opens panel,
  //    empty string just opens without searching. Previous approach blocking only undefined would let seed get null,
  //    then seed.trim() throws TypeError, panel won't even open (vue-tsc TS18047 caught it first, regression case added).
  const first = Array.isArray(raw) ? raw[0] : raw
  const seed = first ?? ''
  homeUi.openSearch()
  void (async () => {
    await nextTick() // ① Let searchOpen watcher clear query first
    query.value = seed
    await nextTick() // ② Let query watcher flush (state still idle, won't reset this round below)
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

        <!-- Search input row -->
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

        <!-- Request in progress: only show Searching… (previous results still alive, but state is sole switch, don't render) -->
        <div v-if="state === 'searching'" class="searching">
          <span class="spinner" />
          <span class="searching-text">{{ t('searchSearching') }}</span>
        </div>

        <!-- Request failed: inline error block + retry. No toast — toast is z-index 60, will be covered and obscured
             by this dialog's overlay (z-index 1000 + blur). Never degrade to empty list looking like "found nothing". -->
        <div v-else-if="state === 'error'" class="search-error">
          <div class="search-error-title">{{ t('searchErrorTitle') }}</div>
          <div class="search-error-hint">{{ t('searchErrorHint') }}</div>
          <div v-if="errorDetail" class="search-error-detail">{{ errorDetail }}</div>
          <button class="search-retry" @click="run()">{{ t('searchRetry') }}</button>
        </div>

        <!-- Found zero: three empty states explained separately ("found nothing" ≠ "backend not ready" ≠ "no searchable directory") -->
        <div v-else-if="showEmpty" class="search-empty">
          <div class="search-empty-title">{{ emptyText }}</div>
          <div v-if="showEmptySources" class="search-empty-sub">{{ noticeItems.join('、') }}</div>
        </div>

        <!-- Searched: category tabs + results list -->
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

          <!-- Downgrade notice: which sources didn't participate (locally, two of four sources perpetually unavailable,
               user must see "only filename searched this time", not assume search just has these results) -->
          <div v-if="showNotice" class="search-notice">{{ t('searchNoticePrefix') }}{{ noticeItems.join('、') }}</div>

          <div class="results-meta">{{ t('searchResultsCount', { count: resultCount }) }}</div>

          <div class="results">
            <template v-for="it in displayList" :key="it.type === 'album' ? 'album' : it.type === 'media' ? it.media.realPath : it.row.realPath">
              <!-- Album card: images+videos merged, sorted by rank, click to enter AI photo library -->
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

              <!-- Image / video single row: rank + thumbnail + source badge, click for in-place preview -->
              <div v-else-if="it.type === 'media'" class="media-row" role="button" tabindex="0" @click="openMediaRow(it.media)" @keyup.enter="openMediaRow(it.media)">
                <span class="rank">{{ it.rank }}</span>
                <span class="media-thumb">
                  <img :src="mediaThumb(it.media)" alt="" @error="onThumbErr($event, it.media)" />
                  <span v-if="it.media.category === 'Videos'" class="media-play">▶</span>
                </span>
                <span class="media-info">
                  <!-- Declared deviation 7: filename + containing folder two lines, reuse same class names and styling as .result row.
                       Path uses existing folderOf() (internally toVirtualPath, translates /DATA to /NimoOS-HD),
                       same source as .result-path, not written separately. -->
                  <span class="result-name">{{ it.media.name }}</span>
                  <span class="result-path">{{ folderOf(it.media.realPath) }}</span>
                  <!-- Declared deviation 2: previously had a .media-acc-label subtitle line ("match accuracy"),
                       after accuracy percent replaced with source badge it's meaningless, removed. -->
                  <span class="media-acc-num" :class="{ 'media-acc-ocr': it.media.badge === 'ocr' }">{{ badgeLabel(it.media) }}</span>
                </span>
                <!-- Declared deviation 6: top-right CTA also follows source — filename-matched images get "open folder",
                     only album-recognized rows get "open album". Otherwise fixing F1 only halfway: main entry doesn't land
                     on empty album, but this button still sends user to empty album page. -->
                <button v-if="it.media.badge === 'filename'" class="row-open" :title="t('searchOpenFolderTitle')" @click.stop="openFolder(it.media.realPath)">{{ t('searchOpenFolder') }}</button>
                <button v-else class="row-open" @click.stop="openPhotos">{{ t('searchOpenAlbum') }}</button>
              </div>

              <!-- Document / audio row: left-click preview (directory goes directly in), top-right "open folder" new window -->
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

        <!-- Empty state hint when not searching -->
        <div v-else class="idle">
          <div class="hint">{{ t('searchHint') }}</div>
        </div>
      </DialogContent>

      <!-- Reuse file page's preview layer (fullscreen z-index:200, on top of search panel) -->
      <ViewerHost />
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
/* ── Design tokens ──────────────────────────────────────────────────────────────
   All colors consume global theme tokens (see src/styles/theme.css): light mode = warm beige paper background +
   pure white search card; blue mode = dark glass. Semantic colors (related green / deprioritized amber / body gray / hit highlight) and
   accent color (Azure) all provided by global tokens per theme. */

/* Overlay — fullscreen blur makes desktop fade (global overlay token: light mode beige paper, blue mode dark glass) */
.search-overlay {
  position: fixed; inset: 0; z-index: 20;
  background: var(--overlay-bg);
  backdrop-filter: var(--overlay-blur);
}

/* Panel — top-anchored light command panel (floating on beige overlay, separated by soft shadow + border) */
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
/* Keyboard focus ring (accessibility) — only buttons/clickable rows, input doesn't draw box (no box on click) */
.search-panel :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.searchbox:focus, .searchbox:focus-visible { outline: none; }
@media (prefers-reduced-motion: reduce) {
  .search-panel[data-state='open'] { animation: none; }
}

/* Input row — independent white card floating on beige panel (like white search box in photos) */
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

/* Ask Nimo AI — entry button on right of input box, height matches close (✕) button (36px);
   capsule shape, contains gradient star icon + "Ask Nimo" text, like Gemini's Ask button (gradient follows theme) */
.ask-nimo-btn {
  flex: 0 0 auto; display: inline-flex; align-items: center; gap: 7px;
  height: 36px; padding: 0 15px; border-radius: 999px; cursor: pointer; white-space: nowrap;
  font-size: 13.5px; font-weight: 600; letter-spacing: 0.01em;
  color: #fff; /* theme-exception: gradient capsule button text, background always color gradient (--grad-a/--grad-b), white text contrast stable across themes */
  background: linear-gradient(135deg, var(--grad-a), var(--grad-b));
  border: 1px solid rgba(0, 0, 0, 0.06); /* theme-exception: pure neutral pressed edge on colored capsule, not page theme color */
  box-shadow: var(--brand-shadow);
  transition: filter 0.18s, box-shadow 0.18s, transform 0.18s;
}
.ask-nimo-btn:hover { filter: brightness(1.06); box-shadow: var(--brand-shadow); transform: translateY(-1px); }
.ask-nimo-btn:active { transform: translateY(0); }
.ask-nimo-btn svg { flex: 0 0 auto; width: 17px; height: 17px; }
.ask-nimo-label { line-height: 1; }

/* Category tabs */
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

/* Results list (scrollbar uses unified style from global theme.css) */
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

/* "Open folder" at top-right of each row — mimics album card entry button */
.row-open {
  flex: 0 0 auto; align-self: flex-start; margin-top: 2px;
  padding: 5px 12px; border-radius: 999px; cursor: pointer; white-space: nowrap;
  font-size: 12.5px; font-weight: 600; color: var(--accent-text);
  background: var(--accent-soft); border: 1px solid var(--accent-soft-bd);
  transition: background 0.16s, border-color 0.16s;
}
.row-open:hover { background: var(--accent-soft-2); border-color: var(--accent-soft-bd); }

/* Album card */
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
/* theme-exception: source badge on top of any user album thumbnail (not page background), needs fixed dark background+light text to be readable on any photo content, theme-independent */
.album-acc { position: absolute; right: 4px; bottom: 4px; font-size: 10.5px; font-weight: 700; padding: 1px 6px; border-radius: 999px; background: rgba(12, 14, 20, 0.68); color: #8ff0c4; border: 1px solid rgba(95, 227, 176, 0.5); }
.album-acc.album-acc-ocr { color: #cdd7ff; border-color: rgba(140, 162, 255, 0.6); letter-spacing: 0.04em; } /* theme-exception: badge on thumbnail, theme-independent */

/* Image / video single row (under Images / Videos tab, ranked by accuracy) */
.media-row {
  display: flex; align-items: center; gap: 14px; width: 100%; text-align: left; cursor: pointer;
  padding: 10px 14px; border-radius: 16px; background: none; border: none; color: inherit; font: inherit;
  transition: background 0.16s;
}
.media-row:hover { background: var(--hover); }
.media-thumb { position: relative; flex: 0 0 auto; width: 64px; height: 64px; border-radius: 12px; overflow: hidden; border: 1px solid var(--border); background: var(--hover); }
.media-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
/* theme-exception: play triangle on any video thumbnail (not page background), fixed white text+dark shadow corner ensures readability, theme-independent */
.media-play { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #fff; background: rgba(6, 10, 24, 0.32); text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6); }
.media-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
/* Declared deviation 2: 18px was designed for two-three character numbers like "98%", too large for short badges like
   "filename / semantic / ocr" → changed to 13px. Removed .media-acc-label subtitle line ("match accuracy") in same batch. */
.media-acc-num { font-size: 13px; font-weight: 700; color: var(--success); }
.media-acc-num.media-acc-ocr { color: var(--accent-text); letter-spacing: 0.03em; }
/* Declared deviation 7: filename/path two lines use same font size and color as .result-name/.result-path (same token set,
   no additions). One layout constraint here: media row is compact single-line "fixed-height thumbnail + top-right CTA",
   long filenames must single-line ellipsis, not wrap like .result rows — else row height expands, top-right CTA drops down.
   .media-info already has min-width: 0, ellipsis only works then. */
.media-info .result-name,
.media-info .result-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Ranking reason tags (primary follows accent color; others use fixed semantic colors).
   demote category deleted with spec §7.5 — backend has no deprioritization signal, demo's "suspected name·deprioritized" was invented. */
.rz { font-size: 11.5px; padding: 2px 9px; border-radius: 999px; white-space: nowrap; border: 1px solid transparent; }
.rz-primary { background: var(--accent-soft); color: var(--accent-text); border-color: var(--accent-soft-bd); }
.rz-normal { background: var(--nrm-bg); color: var(--nrm-fg); border-color: var(--nrm-bd); }
.rz-semantic { background: var(--sem-bg); color: var(--sem-fg); border-color: var(--sem-bd); }

.result-path { font-size: 12.5px; color: var(--sem-fg); opacity: 0.9; }
.result-snippet { font-size: 13.5px; line-height: 1.5; color: var(--fg-muted); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
.hit { background: var(--hit-bg); color: var(--hit-fg); border-radius: 3px; padding: 0 1px; font-weight: 600; }

/* Searching */
.searching { padding: 52px 26px 54px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.spinner { width: 30px; height: 30px; border-radius: 50%; border: 3px solid var(--ring-track); border-top-color: var(--accent); animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 1.6s; } }
.searching-text { font-size: 14.5px; color: var(--fg-muted); letter-spacing: 0.02em; }

/* Downgrade notice — "Didn't participate in this search: ...", hangs above result count. Reuses .rz-semantic semantic color scheme */
.search-notice {
  margin: 4px 26px; padding: 8px 14px; border-radius: 12px; font-size: 12.5px;
  background: var(--sem-bg); color: var(--sem-fg); border: 1px solid var(--sem-bd);
}

/* Found zero */
.search-empty { padding: 44px 26px 46px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.search-empty-title { font-size: 15px; font-weight: 600; color: var(--fg-muted); }
.search-empty-sub { font-size: 12.5px; color: var(--fg-subtle); text-align: center; }

/* Request failed — inline display in panel (no toast, see comment in template) */
.search-error { padding: 40px 26px 44px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.search-error-title { font-size: 16px; font-weight: 600; color: var(--fg); }
.search-error-hint { font-size: 13.5px; color: var(--fg-muted); }
.search-error-detail { max-width: 620px; text-align: center; font-size: 12px; color: var(--fg-subtle); word-break: break-word; }
/* Retry button: same capsule style as "open folder" (.row-open) at top-right of each row */
.search-retry {
  margin-top: 6px; padding: 5px 12px; border-radius: 999px; cursor: pointer; white-space: nowrap;
  font-size: 12.5px; font-weight: 600; color: var(--accent-text);
  background: var(--accent-soft); border: 1px solid var(--accent-soft-bd);
  transition: background 0.16s, border-color 0.16s;
}
.search-retry:hover { background: var(--accent-soft-2); border-color: var(--accent-soft-bd); }

/* Empty state / placeholder (when not searching) */
.idle { padding: 44px 26px 46px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.hint { font-size: 13px; color: var(--fg-subtle); }
</style>
