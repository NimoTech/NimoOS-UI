<script setup lang="ts">
// Task 7 (SP7-P4 相册): 相册列表视图——卡片网格 + 排序 + 新建三种填充方式(empty/recent/
// select,Ask Nimo 分支照 brief 明确不建)+ 空态。结构照 Vue2 NimoOS-UI
// src/views/Photos/PhotosAlbumsView.vue:16-86(banner+网格)、:99-165(新建模态)。路由注册
// 留给 T11。
//
// Plan C Task 2(公共换壳):壳从 AreaShell + `.photos-layout` flex-row 换成 Photos.vue 的
// Vue2 结构 `.photos-root[themeClass] > .app[data-collapsed] > PhotosSidebar + main.main`
// (NimoOS-UI PhotosTimeline.vue:943-956)——`collapsed` 改用 Task 2 新建的共享 composable
// useSidebarCollapse(），不再是本页自己没有的状态(相册页此前从未持久化过折叠态,
// PhotosSidebar 一直吃着 prop 默认值 false,即恒展开——这本身是个待补的缺口,这里随换壳
// 一并补上)。Vue2 这五页没有 PhotosTopbar(时间线专属),banner 本身就是头部,不额外加顶栏。
// AreaShell 去留判定:同 Photos.vue Task 3 的既定结论——桌面态(≥769px)`.area-bar` 确实
// display:none,但 `.area-body` 仍带 20px padding + 一层 flex 包裹,与 `.app` 网格自带的
// 100vh/无内边距冲突,故同样脱壳。已知遗留(未在本任务修,详见 task-2-report.md):AreaShell
// 的 `.area-bar` 是本页在 ≤768px 窄屏下唯一能打开侧栏抽屉的入口(hamburger 按钮),脱壳后这个
// 入口消失了——与 Photos.vue Task 3→4 之间的同款临时缺口同构(当时 Photos.vue 也曾短暂失去
// 这个入口,直到 Task 4 把开关接到了 PhotosTopbar 上)。本页没有 topbar 可接,brief 明确本任务
// 「除 :data-collapsed 外不需要额外接线」,故这里不越权补——移动端暂时打不开侧栏抽屉,留给
// 后续任务处理。
//
// 点卡片跳真路由(Vue2 是页内 openAlbumId state)——router.push('/photos/albums/' + view.id),
// 铁律:id 可能是数字,字符串拼接自动 toString(),不需要额外 String() 包一层。
//
// 排序:接 util/mixedAlbums.ts 的 sortMixed(不在本视图重写排序逻辑;T2 收官修复见下方
// views computed 的注释)。sort 下拉菜单 + 新建模态的 Esc/点外部关闭
// 一律 document 级监听(onMounted 挂一次、onUnmounted 摘干净),不用模板 @keydown.esc——
// 同 Vue2 mounted/beforeDestroy 的两个全局监听(:240-259)等价语义,组件本身随路由挂载/卸载
// (不是像 T6 PhotosLibraryPicker 那样 v-if 控制的子组件),故直接照 Vue2 一次性挂载/卸载,
// 不需要 T5/T6 那种「随 open prop watch 增删监听」的写法。
import '../photos/styles/vue2-parity'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import { useSidebarCollapse } from '../photos/composables/useSidebarCollapse'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosLibraryPicker from '../photos/components/PhotosLibraryPicker.vue'
import SmartViewCreateDialog from '../photos/components/SmartViewCreateDialog.vue'
import { usePhotosAlbums } from '../photos/stores/albums'
import { useTimelineStore } from '../photos/stores/timeline'
import { usePhotosSmartViews, type SmartView } from '../photos/stores/smartViews'
import { usePhotosSettingsStore } from '../photos/stores/settings'
import { useToast } from '../stores/toast'
import { albumToView, type AlbumView } from '../photos/util/albumView'
import { buildMixedAlbums, sortMixed, type MixedSortId } from '../photos/util/mixedAlbums'
import { isConflict } from '../photos/util/httpErrors'

// SP15-P2b Task 4: 'nimo' is the fourth fill option (Vue2 939a7d3a:PhotosAlbumsView.vue
// :329-336's sourceOptions, 4th entry) -- picking it swaps the panel body for the
// embedded smart-view creation form.
type SourceId = 'empty' | 'recent' | 'select' | 'nimo'

const { t } = useI18n()
const { themeClass } = usePhotosTheme()
const { collapsed } = useSidebarCollapse()
const router = useRouter()
const albums = usePhotosAlbums()
const timeline = useTimelineStore()
const smartViews = usePhotosSmartViews()
const settings = usePhotosSettingsStore()
const toast = useToast()

const sort = ref<MixedSortId>('created')
const sortOpen = ref(false)
const sortMenuRef = ref<HTMLElement | null>(null)

const createOpen = ref(false)
const creating = ref(false)
const newAlbumTitle = ref('')
const newAlbumSource = ref<SourceId>('empty')
const newAlbumInputRef = ref<HTMLInputElement | null>(null)

const pickerOpen = ref(false)
const pickerAlbumId = ref<string | number>('')
const pickerAlbumName = ref('')

// 随 locale 热切换重新求值(照 Vue2 :192 的既有教训——computed 而非 data() 里固化一份)。
const sortOptions = computed(() => [
  { id: 'created' as MixedSortId, label: t('photosAlbumSortCreated'), hint: t('photosAlbumSortCreatedHint') },
  { id: 'name' as MixedSortId, label: t('photosAlbumSortName'), hint: t('photosAlbumSortNameHint') },
  { id: 'name-r' as MixedSortId, label: t('photosAlbumSortNameR'), hint: t('photosAlbumSortNameRHint') },
  { id: 'count' as MixedSortId, label: t('photosAlbumSortCount'), hint: t('photosAlbumSortCountHint') },
  { id: 'date' as MixedSortId, label: t('photosAlbumSortDate'), hint: t('photosAlbumSortDateHint') },
])
const sourceOptions = computed(() => [
  { id: 'empty' as SourceId, label: t('photosAlbumFillEmpty'), hint: t('photosAlbumFillEmptyHint') },
  { id: 'recent' as SourceId, label: t('photosAlbumFillRecent'), hint: t('photosAlbumFillRecentHint') },
  { id: 'select' as SourceId, label: t('photosAlbumFillSelect'), hint: t('photosAlbumFillSelectHint') },
  // SP15-P2b Task 4 (Vue2 :329-336, 4th entry): picking this swaps the panel body for the
  // embedded SmartViewCreateDialog instead of opening a second modal.
  { id: 'nimo' as SourceId, label: t('photosSvLetNimoDraft'), hint: t('photosSvLetNimoDraftHint') },
])

// SP15-P2b (Vue2 939a7d3a:PhotosAlbumsView.vue:391-393): one grid for both kinds, ranked
// by the single Sort control -- smart albums are no longer pinned to the front.
const mixedItems = computed(() =>
  sortMixed(
    buildMixedAlbums(
      albums.albums.map((a) => albumToView(a, t('photosAlbumUntitled'))),
      smartViews.smartViews,
    ),
    sort.value,
  ),
)
const currentSort = computed(() => sortOptions.value.find((s) => s.id === sort.value) ?? sortOptions.value[0])

// Vue2 :79-85 moved this banner from the smart-views page to here along with the smart
// albums themselves. `=== false` is load-bearing: a missing field and a failed fetch both
// mean "on" (settings.ts already encodes that), and only an explicit off should warn.
const aiSmartViewOff = computed(() => settings.aiFeatures.smartview === false)

function coverUrl(view: AlbumView): string {
  // 只有真实资产 id 才生成缩略图 URL;空相册/无封面落到 .album-cover-fallback 渐变占位
  // (Vue2 :274-281 同语义,但 New-UI 一律走 service.photos.thumbnailUrl,不手拼 URL)。
  if (view.cover == null || view.cover === '') return ''
  return service.photos.thumbnailUrl(view.cover, 'large')
}

// SP15-P2c Task 10 (Vue2 9f7e941f:PhotosAlbumsView.vue's smartCoverUrl): a smart album card
// now shows a single cover, seeds[0], exactly like a manual album card -- not the old
// three-image collage. Missing or empty seeds return '' so the template falls through to the
// same .album-cover-fallback the manual card uses; it must never render an <img> with an
// empty src.
function smartCoverUrl(sv: SmartView): string {
  const seed = sv.seeds[0]
  if (!seed) return ''
  return service.photos.thumbnailUrl(seed, 'large')
}

function pickSort(s: { id: MixedSortId }): void {
  sort.value = s.id
  sortOpen.value = false
}

function openCard(view: AlbumView): void {
  router.push('/photos/albums/' + view.id)
}

function openSmartCard(id: string): void {
  router.push('/photos/smart-views/' + id)
}

function openCreate(): void {
  newAlbumTitle.value = ''
  newAlbumSource.value = 'empty'
  createOpen.value = true
  void nextTick(() => { newAlbumInputRef.value?.focus() })
}
function closeCreate(): void {
  createOpen.value = false
}

// SP15-P2b Task 4 (Vue2 :521-524): clicking the disabled nimo option is a no-op, the same
// defensive guard the old standalone New Smart Album button had. Reuses `aiSmartViewOff`
// directly rather than a same-meaning synonym computed.
function selectSource(s: { id: SourceId }): void {
  if (s.id === 'nimo' && aiSmartViewOff.value) return
  newAlbumSource.value = s.id
}

// SP15-P2b Task 4 (Vue2 :575-578): the embedded form reports success -- the store already
// unshifted the new smart view into the list, so there is nothing to insert and nowhere to
// navigate. Just close the shared panel and stay on the list.
function onSmartAlbumCreated(): void {
  closeCreate()
}

// 照 Vue2 :309-358(去掉 nimo 分支,Task 4 补回短路):建成功 → 按 source 分支处理 →
// toast → finally 关模态。
async function confirmCreate(): Promise<void> {
  // SP15-P2b Task 4 (Vue2 :525-530): with nimo picked, the panel body *is* the smart form
  // and it owns its own submit (SmartViewCreateDialog's confirm()). Falling through here
  // used to create a throwaway empty manual album first before handing off -- Vue2's own
  // fix for that bug, ported here rather than reintroduced.
  if (newAlbumSource.value === 'nimo') return
  const title = newAlbumTitle.value.trim()
  if (!title || creating.value) return
  creating.value = true
  try {
    // 刻意偏离 Vue2 的地方(评审 Important 裁定为新缺陷,本轮已修):Vue2 的相册列表
    // 从来不是独立路由——它是 PhotosTimeline.vue 内部按 activeNav 切换的 v-else-if 子块
    // (NimoOS-UI src/router/route.js:206-208 只注册了一个 /photos 路由),而
    // PhotosTimeline.mounted() 无条件 dispatch fetchTimeline,与 activeNav 无关,所以
    // Vue2 下"时间线数据必然已加载"是父组件预热带来的结构性保证。New-UI 把相册改成了
    // 独立真路由(/photos/albums),这层保证不再成立:用户直链/刷新进本页且从未访问过
    // /photos 时,timeline.allPhotos 是空数组,若不在这里补一次 fetchTimeline,会静默
    // 建出一个空相册 + 一条虚假的"已创建"成功 toast,零错误信号。这里补的守卫只在
    // timeline 尚未拉取过时才 fetch(避免用户从时间线视图跳转过来时的无谓重拉)。
    // 终审 Minor 5:判空条件统一改用 timeline.months(PhotosLibraryPicker.vue:114 已是这个
    // 写法)——months 是 timelineGroups 的 1:1 map(timeline.ts:60),两者长度永远相等、
    // 永远同真同假,统一成消费侧真正关心的语义(“有没有可展示的月份”),不留两种等价写法。
    //
    // Task 8b: bucket mode hands us months without their photos -- the guard above is
    // satisfied while allPhotos is still empty, which used to make this create an empty
    // album and report success. Two buckets always cover a 30-day window (the current
    // month plus the previous one). fetchNewestBuckets is a no-op outside bucket mode, so
    // the legacy behaviour above is unchanged.
    let recentIds: Array<string | number> | null = null
    if (newAlbumSource.value === 'recent') {
      if (timeline.months.length === 0) {
        await timeline.fetchTimeline()
      }
      await timeline.fetchNewestBuckets(2)
      const cutoff = Date.now() - 30 * 86400000
      recentIds = timeline.allPhotos
        .filter((p) => {
          const ts = p.takenAt ? Date.parse(String(p.takenAt)) : 0
          return ts >= cutoff
        })
        .map((p) => p.id)
      // Task 8b guard: no recent photos in hand -- do not create an empty album and do
      // not report success. (Previously this always created the album first, then silently
      // skipped addAssetsToAlbum when ids was empty while still showing the success toast.)
      if (recentIds.length === 0) {
        toast.show(t('photosAlbumCreateFailed'))
        return
      }
    }

    const created = await albums.createAlbum(title)
    const albumId = created?.id as string | number | undefined

    if (recentIds && albumId != null) {
      await albums.addAssetsToAlbum(albumId, recentIds)
    } else if (newAlbumSource.value === 'select' && albumId != null) {
      // 预取相册资产,使 PhotosLibraryPicker 的 existingIds 一开就正确(照 Vue2 :330-335)。
      await albums.fetchAlbumAssets(albumId)
      pickerAlbumId.value = albumId
      pickerAlbumName.value = title
      pickerOpen.value = true
    }

    toast.show(t('photosAlbumCreatedToast', { name: title }))
  } catch (e) {
    console.error('[albums] createAlbum', e)
    toast.show(isConflict(e) ? t('photosAlbumNameExists') : t('photosAlbumCreateFailed'))
  } finally {
    // Vue2 :354-357 是 finally 关模态(不是只成功才关)——select 分支的模态关闭不影响
    // 已经打开的 pickerOpen(两者是独立的 v-if 层)。
    createOpen.value = false
    creating.value = false
  }
}

// SP15-P1-T9 · Step 0: with PhotosLibraryPicker generalised, three things it used to do itself
// come back to the caller — the write, the success/failure toasts, and closing the panel (the
// component now only picks photos and hands the ids over). Everything below reproduces its
// previous behaviour one for one: the same addAssetsToAlbum, the same photosAlbumAddedToast
// (album name + count), the same photosAlbumAddFailed, closing on success only (a failure leaves
// the panel up with the selection still in it, ready to retry), and the fetchAlbums refresh that
// used to hang off `@added`.
//
// The String() here is load-bearing, not decoration: album assets come back from the API with
// numeric ids while timeline photos carry string ids, so without it the picker would stop
// recognising a single already-in photo. Asserted in this page's own test with a numeric fixture.
const pickerExistingIds = computed(
  () => new Set(albums.assetsOf(pickerAlbumId.value).map((p) => String(p.id))),
)
// The button label used to be photosAlbumPickerAdd (with the selected count) inside the
// component; the caller supplies it now. Passing a function rather than a fixed string is what
// keeps the count moving with the selection (see deviation b in the component's header).
function pickerSubmitLabel(count: number): string {
  return t('photosAlbumPickerAdd', { count })
}
const pickerAdding = ref(false)
async function onPickerConfirm(ids: Array<string | number>): Promise<void> {
  if (pickerAdding.value) return
  pickerAdding.value = true
  const albumId = pickerAlbumId.value
  const name = pickerAlbumName.value
  try {
    await albums.addAssetsToAlbum(albumId, ids)
    toast.show(t('photosAlbumAddedToast', { count: ids.length, name }))
    pickerOpen.value = false
    void albums.fetchAlbums()
  } catch (e) {
    console.error('[albums] addAssetsToAlbum', e)
    toast.show(t('photosAlbumAddFailed'))
  } finally {
    pickerAdding.value = false
  }
}

// 终审 Important 1(全支收尾):fetchAlbums 失败时 albumsLoaded 保持假(见 albums.ts 注释,
// 刻意不变),旧实现下 `isEmpty = albums.albumsLoaded && albums.albums.length === 0` 因此恒假
// → 落进网格分支,渲染"我的相册"分区头 + 光秃秃的新建卡片,没有任何失败提示/重试入口——与
// PhotosFavorites.vue/PhotosAlbumDetail.vue 已经收口过的同一缺陷(P8a Task 9)是同一个 store、
// 同一种符号(loadError),这里补第三处。写法照搬这两个姐妹页的既定形状:本地 retrying 守卫
// (不进 store)+ disabled 反馈 + 复用同一个 fetchAlbums。
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

// 照 Vue2 :240-259 的两个全局监听,onUnmounted 摘干净。
function onDocMousedown(e: MouseEvent): void {
  if (sortOpen.value && sortMenuRef.value && !sortMenuRef.value.contains(e.target as Node)) {
    sortOpen.value = false
  }
}
function onDocKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  if (createOpen.value) {
    closeCreate()
    return
  }
  if (sortOpen.value) sortOpen.value = false
}

onMounted(() => {
  void albums.fetchAlbums()
  // Both fetches are fire-and-forget: the two halves of the grid render independently,
  // so a smart-view failure must not gate the manual albums. Vue2 :414-417 awaited both
  // because its deep-link arbitration needed them together -- New-UI has no such
  // arbitration (usePhotosDeepLinks sends ?smartview= straight to the detail route).
  void smartViews.fetchSmartViews()
  void settings.fetchAiFeatures()
  document.addEventListener('mousedown', onDocMousedown)
  document.addEventListener('keydown', onDocKeydown)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onDocMousedown)
  document.removeEventListener('keydown', onDocKeydown)
})
</script>

<template>
  <div class="photos-root" :class="themeClass">
    <div class="app" :data-collapsed="collapsed">
      <PhotosSidebar :collapsed="collapsed" />
      <main class="main">
       <div class="photos-main">
        <div class="albums-banner">
          <div>
            <h1>{{ t('photosAlbumsTitle') }}</h1>
            <div class="albums-sub">{{ t('photosAlbumsCount', { count: mixedItems.length }) }}</div>
          </div>
          <div class="albums-actions">
            <div ref="sortMenuRef" class="albums-sort-wrap">
              <button type="button" class="bar-btn" data-test="albums-sort-btn" @click.stop="sortOpen = !sortOpen">
                {{ t('photosAlbumSort') }} {{ currentSort.label }}
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              <div v-if="sortOpen" class="albums-sort-menu" data-test="albums-sort-menu">
                <button
                  v-for="s in sortOptions" :key="s.id"
                  type="button"
                  class="albums-sort-item"
                  data-test="albums-sort-item"
                  :data-sort-id="s.id"
                  :data-active="s.id === sort"
                  @click="pickSort(s)"
                >
                  <span class="sort-check">{{ s.id === sort ? '✓' : '' }}</span>
                  <span class="sort-text">
                    <span class="lbl">{{ s.label }}</span>
                    <span class="hint">{{ s.hint }}</span>
                  </span>
                </button>
              </div>
            </div>
            <button type="button" class="bar-btn btn-primary" data-test="albums-new-btn" @click="openCreate">
              {{ t('photosAlbumNew') }}
            </button>
          </div>
        </div>

        <!-- 终审 Important 1:失败态优先级在空态之前——loadError 一旦为真,albumsLoaded 仍是
             假(刻意,见 albums.ts 注释),不该再落进空态分支渲染一个没有任何提示的空网格。
             同 PhotosFavorites.vue/PhotosAlbumDetail.vue 已收口的两处一致形状。
             SP15-P2b Task 3 fix round 1 (Important 3): the standalone "isEmpty" panel that
             used to sit here (data-test="albums-empty") is gone -- it duplicated the section
             subtitle below with the exact same "还没有相册" copy once smart albums joined the
             grid, so a genuinely empty library showed the same message twice on screen at
             once. Vue2 939a7d3a:PhotosAlbumsView.vue:87-95 never had a separate empty panel
             either -- the section subtitle *is* the empty state there, with the create tile
             sitting right beside it. The loadError branch above is untouched: it is a real,
             separate state (fetch failed, not "fetch succeeded with zero results"). -->
        <div v-if="albums.loadError" class="empty-state" data-test="albums-load-error">
          <div class="empty-state-title">{{ t('photosAlbumLoadFailed') }}</div>
          <button
            type="button"
            class="bar-btn"
            data-test="albums-retry"
            :disabled="retryingAlbums"
            @click="retryAlbums"
          >{{ t('photosRetry') }}</button>
        </div>

        <!-- 终审必修 3:Vue2 PhotosAlbumsView.vue:52-58 在网格之上无条件渲染的分区头
             (「我的相册 / 你创建的相册」)——New-UI 曾直接从 banner 落到网格,漏渲染整段,
             连带两个专为它准备的 i18n 键(photosAlbumsMine/photosAlbumsMineHint)成了死码。
             滚动容器安置:Vue2 的滚动容器是外层 .albums-body(photos.scss:3202-3206),分区头
             和网格都是它内部一起滚动的静态内容,不是网格自己另开一层滚动区——这里同构,把
             flex:1+overflow-y:auto 从 .album-grid 挪到新包一层的 .albums-scroll 上,
             .album-grid 收窄回纯网格布局(display:grid + gap),分区头和卡片网格一起随
             .albums-scroll 滚动,不会分裂成两段独立滚动区。 -->
        <div class="albums-scroll scroll">
          <!-- SP15-P2b Task 3: AI-off banner, moved here from PhotosSmartViews.vue (Vue2
               939a7d3a:PhotosAlbumsView.vue:79-85) now that smart albums live in this grid too.
               Markup/classes copied verbatim from PhotosSmartViews.vue's .svs-banner* (renamed
               .albums-ai-banner*) -- see the style block for the token-for-token rule copy.
               fix round 1 (Minor 2): the two registered deviations on the source banner
               (PhotosSmartViews.vue:177-178 -- the RouterLink replacing Vue2's non-clickable
               placeholder span, and not copying Vue2's bare trailing period after the link)
               still apply to this copy; see that file's own header comment for the full
               rationale, not restated twice. -->
          <div v-if="aiSmartViewOff" class="albums-ai-banner" data-test="albums-ai-banner">
            <div class="albums-ai-banner-icon">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
            </div>
            <div>
              <div class="albums-ai-banner-title">{{ t('photosSvSmartViewsAutoUpdate') }}</div>
              <div class="albums-ai-banner-desc">
                {{ t('photosSvTheseSavedSearchesStay') }}
                <RouterLink class="albums-ai-banner-link" data-test="albums-settings-link" to="/photos/settings?section=ai">{{ t('photosPeopleFacesOffLink') }}</RouterLink>
              </div>
            </div>
          </div>

          <section class="albums-section">
            <div class="albums-section-head">
              <h2>{{ t('photosAlbumsMine') }}</h2>
              <!-- SP15-P2b Task 3 fix round 1 (Important 3): this subtitle carries the empty
                   state itself (Vue2 939a7d3a:PhotosAlbumsView.vue:91-93 has no separate empty
                   panel, this line is it). Gated on both `albums.albumsLoaded` AND
                   `smartViews.listLoaded` so it cannot flash the "none yet" copy while either
                   fetch is still in flight -- before both resolve, mixedItems.length is 0 for
                   every library, not just an empty one. SP15-P2b Task 4 (fold-in from Task 3's
                   incomplete guard, see progress.md): the grid is now mixed, so a library with
                   zero manual albums but pending/nonzero smart views needs the smart half's own
                   loaded flag too -- gating on the albums fetch alone left a window where the
                   smart half hadn't landed yet but the guard already read "loaded". -->
              <span class="albums-section-hint">
                {{ albums.albumsLoaded && smartViews.listLoaded && mixedItems.length === 0 ? t('photosAlbumsNoneYetHint') : t('photosAlbumsMineHint') }}
              </span>
            </div>
            <div class="album-grid">
              <!-- SP15-P2c Task 10 (Vue2 9f7e941f:PhotosAlbumsView.vue:96-107): the create
                   tile matches an album card's total height -- the dashed frame narrows to a
                   cover-sized .album-create-cover, and two invisible lines of the same spec as
                   .album-title/.album-meta pad out the rest. Deliberately no hardcoded pixel
                   height: it follows the theme's own font metrics. -->
              <div class="album-create" data-test="album-create-tile" @click="openCreate">
                <div class="album-create-cover">
                  <div class="plus">+</div>
                  <div class="album-create-label">{{ t('photosAlbumNew') }}</div>
                  <div class="album-create-hint">{{ t('photosAlbumNewHint') }}</div>
                </div>
                <div class="album-title" aria-hidden="true" style="visibility:hidden">&nbsp;</div>
                <div class="album-meta" aria-hidden="true" style="visibility:hidden">&nbsp;</div>
              </div>
              <!-- The kind prefix on :key is load-bearing, not decoration: a manual album's
                   numeric id and a smart album's string id can collide once they share a
                   grid (Vue2 :104/:111 uses the same 'sv-' + item.id / item.id split).
                   SP15-P2c Task 10: it got teeth here. While the smart card was a component
                   and the manual card a plain <div>, Vue's isSameVNodeType compared (type,
                   key) as a pair, so a raw-id collision could never be conflated whatever the
                   key said. Both kinds are plain <div>s now, so this prefix is the only thing
                   separating them. Measured cost of dropping it (task-10-report.md): the
                   rendered text stays correct, but every re-sort tears both colliding cards
                   down and rebuilds them instead of moving them, so their cover images are
                   re-fetched and re-decoded. Guarded by PhotosAlbums.test.ts's "moves, rather
                   than rebuilds, a manual album and a smart view that share the same raw id". -->
              <template v-for="item in mixedItems" :key="item.kind + '-' + item.id">
                <!-- SP15-P2c Task 10 (Vue2 9f7e941f:PhotosAlbumsView.vue:108-146): the smart
                     album card is rendered inline with the manual card's shape instead of the
                     standalone SmartViewCard box (deleted in this task). One cover from
                     seeds[0], a Smart badge and a Live/Paused breathing dot over it, then the
                     title and the meta row. Conditions and the threshold are off the card face
                     -- the detail page carries the full picture, the card only has to be
                     recognisable.
                     Task 11 (d): the @click below passes item.sv.id straight through, with no
                     String() wrapper. SmartView.id is typed `string` (smartViews.ts:28) and every
                     write path into the store normalises it through toSmartView (smartViews.ts:98),
                     so the cast was a no-op. -->
                <div
                  v-if="item.kind === 'smart'"
                  class="album-card"
                  data-test="album-smart-card"
                  :data-id="item.sv.id"
                  @click="openSmartCard(item.sv.id)"
                >
                  <div class="album-cover">
                    <img v-if="smartCoverUrl(item.sv)" :src="smartCoverUrl(item.sv)" :alt="item.sv.name">
                    <div v-else class="album-cover-fallback" data-test="album-cover-fallback">
                      <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="album-cover-icon"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.5"/><path d="M21 15l-5-5L5 19"/></svg>
                    </div>
                    <div class="al-smart-badge">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3"/></svg>
                      {{ t('photosSvBadgeSmartView') }}
                    </div>
                    <div
                      class="al-live-dot"
                      :data-paused="!item.sv.live"
                      :title="item.sv.live ? t('photosSvLive') : t('photosSvPaused')"
                    >
                      <span class="live-dot"></span>
                    </div>
                  </div>
                  <div class="album-title">{{ item.sv.name }}</div>
                  <div class="album-meta">
                    <!-- Vue2 renders `{n} photos` here, not the manual card's `{n} items`.
                         Reusing photosPeoplePhotosCount rather than adding a fifth copy of
                         that string: its value in both locales is exactly Vue2's own copy for
                         it, and this repo already reuses that key well outside the People page
                         (PhotosFavorites.vue:231/239, PersonPlacesTab.vue:86). -->
                    <span>{{ t('photosPeoplePhotosCount', { n: item.sv.count }) }}</span>
                    <span class="sep"></span>
                    <span>{{ item.sv.live ? t('photosSvLive') : t('photosSvPaused') }}</span>
                  </div>
                </div>
                <div
                  v-else
                  class="album-card"
                  data-test="album-card"
                  :data-id="item.view.id"
                  @click="openCard(item.view)"
                >
                  <div class="album-cover">
                    <img v-if="coverUrl(item.view)" :src="coverUrl(item.view)" :alt="item.view.title">
                    <div v-else class="album-cover-fallback" data-test="album-cover-fallback">
                      <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="album-cover-icon"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.5"/><path d="M21 15l-5-5L5 19"/></svg>
                    </div>
                  </div>
                  <div class="album-title">{{ item.view.title }}</div>
                  <div class="album-meta">
                    <span>{{ t('photosItemsCount', { count: item.view.count }) }}</span>
                    <template v-if="item.view.dateRange">
                      <span class="sep"></span>
                      <span>{{ item.view.dateRange }}</span>
                    </template>
                  </div>
                </div>
              </template>
            </div>
          </section>
        </div>
       </div>
      </main>
    </div>
  </div>

  <div
    v-if="createOpen"
    class="albums-modal-scrim"
    data-test="albums-create-modal"
    @click.self="closeCreate"
  >
    <div class="albums-modal" :class="{ 'albums-modal-wide': newAlbumSource === 'nimo' }">
      <div class="albums-modal-head">
        <div class="albums-modal-head-text">
          <div class="albums-modal-title">{{ t('photosAlbumCreateTitle') }}</div>
          <div class="albums-modal-sub">{{ t('photosAlbumCreateSub') }}</div>
        </div>
        <button type="button" class="albums-modal-close" :aria-label="t('photosCancel')" @click="closeCreate">&#215;</button>
      </div>

      <label class="albums-modal-label">{{ t('photosAlbumNameLabel') }}</label>
      <input
        ref="newAlbumInputRef"
        v-model="newAlbumTitle"
        :placeholder="t('photosAlbumNamePlaceholder')"
        class="albums-modal-input"
        data-test="albums-name-input"
        @keydown.enter="confirmCreate"
      >

      <label class="albums-modal-label">{{ t('photosAlbumFillLabel') }}</label>
      <div class="albums-source-list">
        <button
          v-for="s in sourceOptions" :key="s.id"
          type="button"
          class="albums-source-item"
          :data-active="newAlbumSource === s.id"
          :data-test="'source-' + s.id"
          :disabled="s.id === 'nimo' && aiSmartViewOff"
          :title="s.id === 'nimo' && aiSmartViewOff ? t('photosSvSmartViewsOffCreateHint') : undefined"
          @click="selectSource(s)"
        >
          <div class="radio" :data-active="newAlbumSource === s.id"><div v-if="newAlbumSource === s.id" class="dot"></div></div>
          <div class="src-text">
            <div class="lbl">{{ s.label }}</div>
            <div class="hint">{{ s.hint }}</div>
          </div>
        </button>
      </div>

      <!-- SP15-P2b Task 4 (Vue2 :519-524's mirror on the panel body): source==='nimo'
           swaps the panel body for the embedded smart form, owning its own submit --
           two submit entry points side by side would be ambiguous, so the host footer
           hides while it is shown. -->
      <SmartViewCreateDialog
        v-if="newAlbumSource === 'nimo'"
        :open="true"
        embedded
        :initial-name="newAlbumTitle"
        @created="onSmartAlbumCreated"
        @close="closeCreate"
      />
      <div v-else class="albums-modal-foot">
        <button type="button" class="albums-btn-ghost" @click="closeCreate">{{ t('photosCancel') }}</button>
        <button
          type="button"
          class="albums-btn-cta"
          data-test="albums-confirm-create"
          :disabled="!newAlbumTitle.trim() || creating"
          @click="confirmCreate"
        >
          {{ creating ? t('photosAlbumCreating') : t('photosAlbumCreate') }}
        </button>
      </div>
    </div>
  </div>

  <PhotosLibraryPicker
    :open="pickerOpen"
    :title="t('photosAlbumPickerTitle', { name: pickerAlbumName })"
    :existing-ids="pickerExistingIds"
    :existing-label="t('photosAlbumPickerAlready')"
    :submit-label="pickerSubmitLabel"
    :submitting="pickerAdding"
    @update:open="pickerOpen = $event"
    @confirm="onPickerConfirm"
  />
</template>

<style scoped>
/* Plan C Task 2: `.photos-layout` flex-row + the transitional `.sidebar { flex... }` width
   pin are gone — the `.app` CSS Grid (parity scss photos.scss:116-129) now owns both the
   sidebar's width and the height cap (`height: 100vh; overflow: hidden`), same as
   Photos.vue since its own Task 3 re-skin. `.photos-layout` no longer appears anywhere in
   this file's source — photosLayoutHeightCap.test.ts's CAPPED list has been updated to drop
   this page accordingly (its `allPhotosLayoutViews()` scan only collects pages that still
   contain the `.photos-layout` rule). */
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 60px 20px 20px; color: var(--fg-muted); text-align: center; }
.empty-state-title { font-size: 16px; font-weight: 600; color: var(--fg); }
.empty-state-desc { font-size: 13px; }
/* 终审 Important 1:与 PhotosFavorites.vue/PhotosAlbumDetail.vue 的同款失败态间距对齐
   (两处已有此规则),否则三个失败屏视觉不一致。 */
.empty-state .bar-btn { margin-top: 10px; }

/* ── Banner ──
   T3 shadow cleanup: `.albums-banner`/`h1`, `.albums-sort-menu`/`.albums-sort-item`(+hover/
   active) and `.sort-text .lbl` used to carry local scoped copies under the exact same class
   names parity already styles (`.photos-root .albums-banner`, `.photos-root .albums-sort-menu`,
   etc.) — the scoped copies won by data-v specificity and were built against New-UI's OWN
   theme.css tokens (--popup-bg/--card-border/--card-shadow-hi/--chip-bg-hi/--fg), which
   `.photos-root` does NOT redefine, so they rendered with the wrong (non-Vue2) numbers: 22px h1
   instead of 28px, a translucent glass sort-menu instead of the opaque `--surface-2` panel the
   brief calls for, wrong padding/radius throughout. Deleted outright — the parity rules (photos.
   scss:3119-3195) now govern directly, no local shadow left to remove them again later. */
.albums-sub { color: var(--text-3); font-size: 12.5px; margin-top: 4px; }
.albums-actions { margin-left: auto; display: inline-flex; gap: 8px; align-items: center; }
/* Vue2 has no class here — the sort dropdown's positioned ancestor is an inline
   `style="position:relative"` div (PhotosAlbumsView.vue:59); this is that div's New-UI class
   equivalent. Parity has no matching selector, so this one survives. */
.albums-sort-wrap { position: relative; }

/* Survivors: `.sort-check`/`.sort-text`/`.sort-text .hint` wrap the check-mark and label/hint
   pair in real elements+classes where Vue2 uses an icon-or-blank-span and an unclassed
   `style="flex:1"` span (PhotosAlbumsView.vue:72-77) — parity has no selector for either
   wrapper, and `.sort-text .hint` doesn't share a name with parity's `.desc` (this repo's own
   i18n key suffix convention is "Hint", not "Desc"; see photosAlbumSortCreatedHint etc.). Colors
   corrected to the parity tokens the wrapped content would carry if unwrapped:
   `.albums-sort-item .lbl` itself is deleted below (name-identical to parity, no wrapper
   needed there). */
.sort-check { width: 14px; flex: 0 0 auto; color: var(--accent-hi); }
.sort-text { flex: 1 1 auto; display: flex; flex-direction: column; }
.sort-text .hint { font-size: 11px; color: var(--text-3); margin-top: 2px; }

/* ── SP15-P2b Task 3: AI-off banner ── token values and inner sizes copied from
   PhotosSmartViews.vue's old .svs-banner* (renamed .albums-ai-banner*); see that file's own
   header comment for why --dem-fg/--dem-bg/--dem-bd rather than the Vue2 source's inline amber
   literals.
   Final fix wave -- the OUTER margin is not copied from there. The right reference for this
   surface is Vue2's own Albums-page banner (939a7d3a:PhotosAlbumsView.vue:79,
   `margin:0 0 20px`): it sits flush with the section head and the grid below it. Inheriting the
   other page's `24px 32px 20px` indented this banner 32px further in than everything else on
   the page. */
.albums-ai-banner {
  margin: 0 0 20px; padding: 14px 16px;
  background: var(--dem-bg); border: 1px solid var(--dem-bd); border-radius: 10px;
  display: flex; gap: 10px; align-items: flex-start;
}
.albums-ai-banner-icon {
  width: 26px; height: 26px; border-radius: 7px;
  background: color-mix(in srgb, var(--dem-fg) 18%, transparent); color: var(--dem-fg);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;
}
.albums-ai-banner-title { font-size: 12.5px; font-weight: 600; color: var(--dem-fg); }
.albums-ai-banner-desc { font-size: 11.5px; color: var(--fg-muted); margin-top: 3px; line-height: 1.5; }
.albums-ai-banner-link { color: var(--accent-text); text-decoration: underline; cursor: pointer; }

/* ── 分区头 + Grid ──
   滚动容器挪到这一层(照 Vue2 photos.scss:3202-3206 的 .albums-body):分区头与网格一起
   滚动,.album-grid 本身只负责网格布局,不再兼任滚动容器。
   SP15-P2b Task 3: minmax(220px, 1fr) below is deliberately NOT changed to the
   minmax(320px, 1fr) SmartViewCard was designed against (PhotosSmartViews.vue's old .sv-grid) --
   the two card kinds now share one grid, and a smart card is therefore narrower here than it
   used to be on its own page. Final fix wave: this matches Vue 2 exactly and is not a cost to
   apologise for. Vue2 939a7d3a unified both kinds into a single `.album-grid-user` at
   minmax(220px, 1fr) (photos.scss:3190-3193) and renders smart-view-card inside it
   (:PhotosAlbumsView.vue:99-105) -- 220px IS the target's mixed-grid column width. */
.albums-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 4px 4px 20px; }
/* `.albums-section-head`/`h2` deleted (T3 shadow cleanup): both class names already match
   parity's `.photos-root .albums-section-head`/`h2` (photos.scss:3213-3225) exactly, and the
   local copies disagreed on real values -- padding 4px 4px 14px vs parity's 12px 0 14px, h2
   15px vs parity's 18px, plus an explicit `color: var(--fg)` (New-UI token, not redefined
   inside `.photos-root`) shadowing the `--text-1` the `.app` grid already sets as the ambient
   text color. `.albums-section-hint` keeps its own name (PhotosAlbums.test.ts asserts on it by
   class, e.g. `w.find('.albums-section-hint')`) -- parity's equivalent is the nameless
   `.albums-section-head .sub`, so only its color is corrected to the parity token (font-size
   already agreed at 12px). */
.albums-section-hint { font-size: 12px; color: var(--text-3); }
.album-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 18px;
}
/* SP15-P2c Task 10 (Vue2 9f7e941f:photos.scss's .album-create split): the tile's outer box is
   now the same vertical flex column as .album-card, and the dashed frame moved inward to
   .album-create-cover so the two invisible text lines below it can pad the tile out to a
   card's total height. */
/* T3 shadow cleanup: `.album-create`/`.album-create-cover`/its hover state deleted -- all three
   share their name with parity's `.photos-root .album-create*` (photos.scss:3364-3388) and the
   local copies disagreed on real values (16px radius vs parity's `--r-lg` =14px, a translucent
   `--chip-bg` glass background vs parity's solid `--surface-1`, `--accent-text` [New-UI's own
   blue] vs parity's `--accent-hi` [purple] on hover). `.album-create .plus`'s box is deleted the
   same way (40px/`--chip-bg-hi` vs parity's 44px/`--surface-2`, and parity's own
   `.album-create:hover .plus` hover rule now applies for free); `font-size: 20px` survives
   because it sizes this repo's literal "+" glyph, a substitute for Vue2's PhotosIcon SVG that
   parity has no property for. `.album-create-label`/`-hint` survive too -- Vue2 renders this
   pair via inline `style=` on unclassed divs (PhotosAlbumsView.vue:121-122), so parity's
   extraction has no selector for them; hint's opacity corrected from 0.75 to Vue2's actual 0.7. */
.album-create .plus { font-size: 20px; }
.album-create-label { font-size: 12.5px; font-weight: 500; }
.album-create-hint { font-size: 11px; opacity: 0.7; }

/* `.album-card`/`:hover`/`.album-cover`/`img`/`:hover img` deleted (T3 shadow cleanup): all
   name-identical to parity (photos.scss:3237-3261) and all disagreed on values the same way as
   `.album-create-cover` above (16px vs `--r-lg`=14px radius, `--chip-bg` vs `--surface-2`
   background, and a `--card-shadow-hi` box-shadow standing in for parity's own two-layer
   soft-drop-shadow-plus-hairline-border spec). Parity's `.album-cover::after` vignette gradient
   was never locally shadowed and already rendered correctly throughout. */
/* 终审 Minor 4:原来这里与 PhotosAlbumDetail.vue:104 各写一份逐字相同的渐变表达式,
   提成 theme.css 的 --album-cover-fallback token,两处都改用它,不再重复。
   T3 note: this one stays despite matching parity's selector name -- parity's own
   `.album-cover-fallback` uses a literal dark-purple hex color (photos.scss:3272), which this
   repo's hard "no hardcoded colors outside vue2-parity/" rule forbids reintroducing here; the
   token already reproduces the same per-theme gradient without a literal. */
.album-cover-fallback {
  position: absolute; inset: 0;
  background: var(--album-cover-fallback);
  display: flex; align-items: center; justify-content: center;
}
/* Vue2 图标色是写死的半透明白色字面量(叠在彩色渐变上的语义前景)——改用 --on-accent(atop
   accent 填充的可读前景色 token)+ opacity 弱化,而非写死颜色字面量。 */
.album-cover-icon { color: var(--on-accent); opacity: 0.7; }
/* `.album-title`/`.album-meta`/`.album-meta .sep` deleted (T3 shadow cleanup): name-identical to
   parity (photos.scss:3277-3298), local copies used `--fg`/`--fg-muted` (New-UI tokens, not
   redefined inside `.photos-root`) in place of parity's `--text-1`/`--text-3`/`--text-4`, and
   the padding didn't match (`0 4px` vs parity's `2px 6px` / `0 6px`). */

/* ── SP15-P2c Task 10: Smart badge + Live/Paused dot overlaid on a smart album's cover
   (Vue2 9f7e941f:photos.scss's .al-smart-badge / .al-live-dot).
   T3 shadow cleanup: both rules, plus `.al-live-dot .live-dot`/`[data-paused] .live-dot`, are
   deleted outright rather than value-patched -- they are name-identical to parity
   (photos.scss:3306-3354) and every property already agreed *except* one real bug:
   `backdrop-filter: var(--blur)` was reaching for this repo's own glass token (`blur(44px)
   saturate(1.7) brightness(1.08)` in dark mode, `none` in light mode -- a heavy multi-effect
   blur sized for large panels elsewhere in the app), not the small `blur(8px)` chip blur Vue2
   actually uses. Deleting lets parity's literal `blur(8px)` govern -- correct in both themes,
   and correctly sized for a small overlay chip. The animation-name collision below is the other
   real bug this cleanup fixes. */

/* The local `@keyframes pulse` this file used to define (deleted along with the rules above)
   collided by name with theme.css's own global `@keyframes pulse` (a box-shadow glow used
   elsewhere in the app, `50% { box-shadow: 0 0 54px var(--orb-glow); } `) -- `<style scoped>`
   does not namespace `@keyframes`, so which animation actually ran depended on stylesheet
   load order, not on which rule "should" win. Parity already defines a collision-free
   `@keyframes photos-pulse` (photos.scss:203) for exactly this reason and its own
   `.al-live-dot .live-dot` rule already references it -- nothing left to declare locally. */

/* ── New album modal ──
   T3 shadow cleanup, whole family: `.albums-modal-scrim/-head/-head-text/-title/-sub/-label/
   -input`, `.albums-source-list/-item`(+hover/active/disabled), `.radio`(+active/.dot),
   `.src-text .lbl`, and `.albums-modal-foot/.albums-btn-ghost/.albums-btn-cta`(+disabled) are
   all name-identical to parity (photos.scss:3844-4022) and are deleted outright rather than
   value-patched. Two of these were real bugs, not just cosmetic drift:
     - `.albums-btn-cta`'s `color: var(--on-accent)` is a deep navy hex in dark mode (see
       theme.css), meant for text on a *light* accent fill, sitting on this button's actual
       purple `--accent` background -- low-contrast text on the modal's own primary action
       button. Parity's literal `color: white` (correct here: a fixed accent-filled button
       reads light text in both themes) now applies.
     - `.albums-modal-foot` had `justify-content: flex-end` sizing two auto-width buttons off the
       right edge; Vue2's actual footer is a full-width bar (`flex: 1` / `flex: 1.4` on the two
       buttons, photos.scss:3985-4022, no justify-content needed) with a divider line above it.
   `.albums-modal-head-text` (a flex:1 wrapper) and `.albums-modal-input:focus` survive: Vue2
   marks up the first as an unclassed `style="flex:1"` div (PhotosAlbumsView.vue:222, no parity
   selector to inherit), and parity's own `.albums-modal-input` has no `:focus` rule at all
   (outline: none) -- keeping a visible focus ring here is a deliberate a11y addition, not a
   pixel-parity concern, so it's kept alongside (not instead of) letting parity's sizing/color
   properties through. */
.albums-modal-head-text { flex: 1 1 auto; min-width: 0; }
.albums-modal-close {
  flex: 0 0 auto; width: 24px; height: 24px; border-radius: 50%; border: 0; background: transparent;
  color: var(--fg-muted); font-size: 15px; line-height: 1; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.albums-modal-close:hover { background: var(--chip-bg-hi); color: var(--fg); }
/* No parity selector under this name -- Vue2's close button is the generic, app-wide `.icon-btn`
   (photos.scss:229-237, 32px). This repo's own dialogs consistently use a bespoke, smaller
   close-button class instead of `.icon-btn` for this exact spot (MergeReviewDialog.vue
   `.mrd-close`, AlbumPickerDialog.vue `.album-picker-close`, ClusterActionDialog.vue
   `.cad-close`, PhotosLibraryPicker.vue `.picker-close` -- same 24px circle + "×" glyph shape
   as this one), so this survives unchanged as the
   established local pattern rather than being swapped to `.icon-btn`. */
.albums-modal-input:focus { outline: 2px solid var(--accent); outline-offset: -1px; }

/* Vue2 has no class for this positioned width-cap either (PhotosAlbumsView.vue:220's
   `:class="{ 'albums-modal-wide': ... }"` sets width via the class parity already covers) --
   parity's own `.albums-modal-wide` is a flat `width: 820px` (photos.scss:3871-3877), which
   would overflow below 820px viewports. This repo's sidebar already collapses into a drawer at
   ≤768px (see the media query below), so the modal needs to survive that width too; the
   `min(820px, 100%)` safety net is kept as a New-UI-only responsive addition layered on top of
   parity's other `.albums-modal-wide` properties (max-height/display/flex-direction/overflow),
   which are otherwise deleted as exact duplicates. */
.albums-modal.albums-modal-wide { width: min(820px, 100%); }

/* Parity defines no hover state for `.albums-source-item` (photos.scss:3918-3941 has only
   `[data-active]`/`:disabled`) -- kept as a New-UI hover affordance using the matching parity
   surface-increment token rather than reintroducing a New-UI-only one. */
.albums-source-item:hover { background: var(--surface-3); }
.src-text { flex: 1 1 auto; min-width: 0; }
/* `.src-text .lbl` is gone -- name-identical to parity's `.albums-source-item .lbl`
   (font-weight: 500, photos.scss:3958), no wrapper-specific override needed. `.hint` keeps its
   own name (this repo's i18n key suffix is "Hint", parity's is "Desc") but its color is
   corrected to the parity token parity's `.desc` actually uses. */
.src-text .hint { font-size: 11px; color: var(--text-3); margin-top: 1px; }

/* New-UI mobile enhancement (Vue2 has no responsive drawer here — same registered deviation
   as Photos.vue's own copy of this rule): once the sidebar switches into is-drawer mode
   (position:fixed, taken out of grid flow) at ≤768px, collapse `.app`'s sidebar column too,
   so `.main` doesn't leave a dead var(--sidebar-w) gutter where the now-floating sidebar
   used to sit. */
@media (max-width: 768px) {
  .app { grid-template-columns: 1fr; }
}
</style>
