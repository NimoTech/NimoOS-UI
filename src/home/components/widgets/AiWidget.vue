<template>
  <div class="ai" :class="layoutClass">
    <div v-if="big" class="ai-orb" />
    <div class="ai-copy" :class="{ small: tiny }">{{ tiny ? '晚上好' : '晚上好，有什么可以帮你？' }}</div>
    <form class="ai-send" @submit.prevent="send()">
      <input v-model="text" class="ai-input" type="text" autocomplete="off" placeholder="发消息给 AI 助手…" aria-label="发消息给 AI 助手" />
      <button class="ai-go" type="submit" aria-label="发送">↑</button>
    </form>
    <div v-if="!tiny" class="prompts">
      <button v-for="p in prompts" :key="p" class="prompt" @click="send(p)">{{ p }}</button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { LayoutItem } from '../../grid/types'
import { useOpenAction } from '../../composables/useOpenAction'
const props = defineProps<{ item: LayoutItem }>()
const text = ref('')
const { sendToAI } = useOpenAction()
const big = computed(() => props.item.w >= 4 && props.item.h >= 4)
const tiny = computed(() => !(props.item.h >= 2 && props.item.w >= 3) && !big.value)
const layoutClass = computed(() => (big.value ? 'big' : tiny.value ? 'tiny' : 'mid'))
const allPrompts = ['整理最近的照片', '查找 2024 旅行视频', '分析存储使用情况']
const prompts = computed(() => (big.value ? allPrompts : allPrompts.slice(0, 1)))
function send(preset?: string) {
  const msg = (preset ?? text.value).trim()
  if (!msg) return
  sendToAI(msg)
}
</script>
<style scoped>
.ai { display: flex; flex-direction: column; gap: 8px; height: 100%; }
.ai-orb { width: 40px; height: 40px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, #8fd3ff, #4c8dff 60%, #2a5bd0); }
.ai-copy { font-size: clamp(13px, 8cqmin, 20px); }
.ai-copy.small { font-size: 13px; }
.ai-send { display: flex; gap: 6px; }
.ai-input { flex: 1; min-width: 0; background: rgba(255,255,255,.08); border: 0; border-radius: 10px; padding: 6px 10px; color: inherit; }
.ai-go { background: var(--accent); color: #061018; border: 0; border-radius: 10px; width: 32px; cursor: pointer; }
.prompts { display: flex; flex-direction: column; gap: 4px; }
.prompt { text-align: left; font-size: 11px; padding: 5px 8px; border-radius: 8px; background: rgba(255,255,255,.05); border: 0; color: inherit; cursor: pointer; }
</style>
