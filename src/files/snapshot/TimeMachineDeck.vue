<script setup lang="ts">
import { computed } from 'vue'
import TimeMachineCard from './TimeMachineCard.vue'
import { buildVisibleStack, DECK_WINDOW } from '../util/timeMachineMath'
import type { DeckPreview } from '../composables/useDeckPreview'

// 形状与 T7 覆盖层里的 FlatSnapshotItem 一致(TS 结构类型,不需要互相 import);
// 这里独立声明是为了让卡堆不依赖覆盖层,单测可以直接造数据。
export interface DeckItem {
  id?: number | string
  name: string
  label: string
  typeKind: 'auto' | 'manual' | 'preop'
  typeLabelKey: string
  time: string
  createdAt: string | number
  flatIndex: number
  dayLabelText: string
}

const props = defineProps<{ items: DeckItem[]; selectedIndex: number; previews?: Record<string, DeckPreview> }>()
const emit = defineEmits<{ (e: 'select', index: number): void; (e: 'enter'): void }>()

// 只渲染可见窗口(选中 + 后 4 张 + 已翻过去的 2 张),而不是整个列表:一个卷可能保留
// 上百个快照,全渲染成绝对定位卡片纯属浪费。窗口大小必须与 TimeMachineOverlay 拉预览用的
// 窗口一致(否则最前的卡拿不到缩略图)—— 两处都从 DECK_WINDOW 取值,不再各写一份字面量
// (评审修复 Important:改窗口大小时只改一处会无声地漏改另一处,没有任何报错或红测试)。
const visible = computed(() => buildVisibleStack(props.items, props.selectedIndex, DECK_WINDOW.depth, DECK_WINDOW.past))

function onCardClick(entry: { index: number; state: string }) {
  if (entry.state === 'past') return // 已经飞出屏幕的卡不接受点击(jsdom 不生效 pointer-events:none,靠这行早退拦住)
  if (entry.state === 'front') emit('enter') // 点你正在看的那张 = 进去,和真 Time Machine 一致
  else emit('select', entry.index)
}
</script>

<template>
  <div class="tm-deck">
    <div class="tm-deck-inner">
      <TimeMachineCard
        v-for="entry in visible"
        :key="entry.item.name"
        :item="entry.item"
        :state="entry.state"
        :depth="entry.depth"
        :preview="props.previews?.[entry.item.name] ?? null"
        @click="onCardClick(entry)"
      />
    </div>
  </div>
</template>

<style scoped>
/* 卡片放大到 3/4 屏(用户指定)。两个 min() 是防撞下限,不是"缩水":
   宽 —— 右边缘那条刻度尺占 96px 且是绝对定位(不参与 flex 让位),窄屏上 75vw 会顶到它;
   高 —— 底栏固定 76px + 左上角那行路径,矮屏上 75vh 会压到底栏上。
   常见屏幕(≥1280×800)两个 min() 都取 75vw/75vh 那一侧,即真的是 3/4 屏。
   perspective 从 1400 加深到 2400:卡片变大后近大远小的畸变会跟着放大,原值下最后
   一张会被透视拉得明显变形。 */
.tm-deck {
  position: relative;
  width: min(75vw, calc(100vw - 260px));
  height: min(75vh, calc(100vh - 190px));
  perspective: 2400px;
}
.tm-deck-inner { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; }
</style>
