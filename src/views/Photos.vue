<script setup lang="ts">
// Task 8: 时间线集成——fills the content area left as a placeholder by T5,
// wires the socket task-progress feed, task-done toast coalescing and batch
// delete. Ports Vue2 NimoOS-UI src/views/Photos/PhotosTimeline.vue's socket
// block (:74-91) and mounted-time coalescer wiring (:315-335), simplified per
// task-8-brief.md's P1 scope cut:
//  - non-'index' task types get a generic `{label} completed` toast
//    (photosTaskCompletedToast) instead of Vue2's per-type messages.
//  - no 5s pre-removal delay before announcing — a status:'done' transition
//    observed at ingest time goes straight into the coalescer.
// Task 9: 灯箱集成(P2 收官)——tile `open` 不再是空 handler:构造当前 tab 过滤后的
// 翻页集(与用户网格所见一致,grid 自己 emit 的 list 恒为 undefined)交给
// useLightbox().openAt;PhotoLightbox 挂在模板末尾,delete 事件落到 store.deleteAssets +
// 4000ms toast(灯箱已在 confirm 时自行 close,这里不重复关)。
// Task 9(SP7-P4 相册)追加:选择工具栏批量「加入相册」与灯箱单张「加入相册」统一接
// AlbumPickerDialog(T5)—— pickerOpen/pickerIds + openAlbumPicker(ids),@added 清空
// selection(照 Vue2 pickAlbum:587-595)。
// SP7-P7b-T4:EXIF 筛选条接线——照 Vue2 PhotosTimeline.vue:142-175 的 gridMonths。
// FilterBar 挂进 PhotosToolbar 的 after-tabs 槽位(T3);exifFilter 态 + gridMonths
// 派生 + filteredCount/onOpenTile 改用 gridMonths,三处同源(网格数据源、顶栏计数、
// 灯箱翻页集)。
//
// Task 3(壳 + 侧栏重刻):根结构改为 Vue2 的 `.photos-root[themeClass] > .app[data-collapsed]
// [data-selecting] > PhotosSidebar + main.main`(NimoOS-UI PhotosTimeline.vue:943-956),
// 取代旧的 AreaShell + `.photos-layout` flex-row 外壳。内容槽位(当时是 PhotosSearchBar 起到
// PhotosGrid 止)原样保留在 `.photos-main` 里,只是外面多套了一层 `.app`/`main.main` 网格壳。
//
// Task 4(顶栏重刻,D13):`main.main` 下新增 `<PhotosTopbar>` 作为 `.photos-main` 的**同级
// 前一个兄弟**(照 Vue2 PhotosTimeline.vue:956-971 的 `<main class="main"><PhotosTopbar/>
// <PhotosSearchView v-if=.../>...</main>` 结构——topbar 是 main 的直接子节点,不嵌进内容槽位
// 容器里)。原先内联在这里的 `<PhotosSearchBar>` 一行与紧随其后的 `.photos-summary` 计数行
// 一并移入 PhotosTopbar.vue 内部(标题块 `.topbar-title`+`.topbar-sub`,副行=恒全库计数;
// 搜索框=`.topbar` 内居中的 `.search`)。`collapsed` 的持久化 ref/toggle 语义不变,只是现在
// 有了真正的点击入口(T3 报告"Concerns"第 4 条留的坑——Vue2 自己的折叠按钮就在顶栏,不在
// AreaShell 的汉堡菜单里,补在这里正是 Vue2 的原始位置)。
// PhotosSearchBar.vue 组件当时没删——grep 确认它仍被 `PhotosSearch.vue`(搜索结果页自己的
// 顶部搜索框)复用,只是本文件不再引用它。（Plan F Task 1,2026-08-15 更新:该组件后来
// 也从 `PhotosSearch.vue` 退场——`PhotosSearch.vue` 改用与本文件同一个 `PhotosTopbar`
// 实例回显路由 `q`,`PhotosSearchBar.vue` 已无消费方,组件与其测试文件一并删除。）
//
// AreaShell 去留判定(brief Step 4):读过 AreaShell.vue —— 桌面态(≥769px)`.area-bar`
// 确实 `display:none`(D13 注释属实),但 `.area-body` 仍带 `padding:20px` 且
// `overflow:auto`,`.area-shell` 还包一层 `height:100vh` 的 flex 列容器。这不是"零可见
// chrome":Vue2 pixel baseline 里侧栏是贴边到视口左沿的(`.app` 网格本身就是 100vh 无内边距),
// AreaShell 的 20px padding + 多一层 flex 包裹会把整个 `.app` 网格向内推、且与 `.app` 自带的
// `height:100vh` 叠加造成双重滚动容器。故 Photos.vue 从本任务起脱离 AreaShell,直接以
// `.photos-root` 为根——与 AI Agent 区(src/ai/views/AgentPage.vue)同款自定义整页壳的现有
// 先例一致(AgentPage.vue 同样是从不借 AreaShell 的独立视口壳)。
import '../photos/styles/vue2-parity'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosTopbar from '../photos/components/PhotosTopbar.vue'
import PhotosToolbar from '../photos/components/PhotosToolbar.vue'
import PhotosGrid from '../photos/components/PhotosGrid.vue'
import PhotosSelectionToolbar from '../photos/components/PhotosSelectionToolbar.vue'
import AlbumPickerDialog from '../photos/components/AlbumPickerDialog.vue'
import PhotosFilterBar, { type ExifFilterValue } from '../photos/components/PhotosFilterBar.vue'
import PhotoLightbox from '../photos/lightbox/PhotoLightbox.vue'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { usePhotosDeepLinks } from '../photos/composables/usePhotosDeepLinks'
import { useSidebarCollapse } from '../photos/composables/useSidebarCollapse'
import { useTimelineStore } from '../photos/stores/timeline'
import { usePhotosFavorites } from '../photos/stores/favorites'
import { usePhotosTrash } from '../photos/stores/trash'
import PhotosToastHost from '../photos/components/PhotosToastHost.vue'
import { usePhotosToast } from '../photos/composables/usePhotosToast'
import { useToast } from '../stores/toast'
import { useMessageBus } from '../composables/useMessageBus'
import { unwrapTaskBusPayload, type TaskBusPayload } from '../photos/util/taskBus'
import { createTaskDoneCoalescer } from '../photos/util/taskDoneCoalescer'
import { matchesTab } from '../photos/util/tabFilter'
import { applyExifFilters } from '../photos/util/photosFilterUtils'
import type { Photo } from '../photos/util/assetToPhoto'

const { t } = useI18n()
const router = useRouter()
const store = useTimelineStore()
const trash = usePhotosTrash()
const toast = useToast()
// Task 8: delete-flow toasts (batch + lightbox) move off the global app toast
// onto the Photos-private queue (Task 2's usePhotosToast) — icon/Undo affordance
// parity with Vue2's window.PhotosToast (PhotosTimeline.vue:704-718). The
// task-progress coalescer below stays on the global `toast` — it is
// task-progress UX, not part of the delete flow this task owns (see the
// doneCoalescer wiring further down).
const photosToast = usePhotosToast()
const bus = useMessageBus()
const lb = useLightbox()

// Task 3: photos-private theme, applied to the `.photos-root` grid root (Task 1's shared
// composable — see usePhotosTheme.ts).
const { themeClass } = usePhotosTheme()

// Task 3/4: sidebar collapse (Vue2 PhotosTimeline.vue's `collapsed` data + the topbar
// toggle button that flips it, PhotosTimeline.vue:965 `@toggle="collapsed = !collapsed"`) —
// persisted state + the narrow-viewport drawer branch (final-review fix item 6: on a
// ≤768px viewport PhotosSidebar renders as its own fixed drawer instead of the desktop
// two-column grid track, so flipping `collapsed` there would be a no-op; the composable
// routes the same toggle to the drawer's own toggle() when isNarrow is true) now live in
// the shared useSidebarCollapse composable (Plan C Task 2 extraction, behavior-preserving —
// see that file's header comment for the module-singleton rationale). Photos.vue is its
// first consumer; the five re-shelled album/for-you views (Task 2) share the same instance.
const { collapsed, toggle: onToggleCollapse } = useSidebarCollapse()

// Default tab: aligned with Vue2 NimoOS-UI src/views/Photos/PhotosTimeline.vue's
// `data() { tab: 'photo' }` — 'all' was an unsanctioned drift introduced during
// the port (SP7-P1 review finding), sanctioned fix.
const tab = ref('photo')

// Task 7(P8a)+ P8b:深链分发器,composable 内部自行 onMounted + watch,这里只挂一次。
// ?tab 是唯一需要宿主页面配合的键(tab 是本页的展示过滤、不是导航目的地,没有对应路由
// 可跳),所以把 tab 的写入口通过 hooks 交给它;其余键全靠 router 自己落地。
// 挂载点放在 `const tab` 之后而不是 setup 开头:闭包虽然只在 onMounted/watch 里才执行、
// 不会真的撞上 TDZ,但"引用一个还没声明的绑定"是没必要的隐患,顺序上避开更省心。
usePhotosDeepLinks({ setTab: (v) => { tab.value = v } })

const density = ref('comfortable')
const selected = ref<Array<string | number>>([])

// P7b-T4:EXIF 筛选态。照 Vue2 PhotosTimeline.vue:116 的 activeFilters,但只保留三个
// facet 键——Vue2 那个对象上还挂着 placeKey/spotKey 两个 spot 跳转用的键,New-UI 的
// 城市/spot 跳转走独立路由页(D6),那两个键在本仓无对应物。
const exifFilter = ref<ExifFilterValue>({ years: [], places: [], cameras: [] })

// SP15-P3-T8: is an EXIF filter actually narrowing anything right now? Only
// then does "unknown membership" become a real problem for an unloaded month.
const exifFilterActive = computed(() => {
  const f = exifFilter.value
  return f.years.length > 0 || f.places.length > 0 || f.cameras.length > 0
})

// Aligned with Vue2 gridMonths' library branch (:170-172): filter each month,
// then drop the ones left empty — except for one case. In bucket mode an
// unloaded month's `photos` is always an empty array, so that unconditional
// filter would drop exactly the months the grid needs in order to paint
// structure — they are also where the scroll length and the jump anchors come
// from. Once an EXIF filter is active the drop is restored: an unloaded
// month's membership under that filter is genuinely unknown to the frontend
// (owner ruling 2026-08-10, spec §5.1 — a registered limitation, not an
// oversight; the real fix is backend-side filtering).
const gridMonths = computed(() =>
  store.months
    .map((m) => ({ ...m, photos: applyExifFilters(m.photos, exifFilter.value) }))
    .filter((m) => m.photos.length > 0 || (m.loaded === false && !exifFilterActive.value)),
)

// Grid does tab-filtering internally; mirror the same predicate here (hoisted
// to photos/util/tabFilter.ts, Fix 3) to feed the toolbar's item count (Vue2
// passed the filtered count, PhotosGrid.vue filteredMonths logic ported at task-7).
// D20(用户 2026-08-03 拍板):计数跟着 EXIF 筛选一起减,与用户所见一致。
// (Vue2 传的是 allPhotos.length,既不跟标签页也不跟筛选;New-UI 在 P1 已把它改成跟标签页
// 走的 sanctioned 偏离,这里把 EXIF 叠进同一个 computed,方向一致。)
const filteredCount = computed(() =>
  gridMonths.value.reduce((sum, m) => sum + m.photos.filter((p) => matchesTab(p, tab.value)).length, 0),
)

// T16 接线(结构规格 22):搜索框恒显示(对应 Vue2 `show-search = isLibraryView`,
// New-UI 没有"库视图/其余视图"这个多态壳,时间线页本身就只有这一种形态,故无 v-if
// 条件)。提交→跳转 /photos/search。空串早已在 PhotosTopbar.submitSearch 里被挡下
// （trim 后为空直接 return,不 emit search-submit——ledger 六-2,owner 裁决),这个
// handler 根本收不到空串;下面的 `q ? { q } : {}` 只是防御性写法(万一将来有别的调用
// 方式传空串进来也不会拼出 `?q=` 这个空查询参数),不代表"空提交仍会跳转"。
function onSearchSubmit(q: string) {
  router.push({ path: '/photos/search', query: q ? { q } : {} })
}

function toggleSelect(id: string | number) {
  const idx = selected.value.indexOf(id)
  if (idx >= 0) selected.value = selected.value.filter((x) => x !== id)
  else selected.value = [...selected.value, id]
}
function cancelSelection() { selected.value = [] }

// Task 9: 「加入相册」入口(选择工具栏批量 / 灯箱单张)—— 统一走 AlbumPickerDialog(T5)。
const pickerOpen = ref(false)
const pickerIds = ref<Array<string | number>>([])
function openAlbumPicker(ids: Array<string | number>) {
  pickerIds.value = ids
  pickerOpen.value = true
}
// 照 Vue2 pickAlbum:587-595 结尾 this.selected = [] —— 加完清空选择态(不管是从工具栏批量
// 还是灯箱单张触发,批量场景才有 selected 非空,单张场景这里恒为空数组,赋值是安全的空操作)。
function onAlbumAdded() {
  selected.value = []
}

async function onBatchDelete(ids: Array<string | number>) {
  // Snapshot the full requested id set (not just however many
  // store.deleteAssets reports as actually deleted) — Undo has to hand back
  // exactly what was asked to go, same as Vue2's onBatchDelete/restoreTrash
  // pair (PhotosTimeline.vue:704-718), which never distinguishes a partial
  // failure either.
  const snapshot = ids.map(String)
  const count = await store.deleteAssets(snapshot)
  photosToast.show({
    text: t('photosDeletedToast', { count }),
    icon: 'trash',
    action: {
      label: t('photosTrashUndo'),
      // Undo restores through the trash store (restoreTrashBatch + refetch
      // trash + refresh timeline) and does NOT show a second toast — Vue2
      // parity: the Undo click only dispatches photos/restoreTrash.
      onClick: () => { void trash.restore(snapshot) },
    },
  })
  selected.value = []
}

function onOpenTile(photo: Photo, _list: undefined, startMs: number) {
  // grid 自己不知道当前 tab(它内部过滤是为展示,不为翻页集),此处用同一个 matchesTab
  // 谓词重建"用户所见"的翻页集 —— 与 PhotosToolbar 的 filteredCount 用同一份数据源同一谓词。
  // P7b-T4:翻页集必须与用户在网格里看到的范围一致:先 EXIF 筛(gridMonths)再按标签页筛,
  // 用与 filteredCount 完全相同的两道谓词——否则灯箱能翻到被筛掉的照片。
  const filtered = gridMonths.value.flatMap((m) => m.photos).filter((p) => matchesTab(p, tab.value))
  lb.openAt(photo, filtered, startMs)
}

async function onLightboxDelete(id: string | number) {
  // 灯箱已在用户确认删除时自行 close(见 PhotoLightbox.vue doDelete),这里不再重复关闭。
  const snapshot = [String(id)]
  await store.deleteAssets(snapshot)
  // Same toast/Undo shape as onBatchDelete — Vue2's lightbox delete reuses
  // onBatchDelete([id]) wholesale (PhotosTimeline.vue:1138), so a single
  // delete gets the identical trash-icon + Undo toast, count 1.
  photosToast.show({
    text: t('photosDeletedToast', { count: 1 }),
    icon: 'trash',
    action: {
      label: t('photosTrashUndo'),
      onClick: () => { void trash.restore(snapshot) },
    },
  })
}

// ─── task-done toast coalescing ───────────────────────────────────────────
// P1 message table: 'index' reports the indexed count (Vue2 taskDoneMessage's
// index branch, PhotosTimeline.vue:720-723); every other type collapses to a
// generic "{label} completed" toast (task-8-brief.md P1 scope cut — Vue2's
// nuanced per-type face/embedding copy is out of scope here).
function messageFor(task: TaskBusPayload): string | null {
  if (task.type === 'index') {
    const n = task.current || task.total || 0
    return n > 0 ? t('photosIndexedToast', { n }) : null
  }
  return t('photosTaskCompletedToast', { label: task.label || task.type || '' })
}

const doneCoalescer = createTaskDoneCoalescer<TaskBusPayload>({
  messageFor,
  // 4000ms, aligned with Vue2's task-done toast duration (NimoOS-UI
  // src/views/Photos/PhotosTimeline.vue:329 `$buefy.toast.open({..., duration: 4000})`).
  emit: (message) => toast.show(message, 4000),
})

// Ingest-time done-transition detection: capture whether this task was
// already 'done' before the store merges the new event in, so a task that
// stays 'done' across repeated events (or re-ingests) is only announced once.
// P8a-T10 修:原先用 `store.tasks.find(...).status === 'done'` 判断"是否已经宣布过"——
// fetchIndexStatus 的 idle 对账(timeline.ts:118-120)会把 done 的 index 任务从
// store.tasks 里摘掉,若之后又收到一条迟到的重复 done 事件,find 返回 undefined,
// 旧判断误判成"没宣布过"从而二次 toast。改用一个不依赖任务是否还在列表里的 id 集合:
// 一旦某个 id 被宣布过就记住,直到它以 running 状态"复活"(同 id 复用于新一轮任务)才
// 允许再宣布一次——与 store 侧 5s 过期计时器的"running 取消计时器"同一条重置信号。
const announcedTaskIds = new Set<string | number>()

function onTaskProgress(_props: unknown, raw: unknown) {
  const payload = unwrapTaskBusPayload(raw)
  if (!payload || payload.id == null) return
  if (payload.status === 'running') {
    announcedTaskIds.delete(payload.id)
  }
  store.ingestTaskBus(raw)
  if (payload.status === 'done' && !announcedTaskIds.has(payload.id)) {
    announcedTaskIds.add(payload.id)
    const merged = store.tasks.find((task) => task.id === payload.id) || payload
    doneCoalescer.push(merged)
  }
}

// Socket.io reconnects (initial connect too) can miss task.progress events
// while disconnected; re-sync on every 'connect' (Vue2 PhotosTimeline:78-82).
function onSocketConnect() {
  void store.fetchTasks()
  void store.fetchIndexStatus()
  void store.fetchTimeline()
}

const unsubs: Array<() => void> = []

onMounted(() => {
  store.fetchTimeline()
  store.startIndexPoll()
  store.fetchTasks()
  // Task 10: 时间线首屏收藏态 reconcile —— 若用户本次会话未开过灯箱/收藏视图,
  // per-tile 星标(PhotosGrid)会因 favorites store 的 favIds 尚未拉取而全部
  // 呈描边(误报未收藏)。此处强制一次 reconcile 让时间线一进来星标即准。
  usePhotosFavorites().reconcileFavIds()
  unsubs.push(bus.on('nimoos.photos.task.progress', onTaskProgress))
  unsubs.push(bus.on('connect', onSocketConnect))
})
onUnmounted(() => {
  store.stopIndexPoll()
  unsubs.forEach((off) => off())
  doneCoalescer.cancel()
})
</script>

<template>
  <div class="photos-root" :class="themeClass">
    <div class="app" :data-collapsed="collapsed" :data-selecting="selected.length > 0">
      <!-- review fix round 1 (Plan C Task 2): PhotosSidebar's own floating drawer-trigger
           button is suppressed here — PhotosTopbar's collapse-toggle button already delegates
           to the same drawer on a narrow viewport (see onToggleCollapse above), so rendering
           both would be a redundant double affordance on this one page. Every other
           photos-area page has no topbar and needs the sidebar's own trigger. -->
      <PhotosSidebar :collapsed="collapsed" hide-drawer-trigger />
      <main class="main">
        <PhotosTopbar :collapsed="collapsed" @toggle-collapse="onToggleCollapse" @search-submit="onSearchSubmit" />
        <div class="photos-main">
          <p v-if="store.loading" class="photos-loading">{{ t('photosTitle') }}…</p>
          <template v-else>
            <PhotosToolbar
              :tab="tab" :density="density" :count="filteredCount"
              @update:tab="tab = $event" @update:density="density = $event"
            >
              <template #after-tabs>
                <!-- facet 源取 allPhotos 而不是 gridMonths —— 否则筛掉某个年份后,该年份
                     就从下拉里消失、再也选不回来(Vue2 的 facet 源同样是 displayMonths 而非
                     gridMonths)。
                     Whole-branch review fix (minor 11):此前这句写的是「恒取全库」,在分桶
                     模式下不成立 —— allPhotos 展平的是 `months`,而分桶模式下未加载的月份
                     photos 恒为空数组,所以 facet 列表只覆盖**已加载的桶**,会随用户滚动
                     变长。行为本身是已登记的限制(spec §5.1,真正的修法是后端筛选),这里
                     只是把注释改成实情。 -->
                <PhotosFilterBar v-model:filter="exifFilter" :photos="store.allPhotos" />
              </template>
            </PhotosToolbar>
            <!-- Task 7 (D19): the floating selectbar moves off being PhotosToolbar's
                 preceding sibling (P1 layout) and mounts INSIDE the grid slot instead — Vue2
                 pixel parity has `.selectbar` `position:absolute` anchored to the grid/scrubber
                 area it floats over (NimoOS-UI PhotosGrid.vue:109), not the toolbar row above
                 it. `.photos-grid-slot` is already `position: relative` (see this file's
                 style block below), so no extra positioning container is needed. -->
            <div class="photos-grid-slot">
              <PhotosSelectionToolbar
                v-if="selected.length"
                :count="selected.length"
                @clear="cancelSelection"
                @delete="onBatchDelete([...selected])"
                @add-to-album="openAlbumPicker([...selected])"
              />
              <PhotosGrid
                :months="gridMonths" :tab="tab" :density="density" :selected="selected"
                @open="onOpenTile"
                @toggle-select="toggleSelect"
                @need-bucket="(k: string) => store.fetchBucket(k)"
              />
            </div>
          </template>
        </div>
      </main>
    </div>

    <!-- Fix-4 item 1 (owner acceptance, 2026-08-13; F1/F2 lesson class, now found on the
         timeline page too): AlbumPickerDialog used to be a template-root SIBLING of
         `.photos-root` (a Vue 3 multi-root fragment) rather than its DOM descendant — the same
         root cause as Fix-1 item 3's "New album" modal bug and Fix-2 item 5's detail-page
         dialogs (acceptance-fix-report.md §F1/§F2), just never audited on this page until now.
         Its own parity styling is written as `.photos-root .album-picker-panel` etc.
         (vue2-parity/photos.scss:1072-1102) and its panel background is `var(--surface-2)` — a
         `.photos-root`-local custom property with NO fallback and no global (theme.css)
         definition at all, so outside `.photos-root` it resolves to nothing: the add-to-album
         picker panel likely rendered with a fully transparent background over the fixed dark
         scrim, not merely "wrong colour." Moved back inside `.photos-root`, as a sibling of
         `.app` (matching Vue2's own single-shell nesting and the F1/F2 precedent) — it is
         `position: fixed`, so nesting it inside the scrolling column buys nothing either way,
         and `.photos-root` itself sets no transform/filter/perspective/`contain` that would
         create a new containing block for `position: fixed` (same reasoning already verified in
         F1/F2).
         PhotosToastHost is NOT moved: it Teleports to `<body>` and re-applies `photos-root` +
         `themeClass` on its own portal target by design (see its own header comment and the
         comment just below) — moving its mount point in the template would not change where it
         actually renders, so there is nothing to fix there; it stays a sibling of `.photos-root`
         as it always was. -->
    <AlbumPickerDialog v-model:open="pickerOpen" :asset-ids="pickerIds" @added="onAlbumAdded" />
    <!-- PhotoLightbox re-nested in Plan F: the re-skin (Tasks 3-4) removed the scoped-vs-parity cascade tie that F8-r4 guarded against. -->
    <PhotoLightbox
      @delete="onLightboxDelete"
      @toggle-fav="() => {}"
      @add-to-album="(id) => openAlbumPicker([id])"
    />
  </div>
  <!-- Task 8: Photos-private toast queue (delete/Undo) — mounted once per photos view,
       Teleports to <body> (see PhotosToastHost.vue). -->
  <PhotosToastHost />
</template>

<style scoped>
/* Task 3 起,外层高度封顶不再由这里的 `.photos-layout` 规则负责(该规则已删除,类名不再
   出现在本文件源码里——photosLayoutHeightCap.test.ts 的 CAPPED 名单已同步移除 Photos.vue,
   见该文件注释)。封顶现在由 Vue2 结构的 `.app` 网格自己扛(parity scss photos.scss:116-128
   `height: 100vh; overflow: hidden`)。 */
/* New-UI mobile enhancement (Vue2 has no responsive drawer here — PhotosSidebar.vue's own
   file-header comment registers this deviation): once the sidebar switches into is-drawer
   mode (position:fixed, taken out of grid flow) at ≤768px, collapse `.app`'s sidebar column
   too, so `.main` doesn't leave a dead var(--sidebar-w) gutter where the now-floating sidebar
   used to sit. Parity scss only defines the two-column desktop grid; this override is
   New-UI-only and lives here rather than in the shared stylesheet. */
@media (max-width: 768px) {
  .app { grid-template-columns: 1fr; }
}

/* `.photos-main`/`.photos-loading`/`.photos-grid-slot`: content-slot styling — now a sibling
   of `<PhotosTopbar>` under `main.main` (Task 4 moved the topbar out to be `.photos-main`'s
   preceding sibling, matching Vue2's `<main class="main"><PhotosTopbar/><content/></main>`
   structure), instead of wrapping the search bar itself as it did through Task 3.
   `align-self: stretch` is a harmless leftover from the old flex-row parent (`.photos-main`'s
   former sibling was `.photos-sidebar`); `main.main`'s default grid `align-items: stretch`
   already does the same job.
   `.photos-summary` (Task 4): the standalone full-library count line moved into
   `PhotosTopbar.vue`'s `.topbar-sub` — no longer rendered here, rule deleted with it. */
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }
.photos-loading { color: var(--fg-muted, #9aa4bf); font-size: 14px; padding: 20px 0; }
.photos-grid-slot { position: relative; flex: 1 1 auto; min-height: 0; }
</style>
