<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { buildRailNodes, computeFisheyeScales } from '../util/timeMachineMath'

export interface RailItem { flatIndex: number; time: string; typeKind: 'auto' | 'manual' | 'preop' }
export interface RailGroup { dayKey: string; labelText: string; items: RailItem[] }

const props = defineProps<{ groups: RailGroup[]; selectedIndex: number }>()
const emit = defineEmits<{ (e: 'select', index: number): void }>()
const { t } = useI18n()

const nodes = computed(() => buildRailNodes(props.groups))
const itemByIndex = computed(() => {
  const map: Record<number, RailItem> = {}
  for (const g of props.groups) for (const it of g.items) map[it.flatIndex] = it
  return map
})

const scales = ref<Record<number, number>>({})
const hoveredIndex = ref<number | null>(null)
// 当前浮出标签相对 .tm-rail 的竖直位置(px)——只在 mouseenter 那一刻算一次,不随
// 鱼眼缩放的 rAF 循环重算,标签不需要跟手抖动。
const hoverLabelTop = ref(0)
const railEl = ref<HTMLElement | null>(null)
let rafHandle: number | null = null
let pendingY = 0

// 光标距离驱动的连续放大。一帧内的一串 mousemove 只安排一次重算(rAF 合并),
// 回调触发时用最新的光标 Y —— 纯 CSS 的 :hover 只能做离散档位,表达不了连续函数。
function onMouseMove(e: MouseEvent) {
  pendingY = e.clientY
  if (rafHandle !== null) return
  rafHandle = requestAnimationFrame(() => {
    rafHandle = null
    updateScales(pendingY)
  })
}

function updateScales(cursorY: number) {
  const root = railEl.value
  if (!root) return
  // 只选 [data-flat-index](主刻度自己的下标)—— 子刻度故意换用另一个属性名
  // (data-anchor-index),不参与这次查询。评审发现的真实 bug:子刻度原先也标了
  // data-flat-index="它锚定的主刻度下标",与主刻度的下标"撞了名字";DOM 顺序是
  // main → sub → sub → nextMain…,下面这行按 DOM 顺序"后写覆盖先写",于是几乎每条
  // 主刻度在 map 里存的其实是它自己最后一条子刻度算出来的缩放值(子刻度物理位置比主刻度
  // 靠下几像素,导致主刻度的鱼眼峰值系统性偏小)。子刻度渲染时仍用 scaleStyle(anchorIndex)
  // 读同一个 map——由于 key 相同、值现在只来自主刻度自己,子刻度会跟着它锚定的主刻度同步
  // 缩放,视觉效果不变,但数值来源正确了。
  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-flat-index]'))
  const indices = els.map((el) => Number(el.dataset.flatIndex))
  const centers = els.map((el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2 })
  const out = computeFisheyeScales(centers, cursorY)
  const map: Record<number, number> = {}
  indices.forEach((idx, i) => { map[idx] = out[i] })
  scales.value = map
}

function onMouseLeave() {
  hoveredIndex.value = null
  scales.value = {}
}

// 主刻度与子刻度共用这一个 handler:子刻度传的是它吸附到的 anchorIndex,所以浮出的
// 标签内容天然就是"这条子刻度所属主刻度"的时间,和点击吸附的目标保持一致。
function onTickHover(e: MouseEvent, flatIndex: number) {
  hoveredIndex.value = flatIndex
  const el = e.currentTarget as HTMLElement
  hoverLabelTop.value = el.offsetTop + el.offsetHeight / 2
}

onUnmounted(() => { if (rafHandle !== null) cancelAnimationFrame(rafHandle) })

// The rail scrolls once the snapshots outgrow its height, and the deck/bottom
// bar were the only things following the selection -- pressing up/down past the
// visible range moved everything except the rail, which looked frozen.
//
// `block: 'nearest'` so an already-visible tick is left exactly where it is;
// anything else would yank the whole rail on every keypress.
watch(() => props.selectedIndex, async (index) => {
  await nextTick()
  const root = railEl.value
  if (!root) return
  const el = root.querySelector<HTMLElement>(`[data-flat-index="${index}"]`)
  el?.scrollIntoView({ block: 'nearest' })
})

function scaleStyle(flatIndex: number) {
  const s = scales.value[flatIndex]
  return s ? { transform: `scaleX(${s})` } : undefined
}

const hoveredItem = computed(() => (hoveredIndex.value !== null ? itemByIndex.value[hoveredIndex.value] : null))
</script>

<template>
  <div ref="railEl" class="tm-rail" @mousemove="onMouseMove" @mouseleave="onMouseLeave">
    <template v-for="node in nodes" :key="node.key">
      <div v-if="node.type === 'day'" class="tm-rail-day">{{ node.label }}</div>

      <button
        v-else-if="node.type === 'main'"
        type="button"
        class="tm-tick tm-tick-main"
        :class="[`type-${itemByIndex[node.flatIndex!]?.typeKind}`, { 'is-selected': node.flatIndex === props.selectedIndex }]"
        :data-flat-index="node.flatIndex"
        :style="scaleStyle(node.flatIndex!)"
        :aria-label="t('tmRailJumpTo', { time: itemByIndex[node.flatIndex!]?.time })"
        @mouseenter="onTickHover($event, node.flatIndex!)"
        @click="emit('select', node.flatIndex!)"
      ></button>

      <!-- 装饰性子刻度:不可独立选中(不是 button,键盘/屏幕阅读器跳过它),点它吸附到
           它所属的主刻度(anchorIndex)。注意:这里故意用 data-anchor-index,不能改回
           data-flat-index —— 那会和主刻度的下标撞名,见 updateScales() 里的注释。 -->
      <div
        v-else
        class="tm-tick tm-tick-sub"
        aria-hidden="true"
        :data-anchor-index="node.anchorIndex"
        :style="scaleStyle(node.anchorIndex!)"
        @mouseenter="onTickHover($event, node.anchorIndex!)"
        @click="emit('select', node.anchorIndex!)"
      ></div>
    </template>

    <!-- 悬停标签特意放在 .tm-rail 这一层,而不是塞进刻度按钮里当子元素:刻度用 scaleX
         做连续鱼眼放大,标签若是它的子元素会被父级 transform 一并横向拉扁,想抵消就得
         套一层反向 scaleX(1/父级缩放) 并把缩放值层层传下去,徒增耦合还容易在缩放值变化的
         中间帧算错。挪出来做绝对定位、跟随当前 hover 项的位置渲染,它就单纯是 .tm-rail
         的一个兄弟节点,天然不在被缩放元素的子树里,不可能被那个 transform 影响到
         ——不依赖任何数值抵消,structurally 就不会被拉伸。 -->
    <span v-if="hoveredItem" class="tm-tick-label" :style="{ top: `${hoverLabelTop}px` }">{{ hoveredItem.time }}</span>
  </div>
</template>

<style scoped>
.tm-rail {
  /* 上边从齿轮下方开始(齿轮 top:16 + 约 24px 高),下边贴住底栏顶沿 —— 正好占满
     "设置按钮"到"进入此快照"之间那一段(用户反馈:刻度原先全挤在最上面一小截)。 */
  position: absolute; top: 48px; right: 0; bottom: 76px; width: 96px;
  padding: 4px 20px 4px 0; z-index: 1;
  /* space-between 把刻度均匀铺满整条高度,而不是按内容高度挤在顶上。快照多到装不下时
     它自动失效(没有多余空间可分),退回正常的从上往下排 + 滚动,不会把首条顶出可视区
     ——这是 space-between 相对 center/space-around 的关键区别,别改成那两个。 */
  display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; gap: 5px;
  /* CSS 规范:一轴非 visible 时另一轴的 visible 会被强制计算成 auto —— 之前分开写
     overflow-y: auto; overflow-x: visible 是句假话,实际生效值两轴都是 auto。改成
     显式 overflow: auto,如实反映浏览器真正的行为。鱼眼放大时刻度靠 transform-origin:
     right center 往左长(最宽 26px*2.2≈57px),content-box 有 76px 宽(96 - 20 内边距),
     富余够大,不会被这层裁到。 */
  overflow: auto; scrollbar-width: thin;
}
.tm-rail-day {
  width: 100%; text-align: right; margin-top: 6px;
  font-size: 9px; font-weight: 600; letter-spacing: 0.5px;
  color: var(--tm-fg-muted);
}
.tm-rail-day:first-child { margin-top: 0; }
.tm-tick {
  position: relative; height: 3px; border: none; padding: 0; border-radius: 2px;
  transform-origin: right center; cursor: pointer;
  transition: transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.15s var(--ease);
}
.tm-tick-main { width: 26px; background: var(--tm-rail); }
.tm-tick-sub { width: 18px; background: var(--tm-rail-sub); }
.tm-tick-main.type-manual { background: var(--accent); }
.tm-tick-main.type-preop { background: var(--dem-fg); }
.tm-tick-main.is-selected { height: 4px; background: var(--accent); box-shadow: 0 0 8px var(--accent-soft-2); }
.tm-tick-label {
  position: absolute; right: 34px; white-space: nowrap;
  font-size: 10px; font-weight: 600; color: var(--tm-fg);
  transform: translateY(-50%); pointer-events: none;
}
@media (prefers-reduced-motion: reduce) { .tm-tick { transition: none; } }
</style>
