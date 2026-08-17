<script setup lang="ts">
// EXIF / info panel — ported from Vue2 NimoOS-UI src/views/Photos/PhotosLightbox.vue:74-149 (<aside class="lb-info">).
// Pure display component: props { photo, visible }, no emits.
// Delta (see task-7-brief.md):
//   1) Removed "Hand off to Nimo" button (Vue2 :84-87) — this component does not render any ask-nimo interaction.
//   2) tags/scene/faces are always empty on P2 timeline path → whole sections hidden (v-if on outer div), structure preserved for real data integration later without template changes.
//
// Task 15B (SP7-P5 two ledger entries closing) face chip real avatars — factual correction up front (task-15-brief.md):
//   ① Backend has no asset-scoped face-thumbnail endpoint, only person-scoped exists across the repo:
//      /v1/photos/persons/:id/face-thumbnail; ② Vue2 lightbox itself also uses first-letter placeholder
//      (PhotosLightbox.vue:128-129 `{{ f[0] }}`) — New-UI previously (original delta ② description) was already
//      1:1 with Vue2; ③ root cause: Photo.faces is just name string array (assetToPhoto.ts:311/398), no
//      personId, and backend only populates this field in favorites list endpoints.
//   This task does the best version without backend changes: reverse-lookup person by name in person list (usePhotosPeople) to get
//   personId, use PersonAvatar to show real avatar only on unique match (resolvePersonByName), otherwise keep first-letter
//   placeholder — this enhancement exceeds Vue2, logged as deviation; true fix (backend adds personId to faces or new
//   asset-scoped endpoint) tracked as backend ticket, outside this task scope. No click navigation added (keeps Vue2's non-interactive chip).
//   Side fix: placeholder first letter was bare `f[0]` (not capitalized), now uses personInitial(f) for consistent uppercasing, aligns
//   with Vue2 peopleUtils.js personInitial semantics.
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { copyText } from '../../files/util/clipboard'
import { osmEmbedSrc } from './util/osmMap'
import { usePhotosPeople } from '../stores/people'
import { resolvePersonByName, personInitial } from '../util/peopleView'
import PersonAvatar from '../components/PersonAvatar.vue'
import type { Photo } from '../util/assetToPhoto'

const props = defineProps<{ photo: Photo | null; visible: boolean }>()

const { t } = useI18n()

// —— Camera/shooting field formatting (per Vue2 :95-96 toFixed rules) ——
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

// —— Task 15B: face chip real avatars (see head comment factual corrections and logged deviations) ——
const people = usePhotosPeople()
// Fetch only once (store's peopleLoaded flag naturally deduplicates): only fetch if faces non-empty and not yet loaded. On failure
// peopleLoaded stays false (internal convention in people.ts), next photo open watch will retry once.
watch(
  faces,
  (list) => { if (list.length > 0 && !people.peopleLoaded) void people.fetchPeople() },
  { immediate: true },
)
// Name → uniquely matched person (duplicates/no match are null, fall back to initial placeholder). Renders with faces,
// auto re-evaluates when people.people arrives.
const faceEntries = computed(() =>
  faces.value.map((f) => ({ name: f, person: resolvePersonByName(people.people, f) })),
)

// —— Copy file path —— (HTTP insecure context falls back to existing copyText in src/files/util/clipboard.ts)
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
    // Both fallback paths failed — silently ignore, don't interrupt info panel display (matches Vue2 behavior, no toast)
  }
}
</script>

<template>
  <aside v-if="visible && photo" class="info-panel scroll">
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

    <!-- Video: codec/framerate/bitrate/rotation -->
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

    <!-- Location: shared for image & video -->
    <div v-if="photo.place || photo.coords" class="info-section" data-section="location">
      <div class="info-label">{{ t('photosInfoLocation') }}</div>
      <div v-if="photo.place" class="info-row" data-field="place"><span class="k">{{ t('photosFieldPlace') }}</span><span class="v">{{ photo.place }}</span></div>
      <div v-if="photo.coords" class="info-row" data-field="coordinates"><span class="k">{{ t('photosFieldCoordinates') }}</span><span class="v">{{ photo.coords }}</span></div>
      <div v-if="hasLocation" class="map-mini">
        <iframe :src="mapSrc" title="map" loading="lazy"></iframe>
        <div class="map-pin"></div>
        <!-- OSM attribution statement: OSM's own footer (Report a problem / Make a Donation /
             Website and API terms) is hidden by symmetric vertical crop (see .map-mini iframe comment),
             but ODbL requires attribution preserved, so adding minimal readable credit in box lower right. -->
        <div class="map-credit">© OpenStreetMap</div>
      </div>
    </div>

    <!-- People (P2 timeline path faces mostly empty, section always hidden; renders chips when data exists, no face-thumbnail) -->
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

    <!-- Nimo recognition (P2 timeline path tags/scene always empty, section hidden; structure preserved for future integration) -->
    <div v-if="tags.length > 0" class="info-section" data-section="nimo-sees">
      <div class="info-label">{{ t('photosInfoNimoSees') }}<template v-if="photo.scene"> · {{ photo.scene }}</template></div>
      <div class="tag-row">
        <span v-for="tag in tags" :key="tag" class="tag-chip">{{ tag }}</span>
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
</template>

<style scoped>
.info-panel {
  width: 360px;
  max-width: 100%;
  flex: 0 0 auto;
  box-sizing: border-box;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: var(--panel-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius);
  box-shadow: var(--panel-shadow);
  backdrop-filter: var(--blur);
  color: var(--fg);
}
.info-section { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.info-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--fg-muted); }
.info-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; font-size: 13px; }
.info-row .k { color: var(--fg-muted); flex: 0 0 auto; }
.info-row .v { color: var(--fg); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.map-mini { position: relative; border-radius: 10px; overflow: hidden; height: 140px; border: 1px solid var(--card-border); }
/* User 2026-07-31 acceptance: remove OSM embedded page's own footer text
   (Report a problem | © OpenStreetMap contributors ♥ Make a Donation. Website and API terms).
   iframe is cross-origin, internal elements can't be hidden by CSS, only crop from outside; measured at 328px wide that footer
   wraps to two lines ~40px tall, so crop 48px with buffer (narrower/wider will use fewer lines).
   **Symmetric vertical crop**: iframe is 2×48px taller than box and shifted up 48px, keeps map center in box center —
   if only increased height without shift, OSM's own marker would drop below .map-pin misaligned (verified with headless browser screenshot).
   Trade-off: +/- zoom buttons in embedded page's top right also cropped, mini map no longer zoomable (acceptable, it's position indicator). */
.map-mini iframe {
  position: absolute; left: 0; width: 100%; border: none; display: block;
  top: -48px; height: calc(100% + 96px);
}
.map-credit {
  position: absolute; right: 6px; bottom: 4px; z-index: 1;
  font-size: 9px; line-height: 1.2; letter-spacing: .01em;
  pointer-events: none;
  /* theme-exception: attribution sits on any map tile (color unpredictable), fixed light color + dark shadow for readability, theme-independent */
  color: rgba(255, 255, 255, 0.72);
  /* theme-exception: same as above, shadow is fixed dark stroke */
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65);
}
.map-pin {
  position: absolute; top: 50%; left: 50%; width: 10px; height: 10px;
  transform: translate(-50%, -50%); border-radius: 50%;
  background: var(--accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 30%, transparent);
  pointer-events: none;
}

.face-row, .tag-row { display: flex; flex-wrap: wrap; gap: 8px; }
.face-chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px 4px 4px;
  border-radius: 999px; font-size: 12px; color: var(--fg); background: var(--chip-bg);
}
.face-avatar {
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 50%; font-size: 11px; font-weight: 600;
  color: var(--fg); background: color-mix(in srgb, var(--accent) 30%, transparent);
}
.tag-chip { display: inline-flex; padding: 4px 10px; border-radius: 999px; font-size: 12px; color: var(--fg); background: var(--chip-bg); }

.path-row { display: flex; align-items: center; gap: 8px; }
.path-text { flex: 1 1 auto; min-width: 0; font-size: 12px; color: var(--fg-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.copy-btn {
  flex: 0 0 auto; font-size: 12px; padding: 4px 10px; border-radius: 8px;
  border: 1px solid var(--card-border); background: transparent; color: var(--fg); cursor: pointer;
}
.copy-btn:hover { background: var(--chip-bg-hi); }

/* Narrow screens: desktop right panel → bottom float/full-width overlay (standalone float, not using useSidebarDrawer — that's sidebar-only) */
@media (max-width: 768px) {
  .info-panel {
    position: fixed; left: 0; right: 0; bottom: 0; top: auto;
    width: auto; max-height: 70vh;
    border-radius: var(--radius) var(--radius) 0 0;
    border-bottom: none;
  }
}
</style>
