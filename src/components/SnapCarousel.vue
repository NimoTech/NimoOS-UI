<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{ ariaLabel?: string }>()
const { t } = useI18n()

const viewport = ref<HTMLElement | null>(null)
const atStart = ref(true)
const atEnd = ref(true)

/** 端点检测:两端各留 1px 容差(smooth 滚动的亚像素余量) */
function recalc() {
  const el = viewport.value
  if (!el) return
  atStart.value = el.scrollLeft <= 1
  atEnd.value = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
}
function page(dir: 1 | -1) {
  const el = viewport.value
  if (!el) return
  el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.9), behavior: 'smooth' })
  // 乐观更新:刚朝一个方向翻页,必然离开了对侧端点——不必等 smooth 滚动的 scroll 事件才解锁对侧按钮。
  // 真实端点状态仍由 @scroll -> recalc() 持续校正(见下方监听),这里只处理"刚离开的那一侧"。
  if (dir > 0) atStart.value = false
  else atEnd.value = false
}

let ro: ResizeObserver | undefined
onMounted(() => {
  recalc()
  if (typeof ResizeObserver !== 'undefined' && viewport.value) {
    ro = new ResizeObserver(recalc)
    ro.observe(viewport.value)
  }
})
onUnmounted(() => ro?.disconnect())
</script>

<template>
  <div class="snap-carousel" :aria-label="ariaLabel">
    <button class="snap-btn snap-prev" type="button" :disabled="atStart" :aria-label="t('carouselPrev')" @click="page(-1)">‹</button>
    <div ref="viewport" class="snap-viewport" @scroll.passive="recalc">
      <slot />
    </div>
    <button class="snap-btn snap-next" type="button" :disabled="atEnd" :aria-label="t('carouselNext')" @click="page(1)">›</button>
  </div>
</template>

<style scoped>
.snap-carousel { display: flex; align-items: center; gap: 8px; min-width: 0; }
.snap-viewport {
  flex: 1 1 auto; min-width: 0;
  display: flex; gap: 14px; overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none; /* 翻页钮承担滚动可供性,隐藏原生条 */
}
.snap-viewport::-webkit-scrollbar { display: none; }
.snap-viewport > :slotted(*) { scroll-snap-align: start; flex: 0 0 auto; }
.snap-btn {
  flex: 0 0 auto; width: 30px; height: 30px; cursor: pointer;
  font-size: 16px; line-height: 1; color: var(--fg);
  background: var(--chip-bg); border: 1px solid var(--card-border); border-radius: 999px;
}
.snap-btn:hover:not(:disabled) { background: var(--chip-bg-hi); }
.snap-btn:disabled { opacity: 0.35; cursor: default; }
</style>
