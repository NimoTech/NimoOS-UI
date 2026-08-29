<!--
  1:1 ported from Vue2 src/views/AI/Agent/blocks/SearchImageLightbox.vue

  Self-contained fullscreen lightbox for search-result images. Purpose-built so
  it does NOT depend on any Photos-page-scoped CSS, which caused the enlarged
  image to render inline in the conversation instead of as a floating overlay.
-->
<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import AgentIcon from '../icons/AgentIcon.vue'
import { openPhotoSetInNewTab } from '../../services/openInApp'

interface LightboxPhoto {
  id: string | number
  title?: string
}

const props = withDefaults(
  defineProps<{ photos: LightboxPhoto[]; index?: number }>(),
  { index: 0 },
)
const emit = defineEmits<{ (e: 'close'): void; (e: 'nav', delta: number): void }>()
const { t } = useI18n()

const triedThumb = ref(false)

const current = computed(() => props.photos[props.index] || { id: '', title: '' })
const largeSrc = computed(() => {
  const id = current.value.id
  if (!id) return ''
  // Prefer the original; on load error fall back to the large thumbnail,
  // which is guaranteed to exist (the card's small thumbnails already load).
  return triedThumb.value
    ? `/v1/photos/assets/${id}/thumbnail?size=large`
    : `/v1/photos/assets/${id}/original`
})

watch(() => props.index, () => {
  triedThumb.value = false // reset fallback when switching image
})

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
  else if (e.key === 'ArrowLeft' && props.index > 0) emit('nav', -1)
  else if (e.key === 'ArrowRight' && props.index < props.photos.length - 1) emit('nav', 1)
}
function onImgError() {
  if (!triedThumb.value) triedThumb.value = true
}
function openInPhotos() {
  openPhotoSetInNewTab(props.photos.map((p) => p.id), current.value.id)
}

onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="sil-overlay" @click.self="emit('close')">
    <div class="sil-top">
      <div class="sil-title" :title="current.title">{{ current.title }}</div>
      <div v-if="photos.length > 1" class="sil-counter">{{ index + 1 }} / {{ photos.length }}</div>
      <button class="sil-open-photos" :title="t('aiOpenInPhotos')" @click="openInPhotos">
        <AgentIcon name="image" :size="14" color="var(--text-on-accent)" />
        <span>{{ t('aiOpenInPhotos') }}</span>
      </button>
      <button class="sil-close" :aria-label="t('aiLightboxClose')" @click="emit('close')">
        <AgentIcon name="x" :size="18" color="var(--text-on-accent)" />
      </button>
    </div>

    <div class="sil-stage" @click.self="emit('close')">
      <button
        v-if="photos.length > 1"
        class="sil-nav sil-prev"
        :aria-label="t('aiPrevious')"
        :disabled="index <= 0"
        @click.stop="emit('nav', -1)"
      >
        <AgentIcon name="chev" :size="20" color="var(--text-on-accent)" style="transform: rotate(180deg)" />
      </button>

      <img
        :key="current.id"
        :src="largeSrc"
        :alt="current.title"
        class="sil-img"
        @error="onImgError"
      />

      <button
        v-if="photos.length > 1"
        class="sil-nav sil-next"
        :aria-label="t('aiNext')"
        :disabled="index >= photos.length - 1"
        @click.stop="emit('nav', 1)"
      >
        <AgentIcon name="chev" :size="20" color="var(--text-on-accent)" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.sil-overlay {
  position: fixed;
  inset: 0;
  /* Above SearchFullResults' modal (z-index 9999): the results modal can stay
     mounted while the lightbox opens over it, so the viewer must sit on top. */
  z-index: 10000;
  background: var(--overlay-scrim);
  display: flex;
  flex-direction: column;
  animation: sil-fade 0.18s ease-out;
}
@keyframes sil-fade { from { opacity: 0; } }
.sil-top {
  height: 52px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px;
}
.sil-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--overlay-fg-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.sil-counter {
  font-size: 12.5px;
  color: var(--overlay-fg-soft);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.sil-open-photos {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--overlay-chip-border);
  background: var(--overlay-chip-bg);
  color: var(--text-on-accent);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
  font-family: var(--font-sans);
  transition: background 140ms ease;
}
.sil-open-photos:hover { background: var(--overlay-chip-bg-hover); }
.sil-close {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: var(--overlay-btn-bg);
  color: var(--text-on-accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 140ms ease;
}
.sil-close:hover { background: var(--overlay-btn-bg-hover); }
.sil-stage {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  min-height: 0;
}
.sil-img {
  max-width: calc(100% - 96px);
  max-height: calc(100% - 24px);
  object-fit: contain;
  border-radius: 3px;
  box-shadow: var(--overlay-img-shadow);
}
.sil-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--overlay-nav-border);
  background: var(--overlay-nav-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: var(--text-on-accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 140ms ease;
}
.sil-nav:hover { background: var(--overlay-nav-bg-hover); }
.sil-nav:disabled { opacity: 0.25; cursor: default; }
.sil-prev { left: 16px; }
.sil-next { right: 16px; }
</style>
