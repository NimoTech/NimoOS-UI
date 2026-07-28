<!--
  1:1 移植自 Vue2 src/views/AI/Agent/tabs/ResourcesTab.vue(279 行)。SP8-P1c2 Task 12。

  三段:授权资源(AUTHORIZED)/ 附件(ATTACHMENTS)/ 暂存区(PENDING CHANGES,仅
  `stagedChanges.length > 0` 时渲染)。分组/格式化纯逻辑抽到 ../../util/stagedGroups.ts
  (独立单测),本组件只做 props→emit 的哑组件接线,不直接调用 Pinia store —— 六个
  store action(removeVisibleResource/removeAttachment/revertStagedRun/
  revertStagedBatch/revertStagedItem/commitStagedAll)由父组件(AgentRightPanel,
  后续任务接线)监听 emit 后调用。

  `reverting` 三种键命名空间逐字照抄 Vue2:isReverting(runId) 裸键、
  isRevertingBatch(batchId) 裸键、isRevertingItem(stagedId) 用 'item:'+id 前缀
  (与 agentStore.ts 的 revertStagedRun/revertStagedBatch/revertStagedItem 写入
  reverting 的键完全对应)。

  Vue2 从未 i18n 过的裸英文字面量(段标题/空态/徽标/按钮文案/相对时间)按本期拍板
  (2026-07-27)补 zh_cn/en_us 键;aiResBatchSummary/aiResRevertBatch/aiResRevertItem
  三个复用 Vue2 既有 zh_CN.json/en_US.json 现成译文(agent_batch_summary/
  agent_batch_revert_all/agent_revert_item,970-972/878-880 行),逐字照抄。

  授权段空态含 `<code>@</code>` 内联提示 —— 用 <i18n-t> 具名插槽(precedent:
  aiMentionNoMatchTpl/MentionPopover.vue)填充,消息本身不含裸 '@',不需要
  {'@'} 转义(与 aiComposerPlaceholder 那种"@ 就是消息内容一部分"的情形不同)。

  `.rt-*` 样式规则在 agent-styles.scss 里没有全局同名对应(已核实,专属本组件),
  按 1:1 港带自己的 scoped 样式块;8 处裸色字面量(rt-tag-draft 背景+字色、
  badge-NEW/DEL/REN/MKD 背景、rt-orphan-tag 背景、rt-commit 的 color:white)
  全部换成 tokens.scss 里已存在的语义 token(--warning-soft/--warning、
  --success-soft/--danger-soft/--teal-soft、--text-on-accent)—— 均为既有
  token,本次未新增任何 token。
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

/** Vue2 里附件是裸对象字面量(无专用 TS 类型);这里按模板实际读取的字段补一个
 *  本地接口,不改动 agentStore.ts 里 `attachments: Record<string, unknown>[]`
 *  的宽松类型(父组件仍可原样传入)。 */
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
  (e: 'remove-attachment', id: string | number): void
  (e: 'revert-run', runId: string | number): void
  (e: 'revert-batch', batchId: string | number): void
  (e: 'revert-item', stagedId: string | number): void
  (e: 'commit-all'): void
}>()

const { t } = useI18n()

/** Vue2:157 `data() { return { expandedBatches: {} } }` + `$set` toggle —— Vue3
 *  没有 $set 的必要性(ref 的对象属性赋值天然是响应式的),直接赋值即可。 */
const expandedBatches = ref<Record<string | number, boolean>>({})

function toggleBatch(batchId: string | number) {
  expandedBatches.value[batchId] = !expandedBatches.value[batchId]
}

/** Vue2:161-163 totalChangedFiles。 */
const totalChangedFiles = computed(() =>
  props.stagedChanges.reduce((n, g) => n + g.items.length, 0),
)

/** Vue2:164-189 groupedStagedChanges —— 纯逻辑已抽到 stagedGroups.ts。 */
const groupedStagedChanges = computed(() => groupStagedChanges(props.stagedChanges))

function hasSnapshotMissing(g: StagedGroup): boolean {
  return g.items.some((it) => it.snapshot_missing)
}

/** relativeTime() 返回键名+参数,这里就地渲染成文本,避免在模板里重复调用。 */
function relTimeText(unixSec: number): string {
  const r = relativeTime(unixSec)
  return t(r.key, r.params || {})
}

function rawUrl(aid: string | number): string {
  if (!props.sessionId) return '#'
  return service.ai.attachmentRawUrl(props.sessionId, aid)
}

/** Vue2:230-232 —— 三种键命名空间,逐字照抄:裸 runId / 裸 batchId / 'item:'+stagedId。 */
function isReverting(runId: string | number): boolean { return !!props.reverting[runId] }
function isRevertingBatch(batchId: string | number): boolean { return !!props.reverting[batchId] }
function isRevertingItem(stagedId: string | number | undefined): boolean {
  return stagedId !== undefined && !!props.reverting['item:' + stagedId]
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
            @click="emit('remove-resource', r.id as string | number)"
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
// Vue2 裸色 1/2: rgba(255,149,0,0.12) 背景 + var(--warning, #ff9500) 兜底色字 → 既有 token。
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
// Vue2 裸色 3-6: badge-NEW/DEL/REN/MKD 背景(NEW 在 badgeFor() 里从未被产出,
// Vue2 本身也是死代码,原样保留不删,只是 rgba → token)。
.badge-NEW { background: var(--success-soft); color: var(--success); }
.badge-MOD { background: var(--accent-soft); color: var(--accent); }
.badge-DEL { background: var(--danger-soft); color: var(--danger); }
.badge-REN { background: var(--teal-soft); color: var(--teal); }
.badge-MKD { background: var(--teal-soft); color: var(--teal); }
.rt-size { color: var(--text-tertiary); font-variant-numeric: tabular-nums; }
// Vue2 裸色 7: rgba(255,59,48,0.1) 背景 → --danger-soft。
.rt-orphan-tag { font-size: 10px; padding: 1px 5px; border-radius: 4px; background: var(--danger-soft); color: var(--danger); }
.rt-commit-row { padding-top: 8px; }
// Vue2 裸色 8: color: white → --text-on-accent。
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
