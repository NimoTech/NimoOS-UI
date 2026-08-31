<!--
  "Job Queue" page, 1:1 port from Vue2 blueprint
  the Vue 2 panel (main@7a6ee6b7) `src/views/AI/Knowledge/QueueView.vue` (417 lines,
  read via `git show main:`, governance file §1: working tree is old branch not trustworthy).

  Structure mapping (blueprint line ranges, see task brief block table → this file):
    :6-13    scope toggle (two .k-filter-pill, index/distill)
    :16-39   three buckets pill (pending/running/failed) + completion stats (k-done-stat)
    :44-75   toolbar (index scope): unselected / selected two branches
    :76-82   toolbar (distill scope): single row label, no batch operations
    :85-98   empty state: failed-bucket exclusive illustration + 🎉; K16 two lines to i18n;
             :87 inline gradient see below
    :100-140 index table: select-all + status icon + basename/dirname + fmtAgo + row actions
    :145-185 distill table: exclusive grid (data-scope="distill") · no checkbox · kn-badge badges
    :190-208 clear confirmation dialog — K7: reka Dialog primitives, not bare div

  【K7】 All dialogs use reka primitives + DialogPortal's to points to knowledge-app container
  `.knowledge-app` (SP8 has blown this three times). Structure follows
  src/ai/components/settings/skills/SkillDetail.vue:488-511 confirmation dialog precedent
  (VisuallyHidden wraps DialogTitle satisfies reka's a11y requirement; visually DOM is still
  blueprint's .k-confirm-body / .k-modal-foot structure; K17 this phase does not move the
  .k-modal-head family — blueprint's dialog never had them anyway).

  【K11】 fmtAgo reuses store-exported version (knowledgeStore.ts:190-199), not copying
  blueprint's local copy at :405-414 — T0 has verified both produce identical output under
  non-negative diff; store version only adds one Math.max(0, …) clamp.

  【K16】 :96 two hardcoded English lines (`'All pending jobs are done.'` / `'No jobs running
  right now.'`) move to aiKbQueueAllPendingDone / aiKbQueueNoRunningNow; both tiers fill with
  English original text, render result identical to Vue2 verbatim.

  【K18】 Failed bucket's three retry entry points (retryOne / bulkRetry / retryAllFailed)
  uniformly actually send store.retryFailed(null), toast uniform aiKbRetriedAllFailed (no count).
  Evidence chain see governance file §4.3: parser_jobs table has no file_id column
  (NimoOS-Parser/parser/db.py:30-42); retry_failed_jobs()'s file_ids is a dead parameter
  (repo_jobs.py:107-121, source comment original `# file_ids param reserved for §B; for MVP
  retry all failed`) — blueprint's retryOne passes file_id as forever undefined; bulkRetry's
  fileIds always empty array (no request sent yet shows "retried {n}" fake success toast); only
  retryAllFailed semantics correct. Three changes detailed in function comments below; buttons/
  disable conditions/icons/layout unchanged.

  【K5, inherits P5a】 Three "operation failed" catch branches do not echo backend body / e.message,
  switch to fixed i18n keys (same template as knowledgeStore.ts's loadRoots, DashboardView
  existing precedents). cancelDistillRow's 409 branch retains blueprint's exclusive friendly hint
  (aiKbCannotCancel), **and retains blueprint's `'Cancel failed: ' + msg` prefix concatenation**
  (`aiKbCancelFailed` + `: ` + `aiKbCannotCancel`) — fix round 1 (coordinator M-1 ruling,
  2026-08-01): previously misjudged "409 is fixed i18n string, not backend body, dropping prefix
  doesn't count as echoing"; but K5 only authorizes "do not echo backend body / e.message";
  prefix itself is blueprint's native copy structure (`:388-390`); dropping it is pure copy
  trimming unrelated to requirements, outside K5 authorization scope. Governance §2: "this phase
  the only user-visible copy different from Vue2 is K18's three retry toasts" — 409 branch not
  in this exception list, so copy 1:1 restored. **This condition already rolled back per coordinator
  ruling, no longer a deviation.**

  【K12, inherits T4】 distillIconState / basename / dirname imported from util/queueView.ts,
  not redefined in this file. Three blueprint's own "quirky behaviors" (failed/skipped share
  danger color; empty value returns U+2014; dirname empty path and single-segment path boundary
  concatenation) already copied verbatim with comments in that file; this file does not repeat
  explanations.

  【Deviation, type-safety mechanical rewrite】 Blueprint computed `rows`/`counts`/`doneCount`
  mix two row shapes (ParserJob and DistillJob). Under TS strict mode, on the same union array
  doing `.map(r => r.id)` (index-only) or `row.filePath` (distill-only) access requires precise
  type narrowing; thus split into `indexRows`/`distillRows` two each strongly typed computed,
  plus one `rowsEmpty` calculating "no rows under current scope" — function exactly equivalent
  to blueprint's single `rows` computed (same store data, same filter index); only TS type-level
  organization differs, not behavior change.

  【Deviation, same as K13】 selected uses ref(new Set()) wholesale replacement, not tick counter.

  【Guard gap ③, B.0.4】 Blueprint :87's .k-empty-illust inline style= gradient per appendix B §B.0
  switch to token-derived (3 places color-mix); gradient structure/angle/stops verbatim unchanged.
-->
<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, VisuallyHidden } from 'reka-ui'
import KIcon from '../components/KIcon.vue'
import { useKnowledgeStore, fmtAgo, DISTILL_JOBS_LIMIT } from '../stores/knowledgeStore'
import type { ParserJob } from '../stores/knowledgeStore'
import type { DistillJob } from '@nimotech/nimoos-service'
import { distillIconState, basename, dirname } from '../util/queueView'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useKnowledgeStore()

type QueueFilter = 'pending' | 'running' | 'failed'
type QueueScope = 'index' | 'distill'

/** Blueprint data() — filter defaults to 'pending', selected empty set, confirmClear closed. */
const filter = ref<QueueFilter>('pending')
const selected = ref<Set<string | number>>(new Set())
const confirmClear = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

/** Blueprint :226 computed scope — deep link: `?scope=distill` → distillation bucket,
 * everything else (including default) → file index. */
const scope = computed<QueueScope>(() => (route.query.scope === 'distill' ? 'distill' : 'index'))

/** Split from blueprint's single `rows` computed (see file header comment "type-safety
 * mechanical rewrite"). */
const indexRows = computed<ParserJob[]>(() => store.jobs[filter.value] || [])
const distillRows = computed<DistillJob[]>(() => store.distillJobs[filter.value] || [])
const rowsEmpty = computed<boolean>(() =>
  (scope.value === 'distill' ? distillRows.value.length : indexRows.value.length) === 0,
)

/** Blueprint counts computed — distill uses distillJobs.counts (full tally),
 * index uses three fields of stats.queue_depth. */
const counts = computed<{ pending: number; running: number; failed: number }>(() => {
  if (scope.value === 'distill') return store.distillJobs.counts
  return {
    pending: store.stats.queue_depth.pending,
    running: store.stats.queue_depth.running,
    failed: store.stats.queue_depth.failed,
  }
})

/** Blueprint doneCount computed. */
const doneCount = computed<number>(() =>
  scope.value === 'distill' ? store.distillJobs.done || 0 : store.stats.queue_depth.done || 0,
)

/**
 * Blueprint distillTruncated computed — distillation queue single fetch capped at
 * DISTILL_JOBS_LIMIT; loaded row count (`distillJobs.total`) reaching this limit is
 * considered "truncated", same technique as judging index table "only show first 200"
 * (compare loaded count, not send another COUNT query — avoid race, N5 already declared
 * copy-as-is in knowledgeStore.ts).
 */
const distillTruncated = computed<boolean>(() => {
  if (scope.value !== 'distill') return false
  return (store.distillJobs.total || 0) >= DISTILL_JOBS_LIMIT
})

/** Blueprint watch '$route.query.filter' (immediate) — deep link `?filter=failed` takes effect
 * immediately. DashboardView.vue:202 already pushes this query (that file is on
 * zero-change list, read-only not modified); this task closes this chain here. */
watch(
  () => route.query.filter,
  (v) => {
    if (v) filter.value = v as QueueFilter
  },
  { immediate: true },
)

/** Blueprint loadForScope() — shared dispatch point for polling and manual switching. */
function loadForScope(): Promise<void> {
  return scope.value === 'distill' ? store.loadDistillJobs(filter.value) : store.loadAllJobs()
}

/** Blueprint setScope(s). */
function setScope(s: QueueScope): void {
  if (scope.value === s) return
  selected.value = new Set()
  router.replace({ query: { ...route.query, scope: s } })
  if (s === 'distill') store.loadDistillJobs(filter.value)
  else store.loadAllJobs()
}

/** Blueprint setFilter(f). */
function setFilter(f: QueueFilter): void {
  filter.value = f
  selected.value = new Set()
  if (scope.value === 'distill') store.loadDistillJobs(f)
}

/** Blueprint toggleSel(id). */
function toggleSel(id: string | number): void {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

/** Blueprint toggleAll(). */
function toggleAll(): void {
  selected.value =
    selected.value.size === indexRows.value.length
      ? new Set()
      : new Set(indexRows.value.map((r) => r.id))
}

/**
 * Blueprint retryOne(row) (:312-318) — original text `retryFailed([row.file_id || row.id])`.
 * K18 evidence ①: parser_jobs table has no file_id column → `row.file_id` forever undefined,
 * actually passes job id; evidence ②: `file_ids` at repo_jobs.py:107-121 is a dead parameter;
 * backend unconditionally does `UPDATE … WHERE done_at IS NOT NULL AND last_error IS NOT NULL`,
 * whatever is passed retries entire failed bucket. Thus actually send retryFailed(null);
 * behavior (retry entire bucket) consistent with what backend actually does; toast uniform
 * aiKbRetriedAllFailed. Buttons/disable conditions/icons/layout unchanged. `row` parameter
 * retained (signature aligns with call site `@click="retryOne(row)"`, carries blueprint method
 * signature); after K18, function body no longer reads any field of it.
 */
async function retryOne(row: ParserJob): Promise<void> {
  try {
    await store.retryFailed(null)
    store.toast(t('aiKbRetriedAllFailed'))
  } catch {
    store.toast(t('aiKbRetryFailedErr'))
  }
}

/** Blueprint retryAllFailed() (:320-328) — the only one whose semantics were correct to begin
 * with; `Retrying {n} failed jobs` judged as dead key (appendix A §A.7, no references after K18);
 * toast changed to aiKbRetriedAllFailed for uniformity with the other two. */
async function retryAllFailed(): Promise<void> {
  try {
    await store.retryFailed(null)
    store.toast(t('aiKbRetriedAllFailed'))
  } catch {
    store.toast(t('aiKbRetryFailedErr'))
  }
}

/** Blueprint cancelOne(row) (K5: do not echo e.message, switch to fixed i18n key). */
async function cancelOne(row: ParserJob): Promise<void> {
  try {
    await store.cancelJob(row.id)
    store.toast(t('aiKbCancelled'))
  } catch {
    store.toast(t('aiKbCancelFailed'))
  }
}

/**
 * Blueprint bulkRetry() (:337-349) — original text `rows.filter(r => selected.has(r.id)).map(r
 * => r.file_id).filter(Boolean)`. K18 evidence ③: `file_id` forever undefined → `fileIds`
 * always empty array → `if (fileIds.length)` always false → no request sent, yet shows fake
 * success toast "retried {n}" (`Retried {n} selected jobs` judged as dead key, appendix A §A.7).
 * Actually send store.retryFailed(null); toast uniform aiKbRetriedAllFailed.
 */
async function bulkRetry(): Promise<void> {
  try {
    await store.retryFailed(null)
    selected.value = new Set()
    store.toast(t('aiKbRetriedAllFailed'))
  } catch {
    store.toast(t('aiKbRetryFailedErr'))
  }
}

/** Blueprint bulkCancel() (K5: do not echo e.message). */
async function bulkCancel(): Promise<void> {
  const ids = Array.from(selected.value)
  try {
    for (const id of ids) await store.cancelJob(id)
    selected.value = new Set()
    store.toast(t('aiKbCancelledNSelected', { n: ids.length }))
  } catch {
    store.toast(t('aiKbCancelFailed'))
  }
}

/** Blueprint doClearFailed() (K5: do not echo e.message). */
async function doClearFailed(): Promise<void> {
  const n = counts.value.failed
  try {
    await store.clearFailed()
    confirmClear.value = false
    store.toast(t('aiKbClearedNFailed', { n }))
  } catch {
    store.toast(t('aiKbClearFailedErr'))
  }
}

/** Blueprint retryDistillRow(row) (K5: do not echo e.message). */
async function retryDistillRow(row: DistillJob): Promise<void> {
  try {
    await store.retryDistill(row, filter.value)
    store.toast(t('aiKbRequeued'))
  } catch {
    store.toast(t('aiKbRetryFailedErr'))
  }
}

/**
 * Blueprint cancelDistillRow(row) — 409 (already cannot cancel) retains blueprint's exclusive
 * friendly hint aiKbCannotCancel, **and retains `'Cancel failed: ' + msg` prefix** (coordinator
 * M-1 ruling, see file header comment); other errors per K5 change to fixed aiKbCancelFailed
 * (do not concatenate prefix, because there is no second phrase to concatenate — same template
 * as bulkCancel/cancelOne and other catch branches).
 */
async function cancelDistillRow(row: DistillJob): Promise<void> {
  try {
    await store.cancelDistill(row, filter.value)
    store.toast(t('aiKbCancelled'))
  } catch (e) {
    const status = (e as { response?: { status?: number } } | undefined)?.response?.status
    store.toast(
      status === 409 ? `${t('aiKbCancelFailed')}: ${t('aiKbCannotCancel')}` : t('aiKbCancelFailed'),
    )
  }
}

/** Blueprint created()/beforeDestroy() — 10-second polling, skip when document.hidden. */
onMounted(() => {
  loadForScope()
  pollTimer = setInterval(() => {
    if (document.hidden) return
    loadForScope()
  }, 10000)
})

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<template>
  <div class="k-view">
    <div class="k-scroll">
      <div class="k-scroll-inner">
        <!-- scope toggle (blueprint :6-13) — 🔴 String() must wrap (selector is [data-on="true"]) -->
        <div class="k-queue-head" style="margin-bottom: 4px">
          <button class="k-filter-pill" :data-on="String(scope === 'index')" @click="setScope('index')">
            {{ t('aiKbScopeIndex') }}
          </button>
          <button class="k-filter-pill" :data-on="String(scope === 'distill')" @click="setScope('distill')">
            {{ t('aiKbScopeDistill') }}
          </button>
        </div>

        <!-- three buckets pill + completion stats (blueprint :16-39) -->
        <div class="k-queue-head">
          <button class="k-filter-pill" :data-on="String(filter === 'pending')" @click="setFilter('pending')">
            <KIcon name="hourglass" :size="13" /> {{ t('aiKbPending') }}
            <span class="k-filter-pill-count">{{ counts.pending }}</span>
          </button>
          <button class="k-filter-pill" :data-on="String(filter === 'running')" @click="setFilter('running')">
            <KIcon name="spinner" :size="13" /> {{ t('aiKbRunning') }}
            <span class="k-filter-pill-count">{{ counts.running }}</span>
          </button>
          <button
            class="k-filter-pill"
            data-tone="danger"
            :data-on="String(filter === 'failed')"
            @click="setFilter('failed')"
          >
            <KIcon name="x" :size="12" /> {{ t('aiKbFailed') }}
            <span class="k-filter-pill-count">{{ counts.failed }}</span>
          </button>
          <div class="k-done-stat">
            <div class="k-done-stat-num">{{ t('aiKbTotalDone') }} <b>{{ doneCount.toLocaleString() }}</b></div>
            <div class="k-done-stat-label">{{ t('aiKbTotalDoneLabel') }}</div>
          </div>
        </div>

        <!-- toolbar: complete batch toolbar for index scope (blueprint :44-75) -->
        <div v-if="scope === 'index'" class="k-toolbar" :data-selecting="String(selected.size > 0)">
          <template v-if="selected.size === 0">
            <span class="k-toolbar-label">
              <template v-if="filter === 'pending'">{{ t('aiKbNPendingJobs', { n: counts.pending }) }}</template>
              <template v-else-if="filter === 'running'">{{ t('aiKbNRunningJobs', { n: counts.running }) }}</template>
              <template v-else-if="filter === 'failed'">{{ t('aiKbNFailedRecords', { n: counts.failed }) }}</template>
            </span>
            <div style="margin-left: auto; display: flex; gap: 8px">
              <template v-if="filter === 'failed'">
                <button class="k-btn outline" :disabled="counts.failed === 0" @click="retryAllFailed">
                  <KIcon name="refresh" :size="12" /> {{ t('aiKbRetryAllFailed') }}
                </button>
                <button
                  class="k-btn ghost"
                  :disabled="counts.failed === 0"
                  :style="{ color: counts.failed > 0 ? 'var(--danger)' : undefined }"
                  @click="confirmClear = true"
                >
                  <KIcon name="trash" :size="12" /> {{ t('aiKbClearFailedRecords') }}
                </button>
              </template>
            </div>
          </template>
          <template v-else>
            <span class="k-toolbar-label">{{ t('aiKbNSelected', { n: selected.size }) }}</span>
            <div style="margin-left: auto; display: flex; gap: 8px">
              <button v-if="filter === 'failed'" class="k-btn primary" @click="bulkRetry">
                <KIcon name="refresh" :size="12" /> {{ t('aiKbRetrySelected') }}
              </button>
              <button class="k-btn ghost" @click="bulkCancel">
                <KIcon name="x" :size="12" />
                {{ filter === 'failed' ? t('aiKbClearSelected') : t('aiKbCancelSelected') }}
              </button>
              <button class="k-btn ghost" @click="selected = new Set()">{{ t('aiKbCancel') }}</button>
            </div>
          </template>
        </div>
        <!-- toolbar: distill scope only has one row label, no batch operations
        (blueprint :76-82 — distillation queue only re-sends single row at a time,
        batch retry/clear have no corresponding semantic operations) -->
        <div v-else class="k-toolbar">
          <span class="k-toolbar-label">
            <template v-if="filter === 'pending'">{{ t('aiKbNPendingJobs', { n: counts.pending }) }}</template>
            <template v-else-if="filter === 'running'">{{ t('aiKbNRunningJobs', { n: counts.running }) }}</template>
            <template v-else-if="filter === 'failed'">{{ t('aiKbNFailedRecords', { n: counts.failed }) }}</template>
          </span>
        </div>

        <!-- empty state (blueprint :85-98) -->
        <div v-if="rowsEmpty" class="k-empty">
          <template v-if="filter === 'failed'">
            <!-- Blueprint QueueView.vue:87 inline gradient; three bare colors per appendix B §B.0
            switch to token-derived; gradient structure verbatim unchanged -->
            <div
              class="k-empty-illust"
              style="
                background: radial-gradient(
                    circle at 30% 30%,
                    color-mix(in srgb, var(--text-on-accent) 50%, transparent),
                    transparent 60%
                  ),
                  linear-gradient(
                    135deg,
                    color-mix(in srgb, var(--success) 20%, transparent),
                    color-mix(in srgb, var(--accent) 20%, transparent)
                  )
              "
            >
              <KIcon name="rocket" :size="36" color="var(--success)" />
            </div>
            <div class="k-empty-title">🎉 {{ t('aiKbAllCaughtUp') }}</div>
            <div class="k-empty-sub">
              {{ scope === 'distill' ? t('aiKbNoFailedDistill') : t('aiKbNoFailedJobs') }}
            </div>
          </template>
          <template v-else>
            <div class="k-empty-illust"><KIcon name="check" :size="36" color="var(--success)" /></div>
            <div class="k-empty-title">{{ filter === 'pending' ? t('aiKbQueueEmpty') : t('aiKbNoRunningJobs') }}</div>
            <!-- K16: blueprint :96 two hardcoded English lines switch to i18n,
            both tiers filled with English original text -->
            <div class="k-empty-sub">
              {{ filter === 'pending' ? t('aiKbQueueAllPendingDone') : t('aiKbQueueNoRunningNow') }}
            </div>
          </template>
        </div>

        <!-- index table (blueprint :100-140) -->
        <div v-else-if="scope === 'index'" class="k-table">
          <div class="k-row k-row-head">
            <input
              type="checkbox"
              class="k-row-check"
              :checked="selected.size === indexRows.length && indexRows.length > 0"
              @change="toggleAll"
            />
            <span />
            <span>{{ t('aiKbColFile') }}</span>
            <span>{{ t('aiKbColPath') }}</span>
            <span>{{ t('aiKbColTime') }}</span>
            <span>{{ filter === 'failed' ? t('aiKbRetry') : '' }}</span>
            <span />
          </div>
          <div v-for="row in indexRows" :key="row.id" class="k-row" :data-selected="String(selected.has(row.id))">
            <input
              type="checkbox"
              class="k-row-check"
              :checked="selected.has(row.id)"
              @change="toggleSel(row.id)"
            />
            <span class="k-row-status" :data-state="filter">
              <KIcon v-if="filter === 'pending'" name="hourglass" :size="12" />
              <KIcon v-else-if="filter === 'running'" name="spinner" :size="12" />
              <KIcon v-else name="x" :size="12" />
            </span>
            <span class="k-row-name" :title="basename(row.path)">{{ basename(row.path) }}</span>
            <span class="k-row-path" :title="dirname(row.path)">{{ dirname(row.path) }}</span>
            <!-- ParserJob.created_at declared as string in knowledgeStore.ts
            (that file zero-change permission for this task), but backend actually sends
            millisecond timestamp number (see fixtures jobs-pending.json). Number(...) only
            satisfies fmtAgo(ms: number) type requirement; for real number input is identity
            transform; for undefined gets NaN (!NaN and !undefined both truthy branch, falls
            back to '—'), does not change any observable behavior. -->
            <span class="k-row-time">{{ fmtAgo(Number(row.created_at)) }}</span>
            <span class="k-row-retry">
              <template v-if="filter === 'failed' && row.attempts">{{ t('aiKbNRetried', { n: row.attempts }) }}</template>
              <span
                v-if="filter === 'failed' && row.last_error"
                style="
                  display: block;
                  font-size: 10px;
                  color: var(--text-quaternary);
                  font-weight: 400;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                "
              >
                {{ row.last_error }}
              </span>
            </span>
            <span class="k-row-actions">
              <button
                v-if="filter === 'pending'"
                class="k-row-action"
                data-tone="danger"
                :title="t('aiKbCancel')"
                @click="cancelOne(row)"
              >
                <KIcon name="x" :size="13" />
              </button>
              <button v-if="filter === 'failed'" class="k-row-action" :title="t('aiKbRetry')" @click="retryOne(row)">
                <KIcon name="refresh" :size="13" />
              </button>
            </span>
          </div>
          <div v-if="indexRows.length >= 200" class="k-table-foot">
            <KIcon name="info" :size="12" />
            {{ t('aiKbShowingFirst200') }}
          </div>
        </div>

        <!-- distill table (blueprint :145-185) — exclusive grid, no checkbox column,
        one retry button per row -->
        <div v-else class="k-table">
          <div class="k-row k-row-head" data-scope="distill">
            <span />
            <span>{{ t('aiKbColFile') }}</span>
            <span>{{ t('aiKbColPath') }}</span>
            <span>{{ t('aiKbStatus') }}</span>
            <span>{{ t('aiKbStatusError') }}</span>
            <span>{{ t('aiKbColTime') }}</span>
            <span />
          </div>
          <div v-for="row in distillRows" :key="row.filePath" class="k-row" data-scope="distill">
            <span class="k-row-status" :data-state="distillIconState(row)">
              <KIcon v-if="row.status === 'pending'" name="hourglass" :size="12" />
              <KIcon v-else-if="row.status === 'running'" name="spinner" :size="12" />
              <KIcon v-else name="x" :size="12" />
            </span>
            <span class="k-row-name" :title="basename(row.filePath)">{{ basename(row.filePath) }}</span>
            <span class="k-row-path" :title="dirname(row.filePath)">{{ dirname(row.filePath) }}</span>
            <span class="k-row-badges">
              <span class="kn-badge" :data-s="row.origin === 'manual' ? 'curated' : 'archived'">
                {{ row.origin === 'manual' ? t('aiKbOriginManual') : t('aiKbOriginAuto') }}
              </span>
              <span v-if="row.status === 'skipped'" class="kn-badge" data-s="draft">{{ t('aiKbSkipped') }}</span>
              <span v-else-if="row.status === 'failed'" class="kn-badge" data-s="failed">{{ t('aiKbFailed') }}</span>
            </span>
            <span class="k-row-error" :title="row.lastError">{{ row.lastError }}</span>
            <span class="k-row-time">{{ fmtAgo(row.updatedAt || row.enqueuedAt) }}</span>
            <span class="k-row-actions">
              <button
                v-if="row.status === 'pending'"
                class="k-row-action"
                data-tone="danger"
                :title="t('aiKbCancel')"
                @click="cancelDistillRow(row)"
              >
                <KIcon name="x" :size="13" />
              </button>
              <button
                v-if="row.status === 'failed' || row.status === 'skipped'"
                class="k-row-action"
                :title="t('aiKbRetry')"
                @click="retryDistillRow(row)"
              >
                <KIcon name="refresh" :size="13" />
              </button>
            </span>
          </div>
          <div v-if="distillTruncated" class="k-table-foot">
            <KIcon name="info" :size="12" />
            {{ t('aiKbShowingFirstN', { n: store.distillJobs.total }) }}
          </div>
        </div>
      </div>
    </div>

    <!-- clear confirmation dialog (blueprint :190-208) — K7: reka Dialog primitives,
    portal to knowledge-app container. -->
    <DialogRoot :open="confirmClear" @update:open="confirmClear = $event">
      <DialogPortal to=".knowledge-app" defer>
        <DialogOverlay class="k-modal-bg">
          <DialogContent class="k-modal" style="width: min(420px, 100%)" :aria-describedby="undefined">
            <VisuallyHidden as-child><DialogTitle>{{ t('aiKbClearFailedConfirmTitle') }}</DialogTitle></VisuallyHidden>
            <div class="k-confirm-body">
              <div class="k-confirm-icon"><KIcon name="danger" :size="28" /></div>
              <div class="k-confirm-title">{{ t('aiKbClearFailedConfirmTitle') }}</div>
              <div style="text-align: center; color: var(--text-secondary); font-size: 13px">
                {{ t('aiKbClearFailedConfirmBody', { n: counts.failed }) }}
              </div>
            </div>
            <div class="k-modal-foot">
              <div class="right" style="margin-left: auto">
                <button class="k-btn ghost" @click="confirmClear = false">{{ t('aiKbCancel') }}</button>
                <button class="k-btn danger" @click="doClearFailed">
                  <KIcon name="trash" :size="12" /> {{ t('aiKbConfirmClear') }}
                </button>
              </div>
            </div>
          </DialogContent>
        </DialogOverlay>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
