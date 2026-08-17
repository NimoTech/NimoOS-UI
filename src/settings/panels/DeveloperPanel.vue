<script setup lang="ts">
// Maps to Vue2 SettingsPanel.vue L326-348 (developer branch) + getSSLConfig / toggleHTTPS.
// The header uses a back button instead of an h1 (Vue2 L52-56); P0 already did this, kept as-is.
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type SSLConfig } from '@nimotech/nimoos-service'
import SettingsSection from '../components/SettingsSection.vue'
import SettingsRow from '../components/SettingsRow.vue'
import SettingsSwitch from '../components/SettingsSwitch.vue'
import WebUiHttpsDialog from '../components/WebUiHttpsDialog.vue'
import { useToast } from '../../stores/toast'
import '../styles/settings.css'

const { t } = useI18n()
const toast = useToast()
const emit = defineEmits<{ 'open-tab': [tab: string] }>()

const cfg = ref<SSLConfig | null>(null)
const enabled = ref(false)
const busy = ref(false)
const dialogOpen = ref(false)

// Interleaved-path guard (newui-async-stale-guard): load() asynchronously fetches the
// config on mount (and again after the dialog's saved event). If the user has already
// flipped the switch before it returns, the late server value must not bounce enabled
// back to the old value -- that would make the switch's displayed state lie (the user
// really did succeed). A local variable is enough; no need to extract a shared composable.
let editedDuringLoad = false

async function load() {
  editedDuringLoad = false
  try {
    const c = await service.sys.getSSLConfig()
    if (editedDuringLoad) return
    cfg.value = c
    enabled.value = c.enabled
  } catch (e) {
    console.warn('[settings] getSSLConfig failed', e)
  }
}
onMounted(load)

async function toggle(next: boolean) {
  if (busy.value) return
  editedDuringLoad = true
  const prev = enabled.value
  enabled.value = next
  busy.value = true
  try {
    // Fallback values match Vue2 toggleHTTPS verbatim (L1324-1330): domain nimoos.local, port 443, cert auto
    await service.sys.setSSLConfig({
      enabled: next,
      domain: cfg.value?.domain || 'nimoos.local',
      port: String(cfg.value?.port || '443'),
      cert_type: cfg.value?.cert_type || 'auto',
    })
    toast.show(t('settingsSaveSuccess'))
  } catch (e) {
    enabled.value = prev            // maps to Vue2 sslEnabled = !val
    console.warn('[settings] setSSLConfig failed', e)
    toast.show(t('settingsSaveFailed'))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <SettingsSection
    :title="t('settingsTabDeveloper')"
    back-to="general"
    @back="emit('open-tab', $event)"
  >
    <div class="set-list">
      <SettingsRow :label="t('settingsHttps')">
        <template #control>
          <SettingsSwitch
            :model-value="enabled"
            :label="t('settingsHttps')"
            :disabled="busy"
            @update:model-value="toggle"
          />
        </template>
      </SettingsRow>

      <!-- Only appears once HTTPS is enabled (maps to Vue2 v-if="sslEnabled") -->
      <SettingsRow
        v-if="enabled"
        class="dp-config"
        :label="t('settingsHttpsConfig')"
        clickable
        @click="dialogOpen = true"
      />
    </div>

    <WebUiHttpsDialog
      :open="dialogOpen"
      @update:open="dialogOpen = $event"
      @saved="load"
    />
  </SettingsSection>
</template>
