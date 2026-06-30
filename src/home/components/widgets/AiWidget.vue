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
/* base.css:198-218 — AI widget interior + skin-spatial.css:160 orb box-shadow */
.ai { display: flex; flex-direction: column; gap: 8px; height: 100%; }
.ai-orb { width: clamp(48px, 24cqmin, 96px); height: clamp(48px, 24cqmin, 96px); margin: 4px auto 14px; border-radius: 50%; background: radial-gradient(circle at 36% 34%, #fff 0 4px, transparent 5px), radial-gradient(circle at 60% 34%, #fff 0 4px, transparent 5px), radial-gradient(circle at 64% 22%, var(--accent2), transparent 30%), radial-gradient(circle at 26% 80%, var(--accent), transparent 36%), var(--orb-core, #1a2050); box-shadow: 0 0 46px var(--orb-glow), inset 0 0 22px rgba(255,255,255,.3); animation: pulse 4s var(--ease, ease) infinite; }
.ai-copy { text-align: center; font-size: clamp(12px, 6cqmin, 16px); font-weight: 500; color: var(--fg-muted); }
.card-in:has(.ai-copy.small) { justify-content: center; gap: 10px; }
.ai-copy.small { font-size: clamp(13px, 7cqmin, 17px); }
.prompts { display: grid; gap: 8px; margin-top: 14px; }
.prompt { display: flex; align-items: center; gap: 9px; min-height: clamp(32px, 14cqmin, 42px); padding: 0 13px; border: 1px solid var(--inner-border); border-radius: var(--prompt-radius, 999px); background: var(--inner-bg); font-size: clamp(11.5px, 5cqmin, 14px); cursor: pointer; transition: background .18s, border-color .18s; }
.prompt:hover { background: var(--inner-bg-hi); }
.dot { width: clamp(18px, 9cqmin, 24px); height: clamp(18px, 9cqmin, 24px); flex: 0 0 auto; border-radius: 7px; display: grid; place-items: center; font-size: clamp(10px, 4.5cqmin, 12px); font-weight: 700; color: #fff; background: linear-gradient(145deg, var(--accent2), var(--accent)); }
.ai-send { display: flex; align-items: center; gap: 8px; margin-top: 12px; padding: 4px 4px 4px 14px; border: 1px solid var(--inner-border); border-radius: var(--prompt-radius, 999px); background: var(--inner-bg); }
.ai-send:focus-within { border-color: var(--accent); }
.ai-input { flex: 1 1 auto; min-width: 0; border: 0; background: transparent; color: var(--fg); font: inherit; font-size: clamp(11.5px, 5cqmin, 14px); outline: none; }
.ai-input::placeholder { color: var(--fg-faint); }
.ai-go { flex: 0 0 auto; display: grid; place-items: center; width: clamp(28px, 12cqmin, 36px); height: clamp(28px, 12cqmin, 36px); border: 0; border-radius: 50%; background: linear-gradient(145deg, var(--accent2), var(--accent)); color: var(--on-accent, #fff); cursor: pointer; transition: filter .18s, transform .12s var(--ease, ease); }
.ai-go:hover { filter: brightness(1.08); }
.ai-go:active { transform: scale(.94); }
.ai-go .icon { width: 56%; height: 56%; stroke: currentColor; }
</style>
