<!--
  1:1 移植自 Vue2 src/views/AI/Agent/tabs/ActivityTab.vue(55 行)。SP8-P1c2 Task 10。

  步骤列表:`.activity-step`/`.activity-bullet[data-state]`/`.activity-title`/
  `.activity-meta` 四个 class 由 src/ai/styles/agent-styles.scss:433-451 提供
  (已 1:1 港入,本组件不新增/不改样式规则)。头部标题 + busy 载入态 + 空态三处
  Vue2 用的是行内 style(scss 里没有对应 class),原样保留内联样式而非新造 class。

  formatDuration 抽到 ../../util/formatDuration.ts(纯函数 + 独立单测)。Vue2 原
  函数 falsy 分支返回字面量 'Done'(未 i18n);本期政策要求给这类字面量补键,
  纯函数改返回 `null` 哨兵,这里映射成 t('aiActivityDone')。
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
