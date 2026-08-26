<!--
  Task 5 (Files Time Machine Vue2-parity line): a static, read-only, non-interactive miniature
  Finder-style window showing ONE older snapshot's directory listing at the Files area's CURRENT
  relative path. TimeMachineStage.vue (Task 7) mounts one instance per depth-stack slot, stacked
  behind the real, live window, so a "step through time" gesture always reveals a REAL-looking
  preview of the destination snapshot rather than a blank frame.

  FIX WAVE A1 (owner-rejection root cause, 2026-08-25 pixel audit -- .superpowers/sdd/
  2026-08-25-files-time-machine-vue2-parity/audit-preview.md): the owner rejected the previous
  build's file-listing design. The audit's root-cause finding: the Vue2 authority
  (NimoOS-UI src/components/filebrowser/components/SnapshotPreviewWindow.vue, 673 lines) is NOT a
  hand-authored miniature -- its own 244-line header comment documents that a bespoke-small-text
  version (M2-F12) was REJECTED ("looked like a different app") and rewritten (M2-F14/F15) to reuse
  the REAL window's own full-size classes, with the ancestor `.tm-stage__depth-stack`'s
  `transform: scale(0.82)` doing ALL the shrinking. The previous New-UI build got the OUTER
  architecture right (TimeMachineDepthStack.vue's `.tm-depth-strip` is already `position: absolute;
  inset: 0` -- full stage size, confirmed unchanged by this fix wave, no strip-sizing edit needed)
  but hand-authored an INDEPENDENTLY small inner design (10-12px fonts, 20x20 icons, 64px cards,
  a blank 10x10 view-toggle square) instead of reusing New-UI's own real window pieces at full
  size -- reproducing the exact REJECTED M2-F12 mistake one layer in. This rewrite fixes that:
  every dimension below is copied from a real New-UI component's own literal CSS value (not scaled
  down), and the depth-stack's existing ancestor scale (TM_WINDOW_SCALE = 0.82,
  ../util/timeMachineMath.ts) is what makes it read as "miniature" on screen -- exactly Vue2's own
  mechanism.

  Reuse-vs-clone, applied per element (same litmus test Vue2's OWN header comment established --
  does reusing the real thing carry hazardous side effects for up to ~10 concurrently mounted
  decorative layers?):
  - `<Breadcrumb>` (../components/Breadcrumb.vue) is NOT reused as a live component: it runs its
    own two-line-collapse measuring loop (ResizeObserver + async remeasure()) and mounts a
    `<FavoriteStar>` child (a live Pinia-store-backed toggle) -- neither hazardous by Vue2's own
    "document-global id" litmus (Breadcrumb.vue has none), but both are unnecessary machinery for a
    `pointer-events: none` backdrop layer that can never be interacted with or need to reflow (the
    breadcrumb here is a SNAPSHOT path, not the live virtualPath the real component measures
    against). So this file hand-copies Breadcrumb.vue's own template shape and literal CSS values
    (`.crumb`/`.crumb-sep`/`.crumb.current` -- font-size 14px, padding 2px 4px, color tokens, the
    real "›" separator glyph, NOT Vue2's "/") instead -- same "replicate the DOM+CSS statically"
    fallback Vue2's own header comment uses for its real `<file-breadcrumb>` (there, for an actual
    id-collision hazard; here, for avoiding N redundant measuring loops + N unused store
    subscriptions on a decorative element that can never need either).
  - `<FileTile>`/`<FileRow>`/`<FileThumb>` (../components/) are NOT reused: `FileThumb.vue`'s
    `showThumb` branch fetches a REAL live thumbnail (`service.image.thumbUrl`, gated by
    `useInView`) whenever the entry looks like an image -- exactly the per-row network fetch this
    preview must NOT perform (Vue2's own explicit policy, preserved verbatim: "no live thumbnails,
    static icons only" -- see MATCH list, audit). There is no prop to disable that branch, so
    reusing FileTile/FileRow whole would silently reintroduce live thumbnail fetches for up to ~10
    concurrently mounted preview layers the instant a folder full of photos is browsed in Time
    Machine mode. This file therefore hand-copies FileTile.vue's/FileRow.vue's own template shape
    and literal CSS values (`.file-tile`/`.tile-icon`/`.tile-name`/`.tile-date`,
    `.file-row`/`.file-icon`/`.file-name`/`.file-format`/`.file-date`/`.file-size`) at their real
    pixel dimensions, swapping only the icon source for the SAME static `iconUrl(iconNameFor(...))`
    lookup FileThumb.vue's own non-thumbnail fallback branch already uses (a bundled SVG asset, zero
    added network cost either way -- this part WAS already correct pre-audit and is unchanged).
    Interactive-only decorations native to those real components (`.tile-check`/`.file-check`'s
    checkbox, `.tile-star`/`.file-star`'s FavoriteStar, the upload-broken badge, the uploading
    spinner) are deliberately NOT cloned, matching Vue2's own explicit reasoning for the identical
    situation: every one of them is `opacity: 0` at rest, only reaching `opacity: 1` on
    `:hover`/`.active`/`.uploading` -- states this `pointer-events: none` preview (see
    TimeMachineDepthStack.vue's `.tm-depth-strip { pointer-events: none }`) can never enter -- so
    omitting their markup produces ZERO visible difference from the real window's own
    unselected/unhovered rows. Their column WIDTH is still reserved (empty spacer elements at the
    real 28px/32px) so the remaining columns land in the exact same real positions.
  - `<FileListView>`'s header (../components/FileListView.vue) is NOT reused as a component (it is
    the real, LIVE sortable header -- clicking it calls `emit('reorder', ...)`; a decorative,
    `aria-hidden` clone of it is what belongs here, not a second live one), but its literal column
    chain (`.file-listhead`/`.head-cell`/`.col-check`(28px)/`.col-name`(flex, margin-left 40px on
    the HEADER only)/`.col-format`(48px)/`.col-date`(160px)/`.col-size`(80px, right-aligned)/
    `.col-star`(32px)) is hand-copied verbatim, so header and row columns land at the exact same
    real widths (audit fix target 9).
  - `<FileGridView>`'s (../components/FileGridView.vue) own virtualization/resize-observer/scroll
    machinery is NOT reused (this preview caps at 24 rows total -- see `MAX_ROWS` below -- so there
    is nothing to virtualize, and a second set of scroll/resize listeners per depth-stack layer
    would be pure overhead), but its column MECHANISM is: `.file-grid { display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 14px; }` is copied verbatim
    (as `.tm-preview-window__grid` below) -- CSS `auto-fill` handles responsive column count on its
    own, with NO JavaScript measurement needed at all, unlike Vue2's own `floor(width / 144)`
    port (audit fix target 8: "read how FileGridView lays out columns -- reuse that, not Vue2's
    floor(width/144)"). `<FileTile>`'s own per-card shape is hand-copied per the point above.

  Row 2's "view mode" affordance (audit fix target 2 -- Vue2 renders a real MDI
  view-grid-outline/format-list-bulleted glyph; the PREVIOUS New-UI build rendered a blank,
  glyph-less 10x10 square): New-UI's own real window has NO icon-based view toggle at all --
  Files.vue's own `.files-viewtoggle` (src/views/Files.vue) is a pair of TEXT chip buttons
  (`.chip.view-toggle-grid`/`.chip.view-toggle-list`, i18n `filesViewGrid`/`filesViewList`, an
  `.active` class on whichever is current) -- so mirroring "the REAL New-UI window" here means
  reusing THAT real affordance (two `.chip`-styled pills, hand-copied at the real
  `padding: 6px 14px; border-radius: 999px` size), not inventing an icon Vue2 has but New-UI's own
  real chrome does not.

  Row 2's total-count select-all bar (audit fix target 3, and the controller ruling's "keep the
  '{n} items' count and the grid/list state reflection with REAL affordance visuals"): Vue2's real
  window has a persistent select-all checkbox + count in its own tool-bar. New-UI's real window has
  no persistent equivalent -- SelectionToolbar.vue's own "{n} selected" pill only exists while a
  selection is actually active, which a decorative, pointer-events:none preview can never have.
  Per the controller ruling's own instruction to keep the count, this rewrite keeps the "{n} items"
  text (unchanged behavior: `totalCount`, uncapped by `maxRows`, exactly matching Vue2's own
  `v-if="totalCount > 0"` gate byte-for-byte) but DROPS the previous build's fake disabled
  `<input type="checkbox">` -- New-UI's real chrome has no persistent select-all control for this
  count to sit next to, and inventing one is exactly the "bespoke small affordance with no real
  counterpart" pattern this whole fix wave removes. The real affordance New-UI's own topbar DOES
  show in this position -- the grid/list toggle -- is what now fills that half of Row 2 instead of
  a blank glyph square.

  FIX WAVE C SUPERSEDES THE ABOVE (toolbar redesign, owner-confirmed mockup, 2026-08-26): New-UI's
  real window NOW HAS a persistent header row (`Files.vue`'s own `.files-list-head`, added by this
  fix wave, sitting between the topbar and the listing) -- a circular select-all toggle + item
  count on the left, a grid/list CAPSULE (not text chips any more) on the right. The reasoning
  above ("no persistent equivalent to mirror, so drop the checkbox") no longer holds now that one
  exists; per this file's own established reuse-vs-clone convention (see the top of this header
  comment), row2 is updated to hand-copy THAT real row's shape at its own literal dimensions --
  see the template/style below. The select-all circle here is STATIC (no `.on` state, no click
  handler) since this decorative layer has no selection concept of its own (matching Vue2's own
  source, which also never puts its checkbox in a checked state on these preview windows); the
  capsule DOES still reflect the live `viewMode` prop, unchanged from before.

  FIX WAVE D (D2, owner acceptance 2026-08-26, reveal-time scale stutter): row2's own `v-if
  totalCount > 0` gate (Vue2 parity, byte-for-byte per the paragraph above) went stale the instant
  Fix wave C made the REAL window's `.files-list-head` UNCONDITIONAL (`Files.vue` renders it with
  no `v-if` at all, per that fix wave's own comment) -- nobody updated this mirror to match. An
  empty target directory's promoted depth-0 strip therefore omitted this whole row (shorter box)
  while the just-revealed real window kept showing it (taller box), a genuine vertical content-
  height mismatch landing at the EXACT reveal instant -- one of the "front-only interactive element
  changes layout height" cases this fix wave's own audit was told to check for. Un-gated below to
  match the real row unconditionally, same as the real window; `tmItemCount` already renders "0
  items" correctly for an empty folder (no copy change needed, just the missing v-if removed).

  Row 1/Row 2 chrome padding (audit fix target 12): the previous build's `6px 10px` +
  near-invisible hairline is replaced with 12px horizontal padding (FileRow.vue's/
  FileListView.vue's own literal gutter value, reused consistently across chrome/row2/thead/rows/
  grid below) and NO border-bottom hairline on either row -- Files.vue's own real `.files-topbar`
  has no hairline at all (it is a borderless page-level row, not a bordered modal header the way
  Vue2's `.modal-card-head` is), so a hairline here would itself be an invented affordance the real
  New-UI window does not have. The list body's own `.tm-preview-window__thead` keeps ITS real
  hairline (`border-bottom`, copied from `.file-listhead`) since that one genuinely exists on the
  real `FileListView.vue`.

  The inner container's own border-radius/border/translucent background (audit fix target 11) are
  REMOVED here -- `TimeMachineDepthStack.vue`'s own `.tm-depth-strip` already carries
  `border-radius: 12px` + `box-shadow: var(--card-shadow-hi)` (its own window chrome, unchanged by
  this fix wave), so re-declaring a SECOND radius/border/tint on the content inside it doubled up
  and disagreed with Vue2's own inner `.tm-preview`, which is deliberately unstyled beyond an
  OPAQUE background (Vue2's own literal `#fff`, a light-only app).

  FIX WAVE B (B1, owner acceptance 2026-08-26, real-browser dark-theme screenshot): the opaque
  background above was ported as `var(--tm-panel-bg-solid)` -- TM chrome's own token, pinned to
  the SAME literal `#ffffff` in both New-UI themes (Vue2 parity for the app's decorative shell).
  This preview clones the REAL window's own markup/classes (see this file's own header comment
  above), which paint text in New-UI's OWN theme tokens (`--fg` etc, light in dark theme) --
  stacking that on a permanently-white pane made every cloned label invisible in dark theme.
  Controller Ruling B-1: the preview's CONTENT is "a real window of this app", not TM chrome, and
  must follow New-UI's theme like the real Files view does outside Time Machine mode -- `color`
  below is `--fg` (not `--tm-text`, TM chrome's own fixed dark-ink token) and `background` is the
  GLOBAL `--panel-bg-solid` (theme.css, dark gradient in dark theme / white in light theme --
  already the app's existing "must stay opaque regardless of theme" token, see
  photosGlassSurfaces.test.ts's own consumer whitelist, extended for this fix), NOT `--tm-panel-bg-
  solid`. Still fully opaque in both themes (so up to ~10 stacked layers each occlude the one
  behind), just theme-following instead of hardcoded white.

  Everything the audit's MATCH list already calls correct is preserved as-is by this rewrite: strip
  chrome (untouched, lives on the ancestor), the "Snapshot · Read-only" chip's literal colors
  (`color-mix` off `--tm-accent`/`--tm-accent-hover`, byte-identical to Files.vue's own
  `.tm-real-window-chip` -- see that file's own header comment for the same literal pairing),
  folders-first + live sort mirroring (`sortedRows` below, unchanged), the hidden-file filter
  (upstream in `getSnapshotPreview`, unchanged), the 24-row render cap, the `dateFmt`/`renderSize`
  formatters, blank-chrome loading/error/empty (Vue2's own explicit "no spinner, no error text, no
  toast" policy), no live thumbnails (this fix wave's own reuse-vs-clone trace above reaffirms
  this), non-interactive presentation (parent-owned `pointer-events: none`), and New-UI's own icon
  system for file/folder glyphs (the owner's one approved deviation from Vue2, which comes for free
  from reusing `iconUrl(iconNameFor(...))`, the real window's own icon lookup).

  `volumeLabel` (Task 7 addition, unchanged by this fix wave): Vue2's breadcrumb's first segment
  sources from `$store.state.displayNames` (the user-renamed volume label shown everywhere else in
  the app), not the bare mount-path basename. New-UI's equivalent (`useFilesStore().displayNames`,
  a `{ [mountPath]: label }` map -- see `stores/files.ts`) lives in a Pinia store this component
  otherwise has no reason to depend on for a single string, so the caller
  (TimeMachineDepthStack.vue, which already reads that store for `viewMode`) resolves it and passes
  it down as this optional prop instead. Falls back to the bare mount-path basename when omitted or
  when the mount has no display-name override.

  Read-only/decorative contract (unchanged): aria-hidden, no click handlers of any kind.
  `pointer-events` is deliberately NOT set here -- that concern belongs to the parent
  (TimeMachineDepthStack.vue's `.tm-depth-strip`), which positions and layers up to ~10 of these
  instances as a group.

  Sort order mirrors the LIVE front window's own sort/order (`useFilesStore().sort/order`,
  src/files/stores/files.ts) via the shared comparator `../util/sortEntries.ts` -- exactly what
  Vue2's own `sortedRows` computed does by reading `$store.state.sort/order` directly, so every
  stacked depth-layer's row order matches what the real window is currently showing. `PreviewFile`'s
  field names differ from `FileEntry`'s (`isDir`/`mtime` vs `is_dir`/`date`), so entries are adapted
  to the shared `SortableEntry` shape before sorting, not literally identical objects.
-->
<template>
  <div class="tm-preview-window" :class="{ 'is-active': active }" aria-hidden="true">
    <!-- Row 1: hand-copied shape of Files.vue's own `.files-topbar-left` (breadcrumb + read-only
         chip) -- see this file's own header comment for why the breadcrumb is a static replica of
         Breadcrumb.vue's own markup/CSS rather than the live component. -->
    <header class="tm-preview-window__chrome">
      <nav class="tm-preview-window__crumbs">
        <template v-for="(seg, idx) in crumbSegments" :key="idx">
          <span v-if="idx > 0" class="tm-preview-window__crumb-sep" aria-hidden="true">›</span>
          <span
            class="tm-preview-window__crumb"
            :class="{ 'is-active': idx === crumbSegments.length - 1 }"
          >{{ seg }}</span>
        </template>
        <!-- Fix wave B (B2, owner acceptance 2026-08-26): the chip used to be a SIBLING of this
             <nav> inside `.tm-preview-window__chrome`, whose own `justify-content: space-between`
             plus this nav's `flex: 1 1 auto` pushed it to the far right of the chrome row --
             Vue2's own `.tm-snap-chip` sits immediately after `<file-breadcrumb>` in the SAME flex
             row (`margin-left: 10px`), not at the row's far end. Nesting it as the LAST child of
             THIS row (same flex-wrap row as the crumb segments) hugs it to the crumbs' actual
             rendered content instead, same fix as the real window's own Breadcrumb.vue slot. -->
        <span class="tm-preview-window__chip">{{ t('snapReadOnlyBanner') }}</span>
      </nav>
    </header>

    <!-- Row 2: total count + the real header affordances (Files.vue's own `.files-list-head` row
         -- Fix wave C toolbar redesign) -- a decorative, non-interactive circle select-all + count
         on the left, the grid/list capsule switcher on the right. Both are hand-copied at the SAME
         classes' literal dimensions as the real row (see this file's own header comment's
         "reuse-vs-clone" section for why hand-copying, not mounting the live component, is this
         file's established pattern) so a stacked preview layer reads as a genuine miniature of the
         real window, not an approximation. Fix wave D (D2): rendered UNCONDITIONALLY, matching
         `.files-list-head`'s own unconditional real render (Fix wave C) -- see this file's own
         header comment for why the stale `v-if="totalCount > 0"` (leftover pre-Fix-wave-C Vue2
         parity) was removed. The circle carries no `.on`/checked state -- this is a static backdrop
         layer with no selection concept of its own (Vue2's own source has none either), so it
         always renders in its plain unfilled ring form; the capsule DOES reflect the live
         `viewMode` prop, same as the real header's own `files.viewMode`-driven `.active` class. -->
    <div class="tm-preview-window__row2">
      <div class="tm-preview-window__select-zone">
        <span class="tm-preview-window__select-all" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4"><path d="M20 6 9 17l-5-5" /></svg>
        </span>
        <span class="tm-preview-window__count">{{ t('tmItemCount', { n: totalCount }) }}</span>
      </div>
      <div class="tm-preview-window__view-toggle" role="group" aria-hidden="true">
        <span class="tm-preview-window__toggle-btn" :class="{ 'is-active': viewMode === 'grid' }">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <rect x="3" y="3" width="7" height="7" rx="1.4" /><rect x="14" y="3" width="7" height="7" rx="1.4" />
            <rect x="3" y="14" width="7" height="7" rx="1.4" /><rect x="14" y="14" width="7" height="7" rx="1.4" />
          </svg>
        </span>
        <span class="tm-preview-window__toggle-btn" :class="{ 'is-active': viewMode === 'list' }">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M8 6h13M8 12h13M8 18h13" />
            <circle cx="4" cy="6" r="1.3" fill="currentColor" stroke="none" /><circle cx="4" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="4" cy="18" r="1.3" fill="currentColor" stroke="none" />
          </svg>
        </span>
      </div>
    </div>

    <!-- List mode: hand-copied shape of the real FileListView.vue/FileRow.vue at their own literal
         column widths -- see this file's own header comment for the full column-width trace. -->
    <div v-if="viewMode === 'list'" class="tm-preview-window__body tm-preview-window__list">
      <div class="tm-preview-window__thead">
        <span class="tm-preview-window__th tm-preview-window__th--check"></span>
        <span class="tm-preview-window__th tm-preview-window__th--name">{{ t('filesColName') }}</span>
        <span class="tm-preview-window__th tm-preview-window__th--type">{{ t('filesColType') }}</span>
        <span class="tm-preview-window__th tm-preview-window__th--date">{{ t('filesColDate') }}</span>
        <span class="tm-preview-window__th tm-preview-window__th--size">{{ t('filesColSize') }}</span>
        <span class="tm-preview-window__th tm-preview-window__th--star"></span>
      </div>
      <div class="tm-preview-window__tbody">
        <div v-for="row in rows" :key="row.name" class="tm-preview-window__row" :class="{ 'is-dir': row.isDir }">
          <span class="tm-preview-window__col--check"></span>
          <span class="tm-preview-window__icon-box">
            <img class="tm-preview-window__icon" :src="iconUrl(iconNameFor({ name: row.name, is_dir: row.isDir }))" alt="" />
          </span>
          <span class="tm-preview-window__col tm-preview-window__col--name">{{ row.name }}</span>
          <span class="tm-preview-window__col tm-preview-window__col--type">{{ row.isDir ? '' : fileExt(row.name) }}</span>
          <span class="tm-preview-window__col tm-preview-window__col--date">{{ dateFmt(row.mtime) }}</span>
          <span class="tm-preview-window__col tm-preview-window__col--size">{{ row.isDir ? '' : renderSize(row.size) }}</span>
          <span class="tm-preview-window__col--star"></span>
        </div>
      </div>
    </div>

    <!-- Grid mode (default): hand-copied shape of the real FileTile.vue at its own literal
         dimensions, laid out via the real FileGridView.vue's own CSS grid mechanism (auto-fill,
         no JS column math) -- see this file's own header comment. -->
    <div v-else class="tm-preview-window__body tm-preview-window__grid">
      <div v-for="row in rows" :key="row.name" class="tm-preview-window__card" :class="{ 'is-dir': row.isDir }">
        <span class="tm-preview-window__icon-box tm-preview-window__icon-box--tile">
          <img class="tm-preview-window__icon" :src="iconUrl(iconNameFor({ name: row.name, is_dir: row.isDir }))" alt="" />
        </span>
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
import { iconNameFor, iconUrl } from '../util/icons'
import { sortEntries } from '../util/sortEntries'
import { useFilesStore } from '../stores/files'

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
     *  browser's own view toggle reads (`useFilesStore().viewMode`). */
    viewMode?: 'grid' | 'list'
    /** The volume's user-facing display name (see this file's own header comment) -- when
     *  omitted, the breadcrumb falls back to the bare mount-path basename. */
    volumeLabel?: string
    /** Presentational class hook only (e.g. for the parent's own opacity/scale styling of
     *  near-vs-far depth-stack layers) -- Vue2 has no such prop at all; this component makes no
     *  fetch/render decision based on it, matching the "always fetch every mounted layer"
     *  behavior Vue2 itself has. */
    active?: boolean
  }>(),
  { viewMode: 'grid', active: true },
)

const { t } = useI18n()
const filesStore = useFilesStore()

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

// Mirrors the LIVE front window's own sort/order (useFilesStore) via the SAME shared comparator
// stores/files.ts's own sortedEntries delegates to (../util/sortEntries.ts). PreviewFile's field
// names (`isDir`/`mtime`) differ from the comparator's `SortableEntry` shape (`is_dir`/`date`), so
// each entry is adapted (not duplicated -- `...e` keeps every PreviewFile field the template still
// reads, `is_dir`/`date` are added purely for the comparator's own key functions).
const sortedRows = computed(() => {
  const adapted = entries.value.map((e) => ({ ...e, is_dir: e.isDir, date: new Date(e.mtime).toISOString() }))
  return sortEntries(adapted, filesStore.sort, filesStore.order)
})

// Vue2 parity: `rows` is capped at maxRows for render weight; `totalCount` (Row 2's label AND
// its own v-if gate) reads the FULL, uncapped length -- see this file's own header comment.
const rows = computed(() => sortedRows.value.slice(0, MAX_ROWS))
const totalCount = computed(() => sortedRows.value.length)

// Breadcrumb segments: [volumeLabel, '.snapshots', snapshotName, ...relPath segments], filtered of
// empty strings. `props.volumeLabel` takes priority; the mount-basename fallback below is what
// Vue2's own unit test suite exclusively exercises -- see this file's own header comment.
const mountBasename = computed(() => {
  if (!props.mount) return ''
  const parts = props.mount.split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : props.mount
})
const volumeSegment = computed(() => props.volumeLabel || mountBasename.value)
const crumbSegments = computed(() => {
  const relSegs = props.relPath ? props.relPath.split('/').filter(Boolean) : []
  return [volumeSegment.value, SNAPSHOTS_DIR_NAME, props.snapshotName, ...relSegs].filter(Boolean)
})
</script>

<style scoped>
/* No border-radius/border of its own -- TimeMachineDepthStack.vue's own `.tm-depth-strip` already
   carries the window chrome (radius + shadow). `background` stays an OPAQUE solid (Vue2 parity:
   its own inner `.tm-preview` uses a fully opaque background, not a translucent tint) so up to
   ~10 stacked layers each fully occlude the one behind them, matching a real window -- but per
   Fix wave B (B1, Ruling B-1, see this file's own header comment), the opaque solid follows
   New-UI's OWN theme (`--panel-bg-solid`, the global token) rather than TM chrome's fixed-white
   `--tm-panel-bg-solid`, and text color follows suit (`--fg`, not `--tm-text`) -- this is a real
   window's content, not TM chrome. */
.tm-preview-window {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  width: 100%;
  background: var(--panel-bg-solid);
  color: var(--fg);
}

/* Hand-copied shape of Files.vue's own `.files-topbar` -- see this file's own header comment for
   why there is no border-bottom (the real topbar has none) and why 12px is the vertical row's own
   `gap` (unrelated to horizontal padding, see below).
   Fix wave B (B2, owner acceptance 2026-08-26): dropped `justify-content: space-between` -- the
   chip is no longer this row's second child (see the template above, moved inside `.tm-preview-
   window__crumbs`), so it had nothing left to push apart; a single child growing to fill this row
   made that dead weight, not neutral.
   Fix wave E (E2, owner acceptance 2026-08-26, static-mismatch audit): padding was `8px 12px 10px`
   -- a literal that had quietly drifted from the real `.files-topbar`'s own `4px 0 14px` (ZERO
   horizontal, not 12px) ever since this file's A1 rebuild. That drift shifted this row's whole
   content -- crumbs included -- 12px right of where the real breadcrumb starts, and a hair off its
   real vertical baseline; not a font-SIZE bug (the crumb font-size below was already correct, see
   `.tm-preview-window__crumb`'s own comment), but exactly the kind of "content doesn't land on the
   same pixels" mismatch the owner's screenshot caught. Now `var(--tm-topbar-padding)`, the SAME
   token `.files-topbar` itself consumes (theme.css) -- the two literals cannot drift a fourth time. */
.tm-preview-window__chrome {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: var(--tm-topbar-padding);
}

/* Hand-copied literal values from Breadcrumb.vue's own `.breadcrumb`/`.crumb`/`.crumb-sep`/
   `.crumb.current` (see this file's own header comment for why the live component itself is not
   reused) -- font-size 14px, the real "›" separator, the real muted/active color split, all now
   `var(--tm-crumb-*)` tokens (theme.css) shared with Breadcrumb.vue's own `.breadcrumb`/`.crumb`/
   `.crumb-sep` (Fix wave E, E2) so the two can never drift on these values again.
   Fix wave B (B2): now also hosts the read-only chip as its own LAST child (see the template
   above) -- this row's own `flex: 1 1 auto` only widens ITS box within `.tm-preview-window__chrome`
   (irrelevant to child placement, since none of its children grow themselves); the chip still
   lands right after the last crumb, not at this row's far edge. */
.tm-preview-window__crumbs {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--tm-crumb-gap);
  overflow: hidden;
}

.tm-preview-window__crumb {
  font-size: var(--tm-crumb-font-size);
  color: var(--fg-muted);
  padding: var(--tm-crumb-padding);
  border-radius: 6px;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tm-preview-window__crumb.is-active {
  color: var(--fg);
  font-weight: 600;
}

.tm-preview-window__crumb-sep {
  flex: 0 0 auto;
  color: var(--fg-muted, #9aa4bf);
  font-size: var(--tm-crumb-sep-font-size);
}

/* Byte-identical to Files.vue's own `.tm-real-window-chip` (Vue2's literal `.tm-snap-chip`,
   color-mix off --tm-accent/--tm-accent-hover) -- already correct pre-audit (MATCH list: "chip
   colors (exact)"), colors unchanged by this fix wave.
   Fix wave B (B2, owner acceptance 2026-08-26): now the last child of `.tm-preview-window__crumbs`
   (see the template above), which already applies its own `gap: 4px` between every child; adding
   `margin-left: 6px` on top of that gap lands this chip exactly `4 + 6 = 10px` after the last
   crumb, matching Vue2's own `.tm-snap-chip { margin-left: 10px }` literal byte-for-byte -- same
   math as Files.vue's own `.tm-real-window-chip`. */
.tm-preview-window__chip {
  flex: 0 0 auto;
  margin-left: 6px;
  padding: 3px 10px;
  border-radius: 980px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  background: color-mix(in srgb, var(--tm-accent) 10%, transparent);
  color: var(--tm-accent-hover);
}

/* Fix wave E (E2, owner acceptance 2026-08-26, static-mismatch audit): this row used to have NO
   border-top and `padding: 0 12px 10px` -- the real `.files-list-head` has BOTH a `border-top`
   hairline AND `padding: 10px 2px` (theme.css's own `--tm-list-head-padding`, shared with the real
   rule now so the two can never drift again). Missing the hairline meant this replica's row2 had
   one fewer visible seam than the real header; the wrong padding put its own content (the count
   text/circle) at a different vertical position within the row than the real header's. `font-size`
   dropped from this container entirely (the real `.files-list-head` has none either -- only its
   own `.files-item-count` child sets a size, now `.tm-preview-window__count` below does the same
   via the shared `--tm-item-count-font-size` token). */
.tm-preview-window__row2 {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: var(--tm-list-head-padding);
  border-top: 1px solid var(--card-border, rgba(255,255,255,0.1));
  color: var(--fg-muted);
}

/* Fix wave C (toolbar redesign): row2 now mirrors the real header's OWN two zones -- see this
   file's own header comment (Row 2 section, updated for fix wave C). Hand-copied literal values
   from Files.vue's own `.files-select-zone`/`.files-select-all`/`.files-item-count`/
   `.files-view-capsule`/`.files-view-capsule-btn`. */
.tm-preview-window__select-zone {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Fix wave E (E2, owner acceptance 2026-08-26): this element used to have NO dedicated rule at
   all, silently inheriting `.tm-preview-window__row2`'s own (now-removed) `font-size: 13px` --
   the real `.files-item-count` is 12.5px (theme.css's own `--tm-item-count-font-size`, shared).
   0.5px is a small absolute delta, but it was a genuine, confirmed static mismatch (this replica's
   count text was actually LARGER than the real one's, not smaller) surfaced by this fix wave's own
   row-by-row audit -- fixed here rather than left as the one remaining un-pinned literal. */
.tm-preview-window__count {
  font-size: var(--tm-item-count-font-size);
}

/* Static/unfilled only (no `.on` state -- this preview has no selection concept of its own, see
   this file's own header comment above the template). Same 18px/2px-border geometry as the real
   `.files-select-all`, `color: var(--on-purple-accent)` kept for parity even though the check
   glyph never actually shows here (display:none via the real class's own `svg { display: none }`
   rule, inherited verbatim -- there is no `.on` variant to ever reveal it). Fix wave C re-review:
   re-pointed from `--on-accent` to `--on-purple-accent`, following the real `.files-select-all`'s
   own re-point onto the dedicated purple pair (theme.css) -- see Files.vue's own comment on that
   rule for the full reasoning. */
.tm-preview-window__select-all {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--chip-border, rgba(255, 255, 255, 0.12));
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--on-purple-accent);
}

.tm-preview-window__select-all svg {
  width: 11px;
  height: 11px;
  display: none;
}

.tm-preview-window__view-toggle {
  display: inline-flex;
  border: 1px solid var(--chip-border, rgba(255, 255, 255, 0.12));
  border-radius: 999px;
  overflow: hidden;
  background: var(--chip-bg, rgba(255, 255, 255, 0.05));
}

.tm-preview-window__toggle-btn {
  display: inline-flex;
  align-items: center;
  padding: 6px 16px;
  color: var(--fg-muted, #9aa4bf);
}

.tm-preview-window__toggle-btn svg {
  width: 15px;
  height: 15px;
}

/* Fix wave C re-review: re-pointed from --accent/--on-accent to the dedicated purple pair,
   following the real `.files-view-capsule-btn.active`'s own re-point -- see Files.vue's own
   comment on that rule. */
.tm-preview-window__toggle-btn.is-active {
  background: var(--purple-accent);
  color: var(--on-purple-accent);
}

.tm-preview-window__body {
  flex: 1 1 auto;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Hand-copied literal values from FileListView.vue's own `.file-listhead`/`.head-cell`/
   `.col-*` -- widths match the row columns below exactly (audit fix target 9). This is the one
   place in this component that keeps its real hairline: FileListView.vue's own header genuinely
   has one. */
.tm-preview-window__thead {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  font-size: 12px;
  color: var(--fg-muted, #9aa4bf);
  border-bottom: 1px solid var(--card-border, rgba(255, 255, 255, 0.08));
}

.tm-preview-window__th--check { flex: 0 0 28px; }
/* Real FileListView.vue quirk, reproduced verbatim: the header has no separate icon column (only
   rows do), so its name header gets a 40px left margin instead to land under where the icon sits
   in the row below (28px icon + 12px gap ≈ 40px). */
.tm-preview-window__th--name { flex: 1 1 auto; margin-left: 40px; }
.tm-preview-window__th--type { flex: 0 0 48px; }
.tm-preview-window__th--date { flex: 0 0 160px; }
.tm-preview-window__th--size { flex: 0 0 80px; text-align: right; }
.tm-preview-window__th--star { flex: 0 0 32px; }

.tm-preview-window__tbody {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Hand-copied literal values from FileRow.vue's own `.file-row` -- real gap/padding/radius, real
   14px name / 12px muted metadata columns. Interactive-only decorations (checkbox, favorite star)
   are dropped per this file's own header comment; their columns stay as empty 28px/32px spacers
   so the remaining columns land at the real positions. */
.tm-preview-window__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 14px;
}

.tm-preview-window__col--check { flex: 0 0 28px; }
.tm-preview-window__col--star { flex: 0 0 32px; }

.tm-preview-window__col--name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tm-preview-window__col--type {
  flex: 0 0 48px;
  font-size: 12px;
  color: var(--fg-muted, #9aa4bf);
  text-transform: uppercase;
}

.tm-preview-window__col--date {
  flex: 0 0 160px;
  font-size: 12px;
  color: var(--fg-muted, #9aa4bf);
}

.tm-preview-window__col--size {
  flex: 0 0 80px;
  font-size: 12px;
  color: var(--fg-muted, #9aa4bf);
  text-align: right;
}

/* Hand-copied literal value from FileGridView.vue's own `.file-grid` -- CSS auto-fill handles
   responsive column count with no JS measurement at all (audit fix target 8); the grid's own
   internal gap (14px) is FileGridView.vue's own literal value.
   Fix wave B (B3a, owner acceptance 2026-08-26): horizontal padding dropped to 0 -- controller
   diagnosis named the real window's sidebar as the width-basis mismatch, but tracing the actual
   CSS chain (TimeMachineStage.vue's `.tm-fwin--active`/`.tm-stage__hold--active`, both `position:
   fixed`/`absolute` escaping `.files-layout`'s sidebar+padding entirely while Time Machine is
   active) shows the real window's OWN grid, once active, is edge-to-edge: `.files-topbar`
   (`padding: 4px 0 14px`, zero horizontal) down to FileGridView.vue's own `.file-grid-root`/
   `.file-grid` (NO padding anywhere) -- the real cause was this preview's OWN 12px horizontal
   container padding, absent from the real chain, shrinking `auto-fill`'s available width by 24px
   (12px each side) and landing a DIFFERENT column count near breakpoints (audit fix target 8's own
   "reuse FileGridView's layout mechanism" intent, followed one step further: reuse its geometry
   too, not just its `auto-fill` MECHANISM). See
   .superpowers/sdd/2026-08-25-files-time-machine-vue2-parity/final-fix-report.md ("Fix wave B",
   B3a) for the full trace and why option (a) (a fake sidebar clone) was rejected: neither Vue2's
   own authority nor the real New-UI window has a sidebar inside the Time Machine window at all.
   Fix wave E (E2, owner acceptance 2026-08-26, static-mismatch audit): B3a's own "vertical padding
   kept for breathing room from Row 2" reasoning is RETIRED here -- the real `.file-grid`/
   `.file-grid-root` chain has NO vertical padding either (row2's own bottom padding, now
   `var(--tm-list-head-padding)`, is the ONLY gap before the first real row/tile), so this
   replica's extra `12px` top padding pushed its own first row/tile 12px lower than the real
   window's, on top of `.tm-preview-window__row2`'s own bottom padding -- a second, independent
   vertical-offset mismatch this fix wave's row-by-row audit caught. `padding: 0` now matches the
   real chain exactly; `gap`/`grid-template-columns` (the actual column-count-affecting geometry
   B3a fixed) are unchanged. */
.tm-preview-window__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 14px;
  padding: 0;
  align-content: start;
  overflow: hidden;
}

/* Hand-copied literal values from FileTile.vue's own `.file-tile` -- real 14px/8px padding, real
   16px radius, real 6px icon-to-label gap. Interactive-only decorations (checkbox, favorite star,
   upload badge/spinner) are dropped per this file's own header comment -- none of them affect
   layout (all `position: absolute`), so omitting them changes nothing else here. */
.tm-preview-window__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 8px;
  border-radius: 16px;
}

/* Real icon-box sizing: 28px (list, FileRow.vue's own `.file-icon`) vs `--app-size`/64px (grid,
   FileTile.vue's own `.tile-icon`, the same theme token FileTile.vue itself reads) -- shape
   hand-copied from FileThumb.vue's own `.file-thumb`/`.thumb-icon` (its static-icon branch; see
   this file's own header comment for why the live thumbnail branch is never reused). */
.tm-preview-window__icon-box {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  width: 28px;
  height: 28px;
}

.tm-preview-window__icon-box--tile {
  width: var(--app-size, 64px);
  height: var(--app-size, 64px);
}

.tm-preview-window__icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* Real FileTile.vue title is a SINGLE-line ellipsis at 13px -- NOT Vue2's 2-line clamp at 14px
   (audit fix target 6 named the Vue2 number; the controller ruling's own instruction is to mirror
   New-UI's real component, and New-UI's real FileTile.vue title is genuinely single-line). */
.tm-preview-window__title {
  margin: 0;
  max-width: 100%;
  min-width: 0;
  font-size: 13px;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tm-preview-window__desc {
  margin: 0;
  font-size: 11px;
  color: var(--fg-muted, #9aa4bf);
}
</style>
