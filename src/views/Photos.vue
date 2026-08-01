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
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AreaShell from '../components/shell/AreaShell.vue'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosSearchBar from '../photos/components/PhotosSearchBar.vue'
import PhotosToolbar from '../photos/components/PhotosToolbar.vue'
import PhotosGrid from '../photos/components/PhotosGrid.vue'
import PhotosSelectionToolbar from '../photos/components/PhotosSelectionToolbar.vue'
import AlbumPickerDialog from '../photos/components/AlbumPickerDialog.vue'
import PhotoLightbox from '../photos/lightbox/PhotoLightbox.vue'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { useTimelineStore } from '../photos/stores/timeline'
import { usePhotosFavorites } from '../photos/stores/favorites'
import { useToast } from '../stores/toast'
import { useMessageBus } from '../composables/useMessageBus'
import { unwrapTaskBusPayload, type TaskBusPayload } from '../photos/util/taskBus'
import { createTaskDoneCoalescer } from '../photos/util/taskDoneCoalescer'
import { matchesTab } from '../photos/util/tabFilter'
import type { Photo } from '../photos/util/assetToPhoto'

const { t } = useI18n()
const router = useRouter()
const store = useTimelineStore()
const toast = useToast()
const bus = useMessageBus()
const lb = useLightbox()

// Default tab: aligned with Vue2 NimoOS-UI src/views/Photos/PhotosTimeline.vue's
// `data() { tab: 'photo' }` — 'all' was an unsanctioned drift introduced during
// the port (SP7-P1 review finding), sanctioned fix.
const tab = ref('photo')
const density = ref('comfortable')
const selected = ref<Array<string | number>>([])

// Grid does tab-filtering internally; mirror the same predicate here (hoisted
// to photos/util/tabFilter.ts, Fix 3) to feed the toolbar's item count (Vue2
// passed the filtered count, PhotosGrid.vue filteredMonths logic ported at task-7).
const filteredCount = computed(() =>
  store.months.reduce((sum, m) => sum + m.photos.filter((p) => matchesTab(p, tab.value)).length, 0),
)

// T16 接线(结构规格 22):搜索框恒显示(对应 Vue2 `show-search = isLibraryView`,
// New-UI 没有"库视图/其余视图"这个多态壳,时间线页本身就只有这一种形态,故无 v-if
// 条件)。提交→跳转 /photos/search,空串→仍然跳转但不带 q(落到搜索页的预搜索态)。
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
  const count = await store.deleteAssets(ids.map(String))
  // 4000ms, aligned with Vue2's delete/task-done toasts (NimoOS-UI
  // src/views/Photos/PhotosTimeline.vue:329, :574) — longer than the app
  // default (1500ms) so the user has time to register what happened.
  toast.show(t('photosDeletedToast', { count }), 4000)
  selected.value = []
}

function onOpenTile(photo: Photo, _list: undefined, startMs: number) {
  // grid 自己不知道当前 tab(它内部过滤是为展示,不为翻页集),此处用同一个 matchesTab
  // 谓词重建"用户所见"的翻页集 —— 与 PhotosToolbar 的 filteredCount 用同一份数据源同一谓词。
  const filtered = store.months.flatMap((m) => m.photos).filter((p) => matchesTab(p, tab.value))
  lb.openAt(photo, filtered, startMs)
}

async function onLightboxDelete(id: string | number) {
  // 灯箱已在用户确认删除时自行 close(见 PhotoLightbox.vue doDelete),这里不再重复关闭。
  await store.deleteAssets([String(id)])
  toast.show(t('photosDeletedToast', { count: 1 }), 4000)
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
// 已知边界——fetchIndexStatus 的 idle 对账会移除 index 任务,若其后迟到重复
// done 事件会二次 toast;P8 任务条落地时与 scheduleTaskRemove 一并收口。
function onTaskProgress(_props: unknown, raw: unknown) {
  const payload = unwrapTaskBusPayload(raw)
  if (!payload || payload.id == null) return
  const wasDone = store.tasks.find((task) => task.id === payload.id)?.status === 'done'
  store.ingestTaskBus(raw)
  if (payload.status === 'done' && !wasDone) {
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
  <AreaShell :title="t('photosTitle')">
    <div class="photos-layout">
      <PhotosSidebar />
      <main class="photos-main">
        <PhotosSearchBar @submit="onSearchSubmit" />
        <p v-if="store.loading" class="photos-loading">{{ t('photosTitle') }}…</p>
        <template v-else>
          <div class="photos-summary">
            {{ t('photosCountSummary', { photos: store.photoCount, videos: store.videoCount }) }}
          </div>
          <PhotosSelectionToolbar
            v-if="selected.length"
            :count="selected.length"
            @clear="cancelSelection"
            @delete="onBatchDelete([...selected])"
            @add-to-album="openAlbumPicker([...selected])"
          />
          <PhotosToolbar
            :tab="tab" :density="density" :count="filteredCount"
            @update:tab="tab = $event" @update:density="density = $event"
          />
          <div class="photos-grid-slot">
            <PhotosGrid
              :months="store.months" :tab="tab" :density="density" :selected="selected"
              @open="onOpenTile"
              @toggle-select="toggleSelect"
            />
          </div>
        </template>
      </main>
    </div>
  </AreaShell>
  <!-- 收藏态由 photosFavorites store 同源(灯箱内部已直接调用 usePhotosFavorites().toggle),
       此处空接即可,无需再往上冒泡处理。 -->
  <PhotoLightbox
    @delete="onLightboxDelete"
    @toggle-fav="() => {}"
    @add-to-album="(id) => openAlbumPicker([id])"
  />
  <AlbumPickerDialog v-model:open="pickerOpen" :asset-ids="pickerIds" @added="onAlbumAdded" />
</template>

<style scoped>
.photos-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }
.photos-loading { color: var(--fg-muted, #9aa4bf); font-size: 14px; padding: 20px 0; }
.photos-summary { color: var(--fg-muted); font-size: 13px; padding: 4px 4px 0; }
.photos-grid-slot { position: relative; flex: 1 1 auto; min-height: 0; }

/* ≤768px:侧栏已收抽屉(PhotosSidebar.is-drawer 脱离文档流),布局单列 */
@media (max-width: 768px) {
  .photos-layout { gap: 0; }
}
</style>
