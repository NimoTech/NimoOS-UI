<template>
  <div class="ring" :style="arc ? arcStyle : undefined">
    <div><b>{{ percent == null ? '—' : percent + '%' }}</b><s>{{ label }}</s></div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
const props = withDefaults(defineProps<{ percent: number | null; label: string; color?: string; arc?: boolean }>(), {
  color: 'var(--accent)', arc: true,
})
const arcStyle = computed(() => ({
  '--p': String(props.percent || 0),
  background: `radial-gradient(closest-side, var(--ring-hole) 78%, transparent 79%), conic-gradient(${props.color} calc(var(--p)*1%), var(--ring-track) 0)`,
}))
</script>
<style scoped>
/* base.css:142-145 — ring gauge (conic-gradient w/ design tokens) */
.ring { position: relative; display: grid; place-items: center; width: clamp(64px, 42cqmin, 124px); aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle, var(--ring-hole) 0 56%, transparent 57%), conic-gradient(var(--good) 0 68%, var(--accent) 68% 84%, var(--ring-track) 84% 100%); min-width: 0; }
.ring b { font-size: clamp(16px, 11cqmin, 26px); font-weight: 600; font-family: var(--num-font, inherit); }
.ring s { text-decoration: none; display: block; margin-top: 2px; font-size: clamp(10px, 5cqmin, 13px); color: var(--fg-muted); }
</style>
