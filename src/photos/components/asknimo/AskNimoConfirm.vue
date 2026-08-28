<!-- Confirm / access_request card for Ask Nimo. Pixel source: the Vue 2 panel's
     src/views/Photos/PhotosAgentConfirm.vue (markup + logic) + ported .pac-* rules.
     No <style> block: pixel coverage comes entirely from parity scss (Constraints #12). -->
<script lang="ts">
// Preflight F-11: a plain (non-setup) <script> block so this interface is a real named export
// of the .vue module -- `interface`/`type` declared inside <script setup> are file-local and
// cannot be imported by T9's AskNimoChat.vue.
import type { AgentBlock } from '../../../ai/types'

export interface ConfirmLikeBlock extends AgentBlock {
  confirmId?: string
  action?: string
  description?: string
  command?: string
  path?: string
  reason?: string
  decided?: boolean
  granted?: boolean
}
</script>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAgentStore } from '../../../ai/stores/agentStore'

const props = defineProps<{ block: ConfirmLikeBlock }>()
const { t } = useI18n()
const agent = useAgentStore('photos')

const isConfirm = computed(() => props.block.type === 'confirm')
const codeLine = computed(() => (isConfirm.value ? props.block.command : props.block.path) || '')

const submitting = ref(false)
const error = ref('')
const resolved = ref(!!props.block.decided)
const resolvedValue = ref<boolean | null>(props.block.decided ? !!props.block.granted : null)

async function decide(confirmed: boolean): Promise<void> {
  if (submitting.value || resolved.value) return
  const confirmId = props.block.confirmId
  if (!confirmId) {
    error.value = t('photosConfirmMissingId')
    return
  }
  submitting.value = true
  error.value = ''
  try {
    await agent.confirmAgentAction(confirmId, confirmed, false)
    resolved.value = true
    resolvedValue.value = confirmed
  } catch (e: unknown) {
    const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      || (e as Error)?.message || t('photosUnknownError')
    error.value = t('photosSubmissionFailed', { detail })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="pac-wrap">
    <div class="pac-desc">
      <template v-if="isConfirm">{{ t('photosConfirmAction', { action: block.action || '' }) }}</template>
      <template v-else>{{ t('photosRequestingAccess', { reason: block.reason || '' }) }}</template>
    </div>
    <div v-if="codeLine" class="pac-code">{{ codeLine }}</div>
    <div v-if="!resolved" class="pac-btns">
      <button type="button" class="pac-btn pac-btn-allow" :disabled="submitting" @click="decide(true)">{{ t('photosAllow') }}</button>
      <button type="button" class="pac-btn pac-btn-deny" :disabled="submitting" @click="decide(false)">{{ t('photosDeny') }}</button>
      <span v-if="error" class="pac-err">{{ error }}</span>
    </div>
    <div v-else class="pac-result" :class="resolvedValue ? 'pac-result-allow' : 'pac-result-deny'">
      {{ resolvedValue ? t('photosAllowed') : t('photosDenied') }}
    </div>
  </div>
</template>
