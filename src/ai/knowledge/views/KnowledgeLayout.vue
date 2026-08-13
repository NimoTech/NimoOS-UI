<!--
  SP8-P5a Task 10 — Knowledge base section shell, 1:1 port from Vue2 blueprint
  `NimoOS-UI` (main@7a6ee6b7) `src/views/AI/Knowledge/KnowledgeLayout.vue` (210
  lines, read via `git show main:`, governance file §1: worktree is old branch, not
  trustworthy).

  Structure mapping (blueprint line → this file; review corrected 2026-08-01,
  original comment line numbers systematically off by 5-6 lines, below each
  verified against `git show main:`):
    :2-47    .knowledge-app > aside.k-rail (head/section/nav 9 items/status
             block/foot)
    :50-72   .k-main (topbar/banner/router-view)
    :74-90   .k-mobile-tabs (first 4 items + More)
    :92-96   .k-toast — not ported (K3), toast() uses global useToast().show()
    :104-114 NAV / :116-126 TITLES — two constants copied exactly
    :140-151 currentTab if/endsWith asymmetry — copied as-is (blueprint is
             asymmetric)
    :176-181 userName — blueprint reads Vuex, this repo has no Vuex, changed to
             K8 established pattern (exactly reused from
             src/ai/components/settings/SettingsRail.vue:75-86)
    :183-190 created()/beforeDestroy() 10s polling — moved to onMounted/onUnmounted
    :196-199 navigate() / :200-203 onRefresh() — unchanged

  i18n key name adaptation (pure mechanical, no behavior change): blueprint
  `$t(n.en)` / `$t(titleKey)` takes English phrases literally as keys (Vue2
  language pack uses phrases as keys). This repo uses `aiKb*` prefix for all new
  keys (appendix A), so each NAV item and TITLES item has an additional `*Key`
  field pointing to the corresponding aiKb key, translation result matches blueprint
  exactly (see annotations next to NAV/TITLES constants below).

  [N8 copied unchanged] rail item 9 label uses aiKbNavSettings (“System Settings”),
  topbar title uses aiKbTitleAdvancedSettings (“Advanced Settings”) — same page two
  different phrasings, blueprint is like this.

  [K2] Root node class only knowledge-app, no data-theme — .knowledge-app follows
  global <html> data-theme (knowledge.scss already uses :root[data-theme=”light”]
  .knowledge-app selector to handle light mode), unlike .agent-app which maintains
  container state itself.

  No <style> block: knowledge.scss imported by this file on JS side in <script setup>
  (following existing precedent in src/ai/views/AgentPage.vue:71-72), this is the
  first place in the repo to import it — KnowledgeDeferred.vue (T5) intentionally
  did not import it, left for this task.
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import KIcon from '../components/KIcon.vue'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import type { KnowledgeTabId } from '../deferred'
import '../../styles/knowledge.scss'

interface NavItem {
  id: KnowledgeTabId
  en: string
  icon: string
  /** aiKb* key, translation result = blueprint `$t(n.en)` result (K1 same-class
   * mechanical rename, not behavior change). */
  labelKey: string
}

/** Blueprint :104-114, copied exactly (order is rail order, also basis for
 * mobile tabs `slice(0, 4)`). */
const NAV: NavItem[] = [
  { id: 'dashboard', en: 'Dashboard', icon: 'home', labelKey: 'aiKbNavDashboard' },
  { id: 'search', en: 'Search', icon: 'search', labelKey: 'aiKbNavSearch' },
  { id: 'wiki', en: 'Wiki', icon: 'layers', labelKey: 'aiKbNavWiki' },
  { id: 'notes', en: 'Notes', icon: 'edit', labelKey: 'aiKbNavNotes' },
  { id: 'indexed-files', en: 'Indexed Files', icon: 'file', labelKey: 'aiKbNavIndexedFiles' },
  { id: 'queue', en: 'Queue', icon: 'history', labelKey: 'aiKbNavQueue' },
  { id: 'roots', en: 'Index Roots', icon: 'drive', labelKey: 'aiKbNavRoots' },
  { id: 'allowlist', en: 'Allowlist', icon: 'folder', labelKey: 'aiKbNavAllowlist' },
  { id: 'settings', en: 'Settings', icon: 'settings', labelKey: 'aiKbNavSettings' },
]

interface TitleEntry {
  /** topbar subtitle literal English (not translated, blueprint
   * `{{ titles[currentTab].en }}`). */
  en: string
  /** topbar title's aiKb key. Most tabs have the same key as that tab's NAV
   * labelKey (blueprint calls $t once on the same English phrase, translation
   * results naturally identical); wiki/queue/settings three tabs use different
   * English phrases in blueprint ('Wiki map'/'Job Queue'/'Advanced Settings'),
   * corresponding to three keys in appendix A: aiKbTitleWikiMap/aiKbTitleJobQueue/
   * aiKbTitleAdvancedSettings — this is where N8 lands (settings titleKey differs
   * from labelKey). */
  titleKey: string
}

/** Blueprint :116-126, copied exactly (en field copies literal English, titleKey
 * converts to aiKb key per comment above). */
const TITLES: Record<KnowledgeTabId, TitleEntry> = {
  dashboard: { en: 'Dashboard', titleKey: 'aiKbNavDashboard' },
  search: { en: 'Search', titleKey: 'aiKbNavSearch' },
  wiki: { en: 'Wiki', titleKey: 'aiKbTitleWikiMap' },
  'indexed-files': { en: 'Indexed Files', titleKey: 'aiKbNavIndexedFiles' },
  queue: { en: 'Job Queue', titleKey: 'aiKbTitleJobQueue' },
  roots: { en: 'Index Roots', titleKey: 'aiKbNavRoots' },
  allowlist: { en: 'Allowlist', titleKey: 'aiKbNavAllowlist' },
  notes: { en: 'Notes', titleKey: 'aiKbNavNotes' },
  settings: { en: 'Advanced Settings', titleKey: 'aiKbTitleAdvancedSettings' },
}

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const store = useKnowledgeStore()

/** Blueprint :140-151 — if/endsWith asymmetry, copy this asymmetry (notes uses
 * `.includes`, rest use `.endsWith`; blueprint is like this, not doing
 * "unify to one code style" opportunistic refactor). */
const currentTab = computed<KnowledgeTabId>(() => {
  const p = route.path
  if (p.includes('/knowledge/notes')) return 'notes'
  if (p.endsWith('/wiki')) return 'wiki'
  if (p.endsWith('/search')) return 'search'
  if (p.endsWith('/indexed-files')) return 'indexed-files'
  if (p.endsWith('/queue')) return 'queue'
  if (p.endsWith('/roots')) return 'roots'
  if (p.endsWith('/allowlist')) return 'allowlist'
  if (p.endsWith('/settings')) return 'settings'
  return 'dashboard'
})

/** Blueprint :152-154. */
const currentNav = computed<NavItem>(() => NAV.find((n) => n.id === currentTab.value) || NAV[0])

/** Blueprint :155-159. */
const svcState = computed<'error' | 'paused' | 'running'>(() => {
  if (store.unreachable) return 'error'
  if (store.controlState.paused) return 'paused'
  return 'running'
})

/** Blueprint :160-165. */
const svcMeta = computed<string>(() => {
  if (store.unreachable) return t('aiKbOffline')
  if (store.controlState.paused) return t('aiKbPaused')
  return t('aiKbRunningIndexed', { n: store.stats.indexed_files.toLocaleString() })
})

interface Badge {
  kind: 'number' | 'dot'
  value?: number
  tone?: string
}

/** Blueprint :166-175 — `allowlist`/`settings` always null (blueprint line :172
 * `this.store.state.folderRules.length > 0 ? null : null` both branches return
 * same, is blueprint dead code not reproducible wrong behavior, copy as-is do not
 * "incidentally clean up"). */
const badges = computed<Partial<Record<KnowledgeTabId, Badge | null>>>(() => {
  const failed = store.stats.queue_depth.failed
  const drafts = store.notesDraftCount
  return {
    queue: failed > 0 ? { kind: 'number', value: failed } : null,
    notes: drafts > 0 ? { kind: 'number', value: drafts, tone: 'warn' } : null,
    allowlist: store.folderRules.length > 0 ? null : null,
    settings: null,
  }
})

interface StoredUser {
  nickname?: string
  username?: string
  role?: string
}

/** K8 — blueprint :176-181 reads Vuex `$store.state.user.user_name`, this repo
 * has no Vuex. Exactly reuse established pattern from SettingsRail.vue:75-86:
 * localStorage 'user' key + try/catch guard to {} + nickname takes precedence over
 * username, finally falls back to aiCfgYou (reuse existing key, no new key). */
const storedUser = computed<StoredUser>(() => {
  try {
    const raw = localStorage.getItem('user')
    return raw ? (JSON.parse(raw) as StoredUser) : {}
  } catch {
    return {}
  }
})
const userLabel = computed<string>(
  () => storedUser.value.nickname || storedUser.value.username || t('aiCfgYou'),
)

/** Blueprint :196-199. */
function navigate(id: KnowledgeTabId): void {
  const path = id === 'dashboard' ? '/ai/knowledge' : `/ai/knowledge/${id}`
  if (route.path !== path) router.push(path)
}

/** Blueprint :200-203. */
async function onRefresh(): Promise<void> {
  await store.loadOverview()
  store.toast(t('aiKbRefreshed'))
}

/** Blueprint :183-190 — created()/pollTimer moved to onMounted, handle uses
 * component local variable (not stored in store, pure UI lifecycle state). */
let pollTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  store.loadOverview()
  store.refreshNotesDraftCount()
  pollTimer = setInterval(() => {
    if (document.hidden) return
    store.loadOverview()
  }, 10000)
})

/** Blueprint :192-194 beforeDestroy(). */
onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<template>
  <div class="knowledge-app">
    <!-- Left rail -->
    <aside class="k-rail">
      <div class="k-rail-head">
        <div style="flex: 1; min-width: 0">
          <div class="k-rail-title">{{ t('aiKbKnowledgeBase') }}</div>
          <div class="k-rail-sub">RAG · NimoOS</div>
        </div>
      </div>

      <div class="k-rail-section">{{ t('aiKbBrowse') }}</div>
      <nav class="k-rail-nav">
        <a
          v-for="n in NAV"
          :key="n.id"
          class="k-rail-item"
          :data-active="String(currentTab === n.id)"
          :href="`#${n.id === 'dashboard' ? '/ai/knowledge' : '/ai/knowledge/' + n.id}`"
          @click.prevent="navigate(n.id)"
        >
          <KIcon :name="n.icon" :size="15" />
          <div class="k-rail-item-label">
            <span class="k-rail-item-cn">{{ t(n.labelKey) }}</span>
            <span class="k-rail-item-en">{{ n.en }}</span>
          </div>
          <span
            v-if="badges[n.id] && badges[n.id]!.kind === 'number'"
            class="k-badge"
            :data-tone="badges[n.id]!.tone"
          >{{ badges[n.id]!.value }}</span>
          <span
            v-else-if="badges[n.id] && badges[n.id]!.kind === 'dot'"
            class="k-badge-dot"
            :data-tone="badges[n.id]!.tone"
          />
        </a>
      </nav>

      <div class="k-rail-section" style="margin-top: 8px">{{ t('aiKbStatus') }}</div>
      <div class="k-rail-svc">
        <div class="k-rail-svc-row">
          <span class="k-rail-svc-dot" :data-state="svcState" />
          <div class="k-rail-svc-name">{{ t('aiKbIndexer') }}</div>
        </div>
        <div class="k-rail-svc-meta">{{ svcMeta }}</div>
        <div class="k-rail-svc-meta" style="display: flex; align-items: center; gap: 6px">
          <KIcon name="clock" :size="11" /> {{ t('aiKbLastSynced') }} {{ store.lastSyncFmt }}
        </div>
      </div>

      <div class="k-rail-foot">
        <KIcon name="user" :size="13" />
        <span>NimoOS · {{ userLabel }}</span>
      </div>
    </aside>

    <!-- Main pane -->
    <div class="k-main">
      <header class="k-topbar">
        <KIcon :name="currentNav.icon" :size="18" color="var(--accent)" />
        <div>
          <div class="k-topbar-title">{{ t(TITLES[currentTab].titleKey) }}</div>
          <div class="k-topbar-sub">
            {{ TITLES[currentTab].en }} · /ai/knowledge{{ currentTab === 'dashboard' ? '' : '/' + currentTab }}
          </div>
        </div>
        <div class="k-topbar-spacer" />
        <button class="k-btn ghost" :title="t('aiKbRefresh')" @click="onRefresh">
          <KIcon name="refresh" :size="14" />
        </button>
      </header>

      <!-- Banner: service unreachable -->
      <div v-if="store.unreachable" class="k-banner" data-tone="warn">
        <span class="k-banner-icon"><KIcon name="info" :size="13" /></span>
        <span>{{ t('aiKbServiceOfflineBanner') }}</span>
      </div>

      <router-view />
    </div>

    <!-- Mobile tabs -->
    <nav class="k-mobile-tabs">
      <button
        v-for="n in NAV.slice(0, 4)"
        :key="n.id"
        class="k-mobile-tab"
        :data-active="String(currentTab === n.id)"
        @click="navigate(n.id)"
      >
        <KIcon :name="n.icon" :size="18" />
        <span>{{ t(n.labelKey) }}</span>
        <span v-if="badges[n.id] && badges[n.id]!.kind === 'number'" class="k-badge">{{ badges[n.id]!.value }}</span>
      </button>
      <button
        class="k-mobile-tab"
        :data-active="String(['indexed-files', 'queue', 'roots', 'allowlist', 'settings'].includes(currentTab))"
        @click="navigate('allowlist')"
      >
        <KIcon name="grid" :size="18" />
        <span>{{ t('aiKbMore') }}</span>
      </button>
    </nav>

    <!-- Toast: retired (K3) — global useToast() renders it via AppToast, not here. -->
  </div>
</template>
