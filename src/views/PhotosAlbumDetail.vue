<script setup lang="ts">
// Task 8 (SP7-P4 相册): 相册详情视图——本期最大的一件。结构/时序逐段对照 Vue2 NimoOS-UI
// src/views/Photos/PhotosAlbumDetail.vue(419 行)移植:hero(封面/改名/编辑切换/⋯菜单删除)
// + 工具条(批量移除/添加照片,或排序+密度)+ 自绘网格(拖拽排序/封面星标/多选)+ 删除确认模态
// + PhotosLibraryPicker(T6,添加照片)+ PhotoLightbox(P2,查看/删除)。路由 /photos/albums/:id
// 注册留给 T11。去掉 Slideshow(Vue2 本身也只弹"敬请期待" toast)与 Ask Nimo(归 SP8)。
//
// ★ SP15-P2c Task 3 supersedes the two structures named above. The cover hero and the toolbar
// band are both gone; the page now wears the same skeleton as PhotosSmartViewDetail.vue --
// .sv-detail-bar, then .sv-detail-layout splitting into a scrolling .sv-detail-main (header +
// action row + photo grid) and the .sv-detail-side rail. Edit mode's two buttons moved to a
// floating .sv-select-bar at the bottom. Target: 33b05636:src/views/Photos/PhotosAlbumDetail.vue.
//
// 铁律(逐条落实,见文件内注释登记):
//  1) route.params.id 恒为字符串;albumId 统一走 String(route.params.id),所有对 store 的调用
//     (fetchAlbumAssets/renameAlbum/setAlbumCover/removeAssetsFromAlbum/deleteAlbum/
//     reorderAlbumAssets)都传这个归一后的字符串——T2 store 内部本就按 String(key) 比较,
//     传字符串永远安全,不需要在这里猜后端 id 的真实类型。
//  2) 封面判定 isCover(p) = String(p.id) === String(album.cover)(album.cover 可能是数字)。
//  3) selected 用 Set<string>(String 归一)。
//  4) 全程无对象引用 ===。
//
// Plan C Task 2(公共换壳):壳从 AreaShell + `.photos-layout` flex-row 换成 Photos.vue 的
// Vue2 结构 `.photos-root[themeClass] > .app[data-collapsed] > PhotosSidebar + main.main`
// ——`collapsed` 改用共享 composable useSidebarCollapse(），随换壳一并补上折叠态持久化
// （此前 PhotosSidebar 一直吃默认值 false，恒展开）。同 PhotosAlbums.vue 的换壳注释一致，
// 已知遗留（移动端窄屏下没有 AreaShell 的 hamburger 入口去开侧栏抽屉，brief 明确本任务不
// 越权补）不再逐页重复，详见 task-2-report.md。
import '../photos/styles/vue2-parity'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import { useSidebarCollapse } from '../photos/composables/useSidebarCollapse'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosTopbar from '../photos/components/PhotosTopbar.vue'
import PhotosLibraryPicker from '../photos/components/PhotosLibraryPicker.vue'
import AlbumPickerDialog from '../photos/components/AlbumPickerDialog.vue'
import AlbumConvertToSmartDialog from '../photos/components/AlbumConvertToSmartDialog.vue'
import PhotoLightbox from '../photos/lightbox/PhotoLightbox.vue'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { usePhotosAlbums } from '../photos/stores/albums'
import type { SmartView } from '../photos/stores/smartViews'
import { useTimelineStore } from '../photos/stores/timeline'
import { usePhotosSettingsStore } from '../photos/stores/settings'
import { useToast } from '../stores/toast'
import { useAlbumDragSort } from '../photos/composables/useAlbumDragSort'
import { useFixedMenuPosition } from '../photos/composables/useFixedMenuPosition'
import { albumToView, sortAlbumPhotos } from '../photos/util/albumView'
import { isConflict } from '../photos/util/httpErrors'
import type { Photo } from '../photos/util/assetToPhoto'

type SortBy = 'manual' | 'taken' | 'added'

const { t, locale } = useI18n()
const { themeClass } = usePhotosTheme()
// Fix-1 item 1 (owner acceptance, 2026-08-13): `toggle` wires the topbar's collapse button
// (same as Photos.vue/PhotosAlbums.vue).
const { collapsed, toggle: onToggleCollapse } = useSidebarCollapse()
const route = useRoute()
const router = useRouter()
const albums = usePhotosAlbums()
const timeline = useTimelineStore()
const settings = usePhotosSettingsStore()
const toast = useToast()
const lb = useLightbox()

// T6: this repo's locale ids (`zh_cn`/`en_us`) are not valid BCP-47 tags -- handing one to
// toLocaleString/toLocaleDateString bare throws a RangeError. Same form as
// PhotosMomentDetail.vue's own localeTag.
const localeTag = computed(() => locale.value.replace('_', '-'))

// 铁律 1:route.params.id 恒为字符串——统一在这一处归一,下游所有 store 调用都用它。
const albumId = computed(() => String(route.params.id))

// ── 本地状态(照 brief 结构清单命名)──
const edit = ref(false)
const selected = ref<Set<string>>(new Set())
const sortBy = ref<SortBy>('manual')
const density = ref<'comfortable' | 'compact'>('comfortable')
const titleEditing = ref(false)
const titleDraft = ref('')
const titleCommitting = ref(false)
const menuOpen = ref(false)
const sortMenuOpen = ref(false)
const confirmDelete = ref(false)
// 终审 Minor 6:「移除选中」请求飞行期不 disable,连点会对同一批 id 发两轮并发 DELETE——
// 第二轮基于已移除后的快照回滚,失败时会恢复错的快照。同款重入守卫(照 T7
// PhotosAlbums.vue `creating` / AlbumPickerDialog.vue `submitting`/`adding` 的既定写法)。
const removing = ref(false)
const pickerOpen = ref(false)
// Task 9(SP7-P4 相册):灯箱「加入相册」→ 加到别的相册(不是本相册)—— 命名与上面
// PhotosLibraryPicker 的 pickerOpen(本相册「添加照片」)区分,避免同名 ref 混淆两个不同面板。
const albumPickerOpen = ref(false)
const albumPickerIds = ref<Array<string | number>>([])
function openAlbumPicker(ids: Array<string | number>) {
  albumPickerIds.value = ids
  albumPickerOpen.value = true
}
// 加到的是别的相册,不是本相册——无需 fetchAlbumAssets 刷新(brief 明确)。空函数只为占位,
// 与 Photos.vue/PhotosFavorites.vue 的同名接线保持一致的可读性。
function onAlbumPickerAdded(): void {}

const titleInputRef = ref<HTMLInputElement | null>(null)
const morePopRef = ref<HTMLElement | null>(null)
// Task 5: the composable only takes the trigger button's rect, not the click-outside wrapper's --
// morePopRef stays the click-outside container (onDocMousedown below), moreBtnRef is new and
// exists solely to hand the button element to useFixedMenuPosition. Neither replaces the other.
const moreBtnRef = ref<HTMLElement | null>(null)
const sortMenuRef = ref<HTMLElement | null>(null)
const gridRef = ref<HTMLElement | null>(null)

// Task 5 (T1): pins the more menu to the viewport via the trigger button's rect, so it no longer
// clips against .sv-detail-side's own overflow-y:auto once the menu grew to five entries.
const { menuStyle } = useFixedMenuPosition(menuOpen, moreBtnRef)

// ── 派生数据 ──
// album 为 null 有两种子情形(区分见模板):albumsLoaded===false → 还没加载完,渲染骨架;
// albumsLoaded===true 但仍是 null → 相册真不存在(New-UI 补齐项,Vue2 因页内 state 不会
// 出现此情形,记账)。
const album = computed(() => {
  const raw = albums.albumById(albumId.value)
  return raw ? albumToView(raw, t('photosAlbumUntitled')) : null
})
const notFound = computed(() => albums.albumsLoaded && album.value === null)

// Fix-1 item 1 (owner acceptance, 2026-08-13): PhotosTopbar's title/sub. Vue2 nests the album
// detail layer inside PhotosAlbumsView while activeNav stays 'albums'
// (NimoOS-UI PhotosAlbumsView.vue:12-21's <photos-album-detail>) -- topbarTitle/
// topbarSubContext are keyed purely by activeNav, unaffected by which album is open
// (PhotosTimeline.vue:184-234), so the topbar here is byte-for-byte the same as the Albums
// list page's own (see PhotosAlbums.vue's identical `topbarTitle`/`topbarSub` computeds):
// title='Albums', sub=the aggregate across every album -- not this one album's own count.
const topbarTitle = computed(() => t('photosAlbumsTitle'))
const topbarSub = computed(() => {
  const totalPhotos = albums.albums.reduce((sum, a) => sum + (Number((a as Record<string, unknown>).photoCount) || 0), 0)
  const totalVideos = albums.albums.reduce((sum, a) => sum + (Number((a as Record<string, unknown>).videoCount) || 0), 0)
  return t('photosCountSummary', { photos: totalPhotos.toLocaleString(), videos: totalVideos.toLocaleString() })
})

// Vue2 :224-242(photos computed)—— 由 T1 sortAlbumPhotos 提供排序,这里只接线数据源。
const photos = computed<Photo[]>(() => sortAlbumPhotos(albums.assetsOf(albumId.value), sortBy.value))
const isLoadingPhotos = computed(() => albums.isLoadingAssets(albumId.value))
const isAlbumEmpty = computed(() => !isLoadingPhotos.value && photos.value.length === 0)

// SP15-P2c Task 3: `coverBgImage` is gone with the cover hero it painted. The
// `--album-cover-fallback` token it referenced stays in theme.css -- PhotosAlbums.vue's
// .album-cover-fallback is still a consumer (grep-verified before the deletion).

// T6: stats rail — the four cells the smart-view detail page has always had.
const DASH = '—'

// Vue2 :251-253: reuse the human-readable span the list already formats (formatAlbumSpan,
// same call already backing album.dateRange), not a second formatter.
const spanLabel = computed(() => album.value?.dateRange || DASH)

// Vue2 :260-262. videoCount is not omitempty on the wire (albumToView reads
// `Number(a.videoCount ?? 0)`), so 0 is a real answer, not missing data.
const videoCountLabel = computed(() => (album.value?.videoCount ?? 0).toLocaleString(localeTag.value))

// Vue2 :263-271. Vue2 replaced its own "Recently added" cell with this one in the final review
// round: that cell also read createdAt, so it duplicated this one and, on an old album, read as
// though new photos had just arrived.
const createdLabel = computed(() => {
  const raw = album.value?.createdAt
  if (!raw) return DASH
  const d = new Date(raw)
  if (isNaN(d.getTime())) return DASH
  return d.toLocaleDateString(localeTag.value, { month: 'short', day: 'numeric', year: 'numeric' })
})

// By-month histogram: verbatim port of PhotosMomentDetail.vue's own monthBuckets/distMax/
// distStyle (same Vue2 source, already through a whole-branch review), with allAssets.value
// swapped for this page's photos.value.
interface MonthBucket { key: string; count: number; label: string }
const monthBuckets = computed<MonthBucket[]>(() => {
  if (!photos.value.length) return []
  const map = new Map<string, number>()
  for (const p of photos.value) {
    if (!p.takenAt) continue
    const d = new Date(p.takenAt)
    if (isNaN(d.getTime())) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, count]) => {
      const [y, m] = key.split('-')
      const label = new Date(Number(y), Number(m) - 1)
        .toLocaleDateString(localeTag.value, { month: 'short', year: 'numeric' })
      return { key, count, label }
    })
})
const distMax = computed(() => Math.max(1, ...monthBuckets.value.map((b) => b.count)))
function distStyle(b: MonthBucket, i: number): { height: string; opacity: number } {
  const n = Math.max(1, monthBuckets.value.length - 1)
  return { height: `${(b.count / distMax.value) * 100}%`, opacity: 0.4 + (i / n) * 0.5 }
}

// Task 4 (Vue2 :570-579). About·Time span — prefer the human-readable span the album list
// already formats (spanLabel/album.dateRange); when that's the placeholder, derive it from the
// currently-loaded members' takenAt (min/max), same locale-aware fmt as createdLabel. DASH only
// when neither source has anything.
const timeSpanLabel = computed(() => {
  if (spanLabel.value !== DASH) return spanLabel.value
  const times = photos.value
    .map((p) => (p.takenAt ? new Date(p.takenAt) : null))
    .filter((d): d is Date => d !== null && !isNaN(d.getTime()))
  if (!times.length) return DASH
  const fmt = (d: Date) => d.toLocaleDateString(localeTag.value, { month: 'short', day: 'numeric', year: 'numeric' })
  const min = new Date(Math.min(...times.map((d) => d.getTime())))
  const max = new Date(Math.max(...times.map((d) => d.getTime())))
  const a = fmt(min)
  const b = fmt(max)
  return a === b ? a : `${a} – ${b}`
})

// Task 4 (Vue2 :588-599). About·Place — assetToPhoto already resolves each loaded member's
// `place` (placeName, or a coordinate-derived country fallback), so this aggregates by
// frequency locally instead of issuing a separate request.
interface PlaceCount { name: string; count: number }
const placesAgg = computed<PlaceCount[]>(() => {
  const freq = new Map<string, number>()
  for (const p of photos.value) {
    if (!p.place) continue
    freq.set(p.place, (freq.get(p.place) ?? 0) + 1)
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))
})
// Vue2 :601-607. Top three by frequency joined with " · ", "+N" for whatever is left over.
const placesLabel = computed(() => {
  if (!placesAgg.value.length) return DASH
  const top = placesAgg.value.slice(0, 3).map((p) => p.name)
  const rest = placesAgg.value.length - top.length
  return rest > 0 ? `${top.join(' · ')} +${rest}` : top.join(' · ')
})
// Vue2 :609-613. Hover hint: every place with its count. Empty string (not DASH) when there is
// nothing to hint at — driven by the same `placesAgg.value.length` gate as placesLabel above, so
// the two can never drift out of sync (one shared source, not two placeholder literals).
const placesTitle = computed(() =>
  placesAgg.value.length ? placesAgg.value.map((p) => `${p.name} (${p.count})`).join(' · ') : '',
)

function isCover(p: Photo): boolean {
  // 铁律 2:值比较,不管两边谁是字符串谁是数字。
  return String(p.id) === String(album.value?.cover)
}
function isSelected(p: Photo): boolean {
  return selected.value.has(String(p.id))
}
function thumbnailUrl(id: string | number, size: string): string {
  return service.photos.thumbnailUrl(id, size)
}

const sortOptions = computed(() => [
  { id: 'manual' as SortBy, label: t('photosAlbumSortManual') },
  { id: 'taken' as SortBy, label: t('photosAlbumSortTaken') },
  { id: 'added' as SortBy, label: t('photosAlbumSortAdded') },
])
const currentSortLabel = computed(() => sortOptions.value.find((s) => s.id === sortBy.value)?.label ?? '')

// The edit-mode bottom bar's hint. Whole-branch review, Important 3: this used to reuse
// tileHintTitle's keys, so the bar advertised "★ to set cover" -- an affordance the bar does not
// offer (only a tile does). The target keeps the two deliberately distinct: the bar reads
// "Click to select · Drag to reorder" / "Click to select" (33b05636 PhotosAlbumDetail.vue:330),
// the "★ to set cover" halves live only in tileTitle() (:799-800). The plain branch reuses
// photosSvClickToSelect, the exact key the smart-view page's own bar already uses.
const editHintText = computed(() => {
  if (selected.value.size > 0) return t('photosSelectedCount', { count: selected.value.size })
  return sortBy.value === 'manual' ? t('photosAlbumHintSelectDrag') : t('photosSvClickToSelect')
})
const tileHintTitle = computed(() => {
  if (!edit.value) return ''
  return sortBy.value === 'manual' ? t('photosAlbumHintSelectDragCover') : t('photosAlbumHintSelectCover')
})

// ── T4 拖拽排序接线 ──
const drag = useAlbumDragSort({
  container: gridRef,
  enabled: () => edit.value && sortBy.value === 'manual',
  onOrder: (ids) => {
    albums.reorderAlbumAssets(albumId.value, ids).catch((e) => {
      console.error('[album-detail] reorder', e)
      toast.show(t('photosAlbumOrderFailed'))
    })
  },
})

// ── 瓦片交互 ──
function toggleSelect(p: Photo): void {
  const key = String(p.id)
  if (selected.value.has(key)) selected.value.delete(key)
  else selected.value.add(key)
}

// 拖拽守卫(照 Vue2 :380-384 `_dragging`)—— 必须在最前面,否则拖完那一下会误触发选中/开灯箱。
function onTileClick(p: Photo): void {
  if (drag.isDragging()) return
  if (edit.value) toggleSelect(p)
  else lb.openAt(p, photos.value, 0)
}

async function setCover(p: Photo): Promise<void> {
  try {
    await albums.setAlbumCover(albumId.value, p.id)
    toast.show(t('photosAlbumCoverUpdatedToast'))
  } catch (e) {
    console.error('[album-detail] setCover', e)
    toast.show(t('photosAlbumCoverFailed'))
  }
}

// ── Hero:标题编辑 ──
function startTitleEdit(): void {
  titleDraft.value = album.value?.title ?? ''
  titleEditing.value = true
  void nextTick(() => {
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  })
}
function cancelTitleEdit(): void {
  titleEditing.value = false
}
async function commitTitle(): Promise<void> {
  if (titleCommitting.value) return
  const v = titleDraft.value.trim()
  const original = album.value?.title ?? ''
  if (!v || v === original) {
    titleEditing.value = false
    return
  }
  titleCommitting.value = true
  try {
    await albums.renameAlbum(albumId.value, v)
    toast.show(t('photosAlbumRenamedToast'))
  } catch (e) {
    // 失败时 store 从未写回本地(T2 renameAlbum 只在成功后才 updateAlbumLocal),album.title
    // 这个 computed 因此自然保持原值——不需要额外代码"还原标题"。
    toast.show(isConflict(e) ? t('photosAlbumNameExists') : t('photosAlbumRenameFailed'))
  } finally {
    titleCommitting.value = false
    titleEditing.value = false
  }
}

// Minor 修正:同 PhotosAlbums.vue:85-87 的具名函数写法,把导航调用从模板内联表达式挪出来——
// 模板里内联 `@click="router.push(...)"` 会把返回的 promise 挂在事件处理器上不管,导航被
// 取消/重复时 reject 没人接住(vue-router 的已知坑,console 会打未捕获 rejection);这里额外
// 加 `void` 显式标记"不关心其 resolve/reject"。
function goToAlbumsList(): void {
  void router.push('/photos/albums')
}

// Task 9(P8a,P4 遗留收口):fetchAlbums 失败时 albumsLoaded 保持假(见 albums.ts 注释,
// 刻意不变),旧实现下 `!album && !albums.albumsLoaded` 因此恒真 → 永久停在骨架屏。新增
// loadError 分支(见模板,优先级在骨架分支之前)+ 这个重试入口,直接重新调用同一个 fetch。
// 评审 Important 1 修正:本地 retrying 守卫——fetchAlbums 只在成功时才清 loadError
// (见 albums.ts 同批修正注释),所以按钮本身不再需要靠"清空态"给用户即时反馈;这个 ref
// 补上这份反馈(disabled),同时顺带堵住连点两次重试派发两个并发 fetch 的口子。
const retryingAlbums = ref(false)
async function retryAlbums(): Promise<void> {
  if (retryingAlbums.value) return
  retryingAlbums.value = true
  try {
    await albums.fetchAlbums()
  } finally {
    retryingAlbums.value = false
  }
}

// ── Hero:编辑态/⋯菜单 ──
function toggleEditMode(): void {
  edit.value = !edit.value
  if (!edit.value) selected.value.clear()
  // Whole-branch review, Important 1 -- the same defect PhotosSmartViewDetail.vue:toggleEdit
  // already fixed, kept in step here. Keyboard-activating this button (Space/Enter on a focused
  // element) fires a `click` but no `mousedown` -- the event onDocMousedown listens for to close
  // the sort menu. Without this, entering edit mode that way leaves `sortMenuOpen` true while the
  // template unmounts the sort capsule (`v-if="!edit"`), and the popup springs back the moment
  // edit mode is left again, with no visible trigger for it. Sort has no meaning in edit mode
  // either way, so closing it unconditionally here -- entering or leaving -- is safe.
  sortMenuOpen.value = false
}
function askConfirmDelete(): void {
  menuOpen.value = false
  confirmDelete.value = true
}

// Task 5 (Vue2 :708-730 duplicateAlbum). Thin page-level wrapper around the store's own
// duplicateAlbum (T2): close the menu, delegate name/asset-id computation and the re-entry guard
// to the store, and translate its outcome into a toast. Unlike this page's other guarded writes
// (removing/pickerAdding), there is no local busy ref here -- the store's `duplicateBusy` throws
// on re-entry rather than resolving quietly (T2's own comment explains why: unlike its smart-view
// sibling, this one must resolve to a value on the success path). The catch below discriminates
// that expected rejection from a real failure by reading `albums.duplicateBusy` at the moment the
// rejection is observed: the store's own `finally` always clears the flag before a genuine
// failure rethrows, so it can only still read true here for the synchronous re-entrant throw.
async function duplicateAlbum(): Promise<void> {
  menuOpen.value = false
  const name = album.value?.title ?? ''
  try {
    await albums.duplicateAlbum(albumId.value)
    // Target's own success copy (33b05636:PhotosAlbumDetail.vue:713-716) -- identical wording to
    // the smart-view sidebar's own duplicate toast, hence the shared key.
    toast.show(t('photosSvDuplicatedNameOpenCopy', { name }))
  } catch (e) {
    if (albums.duplicateBusy) return // a second click while the first is still in flight -- not a failure
    console.error('[album-detail] duplicateAlbum', e)
    // Target reuses the same "name already exists" copy the rename path shows for its own 409.
    toast.show(isConflict(e) ? t('photosAlbumNameExists') : t('photosSvDuplicateFailed'))
  }
}

// Task 5 (Vue2 :736-743 runExportZip). GET+token navigation -- exportAlbumZipUrl (T2) is
// JWT-exempt via the query token, same shape as favorites.ts's own exportZip, so a plain
// navigation is enough here. Not the fetch+blob dance PhotosSmartViewDetail.vue's downloadZip
// uses: that endpoint is POST-only and not JWT-exempt, a different backend contract entirely --
// the target confirms this page's own contract is the simple GET one (:736-738's literal
// `window.location.href = photosService.exportAlbumZipUrl(...)`).
function downloadZip(): void {
  menuOpen.value = false
  window.location.href = service.photos.exportAlbumZipUrl(albumId.value)
  const n = album.value?.count ?? 0
  toast.show(t('photosSvPreparingZipNPhotos', { n: n.toLocaleString(localeTag.value) }))
}

// T6: same criterion as the Albums page's smart-view-create gating (Vue2 :226-229 threads it
// down as a prop; here both pages read the one settings store directly instead).
const smartViewDisabled = computed(() => settings.aiFeatures.smartview === false)

// T7 mounts the dialog this stub opens; the body lands there together with the write it makes.
const convertOpen = ref(false)
function openConvertModal(): void {
  if (smartViewDisabled.value) return
  menuOpen.value = false
  convertOpen.value = true
}

// Vue2 :721-743 closes the album detail, refetches both lists, then opens the new smart
// view's detail. Here the navigation does all of that: the source album no longer exists
// server-side, and the destination route loads the new smart view itself. No refetch, no
// nextTick dance -- Vue2 needed those because two mergeQuery calls in one tick raced over the
// same query snapshot, and New-UI has no query-based deep link here at all.
function onConverted(sv: SmartView): void {
  void router.push('/photos/smart-views/' + sv.id)
}

// ── 工具条:批量移除 ──
async function removeSelected(): Promise<void> {
  if (!selected.value.size || removing.value) return
  removing.value = true
  const ids = Array.from(selected.value)
  try {
    await albums.removeAssetsFromAlbum(albumId.value, ids)
    selected.value.clear()
    toast.show(t('photosAlbumRemovedToast', { count: ids.length }))
  } catch (e) {
    console.error('[album-detail] removeSelected', e)
    toast.show(t('photosAlbumRemoveFailed'))
  } finally {
    removing.value = false
  }
}

// ── 删除相册(唯一带二次确认的操作)──
async function doDelete(): Promise<void> {
  confirmDelete.value = false
  const name = album.value?.title ?? ''
  try {
    await albums.deleteAlbum(albumId.value)
    toast.show(t('photosAlbumDeletedToast', { name }))
    void router.push('/photos/albums')
  } catch (e) {
    console.error('[album-detail] deleteAlbum', e)
    toast.show(t('photosAlbumDeleteFailed'))
  }
}

// ── 排序下拉 ──
function pickSort(s: SortBy): void {
  sortBy.value = s
  sortMenuOpen.value = false
}

// ── PhotosLibraryPicker(T6)接线 ──
// SP15-P1-T9 · Step 0: with the component generalised, the write, the success/failure toasts and
// closing the panel belong to the caller (the component only picks photos). Behaviour is
// unchanged from before the refactor: the same addAssetsToAlbum, the same photosAlbumAddedToast
// (album name + count), the same photosAlbumAddFailed, closing on success only (a failure leaves
// the panel up so the user can retry), and the fetchAlbumAssets refresh that hung off `@added`.
//
// The String() here is load-bearing, not decoration: album assets come back from the API with
// numeric ids while timeline photos carry string ids, so without it the picker would stop
// recognising a single already-in photo. Asserted in this page's own test with a numeric fixture.
const pickerExistingIds = computed(
  () => new Set(albums.assetsOf(albumId.value).map((p) => String(p.id))),
)
// The label carries the selected count, so the caller passes a function rather than a fixed
// string (see deviation b in the component's header).
function pickerSubmitLabel(count: number): string {
  return t('photosAlbumPickerAdd', { count })
}
const pickerAdding = ref(false)
// Fix round 2 (coordinator review, Important): onPickerConfirm used to read `albumId.value`
// fresh at call time. If the picker was left open while the route's id moved to a *different,
// real* album, a confirm arriving after that point would silently write into the newly-viewed
// album instead of the one the user actually picked photos for. `pickerAlbumId` snapshots the id
// the moment the picker opens (see `openPicker()` below) so the write always targets the album
// the picker was opened for, never whatever `route.params.id` happens to be when the confirm
// resolves. The id watcher additionally closes the dialog (`pickerOpen.value = false`) on every
// id change, so in real usage the confirm button is gone by then anyway (PhotosLibraryPicker.vue
// gates its whole template on `v-if="open"`) — the snapshot is what keeps a synthetic/in-flight
// confirm harmless too, without having to block on `pickerOpen` itself (which is also flipped by
// unrelated tests that exercise this handler directly, without ever opening the dialog).
const pickerAlbumId = ref(albumId.value)
// Task 5 (Task 4 re-review fold-in): the id snapshot above pins the *write*, but the success
// toast's `{name}` used to read `album.value?.title` live at resolve time -- a computed that
// tracks whatever album the route currently points at, not the one the write actually landed on.
// After a navigation to a different, real album while the picker was open, the toast would name
// the *new* album while the write still landed on the *snapshotted* one (see `pickerAlbumId`'s own
// comment): two different albums, one confirm. Snapshotting the name alongside the id here keeps
// the toast and the write pointed at the same album, always.
const pickerAlbumName = ref(album.value?.title ?? '')
function openPicker(): void {
  pickerAlbumId.value = albumId.value
  pickerAlbumName.value = album.value?.title ?? ''
  pickerOpen.value = true
}
async function onPickerConfirm(ids: Array<string | number>): Promise<void> {
  if (pickerAdding.value) return
  pickerAdding.value = true
  const id = pickerAlbumId.value
  const name = pickerAlbumName.value
  try {
    await albums.addAssetsToAlbum(id, ids)
    toast.show(t('photosAlbumAddedToast', { count: ids.length, name }))
    pickerOpen.value = false
    void albums.fetchAlbumAssets(id)
  } catch (e) {
    console.error('[album-detail] addAssetsToAlbum', e)
    toast.show(t('photosAlbumAddFailed'))
  } finally {
    pickerAdding.value = false
  }
}

// ── PhotoLightbox(P2)接线——@delete + @add-to-album(T9:只接灯箱一处,edit 工具条
// 「添加照片」已有自己的语义,不重复放「加入相册」)──
// 照 P3 收藏视图 T8 的同款处理:灯箱已在真实资产层面删除,相册内的引用也要跟着消失,
// 靠重新拉取该相册的资产列表实现(而不是本地过滤,store 才是真源)。
async function onLightboxDelete(assetId: string | number): Promise<void> {
  // Minor 修正:timeline.deleteAssets 逐项删除、吞掉单项失败,返回真实成功计数
  // (src/photos/stores/timeline.ts:162-176)——原实现忽略返回值恒报 count:1,单项删除这里
  // 恒真但仍是错的语义;照 PhotosFavorites.vue:52-57 的批量写法读返回值,并用同一个 4000ms
  // 时长(默认 1500ms 太短,是 P3 定的时长)。
  const n = await timeline.deleteAssets([String(assetId)])
  toast.show(t('photosDeletedToast', { count: n }), 4000)
  void albums.fetchAlbumAssets(albumId.value)
}

// ── document 级监听(⋯菜单/排序菜单点外部关闭,删除确认模态 Esc)──
// 照既有范式(T5/T6/T7/PhotoLightbox.vue):不用模板 @keydown.esc,依赖真实焦点会漏判。
function onDocMousedown(e: MouseEvent): void {
  if (menuOpen.value && morePopRef.value && !morePopRef.value.contains(e.target as Node)) {
    menuOpen.value = false
  }
  if (sortMenuOpen.value && sortMenuRef.value && !sortMenuRef.value.contains(e.target as Node)) {
    sortMenuOpen.value = false
  }
}
function onDocKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  if (confirmDelete.value) { confirmDelete.value = false; return }
  if (menuOpen.value) { menuOpen.value = false; return }
  if (sortMenuOpen.value) sortMenuOpen.value = false
}

// ── 生命周期 / watch(照 Vue2 :257-280 的三个触发点 + brief 补的 route watch)──
// Minor 3 修正:首次资产 fetch 从 onMounted 挪到 setup 阶段直接发起(不等 onMounted 回调)——
// fetchAlbumAssets 内部同步(await 之前)就会把 isLoadingAssets 标志置位,挪到这里意味着首次
// render 提交前该标志已经是 true 了。不挪的话:从相册列表页跳进来时 album 已加载、album.value
// 立即非 null,而 isLoadingPhotos 首帧仍是 false(loading 标志要等 onMounted 跑完才置位)、
// photos.length 也是 0 → isAlbumEmpty 首帧判 true,先闪一帧"相册是空的"再翻到骨架分支。
// fetchAlbumAssets 自带 isLoadingAssets 防重入 guard,提前调用是安全的,不会重复请求。
void albums.fetchAlbumAssets(albumId.value)

onMounted(() => {
  if (!albums.albumsLoaded) void albums.fetchAlbums()
  void nextTick(() => drag.refresh())
  document.addEventListener('mousedown', onDocMousedown)
  document.addEventListener('keydown', onDocKeydown)
  // T6: gates the more menu's "Convert to Smart Album" entry — in-flight dedup already lives
  // inside the store, so a concurrent call from the sidebar/another view is harmless.
  void settings.fetchAiFeatures()
})
onBeforeUnmount(() => {
  drag.destroy()
  document.removeEventListener('mousedown', onDocMousedown)
  document.removeEventListener('keydown', onDocKeydown)
})

// Task 4 fix round 2 (coordinator review): the invariant this watcher exists to hold is that
// any state scoped to "the album currently being viewed" must not survive an id change --
// `selected`/`titleEditing`/`titleDraft` were already reset on that basis; `edit` and
// `pickerOpen` are exactly the same kind of state and were missing from the list.
//
// Without this, two real bugs: (a) Minor -- leaving edit mode never happened on navigation, so
// switching from album 7 (mid-edit) to a different, perfectly valid album 8 dropped the user
// into edit mode on 8 without choosing it. (b) Important -- an *already-open* Add-photos picker
// survived the navigation (`PhotosLibraryPicker`'s `:open="pickerOpen"` has no `album` gate of
// its own, unlike the select bar's `v-if="edit && album"` a few lines down). Resetting
// `pickerOpen` here closes the dialog on every id change (matching what PhotosLibraryPicker.vue's
// own `v-if="open"` does -- a real user can no longer reach the confirm button once this fires);
// `onPickerConfirm`'s own `pickerAlbumId` snapshot (see its comment) is the belt-and-suspenders
// half, covering a confirm that is already in flight the instant this watcher runs.
watch(() => route.params.id, () => {
  selected.value.clear()
  // Minor 修正(刻意不照抄 Vue2 的潜在 bug——本期纪律:界面照 Vue2,逻辑 bug 不照抄):Vue2
  // 同名 watch(PhotosAlbumDetail.vue:258-260)只重拉资产,没清标题编辑态。同一组件实例路由切换
  // (hash 跳到另一个相册,组件不销毁重建)场景下:给相册 7 改名,还没提交就切到相册 8,
  // titleEditing/titleDraft 会带着相册 7 的草稿名残留到相册 8 上,之后 blur/回车会把草稿名
  // 提交给相册 8——这是真实数据损坏路径,不是"细枝末节",所以在此清掉。
  titleEditing.value = false
  titleDraft.value = ''
  edit.value = false
  pickerOpen.value = false
  void albums.fetchAlbumAssets(albumId.value)
  void nextTick(() => drag.refresh())
})
watch([edit, sortBy], () => {
  void nextTick(() => drag.refresh())
})
// 评审 Important 2 修正:`gridRef` 只绑在骨架/空态/真实网格三个 v-if 分支里最后一支——
// 骨架态和空态是不同元素,Vue 3 给每个 v-if 分支各自隐式 key,元素不复用,所以这两支渲染期间
// gridRef 恒为 null(useAlbumDragSort.refresh() 见容器为 null 直接 bail)。原有三个触发点
// (onMounted / route.params.id watch / [edit,sortBy] watch)全部挂在"用户改的状态"上,没有一个
// 在"网格自己从无到有出现"这一刻触发——典型复现路径:空相册 → 进 edit(此时 gridRef 仍 null)→
// 添加照片 → fetchAlbumAssets 回来资产非空 → 模板才第一次切到真实网格分支、gridRef 才第一次有
// 值 → 但没有 watch 命中这个时机,Sortable 永远不会被创建,拖拽静默失效。这里专门加一个键在
// 容器本身上的 watch 补上这个触发点。
watch(gridRef, () => {
  void nextTick(() => drag.refresh())
})
</script>

<template>
  <div class="photos-root" :class="themeClass">
    <div class="app" :data-collapsed="collapsed">
      <!-- Fix-1 item 1 (owner acceptance, 2026-08-13): same narrow-mode coordination as
           Photos.vue/PhotosAlbums.vue -- the topbar's own collapse button now delegates to
           the sidebar drawer on narrow viewports. -->
      <PhotosSidebar :collapsed="collapsed" hide-drawer-trigger />
      <main class="main">
        <PhotosTopbar
          :collapsed="collapsed"
          :title="topbarTitle"
          :sub="topbarSub"
          :show-search="false"
          @toggle-collapse="onToggleCollapse"
        />
       <div class="photos-main">
        <!-- Task 9(P4 遗留收口):失败态优先级在骨架分支之前——loadError 一旦为真,
             albumsLoaded 仍是假(刻意,见 albums.ts 注释),不该再落进骨架分支永久显示
             "正在加载"。 -->
        <div v-if="albums.loadError" class="empty-state" data-test="album-load-error">
          <div class="empty-state-title">{{ t('photosAlbumLoadFailed') }}</div>
          <button
            type="button"
            class="empty-state-btn"
            data-test="album-retry"
            :disabled="retryingAlbums"
            @click="retryAlbums"
          >{{ t('photosRetry') }}</button>
        </div>

        <!-- 还没加载完:骨架 -->
        <!-- SP15-P2c Task 3: the placeholder used to be a 260px hero-shaped block. With the hero
             gone it stands in for the detail bar + header instead, which is what actually
             arrives when the album lands. -->
        <div v-else-if="!album && !albums.albumsLoaded" class="album-loading" data-test="album-loading">
          <div class="album-skel-bar"></div>
          <div class="album-skel-header"></div>
        </div>

        <!-- 加载完了确实没有:New-UI 补齐项 -->
        <div v-else-if="notFound" class="empty-state" data-test="album-not-found">
          <div class="empty-state-title">{{ t('photosAlbumNotFoundTitle') }}</div>
          <div class="empty-state-desc">{{ t('photosAlbumNotFoundHint') }}</div>
          <button
            type="button"
            class="empty-state-btn"
            data-test="album-not-found-back"
            @click="goToAlbumsList"
          >{{ t('photosAlbumBack') }}</button>
        </div>

        <template v-else-if="album">
          <!-- SP15-P2c Task 3 (Vue2 33b05636:PhotosAlbumDetail.vue:5-11): the same top bar the
               smart-view/moment detail pages carry -- back on the left, the creation date on the
               right. The date span does not render at all when createdLabel is the placeholder. -->
          <div class="sv-detail-bar">
            <button type="button" class="back" data-test="album-back" @click="goToAlbumsList">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6" /></svg>
              {{ t('photosAlbumBack') }}
            </button>
            <div class="sv-detail-bar-spacer"></div>
            <span v-if="createdLabel !== DASH" class="sv-detail-created" data-test="album-created">
              {{ t('photosDetailCreatedAt', { date: createdLabel }) }}
            </span>
          </div>

          <!-- Two-column skeleton (Vue2 :20-21), the same one PhotosSmartViewDetail.vue uses:
               the main column holds the header and the grid and scrolls as one, the sidebar
               scrolls on its own. The old .album-toolbar band and .album-detail-body wrapper are
               both gone -- the band's "{n} items shown" repeated the header stats verbatim, and
               the body's two-column job is done by .sv-detail-layout. -->
          <div class="sv-detail-layout">
            <div class="sv-detail-main">
              <div class="sv-header">
                <div class="sv-header-text">
                  <h1>
                    <span
                      v-if="!titleEditing"
                      class="sv-title"
                      data-test="album-title"
                      :title="t('photosAlbumClickToRename')"
                      @click="startTitleEdit"
                    >{{ album.title }}</span>
                    <input
                      v-else
                      ref="titleInputRef"
                      v-model="titleDraft"
                      class="sv-title-input"
                      data-test="album-title-input"
                      @keydown.enter.prevent="commitTitle"
                      @keydown.esc.prevent="cancelTitleEdit"
                      @blur="commitTitle"
                    >
                    <!-- Vue2 :67: the date range rides the h1 row as a flex sibling of the
                         title, not a chips row of its own (that row held only this pill and the
                         type badge, and both left). -->
                    <span v-if="album.dateRange" class="sv-cond" data-test="album-date-pill">{{ album.dateRange }}</span>
                  </h1>
                  <div class="sv-header-stats">
                    <span data-test="album-header-items"><b>{{ album.count.toLocaleString(localeTag) }}</b> {{ t('photosDetailItems') }}</span>
                    <span v-if="album.videoCount > 0" data-test="album-header-videos"><b>{{ album.videoCount.toLocaleString(localeTag) }}</b> {{ t('photosDetailVideos') }}</span>
                  </div>
                </div>

                <!-- Vue2 :80-121: Sort pill -> separator -> Edit/Done -> separator -> density.
                     Sort and density render outside edit mode only (the old toolbar band drew
                     the same distinction); Edit/Done is always there, and in edit mode it is the
                     only one of the three still rendered. Each separator comes along with the
                     group next to it, so neither is ever left dangling. -->
                <div class="sv-actions">
                  <template v-if="!edit">
                    <span class="group">{{ t('photosAlbumSort') }}</span>
                    <div ref="sortMenuRef" class="album-sort-wrap">
                      <button
                        type="button"
                        class="order-pill"
                        data-test="album-sort-btn"
                        @click.stop="sortMenuOpen = !sortMenuOpen"
                      >
                        {{ currentSortLabel }}
                        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                      </button>
                      <div v-if="sortMenuOpen" class="albums-sort-menu" data-test="album-sort-menu">
                        <!-- Task 11 (b): the target (PhotosAlbumDetail.vue:88-101) marks the active
                             option with a check glyph and keeps every label at the same x with a
                             same-width empty spacer on the inactive rows. This page used to render a
                             bare label with only the data-active background, which left it visibly
                             out of step with the smart-view page's identical dropdown.
                             Task 4 re-skin: renamed `.album-sort-menu`/`.album-sort-item` (singular)
                             to `.albums-sort-menu`/`.albums-sort-item` (plural) -- Vue2's own template
                             (:102-103) and the already-imported parity photos.scss:3157/3169 both use
                             the plural spelling; the singular name this page carried never matched
                             either one, so this dropdown was silently unstyled by parity all along
                             (styled only by this file's own now-deleted local rules below). -->
                        <button
                          v-for="s in sortOptions" :key="s.id"
                          type="button"
                          class="albums-sort-item"
                          data-test="album-sort-item"
                          :data-sort-id="s.id"
                          :data-active="s.id === sortBy"
                          @click="pickSort(s.id)"
                        >
                          <svg v-if="s.id === sortBy" class="album-sort-check" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                          <span v-else class="album-sort-check" />
                          <span class="lbl">{{ s.label }}</span>
                        </button>
                      </div>
                    </div>
                    <div class="album-detail-actions-sep"></div>
                  </template>
                  <button
                    type="button"
                    class="sv-action-btn"
                    data-test="album-edit-toggle"
                    :data-open="edit"
                    @click="toggleEditMode"
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
                    {{ edit ? t('photosAlbumDone') : t('photosAlbumEdit') }}
                  </button>
                  <template v-if="!edit">
                    <div class="album-detail-actions-sep"></div>
                    <!-- Density keeps New-UI's own enum values ('comfortable'/'compact'); Vue2
                         spells the first one 'comfort'. That name is never visible, and changing
                         it would churn this page's existing tests for no visual gain. -->
                    <div class="density">
                      <button
                        type="button"
                        :data-active="density === 'comfortable'"
                        :title="t('photosDensityComfortable')"
                        @click="density = 'comfortable'"
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" /></svg>
                      </button>
                      <button
                        type="button"
                        :data-active="density === 'compact'"
                        :title="t('photosDensityCompact')"
                        @click="density = 'compact'"
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="11" y="3" width="6" height="6" rx="1" /><rect x="3" y="11" width="6" height="6" rx="1" /><rect x="11" y="11" width="6" height="6" rx="1" /><rect x="3" y="19" width="6" height="2" /><rect x="11" y="19" width="6" height="2" /></svg>
                      </button>
                    </div>
                  </template>
                </div>
              </div>

              <!-- Grid. E5 re-anchor: the edit flag used to live on the deleted .album-toolbar,
                   with two rules reaching the tiles through a sibling combinator. The target
                   (Vue2 :124) marks the grid container itself, so those two rules are now plain
                   descendant selectors on this element -- see the style block. -->
              <div class="album-photos-wrap" :data-edit="edit">
              <div v-if="isLoadingPhotos && photos.length === 0" class="album-photo-grid" :class="{ 'is-compact': density === 'compact' }">
                <div v-for="i in 6" :key="'sk' + i" class="tile album-tile-skeleton"></div>
              </div>
              <div v-else-if="isAlbumEmpty" class="empty-state" data-test="album-empty">
                <div class="empty-state-title">{{ t('photosAlbumEmptyTitle') }}</div>
                <div class="empty-state-desc">{{ t('photosAlbumEmptyHint') }}</div>
              </div>
              <div v-else ref="gridRef" class="album-photo-grid" :class="{ 'is-compact': density === 'compact' }">
                <div
                  v-for="p in photos" :key="p.id"
                  class="tile"
                  :data-id="p.id"
                  :data-cover="isCover(p)"
                  :data-selected="edit && isSelected(p)"
                  :title="tileHintTitle"
                  @click="onTileClick(p)"
                  @contextmenu.prevent="setCover(p)"
                >
                  <img :src="thumbnailUrl(p.id, 'small')" alt="" loading="lazy">
                  <button
                    type="button"
                    class="tile-cover-btn"
                    :data-on="isCover(p)"
                    :title="isCover(p) ? t('photosAlbumCurrentCover') : t('photosAlbumSetCover')"
                    @click.stop="setCover(p)"
                  >★</button>
                  <div v-if="edit" class="tile-select-check" :data-checked="isSelected(p)">
                    <span v-if="isSelected(p)">✓</span>
                  </div>
                </div>
              </div>
              </div>
            </div>

            <!-- T6: stats rail, ported from Vue2 :101-134. Aligns this page with the smart-view
                 detail page's own sidebar (PhotosMomentDetail.vue), so the two detail pages stop
                 looking like different products. -->
            <aside class="sv-detail-side" data-test="album-side">
              <!-- Task 5 (Vue2 33b05636:PhotosAlbumDetail.vue :211-283). The "..." menu's target
                   home -- moved here from the header's .sv-actions, where Task 3 parked it
                   unchanged (mounting it in this overflow-y:auto sidebar before the fixed-position
                   composable existed would have reproduced the exact clipping bug that composable
                   fixes). New-UI never carries a Slideshow button here (the target has one; Vue2's
                   own version only ever popped a "coming soon" toast, and this repo never built the
                   tile-fullscreen player it would open), so this container holds a single child --
                   still flex-wrap to match the target's own .sv-side-actions shape (Vue2
                   photos-smartview.scss, restated below since scoped styles don't cross SFCs in
                   this repo).
                   The five entries are the target's full set, in its order (not reorderable):
                   Rename/Duplicate/Download as ZIP/Convert/Delete. Main titles are shortened per
                   #117 (Rename album -> Rename, Convert to Smart Album -> Convert, Delete album ->
                   Delete); desc lines keep the longer copy that disambiguates context. The menu
                   itself is position:fixed via `menuStyle` (T1's useFixedMenuPosition bound to
                   `moreBtnRef`'s rect) so it no longer clips against this aside's own
                   overflow-y:auto; `morePopRef` still wraps both the button and the menu for
                   click-outside dismissal (onDocMousedown below) -- the composable only computes
                   coordinates, it does not touch open/close. -->
              <div class="sv-side-actions">
                <div ref="morePopRef" class="album-more-wrap">
                  <button
                    ref="moreBtnRef"
                    type="button"
                    class="sv-action-btn sv-action-btn-icon"
                    data-test="album-more-btn"
                    :data-open="menuOpen"
                    @click="menuOpen = !menuOpen"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                  </button>
                  <!-- Whole-branch review, Important 4: the target wraps this menu in
                       <transition name="sv-menu"> too (33b05636 PhotosAlbumDetail.vue:223/:278),
                       exactly as PhotosSmartViewDetail.vue's copy does. This page rendered it
                       bare for the whole phase, so the two otherwise-identical menus animated
                       differently. The two .sv-menu-* rules are duplicated into this file's
                       scoped style block (below) because scoped styles do not cross files. -->
                  <Transition name="sv-menu">
                  <div v-if="menuOpen" class="sv-export-menu sv-more-menu" data-test="album-menu" :style="menuStyle">
                    <button
                      type="button"
                      class="sv-export-item"
                      data-test="album-menu-rename"
                      @click="menuOpen = false; startTitleEdit()"
                    >
                      <div class="sv-export-icon" data-test="album-menu-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg></div>
                      <div>
                        <!-- Reuses PhotosSmartViewDetail.vue's own short "Rename" key -- same
                             product copy, and it already carries the exact target string. -->
                        <div class="sv-export-title">{{ t('photosSvRename') }}</div>
                        <div class="sv-export-desc">{{ t('photosAlbumRenameHint') }}</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      class="sv-export-item"
                      data-test="album-menu-duplicate"
                      @click="duplicateAlbum"
                    >
                      <div class="sv-export-icon" data-test="album-menu-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" /></svg></div>
                      <div>
                        <!-- Same reuse: PhotosSmartViewDetail.vue's own short "Duplicate" key. -->
                        <div class="sv-export-title">{{ t('photosSvDuplicate') }}</div>
                        <div class="sv-export-desc">{{ t('photosAlbumDuplicateHint') }}</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      class="sv-export-item"
                      data-test="album-menu-zip"
                      @click="downloadZip"
                    >
                      <div class="sv-export-icon" data-test="album-menu-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg></div>
                      <div>
                        <!-- photosFavExport is the favourites page's own "Download as ZIP" title
                             -- identical target copy, reused rather than coining a near-synonym.
                             The desc's {n}/{mb} interpolation (photosSvNPhotosMbMb) is the exact
                             key PhotosSmartViewDetail.vue's own zip entry already uses; 3.2 is
                             Vue2's own hard-coded MB-per-photo estimate (33b05636 :266), not a
                             measured figure -- registered here as it was there. -->
                        <div class="sv-export-title">{{ t('photosFavExport') }}</div>
                        <div class="sv-export-desc">{{ t('photosSvNPhotosMbMb', { n: album.count.toLocaleString(localeTag), mb: Math.round(album.count * 3.2).toLocaleString(localeTag) }) }}</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      class="sv-export-item"
                      data-test="album-menu-convert"
                      :disabled="smartViewDisabled"
                      :title="smartViewDisabled ? t('photosSvSmartViewsOffCreateHint') : undefined"
                      @click="openConvertModal"
                    >
                      <div class="sv-export-icon" data-test="album-menu-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 4.9L19 9l-4.9 1.8L12 16l-1.8-5.2L5 9l5.2-1.1L12 3zM19 15l.9 2.5L22 18l-2.5.9L19 21l-.9-2.5L16 18l2.5-.9L19 15z" /></svg></div>
                      <div>
                        <div class="sv-export-title">{{ t('photosAlbumMenuConvert') }}</div>
                        <!-- Whole-branch review, Important 2: the menu entry's desc is the
                             target's :266 string, not the convert modal's :375 subtitle -- the
                             two were collapsed onto one key for the whole phase. -->
                        <div class="sv-export-desc">{{ t('photosAlbumMenuConvertHint') }}</div>
                      </div>
                    </button>
                    <div class="sv-export-sep"></div>
                    <button
                      type="button"
                      class="sv-export-item sv-export-item-danger"
                      data-test="album-menu-delete"
                      @click="askConfirmDelete"
                    >
                      <div class="sv-export-icon sv-export-icon-danger" data-test="album-menu-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg></div>
                      <div>
                        <!-- Reuses the generic photosDelete key ("Delete") already used by
                             PhotosMomentDetail.vue's and PhotosSmartViewDetail.vue's own confirm/
                             selection-toolbar buttons -- the long-form "Delete album" stays at
                             photosAlbumDelete, still alive via this page's own confirm-modal
                             button (below), so it is not orphaned by this change. -->
                        <div class="sv-export-title">{{ t('photosDelete') }}</div>
                        <div class="sv-export-desc">{{ t('photosAlbumDeleteHint') }}</div>
                      </div>
                    </button>
                  </div>
                  </Transition>
                </div>
              </div>

              <!-- Task 4 (Vue2 :283-290). About — Type/Created/Time span/Place, same
                   mo-about-row idiom as PhotosMomentDetail.vue's own About section. Type/Created/
                   Place reuse existing keys verbatim (photosAlbumLabel/photosAlbumStatCreated/
                   photosMoPlace already carry the exact Chinese the Vue2 target uses for these
                   labels); only "Time span" is new — PhotosMomentDetail's own About row calls its
                   third field "Time" (photosMoTime), a different label for a different thing. -->
              <div class="sv-side-section" data-test="album-about">
                <h3>{{ t('photosMoAbout') }}</h3>
                <div class="mo-about-row" data-test="album-about-type"><span>{{ t('photosMoType') }}</span><b>{{ t('photosAlbumLabel') }}</b></div>
                <div class="mo-about-row" data-test="album-about-created"><span>{{ t('photosAlbumStatCreated') }}</span><b>{{ createdLabel }}</b></div>
                <div class="mo-about-row" data-test="album-about-timespan"><span>{{ t('photosDetailTimeSpan') }}</span><b>{{ timeSpanLabel }}</b></div>
                <div class="mo-about-row" data-test="album-about-place"><span>{{ t('photosMoPlace') }}</span><b :title="placesTitle">{{ placesLabel }}</b></div>
              </div>

              <!-- Task 4 (Vue2 :292-309). Stats — trimmed from 4 cells to 2: Span/Created are the
                   exact same data as the two About rows just above (duplicated, not a distinct
                   metric), so the target drops them and keeps only Photos/Videos. -->
              <div class="sv-side-section">
                <h3>{{ t('photosMoStats') }}</h3>
                <div class="sv-stat-grid">
                  <div class="sv-stat-cell" data-test="album-stat-cell">
                    <div class="v">{{ album.count.toLocaleString(localeTag) }}</div>
                    <div class="l">{{ t('photosMoPhotos') }}</div>
                  </div>
                  <div class="sv-stat-cell" data-test="album-stat-cell">
                    <div class="v">{{ videoCountLabel }}</div>
                    <div class="l">{{ t('photosAlbumStatVideos') }}</div>
                  </div>
                </div>
              </div>
              <!-- By month: absent entirely when nothing carries a takenAt. Vue2 has exactly
                   this histogram behind exactly this gate (939a7d3a:PhotosAlbumDetail.vue
                   :218-224, `v-if="monthBuckets.length"`); the earlier comment here claiming
                   otherwise was wrong. PhotosMomentDetail.vue carries the same gate, which is
                   where the restated rule bodies below come from. -->
              <div v-if="monthBuckets.length" class="sv-side-section" data-test="album-dist">
                <h3>{{ t('photosMoByMonth') }}</h3>
                <div class="sv-distribution">
                  <div
                    v-for="(b, i) in monthBuckets" :key="b.key" class="sv-dist-bar"
                    data-test="album-dist-bar" :style="distStyle(b, i)" :title="b.label + ' · ' + b.count"
                  />
                </div>
                <div class="sv-dist-x">
                  <span>{{ monthBuckets[0].label }}</span>
                  <span>{{ monthBuckets[monthBuckets.length - 1].label }}</span>
                </div>
              </div>
            </aside>
          </div>
        </template>
       </div>
      </main>
    </div>

  <!-- Fix-2 item 5 (owner acceptance, 2026-08-13; F1 lesson class): this whole tail section
       (select bar / delete-confirm / library picker / lightbox / album picker / convert dialog)
       used to be a template-root SIBLING of `.photos-root` (a Vue 3 multi-root fragment) rather
       than its DOM descendant. Every one of these elements' actual visual styling comes from
       parity selectors written as `.photos-root .sv-select-bar` / `.photos-root .lb-confirm-scrim`
       (photos-smartview.scss:675 / photos.scss:620) -- a CSS descendant combinator only matches
       real DOM descendants, and "declared after `.photos-root`'s closing tag in the same
       template" does not qualify (identical root cause to Fix-1 item 3's "New album" modal bug,
       acceptance-fix-report.md §F1). Outside `.photos-root`, `position: fixed` / the scrim
       background / centering / z-index never applied -- the edit-mode bar likely rendered
       unstyled (or invisible under other page content) and the delete-confirm modal the same way
       AlbumPickerDialog's own portal-less siblings already were flagged as a "latent instance"
       in F1. Moved back inside `.photos-root`, as a sibling of `.app` (matching Vue2's own
       single-shell nesting and F1 item 3's precedent) -- none of these are affected by `.app`'s
       own `height:100vh;overflow:hidden`, since they are `position: fixed` (the bar/toast/modal
       scrims) or don't need viewport-relative sizing (the pickers/lightbox/dialogs), and
       `.photos-root` itself sets no transform/filter/perspective/`contain` that would create a
       new containing block for `position: fixed` (same reasoning F1 item 3 already verified). -->

  <!-- Edit-mode select bar (Vue2 :322-343). This is where the deleted toolbar band's two edit
         buttons live now, plus the hint line the band also carried. Deviation from the plan's
         prose, registered: it renders on `edit` alone, not only once something is selected --
         the target says so explicitly at :326 and has to, because the hint copy only ever shows
         with an empty selection and Add photos would otherwise be unreachable in an empty album.
         Plan C Task 2 had made the bar a sibling of `.photos-root` itself (previously a sibling
         of `.photos-layout` inside AreaShell's slot, before AreaShell was unwrapped); Fix-2 item 5
         (see the correction note just above) moves it back to being a sibling of `.app`, still
         inside `.photos-root` -- it is position:fixed, so nesting it inside the scrolling column
         buys nothing either way, but it does need to stay inside `.photos-root` for its own
         parity CSS to match.

         Task 4 fold-in fix: this container used to live inside the `v-else-if="album"` branch
         above (before the P2c skeleton rebuild pulled it out to be a fixed-position sibling), so
         it inherited "no album -> not rendered" for free. Gating on `edit` alone lost that: at the
         time this was written, the route-id watcher cleared `selected`/the title draft but never
         reset `edit`, so navigating from an album in edit mode to a missing id left this bar
         floating over the "Album not found" screen with Add photos still reachable.
         `edit && album` restores the original invariant directly (this is what the condition
         actually depends on) rather than indirectly through a watcher, so it also covers the case
         where `album` disappears without a route change (e.g. a concurrent fetchAlbums no longer
         finds it) -- a watcher on route.params.id alone would miss that.

         Fix round 2 (coordinator review): the watcher below now also resets `edit` on every id
         change (not just a missing one), closing the sibling Minor finding -- edit mode used to
         survive navigating between two perfectly valid albums. The two fixes are complementary,
         not redundant: the watcher handles "the id changed", this `&& album` guard handles
         "the album vanished without the id changing". -->
    <div v-if="edit && album" class="sv-select-bar">
      <span class="group">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
        {{ editHintText }}
      </span>
      <button
        type="button"
        class="sv-action-btn"
        data-test="album-remove-selected"
        :disabled="!selected.size || removing"
        @click="removeSelected"
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
        {{ t('photosAlbumRemoveFrom') }}
      </button>
      <button
        type="button"
        class="sv-action-btn"
        data-test="album-add-photos"
        @click="openPicker"
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0-4 4m4-4 4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
        {{ t('photosAlbumAddPhotos') }}
      </button>
    </div>

  <!-- 删除相册确认模态(唯一带二次确认的操作)
       Task 4 re-skin: Vue2 (33b05636:PhotosAlbumDetail.vue:391-408) renders this as
       `.lb-confirm-scrim`/`.lb-confirm`/`.trash-btn-ghost`/`.trash-btn-cta.trash-btn-cta-danger`
       inside a `<transition name="lb-confirm">` -- the same already-parity-ized reference pattern
       T3 established for the albums-index page's own modal (z200 scrim, no backdrop-filter). This
       page's own `.album-confirm*` scoped rules used to shadow that (z220, --overlay-bg/-blur,
       page-local button classes); deleted entirely below so parity's own `.lb-confirm-scrim`
       (imported globally, unprefixed by this page's scoped attribute) governs directly -- the only
       local addition kept is the Vue3 `-enter-from` transition-name translation (parity's own
       transition rule is Vue2-spelled `.lb-confirm-enter`, which Vue3's <Transition> does not
       recognise; same fix already applied to `.sv-menu-*` elsewhere in this file). Also adds the
       icon Vue2 renders above the title (`<photos-icon name="trash" color="#FF6B5C">`) -- this
       page never had one; --remove-fg is this repo's existing danger token, already used by
       `.sv-export-item-danger` below, standing in for Vue2's literal #FF6B5C. -->
  <Transition name="lb-confirm">
    <div
      v-if="confirmDelete"
      class="lb-confirm-scrim"
      data-test="album-delete-confirm"
      @click.self="confirmDelete = false"
    >
      <div class="lb-confirm">
        <div class="lb-confirm-icon" style="color: var(--danger)">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
        </div>
        <div class="lb-confirm-title">{{ t('photosAlbumDeleteTitle', { name: album?.title ?? '' }) }}</div>
        <div class="lb-confirm-body">{{ t('photosAlbumDeleteBody', { count: album?.count ?? 0 }) }}</div>
        <div class="lb-confirm-foot">
          <button type="button" class="trash-btn-ghost" @click="confirmDelete = false">{{ t('photosCancel') }}</button>
          <button type="button" class="trash-btn-cta trash-btn-cta-danger" data-test="album-delete-confirm-btn" @click="doDelete">
            {{ t('photosAlbumDelete') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <PhotosLibraryPicker
    :open="pickerOpen"
    :title="t('photosAlbumPickerTitle', { name: album?.title ?? '' })"
    :existing-ids="pickerExistingIds"
    :existing-label="t('photosAlbumPickerAlready')"
    :submit-label="pickerSubmitLabel"
    :submitting="pickerAdding"
    @update:open="pickerOpen = $event"
    @confirm="onPickerConfirm"
  />

  <PhotoLightbox
    @delete="onLightboxDelete"
    @toggle-fav="() => {}"
    @add-to-album="(id) => openAlbumPicker([id])"
  />
  <AlbumPickerDialog v-model:open="albumPickerOpen" :asset-ids="albumPickerIds" @added="onAlbumPickerAdded" />

  <AlbumConvertToSmartDialog
    v-if="album"
    :open="convertOpen"
    :album-id="album.id"
    :album-name="album.title"
    :album-count="album.count"
    @update:open="convertOpen = $event"
    @converted="onConverted"
  />
  </div>
</template>

<style scoped>
/* Plan C Task 2: `.photos-layout` flex-row + the transitional `.sidebar { flex... }` width
   pin are gone — the `.app` CSS Grid (parity scss photos.scss:116-129) now owns both the
   sidebar's width and the height cap, same as Photos.vue since its own Task 3 re-skin.
   `.photos-layout` no longer appears anywhere in this file's source — photosLayoutHeightCap
   .test.ts's CAPPED list has been updated to drop this page accordingly. */
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

/* Task 4 re-skin: `.empty-state`/`.empty-state-title`/`.empty-state-desc` used to be declared
   locally here with New-UI-only values (padding 60px 20px, gap 6px, max-width 340px, this repo's
   own --fg/--fg-muted tokens) that shadowed the already-imported parity photos.scss:1077-1096
   rule of the same name (used by every other "no items" screen in the app -- Favorites/Trash/
   etc). Deleted outright so parity's own values (height:100%, gap 10px, padding 40px, max-width
   260px, parity's own --text-2/--text-3 tokens) govern directly, bringing this page's three
   "supplementary" screens (load-error/not-found/album-empty -- none of which exist in Vue2 itself,
   see the template's own comments) in line with the rest of the app's empty-state convention
   instead of a one-off. The retry/back buttons were renamed from `.bar-btn` to parity's own
   paired `.empty-state-btn` (photos.scss:1088-1096, accent-filled pill) to match -- `.bar-btn`
   no longer appears anywhere in this file, so its old `:disabled` rule (further down) is gone
   too; the retry button still needs a disabled affordance (a New-UI-only addition, Vue2/parity's
   own empty-state buttons are never disabled), kept below. */
.empty-state-btn:disabled { opacity: 0.45; cursor: not-allowed; pointer-events: none; }

/* ── SP15-P2c Task 3: loading placeholder ──
   The 260px cover hero it used to imitate is gone; it now stands in for the detail bar and the
   header, which is what the album actually renders on arrival. */
.album-loading { display: flex; flex-direction: column; gap: 14px; padding: 16px 32px; }
.album-skel-bar { height: 20px; width: 200px; border-radius: 6px; background: var(--skeleton-bg); }
.album-skel-header { height: 90px; border-radius: 12px; background: var(--skeleton-bg); }

/* ── SP15-P2c Task 3 / Task 4 re-skin: detail bar / two-column skeleton / header / action row ──
   Task 4: `.sv-detail-bar`/`.sv-detail-bar .back`(+:hover)/`.sv-header`/`.sv-header-stats`(+`b`)
   used to restate PhotosSmartViewDetail.vue's own scoped values verbatim (the "KEEP-THE-
   DUPLICATION ruling P2b" this comment used to cite) -- but photos.scss/photos-smartview.scss are
   *global*, unscoped, already-imported stylesheets (`import '../photos/styles/vue2-parity'`,
   line 29), not another SFC's own `<style scoped>` that genuinely cannot be reused. P2b's ruling
   never applied to them: a local scoped rule with an identical selector text shadows the global
   parity rule outright (the scoped `[data-v-xxx]` attribute wins the specificity race), so this
   was duplication with nothing gained, not an unavoidable restatement. Deleted below; parity's
   own rule (and its own self-contained token set, scoped to `.photos-root`) now governs directly.
   `.sv-detail-layout`/`.sv-detail-main` are the one exception kept unchanged -- see their own
   comment below, they're locked by this file's own `keeps the rail out of the photo grid's scroll
   container` test (:919-923) asserting this file's *own* source text, a deliberate flex-based
   scroll model differing from parity's `height:100%; overflow:hidden`, already established by
   PhotosSmartViewDetail.vue's own reviewed precedent. */
.sv-detail-bar-spacer { flex: 1; }
/* No parity class name for this span (Vue2 :11 styles it with a bare inline `style=`) -- kept,
   color corrected from this repo's own --fg-muted to parity's own --text-3 (Vue2's literal
   `color:var(--text-3)`), the same "reference parity's own custom property directly" precedent
   T3 established for PhotosAlbums.vue's `.sort-check`/`--accent-hi`. */
.sv-detail-created { font-size: 12px; color: var(--text-3); }

/* Test-locked deviation, kept as-is (see the big comment above): flex-based scroll model, not
   parity's literal `height:100%; overflow:hidden`. */
.sv-detail-layout { display: grid; grid-template-columns: 1fr 320px; flex: 1 1 auto; min-height: 0; }
.sv-detail-main { min-width: 0; overflow-y: auto; padding-bottom: 60px; }

.sv-header-text { flex: 1; min-width: 0; }
.sv-title { cursor: text; color: var(--text-1); }
/* Vue2 writes this inline on the input (:56). Everything there is reproduced except the
   `font-family: var(--font-display)` (see above); the colours go through tokens instead of the
   inline literals. */
.sv-title-input {
  background: var(--surface-2); border: 1px solid var(--accent); border-radius: 8px;
  padding: 2px 10px; color: var(--text-1); font: inherit; font-size: 28px; font-weight: 600;
  letter-spacing: -0.02em; outline: none; min-width: 300px;
}
/* Vue2 photos-smartview.scss:81-87 (base .sv-cond) with :372's h1-row size bump folded in --
   the pill only ever appears on the h1 row here, so the two layers collapse into one rule, the
   same shape AlbumConvertToSmartDialog.vue:310 already uses for this chip. Weight and tracking
   are deliberately NOT reset: in Vue2 the pill inherits the h1's 600 / -0.02em, and resetting
   them would be a visible deviation.
   Kept as-is: this is an intentional, already-reviewed *consolidation* of two parity rules
   (the base `.sv-cond` and the `.sv-header h1 .sv-cond` size-bump), not a raw duplicate -- parity
   itself expresses this as two layered rules relying on cascade, which a scoped block can't
   reproduce the same way (a local `.sv-header h1 .sv-cond` here would out-specificity parity's
   own base `.sv-cond` regardless, same shadow risk as everything else deleted above, so the
   self-contained version is the only one that reliably renders right).
   Fix-2 item 4/6 (owner acceptance, 2026-08-13): background corrected from `--chip-bg`
   (a *global*, non-shadowed, glass-gradient token in dark mode, and one shade lighter than
   intended in light mode) to parity's own `--surface-3` -- Vue2's actual base `.sv-cond`
   background (photos-smartview.scss:91-97/:414). The old comment here even said so ("Vue2's
   --surface-3 maps to --chip-bg here") but the token actually written was one rung off
   (`--chip-bg`/--surface-2, not `--chip-bg-hi`/--surface-3) -- a real value drift independent
   of the light-mode question, same class as this file's own already-registered min-width
   drifts. `color` was already `--fg-muted`, now `--text-2`, matching parity's own value too.
   The identical drift existed in MomentCard.vue's and AlbumConvertToSmartDialog.vue's own
   copies of this same chip and is fixed there in the same commit; PhotosSmartViewDetail.vue's
   own `.sv-cond` already had the right token (`--chip-bg-hi`, now `--surface-3`) and needed no
   correction. */
.sv-header h1 .sv-cond {
  display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 99px;
  background: var(--surface-3); color: var(--text-2); font-size: 11.5px;
}

/* No parity name for this state (Vue2's Edit/Done button is never disabled) -- kept, it's this
   page's own re-entry guard on the "Remove from album" select-bar button (see the template). */
.sv-action-btn:disabled { opacity: 0.45; cursor: not-allowed; }
/* Task 5: icon-only modifier for the sidebar's "..." toggle -- restated from
   PhotosSmartViewDetail.vue's own `.sv-action-btn-icon` (a Vue3-sibling-only class, not in
   parity at all -- Vue2 sizes this button with an inline `style=`).
   Task 8 cross-page sweep: `min-width` corrected from 32px to 36px -- verified against Vue2's
   own real source (PhotosAlbumDetail.vue:256, `style="padding:0 10px;min-width:36px;
   justify-content:center"`), the same 4px drift T5 already found and fixed on
   PhotosSmartViewDetail.vue's own copy of this exact button. */
.sv-action-btn-icon { padding: 0 10px; min-width: 36px; justify-content: center; }

/* No parity selector for a hover state on the Sort pill (Vue2/parity :3514-3524 never defines
   one) -- kept as a New-UI-only affordance layered on top of parity's own `.order-pill` base
   rule, harmless since it only ever *adds* a highlight parity doesn't have. */
.sv-actions .order-pill:hover { background: var(--surface-3); color: var(--text-1); }
/* No parity class name (Vue2 :251/:98 wraps these two containers with a bare inline
   `style="position:relative"`) -- kept, needed as the containing block for the absolutely
   positioned menu/dropdown each wraps. */
.album-more-wrap { position: relative; }

/* Whole-branch review, Important 4: the target wraps this page's "..." menu in
   `transition name="sv-menu"` (33b05636 PhotosAlbumDetail.vue:223/:278), rules in
   photos-smartview.scss:454-455 (opacity 0.14s + translateY(-4px) scale(0.97)).
   Same two rules PhotosSmartViewDetail.vue carries; scoped styles do not cross files, so the
   pair is repeated rather than shared. Vue 3 spells the start state `-enter-from`
   (Vue 2's `-enter`). */
.sv-menu-enter-active, .sv-menu-leave-active { transition: opacity 0.14s ease, transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1); transform-origin: top right; }
.sv-menu-enter-from, .sv-menu-leave-to { opacity: 0; transform: translateY(-4px) scale(0.97); }

/* ── Task 4 re-skin: more menu ──
   `.sv-export-menu`/`.sv-export-item`(base+`:hover`)/`.sv-export-icon`/`.sv-export-title`/
   `.sv-export-desc`/`.sv-export-sep` used to restate PhotosSmartViewDetail.vue's own scoped
   values (same "P2b ruling never actually applied to the global parity import" issue as the
   header section above -- see that comment). Deleted; parity's own rule
   (photos-smartview.scss:499-544, imported globally) governs directly. Kept: the `:not(:disabled)`
   guard on hover and the `:disabled` rule itself (parity's menu items are never disabled --
   New-UI-only, the Convert entry is greyed out when Smart Views are off) and the danger-row
   colouring (Vue2 expresses it with an inline coral literal, not a class -- this repo's existing
   --remove-fg-based rules are the only source for it). */
.sv-more-menu { min-width: 220px; }
/* :not(:disabled) -- CSS applies :hover to disabled buttons too, so without it the greyed-out
   Convert row still lit up under the cursor and read as clickable. Colour corrected to parity's
   own --surface-2 (photos-smartview.scss:528) rather than this repo's --chip-bg-hi. */
.sv-export-item:hover:not(:disabled) { background: var(--surface-2); }
.sv-export-item:disabled { opacity: 0.45; cursor: not-allowed; }
.sv-export-item-danger, .sv-export-item-danger .sv-export-title { color: var(--danger); }
.sv-export-icon-danger { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); }
/* Compound selector (0,3,0) beats the base .sv-export-item:hover's (0,2,0) structurally, not by
   source order -- same fix PhotosSmartViewDetail.vue applies at its own copy of this rule. */
.sv-export-item.sv-export-item-danger:hover { background: color-mix(in srgb, var(--danger) 14%, transparent); }

/* ── Sort dropdown ──
   Task 4 re-skin: the template's dropdown classes were renamed from `.album-sort-menu`/
   `.album-sort-item` (singular) to `.albums-sort-menu`/`.albums-sort-item` (plural) to match
   Vue2's own template and the already-imported parity photos.scss:3157-3194 -- the singular
   spelling this page carried never matched either one, so this whole dropdown was silently
   styled only by the local rules below (a name typo, not a deliberate deviation), never by
   parity at all. Those local rules are deleted now that the names actually line up; parity's
   own background/border/radius/hover/active-state/`.lbl` rules govern directly. Two survivors
   kept: the `top` override (Vue2 :102 hard-codes `style="top:calc(100% + 4px)"` on this specific
   instance, overriding parity's own +6px default -- reused by PhotosAlbums.vue's identical
   dropdown, which doesn't carry this override) and `.album-sort-check` (the fixed-width slot the
   check glyph sits in, rendered as an empty span on the inactive rows -- Vue2 has no class for
   this either, `style="width:12px;display:inline-block"` inline -- colour corrected from this
   repo's own --accent-text to parity's own --accent-hi, matching Vue2's literal
   `color="var(--accent-hi)"` and PhotosAlbums.vue's `.sort-check`'s identical correction). */
.album-sort-wrap { position: relative; }
.albums-sort-menu { top: calc(100% + 4px); }
.album-sort-check { width: 12px; flex-shrink: 0; color: var(--accent-hi); }

/* ── Task 4 re-skin: edit-mode select bar ──
   `.sv-select-bar` used to restate PhotosSmartViewDetail.vue's own values, including its
   `backdrop-filter: var(--blur)` -- this repo's own large glass-panel blur token (blur(44px)
   saturate(1.7) brightness(1.08) in dark mode), sized for big panels elsewhere in the app. Real
   bug, same class as T3's `.al-smart-badge` finding on the Albums list: parity's own rule
   (photos-smartview.scss:675-689) wants a much smaller `blur(12px) saturate(180%)` for this
   floating pill-shaped bar. Deleted outright (not just the blur) -- the rest of the rule was an
   exact-shape duplicate too (position/colours/shadow), so parity's own values govern entirely
   now. `.sv-select-bar .group` is also gone: parity's own `.sv-select-bar span` (a bare tag
   selector) already matches the `<span class="group">` this bar renders, so the compound was
   redundant. */

/* ── Grid ──
   Task 4 re-skin: `.album-photos-wrap`/`.album-photo-grid`(+`.is-compact`)/`.tile`(+`img`,
   `:hover img`)/`.album-tile-skeleton`/`.tile-drag-ghost`/`.tile[data-cover]`(+`::after`)/
   `.album-photos-wrap[data-edit] .tile`(+`[data-cover]::after`)/`.tile-cover-btn`(all states)/
   `.tile-select-check`(+`[data-selected]`) all duplicated an already-imported parity selector of
   the identical name (photos.scss:3539-3660); several of those duplicates carried genuinely
   different values, some due to real bugs:
   - `.album-tile-skeleton` (bare selector, no `.photos-root` prefix in parity) used to be
     overridden entirely by this file's own `background: var(--skeleton-bg)` -- silently
     dropping parity's shimmer animation (photos.scss:4345, `@keyframes album-skeleton-shimmer`).
     The loading skeleton has been rendering as a static block this whole time, not shimmering.
   - `.tile-drag-ghost` (also bare in parity) differed in outline width (1px here vs parity's
     2px) -- a real pixel diff, not a token substitution choice.
   - `.tile[data-cover="true"]::after` used the same oversized `var(--blur)` bug as the select
     bar above, where parity wants a plain `blur(6px)`.
   - `.tile-cover-btn` was 22px square here vs parity's 24px, and its own hover/data-on states
     didn't flip the star glyph's colour to white the way parity's do.
   - `.tile-select-check` used this repo's own --overlay-bg/--card-border/--on-accent instead of
     parity's own literal dark-translucent background / near-opaque-white border / white glyph.
   All deleted; parity's own rules (and, for the two bare ones, parity's own un-shadowed
   specificity) govern directly. One property survives: `.tile img { display: block; }` -- Vue2/
   parity's own `.album-photo-grid .tile img` rule never sets `display`, leaving inline-img's
   default few-px baseline gap; kept as the one addition parity doesn't cover. */
.tile img { display: block; }

/* No parity selector for `.lb-confirm-scrim`/`.lb-confirm`/etc scoped to *this* SFC -- see the
   template's own comment on the delete-confirm dialog for why the old `.album-confirm*` rules
   were deleted entirely rather than restated here. The only local addition needed is translating
   parity's Vue2-spelled transition names (`.lb-confirm-enter`/`.lb-confirm-leave-to`,
   photos.scss:694-700) into the Vue3 spelling `<Transition>` actually emits
   (`-enter-from` instead of bare `-enter`) -- same fix already applied to `.sv-menu-*` above. */
.lb-confirm-enter-active, .lb-confirm-leave-active { transition: opacity 0.2s, transform 0.2s; }
.lb-confirm-enter-from, .lb-confirm-leave-to { opacity: 0; transform: scale(0.95); }

/* ── T6 stats rail: rule bodies identical to PhotosMomentDetail.vue:1059-1090's
   .sv-side-section, .sv-stat-*, .sv-distribution and .sv-dist-* rules (which themselves
   restate SmartViewSidePanel.vue's, per that file's own comment).
   Task 4 re-skin: this whole block predates parity being imported into this file, and (like the
   header/actions section above) its "scoped styles don't cross SFCs" reasoning only justified
   duplicating *another Vue3 SFC's own scoped style* -- it never justified shadowing the
   already-imported *global* parity rule of the identical name. `.sv-side-section`(+`h3`)/
   `.mo-about-row`(+`:last-child`,`b`)/`.sv-stat-grid`/`.sv-stat-cell`(+`.l`)/`.sv-distribution`/
   `.sv-dist-x` are deleted below; parity's own rules (photos-smartview.scss:707-841) govern
   directly. `.sv-detail-side` is the one exception, kept unchanged -- it's covered by the same
   test-locked, deliberate scroll-model deviation as `.sv-detail-layout`/`.sv-detail-main` above
   (this file's own "keeps the rail out of the photo grid's scroll container" test asserts this
   selector's `overflow-y: auto` directly against this file's own source text). `.sv-dist-bar`
   is also gone: parity's own selector for the histogram bars is the child combinator
   `.sv-distribution > div` (Vue2 never puts a class on this div, plain `<div :style=...>`), which
   already matches this template's bar element regardless of the extra `sv-dist-bar` class it
   also carries for `data-test` purposes -- the local class-based rule only ever shadowed it.
   One property survives: `.sv-stat-cell .v { color: var(--text-1); }` -- parity's own version of this
   selector (photos-smartview.scss:821) never sets an explicit colour, relying on inherited text
   colour from further up a page that (in Vue2) always establishes one; this component's own
   layout doesn't guarantee the same ambient colour, so the explicit value is kept as a safety
   net rather than risk the stat value inheriting something unreadable. */
.sv-detail-side {
  border-left: 1px solid var(--line); background: var(--surface-1);
  overflow-y: auto; padding: 20px 18px 40px; min-height: 4px;
}
.sv-stat-cell .v { color: var(--text-1); }

/* New-UI mobile enhancement (Vue2 has no responsive drawer here — same registered deviation
   as Photos.vue's own copy of this rule): once the sidebar switches into is-drawer mode at
   ≤768px, collapse `.app`'s sidebar column too, so `.main` doesn't leave a dead
   var(--sidebar-w) gutter where the now-floating sidebar used to sit. */
@media (max-width: 768px) {
  .app { grid-template-columns: 1fr; }
  .sv-header h1 { font-size: 24px; }
  .sv-detail-layout { grid-template-columns: 1fr; }
  .sv-detail-side { border-left: 0; border-top: 1px solid var(--line); }
}
</style>
