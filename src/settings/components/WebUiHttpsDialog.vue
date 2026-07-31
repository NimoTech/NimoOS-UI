<script setup lang="ts">
// 对位 Vue2 WebUIHTTPSModal.vue(334 行)。6 行:主域名 / 生效时间 / 过期时间 / 端口 /
// SSL 证书类型 /(auto 时)信任证书下载 或(custom 时)PEM+CRT 上传位。
// 保存顺序照 Vue2:custom 且选了文件 → 先上传证书,成功后才保存配置。
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

// 交错路径守卫(newui-async-stale-guard):弹窗打开后 getSSLConfig 还没返回时,
// 用户可能已经手改了域名/端口/证书类型。迟到的服务端值到达时,如果用户已经动过
// 表单,就不要再用服务端的旧值整体覆盖 cfg —— 否则会把用户刚打的字冲掉。
// 就地放一个局部变量即可,不抽公共 composable(仓库里已有先例判过这个过早抽象)。
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
      // 只选一个不行:后端要成对的 pem + crt
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
        // 上传失败就不要再保存配置 —— 否则配置说 custom 而证书根本没上去
        console.warn('[settings] uploadSSLCert failed', e)
        error.value = t('settingsHttpsUploadFailed')
        return
      }
    }
    // 只下发这 4 个字段:effective_time / expiration_time 是后端只读产出
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
    error.value = t('settingsSaveFailed')   // 不关窗,让用户改了再试
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
