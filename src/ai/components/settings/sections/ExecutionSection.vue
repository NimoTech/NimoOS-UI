<!--
  SP8-P2b Task 5 —— 1:1 移植自 Vue2 src/views/AI/Settings/sections/ExecutionSection.vue(80 行)。

  【D2 申报】状态留在组件本地(ref)、直调 service.ai —— 与 Vue2 归属一致,不做
  store 集中。用户 2026-07-28 拍板。

  【逻辑修正 1】Vue2 `save()` 通篇没有 catch(ExecutionSection.vue:66-79):
  putMaxTurns 失败时 finally 把 saving 复位,用户看到「保存中…」一闪而过就没了,
  以为存上了,实际没存。这里补 catch + danger toast。
  【逻辑修正 2】Vue2 `savedAt` 一旦置上永不清零,「已保存」字样永久挂在页面上
  (即使之后又改了值没保存)。这里改成 2 秒后自动消失,并在卸载时清掉定时器
  (Vue2 连定时器都没有,不存在这个问题;新引入的定时器必须自己收尾)。
-->
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useToast } from '../../../../stores/toast'
import { apiErrorMessage } from '../../../util/apiError'
import AgentIcon from '../../icons/AgentIcon.vue'
import SetSwitch from '../SetSwitch.vue'

const { t } = useI18n()
const toast = useToast()

const steps = ref(10)
const unlimited = ref(false)
const saving = ref(false)
const savedAt = ref(0)
let savedTimer: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
  try {
    const d = await service.ai.getMaxTurns()
    const v = Number((d as { max_turns?: unknown } | null)?.max_turns)
    if (v === 0) unlimited.value = true
    else steps.value = v || 10
  } catch {
    /* Vue2 ExecutionSection.vue:57 同样静默;失败时留默认 10 */
  }
})

onUnmounted(() => {
  if (savedTimer) clearTimeout(savedTimer)
})

function markSaved() {
  savedAt.value = 1
  if (savedTimer) clearTimeout(savedTimer)
  savedTimer = setTimeout(() => { savedAt.value = 0 }, 2000)
}

async function save() {
  // 无限 → 0;否则取正整数(<1 归一为 1)。与 Vue2 :68-72 逐字一致。
  let value = 0
  if (!unlimited.value) {
    value = Math.max(1, Math.floor(Number(steps.value) || 10))
    steps.value = value
  }
  saving.value = true
  try {
    await service.ai.putMaxTurns(value)
    markSaved()
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgSaveFailed')), 3000, 'danger')
  } finally {
    saving.value = false
  }
}

function onToggleUnlimited(v: boolean) {
  unlimited.value = v
  void save()
}
</script>

<template>
  <div class="set-inner">
    <div class="set-page-head">
      <h1 class="set-h1">{{ t('aiCfgExecutionSteps') }}</h1>
      <p class="set-desc">{{ t('aiCfgExecutionDesc') }}</p>
    </div>

    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgMaxStepsPerTask') }}</div>
      </div>
      <div class="sk-section-body">
        <div class="set-banner">
          <span class="ico"><AgentIcon name="refresh" :size="12" /></span>
          <span>{{ t('aiCfgExecutionBanner') }}</span>
        </div>
        <div class="set-rows">
          <div class="set-row">
            <div class="lbl">{{ t('aiCfgUnlimitedSteps') }}</div>
            <div class="val end">
              <SetSwitch :model-value="unlimited" @change="onToggleUnlimited" />
            </div>
          </div>
          <div class="set-row">
            <div class="lbl">{{ t('aiCfgMaxSteps') }}</div>
            <div class="val end">
              <input
                class="set-input num" type="number" min="1" step="1" v-model.number="steps"
                :disabled="unlimited" @change="save"
              >
            </div>
          </div>
        </div>
        <span class="set-actions"><span class="hint">{{ saving ? t('aiCfgSaving') : (savedAt ? t('aiCfgSaved') : '') }}</span></span>
      </div>
    </div>
  </div>
</template>
