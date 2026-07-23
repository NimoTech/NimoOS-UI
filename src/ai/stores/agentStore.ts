import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { migrateLegacyMessages } from '../services/streamMappers'
import type { AgentBlock, AgentStats, AttachmentRef } from '../types'

// AI Agent 主题偏好持久化 key —— 与 Vue2 blueprint(Agent.vue:80,90-96,117-119)逐字对齐。
const THEME_KEY = 'nimoos.ai.agent.theme'

export type AgentTheme = 'light' | 'dark'

/** 会话条目。字段随后端演进(id 归一化见 createSession),这里只声明当前用到的部分。 */
export interface AgentSession {
  id: string | number
  title?: string | null
  [key: string]: unknown
}

/** 1a 阶段消息按 RAW 装载(migrateLegacyMessages 留给 1b 的 streaming 切片接手)。 */
export type AgentMessage = Record<string, unknown>

/**
 * SP8-P1a Task 2 —— AI Agent 会话/历史/主题切片(Pinia 工厂)。
 *
 * 工厂形态是硬约束:Photos 区后续要实例化一个受限 profile 的 agent
 * (`useAgentStore('photos')`),每个 agentType 各自拥有一份独立 store
 * (Pinia 按 `ai-agent-${agentType}` 这个 id 去重,同类型第二次调用拿回同一实例)。
 *
 * 数据取数口径(与 Vue2 src/views/AI/Agent/store/agentStore.js 对齐):
 * Vue2 里 `ai.xxx()` 返回的是 axios 原始响应(`resp`),`resp.data` 才是 HTTP body;
 * 而 `@nimotech/nimoos-service` 的 `service.ai.*` 已经在包内做过这一层 axios 解包,
 * 直接把 `resp.data`(body)吐给调用方——即本文件里的每个 `body` 变量,已经等价于
 * Vue2 代码里的局部变量 `resp.data`。blueprint 里这几个 action 全部只做**单层**取数
 * (`(resp && resp.data) || resp || fallback`,即 `resp.data` 本身就是数组/对象,没有
 * Go `Result{Data}` 信封二次拆包——这几个端点是 Python agent 子服务直出的裸 JSON),
 * 所以本文件里对应地写成 `body || fallback`,不再多一层 `.data`。
 */
export function useAgentStore(agentType?: string) {
  const storeId = `ai-agent-${agentType ?? 'general'}`

  return defineStore(storeId, () => {
    const sessions = ref<AgentSession[]>([])
    const activeSessionId = ref<string | number | null>(null)
    const messages = ref<AgentMessage[]>([])
    // 1a 阶段恒 false——streaming(send/attach)是 1b 的事,这里没有任何路径会翻它。
    const busy = ref(false)
    const theme = ref<AgentTheme>('light')
    const leftCollapsed = ref(false)
    // 1a 阶段恒 true——右侧面板(活动日志/资源等)要到 streaming 落地才有内容可看。
    const rightCollapsed = ref(true)
    const pendingPrompt = ref<string | null>(null)
    // Streaming-primitive state (SP8-P1b Task 4) — verbatim port target of
    // Vue2 store/agentStore.js:34,39-40. abortController/pendingCancel are
    // typed loose (any) here: their concrete shapes (AbortController /
    // cancel-confirmation payload) belong to the transport layer (Task 6/8).
    const abortController = ref<unknown>(null)
    const activitySteps = ref<Record<string, unknown>[]>([])
    const pendingCancel = ref<unknown>(null)

    /** agentStore.js:160-164 —— 装载会话列表,body 非数组时兜底空数组。 */
    async function loadSessions() {
      const body = await service.ai.listAgentSessions()
      sessions.value = Array.isArray(body) ? (body as AgentSession[]) : []
    }

    /**
     * agentStore.js:166-183 —— 新建会话。
     * id 归一化必须保留:Python agent 建会话时返回 `{ session_id, ... }`,
     * 而列表接口返回的会话形态是 `{ id, ... }`——统一收敛到 `id` 字段,
     * 后续 store/UI 只认一种形状。受限 profile(如 Photos)在这里带上
     * `agent_type`;默认 store 不传 body,落在 'general' profile 上。
     */
    async function createSession() {
      const body = await service.ai.createAgentSession(
        agentType ? { agent_type: agentType } : undefined,
      )
      const data = (body || {}) as Record<string, unknown>
      const session: AgentSession = {
        ...data,
        id: (data.session_id || data.id) as string | number,
        title: (data.title as string | null | undefined) || null,
      }
      sessions.value.unshift(session)
      activeSessionId.value = session.id
      messages.value = []
    }

    /** agentStore.js:185-192 —— 删除会话;只有删的是当前会话才清 activeSessionId + messages。 */
    async function deleteSession(id: string | number) {
      await service.ai.deleteAgentSession(id)
      sessions.value = sessions.value.filter((s) => s.id !== id)
      if (activeSessionId.value === id) {
        activeSessionId.value = null
        messages.value = []
      }
    }

    /** agentStore.js:194-208 —— 乐观更新标题,API 失败回滚到旧值。 */
    async function setSessionTitle(id: string | number, title: string) {
      const trimmed = (title || '').trim()
      if (!trimmed) return
      const idx = sessions.value.findIndex((s) => s.id === id)
      if (idx < 0) return
      const prev = sessions.value[idx].title
      sessions.value[idx].title = trimmed
      try {
        await service.ai.updateAgentSessionTitle(id, trimmed)
      } catch (e) {
        sessions.value[idx].title = prev
        // eslint-disable-next-line no-console
        console.warn('[agentStore] updateAgentSessionTitle failed', e)
      }
    }

    /**
     * agentStore.js:246-293 —— 只搬装载消息这一段:切 activeSessionId + 拉消息列表。
     * abort/attach/资源/附件/staged 全部不搬(streaming transport 是 Task 5/6 的事)。
     * legacy 消息迁移 `migrateLegacyMessages`(Task 3)在此接入——历史消息装载后
     * 立刻跑一遍旧 block 形态迁移(run_command→terminal 等),再赋值给 messages。
     */
    async function selectSession(id: string | number) {
      activeSessionId.value = id
      const body = await service.ai.listAgentMessages(id)
      const raw = Array.isArray(body) ? (body as AgentMessage[]) : []
      messages.value = migrateLegacyMessages(raw as any) as unknown as AgentMessage[]
    }

    /** Agent.vue:80,90-96 —— localStorage > matchMedia(prefers-color-scheme: dark) > 'light'。 */
    function initTheme() {
      const stored = localStorage.getItem(THEME_KEY)
      if (stored === 'light' || stored === 'dark') {
        theme.value = stored
        return
      }
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        theme.value = 'dark'
        return
      }
      theme.value = 'light'
    }

    /** agentStore.js:152-154 + Agent.vue:117-119 —— 翻转并写回同一 localStorage key。 */
    function toggleTheme() {
      theme.value = theme.value === 'light' ? 'dark' : 'light'
      localStorage.setItem(THEME_KEY, theme.value)
    }

    /** agentStore.js:156 —— 翻转左侧会话列表折叠态。 */
    function toggleLeft() {
      leftCollapsed.value = !leftCollapsed.value
    }

    // ---- Streaming primitives (SP8-P1b Task 4) ----
    // Verbatim port of Vue2 store/agentStore.js:64-150. Vue2-isms converted:
    // Vue.observable → the refs above; Vue.set/delete → direct assign (not
    // needed here — no delete-key semantics in these 9); splice(i,1,next)
    // kept as-is (still the correct array-replacement idiom in Vue3/Pinia).

    /** agentStore.js:64-71 —— 压入一条 user 消息。 */
    function pushUserMessage(text: string, attachmentRefs: AttachmentRef[] = []) {
      messages.value.push({
        id: `u${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'user',
        content: text,
        attachments: attachmentRefs, // [{ id, filename, kind, mime, url }]
      })
    }

    /** agentStore.js:73-80 —— 起一条空 assistant 消息,进入 streaming。 */
    function startAssistant() {
      messages.value.push({
        id: `a${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'assistant',
        blocks: [],
        streaming: true,
      })
    }

    /** agentStore.js:82-86 —— 往最后一条 assistant 消息追加一个 block。 */
    function appendBlock(block: AgentBlock) {
      const last = messages.value[messages.value.length - 1] as Record<string, unknown> | undefined
      if (!last || last.role !== 'assistant') return
      ;(last.blocks as AgentBlock[]).push(block)
    }

    /**
     * agentStore.js:88-104 —— 反向查找最后一条 assistant 消息里第一个匹配
     * predicate 的 block,合并 patch 后用 splice(i,1,next) 整体替换。
     * 命中返回 true,否则 false。
     */
    function patchBlock(
      predicate: (b: AgentBlock) => boolean,
      patch: Partial<AgentBlock> | ((old: AgentBlock) => Partial<AgentBlock>),
    ): boolean {
      const last = messages.value[messages.value.length - 1] as Record<string, unknown> | undefined
      const blocks = last && (last.blocks as AgentBlock[] | undefined)
      if (!last || !blocks) return false
      for (let i = blocks.length - 1; i >= 0; i--) {
        if (predicate(blocks[i])) {
          const old = blocks[i]
          const next = typeof patch === 'function'
            ? { ...old, ...patch(old) }
            : { ...old, ...patch }
          blocks.splice(i, 1, next)
          return true
        }
      }
      return false
    }

    /** agentStore.js:106-113 —— 结束 streaming:最后一条 assistant 消息 streaming=false,busy=false。 */
    function setStreamingDone() {
      const idx = messages.value.length - 1
      const last = messages.value[idx] as Record<string, unknown> | undefined
      if (last && last.role === 'assistant') {
        messages.value.splice(idx, 1, { ...last, streaming: false })
      }
      busy.value = false
    }

    /** agentStore.js:115 —— 直接置 busy。 */
    function setBusy(value: boolean) {
      busy.value = !!value
    }

    /** agentStore.js:117-125 —— 把 partial 合并进最后一条 assistant 消息的 stats。 */
    function patchAssistantStats(partial: Partial<AgentStats>) {
      const idx = messages.value.length - 1
      const last = messages.value[idx] as Record<string, unknown> | undefined
      if (!last || last.role !== 'assistant') return
      messages.value.splice(idx, 1, {
        ...last,
        stats: { ...((last.stats as AgentStats | undefined) || {}), ...partial },
      })
    }

    /** agentStore.js:127-134 —— 压入一条 running 状态的活动步骤。 */
    function pushActivityStep({ name }: { name: string }) {
      activitySteps.value.push({
        id: `s${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        state: 'running',
        startedAt: Date.now(),
      })
    }

    /** agentStore.js:136-150 —— 反向找到最后一个 running 步骤,标记为 success 并记时长。无 running 步骤时静默(仅 debug log)。 */
    function markRunningStepDone() {
      for (let i = activitySteps.value.length - 1; i >= 0; i--) {
        const step = activitySteps.value[i]
        if (step.state === 'running') {
          activitySteps.value.splice(i, 1, {
            ...step,
            state: 'success',
            durationMs: Date.now() - (step.startedAt as number),
          })
          return
        }
      }
      // eslint-disable-next-line no-console
      console.debug('[agentStore] markRunningStepDone: no running step to mark')
    }

    return {
      sessions,
      activeSessionId,
      messages,
      busy,
      theme,
      leftCollapsed,
      rightCollapsed,
      pendingPrompt,
      abortController,
      activitySteps,
      pendingCancel,
      loadSessions,
      createSession,
      deleteSession,
      setSessionTitle,
      selectSession,
      initTheme,
      toggleTheme,
      toggleLeft,
      pushUserMessage,
      startAssistant,
      appendBlock,
      patchBlock,
      setStreamingDone,
      setBusy,
      patchAssistantStats,
      pushActivityStep,
      markRunningStepDone,
    }
  })()
}
