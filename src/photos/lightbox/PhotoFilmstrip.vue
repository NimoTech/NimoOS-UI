<script setup lang="ts">
// 灯箱底部缩略图条 —— 移植自 Vue2 NimoOS-UI src/views/Photos/PhotosLightbox.vue
// 模板 :167-176(.lb-strip)+ 方法 :249-298(centerActiveThumb / findCenterThumbIndex /
// updateLocalActiveFromCenter / commitSelection / onStripWheel)。
//
// 移植 delta(见 task-8-brief.md):
//  1) Vue2 `$emit('nav', delta)`(相对翻页)→ 本组件 emit('select', 绝对 index),
//     父级(T6/T9 的 PhotoLightbox)拿到后自行调 `lb.goTo(i)`。
//  2) v-for 内 ref_for 归一数组 —— 每张缩略图共享同一 ref 名(`thumbEls`),Vue3
//     运行时收集为数组(顺序与 v-for 一致),取用前必须 `Array.isArray` 归一
//     (照抄 PhotosGrid.vue 的 `hoverPreviewRef` 写法,P1 铁律)。Vue2 原版用条件 ref
//     (`:ref="p.id===localActiveId ? 'activeThumb' : null"`)只收当前项一个;这里改成
//     "每项都收、按下标取" 更直白,避免每次 index 变化都要等一次 DOM 重渲染。
//  3) 当前项高亮按 `props.index`(数字下标)与 v-for 下标 `i` 比较,不按对象引用/id 比较。
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { service } from '@nimotech/nimoos-service'
import type { Photo } from '../util/assetToPhoto'

const props = defineProps<{ list: Photo[]; index: number }>()
const emit = defineEmits<{ (e: 'select', i: number): void }>()

function thumbnailSrc(id: string | number): string { return service.photos.thumbnailUrl(id, 'small') }

const stripEl = ref<HTMLElement | null>(null)
// ref_for -> 数组(见文件头 delta 2);歸一手法同 PhotosGrid.vue 的 hoverPreviewRef。
const thumbEls = ref<HTMLElement[] | HTMLElement | null>(null)

function elAt(i: number): HTMLElement | null {
  const raw = thumbEls.value
  const arr = Array.isArray(raw) ? raw : (raw ? [raw] : [])
  return arr[i] ?? null
}

// —— 停手守卫:centerActiveThumb 触发的滚动动画期间,wheel 计时器到点也不应误发 select ——
// (照 Vue2 :249-298 的 _programmaticScroll)
let programmaticScroll = false
let unlockTimer: ReturnType<typeof setTimeout> | null = null
let selectTimer: ReturnType<typeof setTimeout> | null = null
let lastWheelTime = 0
let centeredIndex = -1

function centerActiveThumb(smooth = true): void {
  const strip = stripEl.value
  const el = elAt(props.index)
  if (!strip || !el) return
  const target = el.offsetLeft - (strip.clientWidth - el.clientWidth) / 2
  programmaticScroll = true
  if (unlockTimer) clearTimeout(unlockTimer)
  unlockTimer = setTimeout(() => { programmaticScroll = false }, smooth ? 500 : 50)
  // jsdom(测试环境)没有实现 Element.scrollTo —— 退化为直接赋 scrollLeft。
  if (typeof strip.scrollTo === 'function') {
    strip.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'instant' } as ScrollToOptions)
  } else {
    strip.scrollLeft = target
  }
}

function findCenterThumbIndex(): number {
  const strip = stripEl.value
  if (!strip || !strip.children.length) return -1
  const center = strip.scrollLeft + strip.clientWidth / 2
  let bestI = -1
  let bestDist = Infinity
  for (let i = 0; i < strip.children.length; i++) {
    const node = strip.children[i] as HTMLElement
    const d = Math.abs(node.offsetLeft + node.clientWidth / 2 - center)
    if (d < bestDist) { bestDist = d; bestI = i }
  }
  return bestI
}

function updateLocalActiveFromCenter(): void {
  const i = findCenterThumbIndex()
  if (i < 0) return
  centeredIndex = i
}

function commitSelection(): void {
  if (programmaticScroll) return
  if (centeredIndex < 0 || centeredIndex === props.index) return
  emit('select', centeredIndex)
}

function onStripWheel(e: WheelEvent): void {
  const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX
  if (!delta) return
  e.preventDefault()
  const strip = stripEl.value
  if (!strip) return
  programmaticScroll = false
  lastWheelTime = Date.now()
  strip.scrollLeft += delta
  updateLocalActiveFromCenter()
  if (selectTimer) clearTimeout(selectTimer)
  selectTimer = setTimeout(commitSelection, 140)
}

function onThumbClick(i: number): void {
  emit('select', i)
}

// index 由外部(点击箭头/键盘/点缩略图)变化后,把该缩略图平滑居中;140ms 内刚发生过
// 滚轮的场景视为"用户手动滚出来的",不再二次平滑动画(照 Vue2 fromWheel 判断)。
watch(() => props.index, () => {
  const fromWheel = Date.now() - lastWheelTime < 600
  centerActiveThumb(!fromWheel)
})

onMounted(() => {
  // Plan F Task 4 (Vue2 param alignment, see task-4-report.md's filmstrip param table): Vue2
  // mounted() calls `centerActiveThumb()` with no argument -- i.e. the default `smooth = true`
  // (Vue2 PhotosLightbox.vue mounted():279-282) -- so every lightbox open smooth-scrolls the
  // strip to the active thumbnail. This previously passed `false` (instant) here with no
  // documented reason; corrected to match (no arg = same default as the function signature
  // above, `smooth = true`).
  centerActiveThumb()
  stripEl.value?.addEventListener('wheel', onStripWheel, { passive: false })
})
onBeforeUnmount(() => {
  stripEl.value?.removeEventListener('wheel', onStripWheel)
  if (unlockTimer) clearTimeout(unlockTimer)
  if (selectTimer) clearTimeout(selectTimer)
})
</script>

<template>
  <div ref="stripEl" class="lb-strip">
    <div
      v-for="(p, i) in list"
      :key="p.id"
      ref="thumbEls"
      class="lb-thumb"
      :data-active="i === index"
      @click="onThumbClick(i)"
    >
      <img :src="thumbnailSrc(p.id)" alt="" loading="lazy" />
      <div v-if="p.isVideo" class="thumb-vid">
        <span class="vid-play">▶</span>
        <span v-if="p.duration">{{ p.duration }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Plan F Task 5: `.lb-strip`'s `grid-area`/`display`/`gap`/`padding`/`background`/`border-top`/
   `overflow-x` are retired -- Fix round 1 had already brought every one of these to byte-exact
   parity values (parity photos.scss:648-654 `.photos-root .lb-strip`; `calc(50% - 28px)` is
   `centerActiveThumb()`'s own load-bearing centering math, unchanged, just no longer duplicated
   locally), so keeping the local copies was pure duplication once this component actually nests
   inside `.photos-root` and the `--lb-chrome`/`--line` tokens resolve for real (their fallback
   literals are dropped along with the rest -- see PhotoLightbox.vue's retirement note for why
   duplicated properties, not just fallback literals, needed to go: this component's own scoped
   style registers AFTER parity's stylesheet in every host page's import order, so a surviving
   duplicate would keep outvoting parity on every tie). Only the two properties parity's own
   `.lb-strip` doesn't declare survive: `overflow-y: hidden` and `scrollbar-width: none`
   (Firefox's scrollbar-hiding property; parity's own `::-webkit-scrollbar` rule below only
   covers WebKit). */
.lb-strip {
  overflow-y: hidden;
  scrollbar-width: none;
}
/* `::-webkit-scrollbar` retired -- parity's own `.photos-root .lb-strip::-webkit-scrollbar`
   (`height: 0`) achieves the identical "no visible scrollbar" outcome by a different property;
   no need for both. */

/* Plan F Task 5: the whole `.lb-thumb` family (base/`:hover`/`[data-active="true"]`/`img`) is
   retired -- parity's own `.photos-root .lb-thumb` family (photos.scss:656-684) is a full,
   richer replacement (56px thumbs, not 64px -- `.lb-strip`'s `calc(50% - 28px)` centering math
   above assumes parity's own 56px/2=28px, so the local 64px size was already stale the moment
   Fix round 1 byte-matched the strip's own padding; an outline+scale-pop active state instead of
   a border-color swap; `will-change`/richer transitions). Nothing here survives that parity
   doesn't already implement more completely. */

.thumb-vid {
  position: absolute;
  right: 3px;
  bottom: 3px;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 1px 4px;
  border-radius: 999px;
  font-size: 8px;
  /* theme-exception: 缩略图上的常驻角标,需在任意照片上都保持对比度,皮肤无关
     (同 PhotosGrid.vue .tile-vid / VideoHoverPreview.vue 的 chrome 先例) */
  background: rgba(0, 0, 0, 0.55); color: #fff;
}
.vid-play { font-size: 6px; }
</style>
