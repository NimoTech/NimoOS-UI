<!--
  1:1 port from Vue2 src/views/AI/Agent/tabs/ResourcesTab.vue (279 lines). SP8-P1c2 Task 12.

  Three sections: authorized resources (AUTHORIZED) / attachments (ATTACHMENTS) / staging area
  (PENDING CHANGES, rendered only when `stagedChanges.length > 0`). Grouping/formatting pure logic
  extracted to ../../util/stagedGroups.ts (with standalone unit tests); this component is just a dumb
  props→emit relay, does not directly call Pinia store — six store actions (removeVisibleResource/
  removeAttachment/revertStagedRun/revertStagedBatch/revertStagedItem/commitStagedAll) are called by
  parent component (AgentRightPanel, wired in later task) after listening to emit.

  Three key namespaces for `reverting` are verbatim from Vue2: isReverting(runId) bare key,
  isRevertingBatch(batchId) bare key, isRevertingItem(stagedId) using 'item:'+id prefix
  (exactly correspond to revertStagedRun/revertStagedBatch/revertStagedItem keys written to
  reverting in agentStore.ts).

  Vue2 bare English literals never i18n'd (section titles/empty states/badges/button copy/relative time)
  — added zh_cn/en_us keys per this phase's decision (2026-07-27); aiResBatchSummary/aiResRevertBatch/
  aiResRevertItem three reuse existing translations from Vue2's zh_CN.json/en_US.json (agent_batch_summary/
  agent_batch_revert_all/agent_revert_item, lines 970-972/878-880), verbatim copy.

  Authorized section empty state contains inline hint `<code>@</code>` — filled using
  <i18n-t> named slot (precedent: aiMentionNoMatchTpl/MentionPopover.vue); message itself does not
  contain bare '@', no need for {'@'} escaping (different from aiComposerPlaceholder where
  "@" is part of message content).

  `.rt-*` style rules have no global counterparts in agent-styles.scss (verified, specific to this
  component), ported 1:1 with own scoped style block; 8 bare color literals (rt-tag-draft background+
  text color, badge-NEW/DEL/REN/MKD background, rt-orphan-tag background, rt-commit color:white) all
  replaced with existing semantic tokens from tokens.scss (--warning-soft/--warning, --success-soft/
  --danger-soft/--teal-soft, --text-on-accent) — all existing tokens, no new tokens added this time.
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import type { VisibleResource, StagedGroup, StagedItem } from '../../stores/agentStore'
import {
  groupStagedChanges,
  badgeFor,
  formatStagedPath,
  formatStagedSize,
  relativeTime,
  attachmentKindIcon,
  pluralWord,
} from '../../util/stagedGroups'

/** In Vue2 attachments are bare object literals (no dedicated TS type); here we add a local
 *  interface based on actual template field access, without changing the loose type in agentStore.ts
 *  `attachments: Record<string, unknown>[]` (parent can still pass in as-is). */
export interface ResourceAttachment {
  id: string | number
  filename: string
  size_bytes?: number
  kind?: string
  message_id?: string | number | null
  [k: string]: unknown
}

const props = withDefaults(
  defineProps<{
    visibleResources?: VisibleResource[]
    attachments?: ResourceAttachment[]
    sessionId?: string
    stagedChanges?: StagedGroup[]
    busy?: boolean
    committing?: boolean
    reverting?: Record<string, boolean>
  }>(),
  {
    visibleResources: () => [],
    attachments: () => [],
    sessionId: '',
    stagedChanges: () => [],
    busy: false,
    committing: false,
    reverting: () => ({}),
  },
)

const emit = defineEmits<{
  (e: 'remove-resource', id: string | number): void
  // F1 fix (final review full branch check) — Vue2 tabs/ResourcesTab.vue:21 unconditionally
  // passes `r.id` to × for authorized section; streamed resources (agentStore.ts:488
  // appendVisibleResource only sets {path, kind}; see dispatchEvent.ts:310-314 / Vue2
  // agentStream.js:539-542) lack id, causing bad request `/visible-resources/undefined`. Same
  // handling as AgentComposer.removeChip() (debt① settlement for 1c-1 ticket 1; see that function
  // comment): split by `r.id !== undefined`; resources without id go to this new event, handled by
  // parent calling store.removeVisibleResourceByPath(path).
  (e: 'remove-resource-by-path', path: string): void
  (e: 'remove-attachment', id: string | number): void
  (e: 'revert-run', runId: string | number): void
  (e: 'revert-batch', batchId: string | number): void
  (e: 'revert-item', stagedId: string | number): void
  (e: 'commit-all'): void
}>()

const { t } = useI18n()

/** Vue2:157 `data() { return { expandedBatches: {} } }` + `$set` toggle — Vue3 has no need for
 *  $set (ref object property assignment is naturally reactive), direct assignment works. */
const expandedBatches = ref<Record<string | number, boolean>>({})

function toggleBatch(batchId: string | number) {
  expandedBatches.value[batchId] = !expandedBatches.value[batchId]
}

/** Vue2:161-163 totalChangedFiles. */
const totalChangedFiles = computed(() =>
  props.stagedChanges.reduce((n, g) => n + g.items.length, 0),
)

/** Vue2:164-189 groupedStagedChanges — pure logic extracted to stagedGroups.ts. */
const groupedStagedChanges = computed(() => groupStagedChanges(props.stagedChanges))

function hasSnapshotMissing(g: StagedGroup): boolean {
  return g.items.some((it) => it.snapshot_missing)
}

/** relativeTime() returns key name + params; rendered to text here to avoid repeated calls in template. */
function relTimeText(unixSec: number): string {
  const r = relativeTime(unixSec)
  return t(r.key, r.params || {})
}

function rawUrl(aid: string | number): string {
  if (!props.sessionId) return '#'
  return service.ai.attachmentRawUrl(props.sessionId, aid)
}

/** Vue2:230-232 — three key namespaces, verbatim from Vue2: bare runId / bare batchId / 'item:'+stagedId.
 *  F2 declaration (final review Opus check) — `isRevertingItem` has an extra
 *  `stagedId !== undefined &&` guard compared to Vue2:232; Vue2 lacks this, when `stagedId` is
 *  undefined it checks `reverting['item:undefined']`. Runtime equivalent (that key never exists in
 *  `reverting` table, both forms result in false), this is just defensive explicitness, **does not
 *  change behavior**. */
function isReverting(runId: string | number): boolean { return !!props.reverting[runId] }
function isRevertingBatch(batchId: string | number): boolean { return !!props.reverting[batchId] }
function isRevertingItem(stagedId: string | number | undefined): boolean {
  return stagedId !== undefined && !!props.reverting['item:' + stagedId]
}

/**
 * F1 fix — Vue2:21 unconditionally `emit('remove-resource', r.id)`, which hits
 * `/visible-resources/undefined` for streamed resources without id (see comment above at
 * `remove-resource-by-path` emit declaration). Here split by **`r.id !== undefined`** (cannot use
 * truthiness check — `id === 0` is a valid id): resources with id use original event;
 * without id use `remove-resource-by-path`, handled by parent calling
 * `store.removeVisibleResourceByPath`. After split, each branch type is narrowed,
 * no longer needs `as string | number` assertion.
 */
function onRemoveResource(r: VisibleResource) {
  if (r.id !== undefined) {
    emit('remove-resource', r.id)
  } else {
    emit('remove-resource-by-path', r.path)
  }
}
</script>

<template>
  <div class="resources-tab">
    <section class="rt-section">
      <header class="rt-head">
        <span>{{ t('aiResAuthorized') }} <span class="rt-count">({{ visibleResources.length }})</span></span>
      </header>

      <i18n-t
        v-if="visibleResources.length === 0"
        keypath="aiResEmptyAuthorized"
        tag="div"
        class="rt-empty"
      >
        <template #at><code>@</code></template>
      </i18n-t>

      <ul v-else class="rt-list">
        <li v-for="r in visibleResources" :key="r.id || r.path" class="rt-item">
          <span class="rt-icon">{{ r.kind === 'folder' ? '📁' : '📄' }}</span>
          <span class="rt-path">{{ r.path }}</span>
          <span v-if="r.has_agent_md" class="rt-tag">agent.md</span>
          <button
            class="icon-btn rt-x"
            :disabled="busy"
            :title="busy ? t('aiResAgentRunning') : t('aiResRemoveAuth')"
            @click="onRemoveResource(r)"
          >×</button>
        </li>
      </ul>
    </section>

    <section class="rt-section">
      <header class="rt-head">
        <span>{{ t('aiResAttachments') }} <span class="rt-count">({{ attachments.length }})</span></span>
      </header>

      <div v-if="attachments.length === 0" class="rt-empty">{{ t('aiResEmptyAttachments') }}</div>

      <ul v-else class="rt-list">
        <li v-for="a in attachments" :key="a.id" class="rt-item">
          <span class="rt-icon">{{ attachmentKindIcon(a.kind) }}</span>
          <span class="rt-path" :title="a.filename">{{ a.filename }}</span>
          <span class="rt-size">{{ formatStagedSize(a.size_bytes) }}</span>
          <span v-if="a.message_id" class="rt-tag" :title="t('aiResSentTitle')">{{ t('aiResSent') }}</span>
          <span v-else class="rt-tag rt-tag-draft">{{ t('aiResDraft') }}</span>
          <a
            v-if="sessionId"
            :href="rawUrl(a.id)"
            target="_blank"
            class="icon-btn rt-x"
            :title="t('aiResDownload')"
          >↓</a>
          <button
            v-if="!a.message_id"
            class="icon-btn rt-x"
            :disabled="busy"
            :title="busy ? t('aiResAgentRunning') : t('aiResRemoveAttachment')"
            @click="emit('remove-attachment', a.id)"
          >×</button>
        </li>
      </ul>
    </section>

    <section class="rt-section" v-if="stagedChanges.length > 0">
      <header class="rt-head">
        <span>{{ t('aiResPending') }} <span class="rt-count">({{ t('aiResFilesInTurns', { files: totalChangedFiles, turns: stagedChanges.length, s: pluralWord(stagedChanges.length) }) }})</span></span>
      </header>

      <div v-for="g in groupedStagedChanges" :key="g.run_id" class="rt-turn">
        <div class="rt-turn-head">
          <span>{{ t('aiResTurn', { time: relTimeText(g.created_at), n: g.items.length, s: pluralWord(g.items.length) }) }}</span>
          <button
            class="rt-revert"
            :disabled="busy || isReverting(g.run_id) || hasSnapshotMissing(g)"
            :title="hasSnapshotMissing(g) ? t('aiResSnapshotMissing') : (busy ? t('aiResAgentRunning') : t('aiResRevertTurnTitle'))"
            @click="emit('revert-run', g.run_id)"
          >{{ isReverting(g.run_id) ? t('aiResReverting') : t('aiResRevert') }}</button>
        </div>

        <!-- Batch sub-groups -->
        <div v-for="batch in g.batches" :key="batch.batchId" class="rt-batch">
          <div class="rt-batch-head">
            <button
              class="rt-batch-toggle icon-btn"
              :title="expandedBatches[batch.batchId] ? t('aiResCollapse') : t('aiResExpand')"
              @click="toggleBatch(batch.batchId)"
            >{{ expandedBatches[batch.batchId] ? '▾' : '▸' }}</button>
            <span class="rt-batch-summary">
              {{ t('aiResBatchSummary', batch.summary) }}
              <span class="rt-badge-count">({{ batch.items.length }})</span>
            </span>
            <button
              class="rt-revert rt-batch-revert"
              :disabled="busy || isRevertingBatch(batch.batchId)"
              :title="busy ? t('aiResAgentRunning') : (isRevertingBatch(batch.batchId) ? t('aiResReverting') : t('aiResRevertBatch'))"
              @click="emit('revert-batch', batch.batchId)"
            >{{ isRevertingBatch(batch.batchId) ? t('aiResReverting') : t('aiResRevertBatch') }}</button>
          </div>
          <ul v-show="expandedBatches[batch.batchId]" class="rt-changes rt-batch-items">
            <li v-for="it in batch.items" :key="it.seq" class="rt-change" :class="`op-${it.op}`">
              <span class="rt-badge" :class="`badge-${badgeFor(it.op)}`">{{ badgeFor(it.op) }}</span>
              <span class="rt-icon">📄</span>
              <span class="rt-path">{{ formatStagedPath(it) }}</span>
              <!-- Deliberate divergence from Vue2: Vue2 ResourcesTab.vue:99/:117 uses
                   `it.size_bytes ? … : '—'` template short-circuiting, so a 0-byte staged item
                   shows '—' (contradicting formatSize's own `n !== 0` branch and the Vue2
                   attachment row :40, which calls formatSize directly — Vue2 is self-inconsistent
                   here). Here we call formatStagedSize directly, so 0 → '0 B'. Logged (see task 12 report). -->
              <span class="rt-size">{{ formatStagedSize(it.size_bytes) }}</span>
              <span v-if="it.snapshot_missing" class="rt-orphan-tag" :title="t('aiResOrphanTitle')">{{ t('aiResOrphan') }}</span>
              <button
                class="icon-btn rt-x rt-item-revert"
                :disabled="busy || isRevertingItem(it.staged_id)"
                :title="busy ? t('aiResAgentRunning') : (isRevertingItem(it.staged_id) ? t('aiResReverting') : t('aiResRevertItem'))"
                @click="emit('revert-item', it.staged_id as string | number)"
              >↩</button>
            </li>
          </ul>
        </div>

        <!-- Loose items (no batch_id) -->
        <ul v-if="g.looseItems.length > 0" class="rt-changes">
          <li v-for="it in g.looseItems" :key="it.seq" class="rt-change" :class="`op-${it.op}`">
            <span class="rt-badge" :class="`badge-${badgeFor(it.op)}`">{{ badgeFor(it.op) }}</span>
            <span class="rt-icon">📄</span>
            <span class="rt-path">{{ formatStagedPath(it) }}</span>
            <!-- Same deliberate-divergence note as the batch items above (Vue2 ResourcesTab.vue:99/:117
                 short-circuits to '—', here 0 → '0 B'). Logged. -->
            <span class="rt-size">{{ formatStagedSize(it.size_bytes) }}</span>
            <span v-if="it.snapshot_missing" class="rt-orphan-tag" :title="t('aiResOrphanTitle')">{{ t('aiResOrphan') }}</span>
          </li>
        </ul>
      </div>

      <div class="rt-commit-row">
        <button
          class="rt-commit"
          :disabled="busy || committing"
          :title="busy ? t('aiResAgentRunning') : t('aiResCommitTitle')"
          @click="emit('commit-all')"
        >{{ committing ? t('aiResCommitting') : t('aiResCommitAll', { n: totalChangedFiles }) }}</button>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.resources-tab { display: flex; flex-direction: column; gap: 16px; padding: 12px 8px; }
.rt-section { display: flex; flex-direction: column; gap: 8px; }
.rt-head { font-size: 11px; color: var(--text-tertiary); letter-spacing: 0.06em; }
.rt-count { color: var(--text-secondary); }
.rt-empty { font-size: 12px; color: var(--text-tertiary); padding: 8px 0; }
.rt-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.rt-item { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.rt-path { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rt-tag { font-size: 10px; padding: 1px 5px; border-radius: 4px; background: var(--accent-soft); color: var(--accent); }
// Vue2 bare colour 1/2 (ResourcesTab.vue:247-250): translucent warning-tinted background +
// warning-tinted fallback text colour → existing tokens.
// Note: the original literal values aren't written out here — color-guard scans <style> blocks
// without skipping comment lines, so spelling them out would trip a false positive.
.rt-tag-draft {
  background: var(--warning-soft);
  color: var(--warning);
}
.rt-x { width: 22px; height: 22px; }
.rt-x:disabled { opacity: 0.4; cursor: not-allowed; }
.rt-turn { display: flex; flex-direction: column; gap: 4px; padding: 8px; border: 1px solid var(--line); border-radius: var(--r-md); box-shadow: var(--shadow-xs); background: var(--bg-elevated); }
.rt-turn-head { display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--text-secondary); }
.rt-revert { padding: 4px 10px; border-radius: 6px; background: transparent; border: 1px solid var(--line); cursor: pointer; font-size: 12px; }
.rt-revert:hover:not(:disabled) { background: var(--bg-hover); }
.rt-revert:disabled { opacity: 0.4; cursor: not-allowed; }
.rt-changes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.rt-change { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.rt-badge { font-size: 10px; padding: 1px 5px; border-radius: 4px; font-weight: 600; }
// Vue2 bare colour 3-6: badge-NEW/DEL/REN/MKD backgrounds (NEW is never produced by badgeFor(),
// already dead code in Vue2 itself; kept as-is rather than removed, just rgba → token).
.badge-NEW { background: var(--success-soft); color: var(--success); }
.badge-MOD { background: var(--accent-soft); color: var(--accent); }
.badge-DEL { background: var(--danger-soft); color: var(--danger); }
.badge-REN { background: var(--teal-soft); color: var(--teal); }
.badge-MKD { background: var(--teal-soft); color: var(--teal); }
.rt-size { color: var(--text-tertiary); font-variant-numeric: tabular-nums; }
// Vue2 bare colour 7 (ResourcesTab.vue:267): translucent danger-tinted background → --danger-soft.
.rt-orphan-tag { font-size: 10px; padding: 1px 5px; border-radius: 4px; background: var(--danger-soft); color: var(--danger); }
.rt-commit-row { padding-top: 8px; }
// Vue2 bare colour 8: a literal light text colour on the accent background → --text-on-accent.
.rt-commit { width: 100%; padding: 8px 12px; border-radius: var(--r-sm); background: var(--accent); color: var(--text-on-accent); border: none; font-weight: 500; cursor: pointer; }
.rt-commit:disabled { opacity: 0.4; cursor: not-allowed; }
.rt-batch { border: 1px solid var(--line); border-radius: 6px; margin-top: 4px; }
.rt-batch-head { display: flex; align-items: center; gap: 6px; padding: 6px 8px; font-size: 12px; color: var(--text-secondary); }
.rt-batch-toggle { width: 18px; height: 18px; font-size: 10px; flex-shrink: 0; }
.rt-batch-summary { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rt-badge-count { color: var(--text-tertiary); margin-left: 2px; }
.rt-batch-revert { padding: 3px 8px; border-radius: 5px; background: transparent; border: 1px solid var(--line); cursor: pointer; font-size: 11px; flex-shrink: 0; }
.rt-batch-revert:disabled { opacity: 0.4; cursor: not-allowed; }
.rt-batch-items { padding: 0 8px 6px; }
</style>
