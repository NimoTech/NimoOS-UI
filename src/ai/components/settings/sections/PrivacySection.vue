<!--
  SP8-P2a Task 11 — 1:1 port from Vue2
  `src/views/AI/Settings/sections/PrivacySection.vue` (74 lines). Three configurations:
  allow cloud requests (toggle) · default backend (dropdown: local/cloud) · confirm on
  local failure (toggle). Each change calls `store.updatePolicyField(field, value)`;
  on success shows toast (Vue2 :67 explicitly wrote `duration: 1500`, not relying on
  implicit defaults — doing the same here so the "1500ms" product decision doesn't drift
  if toast store changes its default value in the future), on failure shows danger toast.
  Three states wrapped: `policyLoading` → loading; `!policy` → "unable to load policy";
  otherwise renders card.

  【Vue2 :22/:43 `!!` operator retained exactly】 `policy.allow_remote`/`escalation_prompt`
  may be `undefined` when the API hasn't returned that field yet. `!!` normalizes it to
  a boolean before passing to SetSwitch's `modelValue: boolean` prop — without it, passing
  undefined to a prop declared as boolean can cause issues.
-->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useToast } from '../../../../stores/toast'
import SetSwitch from '../SetSwitch.vue'
import type { Policy } from '../../../stores/settingsStore'

const store = useSettingsStore()
const toast = useToast()
const { t } = useI18n()

/** Vue2 :64-71 — three rows share one change path: call action → success toast (1500ms) → failure danger toast. */
async function onChange<K extends keyof Policy>(field: K, value: Policy[K]) {
  try {
    await store.updatePolicyField(field, value)
    toast.show(t('aiCfgSaved'), 1500)
  } catch {
    toast.show(t('aiCfgSaveFailed'), 1500, 'danger')
  }
}

function onBackendChange(e: Event) {
  onChange('default_backend', (e.target as HTMLSelectElement).value)
}
</script>

<template>
  <div class="set-inner">
    <div class="set-page-head">
      <h1 class="set-h1">{{ t('aiCfgPrivacyCloud') }}</h1>
      <p class="set-desc">{{ t('aiCfgPrivacyDesc') }}</p>
    </div>

    <div v-if="store.policyLoading" class="set-note">{{ t('aiCfgLoadingEllipsis') }}</div>
    <div v-else-if="!store.policy" class="set-note">{{ t('aiCfgUnableLoadPolicy') }}</div>

    <div v-else class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgDataBackend') }}</div>
      </div>
      <div class="sk-section-body">
        <div class="set-rows">
          <div class="set-row">
            <div class="lbl">
              {{ t('aiCfgAllowCloudRequests') }}
              <span class="sub">{{ t('aiCfgAllowCloudRequestsSub') }}</span>
            </div>
            <div class="val end">
              <SetSwitch
                :model-value="!!store.policy.allow_remote"
                @change="(v: boolean) => onChange('allow_remote', v)"
              />
            </div>
          </div>
          <div class="set-row">
            <div class="lbl">
              {{ t('aiCfgDefaultBackend') }}
              <span class="sub">{{ t('aiCfgDefaultBackendSub') }}</span>
            </div>
            <div class="val end">
              <select class="set-select" :value="store.policy.default_backend" @change="onBackendChange">
                <option value="local">{{ t('aiCfgBackendLocal') }}</option>
                <option value="cloud">{{ t('aiCfgBackendCloud') }}</option>
              </select>
            </div>
          </div>
          <div class="set-row">
            <div class="lbl">
              {{ t('aiCfgConfirmLocalFailure') }}
              <span class="sub">{{ t('aiCfgConfirmLocalFailureSub') }}</span>
            </div>
            <div class="val end">
              <SetSwitch
                :model-value="!!store.policy.escalation_prompt"
                @change="(v: boolean) => onChange('escalation_prompt', v)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
