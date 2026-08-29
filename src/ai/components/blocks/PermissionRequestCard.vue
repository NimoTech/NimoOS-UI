<!-- 1:1 ported from Vue2 src/views/AI/Agent/blocks/PermissionRequestCard.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AgentIcon from '../icons/AgentIcon.vue'
import { useProvidedAgentStore } from '../../composables/useProvidedAgentStore'

const props = withDefaults(
  defineProps<{
    confirmId?: string
    path?: string
    kind?: string
    reason?: string
    decided?: boolean
    granted?: boolean
  }>(),
  { confirmId: '', path: '', kind: 'folder', reason: '', decided: false, granted: false },
)
const { t } = useI18n()
const store = useProvidedAgentStore()

const resolved = ref(props.decided)
const resolvedValue = ref<boolean | null>(props.decided ? props.granted : null)
const submitting = ref(false)
const error = ref('')

async function resolve(confirmed: boolean) {
  if (!props.confirmId) {
    error.value = t('aiAuthInvalid')
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
      // Intentional divergence from useConfirmResolve (src/ai/composables/useConfirmResolve.ts):
      // that composable turns 409 into a terminal "expired" state with an error message,
      // because for its three MCP confirm cards a 409 means the confirm_id is simply gone.
      // Here a 409 means the access request was already decided elsewhere -- another tab,
      // or before a reconnect -- not that this confirm_id never existed. Showing an error
      // would be misleading, so this silently marks the request resolved instead.
      resolved.value = true
      resolvedValue.value = confirmed
    } else {
      error.value = t('aiSubmitFailed', { detail: detail || (e && e.message) || t('aiUnknownError') })
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="card" style="border: 1px solid var(--accent); box-shadow: 0 0 0 4px var(--accent-softer)">
    <div class="card-head">
      <div class="card-head-icon" style="background: var(--accent-soft); color: var(--accent)">
        <AgentIcon name="folder" :size="14" />
      </div>
      <div style="flex: 1">
        <div class="card-title">{{ kind === 'file' ? t('aiRequestFileAccess') : t('aiRequestFolderAccess') }}</div>
        <div class="card-sub">{{ t('aiAuthNeeded') }}</div>
      </div>
    </div>
    <div class="card-body">
      <div style="margin-bottom: 6px; color: var(--text-secondary); line-height: 1.55">
        {{ reason || t('aiAuthReason') }}
      </div>
      <div class="code-block" style="margin-bottom: 12px">{{ path }}</div>
      <div v-if="!resolved" style="display: flex; gap: 8px; align-items: center">
        <button class="composer-tool"
                style="padding: 7px 14px; background: var(--accent); color: var(--text-on-accent); border-radius: 999px; font-weight: 500"
                :disabled="submitting"
                @click="resolve(true)">
          <AgentIcon name="check" :size="13" /> {{ t('aiAllow') }}
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
        {{ resolvedValue ? t('aiAllowed') : t('aiDenied') }}<span v-if="!decided"> · {{ new Date().toLocaleTimeString() }}</span>
      </div>
    </div>
  </div>
</template>
