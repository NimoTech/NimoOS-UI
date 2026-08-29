<!--
  1:1 ported from Vue2 src/views/AI/Agent/shell/AgentRightPanel.vue (80 lines). SP8-P1c2
  Task 10. Dumb component (props in, events out), the parent holds all state — Vue2 had no
  emits declaration (Vue2 doesn't require one), added here per Vue3 convention.

  Dual collapse mechanism (both are required, per the brief):
  1) This component's `v-if="!collapsed"` — the entire <aside> doesn't render when collapsed=true.
  2) The page-level grid column width is zeroed via the `data-rightcollapsed` attribute on
     AgentPage's root node (Task 2 already landed this; Task 13 actually mounted this component
     into AgentPage).
  The two mechanisms separately handle "is this DOM present in the component tree" and "does the
  layout grid reserve column width for it" — missing either one causes problems (e.g. keeping only
  1 without 2 leaves the 360px column reserved but empty inside; keeping only 2 without 1 leaves
  the DOM present with its width visually zeroed, still occupying tab focus order / the a11y tree).

  SP8-P1c2 Task 13 — all four tabs are now wired to the real thing: SystemTab (Task 11) /
  ResourcesTab (Task 12) replace the two placeholder divs left by Task 10. Resources is still
  the v-else fallback branch (an unknown tab value also lands here, matching Vue2
  AgentRightPanel.vue:15-16 verbatim). ResourcesTab's 6 emits are forwarded as-is to the parent
  (AgentPage) here; this component never touches the store.
  (After the F1 final-review fix, ResourcesTab gained a 7th emit, `remove-resource-by-path`,
  forwarded the same way — see the template and the emits declaration comments below.)
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
    // Intentional deviation (user decided 2026-07-27, landed in Task 13): Vue2
    // AgentRightPanel.vue:48 has a `systemMetrics` prop (Agent.vue:48 passes
    // store.state.systemMetrics — a one-shot HTTP fetch on mounted, never refreshed
    // afterward). SystemTab in this repo instead consumes the ready-made real-time
    // channel useUtilization() (first-frame HTTP + ongoing MessageBus
    // nimoos:system:utilization pushes) and fetches its own data, so it doesn't need
    // this prop — hence systemMetrics is **not declared** here, to avoid leaving a
    // dead prop nobody consumes. storage still goes through a prop (capacity doesn't
    // need to be real-time, same as Vue2).
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
  // Task 13: `set-tab`'s payload is narrowed to the four literals (only these four
  // buttons in the template can emit it), so the parent can hand it straight to
  // store.setRightTab (the same union type) without a cast.
  (e: 'set-tab', tab: 'activity' | 'context' | 'system' | 'resources'): void
  (e: 'remove-resource', id: string | number): void
  // F1 fix (final-review opus pass) — the 7th emit added to ResourcesTab, forwarded
  // as-is to AgentPage (see the comment at its declaration in ResourcesTab.vue).
  (e: 'remove-resource-by-path', path: string): void
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
      <!-- Vue2 AgentRightPanel.vue:14 is `<SystemTab :system-metrics="systemMetrics"
           :storage="storage" />`; see the intentional-deviation note near the props
           above for systemMetrics. -->
      <SystemTab v-else-if="tab === 'system'" :storage="storage" />
      <!-- Vue2 AgentRightPanel.vue:15-30 — the v-else fallback branch (an unknown
           tab value also lands here), 7 props + 6 emits matched one-to-one (after
           the F1 final-review fix, this component also forwards the 7th emit
           `remove-resource-by-path` as-is, see the file-header comment above). -->
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
        @remove-resource-by-path="emit('remove-resource-by-path', $event)"
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
