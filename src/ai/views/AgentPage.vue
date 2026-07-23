<!--
  1:1 移植自 Vue2 src/views/AI/Agent/Agent.vue(242 行),1a 裁剪版:
  去 AgentComposer(发送链路,1b/1c)、AgentRightPanel(1c),以及
  systemMetrics/disks/thinking/models 的装载段(1b/1c)。右侧面板在 1a
  永久折叠(data-rightcollapsed 写死 true,而不是像 Vue2 那样绑 store 状态——
  1a store 里 rightCollapsed 恒 true,直接写死更直白)。

  主题持久化已下沉到 store.toggleTheme(Task 2 里直接 localStorage.setItem),
  这里不再像 Vue2 Agent.vue:117-119 那样额外 watch store.theme 落盘。
-->
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAgentStore } from '../stores/agentStore'
import { provideAgentStore } from '../composables/useProvidedAgentStore'
import { useToast } from '../../stores/toast'
import AgentSidebar from '../components/shell/AgentSidebar.vue'
import AgentTopbar from '../components/shell/AgentTopbar.vue'
import MessageList from '../components/stream/MessageList.vue'
import EmptyState from '../components/stream/EmptyState.vue'
import '../styles/tokens.scss'
import '../styles/agent-styles.scss'

const store = useAgentStore()
provideAgentStore(store)
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()

// store.messages is typed as the loose AgentMessage (Record<string, unknown>) —
// MessageList needs `role` to be known-present. Runtime shape always has it
// (backend contract), this is a type-level bridge only.
interface AgentMsgLike { id?: string | number; role: string; [key: string]: unknown }
const messagesForList = computed(() => store.messages as unknown as AgentMsgLike[])

// Agent.vue:104-108 semantics: fall back to '' when the active session has no
// (or an empty) title — AgentTopbar shows its own placeholder in that case.
const currentSessionTitle = computed(() => {
  const id = store.activeSessionId
  const s = store.sessions.find((x) => x.id === id)
  return s && s.title ? s.title : ''
})

function onOpenSettings() {
  // P2: router.push('/ai/settings') — 路由该期才存在,先占位(评审跟进:
  // 路由不存在且无 catch-all,push 会落到空白死页)。
  toast.show(t('aiSettingsComingSoon'))
}

function onUpdateTitle(title: string) {
  if (store.activeSessionId) store.setSessionTitle(store.activeSessionId, title)
}

onMounted(async () => {
  store.initTheme()
  try {
    await store.loadSessions()
  } catch {
    /* ignore — mirrors Vue2 Agent.vue's swallow-per-call mounted sequence */
  }
  try {
    // 在 auto-send 交接(Task 11)之前先把默认模型定下来,否则那时
    // selectedModel 还是 null,send() 会先落一个 "无模型" 的错误 block。
    await store.loadAvailableModels()
  } catch {
    /* ignore — 拉模型失败不该挡住页面渲染,send() 自己会兜底提示无模型 */
  }

  // 1c: pendingSkillId (?skill= handoff)

  // Handoff from the global search page / homepage AI widget
  // (/ai/agent?search=<query> or ?message=<text>): 1a only stashes the raw
  // intent on the store — the Vue2 blueprint's send-immediately behaviour
  // (Agent.vue:166-192, including the locale-aware "Search my NAS for…"
  // wrapper) is 1b's job once streaming send exists. The one-shot
  // router.replace guard is ported verbatim so a page refresh doesn't
  // re-populate pendingPrompt from a stale query string. search wins over
  // message when both are present (message is skipped entirely, matching
  // Vue2's `seedMessage && !seedQuery` guard).
  const seedQuery = (route.query.search || '').toString().trim()
  if (seedQuery) {
    store.pendingPrompt = seedQuery
    const cleanQuery = { ...route.query }
    delete cleanQuery.search
    router.replace({ path: '/ai/agent', query: cleanQuery }).catch(() => {})
  }
  const seedMessage = (route.query.message || '').toString().trim()
  if (seedMessage && !seedQuery) {
    store.pendingPrompt = seedMessage
    const cleanQuery = { ...route.query }
    delete cleanQuery.message
    router.replace({ path: '/ai/agent', query: cleanQuery }).catch(() => {})
  }
})
</script>

<template>
  <div
    class="agent-app"
    :data-theme="store.theme"
    :data-leftcollapsed="store.leftCollapsed"
    :data-rightcollapsed="true"
  >
    <AgentSidebar
      :sessions="store.sessions"
      :active-id="store.activeSessionId"
      :collapsed="store.leftCollapsed"
      @new="store.createSession"
      @select="store.selectSession"
      @delete="store.deleteSession"
      @open-settings="onOpenSettings"
    />
    <main class="main">
      <AgentTopbar
        :session-id="String(store.activeSessionId ?? '')"
        :stored-title="currentSessionTitle"
        :theme="store.theme"
        @toggle-left="store.toggleLeft"
        @toggle-theme="store.toggleTheme"
        @update-title="onUpdateTitle"
      />
      <EmptyState v-if="store.messages.length === 0" />
      <MessageList v-else :messages="messagesForList" :busy="store.busy" />
      <!-- 1b/1c: composer -->
    </main>
    <!-- 1c: right panel -->
  </div>
</template>
