<script setup lang="ts">
// P2 Lightbox shell — structure ported from Vue2 NimoOS-UI src/views/Photos/PhotosLightbox.vue,
// state entirely from useLightbox() singleton (T2/T3), static stage delegated to PhotoImageViewer (T5, with built-in bottom zoom bar).
// Delta (see task-6-brief.md): 1) Add to album added back at P4 (Task 9), Ask Nimo still in SP8; 2) Info panel togglable (layout placeholder to T7);
// 3) No zoom button in top bar (PhotoImageViewer owns bottom zoom bar, reduces cross-component ref); 4) Current item always compared by id.
// Task 9 finalization: mount PhotoInfoPanel at T7 (reads lb.detail, hydrated metadata rather than list-item placeholder
// current) and PhotoFilmstrip at T8 (absolute index select → lb.goTo). PhotoInfoPanel's own styles assume
// "side-by-side flex row" layout (it carries flex:0 0 auto internally), so wrapping stage from standalone lb-stage flex:1 column item
// with one .lb-body layer (row flex), letting info panel and stage sit side-by-side instead of forcing old T6's absolute positioning .lb-info placeholder
// (already deleted; info panel positioning now owned by PhotoInfoPanel's own styles).
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

const showInfo = ref(false) // Info panel (T7 fill); default closed, togglable
const confirmDelete = ref(false)

// URL generator (bare, with token) — thin wrapper for template calls
const originalUrl = (id: string | number) => service.photos.originalUrl(id)
const thumbnailUrl = (id: string | number, size = 'large') => service.photos.thumbnailUrl(id, size)
const liveUrl = (id: string | number) => service.photos.liveUrl(id)

const downloadName = (): string => {
  const d = lb.detail.value
  const cur = lb.current.value
  const title = d?.title ?? cur?.title
  return title != null && title !== '' ? String(title) : `photo-${cur?.id ?? ''}`
}

// —— Favorite —— (toggleFav already optimistically persisted in useLightbox; emit is only for P3 broadcast)
function onToggleFav(): void {
  const cur = lb.current.value
  if (!cur) return
  void lb.toggleFav() // Sync optimistic flip favIds → isFav immediately reflects new state
  emit('toggle-fav', cur.id, lb.isFav.value)
}

// —— Add to album —— (per Vue2 PhotosLightbox.vue:13-14: emit only, no logic; host handles T5
// AlbumPickerDialog opening panel, lightbox itself does not close).
function onAddToAlbum(): void {
  const cur = lb.current.value
  if (!cur) return
  emit('add-to-album', cur.id)
}

// —— Delete confirmation —— (per Vue2 :151-165)
function doDelete(): void {
  const cur = lb.current.value
  if (!cur) return
  confirmDelete.value = false
  emit('delete', cur.id)
  lb.close()
}

// —— Chrome auto-hide after 5s idle —— (reuse same isMoving + timer as T5; declare before video seek watch
// to avoid open-watch's immediate:true branch referencing uninitialized hideTimer in edge cases)
const isMoving = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null
function onMouseMove(): void {
  isMoving.value = true
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => { isMoving.value = false; hideTimer = null }, 5000)
}

// —— Video resume from playback position —— (per Vue2 applyStartTime :335-344: seek only the first matching video on this open)
// This component is persistently mounted by its parent (self-gated internally via v-if="lb.open.value"), and at onMounted the lightbox is usually not yet open,
// at which point lb.current is null; the anchor can only be captured at the moment open goes true (see watch), otherwise startPhotoId remains null forever,
// applyStartTime early-returns forever, and resume fails.
// This same persistent-mount pitfall entangles two other pieces of state, so this one open-watch handles both:
// 1) Chrome auto-hide (isMoving) only arms a 5s timer once in onMounted — the component hangs around permanently, lightbox stays closed,
//    the timer expires long ago, when truly opening at openAt isMoving is already false, nav arrows all hidden, looks like they didn't render.
//    (Since 2026-07-31 top bar is no longer governed by isMoving — it is opaque in-flow chrome, always visible, see template comment.)
//    Each open re-runs onMouseMove() once, guaranteeing "just opened" means chrome visible + timer restarted.
// 2) showInfo is a component-level ref; open→close→reopen carries the previous toggle state, violating "info panel default closed"
//    design; explicitly reset to false each open.
const videoEl = ref<HTMLVideoElement | null>(null)
let startApplied = false
let startPhotoId: string | number | null = null
watch(
  () => lb.open.value,
  (isOpen) => {
    if (isOpen) {
      startApplied = false
      startPhotoId = lb.current.value?.id ?? null
      onMouseMove()
      showInfo.value = false
    }
  },
  { immediate: true }, // Handle edge case where component mounts after lightbox already open
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

// —— Live photo press-to-play —— (net-new: Vue2 lightbox didn't implement; hold badge to play overlay video, release to stop and hide)
const liveActive = ref(false)
const liveVideoEl = ref<HTMLVideoElement | null>(null)
function liveStart(): void {
  liveActive.value = true
  void nextTick(() => { void liveVideoEl.value?.play?.().catch(() => {}) })
}
function liveStop(): void {
  const v = liveVideoEl.value
  try { v?.pause?.() } catch { /* jsdom / not ready */ }
  liveActive.value = false
}

// —— Keyboard —— (per Vue2 :360-370; Escape only closes modal when confirmDelete is open)
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
    <!-- Top toolbar. User 2026-07-31 acceptance requirement: opaque top bar, image shows between top and bottom bars —
         so it is an in-flow flex item (not position:absolute covering stage) and **does not participate in 5s auto-hide**
         (once opaque chrome hides, stage grows and image jumps; nav arrows still auto-hide with isMoving,
         they are overlays stacked on the photo). -->
    <div class="lb-top">
      <button class="lb-icon-btn lb-close" type="button" :title="t('photosClose')" @click="lb.close()">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
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

    <!-- Stage + info panel: side-by-side flex row (info panel styles assume it is a flex item in row, see top comment) -->
    <div class="lb-body">
    <div class="lb-stage">
      <div class="lb-media" :key="String(lb.current.value?.id ?? '')">
        <!-- (a) Video -->
        <video
          v-if="lb.current.value?.isVideo"
          ref="videoEl"
          class="lb-video"
          :src="originalUrl(lb.current.value.id)"
          :poster="thumbnailUrl(lb.current.value.id, 'large')"
          controls
          preload="metadata"
          playsinline
          @loadedmetadata="applyStartTime"
        ></video>

        <!-- (b) Live photo (non-video): static image + badge + press-to-play -->
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
          <button
            class="lb-live-badge"
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

      <!-- Nav arrows -->
      <button
        v-if="isMoving"
        class="lb-nav lb-nav-prev"
        type="button"
        :disabled="!lb.hasPrev.value"
        :title="t('photosPrev')"
        @click="lb.prev()"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>
      </button>
      <button
        v-if="isMoving"
        class="lb-nav lb-nav-next"
        type="button"
        :disabled="!lb.hasNext.value"
        :title="t('photosNext')"
        @click="lb.next()"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>
      </button>
    </div>

    <!-- Info panel (T7): reads hydrated lb.detail, not list-item placeholder lb.current -->
    <PhotoInfoPanel :photo="lb.detail.value" :visible="showInfo" />
    </div>

    <!-- Filmstrip (T8): absolute index select → lb.goTo -->
    <PhotoFilmstrip :list="lb.list.value" :index="lb.index.value" @select="lb.goTo" />

    <!-- Delete confirmation modal -->
    <div v-if="confirmDelete" class="lb-confirm-scrim" @click.self="confirmDelete = false">
      <div class="lb-confirm">
        <div class="lb-confirm-title">{{ t('photosDeleteConfirmTitle') }}</div>
        <div class="lb-confirm-body">{{ t('photosDeleteConfirmBody') }}</div>
        <div class="lb-confirm-foot">
          <button class="lb-confirm-cancel" type="button" @click="confirmDelete = false">{{ t('photosCancel') }}</button>
          <button class="lb-confirm-ok danger" type="button" @click="doDelete">{{ t('photosConfirmDelete') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  background: var(--app-bg);
}
/* User 2026-07-31 acceptance: top bar now opaque in-flow chrome (previously position:absolute + black-to-transparent
   gradient covering stage, image would peek under it). As in-flow item .lb-body (flex:1) now naturally fills
   only between top bar and bottom filmstrip, image is sandwiched between both; with solid --popup-bg background,
   text/icons in the bar press against theme surface not photo; the old "fixed darkening for contrast" theme-exception no longer applies. */
.lb-top {
  flex: 0 0 auto;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--popup-bg);
  border-bottom: 1px solid var(--card-border);
}
.lb-titlebox { display: flex; flex-direction: column; min-width: 0; }
.lb-title { font-size: 14px; font-weight: 600; color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lb-sub { font-size: 12px; color: var(--fg-muted); }
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
  color: var(--fg);
  cursor: pointer;
}
.lb-icon-btn:hover { background: var(--tool-bg-hi, rgba(255, 255, 255, 0.12)); }
.lb-fav.is-fav { color: var(--star-fg, #ffd60a); }
/* theme-exception: favorite star solid gold is cross-theme fixed semantic color */
.lb-info-toggle.active { background: var(--tool-bg-hi, rgba(255, 255, 255, 0.12)); color: var(--accent); }
.lb-icon-btn.danger:hover { color: var(--remove-fg, #ff5d5d); }

.lb-body {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
  overflow: hidden;
}
.lb-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.lb-media {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lb-video { max-width: 100%; max-height: 100%; }
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
.lb-live-badge {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: 999px;
  font-size: 12px;
  color: var(--fg);
  background: var(--popup-bg, rgba(0, 0, 0, 0.5));
  backdrop-filter: var(--blur);
  cursor: pointer;
  user-select: none;
  touch-action: none;
}

.lb-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 999px;
  color: var(--fg);
  background: var(--popup-bg, rgba(0, 0, 0, 0.4));
  backdrop-filter: var(--blur);
  cursor: pointer;
}
.lb-nav:hover { background: var(--tool-bg-hi, rgba(255, 255, 255, 0.16)); }
.lb-nav:disabled { opacity: 0.35; cursor: default; }
.lb-nav-prev { left: 16px; }
.lb-nav-next { right: 16px; }

/* PhotoInfoPanel (T7) carries its own positioning/size/color styles (.info-panel), here we only manage its margins in the lightbox,
   not redefine appearance. Top margin was originally 64px — to make room for absolutely-positioned top bar; since 2026-07-31
   top bar is now in-flow chrome it no longer needs that offset, uniform 16px on all sides; otherwise info panel sinks below stage in the same row. */
:deep(.info-panel) { margin: 16px 16px 16px 0; }

.lb-confirm-scrim {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--scrim, rgba(0, 0, 0, 0.55));
  /* theme-exception: modal overlay darkening layer, theme-independent */
}
.lb-confirm {
  width: 340px;
  max-width: 90vw;
  padding: 22px;
  border-radius: 16px;
  /* Use --popup-bg (opaque popup color: dark theme deep blue glass 0.9/0.95, light theme solid white),
     not --card-bg — the latter in dark theme is nearly-transparent white glass (alpha 0.085~0.26), layered on lightbox's dark background
     it shows through (real device acceptance feedback: delete modal is "transparent"). Two themes each have their own distinct solid background. */
  background: var(--popup-bg);
  border: 1px solid var(--border);
  color: var(--fg);
  box-shadow: var(--media-overlay-shadow, 0 12px 40px rgba(0, 0, 0, 0.4));
}
.lb-confirm-title { font-size: 16px; font-weight: 600; }
.lb-confirm-body { margin-top: 8px; font-size: 13px; color: var(--fg-muted); line-height: 1.5; }
.lb-confirm-foot { margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px; }
.lb-confirm-cancel,
.lb-confirm-ok {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--fg);
  font-size: 13px;
  cursor: pointer;
}
.lb-confirm-cancel:hover { background: var(--tool-bg-hi, rgba(255, 255, 255, 0.1)); }
.lb-confirm-ok.danger {
  border-color: color-mix(in srgb, var(--remove-fg, #ff5d5d) 45%, transparent);
  color: var(--remove-fg, #ff5d5d);
}
.lb-confirm-ok.danger:hover { background: color-mix(in srgb, var(--remove-fg, #ff5d5d) 20%, transparent); }
</style>
