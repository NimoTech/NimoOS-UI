<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SnapCarousel from '../../components/SnapCarousel.vue'
import type { StoreApp } from '../util/storeApp'

defineProps<{
  items: StoreApp[]
  installed: (id: string) => boolean
  progress: (id: string) => number | null
  compatible: (id: string) => boolean
}>()
defineEmits<{ open: [id: string]; install: [id: string] }>()
const { t } = useI18n()

/** When thumbnail 404s, hide img and leave the gradient placeholder (per-item state doesn't warrant a subcomponent) */
function hideBroken(e: Event) {
  ;(e.target as HTMLImageElement).style.visibility = 'hidden'
}
</script>

<template>
  <section v-if="items.length" class="featured-strip">
    <h2 class="featured-title">{{ t('appsStoreFeatured') }}</h2>
    <SnapCarousel :aria-label="t('appsStoreFeatured')">
      <article
        v-for="a in items" :key="a.id"
        class="featured-card" role="button" tabindex="0"
        @click="$emit('open', a.id)" @keydown.enter="$emit('open', a.id)"
      >
        <div class="featured-shot">
          <img
            v-if="a.thumbnail" :src="a.thumbnail" alt=""
            loading="lazy" decoding="async" @error="hideBroken"
          />
          <div v-else class="featured-shot-fallback">{{ a.title.slice(0, 1) }}</div>
        </div>
        <div class="featured-row">
          <img v-if="a.icon" :src="a.icon" alt="" class="featured-icon" loading="lazy" decoding="async" />
          <div class="featured-meta">
            <h3 class="featured-name">{{ a.title }}</h3>
            <p class="featured-tagline">{{ a.tagline }}</p>
          </div>
          <span v-if="installed(a.id)" class="store-badge">{{ t('appsStoreInstalled') }}</span>
          <button
            v-else-if="progress(a.id) !== null"
            class="featured-install" type="button" disabled
          >{{ t('appsInstallingPercent', { percent: progress(a.id) }) }}</button>
          <button
            v-else class="featured-install" type="button" :disabled="!compatible(a.id)"
            @click.stop="$emit('install', a.id)"
          >{{ t('appsStoreInstall') }}</button>
        </div>
      </article>
    </SnapCarousel>
  </section>
</template>

<style scoped>
.featured-strip { margin-bottom: 18px; }
.featured-title { font-size: 15px; font-weight: 600; margin: 0 0 10px; color: var(--fg); }

.featured-card {
  width: 300px; cursor: pointer; padding: 12px;
  background: var(--card-bg); border: 1px solid var(--card-border);
  border-radius: var(--radius); box-shadow: var(--card-shadow);
  backdrop-filter: var(--blur);
}
.featured-card:hover { background: var(--chip-bg-hi); }
/* 16:9 aspect ratio container: placeholder background when image is missing/loading fails, fills when loaded—prevents layout jank during load */
.featured-shot {
  aspect-ratio: 16 / 9; border-radius: 12px; overflow: hidden;
  background: var(--chip-bg);
}
.featured-shot img { width: 100%; height: 100%; object-fit: cover; display: block; }
.featured-shot-fallback {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-size: 34px; font-weight: 600; color: var(--fg-muted);
}
.featured-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; min-width: 0; }
.featured-icon { width: 38px; height: 38px; border-radius: 10px; flex: 0 0 auto; object-fit: cover; background: var(--chip-bg); }
.featured-meta { flex: 1 1 auto; min-width: 0; }
.featured-name { font-size: 14px; font-weight: 600; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--fg); }
.featured-tagline {
  margin: 2px 0 0; font-size: 12px; color: var(--fg-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.store-badge {
  flex: 0 0 auto; font-size: 11px; padding: 1px 8px; border-radius: 999px;
  color: var(--accent-text); background: var(--accent-soft);
}
.featured-install {
  flex: 0 0 auto; font-size: 12.5px; padding: 5px 14px; cursor: pointer; border-radius: 999px;
  color: var(--accent-text); background: var(--accent-soft);
  border: 1px solid var(--accent-soft-bd);
}
.featured-install:hover { background: var(--accent-soft-2); }
.featured-install:disabled { opacity: 0.55; cursor: default; }
.featured-install:disabled:hover { background: var(--accent-soft); }
</style>
