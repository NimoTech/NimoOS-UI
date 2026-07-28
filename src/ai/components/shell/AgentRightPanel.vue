<!--
  1:1 移植自 Vue2 src/views/AI/Agent/shell/AgentRightPanel.vue(80 行)。SP8-P1c2
  Task 10。哑组件(props 进、events 出),父组件持有全部状态——Vue2 没有 emits
  声明(Vue2 不强制),本期按 Vue3 惯例补上。

  双重折叠机制(两者都要,brief 明确指出):
  1) 本组件的 `v-if="!collapsed"` —— collapsed=true 时整个 <aside> 不渲染。
  2) 页面级 grid 列宽通过 AgentPage 根节点的 `data-rightcollapsed` 属性归零
     (Task 2 已落地,Task 13 才会把本组件真正挂进 AgentPage)。
  两个机制分别处理"组件树里有没有这坨 DOM"和"布局网格给不给它留列宽",缺一都会
  出问题(例如只留 1 不留 2,列宽仍占 360px 但里面空了一块;只留 2 不留 1,DOM
  还在只是视觉上宽度归零,仍占用 tab 焦点顺序/无障碍树)。

  System/Resources 两个 tab 是分开的任务(Task 11 SystemTab、Task 12
  ResourcesTab),Resources 是 v-else 兜底分支(未知 tab 值也落这里,与 Vue2
  AgentRightPanel.vue:15-16 逐字一致)。本任务只用占位 div 占住这两个分支的位置,
  真实内容留给对应任务替换——不要在这里顺手实现它们。
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ActivityTab from '../tabs/ActivityTab.vue'
import ContextTab from '../tabs/ContextTab.vue'
import type { ActivityStep } from '../tabs/ActivityTab.vue'
import type { StagedGroup } from '../../stores/agentStore'

const props = withDefaults(
  defineProps<{
    collapsed?: boolean
    tab?: 'activity' | 'context' | 'system' | 'resources'
    activitySteps?: ActivityStep[]
    systemMetrics?: Record<string, unknown>
    storage?: Record<string, unknown> | null
    busy?: boolean
    sessionId?: string
    visibleResources?: Record<string, unknown>[]
    attachments?: Record<string, unknown>[]
    stagedChanges?: StagedGroup[]
    committing?: boolean
    reverting?: Record<string, boolean>
  }>(),
  {
    collapsed: false,
    tab: 'activity',
    activitySteps: () => [],
    systemMetrics: () => ({}),
    storage: null,
    busy: false,
    sessionId: '',
    visibleResources: () => [],
    attachments: () => [],
    stagedChanges: () => [],
    committing: false,
    reverting: () => ({}),
  },
)

const emit = defineEmits<{
  (e: 'set-tab', tab: string): void
  (e: 'remove-resource', id: string | number): void
  (e: 'remove-attachment', id: string | number): void
  (e: 'revert-run', runId: string | number): void
  (e: 'revert-batch', batchId: string | number): void
  (e: 'revert-item', stagedId: string | number): void
  (e: 'commit-all'): void
}>()

// Vue2 AgentRightPanel.vue:59-61 —— `this.stagedChanges.reduce((n, g) => n +
// g.items.length, 0)`. Defensive here (brief-mandated): a group can exist in
// the streamed data before its `items` array is populated, so guard with `?? []`
// rather than assuming `items` is always an array.
const pendingCount = computed(() =>
  props.stagedChanges.reduce((n, g) => n + (g.items?.length ?? 0), 0),
)

const { t } = useI18n()
</script>

<template>
  <aside v-if="!collapsed" class="rightpanel">
    <div class="right-tabs">
      <button class="right-tab" :data-active="tab === 'activity'" @click="emit('set-tab', 'activity')">{{ t('aiTabActivity') }}</button>
      <button class="right-tab" :data-active="tab === 'context'" @click="emit('set-tab', 'context')">{{ t('aiTabContext') }}</button>
      <button class="right-tab" :data-active="tab === 'system'" @click="emit('set-tab', 'system')">{{ t('aiTabSystem') }}</button>
      <button class="right-tab" :data-active="tab === 'resources'" @click="emit('set-tab', 'resources')">
        {{ t('aiTabResources') }}<span v-if="pendingCount > 0" class="badge-pending">{{ pendingCount }}</span>
      </button>
    </div>
    <div class="right-content scroll">
      <ActivityTab v-if="tab === 'activity'" :steps="activitySteps" :busy="busy" />
      <ContextTab v-else-if="tab === 'context'" />
      <!-- SystemTab lands in SP8-P1c2 Task 11 (live utilization + storage card).
           Replaces this div with <SystemTab :system-metrics="systemMetrics" :storage="storage" />. -->
      <div v-else-if="tab === 'system'" data-testid="system-tab-placeholder" />
      <!-- ResourcesTab lands in SP8-P1c2 Task 12 (authorized resources /
           attachments / staged changes, three-tier revert). This is Vue2's
           v-else fallback branch — an unrecognised tab value lands here too,
           matching AgentRightPanel.vue:15-30 exactly. Task 12 replaces this
           div with the real <ResourcesTab> wired to the props/emits already
           declared above. -->
      <div v-else data-testid="resources-tab-placeholder" />
    </div>
  </aside>
</template>

<style scoped>
/* Vue2 AgentRightPanel.vue:66-80 <style scoped> —— .badge-pending isn't part of
   agent-styles.scss (that file only owns .rightpanel/.right-tabs/.right-tab/
   .right-content/.activity-*), it was always this component's own scoped
   style, so it's ported here rather than touching the shared scss file.
   Vue2:76 raw `color: white` → `var(--text-on-accent)` (only bare colour). */
.badge-pending {
  display: inline-block;
  margin-left: 4px;
  min-width: 16px;
  padding: 0 5px;
  font-size: 10px;
  font-weight: 600;
  border-radius: 8px;
  background: var(--danger);
  color: var(--text-on-accent);
  line-height: 14px;
  text-align: center;
}
</style>
