<!--
  Task 5 (Files Time Machine Vue2-parity line): a static, read-only, non-interactive miniature
  Finder-style window showing ONE older snapshot's directory listing at the Files area's CURRENT
  relative path. TimeMachineStage.vue (Task 7) mounts one instance per depth-stack slot, stacked
  behind the real, live window, so a "step through time" gesture always reveals a REAL-looking
  preview of the destination snapshot rather than a blank frame.

  REBUILD NOTE (controller ruling, fix round 1): an earlier version of this file was built off a
  research summary's paraphrase ("window chrome, title bar with a snapshot time label, three-column
  name/size/time list") instead of the actual Vue2 source -- that paraphrase does not match what
  the 673-line Vue2 file (NimoOS-UI src/components/filebrowser/components/SnapshotPreviewWindow.vue)
  actually renders. Per the fixed authority rule (Vue2 source beats prose whenever they conflict),
  this version was rewritten to mirror the REAL Vue2 structure instead:

  - Row 1 ("chrome"): a breadcrumb (volume / .snapshots / snapshotName / relPath segments, last
    segment active) plus a "Snapshot · Read-only" chip on the right -- NOT a centered time label.
    Vue2 never shows a formatted snapshot time anywhere in this component; the only place
    `formatSnapshotBannerTime` is actually rendered in this New-UI codebase is the separate,
    always-visible `SnapshotBanner.vue` (shown once, above the real window) -- reusing it again
    here would be a second clock Vue2's own header comment ("owner's call: one clock, not two",
    see TimeMachineCard.test.ts) argues against by the same logic. So `parseSnapshotName`/
    `formatSnapshotBannerTime` are deliberately NOT used in this file.
  - Row 2 ("tool-bar"), shown only when there is at least one entry: an inert disabled checkbox +
    "N items" count, and a decorative grid/list view-toggle glyph on the right.
  - Body: Vue2 has TWO real render modes -- `viewMode: 'grid' | 'list'`, driven by
    TimeMachineStage.vue from the SAME view-mode state the real file browser's own "Change View"
    toggle uses (Vue2: `$store.state.isViewGird`). This file adds the matching `viewMode` prop
    (default `'grid'`, Vue2's own default) for Task 7 to bind from whatever New-UI's real Files
    view keeps that state in (grep the file-area store/route for its grid/list toggle before
    wiring this up). List mode clones a sortable-header table (name/type/date/size columns, reusing
    the SAME `filesColName/Type/Date/Size` i18n keys the real `FileListView.vue` header uses).
    Grid mode clones a card grid (icon + name + date), matching `FileTile.vue`'s own name/date
    shape -- see that file for the New-UI equivalent this mirrors (no thumbnail component is
    reused here: Vue2's own header comment explains why per-row thumbnail fetches are rejected for
    up to ~10 concurrently mounted depth-stack layers; this preview only ever renders a static
    folder/file glyph, zero extra network cost).
  - Loading / errored / genuinely-empty ALL render as empty chrome (thead/grid container present,
    zero rows/cards, Row 2 naturally hidden since its `totalCount > 0` gate is false) -- this is
    Vue2's own explicit, documented behavior (see its file's closing template comment: "no spinner,
    no error text, no toast... a backdrop layer that briefly shows nothing is a strictly better
    failure mode than one that pops a notification the user never asked for"). The `active` prop
    does not exist in Vue2 at all (its own prop list is only mount/snapshotName/relPath/maxRows/
    viewMode) -- it is a New-UI-only addition per this task's own brief, kept here as a pure CSS
    class hook with no effect on fetching, matching the earlier build's decision (confirmed on
    re-read: nothing in Vue2 gates on an "active"/visibility concept).

  `volumeLabel`/`displayNames` (Vue2's breadcrumb's first segment, sourced from
  `$store.state.displayNames`) has no New-UI equivalent wired up yet; this component uses the bare
  mount-path basename fallback only -- the SAME fallback Vue2's own unit test suite exclusively
  exercises (its header comment: "the only path exercised in this component's own unit tests, which
  never inject displayNames"). Flagged in task-5-report.md for Task 7 if a display-name mapping is
  wanted later; not adding an unauthorized extra prop for it here.

  Read-only/decorative contract (unchanged): aria-hidden, no click handlers of any kind.
  `pointer-events` is deliberately NOT set here (unlike Vue2's own inline `pointer-events: none`)
  -- this task's own brief states that concern belongs to the parent (TimeMachineStage.vue /
  Task 7), which positions and layers up to ~10 of these instances as a group.
-->
<template>
  <div class="tm-preview-window" :class="{ 'is-active': active }" aria-hidden="true">
    <!-- Row 1: clones Vue2's own breadcrumb + read-only chip header. -->
    <header class="tm-preview-window__chrome">
      <nav class="tm-preview-window__crumbs">
        <span
          v-for="(seg, idx) in crumbSegments"
          :key="idx"
          class="tm-preview-window__crumb"
          :class="{ 'is-active': idx === crumbSegments.length - 1 }"
        >{{ seg }}</span>
      </nav>
      <span class="tm-preview-window__chip">{{ t('snapReadOnlyBanner') }}</span>
    </header>

    <!-- Row 2: clones Vue2's own tool-bar -- select-all (inert) + total count, view toggle glyph.
         Gated on totalCount > 0, mirroring Vue2's own `v-if="totalCount > 0"` byte-for-byte. -->
    <div v-if="totalCount > 0" class="tm-preview-window__row2">
      <label class="tm-preview-window__select-all">
        <input type="checkbox" disabled />
        <span class="tm-preview-window__count">{{ t('tmItemCount', { n: totalCount }) }}</span>
      </label>
      <span class="tm-preview-window__view-toggle" :class="viewMode" aria-hidden="true"></span>
    </div>

    <!-- List mode: clones the real FileListView.vue's own sortable header + row shape. -->
    <div v-if="viewMode === 'list'" class="tm-preview-window__body tm-preview-window__list">
      <div class="tm-preview-window__thead">
        <span class="tm-preview-window__th tm-preview-window__th--name">{{ t('filesColName') }}</span>
        <span class="tm-preview-window__th tm-preview-window__th--type">{{ t('filesColType') }}</span>
        <span class="tm-preview-window__th tm-preview-window__th--date">{{ t('filesColDate') }}</span>
        <span class="tm-preview-window__th tm-preview-window__th--size">{{ t('filesColSize') }}</span>
      </div>
      <div class="tm-preview-window__tbody">
        <div v-for="row in rows" :key="row.name" class="tm-preview-window__row" :class="{ 'is-dir': row.isDir }">
          <span class="tm-preview-window__cover" :class="row.isDir ? 'is-folder' : 'is-file'"></span>
          <span class="tm-preview-window__col tm-preview-window__col--name">{{ row.name }}</span>
          <span class="tm-preview-window__col tm-preview-window__col--type">{{ row.isDir ? '' : fileExt(row.name) }}</span>
          <span class="tm-preview-window__col tm-preview-window__col--date">{{ dateFmt(row.mtime) }}</span>
          <span class="tm-preview-window__col tm-preview-window__col--size">{{ row.isDir ? '' : renderSize(row.size) }}</span>
        </div>
      </div>
    </div>

    <!-- Grid mode (default): clones the real FileTile.vue's own icon/name/date card shape. -->
    <div v-else class="tm-preview-window__body tm-preview-window__grid">
      <div v-for="row in rows" :key="row.name" class="tm-preview-window__card" :class="{ 'is-dir': row.isDir }">
        <span class="tm-preview-window__cover" :class="row.isDir ? 'is-folder' : 'is-file'"></span>
        <p class="tm-preview-window__title">{{ row.name }}</p>
        <p class="tm-preview-window__desc">{{ dateFmt(row.mtime) }}</p>
      </div>
    </div>
    <!-- Loading / errored / genuinely-empty: all render as empty chrome above (thead/grid
         container present, zero rows/cards) -- see this file's own header comment for why (Vue2
         source, verbatim behavior: no spinner, no error text, no toast). -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { getSnapshotPreview, type PreviewFile } from '../util/snapshotPreviewCache'
import { SNAPSHOTS_DIR_NAME } from '../util/snapshotPath'
import { renderSize, dateFmt } from '../util/format'
import { fileExt } from '../util/ext'

const props = withDefaults(
  defineProps<{
    /** The snapshot-capable volume's mount point (e.g. `/media/RAID_0`). */
    mount: string
    /** Which older snapshot this ONE layer represents. */
    snapshotName: string
    /** The Files area's CURRENT relative path (under the mount) -- the SAME value the real,
     *  live window is also showing. */
    relPath: string
    /** Vue2 parity: `'grid' | 'list'`, driven by the SAME view-mode state the real file
     *  browser's own view toggle reads (Vue2: `$store.state.isViewGird`). Task 7 should bind
     *  this from New-UI's equivalent Files-area view-mode state so a mid-switch reveal looks
     *  like the SAME app, in whichever mode the front window is currently in. */
    viewMode?: 'grid' | 'list'
    /** Presentational class hook only (e.g. for the parent's own opacity/scale styling of
     *  near-vs-far depth-stack layers) -- Vue2 has no such prop at all; this component makes no
     *  fetch/render decision based on it, matching the "always fetch every mounted layer"
     *  behavior Vue2 itself has. */
    active?: boolean
  }>(),
  { viewMode: 'grid', active: true },
)

const { t } = useI18n()

// Vue2 parity: `maxRows` default is 24 (its own prop default) -- kept as a fixed internal
// constant (not exposed as a prop) since this task's own brief fixes the prop list to
// mount/snapshotName/relPath/active only, and Task 7's brief only authorized adding `viewMode`.
const MAX_ROWS = 24

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
      // Per Vue2 parity, a failure still renders as plain empty chrome -- no error copy.
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
// dependency, per this component's own "presentational only" contract). Mirrors the ONLY path
// Vue2's own sort actually exercises without a live $store (its own defensive fallback to
// name/asc, folders always first regardless of sort column).
const sortedRows = computed(() =>
  [...entries.value].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    return a.name.localeCompare(b.name)
  }),
)

// Vue2 parity: `rows` is capped at maxRows for render weight; `totalCount` (Row 2's label AND
// its own v-if gate) reads the FULL, uncapped length -- see this file's own header comment.
const rows = computed(() => sortedRows.value.slice(0, MAX_ROWS))
const totalCount = computed(() => sortedRows.value.length)

// Vue2 parity ("Breadcrumb segments"): [volumeLabel, '.snapshots', snapshotName, ...relPath
// segments], filtered of empty strings. `volumeLabel` here is always the mount-basename fallback
// -- see this file's own header comment for why a displayNames prop was not added.
const mountBasename = computed(() => {
  if (!props.mount) return ''
  const parts = props.mount.split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : props.mount
})
const crumbSegments = computed(() => {
  const relSegs = props.relPath ? props.relPath.split('/').filter(Boolean) : []
  return [mountBasename.value, SNAPSHOTS_DIR_NAME, props.snapshotName, ...relSegs].filter(Boolean)
})
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

.tm-preview-window__chrome {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--tm-hairline);
}

.tm-preview-window__crumbs {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  font-size: 11px;
  color: var(--tm-text-dim);
}

.tm-preview-window__crumb::after {
  content: '/';
  margin-left: 4px;
  opacity: 0.5;
}

.tm-preview-window__crumb:last-child::after {
  content: '';
  margin: 0;
}

.tm-preview-window__crumb.is-active {
  color: var(--tm-text);
  font-weight: 600;
}

/* Vue2's own literal chip values (bg = accent purple at 10% alpha, text = the darker accent
   shade) are exactly --tm-accent / --tm-accent-hover -- reproduced via color-mix rather than a
   new token (see this file's own header comment for the source trace). */
.tm-preview-window__chip {
  flex: 0 0 auto;
  padding: 3px 10px;
  border-radius: 980px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  background: color-mix(in srgb, var(--tm-accent) 10%, transparent);
  color: var(--tm-accent-hover);
}

.tm-preview-window__row2 {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px;
  border-bottom: 1px solid var(--tm-hairline);
  font-size: 11px;
  color: var(--tm-text-dim);
}

.tm-preview-window__select-all {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tm-preview-window__view-toggle {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  border: 1px solid var(--tm-ghost-border);
}

.tm-preview-window__body {
  flex: 1 1 auto;
  overflow: hidden;
}

.tm-preview-window__thead {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-bottom: 1px solid var(--tm-hairline);
  font-size: 10px;
  color: var(--tm-text-dim);
}

.tm-preview-window__th--name { flex: 1 1 auto; }
.tm-preview-window__th--type,
.tm-preview-window__th--date,
.tm-preview-window__th--size { flex: 0 0 auto; }

.tm-preview-window__tbody {
  display: flex;
  flex-direction: column;
}

.tm-preview-window__row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  font-size: 11px;
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

.tm-preview-window__col--type,
.tm-preview-window__col--date,
.tm-preview-window__col--size {
  flex: 0 0 auto;
  color: var(--tm-text-dim);
  white-space: nowrap;
}

.tm-preview-window__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px;
}

.tm-preview-window__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 64px;
}

.tm-preview-window__cover {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: var(--tm-ghost-hover-bg);
  border: 1px solid var(--tm-ghost-border);
}

.tm-preview-window__cover.is-folder {
  background: color-mix(in srgb, var(--tm-accent) 16%, transparent);
  border-color: var(--tm-accent);
}

.tm-preview-window__title {
  margin: 0;
  max-width: 100%;
  font-size: 10px;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tm-preview-window__desc {
  margin: 0;
  font-size: 9px;
  color: var(--tm-text-dim);
}
</style>
