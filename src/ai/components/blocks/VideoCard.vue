<!-- 1:1 移植自 Vue2 src/views/AI/Agent/blocks/VideoCard.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import AgentIcon from '../icons/AgentIcon.vue'

// 装饰性缩略图占位渐变——按 seed 取值,与应用主题(浅/深色)无关:没有真实视频帧
// 时的马赛克占位色,纯生成式,类比桌面 app 图标 .ic-* 品牌渐变的豁免,不接入
// token 体系(理由与 ImageGridCard.vue 的 PALETTES 相同)。
const PAL = [['#1FA2FF', '#12D8FA', '#A6FFCB'], ['#667EEA', '#764BA2'], ['#0BA360', '#3CBA92']]

const props = withDefaults(
  defineProps<{ title?: string; subtitle?: string; duration?: string; progress?: number; seed?: number }>(),
  { title: '', subtitle: '', duration: '', progress: 0, seed: 7 },
)

const placeholderStyle = computed(() => {
  const p = PAL[props.seed % PAL.length]
  return { position: 'absolute' as const, inset: 0, background: `linear-gradient(135deg, ${p.join(', ')})` }
})
</script>

<template>
  <div class="card video-card">
    <div class="video-thumb">
      <div :style="placeholderStyle" />
      <div class="play-btn"><AgentIcon name="play" :size="20" /></div>
      <div class="video-duration">{{ duration }}</div>
    </div>
    <div class="video-meta">
      <button class="icon-btn" style="width: 28px; height: 28px"><AgentIcon name="play" :size="14" /></button>
      <div style="flex: 1; display: flex; flex-direction: column; gap: 4px">
        <div style="font-size: 13px; font-weight: 500">{{ title }}</div>
        <div class="video-scrubber"><div class="video-scrubber-fill" :style="{ width: progress + '%' }" /></div>
      </div>
      <div style="font-size: 11px; color: var(--text-tertiary); font-variant-numeric: tabular-nums">{{ subtitle }}</div>
    </div>
  </div>
</template>
