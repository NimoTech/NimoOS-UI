<!-- 1:1 移植自 Vue2 src/views/AI/Agent/blocks/ConfirmCard.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AgentIcon from '../icons/AgentIcon.vue'
import { useProvidedAgentStore } from '../../composables/useProvidedAgentStore'

const props = withDefaults(
  defineProps<{ confirmId?: string; action?: string; description?: string; command?: string }>(),
  { confirmId: '', action: '', description: '', command: '' },
)
const { t } = useI18n()
const store = useProvidedAgentStore()

const resolved = ref(false)
const resolvedValue = ref<boolean | null>(null)
const submitting = ref(false)
const error = ref('')

async function resolve(confirmed: boolean) {
  if (!props.confirmId) {
    error.value = t('aiConfirmInvalid')
    return
  }
  if (submitting.value) return
  submitting.value = true
  error.value = ''
  try {
    await store.confirmAgentAction(props.confirmId, confirmed)
    resolved.value = true
    resolvedValue.value = confirmed
  } catch (e: any) {
    const status = e && e.response && e.response.status
    const detail = e && e.response && e.response.data && e.response.data.detail
    if (status === 409) {
      error.value = t('aiConfirmExpired')
    } else {
      error.value = t('aiSubmitFailed', { detail: detail || (e && e.message) || t('aiUnknownError') })
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="card" style="border: 1px solid var(--warning); box-shadow: 0 0 0 4px var(--warning-ring)">
    <div class="card-head">
      <div class="card-head-icon" style="background: var(--warning-soft); color: var(--warning)">
        <AgentIcon name="bell" :size="14" />
      </div>
      <div style="flex: 1">
        <div class="card-title">{{ t('aiConfirmRequiredTitle', { action: action || t('aiHighRiskOperation') }) }}</div>
        <div class="card-sub">{{ t('aiConfirmWaitingApproval') }}</div>
      </div>
    </div>
    <div class="card-body">
      <div style="margin-bottom: 10px; color: var(--text-secondary); line-height: 1.55">
        {{ description }}
      </div>
      <div v-if="command" class="code-block" style="margin-bottom: 12px">{{ command }}</div>
      <div v-if="!resolved" style="display: flex; gap: 8px; align-items: center">
        <button class="composer-tool"
                style="padding: 7px 14px; background: var(--accent); color: var(--text-on-accent); border-radius: 999px; font-weight: 500"
                :disabled="submitting"
                @click="resolve(true)">
          <AgentIcon name="check" :size="13" /> {{ t('aiAccept') }}
        </button>
        <button class="composer-tool"
                style="padding: 7px 14px; background: var(--bg-elevated); border: 1px solid var(--line); border-radius: 999px"
                :disabled="submitting"
                @click="resolve(false)">
          <AgentIcon name="x" :size="13" /> {{ t('aiDeny') }}
        </button>
        <span v-if="error"
              style="font-size: 12px; color: var(--danger); margin-left: 4px">{{ error }}</span>
      </div>
      <div v-else style="font-size: 12px; color: var(--text-tertiary)">
        {{ resolvedValue ? t('aiAccepted') : t('aiDenied') }} · {{ new Date().toLocaleTimeString() }}
      </div>
    </div>
  </div>
</template>
