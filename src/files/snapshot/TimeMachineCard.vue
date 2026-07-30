<script setup lang="ts">
import { useI18n } from 'vue-i18n'

export interface TimeMachineCardItem {
  time: string
  dayLabelText: string
  label: string
  typeKind: 'auto' | 'manual' | 'preop'
  typeLabelKey: string
}

const props = defineProps<{
  item: TimeMachineCardItem
  state: 'front' | 'behind' | 'past'
  depth: number
}>()
const { t } = useI18n()
</script>

<template>
  <div
    class="tm-card"
    :class="[`is-${props.state}`, `depth-${props.depth}`, `type-${props.item.typeKind}`]"
  >
    <!-- 变换全部由 class 驱动的 CSS 决定(不写内联 transform):同一批 DOM 节点在选中变化时
         只换 class,浏览器就能沿着已声明的 transition 平滑过渡,无需任何 JS 动画循环。
         注:这条注释必须放在根元素内部,不能放在根元素之前——放在外面会让模板变成
         "注释 + div" 的多根 fragment,组件 $el 解析成注释节点,VTU 的 wrapper.classes()
         就会读到空数组(实测踩坑,已在此改正)。 -->
    <span class="tm-card-badge">{{ t(props.item.typeLabelKey) }}</span>
    <span class="tm-card-day">{{ props.item.dayLabelText }}</span>
    <span class="tm-card-time">{{ props.item.time }}</span>
    <span v-if="props.item.label" class="tm-card-label">{{ props.item.label }}</span>
  </div>
</template>

<style scoped>
.tm-card {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  padding: 20px; border-radius: 18px; text-align: center; cursor: pointer;
  color: var(--tm-fg); background: var(--tm-card-bg);
  border: 1px solid var(--tm-card-bd); box-shadow: var(--tm-card-shadow);
  transform-origin: center top;
  transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s var(--ease), filter 0.4s var(--ease);
}
/* 选中(最前) */
.is-front { transform: translate3d(0, 0, 0) scale(1); z-index: 50; opacity: 1; }
/* 更老的快照往后退 */
.is-behind.depth-1 { transform: translate3d(0, -16px, -70px) rotateX(2deg) scale(0.94); z-index: 40; opacity: 0.86; filter: brightness(0.86); }
.is-behind.depth-2 { transform: translate3d(0, -30px, -140px) rotateX(4deg) scale(0.88); z-index: 30; opacity: 0.7; filter: brightness(0.7); }
.is-behind.depth-3 { transform: translate3d(0, -42px, -210px) rotateX(6deg) scale(0.82); z-index: 20; opacity: 0.52; filter: brightness(0.56); }
.is-behind.depth-4 { transform: translate3d(0, -52px, -280px) rotateX(8deg) scale(0.76); z-index: 10; opacity: 0.34; filter: brightness(0.44); }
/* 已经翻过去的(更新的)快照朝观众飞出屏幕下方 —— 参考稿的 isPast 分支 */
.is-past { transform: translate3d(0, 300px, 200px) rotateX(-20deg) scale(1.3); opacity: 0; z-index: 60; pointer-events: none; }

.tm-card-badge {
  font-size: 10px; font-weight: 700; letter-spacing: 0.6px;
  padding: 2px 8px; border-radius: 999px;
  background: var(--nrm-bg); color: var(--nrm-fg);
}
.type-manual .tm-card-badge { background: var(--accent-soft); color: var(--accent-text); }
.type-preop .tm-card-badge { background: var(--dem-bg); color: var(--dem-fg); }
/* 类型只给最前那张卡描边着色(与刻度尺、存储区时间线同一套三色系统) */
.is-front.type-manual { border-color: var(--accent-soft-bd); }
.is-front.type-preop { border-color: var(--dem-bd); }

.tm-card-day { font-size: 12px; color: var(--tm-fg-muted); }
.tm-card-time { font-size: 30px; font-weight: 600; line-height: 1.1; }
.tm-card-label {
  font-size: 12px; color: var(--tm-fg-muted); max-width: 90%;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
@media (prefers-reduced-motion: reduce) { .tm-card { transition: none; } }
</style>
