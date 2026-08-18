<!--
  1:1 port from Vue2 src/views/AI/Agent/stream/MessageList.vue.
  1b re-adds TimelineMinimap (1a version removed it; busy placeholder markup kept as-is —
  in 1a stage store.busy is always false so wouldn't trigger; from 1b on store.busy actually
  toggles with streaming, so placeholder activates).
-->
<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UserMessage from './UserMessage.vue'
import AssistantMessage from './AssistantMessage.vue'
import TimelineMinimap from './TimelineMinimap.vue'

interface AgentMsgLike {
  id?: string | number
  role: string
  [key: string]: unknown
}

const props = withDefaults(defineProps<{ messages: AgentMsgLike[]; busy?: boolean }>(), { busy: false })
const { t } = useI18n()

const wrap = ref<HTMLElement | null>(null)
const activeIdx = ref(0)

const lastIsAssistant = computed(() => {
  const m = props.messages[props.messages.length - 1]
  return !!(m && m.role === 'assistant')
})

function scrollToBottom() {
  const el = wrap.value
  if (el) el.scrollTop = el.scrollHeight
}

function onScroll() {
  const sc = wrap.value
  if (!sc) return
  const blocks = [...sc.querySelectorAll('[data-block]')]
  const scTop = sc.getBoundingClientRect().top
  let idx = 0
  blocks.forEach((b, i) => { if (b.getBoundingClientRect().top - scTop <= 140) idx = i })
  activeIdx.value = idx
}

// Called by TimelineMinimap's @jump, scrolls to corresponding message.
function jumpTo(i: number) {
  const sc = wrap.value
  if (!sc) return
  const b = sc.querySelectorAll('[data-block]')[i]
  if (!b) return
  const top = b.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 28
  sc.scrollTo({ top, behavior: 'smooth' })
}

watch(
  () => props.messages,
  () => { nextTick(scrollToBottom) },
  { deep: true },
)

onMounted(() => {
  const el = wrap.value
  if (el) { el.addEventListener('scroll', onScroll, { passive: true }); onScroll() }
})
onBeforeUnmount(() => {
  const el = wrap.value
  if (el) el.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <div ref="wrap" class="stream-wrap scroll">
    <TimelineMinimap :messages="messages" :active="activeIdx" @jump="jumpTo" />
    <div class="stream">
      <div
        v-for="m in messages"
        :key="m.id"
        data-block
        :data-role="m.role === 'user' ? 'user' : 'ai'"
      >
        <UserMessage v-if="m.role === 'user'" :msg="m" />
        <AssistantMessage v-else :msg="m" />
      </div>
      <div v-if="busy && !lastIsAssistant" class="msg msg-assistant">
        <div class="msg-head">
          <div class="assistant-mark" />
          <span style="font-weight: 500; color: var(--text-secondary)">Nimo</span>
        </div>
        <div class="thinking">
          <div class="thinking-icon" />
          <span style="flex: 1; color: var(--text-secondary)">
            {{ t('aiThinking') }} <span class="dots"><span /><span /><span /></span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
