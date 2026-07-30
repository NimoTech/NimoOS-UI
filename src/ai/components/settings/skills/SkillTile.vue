<!--
  SP8-P3a Task 3 —— 1:1 移植自 Vue2 src/views/AI/Skills/SkillTile.vue(43 行)。

  【偏离 3(公共约束 §3.2)】SkillIcon.vue 不移植,统一用 AgentIcon
  (../../icons/AgentIcon.vue)。

  【颜色查表改动】Vue2 :18-26 的 COLORS 是字面量渐变表(color-guard 禁字面量),
  改为 token 名查表 → var(--grad-sk-<id>),token 定义见 tokens.scss:228-234
  (SP8-P3a Task 1 已加)。未知 id 回落 blue,行为对齐 Vue2 :40
  `COLORS[this.color] || COLORS.blue`。

  【color="white" 处理】Vue2 :11 给 SkillIcon 传具名色 white。AgentIcon 的 color
  prop 直接进 SVG stroke 属性(见 AgentIcon.vue:76,84),不是 CSS 字面量但仍是颜色
  值,同样受配色约定管辖。本组件复用的 .sk-tile 规则
  (skills-styles.scss:117)已把 `color: var(--text-on-accent)` 设到容器上 ——
  与既有彩色方块内图标的「恒白前景」token 用法一致(McpCallCard.vue
  `.mcc-call-tile` 等同款场景)。AgentIcon 的 color prop 默认值本就是
  currentColor(AgentIcon.vue:76),这里显式传 currentColor 通过 CSS 继承拿到
  --text-on-accent,不在本组件里重复书写 token。

  Vue2 :28 具名导出 SKILL_COLORS(字面量渐变表),供 AddSkillModal 取色盘用。P3a
  无消费方,改为导出 id 列表 SKILL_COLOR_IDS(不导出颜色字面量),留给 P3b 用。
  `<script setup>` 不支持顶层 export,故用一个普通 `<script>` 块承载这一具名导出。
-->
<script lang="ts">
// Vue2 SkillTile.vue:18-26 COLORS 的 key 顺序原样保留。
export const SKILL_COLOR_IDS = ['blue', 'purple', 'pink', 'orange', 'green', 'teal', 'slate'] as const
</script>

<script setup lang="ts">
import { computed } from 'vue'
import AgentIcon from '../../icons/AgentIcon.vue'

const props = withDefaults(
  defineProps<{ color?: string; icon?: string; size?: number; radius?: number }>(),
  { color: 'blue', icon: 'sparkle', size: 30, radius: 9 },
)

// Vue2 SkillTile.vue:40 `COLORS[this.color] || COLORS.blue` 的等价实现 ——
// 查 token 名而非字面量,未知 id 回落 blue。
const bg = computed(() => {
  const id = (SKILL_COLOR_IDS as readonly string[]).includes(props.color) ? props.color : 'blue'
  return `var(--grad-sk-${id})`
})
</script>

<template>
  <div
    class="sk-tile"
    :style="{
      background: bg,
      width: size + 'px',
      height: size + 'px',
      borderRadius: radius + 'px',
    }"
  >
    <AgentIcon :name="icon" :size="Math.round(size * 0.5)" color="currentColor" />
  </div>
</template>
