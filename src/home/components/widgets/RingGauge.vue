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
.ring { aspect-ratio: 1; display: grid; place-items: center; border-radius: 50%; min-width: 0; }
.ring > div { text-align: center; }
.ring b { display: block; font-size: clamp(14px, 7cqmin, 28px); }
.ring s { font-size: 11px; opacity: .7; text-decoration: none; }
</style>
