<script setup lang="ts">
// Task 5 (SP7-P4 albums): 'Add to album' picker — reused by three hosts (timeline batch toolbar /
// favorites view / lightbox top bar; T9 wiring). Structure from Vue2 NimoOS-UI
// src/views/Photos/PhotosTimeline.vue:1040-1065 album selection overlay (mask + panel + list +
// '+ New Album' row), behavior from :582-607 (onBatchAlbum/pickAlbum/createAndPickAlbum).
//
// Form deviation registry (scope narrowed, brief requirement): Vue2 uses window.prompt to collect
// new album name; this repo has no prompt convention and narrow-screen UX is poor; changed to
// inline input row in panel (Enter to submit / Esc to close); behavior semantics unchanged.
//
// Key semantic difference from Vue2 (brief requirement, not oversight): failure path does not close
// panel — Vue2's createAndPickAlbum just console.error swallows exceptions; this component
// changed to toast the failure text and keep the panel open (including preserving input row
// content); this way users see the failure reason and can retry, not silent no-response.
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { usePhotosAlbums } from '../stores/albums'
import { albumToView } from '../util/albumView'
import { isConflict } from '../util/httpErrors'
import { useToast } from '../../stores/toast'

const props = defineProps<{ open: boolean; assetIds: Array<string | number> }>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'added', albumId: string | number, count: number): void
}>()

const { t } = useI18n()
const albums = usePhotosAlbums()
const toast = useToast()

const creating = ref(false)
const newName = ref('')
const newInputRef = ref<HTMLInputElement | null>(null)

// Final review mandatory 2: reentry guard. `creating` is only a display flag for 'input row
// expanded', not an in-flight guard — two independent async entries each need one: `adding`
// guards pick() (repeated clicks on the same album item repeat addAssetsToAlbum), `submitting`
// guards submitCreate() (repeated Enter presses repeat createAlbum). Deliberately don't share one
// ref — after submitCreate succeeds it internally calls pick(); if both share a flag, the guard
// in pick() after submitCreate sets it will also block this internal call (createAlbum succeeds
// but misses the following addAssetsToAlbum, existing 'create then add' flow gets hurt by its own
// reentry guard). This is the third occurrence of this class of bug this phase (T7 PhotosAlbums.vue
// `creating`, T10 PhotosFavorites.vue `saveAlbumSaving` both already had guards added), this
// component is the last of four creation entry points to complete the fix.
const adding = ref(false)
const submitting = ref(false)

// Rule: id comparison always normalizes with String(), no object reference ===.
function sameId(a: string | number, b: string | number): boolean {
  return String(a) === String(b)
}

const views = computed(() => albums.albums.map((a) => albumToView(a, t('photosAlbumUntitled'))))
// When assetIds is empty, not only do existing album items need disabled (brief requirement), but
// the '+ new album' entry also must be disabled — otherwise createAlbum, which has persistent side
// effects (really creates an album), will execute, but the following pick() is short-circuited by
// the same canSubmit, leaving the user with no feedback for the input row still there (review Minor 2).
const canSubmit = computed(() => props.assetIds.length > 0)

function thumb(cover: string | number): string {
  return service.photos.thumbnailUrl(cover, 'small')
}

function close(): void {
  emit('update:open', false)
}

// Esc layering, document-level listener (don't use template @keydown.esc) — review-flagged
// functional bug: template-bound keydown depends on real DOM focus being on overlay/input, but
// when user opens panel from trigger button outside the panel and presses Esc without clicking
// inside panel, focus is still on the trigger button, event never reaches overlay, can't close
// panel; after first Esc closes input row, input is unmounted by v-else, focus falls back to body,
// second Esc also breaks chain. Per PhotosSidebar.vue:22-27 / PhotoLightbox.vue:119-140 existing
// pattern, changed to document listener; watch(open) manages attach/remove, onUnmounted has
// fallback cleanup.
//
// Final review mandatory 1: this component is often opened by lightbox (T9) from its top bar
// 'add to album' button, lightbox has its own keydown on window (PhotoLightbox.vue:144). Native
// keydown bubbles by default (bubbles:true), bubble order is document before window — without
// stopPropagation, after closing the panel here, the same Esc continues bubbling to window and
// closes the lightbox too (T9 design clearly 'lightbox itself doesn't close', PhotoLightbox.vue
// :51-52 comment). Block it at document phase, prevent it from bubbling to window.
function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  e.stopPropagation()
  if (creating.value) cancelCreate()
  else close()
}

// Per Vue2 onBatchAlbum:584 — refresh album list before opening; Vue2 doesn't await, doesn't block
// rendering, same here. immediate:true — host (T9) might keep this component mounted permanently,
// only toggling open prop, or might only mount when open===true; both cases need to refresh list at
// 'visible' moment, not just the false→true change.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      void albums.fetchAlbums()
      document.addEventListener('keydown', onDocumentKeydown)
    } else {
      creating.value = false
      newName.value = ''
      document.removeEventListener('keydown', onDocumentKeydown)
    }
  },
  { immediate: true },
)
onUnmounted(() => document.removeEventListener('keydown', onDocumentKeydown))

async function pick(albumId: string | number): Promise<void> {
  if (!canSubmit.value || adding.value) return
  adding.value = true
  const view = views.value.find((v) => sameId(v.id, albumId))
  const name = view?.title ?? t('photosAlbumUntitled')
  const count = props.assetIds.length
  try {
    await albums.addAssetsToAlbum(albumId, props.assetIds)
    emit('added', albumId, count)
    toast.show(t('photosAlbumAddedToast', { count, name }))
    close()
  } catch {
    toast.show(t('photosAlbumAddFailed'))
    // Panel stays open — don't close().
  } finally {
    adding.value = false
  }
}

function startCreate(): void {
  creating.value = true
  newName.value = ''
  void nextTick(() => newInputRef.value?.focus())
}

function cancelCreate(): void {
  creating.value = false
}

async function submitCreate(): Promise<void> {
  const name = newName.value.trim()
  if (!name || submitting.value) return
  submitting.value = true
  try {
    const created = await albums.createAlbum(name)
    await pick(created.id as string | number)
    // pick success closes on its own; if pick internal failure (addAssetsToAlbum throws),
    // pick already toasted failure text and didn't close panel — don't repeat here, creation itself
    // succeeded. pick() uses independent `adding` guard, not affected by `submitting` set here; both
    // real network calls happen normally.
  } catch (e) {
    toast.show(isConflict(e) ? t('photosAlbumNameExists') : t('photosAlbumCreateFailed'))
    // Panel doesn't close, input row preserves content (newName not cleared).
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div
    v-if="open"
    class="album-picker-overlay"
    data-test="album-picker-overlay"
    @click.self="close"
  >
    <div class="album-picker-panel">
      <div class="album-picker-head">
        <span class="album-picker-title-text">{{ t('photosAddToAlbumTitle') }}</span>
        <button type="button" class="album-picker-close" :aria-label="t('photosClose')" @click="close">×</button>
      </div>

      <div class="album-picker-body">
        <div v-if="views.length === 0" class="album-picker-empty" data-test="album-picker-empty">
          {{ t('photosAddToAlbumEmpty') }}
        </div>

        <button
          v-for="v in views"
          :key="v.id"
          type="button"
          class="album-picker-item"
          data-test="album-picker-item"
          :disabled="!canSubmit"
          @click="pick(v.id)"
        >
          <span v-if="v.cover" class="album-picker-cover">
            <img :src="thumb(v.cover)" alt="">
          </span>
          <span v-else class="album-picker-cover album-picker-cover-empty" data-test="album-picker-cover-empty"></span>
          <span class="album-picker-info">
            <span class="album-picker-item-title">{{ v.title }}</span>
            <span class="album-picker-item-count">{{ t('photosItemsCount', { count: v.count }) }}</span>
          </span>
        </button>

        <button
          v-if="!creating"
          type="button"
          class="album-picker-item album-picker-new"
          data-test="album-picker-new"
          :disabled="!canSubmit"
          @click="startCreate"
        >
          {{ t('photosAddToAlbumNew') }}
        </button>
        <div v-else class="album-picker-new-row">
          <input
            ref="newInputRef"
            v-model="newName"
            type="text"
            class="album-picker-new-input"
            data-test="album-picker-new-input"
            @keydown.enter="submitCreate"
          >
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Task 7 (the two-picker class-name rework): overlay/panel/head/body/item(+:hover)/new/empty
   are character-for-character the same names as the already-imported global parity stylesheet
   (src/photos/styles/vue2-parity/photos.scss:1043-1074, `.photos-root .album-picker-*`) — those
   rules are deleted wholesale here and parity takes over directly, with no local restatement
   (otherwise two declarations of the same property tie on scoped specificity and the winner is
   decided by load order, an invisible source of pixel drift — the exact trap hit during the T3
   albums-dialog cleanup). Only selectors parity does not cover at all survive below, each with
   its own comment explaining why. */

/* Structural supplement (not covered by parity): this component's album row carries a cover
   thumbnail plus a two-column title/count layout, and uses a native <button> to express the
   clickable semantics (Vue2's version is a plain-text <div> that creates albums through
   window.prompt, with no cover/count sub-structure at all) — only the flex layout and the button
   appearance reset survive here, two categories parity does not touch;
   padding/font-size/color/cursor/transition still come from parity's .album-picker-item and are
   not restated. */
.album-picker-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: 0;
  background: transparent;
  font-family: inherit;
  text-align: left;
}
/* Parity has no rule for the disabled state (Vue2 has no such state) — a New-UI safeguard for
   the empty-assetIds case. */
.album-picker-item:disabled { opacity: 0.45; cursor: not-allowed; pointer-events: none; }

/* Header close button: Vue2 reuses the site-wide .icon-btn (photos.scss:229-237, a 32px circle
   plus the photos-icon component). This repo's dialogs (MergeReviewDialog.vue `.mrd-close`,
   ClusterActionDialog.vue `.cad-close`, the New Album layer's `.albums-modal-close` in
   PhotosAlbums.vue) consistently use a smaller 24px dedicated close-button class instead of
   reusing .icon-btn — a continuation of the established local idiom, with no parity selector
   to compare against. */
.album-picker-close {
  width: 24px; height: 24px; border-radius: 50%; border: 0; background: transparent;
  color: var(--text-2); font-size: 15px; line-height: 1; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.album-picker-close:hover { background: var(--surface-3); color: var(--text-1); }

/* Title text (the `.album-picker-title-text` span in the template, with no rule of its own —
   recorded during Task 8's static self-check): no local font-size/font-weight/color is declared
   any more. Parity's own .album-picker-head is already a font-size:13px; font-weight:600 flex
   container (space-between naturally pushes the title and the close button to opposite ends), so
   keeping a local override here would quietly turn 13px into 14.5px — pixel drift. With it gone,
   parity's header type size governs, matching Vue2's own bare <span> (likewise unclassed,
   inheriting the ambient colour). The class name stays as a structural marker. */

/* Cover thumbnail / empty placeholder — Vue2's window.prompt flow shows no cover at all; this is
   a feature addition unique to this component (a shape deviation the brief registers explicitly),
   with no parity selector to match. */
.album-picker-cover {
  flex: 0 0 auto; width: 40px; height: 40px; border-radius: 8px; overflow: hidden;
  border: 1px solid var(--line); background: var(--surface-2);
}
.album-picker-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.album-picker-cover-empty { background: linear-gradient(135deg, var(--grad-a), var(--grad-b)); }

/* The two-column title + count information area — as above, parity's plain-text row has no such
   sub-structure. */
.album-picker-info { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.album-picker-item-title { font-size: 13px; font-weight: 500; color: var(--text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.album-picker-item-count { font-size: 11px; color: var(--text-2); }

/* .album-picker-new's colour is now owned by parity (`color: var(--accent-hi)`), and the
   font-size/font-weight overrides that used to sit here are deleted along with it — Vue2's
   "+ New Album" row has always carried the same weight as an ordinary album row, not a bolded
   emphasis, so removing them matches Vue2. */

/* The inline create-album input row — a shape deviation registered in the brief (Vue2 uses
   window.prompt, this repo uses an inline input row inside the panel), so parity naturally has no
   matching selector. */
.album-picker-new-row { padding: 8px; }
.album-picker-new-input {
  width: 100%; height: 34px; padding: 0 10px; border-radius: 8px;
  border: 1px solid var(--line); background: var(--surface-2); color: var(--text-1);
  font: inherit; font-size: 13px;
}
.album-picker-new-input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
</style>
