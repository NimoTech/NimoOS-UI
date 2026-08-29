<script setup lang="ts">
// AssetDetailDrawer — right-side drawer for an album-asset hit (`file_id` = `photos:<asset_id>`,
// a VLM caption vector from the semantic source).
//
// Why a separate component and not a mode of FileDetailDrawer: that drawer is a chunk pager
// (section list + windowed passage + copy/distill) and none of it applies to a photo or a
// video — an asset has exactly one caption and the thing worth looking at is the media itself.
// Sharing only the shell classes (`.k-drawer-bg / .k-drawer / .k-drawer-head / .k-drawer-fileinfo`,
// styles in `ai/styles/knowledge.scss`) keeps the two drawers visually one family: same slide-in,
// same scrim, same "← results" / Esc / scrim-click collapse.
//
// Media URLs are the album lightbox's own (`src/photos/lightbox/PhotoLightbox.vue`): the large
// thumbnail for photos and as the video poster, `/original` streamed straight into `<video>`.
// Both are served by Photos without a bearer header, which is what lets a bare `<video src>`
// work at all.
//
// Emit contract: `close` (collapse, list stays put) and `open-photos(assetId)` — the deep link
// to `#/photos?asset=<id>` that used to fire on card click and is now an explicit action.
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import KIcon from './KIcon.vue'
import { fmtMtime, highlight, relLabel, relLevel } from '../util/searchAggregate'
import type { FileVM } from '../util/searchAggregate'

const props = withDefaults(defineProps<{ file: FileVM; query?: string }>(), { query: '' })
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'open-photos', assetId: string): void
}>()
const { t } = useI18n()

const assetId = computed(() => props.file.photoAssetId || '')
const isVideo = computed(() => (props.file.mime || '').startsWith('video/'))
const largeThumbUrl = computed(() => `/v1/photos/assets/${assetId.value}/thumbnail?size=large`)
const originalUrl = computed(() => `/v1/photos/assets/${assetId.value}/original`)
const kindLabel = computed(() => t(isVideo.value ? 'aiKbSrVideoAsset' : 'aiKbSrPhotoAsset'))
// An asset has one caption chunk; guard the empty case like SearchView's card does.
const caption = computed(() => (props.file.chunks[0] && props.file.chunks[0].snippet) || '')
// K49: highlight() escapes `& < > "` before inserting <mark>; this is the only v-html here.
const captionHtml = computed(() => highlight(caption.value, props.query))
const score = computed(() => props.file.score || 0)

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="k-drawer-bg" @click="emit('close')">
    <aside class="k-drawer k-asset-drawer" @click.stop>
      <header class="k-drawer-head">
        <button class="k-drawer-back" @click="emit('close')" :title="t('aiKbFdBack')">
          <span style="transform: scaleX(-1); display: inline-flex"><KIcon name="chev" :size="14" /></span>
          <span>{{ t('aiKbFdResults') }}</span>
        </button>
        <div class="k-drawer-head-spacer" />
        <button class="k-modal-x" @click="emit('close')" :title="t('aiKbClose')"><KIcon name="x" :size="12" /></button>
      </header>

      <div class="k-drawer-fileinfo">
        <div class="k-rcard-icon" style="width: 40px; height: 48px">
          <img v-if="file.thumbnailUrl" class="k-rcard-thumb" :src="file.thumbnailUrl" :alt="file.name" />
        </div>
        <div style="flex: 1; min-width: 0">
          <div class="k-drawer-filename" :title="file.fullPath || file.name">{{ file.name }}</div>
          <div class="k-rcard-meta" style="margin-top: 4px">
            <!-- Photos normally gives a real folder; the library locator is the fail-open fallback. -->
            <span class="k-rcard-meta-item"><KIcon name="folder" :size="11" /><span class="path">{{ file.path || t('aiKbSrPhotoLibrary') }}</span></span>
          </div>
          <div class="k-rcard-meta" style="margin-top: 3px">
            <span class="k-rcard-meta-item k-asset-kind">{{ kindLabel }}</span>
            <template v-if="file.mtimeMs">
              <span style="color: var(--text-quaternary)">·</span>
              <span class="k-rcard-meta-item">{{ t('aiKbAdTaken') }} {{ fmtMtime(file.mtimeMs) }}</span>
            </template>
          </div>
        </div>
        <div class="k-drawer-actions">
          <button class="k-btn primary k-asset-open-photos" @click="emit('open-photos', assetId)">
            <KIcon name="arrowRight" :size="12" /> {{ t('aiKbAdOpenInPhotos') }}
          </button>
        </div>
      </div>

      <div class="k-drawer-body k-asset-body">
        <div class="k-asset-stage">
          <video
            v-if="isVideo"
            class="k-asset-media"
            :src="originalUrl"
            :poster="largeThumbUrl"
            controls
            preload="metadata"
            playsinline
          />
          <img v-else class="k-asset-media" :src="largeThumbUrl" :alt="file.name" />
        </div>
        <div class="k-asset-caption">
          <div class="k-asset-caption-head">
            <span class="k-rel" :data-level="relLevel(score)"><span class="k-rel-dot" /> {{ relLabel(score) }}</span>
            <span>{{ t('aiKbAdCaption') }} · {{ t('aiKbSrSimilarity') }} {{ Math.round(score * 100) }}%</span>
          </div>
          <div class="k-asset-caption-text" v-html="captionHtml" />
        </div>
      </div>
    </aside>
  </div>
</template>
