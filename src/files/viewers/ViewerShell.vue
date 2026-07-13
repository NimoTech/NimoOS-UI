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
        <button v-if="downloadable" type="button" class="bar-btn viewer-download" @click="emit('download')">{{ t('filesDownload') }}</button>
        <button type="button" class="viewer-close" :aria-label="t('filesViewerClose')" @click="emit('close')">✕</button>
      </div>
    </header>
    <div class="viewer-body"><slot /></div>
  </div>
</template>

<style scoped>
.overlay {
  position: absolute; inset: 0; z-index: 200; overflow: hidden;
  display: flex; flex-direction: column;
  background: var(--app-bg, #1c2339);
  background-attachment: fixed;
  color: var(--fg, #fff);
}
/* 主页同款散景光斑，让预览背景与主页保持一致 */
.overlay::before {
  content: ""; position: absolute; inset: -12%; z-index: 0; pointer-events: none;
  background: /* theme-exception: 装饰性 accent bokeh, 与主页背景一致, 皮肤无关 */
    radial-gradient(22vw 22vw at 22% 26%, rgba(150, 185, 255, 0.5), transparent 60%),
    radial-gradient(18vw 18vw at 78% 30%, rgba(183, 155, 255, 0.42), transparent 62%),
    radial-gradient(20vw 20vw at 60% 80%, rgba(95, 227, 176, 0.32), transparent 62%),
    radial-gradient(12vw 12vw at 40% 60%, rgba(255, 255, 255, 0.18), transparent 60%);
  filter: blur(46px);
}
.viewer-head {
  position: relative; z-index: 1;
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px; border-bottom: 1px solid var(--card-border, rgba(255,255,255,0.2));
  flex: 0 0 auto;
}
.viewer-title { flex: 1 1 auto; font-size: 1rem; font-weight: 600; min-width: 0; }
.one-line { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.viewer-actions { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
.viewer-close {
  width: 32px; height: 32px; border: none; border-radius: 50%;
  background: var(--tool-bg); color: var(--fg, #fff); cursor: pointer; font-size: 15px;
}
.viewer-close:hover { background: var(--tool-bg-hi); }
.viewer-body { flex: 1 1 auto; overflow: hidden; position: relative; z-index: 1; min-height: 0; }
</style>
