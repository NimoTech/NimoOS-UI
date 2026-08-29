<template>
  <!-- display:contents, so this wrapper gives the script a handle on the DOM without
       adding a box between .card-in's flex column and the layouts below. -->
  <div ref="root" class="gpu-root">
    <!-- The measuring stick. Absolutely positioned and invisible, so it costs no
         layout, but it resolves the same font-size and padding as a real row -- which
         is the only way to learn a row's height when Chrome's minimum font size has
         overridden the stylesheet. Kept out of .stat so tests and probes that count
         rows don't see it. -->
    <div class="stat-probe" aria-hidden="true"><span>·</span><b>·</b></div>

    <!-- 2x2 -- the card's default size (registry.ts:27) -- is the ring alone: pills
         were tried there and render clipped through the middle of their own labels.
         With both an iGPU and a discrete card present the one ring goes to the
         discrete card: transcode and compute load land there, and an idling iGPU
         next to a busy GPU is the less useful of the two readings. -->
    <div v-if="item.w <= 2" class="ring-row solo" :title="one.title">
      <RingGauge :percent="one.usage" :label="one.label" :color="one.col" />
    </div>
    <!-- Three rows tall: the extra row is what lets every ring have its own readings
         table underneath, instead of the single compact line the 4x2 pair has to make
         do with. One GPU gets one full-width column, two GPUs get one column each. -->
    <div v-else-if="item.h > 2" class="gpu-grid" :class="{ single: cards.length < 2 }">
      <div v-for="c in cards" :key="c.label" class="gpu-cell" :title="c.title">
        <RingGauge :percent="c.usage" :label="c.label" :color="c.col" :scale="cards.length > 1 ? 0.62 : 1" />
        <div class="stats">
          <div v-for="r in fitted(c)" :key="r.key" class="stat"><span>{{ r.label }}</span><b>{{ r.value }}</b></div>
        </div>
      </div>
    </div>
    <!-- Wide, and the host has an integrated *and* a discrete GPU: a ring each. The
         readings tables have no room beside two rings, so each ring carries one
         compact line listing only the fields that card actually reports. -->
    <div v-else-if="pair" class="gpu-pair">
      <div v-for="c in pair" :key="c.label" class="gpu-col" :title="c.title">
        <RingGauge :percent="c.usage" :label="c.label" :color="c.col" />
        <div v-if="rowBudget >= 1" class="num-sub">{{ c.sub }}</div>
      </div>
    </div>
    <!-- Wide with one GPU: ring on the left, table on the right. It used to stack
         them, but .ring-row{flex:1} took the whole card height and
         .card-in{overflow:hidden} then cut four of the five rows off -- on the
         device only "Model" was visible. Side by side, the height needed is
         max(ring, table) instead of their sum. -->
    <div v-else class="ring-row" :title="one.title">
      <RingGauge :percent="one.usage" :label="one.label" :color="one.col" />
      <div class="stats">
        <div v-for="r in fitted(one)" :key="r.key" class="stat"><span>{{ r.label }}</span><b>{{ r.value }}</b></div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LayoutItem } from '../../grid/types'
import { useLiveStatsStore } from '../../stores/liveStats'
import { fmtSize, heatColor } from '../../util/format'
import { fitRowCount, pickRows, type FitRow } from '../../util/statFit'
import RingGauge from './RingGauge.vue'
const props = defineProps<{ item: LayoutItem }>()
const { t } = useI18n()
const store = useLiveStatsStore()

// An integrated GPU reports temperature 0 and memory_total 0 because the driver
// exposes neither, not because it is cold and has no memory. Treat 0 in these
// fields as "absent" so the row shows an em dash; freq_mhz is the one field
// integrated graphics does fill in, so it earns a row of its own.
const nz = (v: unknown): number | null => (typeof v === 'number' && v > 0 ? v : null)

interface StatRow extends FitRow { label: string; value: string }

// One card's whole render, so the layouts above stay declarative.
// `integrated` comes from the backend's PCI slot (system.go isIntegratedPCISlot),
// not from guessing at the model name or at which readings are missing. A backend
// that predates the field sends nothing, which reads as false — "GPU" is the
// honest label for a card we cannot classify.
function view(g: any) {
  const tempC = nz(g && g.temperature)
  const vramTotal = nz(g && g.memory_total)
  const freqMHz = nz(g && g.freq_mhz)
  const usage = (() => {
    const u = g && g.utilization_gpu
    if (typeof u !== 'number') return null
    // A decimal below 10%, a whole number from 10% up. The decimal is what keeps
    // an idling integrated GPU's 0.687% from reading as a flat 0%, but it costs a
    // glyph the ring hole does not have: measured in Chromium at this card's ring
    // size (42cqmin = 70.5px, 57.8px hole), "43.5%" is 64.1px of ink against a
    // 49.2px chord at the text's top edge, so it spills across the colour band --
    // the very defect RingGauge was resized to remove. Under 10% the string is
    // still three digits wide and fits.
    return u < 10 ? Math.round(u * 10) / 10 : Math.round(u)
  })()
  const temp = tempC == null ? '—' : Math.round(tempC) + '℃'
  const vram = vramTotal == null ? '—' : fmtSize(vramTotal)
  const freq = freqMHz == null ? null : Math.round(freqMHz) + ' MHz'
  // utilization_memory is not gated through nz(): a discrete card with real VRAM
  // and nothing resident in it genuinely reports 0%, same as utilization_gpu can.
  // What actually means "no reading" here is the card having no VRAM at all, so
  // this is gated on vramTotal's presence instead of on the usage value itself.
  const m = g && g.utilization_memory
  const memUse = vramTotal == null || typeof m !== 'number' ? '—' : Math.round(m) + '%'
  const name = (g && g.name) || ''
  const rows: StatRow[] = [
    { key: 'model', label: t('widgetModel'), value: name || '—', has: !!name },
    { key: 'temp', label: t('widgetTemp'), value: temp, has: tempC != null },
    { key: 'vram', label: t('widgetVram'), value: vram, has: vramTotal != null },
    { key: 'vramUse', label: t('widgetVramUsage'), value: memUse, has: vramTotal != null },
  ]
  // No frequency reading at all (a discrete card reports 0) means no row, rather
  // than a fifth em dash: unlike temperature and VRAM, this field is missing from
  // whole classes of card rather than momentarily unread.
  if (freq) rows.push({ key: 'freq', label: t('widgetFreq'), value: freq, has: true })
  // The paired layout's one line lists only what this card reports. Padding it out
  // with em dashes would fill both columns with placeholders — an iGPU has nothing
  // but a frequency to show. Units only, no field names: labelled
  // ("Temp 62℃ · Frequency 2100 MHz · VRAM 16 GB") is 2.2x the width and wrapped to
  // a second line that .card-in then clipped in half. ℃/MHz/GB say which is which.
  const sub = [temp, freq, vram].filter((v) => v && v !== '—').join(' · ')
  return {
    name,
    label: g && g.integrated ? 'iGPU' : 'GPU',
    usage,
    // Pass an absent temperature through as null so heatColor takes its neutral
    // branch. A literal 0 lands in `t < 60` and paints a confident "cool green"
    // from a reading that does not exist (util/format.ts:25).
    col: heatColor(tempC),
    temp, vram, memUse, freq, sub, rows,
    // Every reading, including any row the card turns out to be too short to show,
    // so nothing becomes unreachable once rows start dropping.
    title: [name, ...rows.filter((r) => r.key !== 'model').map((r) => r.label + ' ' + r.value)].filter(Boolean).join(' · '),
  }
}

const list = computed<any[]>(() => (Array.isArray(store.gpu) ? store.gpu : []))
// Selection is by kind, never by array position: the backend sorts GPUs so that
// whichever one reports a temperature comes first, so gpu[0] is not reliably the
// discrete card once an iGPU starts reporting one too.
const igpu = computed(() => list.value.find((g) => g && g.integrated) || null)
const dgpu = computed(() => list.value.find((g) => g && !g.integrated) || null)
// Only the first of each kind gets a ring; a second discrete card would need a
// third ring, and 4x2 has no room for one.
const pair = computed(() => (igpu.value && dgpu.value ? [view(igpu.value), view(dgpu.value)] : null))
const one = computed(() => view(dgpu.value || igpu.value))
// The tall layout is per-card and does not care how many there are: one GPU fills the
// single column, two split it.
const cards = computed(() => pair.value || [one.value])

// ── How many rows actually fit ───────────────────────────────────────────────
// The card's height comes from the desktop grid (so it shrinks when the browser is
// zoomed and the viewport gets smaller in CSS px) and the row height comes from the
// font size (which Chrome's minimum-font-size setting can force upwards past anything
// the stylesheet asks for). Neither is knowable from CSS, so the rows are measured and
// the ones that do not fit are dropped -- em-dash rows first. See util/statFit.ts.
const root = ref<HTMLElement | null>(null)
const availH = ref(0)
const blockedH = ref(0)
const rowH = ref(0)
let ro: ResizeObserver | undefined

function measure() {
  const el = root.value
  if (!el) return
  const box = el.closest('.card-in') as HTMLElement | null
  if (!box) return
  availH.value = box.clientHeight
  const probe = el.querySelector('.stat-probe') as HTMLElement | null
  const stats = el.querySelector('.stats') as HTMLElement | null
  const gap = stats ? parseFloat(getComputedStyle(stats).rowGap) || 0 : 0
  rowH.value = probe ? probe.offsetHeight + gap : 0
  // The ring only eats into the rows' height where it sits above them (.gpu-cell).
  // In the wide single-GPU layout it is beside the table and costs nothing vertically.
  const cell = el.querySelector('.gpu-cell') as HTMLElement | null
  const ring = el.querySelector('.ring') as HTMLElement | null
  blockedH.value = cell && ring ? ring.offsetHeight + (parseFloat(getComputedStyle(cell).rowGap) || 0) : 0
}

const rowBudget = computed(() => fitRowCount(availH.value, blockedH.value, rowH.value))
const fitted = (c: { rows: StatRow[] }) => pickRows(c.rows, rowBudget.value)

onMounted(async () => {
  await nextTick()
  measure()
  // Observing .card-in catches the card being resized or the grid being recomputed;
  // observing the probe catches the font size changing under us. Neither reacts to
  // rows appearing or disappearing, so this cannot oscillate.
  if (typeof ResizeObserver !== 'undefined' && root.value) {
    ro = new ResizeObserver(measure)
    const box = root.value.closest('.card-in')
    const probe = root.value.querySelector('.stat-probe')
    if (box) ro.observe(box)
    if (probe) ro.observe(probe)
  }
})
onBeforeUnmount(() => ro?.disconnect())
// A layout switch (2x2 -> 4x3, or a second GPU appearing) moves the ring into or out
// of the column that holds the rows, so what counts as blocked height changes with it.
watch([() => props.item.w, () => props.item.h, () => cards.value.length], () => nextTick().then(measure))
</script>
<style scoped>
/* base.css:142,147,156-158,186-192 — gpu widget (ring-row + stats) */
.gpu-root { display: contents; }
/* minmax(0, 1fr), not 1fr: a plain 1fr floors at the track's min-content, and the
   model name is one long unbreakable run, so the table's column grew past the card
   and .card-in{overflow:hidden} cut the values off the right-hand side -- the labels
   were on screen with nothing beside them. */
.ring-row { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: stretch; gap: clamp(8px, 5cqmin, 16px); flex: 1; min-height: 0; }
/* stretch, not centre, so the ring's grid area has the row's full (definite) height for
   its max-height to resolve against; align-self puts the ring back in the middle. */
.ring-row > * { align-self: center; }
.ring-row.solo { grid-template-columns: 1fr; place-items: center; }
.stats { display: grid; gap: 2px; align-content: center; min-width: 0; }
/* Type size and padding both scale with the card: at 1600x1000 the 4x2 card is only
   ~150px tall, and fixed 11px rows with 3px padding overflowed by exactly one row.
   Scaling alone is not enough on a small enough card, which is what the measured row
   budget in the script is for. */
.stat, .stat-probe { display: flex; justify-content: space-between; gap: 8px; font-size: clamp(10px, 4.4cqmin, 14px); color: var(--fg-muted); padding: clamp(0px, 0.7cqmin, 4px) 0; line-height: 1.25; min-width: 0; }
.stat span, .stat-probe span { flex: none; }
/* flex + min-width:0 is what actually lets the long model name ellipsize; without
   the flex-basis it keeps its max-content width and only gets clipped. */
.stat b { flex: 1 1 0; text-align: right; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--fg); font-weight: 600; font-variant-numeric: tabular-nums; font-family: var(--num-font, inherit); }
/* Out of flow and invisible, but still laid out, so its height is a real row's height.
   .card-in is position:relative, which is what it is positioned against. */
.stat-probe { position: absolute; top: 0; left: 0; visibility: hidden; pointer-events: none; }
/* Two rings side by side, each over its own table. The rings run at scale 0.62 (the
   prop, not a width override from here): at full size ring + five rows came to ~194px
   against a ~178px body and .card-in clipped the bottom row, and overriding only the
   width left the percentage at full type size printing across the colour band. */
.gpu-grid { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: center; gap: clamp(10px, 5cqmin, 22px); }
/* One GPU: one column, and the ring runs at full scale since it no longer shares the
   width. Left as a grid rather than a flex column so both cases share .gpu-cell. */
.gpu-grid.single { grid-template-columns: minmax(0, 1fr); }
/* minmax(0, 1fr) auto: the ring's row is a definite track carved out of the cell's
   height, which is what lets its max-height clamp bite on a very short card; the table
   keeps its content height. align-content centres the pair inside the cell. */
.gpu-cell { display: grid; grid-template-rows: minmax(0, 1fr) auto; align-content: center; justify-items: center; gap: clamp(4px, 2cqmin, 10px); min-width: 0; width: 100%; height: 100%; }
.gpu-cell > :first-child { align-self: end; }
.gpu-cell .stats { width: 100%; }
/* Mirrors CpuWidget's .ring-pair/.ring-col — the two-ring card already looks like
   this for CPU + memory, and the GPU pair should not invent a second idiom. */
.gpu-pair { flex: 1; min-height: 0; display: flex; align-items: stretch; justify-content: space-evenly; gap: 14px; }
.gpu-col { display: grid; grid-template-rows: minmax(0, 1fr) auto; align-content: center; justify-items: center; gap: 6px; min-width: 0; }
.gpu-col > :first-child { align-self: end; }
/* nowrap + ellipsis, not wrapping: the card is 152px tall on a 1600x1000 screen, so
   a second line lands past .card-in's edge and gets sliced through the middle of the
   glyphs. Truncating visibly is the lesser evil, and the column's title attribute
   carries the model name plus every reading. */
.num-sub { max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; line-height: 1.25; font-size: clamp(10px, 5cqmin, 13px); color: var(--fg-muted); font-variant-numeric: tabular-nums; font-family: var(--num-font, inherit); }
</style>
