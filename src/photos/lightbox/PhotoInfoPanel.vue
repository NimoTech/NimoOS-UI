<script setup lang="ts">
// EXIF/details panel -- ported from the Vue 2 panel's src/views/Photos/PhotosLightbox.vue:74-149
// (<aside class="lb-info">).
// Pure presentational component: props { photo, visible }, no emits.
// Delta from Vue2:
//   1) Removed the "Hand off to Nimo" button (Vue2 :84-87) -- this component didn't render any
//      ask-nimo interaction.
//      Update: the button has since been added back, see `.give-nimo`/onGiveNimo below --
//      this delta note is now historical only and no longer applies.
//   2) tags/scene/faces are always empty on the timeline data path so far, so the corresponding
//      sections are hidden entirely (v-if gates the outer div), keeping the structure so wiring
//      up real data later won't require template changes.
//
// Face-chip real avatars -- prerequisite fact correction:
//   (1) The backend has no asset-scoped face-thumbnail endpoint, only the person-scoped
//      /v1/photos/persons/:id/face-thumbnail; (2) the Vue2 lightbox itself also just shows an
//      initial placeholder (PhotosLightbox.vue:128-129's `{{ f[0] }}`) -- New-UI's earlier delta
//      note above was actually already 1:1 with Vue2; (3) the root cause is that Photo.faces is
//      just an array of name strings (assetToPhoto.ts:311/398), carrying no personId, and the
//      backend only populates this field on the favorites-list endpoint.
//   What's implemented here is the best achievable version without changing the backend: look up
//   the person list (usePhotosPeople) by name to get a personId, and only when there's a unique
//   match (resolvePersonByName) show a real avatar via PersonAvatar, otherwise fall back to the
//   initial placeholder -- this is an enhancement beyond Vue2 and is logged as a deviation; the
//   real fix (backend adding personId to faces, or a new asset-scoped endpoint) is filed as a
//   backend ticket, out of scope here. No click-through navigation is added (keeping Vue2's
//   non-interactive chip).
//   Incidental fix: the placeholder initial used to be the bare `f[0]` (not uppercased), now
//   uses personInitial(f) to uppercase consistently, matching Vue2 peopleUtils.js's
//   personInitial semantics.
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { copyText } from '../../files/util/clipboard'
import { osmEmbedSrc } from './util/osmMap'
import { usePhotosPeople } from '../stores/people'
import { resolvePersonByName, personInitial } from '../util/peopleView'
import PersonAvatar from '../components/PersonAvatar.vue'
import { useAskNimo } from '../composables/useAskNimo'
import type { Photo } from '../util/assetToPhoto'

const props = defineProps<{ photo: Photo | null; visible: boolean }>()

const { t } = useI18n()

// —— Camera/capture field formatting (following Vue2 :95-96's toFixed rule) ——
const apertureLabel = computed(() => {
  const a = props.photo?.aperture
  if (a == null || a === '') return null
  return `f/${Number(a).toFixed(1)}`
})
const focalLabel = computed(() => {
  const f = props.photo?.focal
  if (f == null || f === '') return null
  return `${Number(f).toFixed(0)} mm`
})

const hasLocation = computed(() => !!(props.photo?.latitude && props.photo?.longitude))
const mapSrc = computed(() => hasLocation.value ? osmEmbedSrc(props.photo!.latitude, props.photo!.longitude) : '')

const faces = computed(() => (props.photo?.faces as string[] | undefined) ?? [])
const tags = computed(() => (props.photo?.tags as string[] | undefined) ?? [])

// —— Face-chip real avatars (see the header comment's prerequisite fact correction and logged deviation) ——
const people = usePhotosPeople()
// Fetch only once (the store's peopleLoaded flag naturally dedupes): fetch only when faces is
// non-empty and hasn't loaded yet. On failure peopleLoaded stays false (people.ts's own
// convention), so the watch will trigger another retry the next time an image opens.
watch(
  faces,
  (list) => { if (list.length > 0 && !people.peopleLoaded) void people.fetchPeople() },
  { immediate: true },
)
// Name → the uniquely matching person (both duplicate names and no match yield null, falling
// back to the initial placeholder). Rendered together with faces, automatically recomputed once
// people.people is populated.
const faceEntries = computed(() =>
  faces.value.map((f) => ({ name: f, person: resolvePersonByName(people.people, f) })),
)

// Plan G: opens the Ask Nimo popup with Vue2's exact canned prompt (PhotosLightbox.vue:84
// -- `$emit('ask-nimo', $t('Edit this photo: {title}', { title: photo.title }))`; Vue2 has no
// filePath-basename fallback chain, it always uses photo.title as-is). photo.title is already
// the extension-stripped filename in both codebases (Vue2 photos.js:154/238; this app's own
// assetToPhoto.ts:333-335), so no further basename derivation belongs here. `props.photo?.id`
// is only a last-resort fallback for the type's `title: string | number` looseness -- in
// practice assetToPhoto() always sets title (falling back to id itself when originalName is
// missing), so this ?? branch should be unreachable in real data.
function onGiveNimo(): void {
  const title = String(props.photo?.title ?? props.photo?.id ?? '')
  useAskNimo().openWith(t('photosHandOffToNimoPrompt', { title }))
}

// —— Copy file path —— (falls back through the existing copyText in src/files/util/clipboard.ts for HTTP non-secure contexts)
const justCopied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null
async function onCopyPath(): Promise<void> {
  const path = props.photo?.filePath
  if (!path) return
  try {
    await copyText(path)
    justCopied.value = true
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { justCopied.value = false; copiedTimer = null }, 2000)
  } catch {
    // Both fallback paths failed -- silently ignore, don't interrupt the info panel display (consistent with Vue2 behavior, no toast)
  }
}
</script>

<template>
  <!-- Root class renamed from the invented `.info-panel` to parity's real
       anchor `.lb-info` (Vue2 PhotosLightbox.vue:74 `<aside class="lb-info scroll">`, parity
       photos.scss:677 `.photos-root .lb-info { grid-area: info; ... }`). This component is
       mounted as a direct child of PhotoLightbox's `.lightbox` grid (see that file's
       scoped-style header comment) and needs the `grid-area: info` placement itself -- kept
       local/scoped here rather than in the parent, since the parent doesn't otherwise reach
       into this component's box model. -->
  <transition name="lb-info-slide">
  <aside v-if="visible && photo" class="lb-info">
    <!-- "Hand off to Nimo" button, restored per Vue2
         PhotosLightbox.vue:84-87. Positioned as the panel's first child (Vue2's own position: right
         after the title/subtitle header block, before the first info section -- this component
         never rendered that header block at all, see the delta note in PhotoLightbox.vue,
         so "first child of the panel" is the closest faithful placement without
         inventing new header markup). `.give-nimo`'s CSS already existed in parity's stylesheet,
         unused, since an earlier change (vue2-parity/photos.scss `.photos-root .give-nimo`) --
         only the markup was missing. `.nimo-orb`'s inline 16x16 size matches Vue2's own inline
         style byte-exact (structural sizing, not a color -- not subject to the token-guard). -->
    <button type="button" class="give-nimo" data-test="lb-give-nimo" @click="onGiveNimo">
      <span class="nimo-orb" style="width:16px;height:16px;flex:none"></span>
      {{ t('photosHandOffToNimo') }}
    </button>

    <!-- Image: camera & capture -->
    <div v-if="!photo.isVideo" class="info-section">
      <div class="info-label">{{ t('photosInfoCameraCapture') }}</div>
      <div v-if="photo.camera" class="info-row" data-field="camera"><span class="k">{{ t('photosFieldCamera') }}</span><span class="v">{{ photo.camera }}</span></div>
      <div v-if="photo.iso" class="info-row" data-field="iso"><span class="k">{{ t('photosFieldIso') }}</span><span class="v">{{ photo.iso }}</span></div>
      <div v-if="photo.shutter" class="info-row" data-field="shutter"><span class="k">{{ t('photosFieldShutter') }}</span><span class="v">{{ photo.shutter }}</span></div>
      <div v-if="apertureLabel" class="info-row" data-field="aperture"><span class="k">{{ t('photosFieldAperture') }}</span><span class="v">{{ apertureLabel }}</span></div>
      <div v-if="focalLabel" class="info-row" data-field="focal"><span class="k">{{ t('photosFieldFocal') }}</span><span class="v">{{ focalLabel }}</span></div>
      <div v-if="photo.dim" class="info-row" data-field="dimensions"><span class="k">{{ t('photosFieldDimensions') }}</span><span class="v">{{ photo.dim }}</span></div>
      <div v-if="photo.size" class="info-row" data-field="file-size"><span class="k">{{ t('photosFieldFileSize') }}</span><span class="v">{{ photo.size }}</span></div>
    </div>

    <!-- Video: codec/frame rate/bit rate/rotation -->
    <div v-if="photo.isVideo" class="info-section">
      <div class="info-label">{{ t('photosInfoVideo') }}</div>
      <div v-if="photo.duration" class="info-row" data-field="duration"><span class="k">{{ t('photosFieldDuration') }}</span><span class="v">{{ photo.duration }}</span></div>
      <div v-if="photo.dim" class="info-row" data-field="resolution"><span class="k">{{ t('photosFieldResolution') }}</span><span class="v">{{ photo.dim }}</span></div>
      <div v-if="photo.videoCodec" class="info-row" data-field="video-codec"><span class="k">{{ t('photosFieldVideoCodec') }}</span><span class="v">{{ photo.videoCodec }}</span></div>
      <div v-if="photo.audioCodec" class="info-row" data-field="audio-codec"><span class="k">{{ t('photosFieldAudioCodec') }}</span><span class="v">{{ photo.audioCodec }}</span></div>
      <div v-if="photo.frameRate" class="info-row" data-field="frame-rate"><span class="k">{{ t('photosFieldFrameRate') }}</span><span class="v">{{ photo.frameRate }}</span></div>
      <div v-if="photo.bitRate" class="info-row" data-field="bit-rate"><span class="k">{{ t('photosFieldBitRate') }}</span><span class="v">{{ photo.bitRate }}</span></div>
      <div v-if="photo.rotation" class="info-row" data-field="rotation"><span class="k">{{ t('photosFieldRotation') }}</span><span class="v">{{ photo.rotation }}°</span></div>
      <div v-if="photo.size" class="info-row" data-field="file-size"><span class="k">{{ t('photosFieldFileSize') }}</span><span class="v">{{ photo.size }}</span></div>
    </div>

    <!-- Location: shared by image/video -->
    <div v-if="photo.place || photo.coords" class="info-section" data-section="location">
      <div class="info-label">{{ t('photosInfoLocation') }}</div>
      <div v-if="photo.place" class="info-row" data-field="place"><span class="k">{{ t('photosFieldPlace') }}</span><span class="v">{{ photo.place }}</span></div>
      <div v-if="photo.coords" class="info-row" data-field="coordinates"><span class="k">{{ t('photosFieldCoordinates') }}</span><span class="v">{{ photo.coords }}</span></div>
      <div v-if="hasLocation" class="map-mini">
        <iframe :src="mapSrc" title="map" loading="lazy"></iframe>
        <div class="map-pin"></div>
        <!-- Self-drawn attribution notice: OSM's own footer (Report a problem / Make a Donation /
             Website and API terms) is clipped off by the symmetric top/bottom crop (see the
             .map-mini iframe comment), but ODbL requires attribution to be kept, so a minimal
             legible credit is added in the box's bottom-right corner. -->
        <div class="map-credit">© OpenStreetMap</div>
      </div>
    </div>

    <!-- People (faces is mostly empty on the timeline data path so far, so this section is always hidden; when data exists it renders chips, without introducing face-thumbnail) -->
    <div v-if="faces.length > 0" class="info-section" data-section="people">
      <div class="info-label">{{ t('photosInfoPeople') }} · {{ faces.length }}</div>
      <div class="face-row">
        <div v-for="entry in faceEntries" :key="entry.name" class="face-chip">
          <PersonAvatar
            v-if="entry.person"
            :size="18"
            :person-id="entry.person.id"
            :ver="entry.person.coverFaceId"
            :name="entry.name"
          />
          <span v-else class="face-avatar">{{ personInitial(entry.name) }}</span>
          {{ entry.name }}
        </div>
      </div>
    </div>

    <!-- Nimo recognition (tags/scene are always empty on the timeline data path so far, so this section is hidden; structure kept for later wiring) -->
    <div v-if="tags.length > 0" class="info-section" data-section="nimo-sees">
      <div class="info-label">{{ t('photosInfoNimoSees') }}<template v-if="photo.scene"> · {{ photo.scene }}</template></div>
      <div class="tag-row">
        <!-- Renamed from the invented `.tag-chip` to parity's real anchor
             `.tag[data-kind="ai"]` (Vue2 PhotosLightbox.vue:137, parity photos.scss:696-697).
             This section only ever renders Nimo-recognized tags (the "Nimo sees" section),
             so data-kind is unconditionally "ai", matching Vue2's own hard-coded value. -->
        <span v-for="tag in tags" :key="tag" class="tag" data-kind="ai">{{ tag }}</span>
      </div>
    </div>

    <!-- File path + copy -->
    <div class="info-section">
      <div class="info-label">{{ t('photosInfoFile') }}</div>
      <div class="path-row">
        <span class="path-text">{{ photo.filePath }}</span>
        <button type="button" class="copy-btn" :title="t('photosCopyPath')" @click="onCopyPath">
          {{ justCopied ? t('photosCopied') : t('photosCopyPath') }}
        </button>
      </div>
    </div>
  </aside>
  </transition>
</template>

<style scoped>
/* The earlier "card look" deviation on `.lb-info` (border/border-radius/box-
   shadow/backdrop-filter/background/padding/overflow-y, all self-contained so the panel stayed
   legible while rendering standalone outside `.photos-root`) is retired now that this component
   actually nests inside `.photos-root` -- parity's own `.photos-root .lb-info` (photos.scss:685-
   689: `grid-area: info; background: var(--surface-1); border-left: 1px solid var(--line);
   overflow-y: auto; padding: 18px 0;`) is a bare flush panel and now governs those properties
   alone (this was the exact "revisit once re-nested" flagged by that original comment).
   Layout structure with no parity counterpart survives: `max-width`/`box-sizing` (defensive floor
   for the narrow-screen media query below, which switches this element out of grid flow
   entirely) and `color` (parity never sets a base text color on the panel itself, each child sets
   its own).

   `display: flex; flex-direction: column; gap: 16px` here, plus
   `.info-section`'s own `display: flex; flex-direction: column; gap: 6px` below, were an
   unregistered pixel deviation -- Vue2 stacks `.info-section`s flush against each other (parity
   :690-691: `padding: 12px 20px; border-bottom: 1px solid var(--line)` is the ONLY spacing
   mechanism between sections, no gap layered on top). Both flex/flex-direction/gap declarations
   deleted so parity's flush, padding+border-driven stacking is what actually governs, matching
   Vue2's real vertical rhythm instead of an extra 16px/6px gap Vue2 never had. */
/* `color: var(--fg)` was New-UI's *global* text
   token -- it only follows the app-wide `[data-theme]` attribute on `<html>`, not Photos' own
   PRIVATE light/dark toggle (`usePhotosTheme()`/`.photos-root.is-light`, see
   src/photos/composables/usePhotosTheme.ts). In the very common "Photos-light + app-global-dark"
   combination this stayed white/washed-out on the now-near-white `.lb-info` panel -- reported as
   "info panel text illegible". `--text-1` is this area's own
   `.photos-root`/`.photos-root.is-light`-scoped token (vue2-parity/photos.scss), the one parity's
   own `.info-title`/row text already uses -- same fix shape as the Places-area sweep done the same
   day (photosGlassSurfaces.test.ts's "Places area no longer consumes global glass/text tokens"
   describe block). */
.lb-info {
  max-width: 100%;
  box-sizing: border-box;
  color: var(--text-1);
}
.info-section { min-width: 0; }
/* `.info-label` retired -- byte-duplicate of parity's `.photos-root .info-label` (font-size/
   font-weight/color/text-transform/letter-spacing all collide; parity additionally sets
   `margin-bottom`). */
/* `.info-row`'s own `display`/`justify-content`/`gap`/`font-size` collide with parity's
   `.photos-root .info-row` (which also adds `padding: 4px 0`) -- retired, only `align-items:
   baseline` survives (parity doesn't set it, and it only takes effect once `display: flex` is
   in play, which parity's own copy already supplies). */
.info-row { align-items: baseline; }
/* `.k`'s `color` collides with parity's `.photos-root .info-row .k`; only `flex: 0 0 auto`
   (parity doesn't set it) survives, keeping the label from shrinking. */
.info-row .k { flex: 0 0 auto; }
/* `.v`'s `color`/`text-align` collide with parity's `.photos-root .info-row .v` (which also adds
   `font-variant-numeric: tabular-nums`); only the truncation trio survives (parity doesn't set
   any of them). */
.info-row .v { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* `.map-mini`'s `position`/`border-radius`/`overflow`/`height` collide with parity's
   `.photos-root .map-mini` (height already matched byte-exact per an earlier fix, parity
   additionally sets `margin-top`/`background`) -- retired; only the `border` survives (parity's
   own map area has none, but this component's border ring doesn't conflict with any parity
   property and isn't part of the "card look" being un-done above). New-UI addition, no Vue2
   source: Vue2's own `.map-mini` (PhotosLightbox.vue:119-122) has no border ring at all --
   this is a New-UI-only visual accent with nothing to cite on the Vue2 side, kept because it
   doesn't collide with any parity-declared property. */
/* `--card-border` (global) → `--line` (this area's own is-light-aware token),
   same root cause as `.lb-info`'s color fix above. */
.map-mini { border: 1px solid var(--line); }
/* Removes OSM's own embedded-page footer text
   (Report a problem | © OpenStreetMap contributors ♥ Make a Donation. Website and API terms).
   The iframe is cross-origin, so internal elements can't be hidden via CSS -- only the outer crop
   works; testing showed that at a 328px width the footer wraps to two lines taking about 40px, so
   48px is cropped for margin (narrower/wider widths only need fewer lines).
   **Symmetric top/bottom crop**: the iframe is 2×48px taller than the box and shifted up 48px, so
   the map's center still lands on the box's center --
   if only the height were increased without the shift, OSM's own marker would end up misaligned
   below .map-pin (verified against headless-browser screenshots).
   Trade-off: the embedded page's own +/- zoom buttons in the top-right corner get cropped off too,
   so the mini-map is no longer zoomable (acceptable, since it's just a location indicator). */
.map-mini iframe {
  position: absolute; left: 0; width: 100%; border: none; display: block;
  top: -48px; height: calc(100% + 96px);
}
.map-credit {
  position: absolute; right: 6px; bottom: 4px; z-index: 1;
  font-size: 9px; line-height: 1.2; letter-spacing: .01em;
  pointer-events: none;
  /* theme-exception: the attribution notice sits on top of arbitrary map tiles (unpredictable color), fixed light color + dark shadow keeps it legible, independent of the app theme */
  color: rgba(255, 255, 255, 0.72);
  /* theme-exception: same as above, the shadow is a fixed dark-color outline */
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65);
}
/* `.map-pin` retired -- byte-duplicate anchor of parity's `.photos-root .map-pin`,
   which additionally corrects the anchor point (`transform: translate(-50%, -100%)`, a bottom-
   anchored teardrop pin vs this rule's centered dot) and size (14px vs 10px) to match Vue2's
   real pin exactly; nothing here survives that parity doesn't already cover. */

/* `.face-row`/`.tag-row` retired -- byte-duplicate of parity's own
   `.photos-root .face-row`/`.photos-root .tag-row` (display/flex-wrap/gap all collide; only the
   gap value differs, 8px here vs parity's 6px -- parity's now governs alone). */
/* `.face-chip` retired -- collides with parity's `.photos-root .face-chip` on every property it
   declares (display/align-items/gap/padding/border-radius/font-size/background); parity
   additionally adds a `border`, nothing survives locally. */
/* `.face-avatar` retired -- collides with parity's `.photos-root .face-avatar` on every property
   (display/align-items/justify-content/width/height/border-radius/font-size/font-weight/color/
   background); parity's is Vue2's literal pastel gradient avatar, this component's `color-mix`
   approximation is superseded. */
/* `.tag`'s `padding`/`border-radius`/`font-size`/`color`/`background` collide with parity's
   `.photos-root .tag` (which additionally adds a `border`); only `display: inline-flex` survives
   (parity leaves display unset, relying on the element's own inline default -- harmless either
   way since this component's tag chips are text-only, no icon needing flex centering). */
.tag { display: inline-flex; }
/* `.tag[data-kind="ai"]`'s `background`/`color` collide with parity's own modifier (which
   additionally adds `border-color`) -- retired, nothing left to declare locally. */

/* `.path-row` retired -- byte-duplicate of parity's `.photos-root .path-row`
   (display/align-items/gap all collide, identical values too); parity additionally adds
   padding/border-radius/background/border/font/color -- a bonus "code chip" look this component
   never had, now inherited for free. `.path-text` has no parity counterpart (parity's own
   `.path-row` uses a bare text node + a `.open` action link, not a wrapper span) and survives
   unchanged; `.copy-btn` likewise shares no class name with parity's differently-named `.open`
   link, so there is no collision to resolve there either. */
/* `.path-text`/`.copy-btn` swept the same way -- `--fg-muted`/`--fg`/
   `--card-border`/`--chip-bg-hi` (global, app-theme-only) → `--text-2`/`--line`/`--surface-3`
   (this area's own is-light-aware tokens). */
.path-text { flex: 1 1 auto; min-width: 0; font-size: 12px; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.copy-btn {
  flex: 0 0 auto; font-size: 12px; padding: 4px 10px; border-radius: 8px;
  border: 1px solid var(--line); background: transparent; color: var(--text-2); cursor: pointer;
}
.copy-btn:hover { background: var(--surface-3); }

/* Narrow screens: desktop right rail → bottom overlay/full-width cover (its own standalone overlay, not hooked into useSidebarDrawer -- that one is sidebar-specific) */
@media (max-width: 768px) {
  .lb-info {
    position: fixed; left: 0; right: 0; bottom: 0; top: auto;
    width: auto; max-height: 70vh;
    border-radius: var(--radius) var(--radius) 0 0;
    border-bottom: none;
  }
}

/* Slide-in transition for the panel opening/closing
   -- a net addition, Vue2 has none (its `.lb-info` just appears/disappears with
   `v-if`, no `<transition>` wrapper at all). Kept tasteful and consistent with this lightbox's
   existing animation vocabulary: the house cubic-bezier(0.22, 0.61, 0.36, 1) easing (same curve as
   `.lb-swap-*`/`.lb-ocr-pulse` in vue2-parity/photos.scss), transform+opacity only (no layout
   properties, so it can't reflow `.lb-main` mid-transition), ~0.2-0.3s duration band. Slides in
   from the right since the panel occupies the grid's right-hand column (`grid-area: info`,
   `grid-template-columns: 1fr 360px`). */
.lb-info-slide-enter-active,
.lb-info-slide-leave-active {
  transition: transform 0.28s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.22s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.lb-info-slide-enter-from,
.lb-info-slide-leave-to {
  transform: translateX(24px);
  opacity: 0;
}
</style>
