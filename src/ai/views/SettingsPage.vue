<!--
  SP8-P2a Task 8 — 1:1 port from Vue2 `src/views/AI/Settings/Settings.vue` (243 lines).
  Settings page shell: left SettingsRail + right status-light top bar +
  two content rendering modes (stacked/single-swap) + scroll-spy + `?section=` deep link.

  【Root element】bears both `agent-app` (token scope, see settings-styles.scss header
  comment) and `set-app` (layout) classes — this repo's `tokens.scss` defines tokens only
  in the `.agent-app` scope, `.set-app` handles grid layout only; missing one means no
  colors or no layout.

  【Differences from Vue2, all reported per porting discipline】

  D1 (architecture diff, Task 4 resolved) — theme is no longer private state of this
  component; delegated to app-level `useAiTheme()` (Agent page and Settings page share
  the same instance, same localStorage key).

  D2 (architecture diff, Task 5 + this task) — Vue2 `Settings.vue:100-111` calls
  `createSettingsStore()` on each mount, creating new state, so activeSection always
  starts from 'models', forms always collapse, HF search results always empty. Pinia
  singleton restores prior-exit state, so `onMounted` must **call `store.resetTransientUi()`
  first, then read `?section=`** — reversing the order lets deep link get wiped by reset
  (brief use case 13, Step 8 has dedicated RED validation).

  D3 (reported, see full comment above restore loop below) — Vue2's download restore
  loop never truly executed because `createSettingsStore()` creates new state each time;
  under Pinia singleton it has meaning for the first time. The `&& !job._timer` guard
  is preserved verbatim.

  【New, not from Vue2 blueprint — the next two are historical record + current state,
  not parallel states】
  - 【History】top bar "Details" blueprint was originally `<router-link to="/ai/knowledge">`
    (Settings.vue:22-24). SP8-P2a/P2b: route did not exist at that time, `router.push`
    would land on blank dead page — temporarily changed to `<button>` + info toast
    placeholder; style class `.set-detail-link` stayed unchanged (visual 1:1), only
    interaction target changed.
  - 【Current state, governance §15.1 / P5c §8.5】`/ai/knowledge` shell was already
    built by SP8-P5a, but P5a/P5b/P5c all missed restoring that placeholder entry —
    knowledge section had to be accessed by typing address only throughout; discovered
    during user acceptance on 2026-08-04. **SP8-P5d Task 9 reversed back** to blueprint
    original `<router-link to="/ai/knowledge">` (reverse is not delete: replaced `<button>`
    + `onDetailsClick` original text appears in comment at `onDetailsClick` location below).
  - `onSelect()` at `DEFERRED_SECTIONS.includes(id)` pops an info toast — Vue2 has no such
    concept (its 13 sections are all real components). **Update from fix round M2**:
    starting SP8-P4 `DEFERRED_SECTIONS` is empty (all 13 sections wired to real components);
    this branch **never triggers** now, but mechanism is preserved (user explicit "reverse
    not delete") for future reuse when adding incomplete sections — see `SECTION_COMPONENTS`
    comment below and explanation at `onSelect()`.
-->
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../stores/settingsStore'
import { useAiTheme } from '../stores/aiTheme'
import { useToast } from '../../stores/toast'
import SettingsRail from '../components/settings/SettingsRail.vue'
import SectionPlaceholder from '../components/settings/SectionPlaceholder.vue'
import ModelsSection from '../components/settings/sections/ModelsSection.vue'
import ProvidersSection from '../components/settings/sections/ProvidersSection.vue'
import PrivacySection from '../components/settings/sections/PrivacySection.vue'
import ThinkingDefaultsSection from '../components/settings/sections/ThinkingDefaultsSection.vue'
import BackgroundTasksSection from '../components/settings/sections/BackgroundTasksSection.vue'
import BlacklistSection from '../components/settings/sections/BlacklistSection.vue'
import ExecutionSection from '../components/settings/sections/ExecutionSection.vue'
import PermissionsSection from '../components/settings/sections/PermissionsSection.vue'
import SearchSection from '../components/settings/sections/SearchSection.vue'
import MemorySection from '../components/settings/sections/MemorySection.vue'
import ObservabilitySection from '../components/settings/sections/ObservabilitySection.vue'
import WebSection from '../components/settings/sections/WebSection.vue'
import SkillsSection from '../components/settings/sections/SkillsSection.vue'
import McpSection from '../components/settings/sections/McpSection.vue'
import McpApprovalsSection from '../components/settings/sections/McpApprovalsSection.vue'
import McpTokensSection from '../components/settings/sections/McpTokensSection.vue'
import ChannelsSection from '../components/settings/sections/ChannelsSection.vue'
import ToolboxSection from '../components/settings/sections/ToolboxSection.vue'
import LarkSection from '../components/settings/sections/LarkSection.vue'
import AgentIcon from '../components/icons/AgentIcon.vue'
import {
  ALL_ITEMS,
  DEFERRED_SECTIONS,
  SPLIT_SECTIONS,
  VALID_SECTIONS,
  groupOf,
  type SectionId,
} from '../components/settings/sections'
import '../styles/tokens.scss'
import '../styles/sk-shared.scss'
import '../styles/settings-styles.scss'
import '../styles/skills-styles.scss'
import '../styles/mcp-styles.scss'

// SP8-P2a — section id → component. Must stay in sync with sections.ts id
// and `?section=` deep link contract across all three (same convention as
// Vue2 Settings.vue:75-90).
//
// SP8-P2b final wiring only had skills / mcp left rendering SectionPlaceholder;
// SP8-P3a wired skills to real SkillsSection, leaving mcp alone; SP8-P4 Task 9
// wired mcp to real McpSection — all 13 sections now point to their real components.
// No mapping in `SECTION_COMPONENTS` points to `SectionPlaceholder` anymore
// (models/providers/privacy/thinking wired P2a; blacklist/execution/search/
// memory/observability/mcptokens/channels wired P2b; skills wired P3a;
// mcp wired Task 9 this release). `SectionPlaceholder` component itself and
// `DEFERRED_SECTIONS` mechanism preserved as-is (user explicit "reverse not delete");
// when adding incomplete sections in future, change mapping back to `SectionPlaceholder`
// and re-add id to `DEFERRED_SECTIONS` to restore placeholder behavior.
//
// SP8-P2b Task 14 fix round 1 — do not export this constant: `<script setup>`
// forbids ES module named exports (tried it, compiler errors directly), and
// coordinator ruled "testability" not worth splitting out extra `<script>` block
// (narrowing public surface). Guard test changed to assert render output (whether
// placeholder text leaks through), no longer needs the constant itself.
const SECTION_COMPONENTS: Record<SectionId, Component> = {
  models: ModelsSection, // Task 9 — wired
  providers: ProvidersSection, // Task 10 — wired
  privacy: PrivacySection, // Task 11 — wired
  thinking: ThinkingDefaultsSection, // Task 11 — wired
  background: BackgroundTasksSection, // settings parity 2026-08-24 — wired
  permissions: PermissionsSection, // agent permission policy — implemented
  blacklist: BlacklistSection, // SP8-P2b Task 4 — implemented, final wiring
  execution: ExecutionSection, // SP8-P2b Task 5 — implemented, final wiring
  search: SearchSection, // SP8-P2b Task 7 — implemented, final wiring
  memory: MemorySection, // SP8-P2b Task 6 — implemented, final wiring
  observability: ObservabilitySection, // SP8-P2b Task 8 — implemented, final wiring
  web: WebSection, // agent web tools Task 9 — implemented, final wiring
  skills: SkillsSection, // SP8-P3a Task 7 — implemented, final wiring
  mcp: McpSection, // SP8-P4 Task 9 — implemented, final wiring (DEFERRED_SECTIONS hereby empty)
  mcpapprovals: McpApprovalsSection, // Task 21 (mcp-progressive-disclosure) — implemented
  mcptokens: McpTokensSection, // SP8-P2b Task 10 — implemented, final wiring
  channels: ChannelsSection, // SP8-P2b Task 12 — implemented, final wiring
  toolbox: ToolboxSection, // tasks-toolbox-lark port — implemented
  lark: LarkSection, // tasks-toolbox-lark port — implemented
}

// Not from Vue2 blueprint — SectionPlaceholder needs { titleKey, bodyKey } two props,
// while Vue2's SECTION_COMPONENTS is pure id→component mapping, rendering passes
// no props (Settings.vue:40/45). Passing these two extra props to non-placeholder
// components is harmless (all 13 sections are currently real components; these props
// become undeclared fallthrough attrs, no impact on function).
// 【Fix round M2 update】Starting SP8-P4, no mapping in `SECTION_COMPONENTS` points
// to `SectionPlaceholder` anymore; this function's valid return branch (`titleKey`/
// `bodyKey` non-empty) **never triggers** now — mechanism preserved as-is (user
// explicit "reverse not delete"): when some id's `SECTION_COMPONENTS` mapping changes
// back to `SectionPlaceholder` in future, directly reuse the source section's own
// navigation text (`labelKey` from `sections.ts`) as title, unified
// `aiCfgPlaceholderBody` as explanation text.
function placeholderProps(id: SectionId): Record<string, string> {
  if (SECTION_COMPONENTS[id] !== SectionPlaceholder) return {}
  const item = ALL_ITEMS.find((i) => i.id === id)
  return { titleKey: item ? item.labelKey : '', bodyKey: 'aiCfgPlaceholderBody' }
}

const store = useSettingsStore()
const aiTheme = useAiTheme()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()

const bodyEl = ref<HTMLDivElement | null>(null)
// v-for template ref collection (Vue3 equivalent of Vue2 `:ref="'sec-' + item.id"`).
// Bookkeeping only, no reactivity needed.
const sectionEls: Record<string, HTMLElement | null> = {}
function setSectionEl(id: string, el: Element | null) {
  sectionEls[id] = el as HTMLElement | null
}

const activeGroup = computed(() => groupOf(store.activeSection))
// Vue2 `groupTitle()` has fallback `this.activeGroup ? ... : 'AI Settings'` —
// `groupOf()` (sections.ts) falls back to GROUPS[0] when not found, `activeGroup`
// is never falsy; that ternary branch is dead code, not ported here (pure simplification
// of dead branch, not behavior change).
const groupTitle = computed(() => t(activeGroup.value.labelKey))
const isSplitSection = computed(
  () => !activeGroup.value.stack && SPLIT_SECTIONS.includes(store.activeSection),
)

function pillState(v: boolean | null | undefined): 'ok' | 'off' | '' {
  if (v === true) return 'ok'
  if (v === false) return 'off'
  return ''
}

const parserPillState = computed(() => {
  const p = store.parserStatus
  if (!p.running) return 'off'
  if (p.paused) return 'warn'
  return 'ok'
})

const parserBadgeTitle = computed(() => {
  const p = store.parserStatus
  if (!p.running) return t('aiCfgParserNotRunning')
  if (p.paused) {
    return t('aiCfgParserPaused', { pending: p.pending, concurrency: p.concurrency })
  }
  return t('aiCfgParserRunning', { pending: p.pending, concurrency: p.concurrency })
})

function onToggleTheme() {
  aiTheme.toggleTheme()
}

function goBack() {
  router.push('/ai/agent')
}

// SP8-P5d Task 9 (reverse not delete, governance §15.1 ruling 3 / P5c §8.5) — top bar
// "Details" changed back to router-link (see template `.set-detail-link` above), this handler
// has zero call sites, deleted; original text kept as comment (same precedent as
// `knowledgeRoutes.ts` "reverse not delete"):
//   function onDetailsClick() {
//     toast.show(t('aiCfgKnowledgeSoon'))
//   }
// This key was deleted from zh_cn.ts / en_us.ts in P5e per governance §0.2 (ruling D-9)
// (zero production consumption; decision history stays in comment, comment not deleted).
// `DEFERRED_SECTIONS` placeholder mechanism itself unaffected, do not touch — it's in another
// branch in `onSelect()` (see below).

function onRefresh() {
  store.loadServicesStatus()
}

// Not from Vue2 blueprint — suppressSpy is pure-internal flag for suppressing
// IntersectionObserver highlight jitter during click-scroll (Vue2 `this._suppressSpy`),
// no reactivity needed, plain closure variable is enough.
let suppressSpy = false
let spyTimer: ReturnType<typeof setTimeout> | null = null
let statusPollTimer: ReturnType<typeof setInterval> | null = null
let io: IntersectionObserver | null = null
let visible: Record<string, number | null> = {}

/** Vue2 Settings.vue:199-208 — non-stack group releases suppress immediately; stack group releases after scrolling. */
function scrollToSection(id: SectionId) {
  const group = groupOf(id)
  if (!group.stack) {
    releaseSpy()
    return
  }
  const el = sectionEls[id]
  if (el && typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  releaseSpy()
}

/** Vue2 Settings.vue:209-213 — releases suppress only after smooth scroll ends (approx 650ms). */
function releaseSpy() {
  if (spyTimer) clearTimeout(spyTimer)
  spyTimer = setTimeout(() => {
    suppressSpy = false
  }, 650)
}

/** Vue2 Settings.vue:214-240 — IntersectionObserver scroll-spy. */
function setupSpy() {
  if (io) {
    io.disconnect()
    io = null
  }
  // jsdom lacks IntersectionObserver; Vue2 guards this too, silently skips (no error).
  if (typeof IntersectionObserver === 'undefined') return
  const root = bodyEl.value
  if (!root || !activeGroup.value.stack) return
  visible = {}
  io = new IntersectionObserver(
    (entries) => {
      if (suppressSpy) return
      for (const e of entries) {
        const sid = (e.target as Element).getAttribute('data-section-id')
        if (!sid) continue
        visible[sid] = e.isIntersecting ? e.boundingClientRect.top : null
      }
      // Highlight the topmost section among those currently in viewport upper band.
      let best: string | null = null
      let bestTop = Infinity
      for (const sid in visible) {
        const top = visible[sid]
        if (top == null) continue
        if (top < bestTop) {
          bestTop = top
          best = sid
        }
      }
      // Update highlight only, do not touch URL (Vue2 Settings.vue:234 explicitly comments this).
      if (best && best !== store.activeSection) {
        store.setActiveSection(best as SectionId)
      }
    },
    { root, rootMargin: '0px 0px -55% 0px', threshold: 0 },
  )
  const nodes = root.querySelectorAll('[data-section-id]')
  nodes.forEach((n) => io!.observe(n))
}

/** Vue2 Settings.vue:189-198 — click nav: switch section → suppress spy → sync URL → scroll. */
function onSelect(id: SectionId) {
  store.setActiveSection(id)
  // Not from Vue2 blueprint (see file header) — skills/mcp at this phase are placeholders,
  // pop a toast to tell user the section is not yet available.
  if (DEFERRED_SECTIONS.includes(id)) {
    toast.show(t('aiCfgSectionDeferred'), 3000)
  }
  suppressSpy = true
  if (route.query.section !== id) {
    router.replace({ path: '/ai/settings', query: { section: id } })
  }
  nextTick(() => scrollToSection(id))
}

function isValidSection(v: unknown): v is SectionId {
  return typeof v === 'string' && (VALID_SECTIONS as string[]).includes(v)
}

// Vue2 Settings.vue:142-147 — adopt when `?section=` changes (e.g., browser forward/back).
watch(
  () => route.query.section,
  (v) => {
    if (isValidSection(v)) {
      store.setActiveSection(v)
      nextTick(() => scrollToSection(v))
    }
  },
)

// Vue2 Settings.vue:148-152 — visible group changed (anchor set changed), reinstall observer.
watch(
  () => activeGroup.value.id,
  () => {
    nextTick(() => setupSpy())
  },
)

onMounted(async () => {
  // SP8-P2b acceptance round 3 (2026-07-30): register "AI section in foreground".
  // App-level `AppToast` uses this to switch to AI's toast colors — otherwise it uses
  // global blue-black theme's semi-transparent white background + white text, invisible on
  // this page's light background (all toast feedback on this page unreachable). Root cause:
  // see aiSurfaces comment in stores/aiTheme.ts.
  aiTheme.enterAiSurface()
  // Not part of brief step-by-step, self-supplemented (1:1 fidelity needed) —
  // Vue2 `Settings.vue:102-107` independently reads localStorage/matchMedia in data()
  // to init theme, independent of whether Agent.vue is mounted. After moving theme
  // state to app-level singleton `useAiTheme`, if only AgentPage's `initTheme()`
  // (actually `aiTheme.hydrateTheme()`, see agentStore.ts:316-318) reads persisted
  // preference once, entering directly from `/ai/settings` (without visiting `/ai/agent`
  // first) stays stuck at store default 'light', ignoring user's saved preference or
  // system dark mode — pure 1:1 visual regression from singleton, not brief edge case.
  // `hydrateTheme()` itself is idempotent (can call repeatedly, see aiTheme.ts header
  // comment), two pages calling it independently have no conflict.
  aiTheme.hydrateTheme()

  // D2 — must reset transient UI first, then read `?section=`, order cannot reverse (brief use case 13).
  store.resetTransientUi()

  const qSection = route.query.section
  if (isValidSection(qSection)) {
    store.setActiveSection(qSection)
  }

  // Vue2 Settings.vue:154-158 — four loads each try/catch swallow errors independently.
  try {
    await store.loadServicesStatus()
  } catch {
    /* ignore */
  }
  try {
    await store.loadModels()
  } catch {
    /* ignore */
  }
  try {
    await store.loadProviders()
  } catch {
    /* ignore */
  }
  try {
    await store.loadPolicy()
  } catch {
    /* ignore */
  }

  // SP8-P2a D3 — verbatim port from Vue2 `Settings.vue:159-163`, includes `!job._timer` guard.
  //
  // 【Report: same code executes for the first time in this repo】Vue2's
  // `createSettingsStore()` creates new state on each mount, `hfImportJobs` always {},
  // so this loop never runs once in Vue2 — effect: leaving settings page kills progress,
  // background setInterval still holds discarded store closure (leak). This repo's store
  // is Pinia singleton; jobs and timers stay; loop has meaning first time: returning to
  // page shows progress continuing.
  //
  // This is "better behavior after port", not a bug fix. `&& !job._timer` guard must
  // stay: it prevents starting a second timer for the same file.
  for (const [filename, job] of Object.entries(store.hfImportJobs)) {
    if ((job.status === 'downloading' || job.status === 'creating model') && !job._timer) {
      store.startImportJob(job.repo, filename)
    }
  }

  statusPollTimer = setInterval(() => {
    store.loadServicesStatus()
  }, 15000)

  nextTick(() => {
    setupSpy()
    // Deep link `?section=` scroll after mount once (Vue2 Settings.vue:169-172).
    const s = store.activeSection
    if (activeGroup.value.stack) scrollToSection(s)
  })
})

onUnmounted(() => {
  // SP8-P2b acceptance round 3: unregister "AI section in foreground", let app-level toast
  // return to global theme (zero desktop impact).
  aiTheme.leaveAiSurface()
  if (statusPollTimer) clearInterval(statusPollTimer)
  if (io) {
    io.disconnect()
    io = null
  }
  if (spyTimer) clearTimeout(spyTimer)
})
</script>

<template>
  <div class="agent-app set-app" :data-theme="aiTheme.theme">
    <SettingsRail
      :active-id="store.activeSection"
      :model-count="store.installedModels.length"
      @back="goBack"
      @select="onSelect"
    />

    <main class="set-main">
      <header class="set-topbar">
        <span class="tt">{{ groupTitle }}</span>
        <div class="set-status">
          <span class="set-pill" :data-s="pillState(store.servicesStatus.ollama)"
            ><span class="d" />Ollama</span
          >
          <span class="set-pill" :data-s="pillState(store.servicesStatus.openvino)"
            ><span class="d" />OpenVINO</span
          >
          <span class="set-pill" :data-s="pillState(store.servicesStatus.agent)"
            ><span class="d" />Agent</span
          >
          <span class="set-pill" :data-s="pillState(store.searchStatus.running)"
            ><span class="d" />Search</span
          >
          <span class="set-pill" :data-s="parserPillState" :title="parserBadgeTitle">
            <span class="d" />Parser
            <span v-if="store.parserStatus.pending > 0" class="badge-count">{{
              store.parserStatus.pending
            }}</span>
            <span v-if="store.parserStatus.paused" class="badge-pause">⏸</span>
          </span>
        </div>
        <!-- SP8-P5d Task 9 reverse (not delete, governance §15.1 / P5c §8.5): `/ai/knowledge`
             shell was already built by SP8-P5a, P5a/P5b/P5c all missed restoring this
             entry; this commit reverts to blueprint original router-link — `.set-detail-link`
             class name and visuals unchanged (settings-styles.scss already has
             text-decoration: none). Before: `<button class="set-detail-link" @click="onDetailsClick">`,
             `onDetailsClick` original text at script block same-name comment below (reverse not delete). -->
        <router-link class="set-detail-link" to="/ai/knowledge">
          {{ t('aiCfgDetails') }} <AgentIcon name="chev" :size="12" />
        </router-link>
        <button class="set-ibtn" :title="t('aiCfgRefresh')" @click="onRefresh">
          <AgentIcon name="refresh" :size="16" />
        </button>
        <button class="set-ibtn" :title="t('aiCfgToggleTheme')" @click="onToggleTheme">
          <AgentIcon :name="aiTheme.theme === 'dark' ? 'sun' : 'moon'" :size="16" />
        </button>
      </header>

      <div ref="bodyEl" class="set-body" :class="{ 'set-body-split': isSplitSection }">
        <!-- Stacked group: every section rendered top-to-bottom, rail navigates
             by scrolling; scroll position drives the rail highlight. -->
        <template v-if="activeGroup.stack">
          <section
            v-for="item in activeGroup.items"
            :key="item.id"
            class="set-stack-item"
            :data-section-id="item.id"
            :ref="(el) => setSectionEl(item.id, el as Element | null)"
          >
            <component :is="SECTION_COMPONENTS[item.id]" v-bind="placeholderProps(item.id)" />
          </section>
        </template>
        <!-- Swap group: one section at a time (Skills / MCP split panes, tokens,
             channels) — these full-height layouts cannot be stacked. -->
        <component
          v-else
          :is="SECTION_COMPONENTS[store.activeSection]"
          v-bind="placeholderProps(store.activeSection)"
        />
      </div>
    </main>
  </div>
</template>
