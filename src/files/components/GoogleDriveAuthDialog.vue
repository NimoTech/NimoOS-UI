<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import Dialog from '../../components/ui/Dialog.vue'
import { useToast } from '../../stores/toast'

// Google Drive BYO:用户填自己 Google Cloud 项目的 OAuth 凭据,换取授权 URL。
// client_secret 只进 POST body,绝不进 URL/日志/toast。
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'auth-url', url: string): void }>()
const { t } = useI18n()
const toast = useToast()

const clientId = ref('')
const clientSecret = ref('')
const connecting = ref(false)
// 指引页由设备静态根(Vue2 www)伺服,非 /app/ —— 与驱动图标同款 SP10 迁移债
const guideUrl = window.location.origin + '/guide/google-drive.html'

watch(() => props.open, (o) => {
  if (!o) return
  clientId.value = ''
  clientSecret.value = ''
  connecting.value = false
})

const canConnect = computed(() => !!clientId.value.trim() && !!clientSecret.value.trim())

async function connect() {
  const id = clientId.value.trim()
  const secret = clientSecret.value.trim()
  if (!id || !secret || connecting.value) return
  connecting.value = true
  try {
    const url = await service.driver.googleDriveCustomAuth(id, secret)
    emit('auth-url', url)
    emit('update:open', false)
  } catch (e) {
    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
    toast.show(msg || t('filesGdriveFailed'))
  } finally {
    connecting.value = false
  }
}
</script>

<template>
  <Dialog :open="open" :title="t('filesGdriveTitle')" @update:open="emit('update:open', $event)">
    <div class="gdrive-form">
      <p class="gdrive-hint">
        {{ t('filesGdriveHint') }}
        <a :href="guideUrl" target="_blank" rel="noopener">{{ t('filesGdriveGuide') }}</a>
      </p>
      <label class="gdrive-label">{{ t('filesGdriveClientId') }}</label>
      <input
        class="ui-input"
        name="client_id"
        v-model="clientId"
        placeholder="xxxxxxxx.apps.googleusercontent.com"
        @keyup.enter="canConnect && connect()"
      />
      <label class="gdrive-label">{{ t('filesGdriveClientSecret') }}</label>
      <input
        class="ui-input"
        type="password"
        name="client_secret"
        v-model="clientSecret"
        @keyup.enter="canConnect && connect()"
      />
    </div>
    <template #footer>
      <button class="ui-btn" @click="emit('update:open', false)">{{ t('filesCancel') }}</button>
      <button class="ui-btn primary" :disabled="!canConnect || connecting" @click="connect">
        {{ connecting ? t('filesMountConnecting') : t('filesMountConnect') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
/* 表单皮肤与 NetworkStorageDialog 同款(scoped 各自持有,P2a 已接受的重复) */
.gdrive-form { display: flex; flex-direction: column; gap: 8px; min-width: 340px; }
.gdrive-hint { font-size: 13px; color: var(--fg-muted); margin: 0 0 6px; line-height: 1.5; }
.gdrive-hint a { color: var(--accent); text-decoration: underline; }
.gdrive-label { font-size: 13px; color: var(--fg-muted); }
.ui-input { width: 100%; box-sizing: border-box; padding: 9px 12px; border-radius: 10px; border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg); font-size: 14px; outline: none; }
.ui-input:focus { border-color: var(--accent); }
.ui-btn { padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px; }
.ui-btn.primary { background: color-mix(in srgb, var(--accent) 32%, transparent); border-color: var(--accent); }
.ui-btn:disabled { opacity: 0.4; cursor: default; }
</style>
