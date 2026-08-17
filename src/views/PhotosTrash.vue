<script setup lang="ts">
// Task 9 (SP7-P3): Trash view — its own hand-rolled bucketed grid (doesn't reuse PhotosGrid: trash
// data is the slimmed-down TrashPhoto, and the countdown badge is unique UI the grid doesn't have).
//
// Task 8 (Plan H re-shell): the transitional AreaShell/.photos-layout shell has been swapped for
// Photos.vue/PhotosFavorites.vue's own `.photos-root > .app[data-collapsed] > PhotosSidebar +
// main.main > PhotosTopbar + .photos-main` structure (useSidebarCollapse shared singleton), and
// the hero/tile/multi-select/bulk-bar/confirm-modal classes were renamed to their parity anchors
// (`.lib-hero`/`.trash-tile-check`/`.trash-countdown`/`.trash-bulk-bar`/`.trash-modal*`). The
// topbar's Ask Nimo button is wired to the real drawer entry (`show-ask-nimo` +
// `@ask-nimo="useAskNimo().openDrawer()"`), same as PhotosFavorites.vue.
//
// P3 hard rule: clicking a tile (including blank areas) = toggle selection, does NOT open the
// lightbox — trash items are slimmed-down objects "pending restore / pending permanent deletion",
// and the lightbox's favorite-star/delete-trash button semantics don't hold here (does delete mean
// permanent deletion? or restore? ambiguous), so lightbox wiring is skipped entirely for this view,
// tracked in the ledger (see task-9-report.md).
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

const { t } = useI18n()
const { themeClass } = usePhotosTheme()
const { collapsed, toggle: onToggleCollapse } = useSidebarCollapse()
const trash = usePhotosTrash()
const toast = useToast()

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
const totalSize = computed(() => trash.items.reduce((s, p) => s + (Number(p.sizeMb) || 0), 0).toFixed(1))

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
function onTileClick(p: TrashPhoto) { toggleSelect(p.id) }

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

// Task 12 fix round 2 (Important 1 & 2, coordinator review): service.photos.emptyTrash() and
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
      try {
        await trash.purge(ids)
        toast.show(t('photosTrashPurgedToast', { count, size }), 4500)
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
      // Task 12 fix round 2: when paging got stuck we still do not know the true count, so
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
            // Task 12 fix round 2 (Important 2): restoreAllTrash() restores EVERYTHING
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
      // Task 12 fix round 2: same reasoning as restoreAll's title above.
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
        <PhotosTopbar
          :collapsed="collapsed" :title="t('photosTrashTitle')" :show-search="false"
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
                <!-- Task 12 (SP15-P3): totalSize sums sizeMb over trash.items, which is only the
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

            <div class="trash-filters">
              <button type="button" class="trash-chip" :data-active="filter === 'all'" @click="filter = 'all'">
                {{ t('photosTabAll') }} <span class="ct">{{ trash.items.length }}</span>
              </button>
              <button type="button" class="trash-chip" :data-active="filter === 'photo'" @click="filter = 'photo'">
                {{ t('photosTabPhotos') }} <span class="ct">{{ photoCount }}</span>
              </button>
              <button type="button" class="trash-chip" :data-active="filter === 'video'" @click="filter = 'video'">
                {{ t('photosTabVideos') }} <span class="ct">{{ videoCount }}</span>
              </button>
              <div class="trash-filters-spacer"></div>
              <div class="trash-sort">
                <button type="button" :data-active="sort === 'daysleft'" @click="sort = 'daysleft'">
                  {{ t('photosTrashSortDaysLeft') }}
                </button>
                <button type="button" :data-active="sort === 'recent'" @click="sort = 'recent'">
                  {{ t('photosTrashSortRecent') }}
                </button>
              </div>
            </div>

            <div class="trash-scroll scroll">
              <div v-for="b in bucketed" :key="b.id" class="trash-bucket">
                <div class="trash-bucket-head">
                  <span class="trash-bucket-dot" :data-tone="b.tone"></span>
                  <span class="trash-bucket-title">{{ b.title }}</span>
                  <span class="trash-bucket-sub">{{ t('photosItemsCount', { count: b.photos.length }) }} · {{ b.desc }}</span>
                </div>
                <div class="trash-grid">
                  <div
                    v-for="p in b.photos" :key="p.id"
                    class="lib-tile trash-tile" :data-selected="isSelected(p.id)"
                    @click="onTileClick(p)"
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

            <!-- Task 12 (SP15-P3): the backend caps a single request at 500 rows now
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
   New-UI-only deviation from pixel parity, not a survivor worth keeping. */

/* Icon glyph colors: parity's own `.lib-hero-icon[data-tint]`/`.trash-modal-icon` rules only
   set the background circle, not the glyph itself (same gap as PhotosFavorites.vue's own
   `.fav-hero-star-icon`) -- these two page-local overrides supply Vue2's explicit inline
   `color` props. `.trash-danger-icon` is Vue2's always-red icon (PhotosTrashView.vue:6 hero
   icon, :20 hero "Empty trash" button icon -- both hard-coded `color="#FF6B5C"`); the fallback
   is Vue2's literal hex, not the softer `--remove-fg` default used elsewhere in this codebase,
   to stay pixel-exact. `.trash-modal-icon`'s color is dynamic (:101-102: blue `#5e94ff` for the
   informational/restore case, red `#FF6B5C` for the danger/delete case), inherited by the
   glyph via `currentColor`. */
.trash-danger-icon { color: var(--remove-fg, #FF6B5C); }
.trash-modal-icon { color: var(--accent, #5e94ff); }
.trash-modal[data-danger="true"] .trash-modal-icon { color: var(--remove-fg, #FF6B5C); }

/* ── Filters / sort (parity has no `.trash-filters`/`.trash-chip`/`.trash-sort` anchors --
     out of this task's rewrite scope, kept as-is). Horizontal padding bumped from 4px to 32px
     (review fix) to line up with `.lib-hero`/`.trash-bulk-bar`'s own 32px side inset (parity
     photos.scss:1235/:1734) -- vertical padding (8px) is this page's own pre-existing rhythm,
     untouched. ── */
.trash-filters { display: flex; align-items: center; gap: 6px; padding: 8px 32px; flex-wrap: wrap; }
.trash-filters-spacer { flex: 1 1 auto; }
.trash-chip {
  display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 10px;
  border-radius: 999px; background: var(--chip-bg); border: 1px solid var(--chip-border);
  color: var(--fg-muted); font: inherit; font-size: 11.5px; cursor: pointer;
}
.trash-chip:hover { background: var(--chip-bg-hi); color: var(--fg); }
.trash-chip[data-active="true"] { background: var(--accent-soft); border-color: var(--accent-soft-bd); color: var(--accent-text); }
.trash-chip .ct { font-variant-numeric: tabular-nums; opacity: 0.75; font-size: 10.5px; }
.trash-sort { display: inline-flex; align-items: center; gap: 2px; padding: 2px; border-radius: 999px; background: var(--chip-bg); }
.trash-sort button { height: 22px; padding: 0 10px; border-radius: 999px; border: 0; background: transparent; color: var(--fg-muted); font: inherit; font-size: 11.5px; cursor: pointer; }
.trash-sort button[data-active="true"] { background: var(--chip-bg-hi); color: var(--fg); }

/* Task 12 (SP15-P3): same secondary-button treatment as .fav-load-more in
   PhotosFavorites.vue — reuses .btn (parity's own bare-button class, this task's re-shell). */
.trash-load-more { display: flex; justify-content: center; padding: 16px 0; }
.trash-load-more .btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* ── Bucketed grid (parity has no `.trash-bucket*`/`.trash-grid`/`.trash-scroll` anchors --
     out of this task's rewrite scope, kept as-is; the tile itself now carries the parity
     `.lib-tile`/`.trash-tile` combo, see the header comment above). Padding mirrors parity's
     own `.lib-scroll` (photos.scss:1343-1347, `padding: 0 32px 80px`) so this container's side
     inset lines up with `.lib-hero`/`.trash-filters`/`.trash-bulk-bar` above it (review fix). ── */
.trash-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 0 32px 80px; }
.trash-bucket { margin-top: 20px; }
.trash-bucket:first-child { margin-top: 0; }
.trash-bucket-head { display: flex; align-items: baseline; gap: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--divider); }
.trash-bucket-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--accent); }
/* The three countdown-severity tiers reuse existing semantic tokens, no new token added (the brief
   explicitly allows reuse): urgent = danger tone (--remove-fg, already used consistently across
   the codebase for delete/danger buttons), warn = warning tone (--dem-fg, already used for
   SearchDialog's "demote" semantics and UploadPanel's warning state), normal = regular accent tone
   (--accent). */
.trash-bucket-dot[data-tone="urgent"] { background: var(--remove-fg); }
.trash-bucket-dot[data-tone="warn"] { background: var(--dem-fg); }
.trash-bucket-title { font-size: 13.5px; font-weight: 600; color: var(--fg); }
.trash-bucket-sub { font-size: 11.5px; color: var(--fg-muted); }

.trash-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 4px; margin-top: 14px; }

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
