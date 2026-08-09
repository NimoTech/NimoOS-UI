<script setup lang="ts">
// Task 8 (SP7-P4 相册): 相册详情视图——本期最大的一件。结构/时序逐段对照 Vue2 NimoOS-UI
// src/views/Photos/PhotosAlbumDetail.vue(419 行)移植:hero(封面/改名/编辑切换/⋯菜单删除)
// + 工具条(批量移除/添加照片,或排序+密度)+ 自绘网格(拖拽排序/封面星标/多选)+ 删除确认模态
// + PhotosLibraryPicker(T6,添加照片)+ PhotoLightbox(P2,查看/删除)。路由 /photos/albums/:id
// 注册留给 T11。去掉 Slideshow(Vue2 本身也只弹"敬请期待" toast)与 Ask Nimo(归 SP8)。
//
// 铁律(逐条落实,见文件内注释登记):
//  1) route.params.id 恒为字符串;albumId 统一走 String(route.params.id),所有对 store 的调用
//     (fetchAlbumAssets/renameAlbum/setAlbumCover/removeAssetsFromAlbum/deleteAlbum/
//     reorderAlbumAssets)都传这个归一后的字符串——T2 store 内部本就按 String(key) 比较,
//     传字符串永远安全,不需要在这里猜后端 id 的真实类型。
//  2) 封面判定 isCover(p) = String(p.id) === String(album.cover)(album.cover 可能是数字)。
//  3) selected 用 Set<string>(String 归一)。
//  4) 全程无对象引用 ===。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import AreaShell from '../components/shell/AreaShell.vue'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
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
import { albumToView, sortAlbumPhotos } from '../photos/util/albumView'
import { isConflict } from '../photos/util/httpErrors'
import type { Photo } from '../photos/util/assetToPhoto'

type SortBy = 'manual' | 'taken' | 'added'

const { t, locale } = useI18n()
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
const sortMenuRef = ref<HTMLElement | null>(null)
const gridRef = ref<HTMLElement | null>(null)

// ── 派生数据 ──
// album 为 null 有两种子情形(区分见模板):albumsLoaded===false → 还没加载完,渲染骨架;
// albumsLoaded===true 但仍是 null → 相册真不存在(New-UI 补齐项,Vue2 因页内 state 不会
// 出现此情形,记账)。
const album = computed(() => {
  const raw = albums.albumById(albumId.value)
  return raw ? albumToView(raw, t('photosAlbumUntitled')) : null
})
const notFound = computed(() => albums.albumsLoaded && album.value === null)

// Vue2 :224-242(photos computed)—— 由 T1 sortAlbumPhotos 提供排序,这里只接线数据源。
const photos = computed<Photo[]>(() => sortAlbumPhotos(albums.assetsOf(albumId.value), sortBy.value))
const isLoadingPhotos = computed(() => albums.isLoadingAssets(albumId.value))
const isAlbumEmpty = computed(() => !isLoadingPhotos.value && photos.value.length === 0)

// hero 背景:有封面走共享包缩略图生成器(带 token),无封面渐变占位。
// 偏离登记:Vue2 coverUrl(:282-289) 只认 typeof seed==='string' 的封面 id,数字 id 一律
// 返回空串退化到渐变——这是 Vue2 自身的历史遗留限制(注释称"only real asset id"),而 T1/T2
// 早已把 album.cover 定义为 string|number 通用 id(封面判定铁律本身就要求支持数字 cover)。
// T7 PhotosAlbums.vue 的同名 coverUrl 逻辑已经统一按"非 null/非空即认为是有效 id"处理
// (不做 typeof 限制),这里跟随该已定型的姐妹页写法,不复刻 Vue2 的 typeof 限制。
// var(--hero-tint) 在本仓库 theme.css 中不存在,T7 同一处 fallback 已用
// color-mix(accent 35% + panel-bg) 替代——这里复用同一方案。
// 终审 Minor 4:与 PhotosAlbums.vue 的 .album-cover-fallback 逐字相同的渐变表达式已提成
// theme.css 的 --album-cover-fallback token,这里改用 var() 引用而非重复内联公式。
const coverBgImage = computed(() => {
  const cover = album.value?.cover
  if (cover != null && cover !== '') {
    return `url(${service.photos.thumbnailUrl(cover, 'large')})`
  }
  return 'var(--album-cover-fallback)'
})

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

// Vue2 tileTitle()/:377-378 的提示语——edit 态且手动排序才提"拖拽排序"。
const editHintText = computed(() => {
  if (selected.value.size > 0) return t('photosSelectedCount', { count: selected.value.size })
  return sortBy.value === 'manual' ? t('photosAlbumHintSelectDragCover') : t('photosAlbumHintSelectCover')
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
}
function askConfirmDelete(): void {
  menuOpen.value = false
  confirmDelete.value = true
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
async function onPickerConfirm(ids: Array<string | number>): Promise<void> {
  if (pickerAdding.value) return
  pickerAdding.value = true
  const id = albumId.value
  const name = album.value?.title ?? ''
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

watch(() => route.params.id, () => {
  selected.value.clear()
  // Minor 修正(刻意不照抄 Vue2 的潜在 bug——本期纪律:界面照 Vue2,逻辑 bug 不照抄):Vue2
  // 同名 watch(PhotosAlbumDetail.vue:258-260)只重拉资产,没清标题编辑态。同一组件实例路由切换
  // (hash 跳到另一个相册,组件不销毁重建)场景下:给相册 7 改名,还没提交就切到相册 8,
  // titleEditing/titleDraft 会带着相册 7 的草稿名残留到相册 8 上,之后 blur/回车会把草稿名
  // 提交给相册 8——这是真实数据损坏路径,不是"细枝末节",所以在此清掉。
  titleEditing.value = false
  titleDraft.value = ''
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
  <AreaShell :title="album ? album.title : t('photosAlbumsTitle')">
    <div class="photos-layout">
      <PhotosSidebar />
      <main class="photos-main">
        <!-- Task 9(P4 遗留收口):失败态优先级在骨架分支之前——loadError 一旦为真,
             albumsLoaded 仍是假(刻意,见 albums.ts 注释),不该再落进骨架分支永久显示
             "正在加载"。 -->
        <div v-if="albums.loadError" class="empty-state" data-test="album-load-error">
          <div class="empty-state-title">{{ t('photosAlbumLoadFailed') }}</div>
          <button
            type="button"
            class="bar-btn"
            data-test="album-retry"
            :disabled="retryingAlbums"
            @click="retryAlbums"
          >{{ t('photosRetry') }}</button>
        </div>

        <!-- 还没加载完:骨架 -->
        <div v-else-if="!album && !albums.albumsLoaded" class="album-loading" data-test="album-loading">
          <div class="album-hero album-hero-skeleton"></div>
        </div>

        <!-- 加载完了确实没有:New-UI 补齐项 -->
        <div v-else-if="notFound" class="empty-state" data-test="album-not-found">
          <div class="empty-state-title">{{ t('photosAlbumNotFoundTitle') }}</div>
          <div class="empty-state-desc">{{ t('photosAlbumNotFoundHint') }}</div>
          <button
            type="button"
            class="bar-btn"
            data-test="album-not-found-back"
            @click="goToAlbumsList"
          >{{ t('photosAlbumBack') }}</button>
        </div>

        <template v-else-if="album">
          <!-- Hero -->
          <div class="album-hero">
            <div class="album-hero-bg" :style="{ backgroundImage: coverBgImage }"></div>
            <button
              type="button"
              class="album-hero-back"
              data-test="album-back"
              @click="goToAlbumsList"
            >‹ {{ t('photosAlbumBack') }}</button>
            <div class="album-hero-inner">
              <div class="album-hero-text">
                <div class="album-hero-badge">{{ t('photosAlbumLabel') }}</div>
                <div
                  v-if="!titleEditing"
                  class="album-hero-title"
                  data-test="album-title"
                  :title="t('photosAlbumClickToRename')"
                  @click="startTitleEdit"
                >{{ album.title }}</div>
                <input
                  v-else
                  ref="titleInputRef"
                  v-model="titleDraft"
                  class="album-hero-title album-hero-title-input"
                  data-test="album-title-input"
                  @keydown.enter.prevent="commitTitle"
                  @keydown.esc.prevent="cancelTitleEdit"
                  @blur="commitTitle"
                >
                <div class="album-hero-sub">
                  <span>{{ t('photosItemsCount', { count: album.count }) }}</span>
                  <template v-if="album.dateRange">
                    <span class="dot"></span>
                    <span>{{ album.dateRange }}</span>
                  </template>
                </div>
              </div>
              <div class="album-hero-actions">
                <button
                  type="button"
                  class="bar-btn"
                  data-test="album-edit-toggle"
                  :data-active="edit"
                  @click="toggleEditMode"
                >{{ edit ? t('photosAlbumDone') : t('photosAlbumEdit') }}</button>
                <div ref="morePopRef" class="album-more-wrap">
                  <button
                    type="button"
                    class="bar-btn album-more-btn"
                    data-test="album-more-btn"
                    :data-active="menuOpen"
                    @click="menuOpen = !menuOpen"
                  >⋯</button>
                  <!-- T6: reshaped to the same icon/title/hint idiom as
                       PhotosSmartViewDetail.vue's .sv-export-item rows (markup and classes
                       taken from that file's :671-693), so the two detail pages' more menus
                       stop looking like different products. Convert sits above the
                       destructive separator; Delete stays below it. -->
                  <div v-if="menuOpen" class="sv-export-menu" data-test="album-menu">
                    <button
                      type="button"
                      class="sv-export-item"
                      data-test="album-menu-rename"
                      @click="menuOpen = false; startTitleEdit()"
                    >
                      <div class="sv-export-icon" data-test="album-menu-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg></div>
                      <div>
                        <div class="sv-export-title">{{ t('photosAlbumRename') }}</div>
                        <div class="sv-export-desc">{{ t('photosAlbumRenameHint') }}</div>
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
                        <div class="sv-export-title">{{ t('photosAlbumConvertToSmart') }}</div>
                        <div class="sv-export-desc">{{ t('photosAlbumConvertToSmartHint') }}</div>
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
                        <div class="sv-export-title">{{ t('photosAlbumDelete') }}</div>
                        <div class="sv-export-desc">{{ t('photosAlbumDeleteHint') }}</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Toolbar -->
          <div class="album-toolbar" :data-edit="edit">
            <span class="album-toolbar-muted">{{ t('photosAlbumItemsShown', { count: photos.length }) }}</span>
            <div class="album-toolbar-spacer"></div>
            <template v-if="edit">
              <span class="album-toolbar-group">{{ editHintText }}</span>
              <button
                type="button"
                class="bar-btn"
                data-test="album-remove-selected"
                :disabled="!selected.size || removing"
                @click="removeSelected"
              >{{ t('photosAlbumRemoveFrom') }}</button>
              <button
                type="button"
                class="bar-btn"
                data-test="album-add-photos"
                @click="pickerOpen = true"
              >{{ t('photosAlbumAddPhotos') }}</button>
            </template>
            <template v-else>
              <span class="album-toolbar-group">{{ t('photosAlbumSort') }}</span>
              <div ref="sortMenuRef" class="album-sort-wrap">
                <button
                  type="button"
                  class="bar-btn"
                  data-test="album-sort-btn"
                  @click.stop="sortMenuOpen = !sortMenuOpen"
                >{{ currentSortLabel }}</button>
                <div v-if="sortMenuOpen" class="album-sort-menu" data-test="album-sort-menu">
                  <button
                    v-for="s in sortOptions" :key="s.id"
                    type="button"
                    class="album-sort-item"
                    data-test="album-sort-item"
                    :data-sort-id="s.id"
                    :data-active="s.id === sortBy"
                    @click="pickSort(s.id)"
                  >{{ s.label }}</button>
                </div>
              </div>
              <div class="album-density">
                <button
                  type="button"
                  :data-active="density === 'comfortable'"
                  :title="t('photosDensityComfortable')"
                  @click="density = 'comfortable'"
                >▦</button>
                <button
                  type="button"
                  :data-active="density === 'compact'"
                  :title="t('photosDensityCompact')"
                  @click="density = 'compact'"
                >▪</button>
              </div>
            </template>
          </div>

          <!-- Vue2 :90-93: the body is already a 1fr/320px grid; dropping .no-rail is all it
               takes there. Its own overflow is hidden here because each column scrolls itself --
               if the wrapper scrolled too, the rail would scroll away with the photos (the exact
               defect PhotosMomentDetail was fixed for). -->
          <div class="album-detail-body">
            <!-- Grid -->
            <div class="album-photos-wrap scroll">
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
                  <img :src="thumbnailUrl(p.id, 'small')" alt="">
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

            <!-- T6: stats rail, ported from Vue2 :101-134. Aligns this page with the smart-view
                 detail page's own sidebar (PhotosMomentDetail.vue), so the two detail pages stop
                 looking like different products. -->
            <aside class="sv-detail-side" data-test="album-side">
              <div class="sv-side-section">
                <h3>{{ t('photosMoStats') }}</h3>
                <div class="sv-stat-grid">
                  <div class="sv-stat-cell" data-test="album-stat-cell">
                    <div class="v">{{ album.count.toLocaleString(localeTag) }}</div>
                    <div class="l">{{ t('photosMoPhotos') }}</div>
                  </div>
                  <div class="sv-stat-cell" data-test="album-stat-cell">
                    <div class="v">{{ spanLabel }}</div>
                    <div class="l">{{ t('photosMoSpan') }}</div>
                  </div>
                  <div class="sv-stat-cell" data-test="album-stat-cell">
                    <div class="v">{{ videoCountLabel }}</div>
                    <div class="l">{{ t('photosAlbumStatVideos') }}</div>
                  </div>
                  <div class="sv-stat-cell" data-test="album-stat-cell">
                    <div class="v">{{ createdLabel }}</div>
                    <div class="l">{{ t('photosAlbumStatCreated') }}</div>
                  </div>
                </div>
              </div>
              <!-- By month: absent entirely when nothing carries a takenAt (Vue2 has no such
                   histogram at all here -- this restates PhotosMomentDetail.vue's own gate). -->
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
      </main>
    </div>
  </AreaShell>

  <!-- 删除相册确认模态(唯一带二次确认的操作) -->
  <div
    v-if="confirmDelete"
    class="album-confirm-scrim"
    data-test="album-delete-confirm"
    @click.self="confirmDelete = false"
  >
    <div class="album-confirm">
      <div class="album-confirm-title">{{ t('photosAlbumDeleteTitle', { name: album?.title ?? '' }) }}</div>
      <div class="album-confirm-body">{{ t('photosAlbumDeleteBody', { count: album?.count ?? 0 }) }}</div>
      <div class="album-confirm-foot">
        <button type="button" class="album-confirm-cancel" @click="confirmDelete = false">{{ t('photosCancel') }}</button>
        <button type="button" class="album-confirm-ok" data-test="album-delete-confirm-btn" @click="doDelete">
          {{ t('photosAlbumDelete') }}
        </button>
      </div>
    </div>
  </div>

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
</template>

<style scoped>
/* height(不是 min-height):这一屏封顶,只有内层滚动容器滚 —— 同源修复,理由与 Vue2
   出处见 src/views/Photos.vue 同一规则处的注释。 */
.photos-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 60px 20px; color: var(--fg-muted); text-align: center; }
.empty-state-title { font-size: 16px; font-weight: 600; color: var(--fg); }
.empty-state-desc { font-size: 13px; max-width: 340px; }
.empty-state .bar-btn { margin-top: 10px; }

/* ── Hero ── */
.album-hero { position: relative; height: 260px; border-radius: 20px; overflow: hidden; margin: 4px 4px 16px; flex: 0 0 auto; }
.album-hero-skeleton { background: var(--skeleton-bg); }
.album-hero-bg {
  position: absolute; inset: 0; background-size: cover; background-position: center;
  filter: brightness(0.55) saturate(1.1);
}
.album-hero-bg::after {
  content: ""; position: absolute; inset: 0;
  /* theme-exception: 叠在任意封面照片上的固定暗化渐变,保证文字/按钮对比度,皮肤无关。 */
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.05) 0%, rgba(0, 0, 0, 0.55) 100%);
}
.album-hero-back {
  position: absolute; top: 16px; left: 16px; z-index: 2;
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px;
  border-radius: 999px; border: 1px solid var(--card-border); background: var(--overlay-bg);
  backdrop-filter: var(--blur); cursor: pointer; font-size: 12.5px;
  /* theme-exception: 叠在暗化封面照片上的 hero chrome,两套主题都需固定浅色(同 Vue2
     photos.scss:3571 "pinned … in both themes" 与 PhotosTrash.vue .trash-tile-countdown 惯例)。 */
  color: #fff;
}
.album-hero-inner { position: relative; height: 100%; display: flex; align-items: flex-end; padding: 22px 26px; gap: 24px; }
.album-hero-text { flex: 1 1 auto; min-width: 0; }
.album-hero-badge {
  display: inline-flex; padding: 3px 10px; border-radius: 999px; font-size: 10.5px; font-weight: 600;
  letter-spacing: 0.04em; text-transform: uppercase; background: var(--overlay-bg);
  margin-bottom: 8px;
  /* theme-exception: 叠在暗化封面照片上的 hero chrome,两套主题都需固定浅色(同 Vue2
     photos.scss:3571 "pinned … in both themes" 惯例)。 */
  color: #fff;
}
.album-hero-title {
  font-size: 32px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; cursor: text;
  /* theme-exception: 标题叠在任意封面照片上,两套主题都需固定浅色保证可读(同 Vue2
     photos.scss:3571 "pinned … in both themes" 惯例——--on-accent 默认深色主题下是深藏青
     16 进制那个深蓝色,铺在暗化封面上不可读,评审 Critical 1 修正)。 */
  color: #fff;
  /* theme-exception: 同上,配套阴影保证可读性(照 Vue2 photos.scss:3507),固定黑色不随主题翻转。 */
  text-shadow: 0 2px 30px rgba(0, 0, 0, 0.5);
}
.album-hero-title-input {
  background: var(--overlay-bg); border: 1px solid var(--card-border); border-radius: 8px;
  padding: 2px 10px; font: inherit; outline: none; width: 100%; max-width: 480px;
  /* theme-exception: 同 .album-hero-title,input 叠在同一块暗化封面上,需同款固定浅色。 */
  color: #fff;
}
.album-hero-sub {
  font-size: 13px; opacity: 0.85; margin-top: 8px; display: flex; align-items: center; gap: 10px;
  /* theme-exception: 同 .album-hero-title,叠在暗化封面上需固定浅色(照 Vue2 photos.scss:3521-3530)。 */
  color: #fff;
  /* theme-exception: 配套阴影(照 Vue2 photos.scss:3529),固定黑色不随主题翻转。 */
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}
.album-hero-sub .dot { width: 4px; height: 4px; border-radius: 50%; background: currentColor; opacity: 0.6; }
.album-hero-actions { display: flex; gap: 8px; align-self: flex-end; flex: 0 0 auto; }
/* SP15-P2b-T6 decision (not a missed port -- registering it so a later reviewer does not read
   this class name as one): this rule is NOT renamed to .sv-action-btn, the class the smart-view
   detail page's header buttons use. Vue2 photos.scss:3533-3538 gives .sv-action-btn a dark
   pill + a pinned light foreground + blur on the darkened cover photo -- exactly the three
   values this rule below already carries. The rename would be a visually empty diff. Vue2's
   companion `.sv-action-btn:not([data-primary="true"]):hover` patch (photos.scss, same block)
   exists to serve its Ask Nimo gradient button, which this page has no counterpart for. */
.album-hero-actions .bar-btn {
  background: var(--overlay-bg); border-color: var(--card-border);
  /* theme-exception: hero 里的 Edit/Done、⋯ 按钮叠在暗化封面上,需固定浅色(同 Vue2
     photos.scss:3563-3575 "pinned: dark pill sits on the darkened cover photo in both themes")。 */
  color: #fff;
}
.album-more-wrap { position: relative; }

/* ── T6: more menu reshaped to the sv-export-item idiom -- rule bodies identical to
   PhotosSmartViewDetail.vue's (:937-960), which this restates because scoped styles do not
   cross SFCs in this repo. Replaces the old two-item .album-more-item* rules (removed: this
   page no longer has any element with that class). Vue2 expresses the danger row with an
   inline coral color literal; this repo already has the -danger classes below walking the
   --remove-fg token instead, so the literal is never reproduced. ── */
.sv-export-menu {
  position: absolute; right: 0; top: calc(100% + 6px); min-width: 280px;
  background: var(--popup-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 6px;
  box-shadow: var(--card-shadow-hi); z-index: 50; display: flex; flex-direction: column; gap: 1px;
}
.sv-export-item {
  display: flex; align-items: flex-start; gap: 10px; padding: 9px 10px; background: transparent; border: 0;
  border-radius: 8px; color: var(--fg); text-align: left; cursor: pointer; font: inherit; width: 100%;
}
.sv-export-item:hover { background: var(--chip-bg-hi); }
/* Not present in PhotosSmartViewDetail.vue's own copy of this rule set (none of its menu items
   are ever disabled) -- added here because the Convert entry is disabled when Smart Views are
   off. Same treatment this file already gives .bar-btn:disabled above. */
.sv-export-item:disabled { opacity: 0.45; cursor: not-allowed; }
.sv-export-icon {
  width: 28px; height: 28px; border-radius: 7px; background: var(--accent-soft); color: var(--accent-text);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;
}
.sv-export-title { font-size: 12.5px; font-weight: 500; line-height: 1.2; }
.sv-export-desc { font-size: 11px; color: var(--fg-muted); margin-top: 3px; line-height: 1.35; }
.sv-export-sep { height: 1px; margin: 4px 6px; background: var(--divider); }
.sv-export-item-danger, .sv-export-item-danger .sv-export-title { color: var(--remove-fg); }
.sv-export-icon-danger { background: color-mix(in srgb, var(--remove-fg) 14%, transparent); color: var(--remove-fg); }
/* Compound selector (0,3,0) beats the base .sv-export-item:hover's (0,2,0) structurally, not by
   source order -- same fix PhotosSmartViewDetail.vue applies at its own copy of this rule. */
.sv-export-item.sv-export-item-danger:hover { background: color-mix(in srgb, var(--remove-fg) 14%, transparent); }

/* ── Toolbar ── */
.album-toolbar { display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 4px; flex: 0 0 auto; }
.album-toolbar-muted { font-size: 12px; color: var(--fg-muted); }
.album-toolbar-spacer { flex: 1; }
.album-toolbar-group { font-size: 12px; color: var(--fg-muted); }
/* Minor 补齐:.bar-btn(theme.css:308)显式设了 background+color,盖掉浏览器默认的 disabled
   变淡视觉——同期 PhotosTrash.vue:341 的写法,"移除选中" 0 选中时 disabled 但看起来和平时一样。 */
.bar-btn:disabled { opacity: 0.45; cursor: not-allowed; pointer-events: none; }
.album-sort-wrap { position: relative; }
.album-sort-menu {
  position: absolute; top: calc(100% + 4px); right: 0; min-width: 180px; z-index: 20;
  background: var(--popup-bg); border: 1px solid var(--card-border); border-radius: 12px;
  padding: 4px; box-shadow: var(--card-shadow-hi);
}
.album-sort-item {
  display: block; width: 100%; padding: 8px 10px; background: transparent; border: 0; border-radius: 8px;
  color: var(--fg); font: inherit; font-size: 12.5px; cursor: pointer; text-align: left;
}
.album-sort-item:hover { background: var(--chip-bg-hi); }
.album-sort-item[data-active="true"] { background: var(--accent-soft); }
.album-density { display: inline-flex; gap: 2px; padding: 2px; border-radius: 999px; background: var(--chip-bg); }
.album-density button { width: 26px; height: 26px; border-radius: 999px; border: 0; background: transparent; color: var(--fg-muted); cursor: pointer; }
.album-density button[data-active="true"] { background: var(--chip-bg-hi); color: var(--fg); }

/* ── T6 two-column body: grid + stats rail (Vue2 :90-93 is already a 1fr/320px grid).
   overflow: hidden on the wrapper itself, not auto -- each column below scrolls itself, and a
   scrolling wrapper would carry the rail away with the photos (the exact defect
   PhotosMomentDetail was fixed for; PhotosMomentDetail.vue's own comment on this point applies
   verbatim here). ── */
.album-detail-body {
  flex: 1 1 auto; min-height: 0;
  display: grid; grid-template-columns: 1fr 320px; gap: 0;
  overflow: hidden;
}

/* ── Grid(列宽照 Vue2 photos.scss :3629-3691:comfortable=6 列,compact=9 列)── */
.album-photos-wrap { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 4px 4px 20px; }
.album-photo-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 3px; }
.album-photo-grid.is-compact { grid-template-columns: repeat(9, 1fr); }
.tile { aspect-ratio: 1; position: relative; border-radius: 3px; overflow: hidden; background: var(--chip-bg); cursor: pointer; }
.tile img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.4s ease; }
.tile:hover img { transform: scale(1.04); }
.album-tile-skeleton { background: var(--skeleton-bg); }

/* T4 useAlbumDragSort 的 ghostClass(sortablejs 拖拽占位元素)。Vue2 原值 rgba 137/80/242
   alpha .15 底 + alpha .6 虚线描边 → color-mix(accent) 替代,不写死颜色字面量。 */
.tile-drag-ghost {
  opacity: 0.4;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  outline: 1px dashed color-mix(in srgb, var(--accent) 60%, transparent);
  outline-offset: -1px;
}

/* ★ Cover 徽章:Vue2 原色值 rgba 110/91/255 alpha .85 → color-mix(accent 85% + transparent)。
   edit 态下隐藏(与多选勾选圈同占左上角,选中圈优先——同 Vue2 :3743-3745)。 */
/* Minor 补齐(Vue2 photos.scss:3649-3652):当前封面瓦片描一圈 accent 实线,与其余瓦片区分。 */
.tile[data-cover="true"] { outline: 2px solid var(--accent); outline-offset: -2px; }
.tile[data-cover="true"]::after {
  content: "★ Cover"; position: absolute; top: 6px; left: 6px; z-index: 2; pointer-events: none;
  padding: 2px 8px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
  border-radius: 999px; color: var(--on-accent);
  background: color-mix(in srgb, var(--accent) 85%, transparent);
  backdrop-filter: var(--blur);
}
/* 修正(自审发现,与 Vue2 :3743-3745 对齐):edit 态下所有瓦片的 ★ Cover 徽章都要让位给
   多选勾选圈(两者同占左上角),不是只让位给"当前已选中"的瓦片——用 .album-toolbar[data-edit]
   的通用兄弟选择器命中整个网格,而不是按单瓦片 data-selected 判断(后者会让 edit 态里"尚未
   勾选"的封面瓦片仍然显示徽章,与选择圈重叠)。
   T6 note: .album-photos-wrap is no longer a direct sibling of .album-toolbar -- the new
   .album-detail-body wrapper (see template) now sits between them. The selector below reaches
   through .album-detail-body instead of writing .album-photos-wrap directly (it is the only
   branch inside .album-detail-body carrying .tile -- the aside sidebar has none -- so the
   shallower selector cannot mis-hit it). */
.album-toolbar[data-edit="true"] ~ .album-detail-body .tile[data-cover="true"]::after { display: none; }
/* Minor 补齐(Vue2 photos.scss:3685-3688):edit 态每个瓦片加虚线描边,提示"可选中/可拖拽"。
   Vue2 原 token `--line-strong` 在本仓库 theme.css 两套主题里都不存在(只在 Vue2 自己的
   AI/Agent/tokens.scss 局部定义过,不是全局 token)——换用本仓已有、语义等价的 --card-border
   (专门用于卡片/瓦片描边,两套主题都有定义),不新增 token。 */
.album-toolbar[data-edit="true"] ~ .album-detail-body .tile { outline: 1px dashed var(--card-border); outline-offset: -1px; }

/* 封面星标按钮:Vue2 原底色 rgba 0/0/0 alpha .55 → --overlay-bg;字形色见下方
   theme-exception(评审 Critical 1 修正:固定 #fff,不用 --on-accent,理由见该行注释)。 */
.tile-cover-btn {
  position: absolute; top: 6px; right: 6px; z-index: 3; width: 22px; height: 22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; border: 0;
  background: var(--overlay-bg); opacity: 0; transform: scale(0.85);
  transition: opacity 0.15s ease, transform 0.15s ease, background 0.15s ease; cursor: pointer; font-size: 11px;
  /* theme-exception: 底色平时是 --overlay-bg(暗化封面上的固定深底),hover/data-on 才切到
     --accent 实底——星形字符在两种底色下都需要固定浅色可读,不能用 --on-accent(默认深色
     主题下是深藏青色,叠在 --overlay-bg 上不可读——评审 Critical 1 修正)。 */
  color: #fff;
}
.tile:hover .tile-cover-btn { opacity: 1; transform: scale(1); }
.tile-cover-btn:hover { background: var(--accent); }
.tile-cover-btn[data-on="true"] { opacity: 1; transform: scale(1); background: var(--accent); }

.tile-select-check {
  position: absolute; top: 6px; left: 6px; z-index: 4; width: 20px; height: 20px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; background: var(--overlay-bg);
  border: 1.5px solid var(--card-border); color: var(--on-accent); font-size: 11px;
}
.tile[data-selected="true"] .tile-select-check { background: var(--accent); border-color: var(--accent); }

/* ── 删除相册确认模态 ── */
.album-confirm-scrim {
  position: fixed; inset: 0; z-index: 220; background: var(--overlay-bg); backdrop-filter: var(--overlay-blur);
  display: flex; align-items: center; justify-content: center; padding: 32px 20px;
}
/* P2/P3 血泪(brief 明确点名):模态底色须用 --popup-bg,不用 --card-bg(深色主题下
   --card-bg 近透明,叠在暗底上会看穿)。 */
.album-confirm {
  width: min(380px, 100%); background: var(--popup-bg); border: 1px solid var(--card-border);
  border-radius: 16px; box-shadow: var(--card-shadow-hi); padding: 22px;
}
.album-confirm-title { font-size: 16px; font-weight: 600; color: var(--fg); }
.album-confirm-body { margin-top: 8px; font-size: 13px; color: var(--fg-muted); line-height: 1.5; }
.album-confirm-foot { margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px; }
.album-confirm-cancel, .album-confirm-ok {
  padding: 8px 16px; border-radius: 9px; border: 1px solid var(--chip-border); background: var(--chip-bg);
  color: var(--fg); font: inherit; font-size: 13px; cursor: pointer;
}
.album-confirm-cancel:hover { background: var(--chip-bg-hi); }
.album-confirm-ok {
  border-color: color-mix(in srgb, var(--remove-fg) 45%, transparent); color: var(--remove-fg);
}
.album-confirm-ok:hover { background: color-mix(in srgb, var(--remove-fg) 16%, transparent); }

/* ── T6 stats rail: rule bodies identical to PhotosMomentDetail.vue:1059-1090's
   .sv-side-section, .sv-stat-*, .sv-distribution and .sv-dist-* rules (which themselves
   restate SmartViewSidePanel.vue's, per that file's own comment). Scoped styles do not cross
   SFCs in this repo, so this is the third restatement of the same source, not a fresh
   invention -- extracting a shared stylesheet was explicitly rejected for this task (both
   closed files would need reworking, and scoped→global changes selector precedence). ── */
.sv-detail-side {
  border-left: 1px solid var(--divider); background: var(--panel-bg);
  overflow-y: auto; padding: 20px 18px 40px; min-height: 4px;
}
.sv-side-section { margin-bottom: 24px; }
.sv-side-section h3 {
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--fg-faint); margin: 0 0 10px;
}
.sv-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.sv-stat-cell { background: var(--chip-bg); padding: 10px 12px; border-radius: 8px; }
.sv-stat-cell .v { font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--fg); }
.sv-stat-cell .l { font-size: 11px; color: var(--fg-faint); margin-top: 2px; }
.sv-distribution { height: 56px; display: flex; align-items: flex-end; gap: 2px; margin-top: 8px; }
.sv-dist-bar {
  flex: 1; min-width: 4px; border-radius: 2px 2px 0 0;
  background: linear-gradient(to top, var(--accent), var(--accent-text));
}
.sv-dist-x { display: flex; justify-content: space-between; font-size: 10px; color: var(--fg-subtle); margin-top: 4px; }

/* ≤768px:侧栏已收抽屉,布局单列 */
@media (max-width: 768px) {
  .photos-layout { gap: 0; }
  .album-hero { height: 200px; }
  .album-hero-title { font-size: 24px; }
  .album-detail-body { grid-template-columns: 1fr; }
  .sv-detail-side { border-left: 0; border-top: 1px solid var(--divider); }
}
</style>
