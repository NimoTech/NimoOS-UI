import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { migrateLegacyMessages } from '../services/streamMappers'
import { runAgentRun, attachAgentStream } from '../services/agentTransport'
import { i18n } from '../../i18n'
import type { AgentBlock, AgentStats, AttachmentRef, StreamActions } from '../types'

// AI Agent 主题偏好持久化 key —— 与 Vue2 blueprint(Agent.vue:80,90-96,117-119)逐字对齐。
const THEME_KEY = 'nimoos.ai.agent.theme'
// agentStore.js:626,638,650 —— 已选模型持久化 key(逐字对齐)。
const MODEL_KEY = 'nimoos.ai.agent.selectedModel'

/** agentStore.js 里的模型选择器条目(local/cloud 归一化)。 */
export interface AgentModel {
  key: string
  source: 'local' | 'cloud'
  displayName: string
  size?: number
  supports_thinking?: boolean
  provider_type?: string
  providerName?: string
  providerId?: string | number
}

/** agentStore.js:34,46-52 —— thinking 强度状态(无 ThinkingBar UI,只留状态)。 */
export interface ThinkingState {
  enabled: boolean
  level: string
  supportsThinking: boolean
  providerType: string
  defaults: { enabled: boolean; level: string }
}

/** agentStore.js:54 —— 会话已授权的可见资源。stream 注入的条目没有 id(见 dispatchEvent 'visible_resource_added')。 */
export interface VisibleResource { id?: string | number; path: string; kind: string; has_agent_md?: boolean; [k: string]: unknown }
/** agentStore.js:56 —— staged 项;loose 项(无 batch_id/staged_id)不可单项回滚。 */
export interface StagedItem { seq: number; staged_id?: string | number; batch_id?: string | number | null; op: string; path: string; dst_path?: string | null; size_bytes?: number; snapshot_missing?: boolean; [k: string]: unknown }
export interface StagedGroup { run_id: string | number; created_at: number; items: StagedItem[]; [k: string]: unknown }

/** send() 接受的 payload 形态 —— agentStore.js:295-301。 */
export interface SendPayload {
  text: string
  attachmentIds?: string[]
  attachmentRefs?: AttachmentRef[]
  contextPhoto?: unknown
  contextAlbum?: unknown
}

/**
 * agentStore.js:8-26 —— 把 enabled provider 下 favorite 的模型拍平成选择器条目。
 * 导出供单测直接验证(与 Vue2 对齐,便于独立测试这段纯函数)。
 */
export function buildCloudModelList(providers: unknown): AgentModel[] {
  const out: AgentModel[] = []
  for (const p of (Array.isArray(providers) ? providers : []) as Record<string, unknown>[]) {
    if (!p.enabled) continue
    const models = Array.isArray(p.models) ? (p.models as Record<string, unknown>[]) : []
    for (const m of models) {
      if (!m.favorite) continue
      out.push({
        key: `cloud:${p.id}:${m.name}`,
        source: 'cloud',
        displayName: String(m.name),
        providerName: p.name as string | undefined,
        providerId: p.id as string | number,
        supports_thinking: !!m.supports_thinking,
        provider_type: (p.provider_type as string) || '',
      })
    }
  }
  return out
}

/** agentStore.js:337-348 —— 把 selectedModel key 拆成 { source, modelName }。 */
function parseModelKey(key: string): { source: string; modelName: string } {
  const idx = key.indexOf(':')
  const source = key.slice(0, idx)
  const rest = key.slice(idx + 1)
  if (source === 'local') return { source, modelName: rest }
  const idx2 = rest.indexOf(':')
  return { source, modelName: idx2 >= 0 ? rest.slice(idx2 + 1) : rest }
}

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
    // Streaming-primitive state (SP8-P1b Task 4/7) — verbatim port target of
    // Vue2 store/agentStore.js:34,39-40. Narrowed now that the transport
    // layer (Task 6) and send/stop/continueRun (Task 7) are wired: the abort
    // controller is a real AbortController, pendingCancel is the in-flight
    // ai.cancelAgentRun() promise (or null when no cancel is pending).
    const abortController = ref<AbortController | null>(null)
    const activitySteps = ref<Record<string, unknown>[]>([])
    const pendingCancel = ref<Promise<unknown> | null>(null)

    // ---- Model bootstrap (SP8-P1b Task 7) — agentStore.js:43-52,599-698 ----
    const availableModels = ref<AgentModel[]>([])
    const selectedModel = ref<string | null>(null)
    const lastFallbackNotice = ref<{ from: string | null; to: string | null } | null>(null)
    const thinking = ref<ThinkingState>({
      enabled: true,
      level: 'medium',
      supportsThinking: false,
      providerType: '',
      defaults: { enabled: true, level: 'medium' },
    })
    // agentStore.js:60 —— 待consume一次的技能挂号(X-Skill-Id),1c(?skill=)接入前先留位。
    const pendingSkillId = ref<string | null>(null)

    // ── 1c:资源 / 附件 / 暂存区(agentStore.js:54-59)──
    const visibleResources = ref<VisibleResource[]>([])
    const attachments = ref<Record<string, unknown>[]>([])
    const stagedChanges = ref<StagedGroup[]>([])
    const committing = ref(false)
    /** 三种键命名空间共用一张表:raw run_id / raw batch_id / 'item:'+staged_id(agentStore.js:59)。 */
    const reverting = ref<Record<string, boolean>>({})

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
     * agentStore.js:246-293 —— 切 activeSessionId + 拉消息列表 + attach 尾巴。
     * 三域装载已在此完成(1c-1):资源/附件/暂存区。
     * legacy 消息迁移 `migrateLegacyMessages`
     * (Task 3)在此接入——历史消息装载后立刻跑一遍旧 block 形态迁移
     * (run_command→terminal 等),再赋值给 messages。
     *
     * attach 尾巴与 Vue2 有意的一处偏差:Vue2 里 attachAgentStream(...).then(...) 是
     * fire-and-forget(不 await),这里改成 `await` —— 让 selectSession() 在 attach
     * 结果落定后才 resolve,行为更好测试/推理,busy 语义不变(命中运行中的流→保持
     * busy 到 dispatchEvent 看到 done;未命中→立刻清 busy)。
     */
    async function selectSession(id: string | number) {
      // 切会话前先掐掉上一个会话的在途流,防止其事件混进新会话。
      if (abortController.value) {
        abortController.value.abort()
        abortController.value = null
      }
      activeSessionId.value = id
      const body = await service.ai.listAgentMessages(id)
      const raw = Array.isArray(body) ? (body as AgentMessage[]) : []
      messages.value = migrateLegacyMessages(raw as any) as unknown as AgentMessage[]

      // agentStore.js:259-265 —— 并发装载,单个失败不阻断整条切换。
      await Promise.allSettled([loadVisibleResources(), loadAttachments(), loadStagedChanges()])

      // 乐观置 busy,直到 attach 回报为止。send() 会在 busy 上守卫,防止
      // "刚切换会话就手快发送" 和一次 replay 的 user_message 事件赛跑,
      // 造成重复的 user 轮次。
      const ctl = new AbortController()
      abortController.value = ctl
      busy.value = true
      const { attached, error } = await attachAgentStream(id, ctl.signal, createStreamActions())
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[agentStore] attachAgentStream error', error)
      }
      // 竞态守卫:mid-await 期间若又发生了一次 selectSession(会替换掉
      // abortController),就不要再动 busy/abortController——那是新调用的事。
      if (abortController.value === ctl) {
        abortController.value = null
        // 未命中(204/非 ok)→ 清 busy。命中且带 replay 的话,dispatchEvent
        // 早已看到 'done' 并调过 setStreamingDone();若命中但流仍在跑(还没
        // done),继续保持 busy。
        if (!attached) busy.value = false
      }
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

    /**
     * agentStore.js:702-720 —— 流式 staged 项入组。按 run_id 归组(不存在则新建,
     * created_at 用**秒**浮点以对齐服务端 unix 秒);组内按 (seq, path) 对去重,
     * 命中则就地替换保位置。无上限、不排序、新组追加在末尾。
     */
    function appendStagedChange(item: Record<string, unknown>) {
      const runId = item.run_id as string | number
      let group = stagedChanges.value.find((g) => g.run_id === runId)
      if (!group) {
        group = { run_id: runId, created_at: Date.now() / 1000, items: [] }
        stagedChanges.value.push(group)
      }
      const existingIdx = group.items.findIndex((x) => x.seq === item.seq && x.path === item.path)
      if (existingIdx >= 0) group.items.splice(existingIdx, 1, item as unknown as StagedItem)
      else group.items.push(item as unknown as StagedItem)
    }

    /** agentStore.js:722-726 —— 仅按 path 去重(不看 id),浅拷贝入列。 */
    function appendVisibleResource(vr: { id?: string | number; path: string; kind: string }) {
      if (!visibleResources.value.some((r) => r.path === vr.path)) visibleResources.value.push({ ...vr })
    }

    /** agentStore.js:728-732 —— 按 path 整表过滤。 */
    function removeVisibleResourceFromList(path: string) {
      visibleResources.value = visibleResources.value.filter((r) => r.path !== path)
    }

    // ── 1c:可见资源(agentStore.js:734-758)──

    /** 无会话直接清空、不发请求;有会话则整表覆盖。**不 try/catch** —— 由 selectSession 的 allSettled 兜。 */
    async function loadVisibleResources() {
      if (!activeSessionId.value) { visibleResources.value = []; return }
      const body = await service.ai.listVisibleResources(activeSessionId.value)
      visibleResources.value = (body as VisibleResource[]) || []
    }

    /**
     * agentStore.js:743-752 —— 无会话先懒建会话;服务端返回值优先、参数兜底。
     * **错误必须原样冒泡**:composer 靠 e.response.status===409 + detail 里的
     * "gitignore" 判定要不要 force 重试。
     */
    async function addVisibleResource(path: string, kind = 'folder', force = false) {
      if (!activeSessionId.value) await createSession()
      const body = await service.ai.addVisibleResource(activeSessionId.value as string | number, path, kind, force)
      const data = (body || {}) as { id?: string | number; path?: string; kind?: string }
      appendVisibleResource({ id: data.id, path: data.path || path, kind: data.kind || kind })
    }

    /** agentStore.js:754-758 —— 先抓本地条目拿 path,成功后按 path 移除(id 未知则不动本地)。 */
    async function removeVisibleResource(resId: string | number) {
      const target = visibleResources.value.find((r) => r.id === resId)
      await service.ai.removeVisibleResource(activeSessionId.value as string | number, resId)
      if (target) removeVisibleResourceFromList(target.path)
    }

    // ── 1c:附件(agentStore.js:760-777)──

    /** 与 Vue2 一致:**吞错并清空**(不同于 loadVisibleResources 会抛)。 */
    async function loadAttachments() {
      if (!activeSessionId.value) { attachments.value = []; return }
      try {
        const body = await service.ai.listAttachments(activeSessionId.value)
        attachments.value = (body as Record<string, unknown>[]) || []
      } catch { attachments.value = [] }
    }

    /** agentStore.js:773-777 —— 抛错时本地列表不动。 */
    async function removeAttachment(aid: string | number) {
      if (!activeSessionId.value) return
      await service.ai.deleteAttachment(activeSessionId.value, aid)
      attachments.value = attachments.value.filter((a) => a.id !== aid)
    }

    // ── 1c:暂存区(agentStore.js:779-847)──

    /** 无会话直接清空、不发请求;有会话则整表覆盖。 */
    async function loadStagedChanges() {
      if (!activeSessionId.value) { stagedChanges.value = []; return }
      const body = await service.ai.listStagedChanges(activeSessionId.value)
      stagedChanges.value = (body as StagedGroup[]) || []
    }

    /** 成功即清空整表;失败保留列表、错误冒泡;committing 一定在 finally 复位。 */
    async function commitStagedAll() {
      if (!activeSessionId.value) return
      committing.value = true
      try {
        await service.ai.commitStagedChanges(activeSessionId.value)
        stagedChanges.value = []
      } finally { committing.value = false }
    }

    /** agentStore.js:799-810 —— 整轮回滚;**不看响应状态**,成功即丢整组。 */
    async function revertStagedRun(runId: string | number) {
      if (!activeSessionId.value) return
      const key = String(runId)
      reverting.value[key] = true
      try {
        await service.ai.revertStagedRun(activeSessionId.value, runId)
        stagedChanges.value = stagedChanges.value.filter((g) => g.run_id !== runId)
      } finally { delete reverting.value[key] }
    }

    /**
     * agentStore.js:812-828 —— 批量回滚。status ∈ ok|partial → 就地剪掉该 batch 的项
     * 并丢掉变空的组;其余(conflict/nothing_to_revert/snapshot_missing)→ 整表重拉。
     */
    async function revertStagedBatch(batchId: string | number) {
      if (!activeSessionId.value) return
      const key = String(batchId)
      reverting.value[key] = true
      try {
        const body = (await service.ai.revertStagedBatch(activeSessionId.value, batchId)) as { status?: string } | null
        const status = (body && body.status) || 'ok'
        if (status === 'ok' || status === 'partial') {
          stagedChanges.value.forEach((g) => { g.items = g.items.filter((it) => it.batch_id !== batchId) })
          stagedChanges.value = stagedChanges.value.filter((g) => g.items.length > 0)
        } else {
          await loadStagedChanges()
        }
      } finally { delete reverting.value[key] }
    }

    /** agentStore.js:830-847 —— 单项回滚:复数端点 + 单元素数组;reverting 键前缀 'item:'。 */
    async function revertStagedItem(stagedId: string | number) {
      if (!activeSessionId.value) return
      const revertKey = 'item:' + stagedId
      reverting.value[revertKey] = true
      try {
        const body = (await service.ai.revertStagedItems(activeSessionId.value, [stagedId])) as { status?: string } | null
        const status = (body && body.status) || 'ok'
        if (status === 'ok' || status === 'partial') {
          stagedChanges.value.forEach((g) => { g.items = g.items.filter((it) => it.staged_id !== stagedId) })
          stagedChanges.value = stagedChanges.value.filter((g) => g.items.length > 0)
        } else {
          await loadStagedChanges()
        }
      } finally { delete reverting.value[revertKey] }
    }

    /**
     * 把这份 store 的流式 primitive 装订成一个 `StreamActions`,喂给
     * Task 6 transport(runAgentRun/attachAgentStream)→ Task 5 reducer
     * (dispatchEvent)。1c 补上 appendStagedChange/appendVisibleResource/
     * removeVisibleResourceFromList —— reducer 里这三个可选链调用不再 no-op。
     * `_lastNimoosSearchQuery` 是 tool_call/tool_result 之间传递 query 文本的
     * 可变载体,每次调用都给一份新的空字符串起点。
     */
    function createStreamActions(): StreamActions {
      return {
        pushUserMessage,
        startAssistant,
        appendBlock,
        patchBlock,
        setStreamingDone,
        setBusy,
        patchAssistantStats,
        pushActivityStep,
        markRunningStepDone,
        _lastNimoosSearchQuery: '',
        appendStagedChange,
        appendVisibleResource,
        removeVisibleResourceFromList,
      }
    }

    /**
     * agentStore.js:599-645 —— 并行拉 local(ollama)模型 + cloud provider 列表,
     * 拍平成统一的选择器条目;之前存在 localStorage 里的选择若仍在新列表中就沿用,
     * 否则本地模型优先兜底(没有本地模型再退 list[0]),兜底发生时记一条
     * lastFallbackNotice 供 1c 的提示 UI 使用。
     */
    async function loadAvailableModels() {
      const [modelsResp, providersResp] = await Promise.allSettled([
        service.ai.listModels(),
        service.ai.listProviders(),
      ])

      const list: AgentModel[] = []

      if (modelsResp.status === 'fulfilled') {
        const body = (modelsResp.value || {}) as Record<string, unknown>
        const arr = Array.isArray(body.data) ? (body.data as Record<string, unknown>[]) : []
        for (const m of arr) {
          list.push({
            key: 'local:' + String(m.name),
            source: 'local',
            displayName: String(m.name),
            size: m.size_bytes as number | undefined,
            supports_thinking: !!m.supports_thinking,
            provider_type: 'ollama',
          })
        }
      }

      if (providersResp.status === 'fulfilled') {
        const body = (providersResp.value || {}) as Record<string, unknown>
        list.push(...buildCloudModelList(body.data))
      }

      availableModels.value = list

      const stored = localStorage.getItem(MODEL_KEY)
      const valid = !!stored && list.some((m) => m.key === stored)

      if (valid) {
        selectedModel.value = stored
        return
      }

      const fallback = list.find((m) => m.source === 'local') || list[0] || null
      const newKey = fallback ? fallback.key : null
      selectedModel.value = newKey
      if (newKey) {
        localStorage.setItem(MODEL_KEY, newKey)
      } else {
        localStorage.removeItem(MODEL_KEY)
      }
      if (stored && stored !== newKey) {
        lastFallbackNotice.value = { from: stored, to: newKey }
      }
    }

    /** agentStore.js:647-652 —— 切换选中模型(必须是列表里已有的 key),持久化 + 刷新 thinking 状态。 */
    function selectModel(key: string) {
      if (!availableModels.value.some((m) => m.key === key)) return
      selectedModel.value = key
      localStorage.setItem(MODEL_KEY, key)
      updateThinkingForModel()
    }

    /** agentStore.js:689-698 —— 按选中模型刷新 thinking.supportsThinking/providerType。 */
    function updateThinkingForModel() {
      const sel = availableModels.value.find((m) => m.key === selectedModel.value)
      if (!sel) {
        thinking.value.supportsThinking = false
        thinking.value.providerType = ''
        return
      }
      thinking.value.supportsThinking = !!sel.supports_thinking
      thinking.value.providerType = sel.provider_type || ''
    }

    /**
     * agentStore.js:210-244(regenerateTitle)裁剪 —— send() 首轮成功后台自动补标题,
     * 不在 1b 暴露的 action 面里(没有 regeneratingTitleFor 这类 UI 状态,那是 1c 的
     * picker/spinner 的事),只留 send() finally 需要的最小行为:标题为空时尝试一次,
     * 失败静默吞掉(background best-effort,不影响本轮发送结果)。
     */
    async function autoTitleFirstTurn(id: string | number) {
      const key = selectedModel.value
      if (!key) return
      const { source, modelName } = parseModelKey(key)
      if (!modelName) return
      const sel = availableModels.value.find((m) => m.key === key)
      const providerType = sel?.provider_type || (source === 'local' ? 'ollama' : 'other')
      try {
        const body = await service.ai.regenerateAgentSessionTitle(id, modelName, providerType)
        const data = (body || {}) as Record<string, unknown>
        if (data.title) {
          const idx = sessions.value.findIndex((s) => s.id === id)
          if (idx >= 0) sessions.value[idx].title = data.title as string
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[agentStore] autoTitleFirstTurn failed', e)
      }
    }

    /**
     * agentStore.js:295-421 —— 发一轮消息。字符串 payload 视为纯文本(向后兼容);
     * busy 守卫防止重复发送;等待上一次 stop() 触发的 pendingCancel 落定,让服务端
     * 每会话锁先释放掉;无选中模型时直接落一个错误 tool block;否则新建
     * AbortController → (无会话则先建)→ push user+assistant 消息 → 解析模型 key
     * (local:<name> / cloud:<id>:<name>)→ 算 providerType → 拼 extraHeaders
     * (X-Skill-Id 消费一次 + X-Agent-Provider-Id)→ 调 Task 6 runAgentRun,onError
     * 落一个 error tool block(dual-shape:RAW error 或 {status,body},统一
     * JSON.stringify 兜底渲染,与 Vue2 一致)→ finally 收尾 busy + 首轮自动补标题。
     */
    async function send(payload: string | SendPayload): Promise<void> {
      const isObj = typeof payload === 'object' && payload !== null
      const text = typeof payload === 'string' ? payload : (isObj ? payload.text : '') || ''
      const attachmentIds = (isObj && payload.attachmentIds) || []
      const attachmentRefs = (isObj && payload.attachmentRefs) || []
      const contextPhoto = (isObj ? payload.contextPhoto : null) ?? null
      const contextAlbum = (isObj ? payload.contextAlbum : null) ?? null

      if (busy.value) return
      // 等待最近一次 stop() 触发的取消完成,让服务端的 per-session 锁先释放,
      // 否则紧接着的 /run 会 409 agent_busy。
      if (pendingCancel.value) {
        try { await pendingCancel.value } catch { /* 已在 stop() 里吞过 */ }
      }
      const wasFirstTurn = messages.value.length === 0
      let errorOccurred = false

      if (!selectedModel.value) {
        startAssistant()
        appendBlock({
          type: 'tool',
          state: 'error',
          name: 'config',
          sections: [{ label: 'NO_MODEL', code: i18n.global.t('aiNoModelsAvailable') }],
        })
        setStreamingDone()
        return
      }

      busy.value = true
      abortController.value = new AbortController()

      try {
        if (!activeSessionId.value) {
          await createSession()
        }

        pushUserMessage(text, attachmentRefs)
        startAssistant()

        const key = selectedModel.value
        const { source, modelName } = parseModelKey(key)
        // 发具体的 provider_type(deepseek/openai/qwen/anthropic/ollama),不发粗粒度
        // "cloud" —— Python agent 靠它套 provider 专属设置(如 DeepSeek 需要
        // parallel_tool_calls=False,防止 asyncio.gather 里兄弟 tool call 被取消时 400)。
        const sel = availableModels.value.find((m) => m.key === key)
        const providerType = sel?.provider_type || (source === 'local' ? 'ollama' : 'other')

        const extraHeaders: Record<string, string> = {}
        if (pendingSkillId.value) {
          extraHeaders['X-Skill-Id'] = pendingSkillId.value
          pendingSkillId.value = null // 消费一次
        }
        if (sel?.source === 'cloud' && sel?.providerId) {
          extraHeaders['X-Agent-Provider-Id'] = String(sel.providerId)
        }

        await runAgentRun(
          activeSessionId.value as string | number,
          {
            message: text,
            model: modelName,
            attachment_ids: attachmentIds,
            context_photo: contextPhoto,
            context_album: contextAlbum,
            thinking: thinking.value.supportsThinking
              ? { enabled: thinking.value.enabled, level: thinking.value.level }
              : null,
          },
          providerType,
          (abortController.value as AbortController).signal,
          createStreamActions(),
          (err: unknown) => {
            // onError 是双形态:非 abort 的 fetch rejection(RAW error)或
            // { status, body }(!ok)。两种形态都统一 JSON.stringify 兜底渲染
            // 到 ERROR 区块——与 Vue2 agentStore.js:381-390 逐字对齐。
            errorOccurred = true
            appendBlock({
              type: 'tool',
              state: 'error',
              name: 'request',
              sections: [{ label: 'ERROR', code: typeof err === 'string' ? err : JSON.stringify(err, null, 2) }],
            })
            setStreamingDone()
          },
          extraHeaders,
        )
        // 刷新附件:刚上传的草稿此刻服务端已带上 message_id,应显示为"已发送"。
        loadAttachments().catch(() => {})
      } catch (e) {
        errorOccurred = true
        const last = messages.value[messages.value.length - 1] as Record<string, unknown> | undefined
        if (!last || last.role !== 'assistant') {
          startAssistant()
        }
        appendBlock({
          type: 'tool',
          state: 'error',
          name: 'request',
          sections: [{ label: 'ERROR', code: typeof e === 'string' ? e : ((e as Error)?.message || JSON.stringify(e)) }],
        })
        setStreamingDone()
      } finally {
        if (busy.value) setStreamingDone()
        const aborted = !!(abortController.value && (abortController.value as AbortController).signal.aborted)
        abortController.value = null
        if (wasFirstTurn && !aborted && !errorOccurred && activeSessionId.value) {
          const sess = sessions.value.find((s) => s.id === activeSessionId.value)
          if (sess && (!sess.title || String(sess.title).trim() === '')) {
            autoTitleFirstTurn(activeSessionId.value)
          }
        }
      }
    }

    /**
     * agentStore.js:423-489 —— `/init` 斜杠命令的执行体:让 agent 为某个目录生成
     * agent.md。与 send() 的关键差异(逐字对齐 Vue2,不是疏漏):
     * 1) user/assistant 两条消息直接 `messages.value.push`,不走
     *    pushUserMessage/startAssistant(user 消息内容固定为 `[/init] <target>`,
     *    不是原始输入文本)。
     * 2) payload 用 `kind: 'init', init_target: target`,**不带 thinking 字段**。
     * 3) finally **不做首轮自动补标题**(Vue2 sendInit 就没有这段)。
     * message 文本是发给后端的英文提示词模板,不是 UI 文案,不 i18n。
     *
     * 一处**有意偏离** Vue2 逐字顺序:Vue2 源码里两条消息是在 `createSession()`
     * *之前* push 的(agentStore.js:426-436 先 push,441 才 `await
     * actions.createSession()`)。但 `createSession()` 会整体覆盖
     * `messages.value = []`(见上方 createSession),这意味着"无会话时调用
     * sendInit"会把刚 push 的两条消息立刻冲掉——这是 Vue2 自身的潜在 bug(send()
     * 就没有这个问题,因为 send() 是先 createSession() 再 push)。这里改成与
     * send() 一致的顺序:先确保会话存在,再 push 两条消息,payload/校验/收尾
     * 逻辑其余部分保持逐字对齐。
     */
    async function sendInit(target: string): Promise<void> {
      const message = `Please generate agent.md for ${target}.`
      busy.value = true
      abortController.value = new AbortController()

      try {
        if (!activeSessionId.value) {
          await createSession()
        }
        messages.value.push({
          id: `u${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: 'user',
          content: `[/init] ${target}`,
        })
        messages.value.push({
          id: `a${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: 'assistant',
          blocks: [],
          streaming: true,
        })
        if (!selectedModel.value) {
          throw new Error('No model selected')
        }
        const key = selectedModel.value
        const { source, modelName } = parseModelKey(key)
        const sel = availableModels.value.find((m) => m.key === key)
        const providerType = sel?.provider_type || (source === 'local' ? 'ollama' : 'other')

        const extraHeaders: Record<string, string> = {}
        if (sel?.source === 'cloud' && sel?.providerId) {
          extraHeaders['X-Agent-Provider-Id'] = String(sel.providerId)
        }

        await runAgentRun(
          activeSessionId.value as string | number,
          { message, model: modelName, kind: 'init', init_target: target },
          providerType,
          (abortController.value as AbortController).signal,
          createStreamActions(),
          (err: unknown) => {
            appendBlock({
              type: 'tool',
              state: 'error',
              name: 'request',
              sections: [{ label: 'ERROR', code: typeof err === 'string' ? err : JSON.stringify(err, null, 2) }],
            })
            setStreamingDone()
          },
          extraHeaders,
        )
      } catch (e) {
        appendBlock({
          type: 'tool',
          state: 'error',
          name: 'request',
          sections: [{ label: 'ERROR', code: typeof e === 'string' ? e : ((e as Error)?.message || JSON.stringify(e)) }],
        })
        setStreamingDone()
      } finally {
        if (busy.value) setStreamingDone()
        abortController.value = null
      }
    }

    /**
     * agentStore.js:491-511 —— 中止当前流。POST /cancel(而非只 abort 请求)有两个理由:
     * 1) 服务端的 agent task 与请求本身是分离的,只 abort fetch 留任务继续跑,还占着
     *    per-session 锁 —— 下一次 send() 会 409 agent_busy。
     * 2) /cancel 会等任务真正终止才响应,给了一个 send() 可以等的同步点。
     * cancel 的 promise 挂在 pendingCancel 上供 send()/continueRun() 等待;UI 自己可以
     * 立刻切回非 busy(setStreamingDone 已经做了)。
     */
    async function stop(): Promise<void> {
      const sid = activeSessionId.value
      if (abortController.value) abortController.value.abort()
      if (sid) {
        pendingCancel.value = service.ai.cancelAgentRun(sid)
          .catch(() => {})
          .finally(() => {
            pendingCancel.value = null
          })
      }
      setStreamingDone()
    }

    /** agentStore.js:513-517 —— 委托给 service 层,confirm_id 缺失时直接抛错。 */
    async function confirmAgentAction(confirmId: string, confirmed: boolean, remember = false): Promise<void> {
      if (!activeSessionId.value) return
      if (!confirmId) throw new Error('confirm_id missing')
      await service.ai.confirmAgentAction(activeSessionId.value, confirmId, confirmed, remember)
    }

    /**
     * agentStore.js:519-597 —— 继续一个因 max_turns 而暂停的 run。busy 守卫 + 等
     * pendingCancel 落定,与 send() 同一套节奏。先把最近一张未继续的 max_turns 卡
     * 标记为 resumed=true(幂等:防止 busy 恢复后或 run-stream 重连回放时被误点
     * 重复触发)。onError 这里只做 console.warn,不落 error tool block —— 与
     * Vue2 continueRun 的错误处理方式一致(比 send() 更轻)。
     */
    async function continueRun(): Promise<void> {
      if (busy.value) return
      if (pendingCancel.value) {
        try { await pendingCancel.value } catch { /* 已吞过 */ }
      }
      if (!activeSessionId.value || !selectedModel.value) return

      for (let i = messages.value.length - 1; i >= 0; i--) {
        const msg = messages.value[i] as Record<string, unknown>
        const blocks = msg?.blocks as Record<string, unknown>[] | undefined
        if (!Array.isArray(blocks)) continue
        let marked = false
        for (let j = blocks.length - 1; j >= 0; j--) {
          const b = blocks[j]
          if (b.type === 'max_turns' && !b.resumed) {
            b.resumed = true
            marked = true
            break
          }
        }
        if (marked) break
      }

      busy.value = true
      abortController.value = new AbortController()
      try {
        startAssistant()

        const key = selectedModel.value
        const { source, modelName } = parseModelKey(key)
        const sel = availableModels.value.find((m) => m.key === key)
        const providerType = sel?.provider_type || (source === 'local' ? 'ollama' : 'other')
        const extraHeaders: Record<string, string> = {}
        if (sel?.source === 'cloud' && sel?.providerId) {
          extraHeaders['X-Agent-Provider-Id'] = String(sel.providerId)
        }

        await runAgentRun(
          activeSessionId.value as string | number,
          {
            continue_run: true,
            model: modelName,
            thinking: thinking.value.supportsThinking
              ? { enabled: thinking.value.enabled, level: thinking.value.level }
              : null,
          },
          providerType,
          (abortController.value as AbortController).signal,
          createStreamActions(),
          (err: unknown) => {
            // eslint-disable-next-line no-console
            console.warn('[agentStore] continueRun error', err)
          },
          extraHeaders,
        )
      } finally {
        if (abortController.value) abortController.value = null
        busy.value = false
      }
    }

    return {
      sessions,
      activeSessionId,
      messages,
      busy,
      theme,
      leftCollapsed,
      rightCollapsed,
      abortController,
      activitySteps,
      pendingCancel,
      availableModels,
      selectedModel,
      lastFallbackNotice,
      thinking,
      pendingSkillId,
      visibleResources,
      attachments,
      stagedChanges,
      committing,
      reverting,
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
      appendStagedChange,
      appendVisibleResource,
      removeVisibleResourceFromList,
      loadVisibleResources,
      addVisibleResource,
      removeVisibleResource,
      loadAttachments,
      removeAttachment,
      loadStagedChanges,
      commitStagedAll,
      revertStagedRun,
      revertStagedBatch,
      revertStagedItem,
      createStreamActions,
      loadAvailableModels,
      selectModel,
      updateThinkingForModel,
      send,
      sendInit,
      stop,
      continueRun,
      confirmAgentAction,
    }
  })()
}
