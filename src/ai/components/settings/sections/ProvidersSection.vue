<!--
  Port 1:1 from Vue2
  `src/views/AI/Settings/sections/ProvidersSection.vue` (249 lines). Largest this sprint,
  three sections:

    1. Provider table: name / Base URL / protocol badge / enable toggle / actions (expand models ·
       edit · delete)
    2. Expandable "Models" sub-panel (row spanning colspan=5 in table): refresh models · manual add ·
       each model favorite toggle + 🧠 thinking marker + source badge + delete for manual items
    3. Inline form (not modal, another `sk-section` card below table): 4 preset chips (only on create) +
       name / Base URL / API Key / default model / protocol radio + save / cancel

  【Buefy → New-UI replacement】
  - $buefy.dialog.confirm (delete provider, :184-196) → shared AlertDialog, destructive. deleteDlg packs open
    and target provider in same ref (same pattern as ModelsSection.vue deleteDlg): reka AlertDialogAction
    emits update:open(false) then confirm, v-model:open only changes .open, confirm handler still reads correct provider.
  - $buefy.dialog.prompt (manual add model, :224-239) → T6 PromptDialog. Same pattern packing open+associated
    object (addModelDlg holds { open, provider }). title/confirmText reuse existing action names
    "+Manual Add" / "Add", not creating generic "Confirm" text (same as AgentSidebar.vue:192-200 precedent,
    referenced in ModelsSection.vue header comment).
  - toast three tiers: success/neutral → info (no third parameter); `Auto-fetch failed. You can add models manually.`
    → **warning tier** (Vue2 :214 is `is-warning`, not danger); remaining failures → danger.

  【Vue3 migration: one required change, not a behavior change】 Vue2 :28 is
  `<template v-for="p in store.state.providers">` with `:key="p.id"` placed on
  child element `<tr>`. Vue3 requires `<template v-for>` key directly on `<template>`
  itself (same as established precedent in ModelPicker.vue:120). In Vue2, each `p` produces two
  `<tr>` rows (main + expand row, originally with `:key="p.id"` and `:key="p.id + '-models'"`);
  moving key to template leaves one — Vue3 treats multiple root nodes under `<template>` as
  a group, which is correct, not a behavior change.

  【expanded is component local state, not in store】 Same as Vue2
  `data() { return { expanded: {} } }` — which provider models panel is expanded is pure UI
  transient state, unrelated to whether Pinia singleton carries "state from last visit"
  back (D2 only handles transient fields in store; expanded never was in store, unaffected).

  【Lazy-load guard, Vue2 :203 verbatim】 `if (open && !this.store.state.providerModels[p.id])`
  — only fetch model list on first expand of a provider; cached expands do not repeat requests.

  【i18n: two English literals never wrapped in Vue2 $t()】 `Base URL` (:25 header, :107 form
  label) and `API Key` (:111 form label) are bare literals in Vue2 source, with no $t()
  calls — not a "i18n key missing Chinese translation" case. Per established policy in P1a
  (English never i18n'd in Vue2; add keys this sprint), added aiCfgBaseUrl / aiCfgApiKey
  keys here, with values "Base URL" / "API Key" unchanged in both Chinese and English
  (technical terms with no precedent translation in production zh_CN.json).
  `OpenAI` / `Anthropic` (:123/:126 protocol radio text) and preset chip names are likewise
  proper nouns never wrapped in $t() in Vue2; not translated.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useToast } from '../../../../stores/toast'
import AgentIcon from '../../icons/AgentIcon.vue'
import SetSwitch from '../SetSwitch.vue'
import AlertDialog from '../../../../components/ui/AlertDialog.vue'
import PromptDialog from '../../../../components/ui/PromptDialog.vue'
import type { Provider, ProviderModel, ProviderPreset } from '../../../stores/settingsStore'

const store = useSettingsStore()
const toast = useToast()
const { t } = useI18n()

// Vue2 ProvidersSection.vue:151-156 — four presets, copied verbatim, no changes to URL or default
// model name.
const PRESETS: ProviderPreset[] = [
  { name: 'OpenAI', base_url: 'https://api.openai.com/v1', default_model: 'gpt-4o', protocol: 'openai' },
  { name: 'Anthropic', base_url: 'https://api.anthropic.com/v1', default_model: 'claude-sonnet-4-6', protocol: 'anthropic' },
  { name: 'DeepSeek', base_url: 'https://api.deepseek.com/v1', default_model: 'deepseek-chat', protocol: 'openai' },
  { name: 'Moonshot', base_url: 'https://api.moonshot.cn/v1', default_model: 'moonshot-v1-8k', protocol: 'openai' },
]

// Vue2 ProvidersSection.vue:162 `data() { return { expanded: {} } }` — component
// local transient state, not in store (see header comment).
const expanded = ref<Record<string | number, boolean>>({})

function modelsOf(p: Provider) {
  return store.providerModels[p.id] || { loading: false, models: [] }
}

/** Vue2 :200-208 — fetch models only on first expand; cached expands do not repeat requests (lazy-load guard). */
function onToggleModels(p: Provider) {
  const open = !expanded.value[p.id]
  expanded.value[p.id] = open
  if (open && !store.providerModels[p.id]) {
    store.loadProviderModels(p.id).catch(() => {
      toast.show(t('aiCfgFailedToLoadModels'), 1500, 'danger')
    })
  }
}

/** Vue2 :168-174 */
async function onToggle(p: Provider, value: boolean) {
  try {
    await store.toggleProvider(p.id, value)
  } catch {
    toast.show(t('aiCfgToggleFailed'), 1500, 'danger')
  }
}

/**
 * Vue2 :175-182 — catch prefers e.message, falls back to default text if no message.
 *
 * 【Type narrowing, not a behavior change】 Vue2 is duck-typed `e.message` (any thrown
 * value with `.message` field reads it, no Error instance required). Under TS strict,
 * catch variable is `unknown`; narrowing here via `(e as { message?: unknown })?.message`
 * rather than `e instanceof Error` (the latter would miss "thrown plain object with
 * message field" cases, stricter than Vue2, should be avoided). Assertion pattern
 * matches established technique in settingsStore.ts:179-182 `isNotFound()` in same directory.
 */
async function onSave() {
  try {
    await store.saveProvider()
    toast.show(t('aiCfgSaved'))
  } catch (e) {
    const message = (e as { message?: unknown } | null | undefined)?.message
    toast.show((typeof message === 'string' && message) || t('aiCfgSaveFailed'), 1500, 'danger')
  }
}

// ── Delete provider confirmation (Vue2 :183-196, Buefy → AlertDialog, see header) ──
const deleteDlg = ref<{ open: boolean; provider: Provider | null }>({ open: false, provider: null })

function requestDelete(p: Provider) {
  deleteDlg.value = { open: true, provider: p }
}

async function onDeleteConfirm() {
  const p = deleteDlg.value.provider
  if (!p) return
  try {
    await store.deleteProvider(p.id)
    toast.show(t('aiCfgDeleted'))
  } catch {
    toast.show(t('aiCfgDeleteFailed'), 1500, 'danger')
  }
}

/** Vue2 :209-216 — failure shows warning tier (not danger), message directs to manual add. */
async function onRefreshModels(p: Provider) {
  try {
    await store.refreshProviderModels(p.id)
    toast.show(t('aiCfgRefreshed'))
  } catch {
    toast.show(t('aiCfgAutoFetchFailedManual'), 1500, 'warning')
  }
}

/** Vue2 :217-223 */
async function onToggleFav(p: Provider, m: ProviderModel, favorite: boolean) {
  try {
    await store.toggleModelFavorite(p.id, m.name, favorite)
  } catch {
    toast.show(t('aiCfgSaveFailed'), 1500, 'danger')
  }
}

// ── Manually add model (Vue2 :224-239, Buefy prompt → PromptDialog, see header) ──
const addModelDlg = ref<{ open: boolean; provider: Provider | null }>({ open: false, provider: null })

function onAddManual(p: Provider) {
  addModelDlg.value = { open: true, provider: p }
}

/** Vue2 :229-231 — `(value || '').trim()`; blank value returns early, does not call action. */
async function onAddModelConfirm(value: string) {
  const p = addModelDlg.value.provider
  if (!p) return
  const name = (value || '').trim()
  if (!name) return
  try {
    await store.addManualModel(p.id, name)
  } catch {
    toast.show(t('aiCfgAddFailed'), 1500, 'danger')
  }
}

/** Vue2 :240-246 */
async function onRemoveManual(p: Provider, m: ProviderModel) {
  try {
    await store.removeManualModel(p.id, m.name)
  } catch {
    toast.show(t('aiCfgDeleteFailed'), 1500, 'danger')
  }
}
</script>

<template>
  <div class="set-inner">
    <div class="set-page-head">
      <h1 class="set-h1">{{ t('aiCfgCloudProviders') }}</h1>
      <p class="set-desc">{{ t('aiCfgProvidersDesc') }}</p>
    </div>

    <div class="sk-section">
      <div class="sk-section-body">
        <div class="set-cardhead">
          <span class="t">{{ t('aiCfgConfiguredProviders') }}</span>
          <span class="ct">{{ store.providers.length }}</span>
          <span class="sp"></span>
          <button class="sk-btn primary" @click="store.showProviderForm()">
            <AgentIcon name="plus" :size="13" /> {{ t('aiCfgAdd') }}
          </button>
        </div>

        <div v-if="store.providersLoading" class="set-note">{{ t('aiCfgLoadingEllipsis') }}</div>
        <div v-else-if="store.providers.length === 0" class="set-note">
          {{ t('aiCfgNoProvidersYet') }}
        </div>
        <table v-else class="set-table">
          <thead>
            <tr>
              <th>{{ t('aiCfgColName') }}</th>
              <th>{{ t('aiCfgBaseUrl') }}</th>
              <th>{{ t('aiCfgProtocol') }}</th>
              <th>{{ t('aiCfgEnabled') }}</th>
              <th class="act">{{ t('aiCfgColActions') }}</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="p in store.providers" :key="p.id">
              <tr>
                <td>{{ p.name }}</td>
                <td class="mono">{{ p.base_url }}</td>
                <td>
                  <span class="set-proto">{{ p.protocol || 'openai' }}</span>
                </td>
                <td>
                  <SetSwitch :model-value="!!p.enabled" @change="(v: boolean) => onToggle(p, v)" />
                </td>
                <td class="act">
                  <button class="set-tbtn" @click="onToggleModels(p)">
                    <AgentIcon name="chevDown" :size="13" /> {{ t('aiCfgShowModels') }}
                  </button>
                  <button class="set-tbtn" @click="store.showProviderForm(p)">
                    <AgentIcon name="edit" :size="13" /> {{ t('aiCfgEdit') }}
                  </button>
                  <button class="set-tbtn danger" @click="requestDelete(p)">
                    <AgentIcon name="trash" :size="13" /> {{ t('aiCfgDelete') }}
                  </button>
                </td>
              </tr>
              <tr v-if="expanded[p.id]">
                <td colspan="5">
                  <div class="pm-panel">
                    <div class="pm-head">
                      <span>{{ t('aiCfgModelsCheckedHint') }}</span>
                      <span class="sp"></span>
                      <button class="set-minibtn" :disabled="modelsOf(p).loading" @click="onRefreshModels(p)">
                        <AgentIcon name="refresh" :size="13" /> {{ t('aiCfgRefreshModels') }}
                      </button>
                      <button class="set-minibtn" @click="onAddManual(p)">{{ t('aiCfgAddManually') }}</button>
                    </div>
                    <div v-if="modelsOf(p).loading" class="set-note">{{ t('aiCfgLoadingEllipsis') }}</div>
                    <ul v-else class="pm-list">
                      <li v-for="m in modelsOf(p).models" :key="m.name" class="pm-item">
                        <SetSwitch :model-value="!!m.favorite" @change="(v: boolean) => onToggleFav(p, m, v)" />
                        <span class="nm">{{ m.name }}</span>
                        <span v-if="m.supports_thinking" :title="t('aiCfgSupportsThinking')">🧠</span>
                        <span class="src">{{ m.source }}</span>
                        <button v-if="m.source === 'manual'" class="dir-del"
                                @click="onRemoveManual(p, m)" :title="t('aiCfgDelete')">
                          <AgentIcon name="trash" :size="12" />
                        </button>
                      </li>
                      <li v-if="modelsOf(p).models.length === 0" class="set-note">
                        {{ t('aiCfgNoModelsFoundHint') }}
                      </li>
                    </ul>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Inline form -->
    <div v-if="store.providerForm.visible" class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ store.providerForm.editing ? t('aiCfgEditProvider') : t('aiCfgAddProvider') }}</div>
        <button class="set-ibtn" @click="store.hideProviderForm()">
          <AgentIcon name="x" :size="14" />
        </button>
      </div>
      <div class="set-form">
        <div v-if="!store.providerForm.editing" class="preset-row">
          <button v-for="preset in PRESETS" :key="preset.name" class="preset-chip"
                  @click="store.applyProviderPreset(preset)">
            {{ preset.name }}
          </button>
        </div>

        <div class="field">
          <label>{{ t('aiCfgColName') }} *</label>
          <input type="text" class="set-input full" v-model="store.providerForm.data.name" :placeholder="t('aiCfgProviderNamePlaceholder')" />
        </div>
        <div class="field">
          <label>{{ t('aiCfgBaseUrl') }} *</label>
          <input type="text" class="set-input full" v-model="store.providerForm.data.base_url" placeholder="https://api.example.com/v1" />
        </div>
        <div class="field">
          <label>{{ t('aiCfgApiKey') }}</label>
          <input type="password" class="set-input full" v-model="store.providerForm.data.api_key"
                 :placeholder="store.providerForm.editing ? t('aiCfgLeaveBlankKeepCurrent') : t('aiCfgApiKey')" />
        </div>
        <div class="field">
          <label>{{ t('aiCfgDefaultModel') }}</label>
          <input type="text" class="set-input full" v-model="store.providerForm.data.default_model" :placeholder="t('aiCfgEgGpt4o')" />
        </div>
        <div class="field">
          <label>{{ t('aiCfgProtocol') }}</label>
          <div class="radio-row">
            <label class="radio-option">
              <input type="radio" value="openai" v-model="store.providerForm.data.protocol" /> OpenAI
            </label>
            <label class="radio-option">
              <input type="radio" value="anthropic" v-model="store.providerForm.data.protocol" /> Anthropic
            </label>
          </div>
          <p class="help">{{ t('aiCfgProtocolHint') }}</p>
        </div>

        <div class="set-actions">
          <button class="sk-btn primary"
                  :disabled="store.providerForm.saving"
                  @click="onSave">
            {{ t('aiCfgSave') }}
          </button>
          <button class="sk-btn ghost" @click="store.hideProviderForm()">
            {{ t('aiCfgCancel') }}
          </button>
        </div>
      </div>
    </div>

    <AlertDialog
      v-model:open="deleteDlg.open"
      :title="t('aiCfgDelete')"
      :message="t('aiCfgConfirmDeleteProvider', { name: deleteDlg.provider?.name || '' })"
      :confirm-text="t('aiCfgDelete')"
      :cancel-text="t('aiCfgCancel')"
      destructive
      @confirm="onDeleteConfirm"
    />

    <PromptDialog
      v-model:open="addModelDlg.open"
      :title="t('aiCfgAddManually')"
      :message="t('aiCfgEnterModelNamePrompt')"
      :placeholder="t('aiCfgModelNamePromptPlaceholder')"
      :confirm-text="t('aiCfgAdd')"
      :cancel-text="t('aiCfgCancel')"
      @confirm="onAddModelConfirm"
    />
  </div>
</template>
