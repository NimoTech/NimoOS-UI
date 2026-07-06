<script setup lang="ts">
import { useI18n } from 'vue-i18n'
defineProps<{ title: string; downloadable?: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'download'): void }>()
const { t } = useI18n()
</script>

<template>
  <div class="overlay">
    <header class="viewer-head">
      <h3 class="viewer-title one-line">{{ title }}</h3>
      <div class="viewer-actions">
        <slot name="toolbar" />
        <button v-if="downloadable" class="chip viewer-download" @click="emit('download')">{{ t('filesDownload') }}</button>
        <button class="viewer-close" :aria-label="t('filesViewerClose')" @click="emit('close')">✕</button>
      </div>
    </header>
    <div class="viewer-body"><slot /></div>
  </div>
</template>

<style scoped>
.overlay {
  position: absolute; inset: 0; z-index: 200;
  display: flex; flex-direction: column;
  background: var(--popup-bg, rgba(16, 19, 30, 0.95));
  color: var(--fg, #fff);
  backdrop-filter: blur(20px);
}
.viewer-head {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px; border-bottom: 1px solid var(--card-border, rgba(255,255,255,0.2));
  flex: 0 0 auto;
}
.viewer-title { flex: 1 1 auto; font-size: 1rem; font-weight: 600; min-width: 0; }
.one-line { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.viewer-actions { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
.viewer-close {
  width: 32px; height: 32px; border: none; border-radius: 50%;
  background: rgba(255,255,255,0.12); color: var(--fg, #fff); cursor: pointer; font-size: 15px;
}
.viewer-close:hover { background: rgba(255,255,255,0.22); }
.viewer-body { flex: 1 1 auto; overflow: hidden; position: relative; min-height: 0; }
</style>
