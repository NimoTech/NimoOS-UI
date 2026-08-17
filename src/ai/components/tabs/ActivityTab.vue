<!--
  1:1 port from Vue2 src/views/AI/Agent/tabs/ActivityTab.vue (55 lines). SP8-P1c2 Task 10.

  Step list: `.activity-step`/`.activity-bullet[data-state]`/`.activity-title`/
  `.activity-meta` four classes provided by src/ai/styles/agent-styles.scss:433-451
  (ported 1:1, this component doesn't add/modify style rules). Header title + busy loading state +
  empty state — Vue2 uses inline style in these three places (no corresponding class in scss),
  kept as inline styles rather than creating new classes.

  formatDuration extracted to ../../util/formatDuration.ts (pure function + standalone tests).
  Vue2 original function returns literal 'Done' in falsy branch (not i18n'd); this phase's policy
  requires adding keys for such literals; pure function changed to return `null` sentinel, mapped
  here to t('aiActivityDone').
-->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AgentIcon from '../icons/AgentIcon.vue'
import { formatDuration } from '../../util/formatDuration'

export interface ActivityStep {
  id: string | number
  name: string
  state: string
  durationMs?: number
  [k: string]: unknown
}

withDefaults(
  defineProps<{
    steps?: ActivityStep[]
    busy?: boolean
  }>(),
  {
    steps: () => [],
    busy: false,
  },
)

const { t } = useI18n()
</script>

<template>
  <div>
    <div style="font-size: 12px; color: var(--text-tertiary); margin-bottom: 10px;
                font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px">
      {{ t('aiActivityHeader') }}
    </div>

    <template v-if="steps.length > 0">
      <div v-for="step in steps" :key="step.id" class="activity-step">
        <div class="activity-bullet" :data-state="step.state" />
        <div style="flex: 1">
          <div class="activity-title">{{ step.name }}</div>
          <div class="activity-meta">
            <template v-if="step.state === 'success'">
              {{ formatDuration(step.durationMs) ?? t('aiActivityDone') }}
            </template>
            <template v-else-if="step.state === 'running'">{{ t('aiActivityRunning') }}</template>
            <template v-else>{{ t('aiActivityWaiting') }}</template>
          </div>
        </div>
      </div>
    </template>

    <div v-else-if="busy"
         style="padding: 20px; text-align: center; color: var(--text-tertiary); font-size: 12px">
      <span class="dots"><span /><span /><span /></span> {{ t('aiActivityRunning') }}
    </div>

    <div v-else
         style="padding: 30px 16px; text-align: center; color: var(--text-tertiary); font-size: 12px">
      <AgentIcon name="layers" :size="32" color="var(--text-quaternary)" />
      <div style="margin-top: 12px">{{ t('aiActivityEmpty') }}</div>
    </div>
  </div>
</template>
