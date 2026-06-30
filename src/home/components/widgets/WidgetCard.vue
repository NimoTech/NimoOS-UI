<template>
  <div class="card" :class="meta?.extra ? `w-${meta.extra}` : ''">
    <div class="card-head"><span class="card-ic" v-html="iconSvg" /><span class="card-title">{{ meta?.title }}</span></div>
    <div class="card-in">
      <component :is="bodyComp" v-if="bodyComp" :item="item" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, type Component } from 'vue'
import type { LayoutItem } from '../../grid/types'
import { WIDGETS } from '../../widgets/registry'
import AiWidget from './AiWidget.vue'
import ClockWidget from './ClockWidget.vue'
import StorageWidget from './StorageWidget.vue'
import CpuWidget from './CpuWidget.vue'
import GpuWidget from './GpuWidget.vue'
import NetworkWidget from './NetworkWidget.vue'
import EventsWidget from './EventsWidget.vue'

const props = defineProps<{ item: LayoutItem }>()
const meta = computed(() => WIDGETS[props.item.key])
const iconSvg = computed(() => `<svg class="icon" viewBox="0 0 24 24">${meta.value?.icon ?? ''}</svg>`)

// 各 widget 组件由后续任务(T6 起)逐个 import 并登记进此 map
const WIDGET_COMPONENTS: Record<string, Component> = {
  ai: AiWidget,
  clock: ClockWidget,
  storage: StorageWidget,
  cpu: CpuWidget,
  gpu: GpuWidget,
  network: NetworkWidget,
  events: EventsWidget,
}
const bodyComp = computed(() => WIDGET_COMPONENTS[props.item.key])
</script>
<style scoped>
/* ── Base card: glass material (P4c spatial skin) ───────────────────────── */
/* overflow:visible lets remove/resize badges on .grid-item show outside card */
/* container-type:size + width/height:100% = P2 collapse fix — do NOT split  */
.card {
  overflow: visible;
  container-type: size;
  container-name: card;
  width: 100%;
  height: 100%;
  box-sizing: border-box;                         /* PRESERVED collapse fix */
  border: 1px solid var(--card-border);
  border-radius: var(--radius);
  background: var(--card-bg);
  box-shadow: var(--card-shadow);
  backdrop-filter: var(--blur);
  transition: box-shadow .25s var(--ease), transform .2s var(--ease);
  isolation: isolate;                             /* needed for ::after mix-blend-mode:screen */
  position: relative;                             /* anchor for ::after pseudo */
  display: flex;                                  /* head + body stack vertically… */
  flex-direction: column;
  padding: 16px;                                  /* …card owns the padding so the header is inset too */
}

/* ── Top-edge highlight sweep (skin-spatial.css:141-151) ────────────────── */
.card::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  pointer-events: none;
  /* thin top-edge gloss only — kept small so it doesn't read as a bright patch
     covering the top-left title/content (was transparent 26% / opacity .55) */
  background: linear-gradient(148deg, rgba(255, 255, 255, 0.16), transparent 14%);
  mix-blend-mode: screen;
  opacity: 0.4;
}

/* ── Hover: lift + shadow upgrade + inner accent glow ───────────────────── */
/* Plain .card:hover (no .grid.editing guard) — editing jiggle is on .grid-item */
.card:hover {
  transform: var(--card-hover);
  box-shadow: var(--card-shadow-hi), inset 0 0 34px -10px var(--accent);
}

/* ── Card interior: clips sparks / overflow content inside the border-radius */
.card-in {
  border-radius: inherit;
  overflow: hidden;
  position: relative;
  z-index: 1;
  flex: 1 1 auto;                                 /* fill remaining card height below the header */
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* ── Card header row ────────────────────────────────────────────────────── */
.card-head {
  display: flex;
  align-items: center;
  justify-content: flex-start;                    /* icon + title together on the left */
  gap: 10px;
  margin-bottom: 12px;
  position: relative;
  z-index: 1;                                     /* above .card::after highlight */
}

/* ── Card title text (with readability shadow on glass) ─────────────────── */
.card-title {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: var(--title-size, clamp(12px, 5.2cqmin, 15px));
  font-weight: 600;
  letter-spacing: -0.1px;
  color: var(--fg, #fff);
  text-shadow: 0 1px 3px rgba(8, 12, 28, 0.45);  /* skin-spatial.css:158 */
}

/* ── Widget icon (.card-ic wraps the svg injected via v-html) ───────────── */
.card-ic :deep(svg) {
  width: clamp(14px, 6cqmin, 18px);
  height: clamp(14px, 6cqmin, 18px);
  color: var(--accent);
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
}

/* ── Per-widget card-level overrides (base.css:132,153-155,228) ─────────── */
/* Clock: center card-in vertically; custom background (base.css:132-133) */
.card.w-clock .card-in { justify-content: center; }
.card.w-clock { background: var(--clock-bg, var(--card-bg)); }
/* CPU: ring + chart-box size overrides (base.css:153-155) */
.card.w-cpu :deep(.ring) { width: clamp(56px, 34cqmin, 96px); }
.card.w-cpu :deep(.ring b) { font-size: clamp(15px, 9cqmin, 22px); }
.card.w-cpu :deep(.chart-box) { flex: 1 1 0; height: 0; min-height: clamp(28px, 16cqmin, 40px); margin-bottom: 2px; }
/* Events: tighter gap between events list (base.css:228) */
.card.w-events .card-in { gap: 11px; }
</style>
