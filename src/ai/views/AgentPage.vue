<!--
  1:1 port from Vue2 src/views/AI/Agent/Agent.vue (242 lines), trimmed v1a:
  removing AgentComposer (1b has no input UI — this phase's only send entry is Task 11's
  ?search=/?message= auto-send + EmptyState suggestion cards),
  AgentRightPanel (1c), and systemMetrics/disks loading segments (1c).

  SP8-P1c1 Task 12 — AgentComposer mounted (Vue2 Agent.vue:38-42 mount contract, 1:1):
  props busy/ctx-usage, emits send/stop/send-init connect directly to store same-name actions.
  ctxUsage state + refreshContextUsage() ported from Vue2 Agent.vue:99/198-207,
  three refresh trigger points (mounted once, activeSessionId change once, busy true→false
  falling edge once) ported from Vue2 120-132 (at that time **don't** port loadSessionThinking/
  updateThinkingForModel in the same session watcher, also **don't** port lastFallbackNotice
  toast watcher — both belong to ThinkingBar/ModelPicker, left for 1c-2).
  ModelPicker, ThinkingBar UI still left for subsequent tasks.

  SP8-P1c2 Task 2 — data-rightcollapsed unbind hard-coded value, rebind to store.rightCollapsed
  (Vue2 Agent.vue:4 exactly aligned); AgentTopbar add right-collapsed prop +
  toggle-right emit → store.toggleRight (Vue2 Agent.vue:20/24). Right panel shell itself
  (AgentRightPanel) not yet mounted, left for subsequent tasks — this task only unbinds
  container state + top bar toggle.

  SP8-P1c2 Task 3 — fill in the two lines Task 12 left blank: session watcher (Vue2
  Agent.vue:120-123) now triggers loadSessionThinking(newId)/updateThinkingForModel()
  in parallel with refreshContextUsage() (only if newId is non-empty, order per Vue2,
  not awaited); in mounted add one call to store.loadThinkingDefaults() before loadSessions/
  loadAvailableModels (Vue2 Agent.vue:151). lastFallbackNotice toast watcher still not
  in scope of this task (ModelPicker's responsibility, left for subsequent task). ThinkingBar/
  ModelPicker UI itself still not mounted — this task only handles store state + page wiring.

  SP8-P1c2 Task 13 — `<AgentRightPanel>` officially mounted (Vue2 Agent.vue:44-64 mount
  contract), 11 props + 7 events aligned line by line (after F1 final review fix, one new
  8th event added `remove-resource-by-path` → `store.removeVisibleResourceByPath`, same
  handler style as adjacent); only one prop missing is `systemMetrics` (user's intentional
  deviation approved 2026-07-27, see comment at template location and AgentRightPanel.vue
  props section). Now all 4 right panel tabs (Activity/Context/System/Resources) are connected
  to real implementations.

  Theme persistence already sunk into store.toggleTheme (Task 2 directly localStorage.setItem),
  no longer need the extra watch store.theme persistence as in Vue2 Agent.vue:117-119.

  SP8-P1c2 Task 9 — ModelPicker mount + model fallback toast + AI-rename button (remaining
  part of AgentTopbar mount contract from Vue2 Agent.vue:15-33):
  - AgentTopbar add `available-models`/`selected-model`/`regenerating-title-for`
    three props directly pass store same-name fields; `select-model` → `store.selectModel(key)`,
    `regenerate-title` → `onRegenerateTitle` (Vue2 Agent.vue:216-220, with
    activeSessionId non-empty guard).
  - ModelPicker empty state "Go to settings" and future top bar settings entry share same
    `open-settings` event name, reuse existing `onOpenSettings` (placeholder toast before P2,
    not router jump).
  - `lastFallbackNotice` watcher line-for-line mirrors Vue2 Agent.vue:133-142: when non-empty
    show 4000ms warning toast (Task 6's tier), when `to` empty show fallback
    `t('aiNoModelAvailable')`; **watcher itself sets store.lastFallbackNotice back to
    null** — store side (agentStore.ts) deliberately doesn't clear this field, clearing is
    the view's responsibility.
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { LocationQueryRaw } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useAgentStore } from '../stores/agentStore'
import { useAiTheme } from '../stores/aiTheme'
import type { ThinkingLevel } from '../stores/agentStore'
import { provideAgentStore } from '../composables/useProvidedAgentStore'
import { useToast } from '../../stores/toast'
import { toStoragePayload, type StoragePayload } from '../util/toStoragePayload'
import AgentSidebar from '../components/shell/AgentSidebar.vue'
import AgentTopbar from '../components/shell/AgentTopbar.vue'
import AgentComposer from '../components/shell/AgentComposer.vue'
import AgentRightPanel from '../components/shell/AgentRightPanel.vue'
import type { ActivityStep } from '../components/tabs/ActivityTab.vue'
import type { ResourceAttachment } from '../components/tabs/ResourcesTab.vue'
import MessageList from '../components/stream/MessageList.vue'
import EmptyState from '../components/stream/EmptyState.vue'
import '../styles/tokens.scss'
import '../styles/agent-styles.scss'

const store = useAgentStore()
// SP8-P2b verification round 3: only used to register/unregister "AI area in foreground"
// (color scope for app-level toast).
const aiTheme = useAiTheme()
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

// SP8-P1c2 Task 13 — same as above, pure type bridging, zero runtime semantics: the two
// fields in store are loose Record<string, unknown>[] (activitySteps constructed on-the-fly
// by pushActivityStep, attachments stored as-is from /attachments API), the two tab
// components on the right panel each declare narrower shapes (ActivityStep / ResourceAttachment).
// Runtime shape always satisfies (store construction points + backend contract), this only
// aligns types, no conversion/copying.
const activityStepsForPanel = computed(() => store.activitySteps as unknown as ActivityStep[])
const attachmentsForPanel = computed(() => store.attachments as unknown as ResourceAttachment[])

// Agent.vue:104-108 semantics: fall back to '' when the active session has no
// (or an empty) title — AgentTopbar shows its own placeholder in that case.
const currentSessionTitle = computed(() => {
  const id = store.activeSessionId
  const s = store.sessions.find((x) => x.id === id)
  return s && s.title ? s.title : ''
})

// F2 fix (review) — AgentTopbar's `thinking` prop narrows `level: ThinkingLevel`
// (agentStore.ts explains why store's own ThinkingState.level stays string and doesn't
// narrow: it needs to catch the bare string return from shared service getSessionThinking()).
// The cast here is safe — at runtime `thinking.level` can only come from ThinkingBar's four
// <option> values or server-side `thinking_level || 'medium'` fallback, never a fifth value.
const thinkingForTopbar = computed(() => ({
  ...store.thinking,
  level: store.thinking.level as ThinkingLevel,
}))

function onOpenSettings() {
  // Vue2 `Agent.vue:209` — three entries (two on sidebar + ModelPicker empty state) share
  // same no-arg jump, lands on settings page default section "Local Models". Since SP8-P2a
  // route exists (T8 registered), placeholder toast is retired.
  router.push('/ai/settings')
}

function onUpdateTitle(title: string) {
  if (store.activeSessionId) store.setSessionTitle(store.activeSessionId, title)
}

// Vue2 Agent.vue:216-220 —— sparkle click, guarded by activeSessionId (no-op
// with no active session, mirrors the same guard onUpdateTitle uses above).
function onRegenerateTitle() {
  if (store.activeSessionId) store.regenerateTitle(store.activeSessionId)
}

// Vue2 Agent.vue:133-142 — model-fallback toast. The store deliberately
// never clears `lastFallbackNotice` itself (see agentStore.ts) — clearing it
// is this watcher's job, same as Vue2 did inline (`this.store.state
// .lastFallbackNotice = null`), so a second identical fallback later still
// re-fires the watcher instead of being silently swallowed by an unchanged
// (falsy) value.
watch(
  () => store.lastFallbackNotice,
  (notice) => {
    if (notice) {
      toast.show(
        t('aiModelFallback', { from: notice.from, to: notice.to || t('aiNoModelAvailable') }),
        4000,
        'warning',
      )
      store.lastFallbackNotice = null
    }
  },
)

// Agent.vue:99 ctxUsage state, populated by refreshContextUsage() below.
const ctxUsage = ref<{ tokens: number; window: number; pct: number } | null>(null)

// SP8-P1c2 Task 11 — Agent.vue:159-162 storage state, populated once in
// onMounted below via toStoragePayload(). Deliberately a plain page-level ref,
// not agentStore.ts state: the brief is explicit that this task must not add
// store state it didn't ask for, and nothing else in the app needs this value
// — SystemTab (Task 11) takes it as a prop, AgentRightPanel wiring (Task 13)
// will pass this ref straight down when it mounts <AgentRightPanel> here.
// (systemMetrics — Agent.vue:155-158 — is intentionally NOT ported: SystemTab
// reads live data itself via useUtilization()/useUtilizationStore() per this
// phase's user-approved deviation, so there is no one-shot HTTP fetch or state
// for it on this page.)
const storage = ref<StoragePayload | null>(null)

// Vue2 bug fix (project 2026-07-27 porting discipline: follow logic correctness, not literal
// 1:1) — Agent.vue 198-207's refreshContextUsage has no in-flight/order guard: a quick
// session switch might trigger two overlapping requests; if the old request arrives late,
// it overwrites the current session's ctxUsage with an outdated session's quota. Here add
// an auto-incrementing sequence number; only results that are still "the latest call" write
// back to ctxUsage, stale results are discarded directly — doesn't change the three trigger
// points' call count/timing semantics, fix scope limited to "who can write back".
let ctxUsageSeq = 0

/**
 * Agent.vue:198-207 — early return if no session; pass **raw model key** (e.g., 'local:llama3'),
 * not bare model name; set null on failure.
 */
async function refreshContextUsage() {
  // Final-review fix (2026-07-27, project porting discipline: follow logic correctness;
  // Vue2 Agent.vue 198-207 has no guard at all on this early-return branch, not "different
  // from Vue2" but adding a guard Vue2 never did): no-session early-return must equally
  // (a) increment ctxUsageSeq so that when a request for a "just-deleted session" lands in-flight,
  // it gets discarded by the `seq === ctxUsageSeq` check in catch/then because seq is stale,
  // not overwriting the current (empty) state; (b) clear ctxUsage, else the ring progress bar
  // keeps showing old token count for a session that no longer exists.
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

// A-8 — `?session=` deep link (spec docs/superpowers/specs/2026-08-19-agent-session-deeplink-design.md).
// This page keeps its own mirror of the URL query and every write goes through writeQuery().
// Reason: router.replace resolves asynchronously, so a writer that rebuilt its query from
// route.query could resurrect a key another writer had just deleted — concretely, the session
// mirror firing after the ?search= strip would put search back, and the next refresh would
// re-send the seed turn. One ref, no stale reads. This generalises the local-copy discipline
// SP8-P3a introduced for chaining the skill and search/message strips.
const urlQuery = ref<LocationQueryRaw>({})
function writeQuery() {
  return router.replace({ path: '/ai/agent', query: { ...urlQuery.value } }).catch(() => {})
}
// Vue2 Agent.vue:211-220 — mirror the selected session into the URL. replace, not push:
// switching sessions must not pile up history entries. The equality guard keeps a deep link
// (and the route watcher that follows it) from bouncing a redundant navigation back.
function syncSessionQuery(id: string | number | null) {
  const next = id == null ? '' : String(id)
  if ((urlQuery.value.session ?? '').toString() === next) return
  if (next) urlQuery.value.session = next
  else delete urlQuery.value.session
  writeQuery()
}
// Agent.vue:120-126 session watcher — SP8-P1c2 Task 3 fills in loadSessionThinking/
// updateThinkingForModel (1c-1 phase left these blank, ThinkingBar not yet wired,
// pre-stuffing would be dead code; this task fills in the four store-side loader/setter,
// page-side connects these two lines). Order mirrors Vue2 Agent.vue:120-123 exactly:
// first loadSessionThinking(newId)+updateThinkingForModel() (only if newId non-empty,
// not awaited — same as Vue2, fire-and-forget), then refreshContextUsage()
// (runs regardless of newId, consistent with Vue2).
watch(
  () => store.activeSessionId,
  (newId) => {
    if (newId) {
      store.loadSessionThinking(newId)
      store.updateThinkingForModel()
    }
    refreshContextUsage()
    syncSessionQuery(newId)
  },
)
// Agent.vue:127-132 — refresh only on busy true→false falling edge (after a round finishes);
// no watcher for selectedModel, consistent with Vue2 (switching models doesn't auto-refetch quota).
watch(
  () => store.busy,
  (v, old) => {
    if (old === true && v === false) refreshContextUsage()
  },
)

onMounted(async () => {
  // SP8-P2b verification round 3 (2026-07-30): register "AI area in foreground" so
  // app-level `AppToast` switches to AI's toast colors. Without registering it uses
  // global blue-black theme's semi-transparent white background + white text, completely
  // invisible on AI light theme. Root cause and reference counting rationale see aiSurfaces
  // comment in stores/aiTheme.ts.
  aiTheme.enterAiSurface()
  store.initTheme()
  // Seed the URL mirror before anything reads or rewrites the query (see urlQuery above).
  urlQuery.value = { ...route.query }
  // Vue2 Agent.vue:151 — loadThinkingDefaults called once before loadSessions/loadAvailableModels
  // (ThinkingBar needs a fallback default value, before session/model loading is ready).
  // The function already swallows internal request errors (agentStore.ts loadThinkingDefaults),
  // the try/catch here is just following Vue2's defensive style to keep consistency,
  // not because it actually throws.
  try {
    await store.loadThinkingDefaults()
  } catch {
    /* ignore */
  }
  try {
    await store.loadSessions()
  } catch {
    /* ignore — mirrors Vue2 Agent.vue's swallow-per-call mounted sequence */
  }
  try {
    // Before auto-send handoff (Task 11), nail down default model first,
    // else at that point selectedModel is still null and send() will first drop
    // a "no model" error block.
    await store.loadAvailableModels()
  } catch {
    /* ignore — model loading failure shouldn't block page render, send() itself shows fallback no-model tip */
  }
  // Agent.vue:154 — fetch ctxUsage once after models load (mounted trigger, one of three trigger points).
  refreshContextUsage()

  // SP8-P1c2 Task 11 — Agent.vue:159-162 one-shot fetch storage capacity (disks.list() is
  // new method in Task 1). try/catch swallows error and sets null, same as Vue2
  // (empty state fallback to SystemTab render, don't error here). Storage capacity not
  // real-time, only fetched once on mount.
  try {
    const disks = await service.disks.list()
    storage.value = toStoragePayload(disks)
  } catch {
    storage.value = null
  }

  // Vue2 Agent.vue:145-148 — ?skill= registration: only temporary storage, consumed
  // in send() (X-Skill-Id assembly in agentStore.ts send()), not sent here.
  //
  // SP8-P3a post-acceptance addition②: Vue2 at the same location never strips ?skill=
  // from URL (contrast with adjacent ?search=/?message= — those are read and immediately
  // router.replace stripped, see next section). Real consequence: user clicks × on the toast
  // to cancel mount, or after message is sent pendingSkillId already consumed by send() once,
  // just press F5 and skill is still in URL, mount happens again — button/send don't count.
  // Of three similar "one-shot handoff params", only skill missed this step, reproducible
  // error behavior; corrected here per "logic follows correctness" discipline, not copying
  // Vue2 verbatim.
  //
  // Below search/message section also does another router.replace, two must chain together
  // without eating each other: use only the page-scoped `urlQuery` ref (not direct read/write
  // of route.query) to convey "already stripped skill" — mocked router.replace doesn't write
  // back route.query, in real vue-router route.query update happens async after nav confirms,
  // both cases can't assume "after last replace takes effect route.query changed". So
  // seedSearch/seedMessage reading and clean construction below are all based on this same
  // ref — when stripping skill only delete skill, leave search/message as-is for below to
  // read; after stripping, final state has none of the three params. This ref is shared with
  // the session mirror (see A-8 comment above the session watcher), so a session switch that
  // lands mid-mount can't resurrect a key this sequence just deleted either.
  const skill = urlQuery.value.skill
  if (skill) {
    store.pendingSkillId = String(skill)
    delete urlQuery.value.skill
    await writeQuery()
  }

  // Handoff from the global search page / homepage AI widget
  // (/ai/agent?search=<query> or ?message=<text>) — Vue2 Agent.vue:166-192.
  // search wins over message when both are present (message is skipped
  // entirely). One-shot: router.replace strips both query keys BEFORE
  // sending so a page refresh doesn't re-send the seed turn.
  const seedSearch = (urlQuery.value.search ?? '').toString().trim()
  const seedMessage = (urlQuery.value.message ?? '').toString().trim()
  if (seedSearch || seedMessage) {
    delete urlQuery.value.search
    delete urlQuery.value.message
    await writeQuery()
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

// SP8-P2b verification round 3: unregister when leaving Agent page, let toast return
// to global theme (zero desktop impact).
onUnmounted(() => {
  aiTheme.leaveAiSurface()
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
        :regenerating-title-for="store.regeneratingTitleFor"
        :theme="store.theme"
        :right-collapsed="store.rightCollapsed"
        :available-models="store.availableModels"
        :selected-model="store.selectedModel"
        :thinking="thinkingForTopbar"
        @toggle-left="store.toggleLeft"
        @toggle-theme="store.toggleTheme"
        @toggle-right="store.toggleRight"
        @update-title="onUpdateTitle"
        @select-model="(key) => store.selectModel(key)"
        @open-settings="onOpenSettings"
        @regenerate-title="onRegenerateTitle"
        @thinking-enabled="(v) => store.setThinkingEnabled(v)"
        @thinking-level="(v) => store.setThinkingLevel(v)"
      />
      <EmptyState v-if="store.messages.length === 0" />
      <MessageList v-else :messages="messagesForList" :busy="store.busy" />
      <!--
        Agent.vue:38-42 mount contract — 1:1 (props/emits names and semantics). Emit handlers
        written as inline arrow functions, not like Vue2 directly `@send="store.actions.send"`
        bare method reference — in Vue3 bare method reference codifies the `store.send` function
        value itself into vnode's onSend prop at render time; if externally `store.send` is
        wholly replaced later (e.g., test `vi.spyOn(store, 'send')`, uses `Object.defineProperty`
        underneath, bypasses Vue reactive set trap, doesn't trigger AgentPage re-render),
        bare reference won't follow, still calls the old function. Inline arrow reads `store.send`
        at **call time**, getting current value, behavior aligns with "calling method's current
        implementation".
      -->
      <AgentComposer
        :busy="store.busy"
        :ctx-usage="ctxUsage"
        @send="(payload) => store.send(payload)"
        @stop="() => store.stop()"
        @send-init="(target) => store.sendInit(target)"
      />
    </main>
    <!--
      SP8-P1c2 Task 13 — Agent.vue:44-64 mount contract, aligned line by line. Two
      differences from Vue2 style, both don't change behavior:
      1) `:session-id` here wraps `String(... ?? '')`. Vue2 Agent.vue:51 directly passes
         `store.state.activeSessionId` (can be number or null, but Vue2's prop declaration
         is `{ type: String, default: '' }` — running into number/null gets prop type warnings).
         Same normalization style as this page's AgentTopbar :session-id.
      2) Emit handlers all written as inline arrows (reason same as long comment above on
         AgentComposer: Vue3 bare method reference codifies function value into vnode,
         doesn't work after spyOn replacement).
      systemMetrics (Vue2 Agent.vue:47) intentionally not passed — SystemTab itself takes
      real-time data via useUtilization() channel, AgentRightPanel side already deleted
      this prop (see comment in that file's props section).
    -->
    <AgentRightPanel
      :collapsed="store.rightCollapsed"
      :tab="store.rightTab"
      :activity-steps="activityStepsForPanel"
      :storage="storage"
      :busy="store.busy"
      :session-id="String(store.activeSessionId ?? '')"
      :visible-resources="store.visibleResources"
      :attachments="attachmentsForPanel"
      :staged-changes="store.stagedChanges"
      :committing="store.committing"
      :reverting="store.reverting"
      @set-tab="(tab) => store.setRightTab(tab)"
      @remove-resource="(id) => store.removeVisibleResource(id)"
      @remove-resource-by-path="(path) => store.removeVisibleResourceByPath(path)"
      @remove-attachment="(id) => store.removeAttachment(id)"
      @revert-run="(runId) => store.revertStagedRun(runId)"
      @revert-batch="(batchId) => store.revertStagedBatch(batchId)"
      @revert-item="(stagedId) => store.revertStagedItem(stagedId)"
      @commit-all="() => store.commitStagedAll()"
    />
  </div>
</template>
