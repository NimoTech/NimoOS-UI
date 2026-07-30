<script setup lang="ts">
import { computed } from 'vue'
import TimeMachineCard from './TimeMachineCard.vue'
import { buildVisibleStack } from '../util/timeMachineMath'

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

const props = defineProps<{ items: DeckItem[]; selectedIndex: number }>()
const emit = defineEmits<{ (e: 'select', index: number): void; (e: 'enter'): void }>()

// 只渲染可见窗口(选中 + 后 4 张 + 已翻过去的 2 张),而不是整个列表:一个卷可能保留
// 上百个快照,全渲染成绝对定位卡片纯属浪费。
const visible = computed(() => buildVisibleStack(props.items, props.selectedIndex, 5, 2))

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
        @click="onCardClick(entry)"
      />
    </div>
  </div>
</template>

<style scoped>
.tm-deck { position: relative; width: min(460px, 68vw); height: min(280px, 40vh); perspective: 1400px; }
.tm-deck-inner { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; }
</style>
