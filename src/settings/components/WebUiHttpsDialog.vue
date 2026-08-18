<script setup lang="ts">
// Counterpart of Vue2 WebUIHTTPSModal.vue (334 lines). 6 rows: main domain / effective time /
// expiration time / port / SSL cert type / (auto) trusted-cert download or (custom) PEM+CRT upload slots.
// Save order follows Vue2: custom with files picked → upload the cert first, save config only on success.
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type SSLConfig } from '@nimotech/nimoos-service'
import Dialog from '../../components/ui/Dialog.vue'
import { formatSslDate } from '../util/sslDate'
import { useToast } from '../../stores/toast'
import '../styles/settings.css'

defineOptions({ name: 'WebUiHttpsDialog' })
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean]; saved: [] }>()

const { t } = useI18n()
const toast = useToast()

const cfg = ref<SSLConfig>({
  enabled: true, domain: 'nimoos.local', port: '443', cert_type: 'auto',
  effective_time: '', expiration_time: '',
})
const pemFile = ref<File | null>(null)
const crtFile = ref<File | null>(null)
const saving = ref(false)
const error = ref('')

// Interleaved-path guard (newui-async-stale-guard): while getSSLConfig is still pending after
// the dialog opens, the user may have already hand-edited domain/port/cert type. When the late
// server value arrives, don't wholesale overwrite cfg with the stale server value if the user
// has touched the form — that would wipe what they just typed.
// A local variable in place is enough; no shared composable (the repo already has precedent ruling this premature abstraction out).
let editedDuringLoad = false
function markEdited() { editedDuringLoad = true }

watch(() => props.open, async (o) => {
  if (!o) return
  error.value = ''
  pemFile.value = null
  crtFile.value = null
  editedDuringLoad = false
  try {
    const c = await service.sys.getSSLConfig()
    if (editedDuringLoad) return
    cfg.value = c
  } catch (e) {
    console.warn('[settings] getSSLConfig failed', e)
  }
}, { immediate: true })

function onPick(which: 'pem' | 'crt', e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null
  if (which === 'pem') pemFile.value = f
  else crtFile.value = f
}

async function save() {
  error.value = ''
  saving.value = true
  try {
    if (cfg.value.cert_type === 'custom' && (pemFile.value || crtFile.value)) {
      // Picking only one is not allowed: the backend requires a paired pem + crt
      if (!pemFile.value || !crtFile.value) {
        error.value = t('settingsHttpsBothFiles')
        return
      }
      const fd = new FormData()
      fd.append('pem', pemFile.value)
      fd.append('crt', crtFile.value)
      try {
        await service.sys.uploadSSLCert(fd)
      } catch (e) {
        // If the upload fails, don't save the config — otherwise the config says custom while no cert was ever uploaded
        console.warn('[settings] uploadSSLCert failed', e)
        error.value = t('settingsHttpsUploadFailed')
        return
      }
    }
    // Send only these 4 fields: effective_time / expiration_time are backend read-only outputs
    await service.sys.setSSLConfig({
      enabled: cfg.value.enabled,
      domain: cfg.value.domain,
      port: String(cfg.value.port),
      cert_type: cfg.value.cert_type,
    })
    toast.show(t('settingsSaveSuccess'))
    emit('saved')
    emit('update:open', false)
  } catch (e) {
    console.warn('[settings] setSSLConfig failed', e)
    error.value = t('settingsSaveFailed')   // Keep the dialog open so the user can adjust and retry
  } finally {
    saving.value = false
  }
}

function downloadCa() {
  window.open('/v1/gateway/ssl/ca', '_blank')
}
</script>

<template>
  <Dialog :open="open" :title="t('settingsHttpsTitle')" @update:open="emit('update:open', $event)">
    <div class="wh-body">
      <label class="wh-row">
        <span class="wh-key">{{ t('settingsHttpsDomain') }}</span>
        <input
          v-model="cfg.domain"
          class="set-input wh-domain"
          type="text"
          :disabled="saving"
          @input="markEdited"
        />
      </label>

      <div class="wh-row">
        <span class="wh-key">{{ t('settingsHttpsEffective') }}</span>
        <span class="wh-date">{{ formatSslDate(cfg.effective_time) }}</span>
      </div>
      <div class="wh-row">
        <span class="wh-key">{{ t('settingsHttpsExpiration') }}</span>
        <span class="wh-date">{{ formatSslDate(cfg.expiration_time) }}</span>
      </div>

      <label class="wh-row">
        <span class="wh-key">{{ t('settingsHttpsPort') }}</span>
        <input
          v-model="cfg.port"
          class="set-input wh-port"
          type="text"
          inputmode="numeric"
          :disabled="saving"
          @input="markEdited"
        />
      </label>

      <label class="wh-row">
        <span class="wh-key">{{ t('settingsHttpsCert') }}</span>
        <select v-model="cfg.cert_type" class="set-select wh-cert" :disabled="saving" @change="markEdited">
          <option value="auto">{{ t('settingsHttpsCertAuto') }}</option>
          <option value="custom">{{ t('settingsHttpsCertCustom') }}</option>
        </select>
      </label>

      <div v-if="cfg.cert_type === 'auto'" class="wh-row">
        <span class="wh-key">{{ t('settingsHttpsTrust') }}</span>
        <button class="set-btn wh-ca" type="button" @click="downloadCa">
          {{ t('settingsHttpsDownloadCa') }}
        </button>
      </div>

      <div v-else class="wh-row wh-upload">
        <span class="wh-key">{{ t('settingsHttpsCertFiles') }}</span>
        <span class="wh-files">
          <label class="set-btn">
            PEM
            <input type="file" class="wh-file" :disabled="saving" @change="onPick('pem', $event)" />
          </label>
          <label class="set-btn">
            CRT
            <input type="file" class="wh-file" :disabled="saving" @change="onPick('crt', $event)" />
          </label>
        </span>
      </div>

      <p v-if="pemFile || crtFile" class="wh-picked">
        <span v-if="pemFile">PEM: {{ pemFile.name }}</span>
        <span v-if="crtFile">CRT: {{ crtFile.name }}</span>
      </p>
      <p v-if="error" class="set-danger">{{ error }}</p>
    </div>

    <template #footer>
      <button class="set-btn primary wh-save" type="button" :disabled="saving" @click="save">
        {{ t('settingsSave') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.wh-body { display: flex; flex-direction: column; gap: 4px; min-width: min(480px, 84vw); }
.wh-row {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 12px 0; border-bottom: 1px solid var(--border); font-size: 14px;
}
.wh-row:last-of-type { border-bottom: 0; }
.wh-key { color: var(--fg-muted); flex: 0 0 auto; }
.wh-date { font-weight: 500; }
.wh-files { display: flex; gap: 8px; }
.wh-file { display: none; }
.wh-picked {
  display: flex; flex-direction: column; gap: 2px; margin: 4px 0 0;
  font-size: 12px; color: var(--fg-muted); text-align: right;
}
</style>
