<!-- 1:1 移植自 Vue2 src/views/AI/Agent/stream/TimelineMinimap.vue -->
<script setup lang="ts">
import { ref, computed, onBeforeUpdate } from 'vue'
import { useI18n } from 'vue-i18n'
import { tickWidth, clip, ticksFromMessages, type AgentMessageLike } from '../../util/timelineMath'

const props = withDefaults(
  defineProps<{ messages?: AgentMessageLike[]; active?: number }>(),
  { messages: () => [], active: 0 },
)
const emit = defineEmits<{ (e: 'jump', i: number): void }>()
const { t } = useI18n()

const wrap = ref<HTMLElement | null>(null)
const cy = ref<number | null>(null)

// v-for template refs: Vue3 doesn't reliably keep array order across re-renders
// for the string `ref="…"` shorthand, so collect via a function ref reset each
// update — equivalent to Vue2's `this.$refs.tickEls` array.
const tickEls = ref<(Element | null)[]>([])
onBeforeUpdate(() => { tickEls.value = [] })
function setTickEl(el: Element | null, i: number) {
  tickEls.value[i] = el
}

const ticks = computed(() => ticksFromMessages(props.messages))

const nearest = computed(() => {
  if (cy.value == null) return -1
  const els = tickEls.value
  let best = Infinity
  let idx = -1
  els.forEach((el, i) => {
    if (!el) return
    const r = el.getBoundingClientRect()
    const d = Math.abs((cy.value as number) - (r.top + r.height / 2))
    if (d < best) { best = d; idx = i }
  })
  return idx
})

const preview = computed(() => {
  const n = nearest.value
  if (n < 0 || !wrap.value) return null
  // user block of this exchange = nearest minus its odd offset
  const u = n - (n % 2)
  const wrapTop = wrap.value.getBoundingClientRect().top
  const el = tickEls.value[n]
  const y = el
    ? (el.getBoundingClientRect().top - wrapTop + el.getBoundingClientRect().height / 2)
    : 0
  const userText = ticks.value[u] && ticks.value[u].text
  const aiText = ticks.value[u + 1] && ticks.value[u + 1].text
  return { user: clip(userText || ''), ai: clip(aiText || ''), y }
})

function widthFor(i: number) {
  if (cy.value == null) return tickWidth(null)
  const el = tickEls.value[i]
  if (!el) return tickWidth(null)
  const r = el.getBoundingClientRect()
  const d = Math.abs(cy.value - (r.top + r.height / 2))
  return tickWidth(d)
}

function onMove(e: MouseEvent) {
  cy.value = e.clientY
}
function onLeave() {
  cy.value = null
}
</script>

<template>
  <div ref="wrap" class="timeline" @mousemove="onMove" @mouseleave="onLeave">
    <div
      v-for="(tick, i) in ticks"
      :key="(tick.id as string | number | undefined) ?? i"
      :ref="(el) => setTickEl(el as Element | null, i)"
      class="tl-tick"
      :data-role="tick.role"
      :data-active="i === active"
      :data-near="i === nearest"
      :style="{ width: widthFor(i).toFixed(1) + 'px' }"
      @click="emit('jump', i)"
    />
    <div v-if="preview" class="tl-preview" :style="{ top: preview.y + 'px' }">
      <div class="tlp-row" data-role="user">
        <span class="tlp-tag">{{ t('aiTimelineYou') }}</span>
        <span class="tlp-txt">{{ preview.user }}</span>
      </div>
      <div class="tlp-row" data-role="ai">
        <span class="tlp-tag">Nimo</span>
        <span class="tlp-txt">{{ preview.ai }}</span>
      </div>
    </div>
  </div>
</template>
