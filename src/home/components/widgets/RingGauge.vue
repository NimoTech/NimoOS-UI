<template>
  <div class="ring" :style="arcStyle">
    <div class="ring-txt"><b>{{ percent == null ? '—' : percent + '%' }}</b><s>{{ label }}</s></div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
const props = withDefaults(defineProps<{ percent: number | null; label: string; color?: string }>(), {
  color: 'var(--accent)',
})
// The hole is 82%, not the 78% this started at: at the smallest ring the card
// produces (57px, so a 22.3px hole radius) the percentage's ink was ~34px wide
// against a 32px chord at the text's top edge, so the number spilled onto the
// colour band. Measured in Chromium; jsdom cannot see any of this.
const arcStyle = computed(() => ({
  '--p': String(props.percent || 0),
  background: `radial-gradient(closest-side, var(--ring-hole) 82%, transparent 83%), conic-gradient(${props.color} calc(var(--p)*1%), var(--ring-track) 0)`,
}))
</script>
<style scoped>
/* base.css:142-145 — ring gauge (conic-gradient w/ design tokens).
   The background is always the inline data-driven gradient above; the hardcoded
   68%/84% three-colour fallback that used to live here was only ever selected by
   arc=false, which no caller passes since the storage widget stopped doing it. */
.ring { position: relative; display: grid; place-items: center; width: clamp(64px, 42cqmin, 124px); aspect-ratio: 1; border-radius: 50%; min-width: 0; }
/* Both declarations are load-bearing; they fix two different things.
   text-align: center -- <s> is display:block, so its box is as wide as the
   percentage above it, and the default `start` alignment left the label's ink
   7.52px left of the ring's centre on a 57px ring. That off-centre label is the
   defect people actually notice.
   line-height: 1 -- without it the block is 31px tall for a Latin label and 33px
   for a CJK one, taller than the hole, so the number pressed out onto the band
   and the two rings in the Processor card spilled by different amounts for no
   visible reason. Pinning it to the font size makes the block 27px and identical
   in both scripts. */
.ring-txt { line-height: 1; text-align: center; }
.ring b { font-size: clamp(16px, 11cqmin, 26px); font-weight: 600; font-family: var(--num-font, inherit); }
.ring s { text-decoration: none; display: block; margin-top: 2px; font-size: clamp(10px, 5cqmin, 13px); color: var(--fg-muted); }
</style>
