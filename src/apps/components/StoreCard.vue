<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { StoreApp } from '../util/storeApp'

defineProps<{ app: StoreApp; installed: boolean }>()
defineEmits<{ open: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="store-card" role="button" tabindex="0" @click="$emit('open')" @keydown.enter="$emit('open')">
    <img v-if="app.icon" :src="app.icon" alt="" class="store-icon" loading="lazy" />
    <div v-else class="store-icon store-icon-fallback">{{ app.title.slice(0, 1) }}</div>
    <div class="store-meta">
      <div class="store-title-row">
        <h3 class="store-title">{{ app.title }}</h3>
        <span v-if="installed" class="store-badge">{{ t('appsStoreInstalled') }}</span>
      </div>
      <p class="store-tagline">{{ app.tagline }}</p>
      <span class="store-cate">{{ app.category }}</span>
    </div>
  </div>
</template>

<style scoped>
.store-card {
  display: flex; gap: 12px; align-items: flex-start;
  padding: 14px; cursor: pointer;
  background: var(--card-bg); border: 1px solid var(--card-border);
  border-radius: var(--radius); box-shadow: var(--card-shadow);
  backdrop-filter: var(--blur);
}
.store-card:hover { background: var(--chip-bg-hi); }
.store-icon { width: 48px; height: 48px; border-radius: 12px; flex: 0 0 auto; object-fit: cover; }
.store-icon-fallback {
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; font-weight: 600; color: var(--fg-muted);
  background: var(--chip-bg-hi);
}
.store-meta { min-width: 0; flex: 1 1 auto; }
.store-title-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.store-title { font-size: 15px; font-weight: 600; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--fg); }
.store-badge {
  flex: 0 0 auto; font-size: 11px; padding: 1px 8px; border-radius: 999px;
  color: var(--accent-text); background: var(--accent-soft);
}
.store-tagline {
  margin: 4px 0 6px; font-size: 12.5px; color: var(--fg-muted);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.store-cate { font-size: 11.5px; color: var(--fg-muted); }
</style>
