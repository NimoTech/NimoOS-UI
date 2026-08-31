<script setup lang="ts">
// PlaceSpotDialog.vue — the "shooting spot" dialog inside the place detail panel. Note it is
// not an overlay (no Esc-document listener/no scrim) — it's an inline card embedded at the top
// of PlaceDetailPanel.vue's `.detail-body`, mounted/unmounted by the container based on
// whether activeSpotKey matches an item in the spots list. Ported section-by-section from
// Vue2 src/views/Photos/PhotosPlacesView.vue:1109-1150 (template), :290-303 (watch(spotDialog)
// exiting edit mode), :486-516 (startSpotRename/saveSpotName's nextTick focus + trim); styles
// follow photos-places.scss:620-654.
//
// Division of responsibility: pure presentation + emit, doesn't touch the store or make
// requests — the container is responsible for actually calling store.setSpotName /
// store.resetSpotName, and forwards store.spotBusy as this component's busy prop.
//
// Deviation 7: props.spot doesn't keep a local copy — Vue2 relies on reassigning
// `this.spotDialog = { spot: fresh }` as a new object to trigger watch(spotDialog) and exit
// edit mode as a side effect; there's no such wrapper object here, only a bare spot prop, so:
//  · Outside edit mode, name/coords/stats are always read directly from props.spot.* — once a
//    rename succeeds, the parent passes down the new detail.spots and the new value shows
//    immediately, no extra signal needed.
//  · Exiting edit mode is handled by two watches, neither of which exits optimistically (they
//    don't exit on the "save was clicked" action itself, only once "the data passed down from
//    the parent actually changed"): "props.spot.key changes" (pins down Vue2's watch :303
//    semantics: a different spot was opened) + "props.spot.name changes" (pins down Vue2's
//    saveSpotName :495-516's visible behavior of exiting edit mode immediately on success and
//    staying in edit mode on failure — it only exits once name has actually been written back
//    by the store; on failure name is unchanged and editing continues, so it never lies about
//    the outcome).
//
// Deviation 16: the coordinate line no longer copies Vue2's hardcoded `° N`/`° E` (which shows
// the wrong hemisphere for the southern/western hemispheres) — it uses formatSpotCoords
// instead, which derives N/S/E/W from the sign.
//
// A user-approved, net-new addition (Vue2 has no such button/capability at all — only a
// service-layer resetSpotName method with zero callers anywhere in the repo): the "restore
// default name" button, see .spot-dialog-reset below.
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

// Follows Vue2's watch :303 (`spotDialog() { this.spotEditing = false }`) — in Vue2 that watch
// fires whenever the whole spotDialog object is reassigned, which covers both "a different
// spot was opened" and "a rename succeeded and loadDetail rebuilt a new object with the same
// key". There's no wrapper object here, so this only pins down the "a different spot was
// opened" case (see Deviation 7 in the file header).
watch(
  () => props.spot.key,
  () => { editing.value = false },
)

// A correction cross-checked against Vue2's saveSpotName :495-516 — `await` succeeding
// immediately sets `spotEditing = false`, and only failure (an empty catch block, explicitly
// "keep editing open on failure") keeps edit mode. There's no visibility into that network
// request here (only the container/store knows whether it succeeded), but that's no excuse
// for having no success-exit path at all — this hooks into the real data instead: once
// setSpotName succeeds, the store writes the matching detail.spots item's name back in place;
// once resetSpotName succeeds, the store awaits loadDetail and refetches; both paths cause the
// parent-supplied spot.name to change. On failure, name is unchanged and edit mode continues.
// This is behaviorally equivalent to Vue2's visible behavior, and never lies on failure.
// Known edge case (accepted as-is, not worth handling): saving a draft that's identical to the
// current name leaves name unchanged, so edit mode doesn't exit (Vue2 does exit here — it
// unconditionally sets spotEditing=false on submit, regardless of whether anything actually
// changed).
watch(
  () => props.spot.name,
  () => { editing.value = false },
)

// Follows Vue2's startSpotRename :486-494: the draft's initial value is the current name,
// focusing the input after nextTick.
function startRename(): void {
  draftName.value = props.spot.name
  editing.value = true
  void nextTick(() => inputRef.value?.focus())
}

function cancelRename(): void {
  editing.value = false
}

const canSubmitRename = computed(() => draftName.value.trim().length > 0 && !props.busy)

// Follows Vue2's saveSpotName :495-496 trim; whether the backend is actually called is
// decided by the container once it receives the rename event.
function submitRename(): void {
  if (!canSubmitRename.value) return
  emit('rename', draftName.value.trim())
}

// Deviation 16: whether the whole line renders is driven by formatSpotCoords returning an
// empty string (NaN/invalid value -> '').
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
      <!-- `--accent-text` (global theme.css token, only follows the
           app-wide theme) swapped for `--accent-hi` — Vue2's own exact value here
           (PhotosPlacesView.vue:1194, `<PhotosIcon name="map" :size="13" color="var(--accent-hi)"
           />`), and already Photos-local/theme-invariant (photos.scss:31). -->
      <svg
        viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        style="color: var(--accent-hi); flex: none"
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
          <!-- A user-approved, net-new addition (Vue2 has no such button, only a service-layer
               resetSpotName method with zero callers anywhere in the repo): restore the
               place's default name. -->
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
/* Shadowing cleanup: most of this file's former scoped rules have
   been deleted — they duplicated `photos-places.scss:640-672` (`.spot-dialog` family) using
   *global* New-UI tokens (`--accent-soft-bd`/`--on-accent`/`--accent-text`/`--fg`/`--chip-bg`/
   `--card-border`) in place of the Photos-local ones (`--accent-rgb`/white literal/`--accent-hi`/
   `--text-1`/`--surface-2`/`--line`) parity already declares correctly for these exact
   selectors — same bug pattern as PlacesZoomBar.vue's own fix for the identical issue. `.icon-btn`
   was a second, distinct bug: its own comment claimed "this SFC has no global `.icon-btn`
   class to reach it", but `.photos-root .icon-btn` (photos.scss:256-265, 32x32) is a *plain,
   unscoped* selector — it reaches this component's `<button class="icon-btn">` fine, same as
   any global stylesheet does. The local 26px override was shadowing parity's correct 32x32
   Vue2 value; deleted so parity governs. What survives below is only what has no parity
   counterpart at all (Vue2 inline/global-utility-class origin, or genuine New-UI additions)
   plus the two hover-lock rules PlaceSpotDialog.test.ts pins to this file's own raw source. */

/* Vue2 `.one-line` is a *global* utility class (the Vue 2 panel's src/assets/scss/common/_others.scss:55,
   -webkit-box + line-clamp:1) that this app's vue2-parity port never carries (out of this
   spec's scope) — no parity selector exists for it, so this stays a genuine local addition.
   Equivalent single-line ellipsis, white-space:nowrap variant (same precedent as
   files/viewers/ViewerShell.vue's own `.one-line`:47). min-width:0 is required for the
   ellipsis to actually clip inside a flex item (otherwise min-width:auto lets it overflow). */
.spot-dialog-name .one-line {
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* Net-new (user-authorized): three buttons now share this row instead of Vue2's
   two (save/cancel) — parity's `.spot-rename` only ever needed `display:flex;align-items:
   center;gap:6px` (still governs those), but the third `.spot-dialog-reset` button can push
   this row past its container width, so New-UI adds a wrap fallback with no Vue2 counterpart. */
.spot-rename { flex-wrap: wrap; }

/* Net-new: "restore default name" button — Vue2 has no such affordance (only a
   zero-callsite service method), so there is no parity selector to fall back on; styled as a
   ghost button matching `.spot-rename-cancel`'s geometry (parity :659-663).
   `border`/`color` were corrected from the global `--card-border`/
   `--fg-muted` (only follow the app-wide theme) to local `--line`/`--text-2` (this file's
   header comment already made the identical correction for every other selector in this
   family — these two survivor rules were missed in that earlier pass). */
.spot-dialog-reset {
  flex: none; height: 26px; padding: 0 10px; border-radius: 6px;
  font: inherit; font-size: 11.5px; font-weight: 500; cursor: pointer;
  border: 1px solid var(--line); background: transparent; color: var(--text-2);
}
.spot-dialog-reset:hover { color: var(--text-1); }
.spot-dialog-reset:disabled { opacity: 0.4; pointer-events: none; }

/* Hover-lock survivors (PlaceSpotDialog.test.ts reads this file's own raw `<style>` text via
   `winningHoverBackground`/regex — these two rules must exist here verbatim, parity coverage
   of the same selectors is not visible to those assertions). Values corrected to match
   Vue2/parity exactly (`--accent-hi`, Photos-local purple) instead of the former
   `filter: brightness(1.08)` approximation. */
.spot-dialog-btn:hover { background: var(--accent-hi); }
</style>
