import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { migrateLegacyMessages } from '../services/streamMappers'
import { runAgentRun, attachAgentStream } from '../services/agentTransport'
import { i18n } from '../../i18n'
import { useAiTheme, type AiTheme } from './aiTheme'
import type { AgentBlock, AgentStats, AttachmentRef, StreamActions } from '../types'

// SP8-P2a Task 4 — THEME_KEY and theme state moved to `./aiTheme` (app-level shared,
// Agent page and Settings page share source). See that file's header comment for rationale.
// This file no longer defines it locally.
// agentStore.js:626,638,650 — selected model persistence key (verbatim alignment).
const MODEL_KEY = 'nimoos.ai.agent.selectedModel'

/** Model selector entries from agentStore.js (local/cloud normalized). */
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

/**
 * F2 fix (review) — ThinkingBar/AgentTopbar thinking intensity level closed enum,
 * four literal states. Naturally belongs in this file (ThinkingState lives here),
 * reusable for ThinkingBar.vue/AgentTopbar.vue props types without each inventing their own.
 *
 * `ThinkingState.level` itself is **not** narrowed to this union type: `loadSessionThinking`
 * directly assigns the return value of `service.ai.getSessionThinking()` (in shared package
 * NimoOS-Service/src/ai.ts, the type is bare `string`; external contract — backend may
 * return any historical/future string) to `thinking.value.level`; narrowing the field to
 * `ThinkingLevel` would cause a type error on this assignment, which would then either
 * entail changes to the shared package's return type or require additional runtime validation/
 * fallback, both beyond the scope of these two components. Therefore we only narrow the
 * component-level props type here, and keep the store side as `string`.
 */
export type ThinkingLevel = 'low' | 'medium' | 'high' | 'max'

/** agentStore.js:34,46-52 — thinking intensity state (no ThinkingBar UI, state only). */
export interface ThinkingState {
  enabled: boolean
  level: string
  supportsThinking: boolean
  providerType: string
  defaults: { enabled: boolean; level: string }
}

/** agentStore.js:54 — session's authorized visible resources. Stream-injected entries have no id (see dispatchEvent 'visible_resource_added'). */
export interface VisibleResource { id?: string | number; path: string; kind: string; has_agent_md?: boolean; [k: string]: unknown }
/** agentStore.js:56 — staged items; loose items (no batch_id/staged_id) cannot be reverted singly. */
export interface StagedItem { seq: number; staged_id?: string | number; batch_id?: string | number | null; op: string; path: string; dst_path?: string | null; size_bytes?: number; snapshot_missing?: boolean; [k: string]: unknown }
export interface StagedGroup { run_id: string | number; created_at: number; items: StagedItem[]; [k: string]: unknown }

/** Payload shapes accepted by send() — agentStore.js:295-301. */
export interface SendPayload {
  text: string
  attachmentIds?: string[]
  attachmentRefs?: AttachmentRef[]
  contextPhoto?: unknown
  contextAlbum?: unknown
}

/**
 * agentStore.js:8-26 — flatten favorite models under enabled providers into selector entries.
 * Exported for unit tests to verify directly (aligns with Vue2, enables independent testing
 * of this pure function).
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

/** agentStore.js:337-348 — decompose selectedModel key into { source, modelName }. */
function parseModelKey(key: string): { source: string; modelName: string } {
  const idx = key.indexOf(':')
  const source = key.slice(0, idx)
  const rest = key.slice(idx + 1)
  if (source === 'local') return { source, modelName: rest }
  const idx2 = rest.indexOf(':')
  return { source, modelName: idx2 >= 0 ? rest.slice(idx2 + 1) : rest }
}

/** @deprecated Name kept to avoid disturbing existing imports; the entity is `AiTheme`. */
export type AgentTheme = AiTheme

/** Session entry. Fields evolve with backend (id normalization see createSession); only declares currently-used fields. */
export interface AgentSession {
  id: string | number
  title?: string | null
  [key: string]: unknown
}

/** Phase 1a messages load as RAW (migrateLegacyMessages left for phase 1b streaming slice to handle). */
export type AgentMessage = Record<string, unknown>

/**
 * SP8-P1a Task 2 — AI Agent session/history/theme slice (Pinia factory).
 *
 * Factory form is a hard constraint: the Photos area will later instantiate an agent with
 * a restricted profile (`useAgentStore('photos')`), and each agentType maintains its own
 * independent store (Pinia deduplicates by the `ai-agent-${agentType}` id; a second call
 * of the same type gets back the same instance).
 *
 * Data retrieval baseline (aligns with Vue2 src/views/AI/Agent/store/agentStore.js):
 * In Vue2, `ai.xxx()` returns the raw axios response (`resp`), and `resp.data` is the HTTP body;
 * but `@nimotech/nimoos-service`'s `service.ai.*` already unwraps that axios layer inside the
 * package and hands the caller `resp.data` (body) directly — so each `body` variable in this
 * file is already equivalent to the local variable `resp.data` in Vue2 code. The blueprint
 * actions all do **single-level** data extraction (`(resp && resp.data) || resp || fallback`,
 * i.e., `resp.data` itself is already an array/object with no secondary unwrap of a Go
 * `Result{Data}` envelope — these endpoints are raw JSON straight from the Python agent
 * microservice), so this file correspondingly writes `body || fallback`, no extra `.data` layer.
 */
export function useAgentStore(agentType?: string) {
  const storeId = `ai-agent-${agentType ?? 'general'}`

  return defineStore(storeId, () => {
    const sessions = ref<AgentSession[]>([])
    const activeSessionId = ref<string | number | null>(null)
    const messages = ref<AgentMessage[]>([])
    // Phase 1a always false — streaming (send/attach) is phase 1b's business; no code path here flips it.
    const busy = ref(false)
    // SP8-P2a Task 4(D1) — theme is no longer a private ref of this store, but exposed from
    // the app-level shared store. External signature (store.theme / store.toggleTheme) unchanged,
    // so AgentPage / AgentTopbar / existing test call sites need no changes.
    const aiTheme = useAiTheme()
    const leftCollapsed = ref(false)
    // agentStore.js:37 — defaults to expanded (aligns with Vue2). Phase 1a was hardcoded to true
    // (right panel not yet implemented, collapsed is more straightforward); this period (1c-2)
    // right-column shell is about to mount, reverting to Vue2's default.
    const rightCollapsed = ref(false)
    // agentStore.js:38 — right-column currently active tab; tab selection is not persisted (unlike theme/selectedModel).
    const rightTab = ref<'activity' | 'context' | 'system' | 'resources'>('activity')
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
    // agentStore.js:53 — session being retitled (null|{id,background}). Object, not boolean:
    // the top bar uses `background` to distinguish "auto-supplement title" (don't lock input) from "manual sparkle click" (lock).
    const regeneratingTitleFor = ref<{ id: string | number; background: boolean } | null>(null)
    // agentStore.js:60 — skill registration awaiting single consume (X-Skill-Id); placeholder before 1c (?skill=) integration.
    const pendingSkillId = ref<string | null>(null)

    // ── 1c: resources / attachments / staging area (agentStore.js:54-59) ──
    const visibleResources = ref<VisibleResource[]>([])
    const attachments = ref<Record<string, unknown>[]>([])
    const stagedChanges = ref<StagedGroup[]>([])
    const committing = ref(false)
    /** Three key namespaces share one table: raw run_id / raw batch_id / 'item:'+staged_id (agentStore.js:59). */
    const reverting = ref<Record<string, boolean>>({})

    /** agentStore.js:160-164 — load session list; fallback to empty array if body is not an array. */
    async function loadSessions() {
      const body = await service.ai.listAgentSessions()
      sessions.value = Array.isArray(body) ? (body as AgentSession[]) : []
    }

    /**
     * agentStore.js:166-183 — create session. ID normalization must be preserved: Python agent
     * returns `{ session_id, ... }` when creating a session, but the list endpoint returns
     * sessions as `{ id, ... }` — converge both to the `id` field so store/UI sees one shape.
     * Restricted profiles (e.g., Photos) pass `agent_type` here; default store passes no body,
     * landing on the 'general' profile.
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
      // Vue2 defect fix (project porting discipline 2026-07-27: "visual per Vue2, logic per correctness")
      // — see clearActivitySteps() comment below. This is session-boundary cleanup alongside `messages.value = []`.
      clearActivitySteps()
    }

    /** agentStore.js:185-192 — delete session; only clears activeSessionId + messages if deleting the current session. */
    async function deleteSession(id: string | number) {
      await service.ai.deleteAgentSession(id)
      sessions.value = sessions.value.filter((s) => s.id !== id)
      if (activeSessionId.value === id) {
        activeSessionId.value = null
        messages.value = []
        // Vue2 defect fix, same as createSession — see clearActivitySteps() comment.
        clearActivitySteps()
      }
    }

    /**
     * Vue2 defect fix (project porting discipline 2026-07-27: "visual per Vue2, logic per correctness").
     *
     * In Vue2 `store/agentStore.js`, `activitySteps` is declared at :39, pushed at :128, and
     * patched in-place at :137-140, **never cleared anywhere in the entire file**; switching
     * sessions (:246-293), creating a session (:166-183), or deleting the current session
     * (:185-192) all skip the reset. The consequence is reproducible buggy behavior: activity
     * steps from a previous session linger in the right-column Activity tab — when the user
     * switches to another session, Activity still shows steps from the previous conversation,
     * looking like "the new session is running/has run these things."
     *
     * Here, per "logic per correctness," we clear it at three **session boundaries** and walk
     * the same code path and timing as peer "per-session state" like messages / visibleResources /
     * attachments / stagedChanges, rather than introducing a separate mechanism.
     */
    function clearActivitySteps() {
      activitySteps.value = []
    }

    /** agentStore.js:194-208 — optimistically update title; rollback to old value if API fails. */
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
     * agentStore.js:246-293 — switch activeSessionId + pull message list + attach tail.
     * Three-domain load completed here (1c-1): resources/attachments/staging area.
     * Legacy message migration `migrateLegacyMessages` (Task 3) connects here — after loading
     * historical messages, immediately run a migration pass over old block shapes (run_command→
     * terminal, etc.), then assign to messages.
     *
     * Attach tail intentionally differs from Vue2: in Vue2 attachAgentStream(...).then(...) is
     * fire-and-forget (no await); here it's changed to `await` — lets selectSession() resolve
     * only after attach result settles, making behavior easier to test/reason about. busy
     * semantics unchanged (hits running stream → stay busy until dispatchEvent sees done; miss
     * → immediately clear busy).
     */
    async function selectSession(id: string | number) {
      // Before switching session, abort the previous session's in-flight stream to prevent its events leaking into the new session.
      if (abortController.value) {
        abortController.value.abort()
        abortController.value = null
      }
      activeSessionId.value = id
      // Vue2 defect fix — see clearActivitySteps() comment. Must be before the await, immediately after
      // activeSessionId switch: subsequently, attach's replay events belong to the new session's steps.
      clearActivitySteps()
      const body = await service.ai.listAgentMessages(id)
      const raw = Array.isArray(body) ? (body as AgentMessage[]) : []
      messages.value = migrateLegacyMessages(raw as any) as unknown as AgentMessage[]

      // agentStore.js:259-265 — concurrent loading; individual failure doesn't block the entire switch.
      await Promise.allSettled([loadVisibleResources(), loadAttachments(), loadStagedChanges()])

      // Optimistically set busy until attach reports back. send() guards on busy to prevent
      // "switching session then quick send" from racing with a replay user_message event,
      // which would create duplicate user turns.
      const ctl = new AbortController()
      abortController.value = ctl
      busy.value = true
      const { attached, error } = await attachAgentStream(id, ctl.signal, createStreamActions())
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[agentStore] attachAgentStream error', error)
      }
      // Race guard: if another selectSession happens mid-await (replacing abortController),
      // don't touch busy/abortController — that's the new call's responsibility.
      if (abortController.value === ctl) {
        abortController.value = null
        // Miss (204/not ok) → clear busy. Hit with replay → dispatchEvent already saw 'done' and called
        // setStreamingDone(); if hit but stream still running (no done yet), keep busy.
        if (!attached) busy.value = false
      }
    }

    /**
     * Agent.vue:80,90-96 — localStorage > matchMedia(prefers-color-scheme: dark) > 'light'.
     * SP8-P2a Task 4(D1) — load-logic body moved to `./aiTheme`'s `hydrateTheme()` (Settings page
     * needs the same logic, can't be store-only). This function stays as pure delegation;
     * external call site (`AgentPage.vue`'s `store.initTheme()`) needs no changes.
     */
    function initTheme() {
      aiTheme.hydrateTheme()
    }

    /**
     * agentStore.js:152-154 + Agent.vue:117-119 — toggle and write back to same localStorage key.
     * SP8-P2a Task 4(D1) — toggle-logic body moved to `./aiTheme`'s `toggleTheme()` so
     * Agent page and Settings page toggle the same state.
     */
    function toggleTheme() {
      aiTheme.toggleTheme()
    }

    /** agentStore.js:156 — toggle left session list collapsed state. */
    function toggleLeft() {
      leftCollapsed.value = !leftCollapsed.value
    }

    /** agentStore.js:157 — toggle right panel collapsed state. */
    function toggleRight() {
      rightCollapsed.value = !rightCollapsed.value
    }

    /** agentStore.js:158 — switch right panel's currently active tab. */
    function setRightTab(tab: 'activity' | 'context' | 'system' | 'resources') {
      rightTab.value = tab
    }

    // ---- Streaming primitives (SP8-P1b Task 4) ----
    // Verbatim port of Vue2 store/agentStore.js:64-150. Vue2-isms converted:
    // Vue.observable → the refs above; Vue.set/delete → direct assign (not
    // needed here — no delete-key semantics in these 9); splice(i,1,next)
    // kept as-is (still the correct array-replacement idiom in Vue3/Pinia).

    /** agentStore.js:64-71 — push a user message. */
    function pushUserMessage(text: string, attachmentRefs: AttachmentRef[] = []) {
      messages.value.push({
        id: `u${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'user',
        content: text,
        attachments: attachmentRefs, // [{ id, filename, kind, mime, url }]
      })
    }

    /** agentStore.js:73-80 — start an empty assistant message and enter streaming. */
    function startAssistant() {
      messages.value.push({
        id: `a${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'assistant',
        blocks: [],
        streaming: true,
      })
    }

    /** agentStore.js:82-86 — append a block to the last assistant message. */
    function appendBlock(block: AgentBlock) {
      const last = messages.value[messages.value.length - 1] as Record<string, unknown> | undefined
      if (!last || last.role !== 'assistant') return
      ;(last.blocks as AgentBlock[]).push(block)
    }

    /**
     * agentStore.js:88-104 — reverse-search the last assistant message for the first block
     * matching the predicate, merge the patch, and wholly replace with splice(i,1,next).
     * Returns true on hit, false otherwise.
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

    /** agentStore.js:106-113 — end streaming: last assistant message streaming=false, busy=false. */
    function setStreamingDone() {
      const idx = messages.value.length - 1
      const last = messages.value[idx] as Record<string, unknown> | undefined
      if (last && last.role === 'assistant') {
        messages.value.splice(idx, 1, { ...last, streaming: false })
      }
      busy.value = false
    }

    /** agentStore.js:115 — directly set busy. */
    function setBusy(value: boolean) {
      busy.value = !!value
    }

    /** agentStore.js:117-125 — merge partial into the last assistant message's stats. */
    function patchAssistantStats(partial: Partial<AgentStats>) {
      const idx = messages.value.length - 1
      const last = messages.value[idx] as Record<string, unknown> | undefined
      if (!last || last.role !== 'assistant') return
      messages.value.splice(idx, 1, {
        ...last,
        stats: { ...((last.stats as AgentStats | undefined) || {}), ...partial },
      })
    }

    /** agentStore.js:127-134 — push an activity step with running state. */
    function pushActivityStep({ name }: { name: string }) {
      activitySteps.value.push({
        id: `s${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        state: 'running',
        startedAt: Date.now(),
      })
    }

    /** agentStore.js:136-150 — reverse-find the last running step, mark it success, and record duration. Silent if no running step (debug log only). */
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
     * agentStore.js:702-720 — stream staged items into groups. Group by run_id (create if absent;
     * created_at uses **seconds** as float to align with backend unix seconds); deduplicate within
     * group by (seq, path) pair; on hit, replace in-place. No limit, unsorted, new groups append to end.
     */
    function appendStagedChange(item: Record<string, unknown>) {
      const runId = item.run_id as string | number
      let group = stagedChanges.value.find((g) => g.run_id === runId)
      if (!group) {
        group = { run_id: runId, created_at: Date.now() / 1000, items: [] }
        stagedChanges.value.push(group)
        // P1c2 debt 2 (1c-1 final review, 2026-07-27, verified with a real @vue/reactivity
        // probe — see agentStore.p1c.test.ts "flush:sync watcher needs to sync-see length=1"):
        // `stagedChanges.value.push(group)` above pushes the *raw* object built two lines up.
        // The push itself triggers Vue's reactivity (dependents tracking `stagedChanges`/its
        // length get notified), but the pushed element only becomes a tracked reactive proxy
        // lazily, the first time something reads it back out of the array. Continuing to
        // mutate the local `group` reference below (`group.items.push(...)`) operates on
        // the raw target directly, bypassing the proxy's set trap — no trigger() fires for
        // that mutation. Today this happens to "work" because rendering/most consumers
        // re-read the array on a later microtask anyway, but a `flush: 'sync'` watcher
        // already tracking `items.length` (the kind the staged-changes UI landing later
        // this phase will need, to react to streamed items immediately) would never observe
        // the item being added. Fix: re-read the proxied element back out of the array and
        // mutate *that* reference from here on, so every subsequent write goes through the
        // reactive proxy and notifies its trackers.
        group = stagedChanges.value[stagedChanges.value.length - 1]
      }
      const existingIdx = group.items.findIndex((x) => x.seq === item.seq && x.path === item.path)
      if (existingIdx >= 0) group.items.splice(existingIdx, 1, item as unknown as StagedItem)
      else group.items.push(item as unknown as StagedItem)
    }

    /** agentStore.js:722-726 — deduplicate by path only (ignore id), shallow-copy into list. */
    function appendVisibleResource(vr: { id?: string | number; path: string; kind: string }) {
      if (!visibleResources.value.some((r) => r.path === vr.path)) visibleResources.value.push({ ...vr })
    }

    /** agentStore.js:728-732 — filter entire table by path. */
    function removeVisibleResourceFromList(path: string) {
      visibleResources.value = visibleResources.value.filter((r) => r.path !== path)
    }

    // ── 1c: visible resources (agentStore.js:734-758) ──

    /** No session: clear directly, no request. Has session: overwrite entire table. **No try/catch** — selectSession's allSettled handles it. */
    async function loadVisibleResources() {
      if (!activeSessionId.value) { visibleResources.value = []; return }
      const body = await service.ai.listVisibleResources(activeSessionId.value)
      visibleResources.value = (body as VisibleResource[]) || []
    }

    /**
     * agentStore.js:743-752 — if no session, lazily create one; server return value takes
     * precedence, parameters fallback. **Errors must bubble as-is**: composer relies on
     * e.response.status===409 + "gitignore" in detail to decide whether to force-retry.
     */
    async function addVisibleResource(path: string, kind = 'folder', force = false) {
      if (!activeSessionId.value) await createSession()
      const body = await service.ai.addVisibleResource(activeSessionId.value as string | number, path, kind, force)
      const data = (body || {}) as { id?: string | number; path?: string; kind?: string }
      appendVisibleResource({ id: data.id, path: data.path || path, kind: data.kind || kind })
    }

    /** agentStore.js:754-758 — grab local entry for path first, then remove by path on success (don't touch local if id unknown). */
    async function removeVisibleResource(resId: string | number) {
      const target = visibleResources.value.find((r) => r.id === resId)
      await service.ai.removeVisibleResource(activeSessionId.value as string | number, resId)
      if (target) removeVisibleResourceFromList(target.path)
    }

    /**
     * P1c2 debt 1 — remove chips without id too. Vue2 has no such action: chip stream-injected
     * form `{path, kind}` (dispatchEvent.ts:311's 'visible_resource_added' branch, verbatim
     * with Vue2 `agentStream.js:539-542`) never carries id, so Vue2's removeChip clicking ×
     * directly calls `removeVisibleResource(undefined)`, hitting `/visible-resources/undefined`,
     * and on failure walks existing `catch { toastError(e) }` — "destined to fail but user sees
     * error." This repo's prior port (1c-1) was more conservative: when `id === undefined`,
     * directly return no-op, no request sent — result: user clicks × and gets nothing, not even
     * an error message, worse than Vue2.
     *
     * Correct approach: server list always carries id; only this locally-cached entry (agent
     * added via appendVisibleResource mid-way) may not. First `loadVisibleResources()` to
     * refresh and get the server's authoritative list (with ids), then search by path:
     *   - Found — this resource is indeed still there, server recognizes this path, proceed
     *     with `removeVisibleResource` by id (maintains the existing behavior of "after removal,
     *     clear local by path").
     *   - Not found — server no longer has this (another path may have deleted it first, or
     *     a race), no point sending a delete request for something that doesn't exist; directly
     *     call `removeVisibleResourceFromList(path)` to clear the local entry too, keeping
     *     frontend and backend in sync — not an error, no bubble needed.
     * Failures (only from loadVisibleResources or removeVisibleResource's internal request)
     * bubble as-is to caller — composer side still walks existing toastError, consistent
     * with the "has id" path.
     */
    async function removeVisibleResourceByPath(path: string): Promise<void> {
      await loadVisibleResources()
      const found = visibleResources.value.find((r) => r.path === path)
      if (found && found.id !== undefined) {
        await removeVisibleResource(found.id)
      } else {
        removeVisibleResourceFromList(path)
      }
    }

    // ── 1c: attachments (agentStore.js:760-777) ──

    /** Consistent with Vue2: **swallow error and clear** (unlike loadVisibleResources which throws). */
    async function loadAttachments() {
      if (!activeSessionId.value) { attachments.value = []; return }
      try {
        const body = await service.ai.listAttachments(activeSessionId.value)
        attachments.value = (body as Record<string, unknown>[]) || []
      } catch { attachments.value = [] }
    }

    /** agentStore.js:773-777 — leave local list unchanged on error. */
    async function removeAttachment(aid: string | number) {
      if (!activeSessionId.value) return
      await service.ai.deleteAttachment(activeSessionId.value, aid)
      attachments.value = attachments.value.filter((a) => a.id !== aid)
    }

    // ── 1c: staging area (agentStore.js:779-847) ──

    /** No session: clear directly, no request. Has session: overwrite entire table. */
    async function loadStagedChanges() {
      if (!activeSessionId.value) { stagedChanges.value = []; return }
      const body = await service.ai.listStagedChanges(activeSessionId.value)
      stagedChanges.value = (body as StagedGroup[]) || []
    }

    /** On success, clear entire table; on failure, keep list and bubble error; committing always resets in finally. */
    async function commitStagedAll() {
      if (!activeSessionId.value) return
      committing.value = true
      try {
        await service.ai.commitStagedChanges(activeSessionId.value)
        stagedChanges.value = []
      } finally { committing.value = false }
    }

    /** agentStore.js:799-810 — revert entire run; **ignores response status**, discards entire group on success. */
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
     * agentStore.js:812-828 — batch revert. status ∈ ok|partial → trim batch items in-place
     * and discard empty groups; others (conflict/nothing_to_revert/snapshot_missing) → reload entire table.
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

    /** agentStore.js:830-847 — single-item revert: plural endpoint + single-element array; reverting key prefix 'item:'. */
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
     * Bind this store's streaming primitives into a `StreamActions` object, fed to
     * Task 6 transport (runAgentRun/attachAgentStream) → Task 5 reducer (dispatchEvent).
     * Phase 1c adds appendStagedChange/appendVisibleResource/removeVisibleResourceFromList —
     * these three optional-chain calls in the reducer are no longer no-ops.
     * `_lastNimoosSearchQuery` is a mutable carrier for passing query text between tool_call/
     * tool_result; each call gets a fresh empty-string starting point.
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
     * agentStore.js:599-645 — fetch local (ollama) models + cloud provider list in parallel,
     * flatten to unified selector entries; if previous localStorage selection still exists in
     * new list, reuse it; otherwise fallback to local models first (if no local, fallback to
     * list[0]); when fallback occurs, record in lastFallbackNotice for phase 1c's hint UI.
     */
    async function loadAvailableModels() {
      const [modelsResp, providersResp] = await Promise.allSettled([
        service.ai.listModels(),
        service.ai.listProviders(),
      ])

      const list: AgentModel[] = []

      if (modelsResp.status === 'fulfilled') {
        // Single-level data extraction: shared package already unwrapped the axios layer, `body` is
        // the HTTP body; `GET /v1/ai/models` (route/v2/models.go:30) outputs raw array directly —
        // see this file's baseline at :120-127. Previously had an extra `.data` layer here, the only
        // place violating that baseline in the whole file, directly causing the top bar ModelPicker to always be empty.
        const body = modelsResp.value
        const arr = Array.isArray(body) ? (body as Record<string, unknown>[]) : []
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
        // Same as above: `GET /v1/ai/providers` (route/v2/providers.go:95) also outputs raw array
        // directly, and backend only embeds favorite models in each provider's `models` field to drive
        // ModelPicker. buildCloudModelList carries its own Array.isArray guard, non-array input safely
        // degrades to empty list.
        list.push(...buildCloudModelList(providersResp.value))
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

    /** agentStore.js:647-652 — switch selected model (must be a key already in list), persist + refresh thinking state. */
    function selectModel(key: string) {
      if (!availableModels.value.some((m) => m.key === key)) return
      selectedModel.value = key
      localStorage.setItem(MODEL_KEY, key)
      updateThinkingForModel()
    }

    /**
     * agentStore.js:656-660 — fetch user-level thinking defaults. **Swallow error and keep
     * hardcoded fallback** (intentional, not an oversight): defaults' initial value is already
     * the product's fallback (enabled:true, level:'medium'); no need to break on API failure —
     * ThinkingBar renders with the fallback, user can still switch intensity normally.
     */
    async function loadThinkingDefaults() {
      try {
        const d = await service.ai.getThinkingDefaults()
        thinking.value.defaults = d as { enabled: boolean; level: string }
      } catch { /* Keep hardcoded fallback — verbatim with Vue2 agentStore.js:656-660 */ }
    }

    /**
     * agentStore.js:663-669 — if no sessionId, return directly without requesting.
     * `service.ai.getSessionThinking` already normalizes "no override for this session" to `null`
     * (see NimoOS-Service/src/ai.ts:183-198) and swallows request exceptions itself; here we only
     * handle `null` by falling back to a shallow copy of `thinking.defaults`; write only enabled/
     * level fields, don't touch supportsThinking/providerType (those are maintained only by
     * updateThinkingForModel).
     */
    async function loadSessionThinking(sessionId: string | number | null | undefined) {
      if (!sessionId) return
      let cfg = await service.ai.getSessionThinking(sessionId)
      if (!cfg) cfg = { ...thinking.value.defaults }
      thinking.value.enabled = cfg.enabled
      thinking.value.level = cfg.level
    }

    /**
     * agentStore.js:671-677 — **optimistically update local state first, then patch if session exists**;
     * patch failure **does not rollback** local state (intentionally preserves Vue2 semantics, not an
     * oversight — ThinkingBar must respond to user clicks immediately; failure is corrected only on
     * the next successful patch/loadSessionThinking, no immediate rollback to avoid UI jitter).
     * No session (not yet created): update local only, no request.
     */
    async function setThinkingEnabled(enabled: boolean) {
      thinking.value.enabled = enabled
      if (activeSessionId.value) {
        await service.ai.patchSessionThinking(activeSessionId.value, {
          enabled, level: thinking.value.level,
        })
      }
    }

    /** agentStore.js:680-686 — same as setThinkingEnabled, but updates level. Also doesn't rollback. */
    async function setThinkingLevel(level: string) {
      thinking.value.level = level
      if (activeSessionId.value) {
        await service.ai.patchSessionThinking(activeSessionId.value, {
          enabled: thinking.value.enabled, level,
        })
      }
    }

    /** agentStore.js:689-698 — refresh thinking.supportsThinking/providerType based on selected model. */
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
     * agentStore.js:210-244 — verbatim port of regenerateTitle: parse selectedModel key for
     * model name + providerType, POST to regenerate; only write back to sessions[idx] if success
     * and title non-empty; on failure **console.warn and swallow, promise still resolves**
     * (agentStore.js:238-240, intentional — top bar sparkle button and send()'s first-turn
     * auto-supplement rely on "this action never rejects" to call fire-and-forget without extra
     * try/catch).
     *
     * Model key parsing reuses parseModelKey from module top, but Vue2 here (agentStore.js:214-215)
     * has unique defense: if key has no colon at all, return immediately without attempting parse.
     * Verified: parseModelKey is **not equivalent** for this malformed input — it would degrade the
     * no-colon key entirely to modelName (not return empty string triggering the `!modelName` fallback
     * below), so here we add Vue2's guard then delegate parseModelKey for actual split; cloud branch's
     * fallback when missing second colon (`secondColon < 0 ? rest : rest.slice(...)`) parseModelKey
     * already has, equivalent, no extra needed.
     */
    async function regenerateTitle(
      id: string | number,
      opts: { background?: boolean } = {},
    ): Promise<void> {
      const background = opts.background ?? false
      const key = selectedModel.value
      if (!key) return
      if (key.indexOf(':') < 0) return
      const { source, modelName } = parseModelKey(key)
      if (!modelName) return

      const sel = availableModels.value.find((m) => m.key === key)
      const providerType = sel?.provider_type || (source === 'local' ? 'ollama' : 'other')

      regeneratingTitleFor.value = { id, background }
      try {
        const body = await service.ai.regenerateAgentSessionTitle(id, modelName, providerType)
        const data = (body || {}) as Record<string, unknown>
        if (data.title) {
          const idx = sessions.value.findIndex((s) => s.id === id)
          if (idx >= 0) sessions.value[idx].title = data.title as string
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[agentStore] regenerateTitle failed', e)
      } finally {
        regeneratingTitleFor.value = null
      }
    }

    /**
     * agentStore.js:246-282 — M6: ask the backend for a task draft derived
     * from this session. Returns the draft, or null on failure — the caller
     * decides how to surface it. Deliberately tolerant of "no model
     * selected": the endpoint falls back to the raw user messages, and a
     * draft the user has to edit beats an error dialog.
     */
    async function draftTaskFromSession(
      sessionId: string | number,
    ): Promise<Record<string, unknown> | null> {
      const key = selectedModel.value || ''
      const { source, modelName } = key.indexOf(':') >= 0
        ? parseModelKey(key)
        : { source: '', modelName: '' }
      const sel = availableModels.value.find((m) => m.key === key)
      const providerType = sel?.provider_type || (source === 'local' ? 'ollama' : 'other')
      // Cloud providers need the explicit id, or the backend silently falls
      // back to the first enabled one and drafts with a different model.
      const extraHeaders: Record<string, string> = {}
      if (sel?.source === 'cloud' && sel?.providerId) {
        extraHeaders['X-Agent-Provider-Id'] = String(sel.providerId)
      }
      try {
        const body = await service.ai.draftTaskFromSession(
          sessionId, modelName, providerType, extraHeaders,
        )
        return (body as Record<string, unknown>) || {}
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[agentStore] draftTaskFromSession failed', e)
        return null
      }
    }

    /**
     * agentStore.js:413-419 — auto-supplement title in background after send()'s first-turn success.
     * Phase 1b once carved out an independent implementation (no UI state like regeneratingTitleFor);
     * after 1c-2 completes full regenerateTitle, this becomes pure delegation, no repeated model key
     * parsing — two implementations don't coexist. Vue2 call site is
     * `actions.regenerateTitle(id, {background:true}).catch(()=>{})` (fire-and-forget); correspondingly,
     * this file's send() finally call site also doesn't await, and attaches `.catch(() => {})`.
     */
    async function autoTitleFirstTurn(id: string | number): Promise<void> {
      return regenerateTitle(id, { background: true })
    }

    /**
     * agentStore.js:295-421 — send a message turn. String payload treated as plain text (backward-
     * compatible); busy guard prevents duplicate sends; wait for previous stop()'s pendingCancel to settle,
     * letting backend per-session lock release first; if no selected model, drop an error tool block
     * directly; otherwise create AbortController → (create session if needed) → push user+assistant
     * messages → parse model key (local:<name> / cloud:<id>:<name>) → compute providerType → assemble
     * extraHeaders (X-Skill-Id consumed once + X-Agent-Provider-Id) → call Task 6 runAgentRun; onError
     * drops an error tool block (dual-form: RAW error or {status,body}, all fallback to JSON.stringify
     * rendering, consistent with Vue2) → finally wrap-up busy + first-turn auto-supplement title.
     */
    async function send(payload: string | SendPayload): Promise<void> {
      const isObj = typeof payload === 'object' && payload !== null
      const text = typeof payload === 'string' ? payload : (isObj ? payload.text : '') || ''
      const attachmentIds = (isObj && payload.attachmentIds) || []
      const attachmentRefs = (isObj && payload.attachmentRefs) || []
      const contextPhoto = (isObj ? payload.contextPhoto : null) ?? null
      const contextAlbum = (isObj ? payload.contextAlbum : null) ?? null

      if (busy.value) return
      // Wait for the most recent stop()'s cancellation to complete, let backend's per-session lock release first,
      // or the next /run will 409 agent_busy.
      if (pendingCancel.value) {
        try { await pendingCancel.value } catch { /* already swallowed in stop() */ }
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
        // Send specific provider_type (deepseek/openai/qwen/anthropic/ollama), not coarse-grained
        // "cloud" — Python agent uses it to apply provider-specific settings (e.g., DeepSeek needs
        // parallel_tool_calls=False to prevent 400 when sibling tool calls in asyncio.gather get cancelled).
        const sel = availableModels.value.find((m) => m.key === key)
        const providerType = sel?.provider_type || (source === 'local' ? 'ollama' : 'other')

        const extraHeaders: Record<string, string> = {}
        if (pendingSkillId.value) {
          extraHeaders['X-Skill-Id'] = pendingSkillId.value
          pendingSkillId.value = null // consume once
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
            // onError is dual-form: non-abort fetch rejection (RAW error) or { status, body } (!ok).
            // Both forms fallback to JSON.stringify rendering to ERROR block — verbatim with
            // Vue2 agentStore.js:381-390.
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
        // Refresh attachments: just-uploaded drafts now have message_id on backend, should show as "sent".
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
            // agentStore.js:416-417 — fire-and-forget, swallow any rejection.
            autoTitleFirstTurn(activeSessionId.value).catch(() => {})
          }
        }
      }
    }

    /**
     * agentStore.js:423-489 — execution body for `/init` slash command: let agent generate
     * agent.md for a directory. Key differences from send() (verbatim with Vue2, not oversights):
     * 1) Both user/assistant messages `messages.value.push` directly, skip pushUserMessage/startAssistant
     *    (user message content fixed as `[/init] <target>`, not raw input text).
     * 2) Payload uses `kind: 'init', init_target: target`, **no thinking field**.
     * 3) finally **does not auto-supplement title** (Vue2 sendInit has no such step).
     * Message text is English prompt template for backend, not UI copy, not i18n.
     *
     * One **intentional deviation** from Vue2 verbatim order: in Vue2 source, both messages push
     * *before* `createSession()` (agentStore.js:426-436 push first, 441 then `await
     * actions.createSession()`). But `createSession()` wholly overwrites `messages.value = []`
     * (see createSession above), meaning "calling sendInit when no session" immediately wipes the
     * two just-pushed messages — this is a potential Vue2 bug (send() lacks this because send() calls
     * createSession() first then pushes). Here, we reorder to match send(): ensure session exists
     * first, then push both messages; rest of payload/validation/wrap-up logic maintains verbatim alignment.
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
        // Safety net: consistent with send(). Vue2 agentStore.js:423-490 lacks this guard, a potential defect
        // (errors silently swallowed). Here we ensure error block always has a host assistant message.
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
        abortController.value = null
      }
    }

    /**
     * agentStore.js:491-511 — abort the current stream. POST /cancel (not just abort request)
     * for two reasons: 1) backend agent task is separate from the request; aborting fetch only
     * leaves the task running, still holding per-session lock — next send() will 409 agent_busy.
     * 2) /cancel waits for task to truly terminate before responding, giving send() a sync point to wait on.
     * Cancel's promise hangs on pendingCancel for send()/continueRun() to await; UI itself can
     * immediately switch back to non-busy (setStreamingDone already does it).
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

    /** agentStore.js:513-517 — delegate to service layer; throw directly if confirm_id missing. */
    async function confirmAgentAction(confirmId: string, confirmed: boolean, remember = false): Promise<void> {
      if (!activeSessionId.value) return
      if (!confirmId) throw new Error('confirm_id missing')
      await service.ai.confirmAgentAction(activeSessionId.value, confirmId, confirmed, remember)
    }

    /**
     * Vue2 agentStore.js:519-530 -- The three-state resolution for MCP elicitation.
     *
     * Two differences from confirmAgentAction, both deliberate:
     * 1) Elicitation is three-state (accept / decline / cancel) and an accept can
     *    carry an answer, so action / content are passed through via `extra`;
     *    `confirmed` is still sent as before (action === 'accept'), so the backend's
     *    existing bookkeeping stays exactly as it was.
     * 2) With no active session this **throws** instead of silently returning the way
     *    confirmAgentAction does -- a silent return would resolve this promise, the
     *    card would then flip to "answer sent to X" / "opened in a new tab", while in
     *    reality not a single byte was sent: the backend callback stays parked in
     *    wait_elicit (for up to 24h) with the whole tool call hung silently behind it.
     *    Throwing lets the card's catch surface it instead. confirmAgentAction's path
     *    does not block the tool call, so it is left as-is.
     */
    async function resolveElicitation(
      confirmId: string,
      action: 'accept' | 'decline' | 'cancel',
      content: Record<string, unknown> | null = null,
    ): Promise<void> {
      if (!activeSessionId.value) throw new Error('no active session')
      if (!confirmId) throw new Error('confirm_id missing')
      await service.ai.confirmAgentAction(
        activeSessionId.value, confirmId, action === 'accept', false,
        content === null ? { action } : { action, content },
      )
    }

    /**
     * agentStore.js:519-597 — continue a run paused by max_turns. Busy guard + wait for
     * pendingCancel to settle, same cadence as send(). First mark the most recent un-continued
     * max_turns card as resumed=true (idempotent: prevent misclick double-trigger after busy
     * recovers or run-stream reconnect replays). onError here only console.warn, no error tool
     * block — consistent with Vue2 continueRun error handling (lighter than send()).
     */
    async function continueRun(): Promise<void> {
      if (busy.value) return
      if (pendingCancel.value) {
        try { await pendingCancel.value } catch { /* already swallowed */ }
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
      // SP8-P2a Task 4(D1) — must be computed, not `aiTheme.theme` (bare value is snapshot at read-time,
      // loses reactivity; see aiTheme.ts header comment and this task report Step 6 RED verification).
      theme: computed(() => aiTheme.theme),
      leftCollapsed,
      rightCollapsed,
      rightTab,
      abortController,
      activitySteps,
      pendingCancel,
      availableModels,
      selectedModel,
      lastFallbackNotice,
      thinking,
      regeneratingTitleFor,
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
      toggleRight,
      setRightTab,
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
      removeVisibleResourceByPath,
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
      loadThinkingDefaults,
      loadSessionThinking,
      setThinkingEnabled,
      setThinkingLevel,
      regenerateTitle,
      draftTaskFromSession,
      send,
      sendInit,
      stop,
      continueRun,
      confirmAgentAction,
      resolveElicitation,
    }
  })()
}
