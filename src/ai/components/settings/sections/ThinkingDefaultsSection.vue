<!--
  1:1 port from Vue2
  `src/views/AI/Settings/sections/ThinkingDefaultsSection.vue` (73 lines). **This section
  bypasses the store** — on mount it directly calls `service.ai.getThinkingDefaults()`, on
  change it directly calls `putThinkingDefaults()` (Vue2 did the same, copied as-is). One
  info banner + two rows (thinking toggle enabled by default · default intensity dropdown
  with four options, dropdown disabled when `!enabled`) + one row of status hint (`saving` →
  "Saving..."; `savedAt` non-zero → "Saved"; otherwise empty).

  [Data fetching protocol, not a behavior change] Vue2 `mounted()` reads
  `const d = await ai.getThinkingDefaults(); this.enabled = d.enabled` — note it
  **has no** `.data`. The shared package `service.ai.getThinkingDefaults()` returns the same
  body-level (see the shared HTTP client's `src/ai.ts` `getThinkingDefaults`: internally already does
  `return res.data`, unwrapped once, no need to unwrap again here). Data fetching protocol
  aligns with `agentStore.ts:744-748` `loadThinkingDefaults()` — same endpoint, same
  approach, same error-swallowing strategy, no DIY.

  [Observed invariant, copied as-is unchanged, registered only] This section and
  `agentStore` (`agentStore.ts:161-167` `thinking.defaults`) each hold independent copies
  of the thinking defaults state. When changing defaults on the settings page, the already-
  mounted Agent page store does not auto-refresh — it must wait for the user to navigate to
  the Agent page and re-run `loadThinkingDefaults()` to see the new value. Vue2 does the
  same (its component-level store is rebuilt on each mount, masking this gap via page
  renavigation), not a new problem introduced by singleton-ifying this repo, copied as-is
  without fix.

  [Discipline fix, declared ①②③ in task report] Vue2 `save()`(:62-70) has only
  try/finally, no catch — when `putThinkingDefaults` fails it produces an unhandled promise
  rejection, and the user sees no feedback: toggle already flipped, backend never saved,
  UI silent. This is a reproducible error behavior (not a design choice), per porting
  discipline fixed to correct logic: see the catch block comment below in `save()`. The
  `catch {}` in `mounted()` silently swallows errors — **retained** — hardcoded fallback
  (`enabled: true`/`level: 'medium'`) is reasonable degradation, not a defect.
-->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useToast } from '../../../../stores/toast'
import AgentIcon from '../../icons/AgentIcon.vue'
import SetSwitch from '../SetSwitch.vue'

const toast = useToast()
const { t } = useI18n()

const enabled = ref(true)
const level = ref('medium')
const saving = ref(false)
const savedAt = ref(0)

onMounted(async () => {
  try {
    const d = (await service.ai.getThinkingDefaults()) as { enabled: boolean; level: string }
    enabled.value = d.enabled
    level.value = d.level
  } catch {
    // Vue2 ThinkingDefaultsSection.vue:54-60 `catch {}` — intentionally silently swallow
    // error: initial value of enabled/level is already product-determined fallback
    // (true/'medium'), no need to break the whole page on API failure, user can still
    // manually toggle and save. Matches the existing error-swallowing strategy in
    // agentStore.ts:744-748 loadThinkingDefaults (same backend endpoint).
  }
})

/**
 * Vue2 :62-70 — Original has only try/finally, **no catch**:
 *   async save() {
 *     this.saving = true
 *     try {
 *       await ai.putThinkingDefaults({ enabled: this.enabled, level: this.level })
 *       this.savedAt = Date.now()
 *     } finally {
 *       this.saving = false
 *     }
 *   }
 * Failure to save produces an unhandled promise rejection, and user sees no feedback —
 * toggle already flipped, backend never saved, UI silent. This is reproducible error
 * behavior; per porting discipline fixed to correct logic: add catch, show danger-level
 * "Save failed" toast.
 */
async function save() {
  saving.value = true
  try {
    await service.ai.putThinkingDefaults({ enabled: enabled.value, level: level.value })
    savedAt.value = Date.now()
  } catch {
    toast.show(t('aiCfgSaveFailed'), 1500, 'danger')
  } finally {
    saving.value = false
  }
}

function onToggle(v: boolean) {
  enabled.value = v
  void save()
}

function onLevelChange(e: Event) {
  level.value = (e.target as HTMLSelectElement).value
  void save()
}
</script>

<template>
  <div class="set-inner">
    <div class="set-page-head">
      <h1 class="set-h1">{{ t('aiCfgThinkingIntensity') }}</h1>
      <p class="set-desc">{{ t('aiCfgThinkingDesc') }}</p>
    </div>

    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgThinkingDefaultsTitle') }}</div>
      </div>
      <div class="sk-section-body">
        <div class="set-banner">
          <span class="ico"><AgentIcon name="sparkle" :size="12" /></span>
          <span>{{ t('aiCfgThinkingBanner') }}</span>
        </div>
        <div class="set-rows">
          <div class="set-row">
            <div class="lbl">{{ t('aiCfgEnableThinkingDefault') }}</div>
            <div class="val end">
              <SetSwitch :model-value="enabled" @change="onToggle" />
            </div>
          </div>
          <div class="set-row">
            <div class="lbl">{{ t('aiCfgDefaultIntensity') }}</div>
            <div class="val end">
              <select class="set-select" :value="level" :disabled="!enabled" @change="onLevelChange">
                <option value="low">{{ t('aiThinkingLow') }}</option>
                <option value="medium">{{ t('aiThinkingMedium') }}</option>
                <option value="high">{{ t('aiThinkingHigh') }}</option>
                <option value="max">{{ t('aiThinkingMax') }}</option>
              </select>
            </div>
          </div>
        </div>
        <span class="set-actions">
          <span class="hint">{{ saving ? t('aiCfgSaving') : savedAt ? t('aiCfgSaved') : '' }}</span>
        </span>
      </div>
    </div>
  </div>
</template>
