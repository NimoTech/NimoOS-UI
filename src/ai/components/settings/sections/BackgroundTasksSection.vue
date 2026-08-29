<!--
  Settings parity (2026-08-24) — ported 1:1 from Vue2
  src/views/AI/Settings/sections/BackgroundTasksSection.vue (notes M1,
  UI PR #101; the section was missed in the original SP8 port sweep).

  Picks the model used by unattended background jobs (document distillation).
  Saving the EMPTY string is a valid selection — it keeps the feature off —
  which is why the select carries an explicit "not configured" option instead
  of a disabled placeholder.

  Model options: Vue2 uses the shared listModelOptions(); this repo has no
  such helper, so the two-independent-try/catch load (local via listModels,
  cloud via listProviders + buildCloudModelList) follows the established
  ChannelsSection.vue loadModels precedent verbatim.

  Zero <style> block per section convention; everything here uses existing
  set-*/sk-* classes, nothing new to add to settings-styles.scss.
-->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { buildCloudModelList, type AgentModel } from '../../../stores/agentStore'

const { t } = useI18n()

const model = ref('')
const options = ref<AgentModel[]>([])
const saving = ref(false)
const loaded = ref(false)
const error = ref('')

const isConfigured = computed(() => !!model.value)
// Guards against saving before the initial load resolves: if getNotesSettings()
// rejected, `model` is still '' and a click would silently PUT
// backgroundModel: '', wiping a previously-configured value. (Vue2 :51-56.)
const saveDisabled = computed(() => saving.value || !loaded.value)

// Disambiguates cloud entries sharing a model name across providers; local
// entries just show the bare model name. (Vue2 :64-70.)
function optionLabel(m: AgentModel) {
  return m.source === 'cloud' && m.providerName
    ? `${m.displayName} (${m.providerName})`
    : m.displayName
}

// Vue2 wraps listModelOptions() in its own try/catch returning [] — options
// failing to load must not blank the currently-saved model. Same here, with
// the local and cloud halves additionally independent (ChannelsSection
// precedent: either source failing leaves the other usable).
async function loadOptions(): Promise<AgentModel[]> {
  const models: AgentModel[] = []
  try {
    const body = (await service.ai.listModels()) as
      | { models?: Array<{ name?: string; size?: number }> }
      | Array<{ name?: string; size?: number }>
      | null
      | undefined
    const list = (body && (Array.isArray(body) ? body : body.models || body)) || []
    for (const m of list as Array<{ name?: string; size?: number }>) {
      if (!m || !m.name) continue
      models.push({ key: 'local:' + m.name, source: 'local', displayName: m.name, size: m.size })
    }
  } catch {
    /* local models optional */
  }
  try {
    const provs = await service.ai.listProviders()
    models.push(...buildCloudModelList(provs || []))
  } catch {
    /* cloud models optional */
  }
  return models
}

async function load() {
  try {
    const s = await service.notes.getNotesSettings()
    model.value = s.backgroundModel
    options.value = await loadOptions()
  } catch (e) {
    error.value = String((e as Error | null)?.message || e)
  } finally {
    loaded.value = true
  }
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    const s = await service.notes.putNotesSettings({ backgroundModel: model.value })
    model.value = s.backgroundModel
  } catch (e) {
    error.value = String((e as Error | null)?.message || e)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="set-inner">
    <div class="set-page-head">
      <h1 class="set-h1">{{ t('aiCfgBackgroundTasks') }}</h1>
      <p class="set-desc">{{ t('aiCfgBackgroundDesc') }}</p>
    </div>

    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgBackgroundModel') }}</div>
      </div>
      <div class="sk-section-body">
        <div class="set-rows">
          <div class="set-row">
            <div class="lbl">{{ t('aiCfgBackgroundModel') }}</div>
            <div class="val end">
              <select v-model="model" class="set-select" :disabled="saving" data-test="bg-model">
                <option value="">{{ t('aiCfgBackgroundNotConfigured') }}</option>
                <option v-for="m in options" :key="m.key" :value="m.key">{{ optionLabel(m) }}</option>
              </select>
            </div>
          </div>
        </div>

        <div v-if="error" class="set-banner warn" data-test="bg-error">{{ error }}</div>
        <div v-else-if="!isConfigured" class="set-banner">
          {{ t('aiCfgBackgroundOffHint') }}
        </div>

        <div class="set-actions">
          <button class="sk-btn primary" :disabled="saveDisabled" data-test="bg-save" @click="save">
            {{ t('aiCfgSave') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
