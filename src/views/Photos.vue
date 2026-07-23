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
//  - tile `open` is an intentional no-op (lightbox is P2, see TODO below).
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AreaShell from '../components/shell/AreaShell.vue'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosToolbar from '../photos/components/PhotosToolbar.vue'
import PhotosGrid from '../photos/components/PhotosGrid.vue'
import { useTimelineStore } from '../photos/stores/timeline'
import { useToast } from '../stores/toast'
import { useMessageBus } from '../composables/useMessageBus'
import { unwrapTaskBusPayload, type TaskBusPayload } from '../photos/util/taskBus'
import { createTaskDoneCoalescer } from '../photos/util/taskDoneCoalescer'
import { matchesTab } from '../photos/util/tabFilter'
import type { Photo } from '../photos/util/assetToPhoto'

const { t } = useI18n()
const store = useTimelineStore()
const toast = useToast()
const bus = useMessageBus()

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

function toggleSelect(id: string | number) {
  const idx = selected.value.indexOf(id)
  if (idx >= 0) selected.value = selected.value.filter((x) => x !== id)
  else selected.value = [...selected.value, id]
}
function cancelSelection() { selected.value = [] }

async function onBatchDelete(ids: Array<string | number>) {
  const count = await store.deleteAssets(ids.map(String))
  // 4000ms, aligned with Vue2's delete/task-done toasts (NimoOS-UI
  // src/views/Photos/PhotosTimeline.vue:329, :574) — longer than the app
  // default (1500ms) so the user has time to register what happened.
  toast.show(t('photosDeletedToast', { count }), 4000)
  selected.value = []
}

function onOpenTile(_photo: Photo, _list: undefined, _startMs: number) {
  // TODO(SP7-P2): 灯箱 — intentionally left empty for P1.
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
        <p v-if="store.loading" class="photos-loading">{{ t('photosTitle') }}…</p>
        <template v-else>
          <div class="photos-summary">
            {{ t('photosCountSummary', { photos: store.photoCount, videos: store.videoCount }) }}
          </div>
          <PhotosToolbar
            :tab="tab" :density="density" :count="filteredCount"
            @update:tab="tab = $event" @update:density="density = $event"
          />
          <div class="photos-grid-slot">
            <PhotosGrid
              :months="store.months" :tab="tab" :density="density" :selected="selected"
              @open="onOpenTile"
              @toggle-select="toggleSelect"
              @batch-delete="onBatchDelete"
              @cancel="cancelSelection"
            />
          </div>
        </template>
      </main>
    </div>
  </AreaShell>
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
