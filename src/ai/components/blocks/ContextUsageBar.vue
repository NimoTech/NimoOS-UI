<!-- 1:1 ported from Vue2 src/views/AI/Agent/blocks/ContextUsageBar.vue -->
<!-- Geometry/thresholds/formatting delegated to contextUsage.ts, not recalculated locally. -->
<!-- 2026-08-24 context-window editor: the ring is a button; click opens a popover to set/clear
     the user's context_window override (same user_settings row the MemorySection field edits).
     Pairs with NimoOS-AI tier defaults (cloud 256K / local 8K, PUT floor 1024). -->
<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { formatTokens, levelFor, dashArrayFor } from '../../util/contextUsage'

const props = withDefaults(
  defineProps<{ tokens?: number; window?: number; pct?: number }>(),
  { tokens: 0, window: 0, pct: 0 },
)
const emit = defineEmits<{ saved: [] }>()
const { t } = useI18n()

const PRESETS = [
  { label: '8K', value: 8192 },
  { label: '32K', value: 32768 },
  { label: '128K', value: 131072 },
  { label: '256K', value: 262144 },
]
const MIN_WINDOW = 1024

const open = ref(false)
const loaded = ref(false)
const saving = ref(false)
const errorMsg = ref('')
// '' = no override (model-tier default: cloud 256K / local 8K)
const valStr = ref('')
// preserved verbatim on save — the PUT overwrites all three fields
const memEnabled = ref(false)
const compactionEnabled = ref(true)
const rootEl = ref<HTMLElement | null>(null)

function onDocDown(e: MouseEvent) {
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) close()
}

function close() {
  open.value = false
  document.removeEventListener('mousedown', onDocDown)
}

onBeforeUnmount(() => document.removeEventListener('mousedown', onDocDown))

async function toggle() {
  if (open.value) return close()
  open.value = true
  errorMsg.value = ''
  document.addEventListener('mousedown', onDocDown)
  try {
    const s = (await service.ai.getMemorySettings()) as {
      enabled?: boolean
      compaction_enabled?: boolean
      context_window?: number | null
    }
    memEnabled.value = !!s.enabled
    compactionEnabled.value = !!s.compaction_enabled
    valStr.value = s.context_window != null ? String(s.context_window) : ''
    loaded.value = true
  } catch {
    errorMsg.value = t('aiCtxLoadFailed')
  }
}

function pickPreset(v: number) {
  valStr.value = String(v)
}

async function save(value: number) {
  // value: number override, or 0 to clear (backend treats null as
  // "don't touch", so clearing MUST send 0)
  if (!loaded.value || saving.value) return
  if (value > 0 && value < MIN_WINDOW) {
    errorMsg.value = t('aiCtxMinTokens', { n: MIN_WINDOW })
    return
  }
  saving.value = true
  errorMsg.value = ''
  try {
    await service.ai.putMemorySettings({
      enabled: memEnabled.value,
      compaction_enabled: compactionEnabled.value,
      context_window: value,
    })
    emit('saved')
    close()
  } catch {
    errorMsg.value = t('aiCfgSaveFailed')
  } finally {
    saving.value = false
  }
}

function onSaveClick() {
  const n = valStr.value === '' ? 0 : Number(valStr.value)
  if (!Number.isFinite(n) || n < 0) {
    errorMsg.value = t('aiCtxMinTokens', { n: MIN_WINDOW })
    return
  }
  save(Math.floor(n))
}

function onResetClick() {
  valStr.value = ''
  save(0)
}
</script>

<template>
  <div ref="rootEl" class="ctx-usage">
    <button
      class="ctx-ring-btn"
      type="button"
      :aria-label="t('aiCtxWindowTitle')"
      data-test="ctx-ring-btn"
      @click="toggle"
    >
      <svg class="ctx-ring" viewBox="0 0 36 36" width="22" height="22" aria-hidden="true">
        <circle
          class="ctx-ring-track"
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke-width="3.5"
        />
        <circle
          class="ctx-ring-arc"
          :class="levelFor(props.pct)"
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke-width="3.5"
          stroke-linecap="round"
          :stroke-dasharray="dashArrayFor(props.pct)"
          transform="rotate(-90 18 18)"
        />
      </svg>
    </button>
    <div v-if="!open" class="ctx-usage-tip">
      {{ t('aiCtxLabel') }} {{ formatTokens(props.tokens) }} / {{ formatTokens(props.window) }} · {{ props.pct }}%
    </div>
    <div v-if="open" class="ctx-pop" data-test="ctx-pop">
      <div class="ctx-pop-title">{{ t('aiCtxWindowTitle') }}</div>
      <div class="ctx-pop-sub">
        {{ t('aiCtxLabel') }} {{ formatTokens(props.tokens) }} / {{ formatTokens(props.window) }} · {{ props.pct }}%
      </div>
      <div class="ctx-pop-presets">
        <button
          v-for="p in PRESETS"
          :key="p.value"
          type="button"
          class="ctx-chip"
          :class="{ active: valStr === String(p.value) }"
          @click="pickPreset(p.value)"
        >{{ p.label }}</button>
      </div>
      <input
        v-model="valStr"
        class="ctx-pop-input"
        type="number"
        min="1024"
        step="1024"
        :placeholder="t('aiCtxDefaultHint')"
        data-test="ctx-input"
        @keyup.enter="onSaveClick"
      >
      <div v-if="errorMsg" class="ctx-pop-error" data-test="ctx-error">{{ errorMsg }}</div>
      <div class="ctx-pop-actions">
        <button
          type="button"
          class="ctx-btn ghost"
          :disabled="saving || !loaded"
          data-test="ctx-reset"
          @click="onResetClick"
        >{{ t('aiCtxReset') }}</button>
        <button
          type="button"
          class="ctx-btn primary"
          :disabled="saving || !loaded"
          data-test="ctx-save"
          @click="onSaveClick"
        >{{ t('aiCfgSave') }}</button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.ctx-usage {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.ctx-ring-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  border-radius: 50%;
}

.ctx-ring {
  display: block;
}
.ctx-ring-track {
  stroke: var(--line-strong);
}
.ctx-ring-arc {
  transition: stroke-dasharray 0.3s ease, stroke 0.3s ease;

  &.ok     { stroke: var(--accent); }
  &.warn   { stroke: var(--warning); }
  &.danger { stroke: var(--danger); }
}

.ctx-usage-tip {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  padding: 5px 12px;
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border: 1px solid var(--line);
  border-radius: 999px;
  box-shadow: var(--shadow-pop);
  opacity: 0;
  pointer-events: none;
  transform: translateY(4px);
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.ctx-usage:hover .ctx-usage-tip {
  opacity: 1;
  transform: translateY(0);
}

.ctx-pop {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  z-index: 30;
  width: 240px;
  padding: 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: var(--shadow-pop);
}
.ctx-pop-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.ctx-pop-sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-secondary);
}
.ctx-pop-presets {
  display: flex;
  gap: 6px;
  margin-top: 10px;
}
.ctx-chip {
  padding: 3px 8px;
  font-size: 12px;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 999px;
  cursor: pointer;

  &.active {
    color: var(--accent);
    border-color: var(--accent);
  }
}
.ctx-pop-input {
  width: 100%;
  margin-top: 10px;
  padding: 6px 10px;
  font-size: 13px;
  color: var(--text-primary);
  background: var(--bg-sunken);
  border: 1px solid var(--line);
  border-radius: 8px;
  outline: none;

  &:focus { border-color: var(--accent); }
}
.ctx-pop-error {
  margin-top: 6px;
  font-size: 12px;
  color: var(--danger);
}
.ctx-pop-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}
.ctx-btn {
  padding: 5px 12px;
  font-size: 12px;
  border-radius: 8px;
  cursor: pointer;

  &.ghost {
    color: var(--text-secondary);
    background: transparent;
    border: 1px solid var(--line);
  }
  &.primary {
    color: var(--text-on-accent);
    background: var(--accent);
    border: 1px solid var(--accent);
  }
  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
}
</style>
