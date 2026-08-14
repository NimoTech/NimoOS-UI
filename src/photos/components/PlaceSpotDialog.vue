<script setup lang="ts">
// P6b-T4: PlaceSpotDialog.vue — "photo spot" dialog inside the place-detail panel. Note it's not
// a floating layer (no Esc-document listener, no overlay) — it's an embedded card at the top of
// PlaceDetailPanel.vue `.detail-body`; mount/unmount controlled by the host based on whether
// activeSpotKey hits the spots list. Ported segment-by-segment from Vue2 NimoOS-UI
// src/views/Photos/PhotosPlacesView.vue:1109-1150 (template), :290-303 (watch(spotDialog) exit
// edit mode), :486-516 (startSpotRename/saveSpotName nextTick focus + trim); styles from
// photos-places.scss:620-654.
//
// Division of concerns: pure display + emit; does not touch store, does not make requests — host
// responsible for actually calling store.setSpotName / store.resetSpotName and passing
// store.spotBusy through as this component's busy prop.
//
// Deviation registration 7 (brief text): props.spot has no local copy — Vue2 triggers watch(
// spotDialog) to exit edit mode via "reassigning this.spotDialog = { spot: fresh }" new object;
// here no wrapper object, only bare spot prop, thus:
//  · non-edit-mode name/coords/stats all read directly from props.spot.* — after successful
//    rename, host passes new detail.spots down, immediately shows new value here, no extra
//    signal needed.
//  · edit-mode exit handled by two watches, neither does optimistic exit (not exit on "save
//    click" action itself, only on "data from host actually changed"); "props.spot.key change"
//    (pins Vue2 watch :303 semantics: switched to different spot) + "props.spot.name change"
//    (review fix I2: pins Vue2 saveSpotName :495-516 visible behavior of immediate exit on
//    success and keeping edit mode on failure — name truly rewritten by store to exit, on failure
//    name unchanged, continues editing, does not lie).
//
// Deviation registration 16 (user decision 2026-07-31 pre-flight; brief text): coordinate line
// no longer copies Vue2's hard-coded `° N`/`° E` (south/west hemisphere displays wrong direction);
// changed to use T2's formatSpotCoords to output N/S/E/W by sign.
//
// D8 (user-authorized new addition, net-new — Vue2 has no button/capability at all, only service-
// layer resetSpotName with zero call sites in the entire repo): "Reset to default name" button,
// see .spot-dialog-reset below.
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { formatSpotCoords } from '../util/placesMap'
import type { PlaceSpot } from '../stores/places'

const props = defineProps<{
  spot: PlaceSpot
  busy: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'rename', name: string): void
  (e: 'reset-name'): void
  (e: 'open-library'): void
  (e: 'open-photo', assetId: string): void
}>()

const { t } = useI18n()

const editing = ref(false)
const draftName = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

// Copy Vue2 watch :303 (`spotDialog() { this.spotEditing = false }`) — that watch triggers on
// "entire spotDialog object reassigned" in Vue2, covering both "opened different spot" and "after
// successful rename, loadDetail reconstructed new object with same key". Here no wrapper object,
// only pin "switched to different spot" (see deviation registration 7 at file head).
watch(
  () => props.spot.key,
  () => { editing.value = false },
)

// Review fix I2 (fix round 1): source Vue2 saveSpotName :495-516 — immediately `spotEditing =
// false` after `await` success; only on failure (empty catch block, explicitly "keep editing open
// on failure") does edit mode persist. Here no visibility into network request (container/store
// knows success/failure), but can't have no exit path on success — reroute to real data: on
// setSpotName success, store rewrites detail.spots matched item's name in-place; on resetSpotName
// success, store does `await loadDetail` to re-fetch; both paths make host-passed spot.name
// change; on failure name unchanged, edit mode persists. Semantics equivalent to Vue2's visible
// behavior, and doesn't lie on failure. Known edge case (review accepted, no handling): draft
// becomes identical to current name, then save; name unchanged, edit mode doesn't exit (Vue2
// would exit — it unconditionally sets spotEditing=false on submit, regardless of actual change).
watch(
  () => props.spot.name,
  () => { editing.value = false },
)

// Copy Vue2 startSpotRename :486-494: draft initial value = current name, focus input after
// nextTick.
function startRename(): void {
  draftName.value = props.spot.name
  editing.value = true
  void nextTick(() => inputRef.value?.focus())
}

function cancelRename(): void {
  editing.value = false
}

const canSubmitRename = computed(() => draftName.value.trim().length > 0 && !props.busy)

// Copy Vue2 saveSpotName :495-496 trim; whether to actually call backend decided after host
// receives rename event.
function submitRename(): void {
  if (!canSubmitRename.value) return
  emit('rename', draftName.value.trim())
}

// Deviation registration 16: entire line doesn't render if formatSpotCoords returns empty string
// (NaN/invalid value → '').
const coordsText = computed(() => formatSpotCoords(props.spot.lat, props.spot.lon))

const thumbSrc = computed(() =>
  props.spot.thumb ? service.photos.thumbnailUrl(props.spot.thumb, 'small') : '',
)

function onThumbClick(): void {
  if (!props.spot.thumb) return
  emit('open-photo', props.spot.thumb)
}
</script>

<template>
  <div class="spot-dialog">
    <div class="spot-dialog-head">
      <svg
        viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        style="color: var(--accent-text); flex: none"
      ><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></svg>
      <div style="flex:1;min-width:0">
        <div v-if="!editing" class="spot-dialog-name">
          <span class="one-line">{{ spot.name }}</span>
          <button
            type="button" class="spot-rename-btn" :title="t('photosPlacesSpotRename')"
            @click="startRename"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4 20 10M3 21l4-1 11-11-3-3L4 17z" /></svg>
          </button>
        </div>
        <div v-else class="spot-rename">
          <input
            ref="inputRef" v-model="draftName" class="spot-rename-input"
            maxlength="60" :placeholder="t('photosPlacesSpotNamePlaceholder')"
            @keyup.enter="submitRename" @keyup.esc="cancelRename"
          >
          <button
            type="button" class="spot-rename-save" :disabled="!canSubmitRename"
            @click="submitRename"
          >
            {{ t('photosPlacesSpotSave') }}
          </button>
          <button type="button" class="spot-rename-cancel" @click="cancelRename">
            {{ t('photosCancel') }}
          </button>
          <!-- D8 (user-authorized new addition 2026-07-31, net-new — Vue2 has no button, only
               service-layer resetSpotName with zero call sites): reset place to default name. -->
          <button
            type="button" class="spot-dialog-reset" :disabled="busy"
            @click="emit('reset-name')"
          >
            {{ t('photosPlacesSpotResetName') }}
          </button>
        </div>
        <div v-if="coordsText" class="spot-dialog-coords">
          {{ coordsText }}
        </div>
      </div>
      <button type="button" class="icon-btn" @click="emit('close')">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
      </button>
    </div>

    <div class="spot-dialog-stat">
      <b>{{ spot.count }}</b> {{ t('photosPlacesPhotosShotHere') }}
    </div>

    <div class="spot-dialog-thumbs">
      <img
        v-if="spot.thumb" :src="thumbSrc" alt=""
        style="cursor: pointer" @click="onThumbClick"
      >
    </div>

    <button type="button" class="spot-dialog-btn" @click="emit('open-library')">
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 14l5-4 4 3 3-2 6 5" /></svg>
      {{ t('photosPlacesSpotViewInLibrary') }}
      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6" /></svg>
    </button>
  </div>
</template>

<style scoped>
/* Token mapping (Vue2 → New-UI; same as table in PlaceDetailPanel.vue file head §6): --text-1/2/3
   → --fg/--fg-muted/--fg-subtle; --surface-2 → --chip-bg; --line → --card-border;
   --r-sm → --radius-sm. */
.spot-dialog {
  margin-bottom: 16px;
  padding: 14px;
  background: var(--accent-soft);
  /* This repo lacks --accent-rgb token: Vue2's border color (accent rgb value with 0.3 opacity)
     replaced with this repo's established --accent-soft-bd (dark theme .36 / light theme .30,
     both theme sets already defined). */
  border: 1px solid var(--accent-soft-bd);
  border-radius: 12px;
}
.spot-dialog-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.spot-dialog-name { font-size: 13.5px; font-weight: 600; color: var(--fg); display: flex; align-items: center; gap: 6px; }
/* Review fix I1 (fix round 1): Vue2 `.one-line` is global utility class (NimoOS-UI
   src/assets/scss/common/_others.scss:55, -webkit-box + line-clamp:1 single-line ellipsis), but
   each SFC here is scoped island with no corresponding global stylesheet — `.one-line` was an
   ineffective shell class, long place names wrap/overflow and squeeze close button on right. Add
   equivalent single-line ellipsis triple, same as existing precedent in files/viewers/ViewerShell
   .vue `.one-line`(:47) (white-space:nowrap version; visual effect equivalent to Vue2's -webkit-
   line-clamp:1, simpler syntax). Same root cause as T3's missing backdrop-filter: when rewriting
   Vue2 inline/global styles to this repo's scoped pattern, easy to miss comparing line-by-line;
   programmatic assertions see PlaceSpotDialog.test.ts. min-width:0 prerequisite for flex child
   ellipsis to work (else flex item defaults to min-width:auto, expands instead of clipping). */
.spot-dialog-name .one-line {
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.spot-dialog-coords {
  font-size: 11px; color: var(--fg-subtle);
  /* This repo's monospace uses existing --num-font, does not copy Vue2's ui-monospace, SFMono-
     Regular, monospace font stack. */
  font-family: var(--num-font);
  margin-top: 2px;
}
.spot-rename-btn {
  flex: none; display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border: none; border-radius: 6px;
  background: transparent; color: var(--fg-subtle); cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.spot-rename-btn:hover { background: var(--chip-bg); color: var(--fg); }
.spot-rename { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.spot-rename-input {
  flex: 1; min-width: 0; height: 26px; padding: 0 8px;
  /* M1 (review fix round 1, registered while here): Vue2's input border uses an accent semi-
     transparent token with fallback value (literal fallback when token undefined; same semantic
     "softer border than accent") — this repo already has exactly matching --accent-soft-bd, use
     it directly, not just matching nearby color. */
  border: 1px solid var(--accent-soft-bd);
  border-radius: 6px; background: var(--chip-bg);
  color: var(--fg); font: inherit; font-size: 12.5px; outline: none;
}
.spot-rename-input:focus { border-color: var(--accent); }
.spot-rename-save, .spot-rename-cancel, .spot-dialog-reset {
  flex: none; height: 26px; padding: 0 10px; border-radius: 6px;
  font: inherit; font-size: 11.5px; font-weight: 500; cursor: pointer;
  border: 1px solid var(--card-border); background: transparent; color: var(--fg-muted);
}
.spot-rename-save { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.spot-rename-save:disabled { opacity: 0.4; pointer-events: none; }
.spot-rename-cancel:hover { color: var(--fg); }
/* D8 (net-new): styling reuses .spot-rename-cancel ghost form, disabled with same handling when
   busy. */
.spot-dialog-reset:hover { color: var(--fg); }
.spot-dialog-reset:disabled { opacity: 0.4; pointer-events: none; }
.spot-dialog-stat { font-size: 11.5px; color: var(--fg-muted); margin-bottom: 10px; }
.spot-dialog-stat b { color: var(--fg); font-weight: 600; }
.spot-dialog-thumbs { display: grid; grid-template-columns: repeat(6, 1fr); gap: 3px; margin-bottom: 10px; }
.spot-dialog-thumbs img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 4px; }
.spot-dialog-btn {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px;
  height: 32px; padding: 0 12px; border-radius: 8px;
  background: var(--accent); border: 0; color: var(--on-accent);
  font: inherit; font-size: 12px; font-weight: 500; cursor: pointer;
}
/* This repo lacks --accent-hi: hover uses this repo's established pattern (precedent
   PhotosPersonDetail.vue:1142 .pd-btn-primary:hover). */
.spot-dialog-btn:hover { background: var(--accent); filter: brightness(1.08); }

/* New-UI added minimal geometry: Vue2's close button relies on global photos.scss
   `.photos-root .icon-btn` (32x32; see that file :216-224); this component is standalone SFC
   without that global class layer, define equivalent scoped version per this dialog's other button
   scale (26px height), not inventing new style language. */
.icon-btn {
  flex: none;
  width: 26px; height: 26px;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; border-radius: 6px;
  background: transparent; color: var(--fg-subtle); cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.icon-btn:hover { background: var(--chip-bg); color: var(--fg); }
</style>
