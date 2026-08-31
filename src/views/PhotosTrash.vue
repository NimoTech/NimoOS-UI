<script setup lang="ts">
// Trash view — its own hand-rolled bucketed grid (doesn't reuse PhotosGrid: trash
// data is the slimmed-down TrashPhoto, and the countdown badge is unique UI the grid doesn't have).
//
// The transitional AreaShell/.photos-layout shell has been swapped for
// Photos.vue/PhotosFavorites.vue's own `.photos-root > .app[data-collapsed] > PhotosSidebar +
// main.main > PhotosTopbar + .photos-main` structure (useSidebarCollapse shared singleton), and
// the hero/tile/multi-select/bulk-bar/confirm-modal classes were renamed to their parity anchors
// (`.lib-hero`/`.trash-tile-check`/`.trash-countdown`/`.trash-bulk-bar`/`.trash-modal*`). The
// topbar's Ask Nimo button is wired to the real drawer entry (`show-ask-nimo` +
// `@ask-nimo="useAskNimo().openDrawer()"`), same as PhotosFavorites.vue.
//
// Task 9 (Plan H): superseded the P3 placeholder above -- Vue2 PhotosTrashView.vue actually does
// wire a lightbox (onTileClick :211-216), so this view now mounts one too. A plain tile click
// with nothing selected opens it against the bucketed flat list; once anything is selected,
// every further click toggles selection instead. Inside the lightbox, "delete" is remapped to
// permanent purge (the asset is already soft-deleted) and favorite/add-to-album are no-ops --
// see onLightboxDelete below.
//
// The selected state uses Set<string|number>, compared by id value (not object reference) — Vue3's
// ref() has dedicated reactivity hooks for Set/Map (collection handlers), so calling
// .add()/.delete() directly triggers view updates; there's no need for the Vue2 workaround of
// "replace the whole new Set()".
import '../photos/styles/vue2-parity'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import { useSidebarCollapse } from '../photos/composables/useSidebarCollapse'
import { useAskNimo } from '../photos/composables/useAskNimo'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosTopbar from '../photos/components/PhotosTopbar.vue'
import PhotosIcon from '../photos/components/PhotosIcon.vue'
import { usePhotosTrash } from '../photos/stores/trash'
import { useToast } from '../stores/toast'
import type { TrashPhoto } from '../photos/util/trashAssetToPhoto'
import AskNimoHost from '../photos/components/asknimo/AskNimoHost.vue'
import { useLightbox } from '../photos/lightbox/useLightbox'
import PhotoLightbox from '../photos/lightbox/PhotoLightbox.vue'

const { t } = useI18n()
const { themeClass } = usePhotosTheme()
const { collapsed, toggle: onToggleCollapse } = useSidebarCollapse()
const trash = usePhotosTrash()
const toast = useToast()
const lb = useLightbox()

// Bucket constants, following Vue2 PhotosTrashView.vue:126-131 (4 buckets, min/max/tone). tone is
// just a semantic label — the actual color is mapped to an existing token in the style block
// (urgent -> --remove-fg danger tone, warn -> --dem-fg warning tone, normal -> --accent regular
// accent tone), no new token is introduced.
type BucketTone = 'urgent' | 'warn' | 'normal'
interface BucketDef { id: string; titleKey: string; descKey: string; min: number; max: number; tone: BucketTone }

const BUCKETS: BucketDef[] = [
  { id: 'urgent', titleKey: 'photosTrashBucketUrgent', descKey: 'photosTrashBucketUrgentDesc', min: 1, max: 7, tone: 'urgent' },
  { id: 'soon', titleKey: 'photosTrashBucketSoon', descKey: 'photosTrashBucketSoonDesc', min: 8, max: 14, tone: 'warn' },
  { id: 'later', titleKey: 'photosTrashBucketLater', descKey: 'photosTrashBucketLaterDesc', min: 15, max: 21, tone: 'normal' },
  { id: 'fresh', titleKey: 'photosTrashBucketFresh', descKey: 'photosTrashBucketFreshDesc', min: 22, max: Infinity, tone: 'normal' },
]

const filter = ref<'all' | 'photo' | 'video'>('all')
const sort = ref<'daysleft' | 'recent'>('daysleft')
const selected = ref<Set<string | number>>(new Set())

interface ConfirmState { title: string; body: string; ctaLabel: string; danger: boolean; onConfirm: () => void | Promise<void> }
const confirm = ref<ConfirmState | null>(null)

// Not put into reactive state (same reasoning as Vue2's this._undoIds: it's purely a "pending undo
// id list" stash, no need to drive rendering).
let undoIds: Array<string | number> | null = null

const isEmpty = computed(() => trash.loaded && trash.items.length === 0)
const photoCount = computed(() => trash.items.filter((p) => !p.isVideo).length)
const videoCount = computed(() => trash.items.filter((p) => p.isVideo).length)
// Delete-chain diagnosis follow-up: Vue2 PhotosTrashView.vue:180 sums
// `Number(p.sizeMb) || 4.2` per item, not `|| 0` -- a per-item literal placeholder that kicks in
// whenever the real computed sizeMb is falsy (0, NaN, absent). trashAssetToPhoto's own mapping
// of `asset.fileSize` was checked end to end (field name matches the backend's `fileSize` JSON
// tag, unit conversion is correct bytes->MB) and is NOT the bug -- the reported discrepancy
// ("0.0 MB" here vs Vue2's "4.2 MB" for the same photo) is explained entirely
// by this Vue2-side fallback constant papering over an item whose real fileSize is genuinely
// zero. Vue2 is authority, so this reproduces its exact (if slightly odd) arithmetic rather than
// "fixing" it to a more honest 0 -- that would diverge further from Vue2, not less. Only this
// hero aggregate carries the `|| 4.2` fallback in Vue2; the bulk-delete/lightbox-delete per-item
// sums below (deleteSelected/onLightboxDelete) use `Number(p.sizeMb || 0)` with no such fallback,
// matching Vue2's own deleteSelected (:233-235) exactly -- left unchanged.
const totalSize = computed(() => trash.items.reduce((s, p) => s + (Number(p.sizeMb) || 4.2), 0).toFixed(1))

// Vue2 :68 conditionally singularizes the bucket-subtitle item count
// (`b.photos.length !== 1 ? $t('items') : $t('item')`) -- the previous unconditional
// `photosItemsCount` call always rendered the plural form even for a single item ("1 items"),
// which is the reported symptom.
function bucketItemsLabel(count: number): string {
  return count === 1 ? t('photosItemSingular', { count }) : t('photosItemsCount', { count })
}

const filtered = computed(() => {
  if (filter.value === 'photo') return trash.items.filter((p) => !p.isVideo)
  if (filter.value === 'video') return trash.items.filter((p) => p.isVideo)
  return trash.items
})

const sorted = computed(() => {
  const arr = [...filtered.value]
  if (sort.value === 'daysleft') arr.sort((a, b) => a.daysLeft - b.daysLeft)
  else arr.sort((a, b) => b.daysLeft - a.daysLeft)
  return arr
})

const bucketed = computed(() =>
  BUCKETS.map((b) => ({
    ...b,
    title: t(b.titleKey),
    desc: t(b.descKey),
    photos: sorted.value.filter((p) => p.daysLeft >= b.min && p.daysLeft <= b.max),
  })).filter((b) => b.photos.length > 0),
)

function thumbUrl(id: string | number): string {
  return service.photos.thumbnailUrl(id, 'small')
}

function isSelected(id: string | number): boolean {
  return selected.value.has(id)
}
function toggleSelect(id: string | number) {
  if (selected.value.has(id)) selected.value.delete(id)
  else selected.value.add(id)
}
function clearSelection() { selected.value.clear() }

// Task 9 (review fix): matches Vue2 PhotosTrashView.vue onTileClick(:211-216, template :72
// passes $event) -- a plain click with no active selection opens the lightbox against the
// bucketed flat list; once anything is selected, OR the click is shift-held (starts multi-select
// even from zero), every further click toggles selection instead of opening the viewer.
function onTileClick(p: TrashPhoto, e: MouseEvent): void {
  if (e.shiftKey || selected.value.size > 0) { toggleSelect(p.id); return }
  const flat = bucketed.value.flatMap((b) => b.photos)
  lb.openAt(p, flat, 0)
}

// Task 9: "delete" from inside the trash lightbox means permanent purge -- the asset is
// already soft-deleted. add-to-album makes no product sense on a trashed asset either, so
// both are deliberate no-ops, same convention as Photos.vue's unused @toggle-fav.
//
// Delete-chain diagnosis: trash.purge() now resolves to the ACTUAL
// success count (see trash.ts), not a fire-and-forget void -- a single-item purge only has
// two possible outcomes (1 or 0), so this checks that instead of unconditionally showing the
// success toast regardless of whether the backend actually purged anything.
async function onLightboxDelete(id: string | number): Promise<void> {
  const p = trash.items.find((x) => x.id === id)
  const size = p ? Number(p.sizeMb) || 0 : 0
  const successCount = await trash.purge([id])
  if (successCount > 0) {
    toast.show(t('photosTrashPurgedToast', { count: 1, size: size.toFixed(1) }), 4500)
  } else {
    toast.show(t('photosTrashDeleteFailed'), 4500)
  }
}

function askConfirm(cfg: ConfirmState) { confirm.value = cfg }
function closeConfirm() { confirm.value = null }
function runConfirm() {
  const c = confirm.value
  confirm.value = null
  if (c) void c.onConfirm()
}
function onKeydown(e: KeyboardEvent) {
  if (confirm.value && e.key === 'Escape') { e.preventDefault(); closeConfirm() }
}

async function onUndo() {
  const ids = undoIds
  undoIds = null
  if (!ids || !ids.length) return
  await trash.undoRestore(ids)
}

// Task 12: service.photos.emptyTrash() and
// restoreAllTrash() both act on the ENTIRE trash server-side regardless of what has loaded
// client-side. With more than TRASH_PAGE_SIZE items — the exact case Task 12 exists for —
// the confirm dialogs understated what would actually happen, and restore-all's Undo
// silently reverted only the loaded subset while the rest stayed restored with no path back.
// Page in everything before either bulk action decides what to say / which ids the (optional)
// undo covers — same shape as loadRemainingFavoritesForSave in PhotosFavorites.vue: progress
// is detected by list-length growth, so a stuck page (e.g. a network failure mid-page) is
// caught without the store exposing its private offset.
async function loadRemainingTrashForBulkAction(): Promise<void> {
  while (!trash.trashExhausted) {
    const before = trash.items.length
    await trash.loadMoreTrash()
    const after = trash.items.length
    if (after === before) return // stuck: the page failed, stop spinning
  }
}

// Guards both hero actions (not the store's own loadMoreTrash ownership) so the button isn't
// a dead click during the paging-in-the-rest step above, and so the two bulk actions can't
// race each other.
const preparingBulkAction = ref(false)

// Restore selected: Vue2 has no second confirmation, executes directly (restoreSelected :190) —
// this view likewise skips the confirm step.
async function restoreSelected() {
  const ids = [...selected.value]
  if (!ids.length) return
  clearSelection()
  try {
    await trash.restore(ids)
    undoIds = ids
    toast.show(t('photosTrashRestoredToast', { count: ids.length }), 4500, {
      label: t('photosTrashUndo'),
      onClick: onUndo,
    })
  } catch {
    toast.show(t('photosTrashRestoreFailed'), 4500)
  }
}

function deleteSelected() {
  const ids = [...selected.value]
  const count = ids.length
  if (!count) return
  const size = ids
    .reduce<number>((s, id) => {
      const p = trash.items.find((x) => x.id === id)
      return s + (p ? Number(p.sizeMb) || 0 : 0)
    }, 0)
    .toFixed(1)
  askConfirm({
    title: t('photosTrashDeleteSelTitle', { count }),
    body: t('photosTrashDeleteSelBody'),
    ctaLabel: t('photosTrashDeleteForever'),
    danger: true,
    onConfirm: async () => {
      clearSelection()
      undoIds = null
      // Delete-chain diagnosis: trash.purge() now resolves to the
      // ACTUAL per-item success count (Promise.allSettled internally), not a fire-and-forget
      // void that always "succeeded" regardless of how many purgeTrash() calls actually
      // failed. The toast must reflect that honestly: full success keeps the existing exact
      // wording, a partial result says so instead of quoting the original click-time count as
      // if every item made it, and zero success is an error, not a success toast. purge()
      // itself never rejects (its own errors are caught per-item), but the try/catch stays as
      // a defensive fallback in case that ever changes.
      try {
        const successCount = await trash.purge(ids)
        if (successCount === count) {
          toast.show(t('photosTrashPurgedToast', { count, size }), 4500)
        } else if (successCount > 0) {
          toast.show(t('photosTrashPurgedPartialToast', { ok: successCount, fail: count - successCount }), 4500)
        } else {
          toast.show(t('photosTrashDeleteFailed'), 4500)
        }
      } catch {
        toast.show(t('photosTrashDeleteFailed'), 4500)
      }
    },
  })
}

async function restoreAll() {
  if (!trash.items.length || preparingBulkAction.value) return
  preparingBulkAction.value = true
  try {
    if (!trash.trashExhausted) await loadRemainingTrashForBulkAction()
    // Captured AFTER the paging attempt (not before), so the confirm title, the ids handed to
    // Undo, and the success toast all agree with what actually happened rather than with the
    // state at click time.
    const exact = trash.trashExhausted
    const count = trash.items.length
    askConfirm({
      // Task 12: when paging got stuck we still do not know the true count, so
      // the title must not quote one — reuse the bare action-label key already on the hero
      // button (no fitting count-less title existed, so this avoids inventing new copy).
      title: exact ? t('photosTrashRestoreAllTitle', { count }) : t('photosTrashRestoreAll'),
      body: t('photosTrashRestoreAllBody'),
      ctaLabel: t('photosTrashRestoreAll'),
      danger: false,
      onConfirm: async () => {
        const ids = trash.items.map((p) => p.id)
        try {
          await trash.restoreAll()
          if (exact) {
            undoIds = ids
            toast.show(t('photosTrashRestoredToast', { count }), 4500, {
              label: t('photosTrashUndo'),
              onClick: onUndo,
            })
          } else {
            // Task 12: restoreAllTrash() restores EVERYTHING
            // server-side regardless of what loaded client-side. If paging got stuck, `ids`
            // here is only a subset — offering Undo would let the user silently revert part
            // of what was restored while the rest stays restored with no path back. Omit the
            // Undo action entirely rather than offer one known to be partial.
            undoIds = null
            toast.show(t('photosTrashRestoredToast', { count }), 4500)
          }
        } catch {
          toast.show(t('photosTrashRestoreFailed'), 4500)
        }
      },
    })
  } finally {
    preparingBulkAction.value = false
  }
}

async function emptyTrash() {
  if (!trash.items.length || preparingBulkAction.value) return
  preparingBulkAction.value = true
  try {
    if (!trash.trashExhausted) await loadRemainingTrashForBulkAction()
    // Captured AFTER the paging attempt (not before) — this is what keeps the confirm body
    // and the toast in agreement with what actually happened.
    const exact = trash.trashExhausted
    const count = trash.items.length
    const size = totalSize.value
    askConfirm({
      // Task 12: same reasoning as restoreAll's title above.
      title: exact ? t('photosTrashEmptyTitle2', { count }) : t('photosTrashEmpty'),
      body: exact ? t('photosTrashEmptyBody', { size }) : t('photosTrashEmptyBodyPartial'),
      ctaLabel: t('photosTrashEmpty'),
      danger: true,
      onConfirm: async () => {
        undoIds = null
        try {
          await trash.empty()
          toast.show(exact ? t('photosTrashEmptiedToast', { size }) : t('photosTrashEmptiedToastPartial'), 4500)
        } catch {
          toast.show(t('photosTrashEmptyFailed'), 4500)
        }
      },
    })
  } finally {
    preparingBulkAction.value = false
  }
}

onMounted(() => {
  void trash.fetchRetention()
  void trash.fetchTrash()
  document.addEventListener('keydown', onKeydown)
})
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="photos-root" :class="themeClass">
    <div class="app" :data-collapsed="collapsed">
      <PhotosSidebar :collapsed="collapsed" />
      <main class="main">
        <!-- `sub` was left unbound before, so the topbar fell
             back to its default library-wide photo/video count -- wrong for this view. Matches
             Vue2 PhotosTimeline.vue:231 navMap.trash ('{count} items · auto-deletes in 30
             days'), except {days} reads the live trash.retentionDays (fetched via
             trash.fetchRetention() below) rather than Vue2's hardcoded 30 -- ruled. -->
        <PhotosTopbar
          :collapsed="collapsed" :title="t('photosTrashTitle')"
          :sub="t('photosTrashSubtitle', { count: trash.items.length, days: trash.retentionDays })"
          :show-search="false"
          show-ask-nimo
          @toggle-collapse="onToggleCollapse"
          @ask-nimo="useAskNimo().openDrawer()"
        />
        <div class="photos-main">
          <!-- Task 8 (Plan H re-shell): hero follows Vue2 PhotosTrashView.vue:4-23's `.lib-hero`
               (parity photos.scss ~1231-1267), matching PhotosFavorites.vue's own `.lib-hero`
               re-shell precedent. `data-tint="warn"` only sits on `.lib-hero-icon` (Vue2 :5's
               only tint usage, selects parity's red-tinted circle background, photos.scss:1248)
               -- `.lib-hero` itself never carried it in Vue2 or in parity CSS, dead weight,
               dropped (same cleanup PhotosFavorites.vue already did). The icon glyph itself has
               no parity color rule (same gap as Favorites' `.fav-hero-star-icon`), so
               `.trash-danger-icon` below supplies Vue2's own explicit `color="#FF6B5C"` (:6). -->
          <div class="lib-hero">
            <div class="lib-hero-icon" data-tint="warn">
              <PhotosIcon name="trash" :size="22" class="trash-danger-icon" />
            </div>
            <div style="flex:1">
              <h1 class="lib-hero-title">{{ t('photosTrashTitle') }}</h1>
              <div class="lib-hero-sub">
                <b>{{ trash.items.length }}</b> {{ t('photosTrashItems') }} ·
                {{ t('photosCountSummary', { photos: photoCount, videos: videoCount }) }} ·
                <b>{{ totalSize }} MB</b> {{ t('photosTrashCanFree') }}
                <!-- Task 12: totalSize sums sizeMb over trash.items, which is only the
                     pages fetched so far while pagination is still catching up — say so out loud
                     instead of silently under-reporting (same pattern as PhotosFavorites.vue). -->
                <span v-if="!trash.trashExhausted" data-test="trash-loaded-hint">
                  · {{ t('photosLoadedSubsetHint', { n: trash.items.length }) }}
                </span>
              </div>
            </div>
            <div class="lib-hero-actions">
              <!-- R-6: guard keeps both halves of the expression (not just the length check) so
                   the button isn't a dead click during the paging-in-the-rest step in
                   restoreAll/emptyTrash below, and so the two bulk actions can't race each other.
                   Leading icons restored per Vue2 :17/:20 (upload/trash, size 13). -->
              <button type="button" class="btn" data-test="trash-restore-all" :disabled="!trash.items.length || preparingBulkAction" @click="restoreAll"><PhotosIcon name="upload" :size="13" /> {{ t('photosTrashRestoreAll') }}</button>
              <button type="button" class="btn trash-btn-danger" data-test="trash-empty-btn" :disabled="!trash.items.length || preparingBulkAction" @click="emptyTrash"><PhotosIcon name="trash" :size="13" class="trash-danger-icon" /> {{ t('photosTrashEmpty') }}</button>
            </div>
          </div>

          <div v-if="isEmpty" class="empty-state" data-test="trash-empty">
            <div class="empty-state-title">{{ t('photosTrashEmptyTitle') }}</div>
            <div class="empty-state-desc">{{ t('photosTrashEmptyHint', { days: trash.retentionDays }) }}</div>
          </div>

          <template v-else>
            <!-- Leading icons restored per Vue2 :37-39 (upload/trash/x, size 11, default
                 currentColor -- the danger button's red only shows on hover via parity's own
                 `.trash-bulk-bar button[data-danger="true"]:hover` rule, same as Vue2). -->
            <div v-if="selected.size > 0" class="trash-bulk-bar">
              <span class="ct">{{ t('photosTrashSelectedCount', { count: selected.size }) }}</span>
              <span class="spacer"></span>
              <button type="button" data-test="trash-bulk-restore" @click="restoreSelected"><PhotosIcon name="upload" :size="11" /> {{ t('photosTrashRestore') }}</button>
              <button type="button" data-danger="true" data-test="trash-bulk-delete" @click="deleteSelected"><PhotosIcon name="trash" :size="11" /> {{ t('photosTrashDeleteForever') }}</button>
              <button type="button" data-test="trash-bulk-cancel" @click="clearSelection"><PhotosIcon name="x" :size="11" /> {{ t('photosCancel') }}</button>
            </div>

            <!-- Renamed to parity's own `.lib-filters`/`.lib-chip`/
                 `.lib-sort` anchors (photos.scss:1294-1327) -- this page's own bespoke
                 `.trash-filters`/`.trash-chip`/`.trash-sort` rules are deleted below now that
                 the template uses parity's exact selectors, same convention as the
                 `.lib-hero`/`.lib-tile` classes above. `.trash-filters-spacer` stays page-local
                 (Vue2 uses an inline `style="flex:1"` div here, not a class, so parity has
                 nothing to rename it to). Leading chip icons restored per Vue2 :48/:51
                 (album/video, size 11) -- the "All" chip has no leading icon in Vue2 either,
                 left as-is. -->
            <div class="lib-filters">
              <button type="button" class="lib-chip" :data-active="filter === 'all'" @click="filter = 'all'">
                {{ t('photosTabAll') }} <span class="ct">{{ trash.items.length }}</span>
              </button>
              <button type="button" class="lib-chip" :data-active="filter === 'photo'" @click="filter = 'photo'">
                <PhotosIcon name="album" :size="11" /> {{ t('photosTabPhotos') }} <span class="ct">{{ photoCount }}</span>
              </button>
              <button type="button" class="lib-chip" :data-active="filter === 'video'" @click="filter = 'video'">
                <PhotosIcon name="video" :size="11" /> {{ t('photosTabVideos') }} <span class="ct">{{ videoCount }}</span>
              </button>
              <div class="trash-filters-spacer"></div>
              <!-- Vue2 :55 puts a leading `.lib-sort-label` span
                   ($t('Sort')) before the two sort buttons -- this was missing entirely,
                   leaving parity's own `.lib-sort-label` rule (photos.scss) unused. -->
              <div class="lib-sort">
                <span class="lib-sort-label">{{ t('photosTrashSort') }}</span>
                <button type="button" :data-active="sort === 'daysleft'" @click="sort = 'daysleft'">
                  {{ t('photosTrashSortDaysLeft') }}
                </button>
                <button type="button" :data-active="sort === 'recent'" @click="sort = 'recent'">
                  {{ t('photosTrashSortRecent') }}
                </button>
              </div>
            </div>

            <div class="trash-scroll scroll">
              <!-- Vue2 :63-70 reuses the archive view's own
                   `.arc-section*` classes (shared parity anchors, photos.scss ~1690-1725) for
                   the bucket header, not a page-local reinvention -- switched to match, which
                   also fixes the missing/wrong-colored separator rule (parity's own
                   `.arc-section-head` already carries `border-bottom: 1px solid var(--line)`,
                   the photos-local divider token Vue2 effectively gets "for free" through this
                   class, vs. the page-local `.trash-bucket-head` rule this replaces, which used
                   the *global* `--divider` token instead -- wrong shade in this photos-private
                   scope, see PlaceDetailPanel.vue's shadowing-cleanup precedent for the same
                   class of bug). The grid wrapper is renamed `.trash-grid` -> `.lib-grid` +
                   Vue2's own inline `style="margin-top:14px"` (:70) for the same reason --
                   parity's `.lib-grid` rule is byte-identical to the page-local rule it
                   replaces. `.arc-section-head`'s own `margin-top: 24px` applies unconditionally
                   to every bucket including the first (matching Vue2, which has no first-child
                   exception either) -- the page's own `.trash-bucket:first-child { margin-top:
                   0 }` override is dropped as a New-UI-only deviation. -->
              <div v-for="b in bucketed" :key="b.id" class="arc-section">
                <div class="arc-section-head">
                  <span class="arc-section-dot" :data-tone="b.tone"></span>
                  <span class="arc-section-title">{{ b.title }}</span>
                  <!-- Vue2 :68 conditionally singularizes this word
                       (`b.photos.length !== 1 ? $t('items') : $t('item')`) -- the previous
                       `photosItemsCount` call always rendered the plural form ("1 items"),
                       which is the reported symptom. bucketItemsLabel() below
                       reproduces the same singular/plural branch. -->
                  <span class="arc-section-sub">{{ bucketItemsLabel(b.photos.length) }} · {{ b.desc }}</span>
                </div>
                <div class="lib-grid" style="margin-top:14px">
                  <div
                    v-for="p in b.photos" :key="p.id"
                    class="lib-tile trash-tile" :data-selected="isSelected(p.id)"
                    @click="onTileClick(p, $event)"
                  >
                    <!-- pixel parity: Vue2 PhotosTrashView.vue:73 dims the thumbnail via an
                         inline style (not a class), 0.78 opacity -- kept as an inline style
                         here too rather than folded into a scoped `.trash-tile img` rule. -->
                    <img :src="thumbUrl(p.id)" alt="" loading="lazy" :style="{ opacity: 0.78 }">
                    <div class="lib-tile-overlay"></div>
                    <div
                      class="trash-countdown"
                      :data-urgent="p.daysLeft <= 7" :data-warn="p.daysLeft > 7 && p.daysLeft <= 14"
                    ><PhotosIcon name="clock" :size="10" /> {{ t('photosTrashDaysLeft', { days: p.daysLeft }) }}</div>
                    <div
                      class="trash-tile-check" :data-selected="isSelected(p.id)"
                      @click.stop="toggleSelect(p.id)"
                    >
                      <PhotosIcon name="check" :size="12" :stroke-width="2.4" />
                    </div>
                    <div class="lib-tile-meta">
                      <span class="lib-tile-place">{{ t('photosTrashFrom', { source: p.from }) }}{{ p.deletedAt ? ' · ' + p.deletedAt : '' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Task 12: the backend caps a single request at 500 rows now
                 (NimoOS-Photos#54), so anything past the first page only shows up once clicked. -->
            <div v-if="!trash.trashExhausted" class="trash-load-more">
              <button
                type="button"
                class="btn"
                data-test="trash-load-more"
                :disabled="trash.loadingMore"
                @click="trash.loadMoreTrash()"
              >{{ t('photosLoadMore') }}</button>
            </div>
          </template>
        </div>
      </main>
    </div>

    <!-- R-1 (the other half of F-09, previously left open): the confirm scrim+transition and
         AskNimoHost both belong INSIDE .photos-root, as siblings of .app -- NOT after
         .photos-root's own closing tag. Photos-private tokens (--surface-2/--text-1/--line etc.)
         are declared on .photos-root with no global fallback (see Photos.vue's same-shaped
         incident record); anything left outside it renders with blank/unresolved colors, on top
         of failing the overlay-subtree rule this very task is supposed to honor. -->
    <transition name="trash-modal">
      <div v-if="confirm" class="trash-modal-scrim" @click.self="closeConfirm">
        <div class="trash-modal" :data-danger="confirm.danger">
          <!-- Task 8 review fix: Vue2 :100-102 uses 'upload' (not 'refresh') for the
               non-danger/restore case, :size="22" (not 20), with explicit state colors
               (non-danger #5e94ff, danger #FF6B5C) -- fixed via the wrapper's `color`
               (.trash-modal-icon rule below), inherited by the glyph's `currentColor` stroke. -->
          <div class="trash-modal-icon">
            <PhotosIcon :name="confirm.danger ? 'trash' : 'upload'" :size="22" />
          </div>
          <div class="trash-modal-title">{{ confirm.title }}</div>
          <div class="trash-modal-body">{{ confirm.body }}</div>
          <div class="trash-modal-foot">
            <button type="button" class="trash-btn-ghost" @click="closeConfirm">{{ t('photosCancel') }}</button>
            <!-- Task 8 review fix: Vue2 :108-111's CTA also carries a leading icon (same
                 trash/upload pair, :size="12", color="white" -- inherited here from parity's
                 own `.trash-btn-cta { color: white; }`, no extra class needed). -->
            <button type="button" class="trash-btn-cta" :class="{ 'trash-btn-cta-danger': confirm.danger }" @click="runConfirm">
              <PhotosIcon :name="confirm.danger ? 'trash' : 'upload'" :size="12" />
              {{ confirm.ctaLabel }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Task 9: lightbox re-nested inside .photos-root per the F8 module-singleton rule (any
         page calling useLightbox().openAt must mount its own <PhotoLightbox>), same shape as
         Photos.vue/PhotosFavorites.vue. Delete/toggle-fav/add-to-album semantics: see
         onLightboxDelete's comment above. -->
    <PhotoLightbox
      @delete="onLightboxDelete"
      @toggle-fav="() => {}"
      @add-to-album="() => {}"
    />

    <!-- Plan G: Ask Nimo FAB + popup + drawer, same "mount once per view, Teleport to body"
         shape as PhotosToastHost (not present on this view) -- Photos has no shared shell to
         mount this once at. -->
    <AskNimoHost />
  </div>
</template>

<style scoped>
/* Task 8 (Plan H re-shell): this page now mounts the shared `.app` CSS Grid shell
   (Photos.vue/PhotosFavorites.vue's own re-shell precedent) instead of the old flex-row
   `.photos-layout` + unpinned `.sidebar` transitional rules -- both deleted, the `.app` grid's
   own column track now owns the sidebar width and the height cap. `.photos-main` has no
   parity counterpart (Vue2 has no such wrapper div; a New-UI-only layout container, same as
   PhotosFavorites.vue's identical survivor rule), so it stays as-is. */
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

/* Hero/tile/multi-select/bulk-bar/confirm-modal classes renamed to parity's own
   `.lib-hero*`/`.trash-tile-check`/`.trash-countdown`/`.trash-bulk-bar`/`.trash-modal*`
   anchors this task -- their old bespoke rules (`.trash-hero*`, `.bulk-count`/`.bulk-spacer`/
   `.sel-btn*`, `.trash-tile-countdown`/`.trash-tile-select`/`.trash-tile[data-selected]`,
   `.empty-state*`) are deleted below; parity (photos/styles/vue2-parity/photos.scss) governs
   those now that the template uses its exact selectors. `.trash-tile[data-selected="true"]`
   in particular is dropped outright rather than kept: it had no Vue2 counterpart at all (Vue2
   PhotosTrashView.vue only tints the check-circle on selection, no tile outline) -- it was a
   New-UI-only divergence from pixel parity, not a survivor worth keeping. */

/* Icon glyph colors: parity's own `.lib-hero-icon[data-tint]`/`.trash-modal-icon` rules only
   set the background circle, not the glyph itself (same gap as PhotosFavorites.vue's own
   `.fav-hero-star-icon`) -- these two page-local overrides supply Vue2's explicit inline
   `color` props, via the photos-private `--trash-danger-fg`/`--trash-confirm-fg` tokens
   (defined on `.photos-root`/`.photos-root.is-light` in photos/styles/vue2-parity/photos.scss,
   review fix). Neither this file's own `--accent` (a different hue entirely) nor theme.css's
   app-wide `--remove-fg` (itself re-themed per light/dark, so its value drifts across themes)
   already carries Vue2's literal colors, hence the two dedicated tokens rather than reusing
   either -- see that scss file's own comment for the exact hex values and the full reasoning.
   `.trash-danger-icon` is Vue2's always-red icon (PhotosTrashView.vue:6 hero icon, :20 hero
   "Empty trash" button icon). `.trash-modal-icon`'s color is dynamic (:101-102: blue for the
   informational/restore case, red for the danger/delete case), inherited by the glyph via
   `currentColor`. */
.trash-danger-icon { color: var(--trash-danger-fg); }
.trash-modal-icon { color: var(--trash-confirm-fg); }
.trash-modal[data-danger="true"] .trash-modal-icon { color: var(--trash-danger-fg); }

/* ── Filters / sort: renamed the template to parity's own
     `.lib-filters`/`.lib-chip`/`.lib-sort` anchors (photos.scss:1294-1327, which already carry
     the 12px 32px padding + border-bottom this page's own bespoke copy below used to hand-roll
     with a divergent 8px/32px value) -- this page's own `.trash-filters`/`.trash-chip`/
     `.trash-sort` rules (including the 32px padding survivor from the earlier review fix) are
     now fully superseded and deleted; parity governs. `.trash-filters-spacer` stays page-local
     (Vue2 uses an inline `style="flex:1"` div here, not a class, so parity has nothing to
     rename it to). ── */
.trash-filters-spacer { flex: 1 1 auto; }

/* Task 12: same secondary-button treatment as .fav-load-more in
   PhotosFavorites.vue — reuses .btn (parity's own bare-button class, this task's re-shell). */
.trash-load-more { display: flex; justify-content: center; padding: 16px 0; }
.trash-load-more .btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* ── Bucketed grid. `.trash-scroll` has no Vue2/parity counterpart (Vue2 uses `.lib-scroll
     scroll`, a shared class this page can't reuse verbatim since its own scroll container
     isn't the same DOM shape as the library grid's -- kept page-local), padding mirrors
     parity's own `.lib-scroll` (photos.scss:1343-1347, `padding: 0 32px 80px`) so this
     container's side inset lines up with `.lib-hero`/`.trash-filters`/`.trash-bulk-bar` above
     it (review fix).
     The bucket head/dot/title/sub and the grid wrapper used to be
     page-local reinventions (`.trash-bucket*`/`.trash-grid`) of classes that already exist,
     byte-identical, as shared parity anchors (`.arc-section*` from the archive view /
     `.lib-grid` from the library grid) -- the template now uses those anchors directly
     (matching Vue2 PhotosTrashView.vue:63-70 exactly, which does the same reuse), so the
     page-local rules below are deleted; parity governs `.arc-section-head`'s border-bottom
     separator, margin-top, dot geometry, title/sub typography, and `.lib-grid`'s columns/gap.
     Only the dot's *tone color* survives as a page-local override (below) -- parity's own
     `.arc-section-dot` sets geometry only, no color; Vue2 sets the tone color inline per-item
     (:65-66), this page reuses existing semantic tokens instead (ruled, see the tone-color
     comment kept below) via `data-tone`. ── */
.trash-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 0 32px 80px; }
.arc-section-dot { background: var(--accent); }
/* The three countdown-severity tiers reuse existing semantic tokens, no new token added
   (deliberate reuse, not an oversight): urgent = danger tone (--remove-fg, already used consistently across
   the codebase for delete/danger buttons), warn = warning tone (--dem-fg, already used for
   SearchDialog's "demote" semantics and UploadPanel's warning state), normal = regular accent tone
   (--accent). */
.arc-section-dot[data-tone="urgent"] { background: var(--remove-fg); }
.arc-section-dot[data-tone="warn"] { background: var(--dem-fg); }

/* Transition-class spelling gap only (Vue2 -> Vue3): parity's own `.trash-modal-enter`/
   `.trash-modal-leave-to` (photos.scss ~2393-2399) are Vue2-spelled -- Vue3's <transition>
   renders the bare `-enter` as `-enter-from` instead, so this SFC needs its own copy of just
   the renamed half (same convention as PhotosAlbumDetail.vue's `.lb-confirm-enter-from` shim /
   PhotoLightbox.vue's `.lb-swap-*-enter-from`). `-leave-to` is unchanged between Vue2/Vue3, so
   it needs no shim here -- already covered by parity's own rule. Every other confirm-modal
   rule (scrim/box/icon-circle/title/body/foot/ghost-btn/cta-btn) is fully superseded by
   parity's own unscoped `.trash-modal*` rules (imported globally via
   `../photos/styles/vue2-parity`) and is deleted, not duplicated here. */
.trash-modal-enter-from { opacity: 0; }
.trash-modal-enter-from .trash-modal { transform: translateY(8px) scale(0.97); opacity: 0; }

@media (max-width: 768px) {
  .app { grid-template-columns: 1fr; }
}
</style>
