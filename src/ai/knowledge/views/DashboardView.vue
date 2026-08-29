<!--
  SP8-P5a Task 12 — Knowledge dashboard, 1:1 port from the Vue 2 panel's blueprint
  `src/views/AI/Knowledge/DashboardView.vue` (main@7a6ee6b7, 371 lines,
  read via `git show main:`, governance file §1: worktree is old branch, not
  trustworthy).

  Structure mapping (blueprint line → this file):
    :4-39    Empty state onboarding (orb + title + copy + two CTA buttons + three
             intro cards + "Go deeper" entry grid of 4 items)
    :42-136  Surface A "What's inside" three-layer cards (wiki/vec/note) + glue
             line (three id labels, each with inline `--g` color pass-down)
    :138-178 Surface B "How it's organized" knowledge roots overview (enabled root
             cards + add root + disabled roots notice)
    :180-245 Surface C "What's happening now" parse progress + throttle level +
             queue health + auto-distill
    :247-263 Surface D "Go deeper" entry grid (7 items, non-empty state)
    :269-371 script: SAMPLE_QUERIES / LAYER_INTROS / CC_LEVELS three constants +
             computed getters + onMounted lifecycle + methods

  i18n key name adaptation (pure mechanical, no behavior change, same technique as
  T10): blueprint uses `$t(literal)` taking English phrases literally as keys;
  this repo changes to constant arrays holding `aiKb*` key names, with `t(key)` in
  templates.
  `*-en` literal English subtitles (`k2-sec-en` / `k2-layer-name-en` / `k2-tag` /
  entry's `en` field) **are not translated** — same precedent as T10
  KnowledgeLayout.vue's `TITLES[...].en` (the blueprint itself uses bilingual design
  of "Chinese translation + fixed English subtitle", not an omission).

  [Handoff item 1] `.k2-cc` down-state selector is `[data-on="true"]` (string), wrap
  with `String(...)`, otherwise Vue will delete the attribute entirely for `false`.
  [Handoff item 2] `.k2-glue-id i` dot color comes from template inline
  `style="--g: var(--ly-*)"` pass-down, three lines each with their own color, copied
  exactly.
  [Handoff item 3] `k2-layer-num`'s `second`/`suffix`, `k2-live-ico`'s `spin`,
  `k2-drafts` are all child-element classes, not parent attributes.
  [N2, copied unchanged] `stats.rate_per_min` / `done_last_10m` / `eta_s` are not
  actually returned by backend (knowledgeStore.ts `ParserStats` type does not declare
  these three fields; `DashboardStats` locally narrows the type read-only here,
  does not change knowledgeStore.ts back — that's T6/T7 scope, already submitted).
  After `|| 0` / `fmtEta` null-guarding, rate / ETA / 10-minute-done count are always
  0 and empty string — this is the current backend state, not a frontend bug;
  acceptance has another line item for it.
  [N3, copied unchanged, user explicitly stated 2026-07-31 not to modify]
  `onMounted()` `Promise.all([...]).finally(ready=true)`: `Promise.all` is
  **fail-fast** — any input rejection causes the combined promise to reject
  immediately (does not wait for remaining inputs to settle), so `.finally` fires
  immediately and `ready` is set right away; `Promise.allSettled` is the opposite,
  must wait for all inputs to settle (success or failure) before resolving. The
  cost: if Wiki backend (38GB SQLite) hangs, `loadRoots()` blocks on axios 60s
  timeout — as long as it finally settles (success or failure), `Promise.all`
  settles with it, and the page skeleton gets stuck at that moment. Do not change
  to `allSettled` (then if a loader truly hangs, the skeleton never loads), do not
  add separate timeout to `loadRoots`. The distinguishable nail for fail-fast
  behavior is in `DashboardView.test.ts` "N3 nail" test case.

  [Finding, not a defect] `updatePeak` exported from `dashboardHelpers.ts` is
  dead code in the Vue2 blueprint already — `git grep updatePeak main --
  src/views/AI/Knowledge` shows it is only referenced by its own test file,
  neither `knowledgeStore.js:84` (loadOverview) nor this file's `percent`
  calculation calls it, `backlogPeak` is entirely maintained by the store's inline
  `Math.max(...)` (T6 already 1:1 copied this inline, knowledgeStore.ts:317).
  This file therefore does not directly call `updatePeak`, only reads
  `store.backlogPeak` and feeds it to `progressPercent` — this is blueprint
  behavior, not an omission.
-->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import KIcon from '../components/KIcon.vue'
import { useKnowledgeStore, fmtAgo } from '../stores/knowledgeStore'
import type { ParserStats } from '../stores/knowledgeStore'
import { progressPercent, fmtEta } from '../util/dashboardHelpers'

const { t } = useI18n()
const router = useRouter()
const store = useKnowledgeStore()

/** Blueprint :274 SAMPLE_QUERIES — literal search terms replaced with
 * corresponding aiKb keys (appendix A for exact match). */
const SAMPLE_QUERIES: string[] = [
  'aiKbSampleThyroid',
  'aiKbSamplePythonAsync',
  'aiKbSampleContract',
  'aiKbSampleIphone',
  'aiKbSampleSkating',
]

/** Blueprint :278-285 LAYER_INTROS — `name`/`desc` replaced with
 * corresponding aiKb keys; `tag` is the fixed English short label in `k2-tag`
 * (TREE/SEMANTIC/BACKLINKS), blueprint itself does not use $t, copied unchanged
 * (same rule as `*-en`). */
interface LayerIntro {
  id: 'wiki' | 'vec' | 'note'
  tag: string
  nameKey: string
  descKey: string
}
const LAYER_INTROS: LayerIntro[] = [
  { id: 'wiki', tag: 'TREE', nameKey: 'aiKbWikiMap', descKey: 'aiKbLayerWikiDesc' },
  { id: 'vec', tag: 'SEMANTIC', nameKey: 'aiKbSemanticVectors', descKey: 'aiKbLayerVecDesc' },
  { id: 'note', tag: 'BACKLINKS', nameKey: 'aiKbDistilledNotes', descKey: 'aiKbLayerNoteDesc' },
]

/** Blueprint :287-291 CC_LEVELS — `key` replaced with corresponding aiKb keys. */
interface CcLevel {
  n: number
  key: string
}
const CC_LEVELS: CcLevel[] = [
  { n: 1, key: 'aiKbCcPowerSaver' },
  { n: 2, key: 'aiKbCcBalanced' },
  { n: 4, key: 'aiKbCcFullSpeed' },
]

interface EntryItem {
  id: string
  en: string
  key: string
  icon: string
  tone?: string
  disabled?: boolean
  badge?: number
  badgeTone?: string
}

/** N2 — see file header comment: local type narrowing, reads three optional
 * fields that backend testing shows are not actually returned, does not change
 * knowledgeStore.ts back. */
interface DashboardStats extends ParserStats {
  rate_per_min?: number
  done_last_10m?: number
  eta_s?: number
}

const query = ref('')
const ready = ref(false)
const hero = ref<HTMLInputElement | null>(null)

const stats = computed<DashboardStats>(() => store.stats)
/** [Review Minor M-1, additional disclosure] Blueprint :308 is
 * `this.stats.queue_depth || {}` — fall back to empty object, relies on each
 * downstream read point doing its own `.pending || 0` defense. This repo's
 * `QueueDepth` has four fields `pending`/`running`/`failed`/`done` all required
 * (non-optional) in `knowledgeStore.ts`, `|| {}` does not satisfy type `QueueDepth`
 * under strict mode, so changed to fall back to an all-zero-shaped object. Each
 * downstream read point still wraps itself with `|| 0` (matches blueprint), both
 * code forms are behaviorally equivalent under any input, pure mechanical rewrite
 * under TS type constraints, does not change any observable behavior. */
const queueDepth = computed(() => stats.value.queue_depth || { pending: 0, running: 0, failed: 0, done: 0 })
const failed = computed(() => queueDepth.value.failed || 0)
const backlog = computed(() => (queueDepth.value.pending || 0) + (queueDepth.value.running || 0))
/** N2 — backend does not return, always 0. */
const rate = computed(() => stats.value.rate_per_min || 0)
/** N2 — backend does not return, always 0. */
const done10m = computed(() => stats.value.done_last_10m || 0)
/** N2 — backend does not return, after `fmtEta` null-guard always empty string. */
const etaText = computed(() => fmtEta(stats.value.eta_s))
const percent = computed(() => progressPercent(backlog.value, store.backlogPeak))
const vectorsText = computed(() => stats.value.total_vectors_text || 0)
const vectorsVisual = computed(() => stats.value.total_vectors_visual || 0)
const notesSummary = computed(() => store.notesSummary)
const enabledRoots = computed(() => store.wikiRoots.filter((r) => r.enabled))
const disabledRoots = computed(() => store.wikiRoots.filter((r) => !r.enabled))
const autoRootCount = computed(() => enabledRoots.value.filter((r) => r.watchMode === 'auto').length)
const scanRootCount = computed(() => enabledRoots.value.length - autoRootCount.value)
const loading = computed(() => !ready.value)
const isEmpty = computed(
  () =>
    ready.value &&
    store.overviewLoaded &&
    store.wikiRoots.length === 0 &&
    (stats.value.indexed_files || 0) === 0,
)

/** Blueprint :328-338 entries(). */
const entries = computed<EntryItem[]>(() => [
  { id: 'search', en: 'Search', key: 'aiKbSearch', icon: 'search', tone: 'accent' },
  { id: 'wiki', en: 'Wiki', key: 'aiKbWikiMap', icon: 'layers', tone: 'wiki' },
  { id: 'indexed-files', en: 'Indexed Files', key: 'aiKbNavIndexedFiles', icon: 'file', tone: 'vec' },
  {
    id: 'notes',
    en: 'Notes',
    key: 'aiKbNavNotes',
    icon: 'edit',
    tone: 'note',
    badge: notesSummary.value.draft,
    badgeTone: 'note',
  },
  { id: 'roots', en: 'Roots', key: 'aiKbNavRoots', icon: 'drive', tone: 'wiki' },
  { id: 'queue', en: 'Queue', key: 'aiKbNavQueue', icon: 'history', badge: failed.value },
  { id: 'settings', en: 'Settings', key: 'aiKbTitleAdvancedSettings', icon: 'settings' },
])

/** Blueprint :339-346 emptyEntries(). */
const emptyEntries = computed<EntryItem[]>(() => [
  { id: 'search', en: 'Search', key: 'aiKbSearch', icon: 'search', tone: 'accent', disabled: true },
  { id: 'roots', en: 'Roots', key: 'aiKbNavRoots', icon: 'drive', tone: 'wiki' },
  { id: 'allowlist', en: 'Allowlist', key: 'aiKbNavAllowlist', icon: 'folder' },
  { id: 'settings', en: 'Settings', key: 'aiKbTitleAdvancedSettings', icon: 'settings' },
])

function fmtNum(n: number | undefined): string {
  return (n || 0).toLocaleString()
}

function submit(): void {
  if (!query.value.trim()) return
  goSearch(query.value.trim())
}

function goSearch(q: string): void {
  router.push({ path: '/ai/knowledge/search', query: { q } })
}

function goQueueFailed(): void {
  router.push({ path: '/ai/knowledge/queue', query: { filter: 'failed' } })
}

function go(id: string): void {
  router.push(id === 'dashboard' ? '/ai/knowledge' : `/ai/knowledge/${id}`)
}

/** Blueprint :348-352 created() — N3, see file header comment, copied
 * unchanged.
 *
 * [Deviation, acceptance feedback fix, 2026-08-01] Only change: `loadRoots`
 * receives `silent: true`. This is background loading not a user-initiated
 * action, when Wiki API hangs should not pop "operation failed" after 60s
 * (most likely already popped on another page) — dashboard page can express this
 * failure with "0 knowledge roots". Full reasoning in `knowledgeStore.ts`
 * `loadRoots` comment. */
onMounted(() => {
  Promise.all([
    store.loadOverview(),
    store.loadRoots({ silent: true }),
    store.loadNotesSummary(),
  ]).finally(() => {
    ready.value = true
  })
})
</script>

<template>
  <div class="k-scroll">
    <div class="k-scroll-inner">
      <!-- ============ Empty state (fresh install: 0 roots, 0 docs) ============ -->
      <template v-if="isEmpty">
        <div class="k2-onboard">
          <div class="k2-onboard-orb"><KIcon name="layers" :size="26" /></div>
          <h2>{{ t('aiKbOnboardTitle') }}</h2>
          <p>{{ t('aiKbOnboardBody') }}</p>
          <div class="k2-onboard-cta">
            <button class="k-btn primary" @click="go('roots')">
              <KIcon name="plus" :size="13" /> {{ t('aiKbAddRoot') }}
            </button>
            <button class="k-btn outline" @click="go('allowlist')">{{ t('aiKbCheckScopeFirst') }}</button>
          </div>
          <div class="k2-onboard-layers">
            <div v-for="l in LAYER_INTROS" :key="l.id" class="k2-ob-layer" :data-layer="l.id">
              <span class="k2-tag">{{ l.tag }}</span>
              <div class="k2-ob-name">{{ t(l.nameKey) }}</div>
              <div class="k2-ob-desc">{{ t(l.descKey) }}</div>
            </div>
          </div>
        </div>

        <div class="k2-sec-head">
          <span class="k2-sec-title">{{ t('aiKbGoDeeper') }}</span>
          <span class="k2-sec-en">Go to</span>
        </div>
        <div class="k2-entries">
          <button
            v-for="e in emptyEntries"
            :key="e.en"
            class="k2-entry"
            :data-disabled="String(!!e.disabled)"
            @click="!e.disabled && go(e.id)"
          >
            <span class="k2-entry-ico" :data-tone="e.tone"><KIcon :name="e.icon" :size="15" /></span>
            <span style="min-width: 0">
              <span class="k2-entry-cn">{{ t(e.key) }}</span
              ><br />
              <span class="k2-entry-en">{{ e.en }}</span>
            </span>
          </button>
        </div>
      </template>

      <!-- ============ Normal / loading ============ -->
      <template v-else>
        <!-- Search (surface D, upfront) -->
        <div class="k2-search">
          <KIcon name="search" :size="17" color="var(--text-tertiary)" />
          <input
            ref="hero"
            type="text"
            :placeholder="t('aiKbSearchPlaceholder')"
            v-model="query"
            @keydown.enter="submit"
            autofocus
          />
          <span class="k2-search-dots" :title="t('aiKbThreeLayersTip')"><i /><i /><i /></span>
          <button class="k-btn primary" :disabled="!query.trim()" @click="submit">
            {{ t('aiKbSearch') }} <KIcon name="arrowRight" :size="12" />
          </button>
        </div>
        <div class="k2-suggest">
          <span class="k2-suggest-label">{{ t('aiKbTry') }}</span>
          <button v-for="q in SAMPLE_QUERIES" :key="q" class="k-suggest-chip" @click="goSearch(t(q))">
            {{ t(q) }}
          </button>
        </div>

        <!-- Surface A — what's inside (three layers) -->
        <div class="k2-sec-head">
          <span class="k2-sec-title">{{ t('aiKbWhatsInside') }}</span>
          <span class="k2-sec-en">What's inside</span>
        </div>
        <div v-if="loading" class="k2-layers">
          <div v-for="i in 3" :key="i" class="k2-skel-card">
            <span class="k-skel" style="display: block; height: 14px; width: 55%" />
            <span class="k-skel" style="display: block; height: 24px; width: 40%" />
            <span class="k-skel" style="display: block; height: 11px; width: 80%" />
          </div>
        </div>
        <template v-else>
          <div class="k2-layers">
            <!-- Wiki layer -->
            <button class="k2-layer" data-layer="wiki" @click="go('wiki')">
              <div class="k2-layer-top">
                <span class="k2-tag">TREE</span>
                <span class="k2-layer-name"
                  >{{ t('aiKbWikiMap') }} <span class="k2-layer-name-en">· Wiki</span></span
                >
                <span class="k2-layer-chev"><KIcon name="chev" :size="13" /></span>
              </div>
              <div class="k2-layer-num">
                {{ enabledRoots.length }}<span class="suffix">{{ t('aiKbKnowledgeRootsSuffix') }}</span>
              </div>
              <div v-if="enabledRoots.length" class="k2-layer-bar">
                <i :style="{ flex: autoRootCount, opacity: 1 }" />
                <i :style="{ flex: Math.max(scanRootCount, 0.001), opacity: 0.35 }" />
              </div>
              <div class="k2-layer-sub">
                {{ t('aiKbWatchSplit', { a: autoRootCount, b: scanRootCount }) }}
              </div>
              <div class="k2-layer-desc">{{ t(LAYER_INTROS[0].descKey) }}</div>
            </button>
            <!-- Vector layer -->
            <button class="k2-layer" data-layer="vec" @click="go('indexed-files')">
              <div class="k2-layer-top">
                <span class="k2-tag">SEMANTIC</span>
                <span class="k2-layer-name"
                  >{{ t('aiKbSemanticVectors') }} <span class="k2-layer-name-en">· Vectors</span></span
                >
                <span class="k2-layer-chev"><KIcon name="chev" :size="13" /></span>
              </div>
              <div class="k2-layer-num">
                {{ fmtNum(stats.indexed_files) }}<span class="suffix">{{ t('aiKbDocumentsSuffix') }}</span>
                <span class="second">{{ t('aiKbVectorChunks', { n: fmtNum(vectorsText) }) }}</span>
              </div>
              <div v-if="vectorsText + vectorsVisual > 0" class="k2-layer-bar">
                <i :style="{ flex: vectorsText, opacity: 1 }" />
                <i :style="{ flex: Math.max(vectorsVisual * 8, 0.001), opacity: 0.35 }" />
              </div>
              <div class="k2-layer-sub">
                {{ t('aiKbVectorSplit', { t: fmtNum(vectorsText), v: fmtNum(vectorsVisual) }) }}
              </div>
              <div class="k2-layer-desc">{{ t(LAYER_INTROS[1].descKey) }}</div>
            </button>
            <!-- Notes layer -->
            <button class="k2-layer" data-layer="note" @click="go('notes')">
              <div class="k2-layer-top">
                <span class="k2-tag">BACKLINKS</span>
                <span class="k2-layer-name"
                  >{{ t('aiKbDistilledNotes') }} <span class="k2-layer-name-en">· Notes</span></span
                >
                <span class="k2-layer-chev"><KIcon name="chev" :size="13" /></span>
              </div>
              <div class="k2-layer-num">
                {{ notesSummary.total }}<span class="suffix">{{ t('aiKbNotesSuffix') }}</span>
                <span v-if="notesSummary.draft > 0" class="k2-drafts">{{
                  t('aiKbToConfirm', { n: notesSummary.draft })
                }}</span>
              </div>
              <div v-if="notesSummary.total > 0" class="k2-layer-bar">
                <i :style="{ flex: Math.max(notesSummary.curated, 0.001), opacity: 1 }" />
                <i :style="{ flex: Math.max(notesSummary.draft, 0.001), opacity: 0.55 }" />
                <i :style="{ flex: Math.max(notesSummary.archived, 0.001), opacity: 0.22 }" />
              </div>
              <div class="k2-layer-sub">
                {{
                  t('aiKbNotesSplit', {
                    c: notesSummary.curated,
                    d: notesSummary.draft,
                    a: notesSummary.archived,
                  })
                }}
              </div>
              <div class="k2-layer-desc">{{ t(LAYER_INTROS[2].descKey) }}</div>
            </button>
          </div>
          <div class="k2-glue">
            {{ t('aiKbGlueTitle') }}
            <span class="k2-glue-id" style="--g: var(--ly-vec)"
              ><i /><code>file_id</code> {{ t('aiKbGlueFileId') }}</span
            >
            <span class="k2-glue-id" style="--g: var(--ly-wiki)"
              ><i /><code>root_id</code> {{ t('aiKbGlueRootId') }}</span
            >
            <span class="k2-glue-id" style="--g: var(--ly-note)"
              ><i /><code>session_id</code> {{ t('aiKbGlueSessionId') }}</span
            >
          </div>
        </template>

        <!-- Surface B — knowledge roots -->
        <div class="k2-sec-head">
          <span class="k2-sec-title">{{ t('aiKbHowOrganized') }}</span>
          <span class="k2-sec-en">Knowledge roots</span>
          <button class="k2-sec-link" @click="go('roots')">{{ t('aiKbManageRoots') }} →</button>
        </div>
        <div v-if="loading" class="k2-roots">
          <div v-for="i in 3" :key="i" class="k2-skel-card">
            <span class="k-skel" style="display: block; height: 14px; width: 55%" />
            <span class="k-skel" style="display: block; height: 24px; width: 40%" />
          </div>
        </div>
        <template v-else>
          <div class="k2-roots">
            <button v-for="r in enabledRoots" :key="r.id" class="k2-root" @click="go('roots')">
              <div class="k2-root-top">
                <span class="k2-root-ico"><KIcon :name="r.level === 'space' ? 'drive' : 'folder'" :size="14" /></span>
                <span class="k2-root-path" :title="r.path">&lrm;{{ r.path }}</span>
                <span class="k2-root-level">{{ r.level === 'space' ? t('aiKbLevelSpace') : t('aiKbLevelProject') }}</span>
              </div>
              <div class="k2-root-badges">
                <span v-if="r.watchMode === 'auto'" class="k2-chip" data-tone="live"
                  ><i />{{ t('aiKbRealtimeWatch') }}</span
                >
                <span v-else class="k2-chip"><i />{{ t('aiKbScheduledScanOnly') }}</span>
                <span v-if="r.needsReconcile" class="k2-chip" data-tone="warn"><i />{{ t('aiKbReconciling') }}</span>
              </div>
              <div class="k2-root-meta">
                <KIcon name="clock" :size="11" />
                {{ t('aiKbLastScan') }} {{ r.lastScanAt ? fmtAgo(r.lastScanAt) : t('aiKbNever') }}
              </div>
            </button>
            <button class="k2-root-add" @click="go('roots')">
              <KIcon name="plus" :size="16" /> {{ t('aiKbAddRoot') }}
            </button>
          </div>
          <div v-if="disabledRoots.length" class="k2-roots-off">
            <KIcon name="eye" :size="12" />
            {{ t('aiKbDisabledRoots', { n: disabledRoots.length }) }}
            <code v-for="r in disabledRoots" :key="r.id">{{ r.path }}</code>
            <button @click="go('roots')">{{ t('aiKbRestoreInRootMgmt') }} →</button>
          </div>
        </template>

        <!-- Surface C — live status -->
        <div class="k2-sec-head">
          <span class="k2-sec-title">{{ t('aiKbWhatsHappening') }}</span>
          <span class="k2-sec-en">Live</span>
        </div>
        <div v-if="loading" class="k2-skel-card">
          <span class="k-skel" style="display: block; height: 16px; width: 45%" />
          <span class="k-skel" style="display: block; height: 10px; width: 90%" />
        </div>
        <div v-else class="k2-live">
          <div class="k2-live-top">
            <template v-if="backlog > 0">
              <span class="k2-live-ico"
                ><span class="spin"><KIcon name="spinner" :size="16" /></span
              ></span>
              <div>
                <div class="k2-live-title">{{ t('aiKbIndexingNFiles', { n: fmtNum(backlog) }) }}</div>
                <div class="k2-live-sub">
                  <template v-if="rate > 0"
                    >{{ rate.toFixed(1) }} {{ t('aiKbFilesPerMin') }}<template v-if="etaText">
                      · {{ t('aiKbEta') }} {{ etaText }}</template
                    ></template
                  >
                  <template v-else>{{
                    store.controlState.paused ? t('aiKbPaused') : t('aiKbWaitingForParser')
                  }}</template>
                </div>
              </div>
              <div class="k2-prog"><i :style="{ width: percent + '%' }" /></div>
              <span class="k2-prog-pct">{{ percent }}%</span>
            </template>
            <template v-else>
              <span class="k2-live-ico" data-ok="true"><KIcon name="check" :size="16" /></span>
              <div>
                <div class="k2-live-title">{{ t('aiKbAllSynced') }}</div>
                <div class="k2-live-sub">
                  {{ t('aiKbLastSynced') }} {{ store.lastSyncFmt }} ·
                  {{ t('aiKbDoneLast10m', { n: done10m }) }}
                </div>
              </div>
            </template>
          </div>
          <div class="k2-live-grid">
            <div class="k2-live-cell">
              <div class="k2-cell-label">{{ t('aiKbThrottle') }}</div>
              <span v-if="store.controlState.paused" class="k2-paused-note">
                <KIcon name="pause" :size="11" /> {{ t('aiKbAutoIndexPaused') }}
              </span>
              <span v-else class="k2-cc" :title="t('aiKbAdjustInAdvanced')">
                <button
                  v-for="c in CC_LEVELS"
                  :key="c.n"
                  :data-on="String(store.controlState.concurrency === c.n)"
                  @click="go('settings')"
                >
                  {{ t(c.key) }}
                </button>
              </span>
            </div>
            <div class="k2-live-cell">
              <div class="k2-cell-label">{{ t('aiKbQueueHealth') }}</div>
              <div class="k2-qrow">
                <span class="k2-qchip"><b>{{ queueDepth.pending || 0 }}</b> {{ t('aiKbPending') }}</span>
                <span class="k2-qchip"><b>{{ queueDepth.running || 0 }}</b> {{ t('aiKbRunning') }}</span>
                <button v-if="failed > 0" class="k2-qchip" data-tone="danger" @click="goQueueFailed">
                  <b>{{ failed }}</b> {{ t('aiKbFailed') }} →
                </button>
                <span v-else class="k2-qchip"><b>0</b> {{ t('aiKbFailed') }}</span>
              </div>
            </div>
            <div class="k2-live-cell">
              <div class="k2-cell-label">{{ t('aiKbAutoDistill') }}</div>
              <template v-if="notesSummary.draft > 0">
                <button class="k2-distill" @click="go('notes')">
                  <KIcon name="sparkle" :size="13" />
                  {{ t('aiKbDistilledRecently', { n: notesSummary.draft }) }} →
                </button>
                <div class="k2-distill-sub">{{ t('aiKbDistillFromChats') }}</div>
              </template>
              <div v-else class="k2-distill-sub">{{ t('aiKbNoNewInsights') }}</div>
            </div>
          </div>
        </div>

        <!-- Surface D — entries -->
        <template v-if="!loading">
          <div class="k2-sec-head">
            <span class="k2-sec-title">{{ t('aiKbGoDeeper') }}</span>
            <span class="k2-sec-en">Go deeper</span>
          </div>
          <div class="k2-entries">
            <button v-for="e in entries" :key="e.en" class="k2-entry" @click="go(e.id)">
              <span class="k2-entry-ico" :data-tone="e.tone"><KIcon :name="e.icon" :size="15" /></span>
              <span style="min-width: 0">
                <span class="k2-entry-cn">{{ t(e.key) }}</span
                ><br />
                <span class="k2-entry-en">{{ e.en }}</span>
              </span>
              <!-- [Final review Minor-2, additional disclosure] Blueprint :361
                   is `v-if="e.badge > 0"`. This repo's `EntryItem.badge` is an
                   optional field, cannot directly compare `undefined > 0` under
                   strict mode, so written as `(e.badge || 0) > 0` — same class as
                   M-1 already disclosed at :128-134 (`queueDepth` fallback): TS type
                   constraint forces mechanical rewrite, behaviorally equivalent under
                   any input (`undefined > 0` and `(undefined || 0) > 0` both false),
                   not an undisclosed behavior change. -->
              <span v-if="(e.badge || 0) > 0" class="k2-entry-badge" :data-tone="e.badgeTone">{{
                e.badge
              }}</span>
            </button>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>
