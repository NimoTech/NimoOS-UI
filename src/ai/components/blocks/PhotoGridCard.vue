<!-- 1:1 ported from Vue2 src/views/AI/Agent/blocks/PhotoGridCard.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AgentIcon from '../icons/AgentIcon.vue'
import SearchImageLightbox from './SearchImageLightbox.vue'

interface GridPhoto {
  id?: string | number
  name?: string
  takenAt?: string
  thumbUrl?: string
}

const props = withDefaults(
  defineProps<{ query?: string; photos?: GridPhoto[] }>(),
  { query: '', photos: () => [] },
)
const { t } = useI18n()

const lightboxIndex = ref<number | null>(null)

const lightboxPhotos = computed(() =>
  (props.photos || [])
    .filter((p): p is GridPhoto & { id: string | number } => !!p.id)
    .map((p) => ({ id: p.id, title: p.name })),
)

function open(i: number) {
  const p = (props.photos || [])[i]
  if (!p || !p.id) return
  const idx = lightboxPhotos.value.findIndex((x) => x.id === p.id)
  if (idx < 0) return
  lightboxIndex.value = idx
}

function navLightbox(delta: number) {
  const n = lightboxPhotos.value.length
  if (!n) return
  lightboxIndex.value = Math.max(0, Math.min(n - 1, (lightboxIndex.value ?? 0) + delta))
}
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div class="card-head-icon" style="background: var(--purple-soft); color: var(--purple)">
        <AgentIcon name="image" :size="14" />
      </div>
      <div style="flex: 1; min-width: 0">
        <div class="card-title">{{ t('aiPhotoSearch') }} · {{ (photos || []).length }}</div>
        <div v-if="query" class="card-sub">“{{ query }}”</div>
      </div>
    </div>

    <div v-if="photos && photos.length" class="pg-grid">
      <div
        v-for="(p, i) in photos"
        :key="p.id || i"
        class="pg-cell"
        :title="p.name"
        @click="open(i)"
      >
        <img :src="p.thumbUrl" :alt="p.name" class="pg-img" loading="lazy" />
        <div class="pg-hover">
          <AgentIcon name="search" :size="18" color="var(--text-on-accent)" />
        </div>
      </div>
    </div>
    <div v-else class="pg-empty">{{ t('aiNoMatchingPhotos') }}</div>

    <SearchImageLightbox
      v-if="lightboxIndex !== null"
      :photos="lightboxPhotos"
      :index="lightboxIndex"
      @close="lightboxIndex = null"
      @nav="navLightbox"
    />
  </div>
</template>

<style scoped>
.pg-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  padding: 12px 14px;
}
.pg-cell {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--r-sm);
  overflow: hidden;
  cursor: pointer;
  background: var(--bg-chip);
  transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 180ms ease;
}
.pg-cell:hover {
  transform: scale(1.03);
  box-shadow: var(--shadow-md);
  z-index: 1;
}
.pg-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.pg-hover {
  position: absolute;
  inset: 0;
  background: var(--scrim-dark);
  display: grid;
  place-items: center;
  opacity: 0;
  transition: opacity 160ms ease;
  pointer-events: none;
}
.pg-cell:hover .pg-hover { opacity: 1; }
.pg-empty {
  padding: 24px 16px;
  text-align: center;
  color: var(--text-quaternary);
  font-size: 13px;
}
@media (max-width: 560px) {
  .pg-grid { grid-template-columns: repeat(3, 1fr); }
}
</style>
