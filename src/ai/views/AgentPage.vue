<!--
  1:1 移植自 Vue2 src/views/AI/Agent/Agent.vue(242 行),1a 裁剪版:
  去 AgentComposer(1b 无输入框 UI —— 本期唯一发送入口是 Task 11 的
  ?search=/?message= 自动发送 + EmptyState 建议卡)、
  AgentRightPanel(1c),以及 systemMetrics/disks 的装载段(1c)。

  SP8-P1c1 Task 12 —— AgentComposer 已挂载(Vue2 Agent.vue:38-42 挂载契约,
  1:1):props busy/ctx-usage,emits send/stop/send-init 直连 store 同名 action。
  ctxUsage 状态 + refreshContextUsage() 移植自 Vue2 Agent.vue:99/198-207,
  三个刷新触发点(mounted 一次、activeSessionId 变化一次、busy true→false 下降
  沿一次)移植自 Vue2 120-132(**不**移植同一会话 watcher 里的
  loadSessionThinking/updateThinkingForModel,也**不**移植 lastFallbackNotice
  toast watcher——两者都属于 ThinkingBar/ModelPicker,留给 1c-2)。
  ModelPicker、ThinkingBar 仍留 1c-2 后续任务。

  SP8-P1c2 Task 2 —— data-rightcollapsed 解开硬编码,改绑 store.rightCollapsed
  (Vue2 Agent.vue:4 逐字对齐);AgentTopbar 新增 right-collapsed prop +
  toggle-right emit → store.toggleRight(Vue2 Agent.vue:20/24)。右栏 shell 本身
  (AgentRightPanel)仍未挂载,留给后续任务——本任务只解开容器状态 + 顶栏开关。

  主题持久化已下沉到 store.toggleTheme(Task 2 里直接 localStorage.setItem),
  这里不再像 Vue2 Agent.vue:117-119 那样额外 watch store.theme 落盘。
-->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useAgentStore } from '../stores/agentStore'
import { provideAgentStore } from '../composables/useProvidedAgentStore'
import { useToast } from '../../stores/toast'
import AgentSidebar from '../components/shell/AgentSidebar.vue'
import AgentTopbar from '../components/shell/AgentTopbar.vue'
import AgentComposer from '../components/shell/AgentComposer.vue'
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

// Agent.vue:99 ctxUsage state, populated by refreshContextUsage() below.
const ctxUsage = ref<{ tokens: number; window: number; pct: number } | null>(null)

// Vue2 缺陷修复(项目 2026-07-27 移植纪律:逻辑跟正确性,不跟字面 1:1)—— Agent.vue
// 198-207 的 refreshContextUsage 没有 in-flight/顺序守卫:一次快速切会话可能触发
// 两次重叠请求,若旧请求晚落地,会用上一个会话的用量覆盖当前会话的 ctxUsage。这里
// 加一个自增序号,只有仍是"最新一次调用"的结果才写回 ctxUsage,过期结果直接丢弃 ——
// 不改变三个触发点各自的调用次数/时机语义,修复面仅限"谁能写回"。
let ctxUsageSeq = 0

/**
 * Agent.vue:198-207 —— 无会话早退;传**原始 model key**(如 'local:llama3'),
 * 不是裸模型名;失败置 null。
 */
async function refreshContextUsage() {
  // Final-review fix (2026-07-27, 项目移植纪律:逻辑跟正确性,Vue2 Agent.vue
  // 198-207 在这个早退分支上完全没有守卫,不是"跟 Vue2 不一样"而是补一个 Vue2
  // 从没做过的守卫):no-session 早退必须一样地(a) 递增 ctxUsageSeq,使一个
  // "刚被删掉的会话"仍在途的请求落地时,因 seq 已过期而被 catch/then 里的
  // `seq === ctxUsageSeq` 检查丢弃,不会覆盖当前(空)状态;(b) 清空 ctxUsage,
  // 否则环形进度条会继续显示已经不存在的会话的旧 token 数。
  if (!store.activeSessionId) {
    ++ctxUsageSeq
    ctxUsage.value = null
    return
  }
  const seq = ++ctxUsageSeq
  try {
    const usage = (await service.ai.getContextUsage(
      store.activeSessionId,
      store.selectedModel as string,
    )) as { tokens: number; window: number; pct: number }
    if (seq === ctxUsageSeq) ctxUsage.value = usage
  } catch {
    if (seq === ctxUsageSeq) ctxUsage.value = null
  }
}

// Agent.vue:120-126 会话 watcher —— 本任务只接 ctxUsage。**不移植**同一个 watcher
// 里的 loadSessionThinking/updateThinkingForModel(那两条属于 ThinkingBar,留给 1c-2,
// 提前塞会是死代码)。
watch(
  () => store.activeSessionId,
  () => refreshContextUsage(),
)
// Agent.vue:127-132 —— 只在 busy true→false 下降沿刷新(一轮结束之后);没有针对
// selectedModel 的 watcher,与 Vue2 一致(切模型不会自动重拉用量)。
watch(
  () => store.busy,
  (v, old) => {
    if (old === true && v === false) refreshContextUsage()
  },
)

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
  // Agent.vue:154 —— models 加载完之后拉一次 ctxUsage(mounted 触发,三个触发点之一)。
  refreshContextUsage()

  // Vue2 Agent.vue:145-148 —— ?skill= 挂号:只暂存,消费点在 send()(agentStore.ts
  // send() 的 X-Skill-Id 组装段),这里不发送。
  const skill = route.query.skill
  if (skill) store.pendingSkillId = String(skill)

  // Handoff from the global search page / homepage AI widget
  // (/ai/agent?search=<query> or ?message=<text>) — Vue2 Agent.vue:166-192.
  // search wins over message when both are present (message is skipped
  // entirely). One-shot: router.replace strips both query keys BEFORE
  // sending so a page refresh doesn't re-send the seed turn.
  const seedSearch = (route.query.search ?? '').toString().trim()
  const seedMessage = (route.query.message ?? '').toString().trim()
  if (seedSearch || seedMessage) {
    const clean = { ...route.query }
    delete clean.search
    delete clean.message
    await router.replace({ path: '/ai/agent', query: clean })
    try {
      if (seedSearch) {
        await store.createSession() // always fresh
        await store.send(t('ai.searchMyNas', { query: seedSearch }))
      } else {
        if (!store.activeSessionId) await store.createSession() // reuse if present
        await store.send(seedMessage) // raw verbatim
      }
    } catch {
      /* onError already surfaced a block */
    }
  }
})
</script>

<template>
  <div
    class="agent-app"
    :data-theme="store.theme"
    :data-leftcollapsed="store.leftCollapsed"
    :data-rightcollapsed="store.rightCollapsed"
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
        :right-collapsed="store.rightCollapsed"
        @toggle-left="store.toggleLeft"
        @toggle-theme="store.toggleTheme"
        @toggle-right="store.toggleRight"
        @update-title="onUpdateTitle"
      />
      <EmptyState v-if="store.messages.length === 0" />
      <MessageList v-else :messages="messagesForList" :busy="store.busy" />
      <!--
        Agent.vue:38-42 挂载契约 —— 1:1(props/emits 名与语义)。emit 处理器写成
        内联箭头函数、而不是像 Vue2 那样直接 `@send="store.actions.send"` 裸引用
        方法 —— Vue3 里裸方法引用会在渲染时把 `store.send` 这个函数值本身固化进
        vnode 的 onSend prop;此后若外部整体替换了 `store.send`(如测试用
        `vi.spyOn(store, 'send')`,底层走 `Object.defineProperty`,不经过 Vue
        reactive 的 set 陷阱,不会触发 AgentPage 重渲染),裸引用不会跟着变,仍会
        调到替换前的旧函数。内联箭头在**调用时**才去读 `store.send`,读到的是
        当前值,行为才和"调用方法当前实现"一致。
      -->
      <AgentComposer
        :busy="store.busy"
        :ctx-usage="ctxUsage"
        @send="(payload) => store.send(payload)"
        @stop="() => store.stop()"
        @send-init="(target) => store.sendInit(target)"
      />
    </main>
    <!-- 1c: right panel -->
  </div>
</template>
