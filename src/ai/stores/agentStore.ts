import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'

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
     * abort/attach/资源/附件/staged 全部不搬(streaming 是 1b 的事,legacy 消息迁移
     * `migrateLegacyMessages` 也留给 1b——这里消息按 RAW 赋值)。
     */
    async function selectSession(id: string | number) {
      activeSessionId.value = id
      const body = await service.ai.listAgentMessages(id)
      messages.value = Array.isArray(body) ? (body as AgentMessage[]) : []
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

    return {
      sessions,
      activeSessionId,
      messages,
      busy,
      theme,
      leftCollapsed,
      rightCollapsed,
      pendingPrompt,
      loadSessions,
      createSession,
      deleteSession,
      setSessionTitle,
      selectSession,
      initTheme,
      toggleTheme,
      toggleLeft,
    }
  })()
}
