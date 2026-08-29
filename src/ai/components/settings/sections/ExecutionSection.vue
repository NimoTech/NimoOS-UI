<!--
  SP8-P2b Task 5 — 1:1 port from Vue2 src/views/AI/Settings/sections/ExecutionSection.vue (80 lines).

  【D2 Declaration】 State stays local to the component (ref), directly calls service.ai —
  consistent with Vue2's approach, not centralizing to store. User decided 2026-07-28.

  【Logic Fix 1】 Vue2's `save()` has no catch block throughout (ExecutionSection.vue:66-79):
  when putMaxTurns fails, finally resets saving, user sees "Saving..." flash and disappear,
  thinks it was saved, but it wasn't. Adding catch + danger toast here.
  【Logic Fix 2】 Vue2's `savedAt` once set never clears; "Saved" text stays on the page
  permanently even if user changes value without saving afterward. Changed here to auto-clear
  after 2 seconds, and clean up timer on unmount (Vue2 has no timer so this wasn't an issue;
  any new timer introduced must clean up after itself).
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
    /* Vue2 ExecutionSection.vue:57 is also silent; on failure leave default 10 */
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
  // Unlimited → 0; otherwise take positive integer (<1 normalized to 1). Identical to Vue2 :68-72.
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
