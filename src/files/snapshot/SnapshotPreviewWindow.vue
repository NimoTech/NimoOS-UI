<!--
  Task 5 (Files Time Machine Vue2-parity line): a static, read-only, non-interactive miniature
  Finder-style window showing ONE older snapshot's directory listing at the Files area's CURRENT
  relative path. TimeMachineStage.vue (Task 7) mounts one instance per depth-stack slot, stacked
  behind the real, live window, so a "step through time" gesture always reveals a REAL-looking
  preview of the destination snapshot rather than a blank frame.

  Not a byte-for-byte clone of Vue2's own SnapshotPreviewWindow.vue: that file (673 lines) grew
  into a full clone of the real file browser's grid/list views, wired to $api.folder.getList,
  Vuex sort/order state, and a Buefy breadcrumb+chip header. This task's own brief instead asks for
  a much smaller "miniature Finder window" -- title bar with the snapshot's own time label, a
  three-column list (name / size / time) -- built directly against Task 4's simplified
  `getSnapshotPreview` contract (no store, no view-mode toggle, no breadcrumb). Vue2's history
  comments note an even earlier revision of that same file (before its own "M2-F14" rewrite) drew
  exactly this kind of bespoke small-text row list -- this component is closer in spirit to that
  earlier shape than to the file's current, much larger state.

  Read-only/decorative contract (unchanged from Vue2's own convention): aria-hidden, no click
  handlers of any kind. Unlike Vue2's own version, `pointer-events` is deliberately NOT set here --
  the brief for this task states that concern belongs to the parent (TimeMachineStage.vue positions
  and layers up to ~10 of these instances and owns their interactivity as a group).
-->
<template>
  <div class="tm-preview-window" :class="{ 'is-active': active }" aria-hidden="true">
    <header class="tm-preview-window__titlebar">
      <span class="tm-preview-window__time">{{ timeLabel }}</span>
    </header>
    <div class="tm-preview-window__body">
      <!-- Loading: a shimmer-free skeleton (row-shaped bars) -- cheap to render across up to ~10
           concurrently mounted layers, no timers/animation loop needed for a decorative backdrop. -->
      <div v-if="loading" class="tm-preview-window__skeleton" aria-hidden="true">
        <div v-for="n in SKELETON_ROW_COUNT" :key="n" class="tm-preview-window__skeleton-row"></div>
      </div>
      <!-- Error (fetch failed) vs. genuinely empty (folder did not exist yet at that snapshot's
           time) are two different placeholder copies -- `getSnapshotPreview`'s `error` flag
           distinguishes them; see the two `tm*` i18n keys already reserved for this component
           (task-1-report.md's key-reuse table). -->
      <p v-else-if="error" class="tm-preview-window__placeholder">{{ t('tmPreviewUnavailable') }}</p>
      <p v-else-if="rows.length === 0" class="tm-preview-window__placeholder">{{ t('tmNoFolderAtTime') }}</p>
      <ul v-else class="tm-preview-window__list">
        <li
          v-for="row in rows"
          :key="row.name"
          class="tm-preview-window__row"
          :class="{ 'is-dir': row.isDir }"
        >
          <span class="tm-preview-window__col tm-preview-window__col--name">{{ row.name }}</span>
          <span class="tm-preview-window__col tm-preview-window__col--size">{{ row.isDir ? '—' : renderSize(row.size) }}</span>
          <span class="tm-preview-window__col tm-preview-window__col--time">{{ dateFmt(row.mtime) }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { getSnapshotPreview, type PreviewFile } from '../util/snapshotPreviewCache'
import { formatSnapshotBannerTime } from '../util/snapshotPath'
import { renderSize, dateFmt } from '../util/format'

const props = withDefaults(
  defineProps<{
    /** The snapshot-capable volume's mount point (e.g. `/media/RAID_0`). */
    mount: string
    /** Which older snapshot this ONE layer represents. */
    snapshotName: string
    /** The Files area's CURRENT relative path (under the mount) -- the SAME value the real,
     *  live window is also showing. */
    relPath: string
    /** Presentational class hook only (e.g. for the parent's own opacity/scale styling of
     *  near-vs-far depth-stack layers) -- this component makes no fetch/render decision based
     *  on it; it always fetches its own (mount, snapshotName, relPath) listing regardless. */
    active?: boolean
  }>(),
  { active: true },
)

const { t } = useI18n()

// Perf guardrail, same reasoning as Vue2's own `maxRows` (default 24 there, for a much heavier
// icon-grid/table render) -- this list is plain text rows, but up to ~10 of these can be mounted
// concurrently in the depth-stack, so still cap DOM weight rather than rendering an unbounded list.
const SKELETON_ROW_COUNT = 6
const MAX_ROWS = 12

const loading = ref(true)
const error = ref(false)
const entries = ref<PreviewFile[]>([])

// Monotonically-increasing token, checked in the settle callback below -- guards against a stale
// response landing after a newer request (rapid relPath/snapshot prop churn) superseded it, and
// against a response landing after this component has already been unmounted.
let requestToken = 0
let destroyed = false

function fetchListing() {
  requestToken += 1
  const token = requestToken

  if (!props.mount || !props.snapshotName) {
    loading.value = false
    error.value = false
    entries.value = []
    return
  }

  loading.value = true
  error.value = false

  getSnapshotPreview(props.mount, props.snapshotName, props.relPath)
    .then((result) => {
      if (destroyed || token !== requestToken) return
      entries.value = result.entries
      error.value = result.error
    })
    .catch(() => {
      // Defensive only -- getSnapshotPreview's own contract never rejects (it resolves
      // `{ entries: [], error: true }` on failure), but this component must not assume that
      // holds forever and must never surface an unhandled rejection for a decorative backdrop.
      if (destroyed || token !== requestToken) return
      entries.value = []
      error.value = true
    })
    .finally(() => {
      if (destroyed || token !== requestToken) return
      loading.value = false
    })
}

onMounted(fetchListing)
onBeforeUnmount(() => { destroyed = true })
watch(() => [props.mount, props.snapshotName, props.relPath], fetchListing)

// Folders-first, then alphabetical -- a fixed, non-reactive presentation policy (no store
// dependency, per this component's own "presentational only" contract), not a live mirror of
// whatever sort/order the real window currently has selected.
const rows = computed(() => {
  const sorted = [...entries.value].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return sorted.slice(0, MAX_ROWS)
})

// Reuses parseSnapshotName's own semantics (via formatSnapshotBannerTime) rather than
// re-parsing the name here -- never throws, falls back to the raw name when unparseable.
const timeLabel = computed(() => formatSnapshotBannerTime(props.snapshotName))
</script>

<style scoped>
.tm-preview-window {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--tm-control-radius);
  border: 1px solid var(--tm-panel-border);
  background: var(--tm-panel-bg);
  color: var(--tm-text);
}

.tm-preview-window__titlebar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-bottom: 1px solid var(--tm-hairline);
}

.tm-preview-window__time {
  font-size: 12px;
  font-weight: 600;
  color: var(--tm-text-dim);
}

.tm-preview-window__body {
  flex: 1 1 auto;
  overflow: hidden;
  padding: 4px 8px;
}

.tm-preview-window__skeleton {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 4px;
}

.tm-preview-window__skeleton-row {
  height: 10px;
  border-radius: 4px;
  background: var(--tm-ghost-hover-bg);
}

.tm-preview-window__placeholder {
  margin: 0;
  padding-top: 10px;
  font-size: 11px;
  text-align: center;
  color: var(--tm-text-dim);
}

.tm-preview-window__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.tm-preview-window__row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  border-bottom: 1px solid var(--tm-hairline);
  font-size: 11px;
}

.tm-preview-window__row:last-child {
  border-bottom: none;
}

.tm-preview-window__col--name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tm-preview-window__row.is-dir .tm-preview-window__col--name {
  font-weight: 600;
}

.tm-preview-window__col--size,
.tm-preview-window__col--time {
  flex: 0 0 auto;
  color: var(--tm-text-dim);
  white-space: nowrap;
}
</style>
