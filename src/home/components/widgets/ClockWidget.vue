<!--
  风格 C · 指针 + Helvetica 大字（A+B 结合）

  卡片底色由 WidgetCard.vue 的 .card.w-clock { background: var(--clock-bg) } 提供。
  想要预览里那种紫玻璃质感，把 theme.css 里的 --clock-bg 改成：
    --clock-bg: linear-gradient(155deg, rgba(152,152,224,.5), rgba(108,110,186,.32));
  想保留原来的蓝白玻璃则无需改动。

  尺寸自适应（item.h 为行数、item.w 为列数）：
    h<2            → 仅时间（1×2）
    w>=4, h>=2     → 指针 + 大字 + 问候/日期（2×4）
    w==3, h>=2     → 指针 + 星期/时间/日期 居中（2×3）
    其余(2×2)       → 指针在上、时间在下，垂直居中
-->
<template>
  <div class="clock" :class="'v-' + variant" data-clock-widget>
    <svg v-if="variant !== 'mini'" class="dial" viewBox="0 0 100 100" aria-hidden="true">
      <circle class="face" cx="50" cy="50" r="48" />
      <line
        v-for="(_, i) in 12"
        :key="i"
        class="tick"
        :class="{ major: i % 3 === 0 }"
        x1="50" :y1="i % 3 === 0 ? 6 : 8"
        x2="50" :y2="i % 3 === 0 ? 13 : 12"
        :transform="`rotate(${i * 30} 50 50)`"
      />
      <line class="hand hour"   x1="50" y1="50" x2="50" y2="30" :transform="`rotate(${hourDeg} 50 50)`" />
      <line class="hand minute" x1="50" y1="50" x2="50" y2="20" :transform="`rotate(${minDeg} 50 50)`" />
      <line class="hand second" x1="50" y1="54" x2="50" y2="16" :transform="`rotate(${secDeg} 50 50)`" />
      <circle class="pin" cx="50" cy="50" r="3.2" />
    </svg>

    <div class="txt">
      <template v-if="variant === 'wide'">
        <span class="greet">{{ greeting }}</span>
        <span class="time" data-clock-time>{{ time }}</span>
        <span class="sub">{{ dateCN }} · {{ weekday }}</span>
      </template>
      <template v-else-if="variant === 'med'">
        <span class="wk">{{ weekday }}</span>
        <span class="time" data-clock-time>{{ time }}</span>
        <span class="sub">{{ dateCN }}</span>
      </template>
      <template v-else>
        <span class="time" data-clock-time>{{ time }}</span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LayoutItem } from '../../grid/types'

const props = defineProps<{ item: LayoutItem }>()
const { t } = useI18n()

const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => { timer = setInterval(() => { now.value = new Date() }, 1000) })
onUnmounted(() => { if (timer) clearInterval(timer) })

const pad = (n: number) => String(n).padStart(2, '0')
const WEEK = computed(() => t('clockWeekdays').split(','))

const time = computed(() => pad(now.value.getHours()) + ':' + pad(now.value.getMinutes()))
const weekday = computed(() => WEEK.value[now.value.getDay()])
const dateCN = computed(() => t('clockDate', { m: now.value.getMonth() + 1, d: now.value.getDate() }))
const greeting = computed(() => {
  const h = now.value.getHours()
  const k = h < 5 ? 'clockGreetDawn' : h < 11 ? 'clockGreetMorning' : h < 13 ? 'clockGreetNoon' : h < 18 ? 'clockGreetAfternoon' : 'clockGreetEvening'
  return t(k)
})

const hourDeg = computed(() => (now.value.getHours() % 12) * 30 + now.value.getMinutes() * 0.5)
const minDeg = computed(() => now.value.getMinutes() * 6 + now.value.getSeconds() * 0.1)
const secDeg = computed(() => now.value.getSeconds() * 6)

const variant = computed<'mini' | 'wide' | 'med' | 'square'>(() => {
  const { w, h } = props.item
  if (h < 2) return 'mini'
  if (w >= 4) return 'wide'
  if (w === 3) return 'med'
  return 'square'
})
</script>

<style scoped>
.clock { width: 100%; height: 100%; display: flex; color: var(--fg); overflow: hidden; }
.txt { display: flex; flex-direction: column; }
.time {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-weight: 200; line-height: .82; letter-spacing: -.04em;
  font-variant-numeric: tabular-nums;
  font-size: 1em;                 /* time = 该档的基准字号(容器 font-size) */
}
/* 等比例缩放:每档只让基准字号 font-size 随卡片(cqmin)缩放;其余尺寸(表盘/间距/次要文字)
   全部用 em 表达 = 原设计 px ÷ 基准 px,于是所有元素严格按原比例一起放大缩小。
   clamp 上限 = 原写死值(大屏观感不变),下限保证小屏可读。 */
.greet { opacity: .68; }
.sub   { opacity: .68; }
.wk    { opacity: .82; }

/* —— 2×4(基准 time=100px)—— */
.v-wide { font-size: clamp(30px, 40cqmin, 100px); flex-direction: row; align-items: center; justify-content: center; gap: .34em; padding: .28em .34em; }
.v-wide .dial { width: 1.7em; height: 1.7em; }
.v-wide .txt { gap: .06em; }
.v-wide .time { margin-left: -.07em; }
.v-wide .greet { font-size: max(11px, .14em); }
.v-wide .sub   { font-size: max(11px, .17em); opacity: .78; }

/* —— 2×3(基准 time=70px)—— */
.v-med { font-size: clamp(26px, 32cqmin, 70px); flex-direction: row; align-items: center; justify-content: center; gap: .371em; padding: .371em; }
.v-med .dial { width: 2.086em; height: 2.086em; }
.v-med .txt { align-items: center; text-align: center; gap: .086em; }
.v-med .wk  { font-size: max(12px, .257em); }
.v-med .sub { font-size: max(11px, .214em); }

/* —— 2×2(基准 time=52px)—— */
.v-square { font-size: clamp(22px, 23cqmin, 52px); flex-direction: column; align-items: center; justify-content: center; gap: .269em; padding: .308em; }
.v-square .dial { width: 2.46em; height: 2.46em; }
.v-square .time { line-height: .85; letter-spacing: -.035em; }

/* —— 1×2（仅时间,基准 time=66px)—— */
.v-mini { font-size: clamp(24px, 52cqmin, 66px); align-items: center; justify-content: center; padding: 0 .333em; }
.v-mini .time { letter-spacing: -.035em; }

/* —— 表盘 —— */
.dial { flex: 0 0 auto; }
.face { fill: var(--spark-grid); stroke: var(--fg-faint); stroke-width: 1; }
.tick { stroke: var(--fg-muted); stroke-width: 1; stroke-linecap: round; }
.tick.major { stroke-width: 2; }
.hand { stroke: var(--fg); stroke-linecap: round; }
.hand.hour { stroke-width: 3; }
.hand.minute { stroke-width: 2; }
.hand.second { stroke: var(--accent2, #b79bff); stroke-width: 1.4; }
.pin { fill: var(--fg); }

@media (prefers-reduced-motion: reduce) {
  .hand { transition: none; }
}
</style>
