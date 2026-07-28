<!--
  1:1 移植自 Vue2 src/views/AI/Agent/shell/AgentRightPanel.vue(80 行)。SP8-P1c2
  Task 10。哑组件(props 进、events 出),父组件持有全部状态——Vue2 没有 emits
  声明(Vue2 不强制),本期按 Vue3 惯例补上。

  双重折叠机制(两者都要,brief 明确指出):
  1) 本组件的 `v-if="!collapsed"` —— collapsed=true 时整个 <aside> 不渲染。
  2) 页面级 grid 列宽通过 AgentPage 根节点的 `data-rightcollapsed` 属性归零
     (Task 2 已落地;Task 13 已把本组件真正挂进 AgentPage)。
  两个机制分别处理"组件树里有没有这坨 DOM"和"布局网格给不给它留列宽",缺一都会
  出问题(例如只留 1 不留 2,列宽仍占 360px 但里面空了一块;只留 2 不留 1,DOM
  还在只是视觉上宽度归零,仍占用 tab 焦点顺序/无障碍树)。

  SP8-P1c2 Task 13 —— 四个 tab 全部接真:SystemTab(Task 11)/ ResourcesTab
  (Task 12)替换掉 Task 10 留的两个占位 div。Resources 仍是 v-else 兜底分支
  (未知 tab 值也落这里,与 Vue2 AgentRightPanel.vue:15-16 逐字一致)。
  ResourcesTab 的 6 个 emit 在这里原样上抛给父组件(AgentPage),本组件不碰 store。
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ActivityTab from '../tabs/ActivityTab.vue'
import ContextTab from '../tabs/ContextTab.vue'
import SystemTab from '../tabs/SystemTab.vue'
import ResourcesTab from '../tabs/ResourcesTab.vue'
import type { ActivityStep } from '../tabs/ActivityTab.vue'
import type { ResourceAttachment } from '../tabs/ResourcesTab.vue'
import type { StagedGroup, VisibleResource } from '../../stores/agentStore'
import type { StoragePayload } from '../../util/toStoragePayload'

const props = withDefaults(
  defineProps<{
    collapsed?: boolean
    tab?: 'activity' | 'context' | 'system' | 'resources'
    activitySteps?: ActivityStep[]
    // 有意偏离(用户 2026-07-27 拍板,Task 13 落地):Vue2 AgentRightPanel.vue:48 有
    // 一个 `systemMetrics` prop(Agent.vue:48 传 store.state.systemMetrics —— mounted
    // 时一次性 HTTP 拉、之后从不刷新)。本仓 SystemTab 改吃 New-UI 现成的实时通道
    // useUtilization()(首帧 HTTP + MessageBus nimoos:system:utilization 持续推送),
    // 自己取数,不需要这个 prop —— 所以这里**不声明** systemMetrics,避免留一个
    // 无人消费的死 prop。storage 仍走 prop(容量不需要实时,与 Vue2 同)。
    storage?: StoragePayload | null
    busy?: boolean
    sessionId?: string
    visibleResources?: VisibleResource[]
    attachments?: ResourceAttachment[]
    stagedChanges?: StagedGroup[]
    committing?: boolean
    reverting?: Record<string, boolean>
  }>(),
  {
    collapsed: false,
    tab: 'activity',
    activitySteps: () => [],
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
  // Task 13:`set-tab` 的载荷收窄成四个字面量(模板里就只有这四个按钮能发它),
  // 这样父组件可以直接把它交给 store.setRightTab(同款联合类型)而不必 cast。
  (e: 'set-tab', tab: 'activity' | 'context' | 'system' | 'resources'): void
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
      <!-- Vue2 AgentRightPanel.vue:14 是 `<SystemTab :system-metrics="systemMetrics"
           :storage="storage" />`;systemMetrics 见上方 props 处的有意偏离说明。 -->
      <SystemTab v-else-if="tab === 'system'" :storage="storage" />
      <!-- Vue2 AgentRightPanel.vue:15-30 —— v-else 兜底分支(未知 tab 值也落这里),
           7 个 prop + 6 个 emit 逐条对齐。 -->
      <ResourcesTab
        v-else
        :session-id="sessionId"
        :visible-resources="visibleResources"
        :attachments="attachments"
        :staged-changes="stagedChanges"
        :busy="busy"
        :committing="committing"
        :reverting="reverting"
        @remove-resource="emit('remove-resource', $event)"
        @remove-attachment="emit('remove-attachment', $event)"
        @revert-run="emit('revert-run', $event)"
        @revert-batch="emit('revert-batch', $event)"
        @revert-item="emit('revert-item', $event)"
        @commit-all="emit('commit-all')"
      />
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
