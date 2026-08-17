<script setup lang="ts">
// P2 lightbox shell -- structurally ported from Vue2 NimoOS-UI's
// src/views/Photos/PhotosLightbox.vue; all state reads from the useLightbox() singleton (T2/T3),
// the static-image stage is delegated to PhotoImageViewer (T5, carries its own bottom zoom bar).
// delta (see task-6-brief.md): 1) add-to-album was added back in P4 (Task 9), Ask Nimo still
// belongs to SP8; 2) the info panel became toggleable (stubbed until T7);
// 3) no zoom buttons on the top bar (PhotoImageViewer owns its own bottom zoom bar, fewer
// cross-component refs); 4) the current item is always compared by id.
// Task 9 closeout: mounts T7's PhotoInfoPanel (reads lb.detail, hydrated detail rather than the
// list-item placeholder current) and T8's PhotoFilmstrip (absolute-index select → lb.goTo).
//
// Plan F Task 3 (2026-08-15, structural re-cast flex→parity grid + full class-name alignment):
// the `.lightbox` container switched from a flex column to a CSS Grid, rows/columns/areas copied
// verbatim from Vue2/parity (parity photos.scss:564-578): `grid-template-rows: 56px 1fr 88px`;
// when `data-info="true"`, `grid-template-columns: 1fr 360px` + areas "top top"/"main info"/"strip
// info", single-column areas "top"/"main"/"strip" when "false". This means the `.lb-body` wrapper
// T9 left behind (a flex row pairing `.lb-stage` with PhotoInfoPanel side by side) is deleted
// entirely -- `.lb-main` (renamed from `.lb-stage`), PhotoInfoPanel's root (renamed to `.lb-info`),
// and PhotoFilmstrip's root (`.lb-strip`, whose class name was already aligned) all become direct
// children of `.lightbox` instead, each claiming its own grid area rather than being positioned
// via DOM nesting.
//
// [Interim renderability decision, closed out in Task 5] Task 3 originally chose a "minimal
// interim skeleton" strategy -- this file (along with PhotoInfoPanel.vue/PhotoFilmstrip.vue) each
// maintained its own grid/positioning rules mirroring parity's structure, reusing existing New-UI
// tokens and visuals as much as possible in values, until the lightbox was re-nested inside
// `.photos-root` and parity's global rules actually took over. Plan F Task 5 (2026-08-15) has now
// migrated the lightbox back inside `.photos-root` across all 9 host pages (see the mount-point
// comment on each page and task-5-report.md); this skeleton has been closed out accordingly: any
// local rule that fully covers the same set of properties as a same-named parity rule is deleted
// outright (avoiding the exact same-specificity tie F8-r4 warned about -- this component's scoped
// styles are empirically injected after the parity stylesheet on every host page's current import
// order, so a local rule would always win a tie, silently defeating parity and undermining the
// whole point of re-nesting); only properties/rules parity doesn't cover are kept (see the
// comments scattered through the style block below).
//
// Plan F Task 4 (2026-08-15, frame-exact lightbox animation): `.lb-media` is now wrapped in
// `<transition :name="'lb-swap-' + navDir">` (navDir is defined in the script below), a
// byte-exact recreation of Vue2's swap/scale animation; the container gained an `lb-in` entrance
// animation reference; `.lb-media`'s positioning changed to absolute+inset:0 (the crossfade
// load-bearing value, see that rule's own style comment). See this file's and
// PhotoImageViewer.vue's/PhotoFilmstrip.vue's own style/script comments, plus task-4-report.md's
// parameter verification table, for details.
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useLightbox } from './useLightbox'
import PhotoImageViewer from './PhotoImageViewer.vue'
import PhotoInfoPanel from './PhotoInfoPanel.vue'
import PhotoFilmstrip from './PhotoFilmstrip.vue'

const emit = defineEmits<{
  (e: 'delete', id: string | number): void
  (e: 'toggle-fav', id: string | number, fav: boolean): void
  (e: 'add-to-album', id: string | number): void
}>()

const { t } = useI18n()
const lb = useLightbox()

const showInfo = ref(false) // info panel (filled in by T7); off by default, toggleable
const confirmDelete = ref(false)

// URL generators (bare, token-bearing) -- thin wrapper for the template to call
const originalUrl = (id: string | number) => service.photos.originalUrl(id)
const thumbnailUrl = (id: string | number, size = 'large') => service.photos.thumbnailUrl(id, size)
const liveUrl = (id: string | number) => service.photos.liveUrl(id)

const downloadName = (): string => {
  const d = lb.detail.value
  const cur = lb.current.value
  const title = d?.title ?? cur?.title
  return title != null && title !== '' ? String(title) : `photo-${cur?.id ?? ''}`
}

// —— Favorite ——(toggleFav already persists optimistically inside useLightbox; the emit is only for P3's broadcast)
function onToggleFav(): void {
  const cur = lb.current.value
  if (!cur) return
  void lb.toggleFav() // synchronously, optimistically flips favIds → isFav reflects the new state immediately
  emit('toggle-fav', cur.id, lb.isFav.value)
}

// —— Add to album ——(per Vue2 PhotosLightbox.vue:13-14: emit only, no logic here; the host
// wires up T5's AlbumPickerDialog to open the panel, the lightbox itself doesn't close).
function onAddToAlbum(): void {
  const cur = lb.current.value
  if (!cur) return
  emit('add-to-album', cur.id)
}

// —— Delete confirmation ——(per Vue2 :151-165)
function doDelete(): void {
  const cur = lb.current.value
  if (!cur) return
  confirmDelete.value = false
  emit('delete', cur.id)
  lb.close()
}

// —— Chrome auto-hides after 5s idle ——(reuses the same isMoving + timer pattern as T5;
// declared before the video-anchor watch below, so the open-watch's immediate:true branch can't
// reference an as-yet-uninitialized hideTimer in an edge case)
const isMoving = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null
function onMouseMove(): void {
  isMoving.value = true
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => { isMoving.value = false; hideTimer = null }, 5000)
}

// —— Resume video from hover-preview position ——(per Vue2 applyStartTime :335-344: only seeks
// once, for the first matching video opened this time)
// This component stays persistently mounted by its parent (self-gated internally via
// v-if="lb.open.value"), so onMounted usually fires before the lightbox is actually open -- at
// that moment lb.current is empty, so the anchor can only be captured at the instant open flips
// from false to true (see the watch below); otherwise startPhotoId would stay null forever,
// applyStartTime would always early-return, and resume-from-hover would never work.
// This same persistent-mount pitfall also affects two other pieces of state, so this open-watch
// backstops all three together:
// 1) Chrome auto-hide (isMoving) only arms its 5s timer once, in onMounted -- since the component
//    stays mounted for the app's whole lifetime with the lightbox closed, that timer has long
//    since expired by the time a real openAt happens, so isMoving is already false and every nav
//    arrow is hidden, making it look like nothing rendered.
//    (Since 2026-07-31 the top bar is no longer governed by isMoving at all -- it's opaque,
//    in-flow chrome that's always shown, see the template comment.)
//    Calling onMouseMove() again on every open guarantees chrome is visible and the timer restarts
//    the moment the lightbox actually opens.
// 2) showInfo is a component-level ref, so an open→close→reopen cycle would carry over the
//    previous open/closed state, which doesn't match the "info panel collapsed by default" design;
//    it's explicitly reset to false on every open.
const videoEl = ref<HTMLVideoElement | null>(null)
let startApplied = false
let startPhotoId: string | number | null = null

// —— Nav direction (Plan F Task 4, faithful to Vue2 PhotosLightbox.vue :233-238's data()/watch) ——
// Vue2: `data() { return { navDir: 'next', _lastIdx: 0, ... } }` + `watch: { 'photo.id'(newId) {
// this.navDir = this.idx >= this._lastIdx ? 'next' : 'prev'; this._lastIdx = this.idx; ... } }`
// (idx is the index computed via `photos.findIndex(p => p.id === photo.id)`). New-UI's index is
// already useLightbox's own state source (lb.index, mutated directly by goTo/next/prev), so there
// is no need to reverse-lookup the index for an id from the list the way Vue2 does -- watching
// lb.index directly is the equivalent trigger point for the same thing.
const navDir = ref<'next' | 'prev'>('next') // same default as Vue2 data()'s navDir: 'next'
let lastIdx = 0
watch(() => lb.index.value, (newIdx) => {
  // An index change while the lightbox is already closed (or being zeroed out by
  // close()/resetState()) doesn't count as a real page-flip -- close() sets open to false and
  // then zeroes index (in the same batch), and without a guard this zeroing would be misjudged as
  // a real "prev", polluting the initial animation direction on the next reopen (see the same
  // persistent-mount pitfall where lastIdx is reset in the open-watch below).
  if (!lb.open.value) return
  navDir.value = newIdx >= lastIdx ? 'next' : 'prev'
  lastIdx = newIdx
})

watch(
  () => lb.open.value,
  (isOpen) => {
    if (isOpen) {
      startApplied = false
      startPhotoId = lb.current.value?.id ?? null
      onMouseMove()
      showInfo.value = false
      // The component stays persistently mounted, reusing the same navDir/lastIdx across
      // open/close cycles (same reset rationale as startApplied/showInfo above) -- every reopen
      // resets both to the default state Vue2 has on every fresh mount (data()'s `navDir: 'next'`,
      // `_lastIdx` aligned to the current idx), otherwise: 1) if a real page-flip to 'prev'
      // happened before the previous close, the first swap frame on this reopen would carry over
      // that stale direction; 2) even if navDir weren't carried over, the huge jump between the
      // starting index and the index at last close would still be misjudged as a real next/prev
      // page-flip. Vue2 doesn't have this problem, since it's a fresh instance mounted each time,
      // and both values realign in mounted() every time -- see :279-281.
      navDir.value = 'next'
      lastIdx = lb.index.value
    }
  },
  { immediate: true }, // handles the edge case where the component mounts while the lightbox is already open
)
function applyStartTime(): void {
  const cur = lb.current.value
  if (startApplied || !(lb.startMs.value > 0)) return
  if (!cur || cur.id !== startPhotoId) return
  const v = videoEl.value
  if (!v) return
  startApplied = true
  const durS = isFinite(v.duration) ? v.duration : Infinity
  v.currentTime = Math.min(lb.startMs.value / 1000, Math.max(0, durS - 0.1))
  void v.play().catch(() => {})
}

// —— Live Photo press-and-hold playback ——(net-new: not implemented in Vue2's lightbox; holding down the badge overlays a video, releasing stops and hides it)
const liveActive = ref(false)
const liveVideoEl = ref<HTMLVideoElement | null>(null)
function liveStart(): void {
  liveActive.value = true
  void nextTick(() => { void liveVideoEl.value?.play?.().catch(() => {}) })
}
function liveStop(): void {
  const v = liveVideoEl.value
  try { v?.pause?.() } catch { /* jsdom / not ready yet */ }
  liveActive.value = false
}

// —— Keyboard ——(per Vue2 :360-370; while confirmDelete is open, Escape only closes the modal)
function onKey(e: KeyboardEvent): void {
  if (!lb.open.value) return
  if (confirmDelete.value) {
    if (e.key === 'Escape') { e.preventDefault(); confirmDelete.value = false }
    return
  }
  if (e.key === 'Escape') { lb.close() }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); lb.prev() }
  else if (e.key === 'ArrowRight') { e.preventDefault(); lb.next() }
  else if (e.key === 'f' || e.key === 'F') { onToggleFav() }
  else if (e.key === 'Delete' || e.key === 'Backspace') { confirmDelete.value = true }
}

onMounted(() => {
  onMouseMove()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  if (hideTimer) clearTimeout(hideTimer)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div v-if="lb.open.value" class="lightbox" :data-info="showInfo" @mousemove="onMouseMove">
    <!-- Top toolbar. Per the user's 2026-07-31 acceptance requirement: the top bar is not
         transparent, and the photo is shown between it and the bottom bar -- so it is a grid row
         of its own (grid-area: top since Plan F Task 3, previously an in-flow flex item; no
         longer position:absolute overlaid on the stage) and does **not** participate in the 5s
         auto-hide (once opaque chrome collapses, the stage would grow taller and the photo would
         jump; the nav arrows still auto-hide with isMoving, since they're an overlay layered on
         top of the photo). -->
    <div class="lb-top">
      <button class="lb-icon-btn lb-close" type="button" :title="t('photosClose')" @click="lb.close()">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      <!-- Deviation (registered, structural change deferred to owner at acceptance): Vue2's
           titlebox is a bare `.lb-title`/`.lb-counter` pair (PhotosLightbox.vue:5-8, two
           siblings, no wrapping semantics beyond a plain flex column). This component merges the
           counter/date/time line into a single `.lb-sub` element instead of keeping a standalone
           `.lb-counter` -- a structural rename/merge, not a value/behavior change (same three
           pieces of information render, same place). Flagged here rather than silently carried;
           the owner can decide at acceptance whether the merge should be unwound to restore the
           exact Vue2 element split. -->
      <div class="lb-titlebox">
        <div class="lb-title">{{ lb.detail.value?.title }}</div>
        <div class="lb-sub">
          <span>{{ t('photosLightboxCounter', { idx: lb.index.value + 1, total: lb.list.value.length }) }}</span>
          <template v-if="lb.detail.value?.date"> · {{ lb.detail.value?.date }}</template>
          <template v-if="lb.detail.value?.time"> · {{ lb.detail.value?.time }}</template>
        </div>
      </div>
      <div class="lb-spacer"></div>
      <button
        class="lb-icon-btn lb-fav"
        :class="{ 'is-fav': lb.isFav.value }"
        type="button"
        :title="lb.isFav.value ? t('photosUnfavorite') : t('photosFavorite')"
        @click="onToggleFav"
      >
        <svg viewBox="0 0 24 24" width="17" height="17" :fill="lb.isFav.value ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.86-4.25 4.14 1 5.86L12 17.9l-5.25 2.76 1-5.86L3.5 9.66l5.9-.86z"/></svg>
      </button>
      <button
        class="lb-icon-btn lb-add-album"
        type="button"
        :title="t('photosAddToAlbum')"
        :aria-label="t('photosAddToAlbum')"
        @click="onAddToAlbum"
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 9v6M9 12h6"/></svg>
      </button>
      <a
        class="lb-icon-btn lb-download"
        :href="lb.current.value ? originalUrl(lb.current.value.id) : '#'"
        :download="downloadName()"
        :title="t('photosDownload')"
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14"/></svg>
      </a>
      <button
        class="lb-icon-btn lb-info-toggle"
        :class="{ active: showInfo }"
        type="button"
        :title="t('photosInfoToggle')"
        @click="showInfo = !showInfo"
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
      </button>
      <button class="lb-icon-btn lb-delete danger" type="button" :title="t('photosDeleteConfirmTitle')" @click="confirmDelete = true">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>
      </button>
    </div>

    <!-- Plan F Task 3: `.lb-main` (renamed from `.lb-stage`) is a direct grid child of
         `.lightbox` (grid-area: main) -- the `.lb-body` flex-row wrapper that used to pair it
         with PhotoInfoPanel is gone; both now claim their own named grid area independently
         (see this file's scoped-style header comment). -->
    <div class="lb-main">
      <!-- Plan F Task 4: swap transition, byte-exact per Vue2 (PhotosLightbox.vue:25
           `<transition :name="'lb-swap-' + navDir">`, wrapping the same id-keyed `.lb-media`
           it already wrapped in Vue2). Params (opacity 0.32s / transform 0.42s,
           cubic-bezier(0.22, 0.61, 0.36, 1), translateX ±36px, scale 0.97) live in parity's own
           bare `.lb-swap-*` rules (photos.scss:627-637) -- "bare" as in NOT `.photos-root`-scoped,
           unlike most of that file's rules, so they were already live on every page that mounts
           this component even before Task 5 nested it inside `.photos-root` (see this file's
           scoped-style header comment for the one naming gap that still needed a local shim:
           Vue3 renamed the bare `-enter` class to `-enter-from`). navDir is computed in
           the script above (watch on lb.index, mirroring Vue2's idx-vs-_lastIdx comparison). -->
      <transition :name="'lb-swap-' + navDir">
        <div class="lb-media" :key="String(lb.current.value?.id ?? '')">
          <!-- (a) Video. `.lb-photo` is parity's anchor for the media element itself
               (`.lb-media > .lb-photo(img|video)`, parity photos.scss:593-598); `.lb-video`
               is kept alongside it for this component's own video-specific sizing rule
               (net addition -- Vue2's lightbox has no separate video-only class). -->
          <video
            v-if="lb.current.value?.isVideo"
            ref="videoEl"
            class="lb-photo lb-video"
            :src="originalUrl(lb.current.value.id)"
            :poster="thumbnailUrl(lb.current.value.id, 'large')"
            controls
            preload="metadata"
            playsinline
            @loadedmetadata="applyStartTime"
          ></video>

          <!-- (b) Live Photo (not a video): static image + badge + press-and-hold to play -->
          <template v-else-if="lb.current.value?.isLivePhoto">
            <PhotoImageViewer
              :asset-id="lb.current.value.id"
              :mime-type="lb.current.value.mimeType"
              :ocr-lines="lb.ocrLines.value"
            />
            <video
              v-if="liveActive"
              ref="liveVideoEl"
              class="lb-live-video"
              :src="liveUrl(lb.current.value.id)"
              muted
              playsinline
            ></video>
            <!-- Plan F Task 5: renamed from `.lb-live-badge` -- see this file's scoped-style
                 `.lb-live-btn` comment for why the name had to change once nested. -->
            <button
              class="lb-live-btn"
              type="button"
              @pointerdown="liveStart"
              @pointerup="liveStop"
              @pointerleave="liveStop"
              @pointercancel="liveStop"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="8.5" stroke-dasharray="3 3"/></svg>
              {{ t('photosLivePhoto') }}
            </button>
          </template>

          <!-- (c) Static image -->
          <PhotoImageViewer
            v-else-if="lb.current.value"
            :asset-id="lb.current.value.id"
            :mime-type="lb.current.value.mimeType"
            :ocr-lines="lb.ocrLines.value"
          />
        </div>
      </transition>

      <!-- Nav arrows. Plan F Task 3: side modifier moved from a `.lb-nav-prev`/`.lb-nav-next`
           class to parity's real anchor attribute `data-side="prev"|"next"`
           (Vue2 PhotosLightbox.vue:57-71, parity photos.scss:630-639). -->
      <button
        v-if="isMoving"
        class="lb-nav"
        data-side="prev"
        type="button"
        :disabled="!lb.hasPrev.value"
        :title="t('photosPrev')"
        @click="lb.prev()"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>
      </button>
      <button
        v-if="isMoving"
        class="lb-nav"
        data-side="next"
        type="button"
        :disabled="!lb.hasNext.value"
        :title="t('photosNext')"
        @click="lb.next()"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>
      </button>
    </div>

    <!-- Info panel (T7): reads hydrated lb.detail, not the list-item placeholder lb.current. Plan F Task 3:
         no longer wrapped in `.lb-body` -- PhotoInfoPanel's own root now carries `.lb-info`
         and claims `grid-area: info` itself (see that component's scoped style). -->
    <PhotoInfoPanel :photo="lb.detail.value" :visible="showInfo" />

    <!-- Filmstrip (T8): absolute-index select → lb.goTo -->
    <PhotoFilmstrip :list="lb.list.value" :index="lb.index.value" @select="lb.goTo" />

    <!-- Delete-confirm modal. Plan F Task 3: buttons renamed from the invented `.lb-confirm-cancel`/
         `.lb-confirm-ok.danger` to the `.trash-btn-ghost`/`.trash-btn-cta.trash-btn-cta-danger`
         family Vue2 actually uses (PhotosLightbox.vue:158-161) and that sibling Photos pages
         (PhotosMomentDetail.vue/PhotosAlbumDetail.vue/PhotosSmartViewDetail.vue) already
         adopted for their own copies of this exact dialog -- this was the one remaining
         un-migrated copy. The icon is added back too (Vue2 :154, dropped when this dialog was
         first built) -- same trash glyph as the `.lb-delete` button above, at parity's icon
         size (22px vs. the top bar's 17px).

         I1 (owner red line: no animation dropped, 2026-08-15 final review): the scrim had
         regressed to a bare `v-if` with no transition at all. Vue2 wraps the exact same scrim in
         `<transition name="lb-confirm">` (PhotosLightbox.vue:151-165) -- 0.2s opacity+scale(0.95),
         restored here byte-for-byte; parity already carries the timing/end-state rules
         (`.lb-confirm-enter-active/-leave-active`, `.lb-confirm-leave-to`, photos.scss:795-801) as
         bare (non-`.photos-root`-scoped) rules, so they were already reachable the moment this
         wrapper went back in -- only the dead Vue2 `-enter` name needed a local Vue3 `-enter-from`
         shim (see this file's scoped-style block, same `.lb-swap-*-enter-from` precedent). -->
    <transition name="lb-confirm">
      <div v-if="confirmDelete" class="lb-confirm-scrim" @click.self="confirmDelete = false">
        <div class="lb-confirm">
          <!-- theme-exception (M2, matches Vue2 PhotosLightbox.vue:154's literal color=FF6B5C hex
               value): the delete-confirm glyph's red is Vue2's own hardcoded value, not a token
               lookup -- kept as the same literal here rather than the `--remove-fg` token (which
               resolves to a visually-different red, hex ff5d5d) so this one dialog's icon matches
               Vue2 pixel for pixel; every other danger-colored control in this file still goes through
               `--remove-fg` (see `.lb-icon-btn.danger:hover` below), this is a single deliberate,
               documented exception for parity, not a drift back toward hardcoded colors generally. -->
          <div class="lb-confirm-icon" style="color: #FF6B5C"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg></div>
          <div class="lb-confirm-title">{{ t('photosDeleteConfirmTitle') }}</div>
          <div class="lb-confirm-body">{{ t('photosDeleteConfirmBody') }}</div>
          <div class="lb-confirm-foot">
            <button class="trash-btn-ghost" type="button" @click="confirmDelete = false">{{ t('photosCancel') }}</button>
            <button class="trash-btn-cta trash-btn-cta-danger" type="button" @click="doDelete">{{ t('photosConfirmDelete') }}</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* Plan F Task 5 (2026-08-15, lightbox re-nested inside `.photos-root`): the interim grid/chrome/
   confirm-dialog skeleton Task 3/4 kept here -- byte-mirroring parity so this component stayed
   renderable standalone before it actually lived inside `.photos-root` -- is retired below. Every
   rule removed had a parity counterpart (`.photos-root .lightbox`/`.lb-*`/`.lb-confirm` family,
   vue2-parity/photos.scss:564-793) that already covers every property it declared; keeping a
   local duplicate would only recreate the exact same-specificity cascade tie F8-r4 warned
   against -- and this component's own scoped `<style>` is registered via its SFC import, which in
   every host page's current import order lands AFTER the `vue2-parity` stylesheet import, so a
   surviving local duplicate would silently keep outvoting parity on every tie, defeating the
   whole point of nesting. z-index/animation: parity's own `.photos-root .lightbox` already
   carries `z-index: 200` (bumped to match this component's pre-existing value, see that rule's
   own deviation comment) and `animation: lb-in 0.22s ease-out` -- neither needs a local copy any
   more. photosOverlayZIndex.test.ts's "`.lightbox` (component-scoped)" entry is retargeted to
   drop the now-removed rule (see that test file's own Plan F Task 5 comment).
   Only rules with NO parity counterpart, or properties parity doesn't touch, remain below. */
.lb-titlebox { display: flex; flex-direction: column; min-width: 0; }
/* font-size/font-weight/color now come solely from parity's `.photos-root .lb-title`
   (13px/500/var(--text-1)); only the truncation behaviour survives locally -- parity's own title
   isn't wrapped in a fixed-width flex box like `.lb-titlebox` and has no overflow to guard. */
.lb-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* Fix-2 item 4 (owner acceptance, 2026-08-16): every color below was New-UI's *global* theme.css
   token (`--fg`/`--fg-muted`/`--tool-bg-hi`/`--star-fg`/`--remove-fg`) -- those only follow the
   app-wide `[data-theme]` attribute on `<html>`, not Photos' own PRIVATE light/dark toggle
   (`usePhotosTheme()`/`.photos-root.is-light`, independent of the global one -- see
   src/photos/composables/usePhotosTheme.ts). In the very common "Photos-light + app-global-dark"
   combination every rule below stayed stuck in its dark appearance regardless of Photos' own
   switch: white icon glyphs on the now-near-white `.lb-top`/`.lb-chrome`, i.e. exactly the owner's
   acceptance screenshot ("top-bar icon buttons + title/counter text ... washed out"). Same root
   cause and same fix shape as the Places-area sweep done this same day
   (photosGlassSurfaces.test.ts's "Places 区不再消费全局玻璃/文本 token" describe block) -- swapped
   for this area's own `.photos-root`/`.photos-root.is-light`-scoped tokens
   (vue2-parity/photos.scss), matching parity's own `.icon-btn`/`.icon-btn:hover`/
   `.icon-btn[data-active="true"]` pattern (photos.scss:262-268) property-for-property. */
.lb-sub { font-size: 12px; color: var(--text-2); }
.lb-spacer { flex: 1; }
.lb-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
}
.lb-icon-btn:hover { background: var(--surface-3); color: var(--text-1); }
/* theme-exception: the solid-gold favorite star is a fixed semantic color across themes, matches
   Vue2's own inline `:color="photo.fav ? …gold-hex… : 'currentColor'"` (PhotosLightbox.vue:11) */
.lb-fav.is-fav { color: #ffd60a; }
.lb-info-toggle.active { background: var(--accent-soft); color: var(--accent-hi); }
.lb-icon-btn.danger:hover { color: var(--danger); }

/* `.lb-main`/`.lb-media` are byte-identical to parity's own `.photos-root .lb-main`/
   `.photos-root .lb-media` (grid-area:main+position:relative+display:grid+place-items:center+
   overflow:hidden, and position:absolute+inset:0+display:flex+align-items+justify-content for
   the crossfade layer respectively -- parity additionally sets `will-change` on both) -- both
   local copies are retired, parity's alone now governs. */
/* Plan F Task 4: Vue3 renamed Vue2's bare `-enter` transition class to `-enter-from` (`-leave-to`
   kept its name in both) -- same C7 precedent as SearchSaveSmartView.vue's
   `.save-pop-enter-from,.save-pop-leave-to` local shim. Parity's own `.lb-swap-next-enter`/
   `.lb-swap-prev-enter` (photos.scss:634,636) verbatim-transcribe Vue2's own dead names
   (Vue2 photos.scss:518,520) as documented dead-source lines -- they never match any real Vue3
   transition class, so this local pair supplies the actual Vue3 selector. The `-enter-active`/
   `-leave-active` transition-timing rule and the `-leave-to` end-state (name unchanged between
   Vue2 and Vue3) are NOT duplicated here: parity's own copies of those (photos.scss:627-633,635,
   637) are bare, unscoped selectors -- not `.photos-root`-gated -- already live on every host
   page (see the <transition> template comment above for the full reasoning), so only the
   dead-named `-enter` half needs a local replacement. */
.lb-swap-next-enter-from { opacity: 0; transform: translateX(36px) scale(0.97); }
.lb-swap-prev-enter-from { opacity: 0; transform: translateX(-36px) scale(0.97); }
/* I1 (owner red line: no animation dropped) -- same dead-name situation as `.lb-swap-*` above:
   parity's own `.lb-confirm-enter-active/-leave-active` (timing) and `.lb-confirm-leave-to`
   (end-state, name unchanged Vue2→Vue3) are bare, unscoped rules (photos.scss:795-801), already
   live on every host page regardless of nesting -- only Vue2's dead `-enter` name (verbatim-
   transcribed at photos.scss:798, never matched by a real Vue3 transition) needs a local
   `-enter-from` replacement, the actual Vue3 selector for `<transition name="lb-confirm">`'s
   entering state. Values copied byte-exact from the parity source's own `-enter` declaration. */
.lb-confirm-enter-from { opacity: 0; transform: scale(0.95); }
/* I2 (final review, 2026-08-15): this rule used to declare `max-width: 100%; max-height: 100%;`,
   which -- at equal specificity with parity's own `.photos-root .lb-photo` (also targeting this
   exact element, since the video carries both classes) and with this component's scoped styles
   injected after the parity stylesheet on every host page -- always won the tie and silently
   overrode parity's `calc(100% - 80px)`/`calc(100% - 24px)` arrow clearance with a flush 100%.
   Deleted outright so parity's `.lb-photo` rule is the only max-width/max-height declaration
   reaching this video element, no tie left to win. Unlike PhotoImageViewer.vue's `.img-el` (the
   img there sits one level deeper, inside a shrink-wrap `.img-wrap` -- see that file's own I2
   comment for the containing-block analysis), this `<video>` is a DIRECT child of `.lb-media`
   (this file's template, no intermediate wrapper), so parity's percentage resolves straight
   against `.lb-media`'s own definite box -- no wrapper layer to reason about here at all. */
.lb-live-video {
  position: absolute;
  inset: 0;
  margin: auto;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  pointer-events: none;
  z-index: 2;
}
/* Plan F Task 5: renamed from `.lb-live-badge` to `.lb-live-btn` to break a genuine class-name
   collision with parity's OWN, unrelated `.photos-root .lb-live-badge` rule (photos.scss:995-
   1009) -- that rule styles a different, non-interactive "LIVE" indicator (Vue2's real lightbox
   never renders this badge at all, confirmed empty template search; this component's Live Photo
   press-and-hold feature is a net addition). Sharing the name was harmless while this component
   rendered outside `.photos-root` (parity's rule couldn't reach it, see the pre-Task-5 deviation
   note this comment replaces -- position `top: 12px; left: 12px` already matched both ground-
   truth sources even then). Nesting would make both rules match the exact same class, and
   parity's copy sets `pointer-events: none` -- which would silently kill this button's press-and-
   hold interaction if it ever won the cascade tie. Renaming removes the ambiguity outright
   instead of fighting over specificity. */
.lb-live-btn {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: 999px;
  font-size: 12px;
  /* Fix-2 item 4: `--fg`/`--popup-bg` (global, app-theme-only) → `--text-1`/`--pop-bg` (this
     area's own is-light-aware tokens, same root cause as `.lb-icon-btn` above). `--blur` is left
     as the shared global structural token -- it's a blur radius, not a color, and this codebase's
     convention is that non-color structural values stay shared (see CLAUDE.md's theming section). */
  color: var(--text-1);
  background: var(--pop-bg);
  backdrop-filter: var(--blur);
  cursor: pointer;
  user-select: none;
  touch-action: none;
}

/* `.lb-nav`'s shape/position/color/backdrop/:hover are now byte-owned by parity's own
   `.photos-root .lb-nav` family (photos.scss:638-647); only the two properties parity doesn't
   declare survive locally -- the stacking order above the media layer and an explicit pointer
   cursor (some UA button resets default to `cursor: default`). `[data-side="prev"|"next"]`'s
   `left`/`right: 16px` is also a byte-exact parity duplicate, retired the same way. */
.lb-nav { z-index: 3; cursor: pointer; }
/* New-UI addition, no Vue2 source (M3): Vue2's own disabled-nav opacity rule (parity's verbatim
   transcription targets a data-* attribute this file's own dead-code test above asserts stays
   unwired, control ruling 5) is dead code in Vue2 too -- its template never sets that attribute on
   `.lb-nav`. This component instead wires the real, native `:disabled` attribute
   (`:disabled="!lb.hasPrev.value"` etc.), so the disabled-visual needs an actual local rule to
   have any effect -- parity has no LIVE counterpart to defer to here. */
.lb-nav:disabled { opacity: 0.35; cursor: default; }

/* The `:deep(.lb-info)` margin override (previously `margin: 16px 16px 16px 0`) is retired -- it
   was a New-UI-only inset around an otherwise self-contained "card" look (see PhotoInfoPanel.vue's
   own Plan F Task 5 note for that card look being retired too), diverging from parity's flush
   panel (`.photos-root .lb-info` sits flush in its grid cell, no margin at all -- Vue2's real
   lightbox never floats this panel). Now that both sides agree on a flush panel, no local margin
   override is needed. */

/* `.lb-confirm-scrim`/`.lb-confirm`/`.lb-confirm-icon`/`.lb-confirm-title`/`.lb-confirm-foot` and
   the whole `.trash-btn-ghost`/`.trash-btn-cta`/`.trash-btn-cta-danger` family are retired --
   parity's own nested `.photos-root .lb-confirm { … }` (photos.scss:730-793) already implements
   every one of these under the exact same selectors, including the `.trash-btn-*` button family
   this dialog adopted in Task 3. The deeply-nested ones (`.lb-confirm-icon`/`-title`/`-foot`/
   `.trash-btn-*`, each an extra SCSS nesting level under `.lb-confirm`) compile to MORE classes
   than this component's scoped copies and were always going to win outright, no tie involved;
   `.lb-confirm-scrim`/`.lb-confirm` themselves tie at equal specificity with the local scoped
   rule (both two classes) -- the same import-order hazard as everything else retired in this
   file, resolved the same way: delete the local duplicate so there's nothing left to tie with.
   `.lb-confirm-body` keeps the two properties parity doesn't declare (`margin-top`/`line-height`;
   parity uses `margin-bottom` on the same element instead, a different property, so no conflict
   and no double-spacing). New-UI addition, no Vue2 source (M4): Vue2's own `.lb-confirm-body`
   (PhotosLightbox.vue:156) has no `margin-top`/`line-height` of its own either -- both properties
   are New-UI-only spacing choices with nothing to cite on the Vue2 side, kept because they don't
   collide with anything parity declares. */
.lb-confirm-body { margin-top: 8px; line-height: 1.5; }
</style>
