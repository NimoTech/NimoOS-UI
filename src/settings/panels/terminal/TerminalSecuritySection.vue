<script setup lang="ts">
// Settings > Terminal > Security: the three-mode lock policy, 1:1 port of Vue2
// TerminalSecuritySection.vue with two registered deviations (spec §3.4):
//   1. Load failure renders the pre-existing "terminal unavailable" empty state
//      instead of an interactive form whose Save can only fail — Vue2 silently
//      kept defaults (the exact fake-form D7 rejected).
//   2. putSettings opts out of the shared 401 refresh-replay (service layer) so
//      one typo burns exactly one of the backend's 5-per-15min attempts.
// The password step-up is inline, not a dialog (1:1 Vue2; errors answer the
// button they belong to).
import { ref, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type TerminalMode } from '@nimotech/nimoos-service'
import { statusOf, errorBody } from '../../../terminal/terminalHttp'
import '../../styles/settings.css'

const { t } = useI18n()

const phase = ref<'loading' | 'ready' | 'unavailable'>('loading')
const mode = ref<TerminalMode>('idle')
const idleMinutes = ref(15)
const saved = ref(false)
const confirming = ref(false)
const saving = ref(false)
const password = ref('')
const pwError = ref(false)
const saveError = ref(false)
const frozenSeconds = ref(0)
let frozenTimer: ReturnType<typeof setInterval> | undefined
let loadSeq = 0

const MODES: { value: TerminalMode; label: string }[] = [
  { value: 'off', label: 'termModeOff' },
  { value: 'on_open', label: 'termModeOnOpen' },
  { value: 'idle', label: 'termModeIdle' },
]

async function load() {
  const seq = ++loadSeq
  try {
    const s = await service.terminal.getSettings()
    if (seq !== loadSeq) return
    mode.value = s.mode
    idleMinutes.value = Number(s.idle_minutes)
    phase.value = 'ready'
  } catch {
    if (seq !== loadSeq) return
    phase.value = 'unavailable'
  }
}
void load()

function beginSave() {
  saved.value = false; pwError.value = false; saveError.value = false
  password.value = ''
  confirming.value = true
}

function cancelSave() {
  confirming.value = false
  password.value = ''; pwError.value = false; saveError.value = false
  clearFrozen()
}

async function confirmSave() {
  if (frozenSeconds.value > 0 || saving.value) return
  pwError.value = false; saveError.value = false
  saving.value = true
  // Clamp to the backend's documented 1-240 range (Vue2 relied on b-numberinput).
  const minutes = Math.min(240, Math.max(1, Math.round(Number(idleMinutes.value) || 1)))
  idleMinutes.value = minutes
  try {
    await service.terminal.putSettings({ mode: mode.value, idle_minutes: minutes, password: password.value })
    saved.value = true
    confirming.value = false
    password.value = ''
  } catch (e) {
    const st = statusOf(e)
    if (st === 429) startFrozen(errorBody(e)?.retry_after_seconds ?? 60)
    else if (st === 401) pwError.value = true
    else saveError.value = true
  } finally {
    saving.value = false
  }
}

function startFrozen(sec: number) {
  frozenSeconds.value = sec
  clearFrozen(false)
  frozenTimer = setInterval(() => {
    frozenSeconds.value -= 1
    if (frozenSeconds.value <= 0) clearFrozen()
  }, 1000)
}

function clearFrozen(resetSeconds = true) {
  if (frozenTimer) { clearInterval(frozenTimer); frozenTimer = undefined }
  if (resetSeconds) frozenSeconds.value = 0
}

onUnmounted(() => clearFrozen())
</script>

<template>
  <div class="term-sec">
    <p class="set-comp-group-title">{{ t('termSecTitle') }}</p>

    <div v-if="phase === 'unavailable'" class="set-term-empty" data-test="term-sec-unavailable">
      <p class="set-row-label">{{ t('settingsTermUnavailable') }}</p>
      <p class="set-row-sub">{{ t('settingsTermUnavailableHint') }}</p>
    </div>

    <template v-else-if="phase === 'ready'">
      <div class="set-list term-sec-card">
        <button
          v-for="m in MODES"
          :key="m.value"
          type="button"
          class="set-list-item clickable"
          data-test="mode-row"
          :data-test-mode="m.value"
          @click="mode = m.value"
        >
          <span class="term-sec-radio" :class="{ on: mode === m.value }" aria-hidden="true"></span>
          <span class="set-row-text"><span class="set-row-label">{{ t(m.label) }}</span></span>
        </button>
        <div v-if="mode === 'idle'" class="set-list-item term-sec-minutes-row">
          <span class="set-row-text"><span class="set-row-label">{{ t('termIdleMinutes') }}</span></span>
          <input v-model.number="idleMinutes" data-test="idle-minutes" class="set-input term-sec-minutes" type="number" min="1" max="240" />
        </div>
      </div>

      <div v-if="!confirming" class="term-sec-save">
        <button type="button" class="set-btn primary" data-test="sec-save" @click="beginSave">{{ t('termSave') }}</button>
        <span v-if="saved" class="term-sec-saved" data-test="sec-saved">{{ t('termSaved') }}</span>
      </div>
      <div v-else class="term-sec-confirm">
        <p class="set-row-sub">{{ t('termConfirmPwHint') }}</p>
        <div class="term-sec-confirm-row">
          <input
            v-model="password"
            data-test="sec-pw"
            class="set-input term-sec-pw"
            type="password"
            :placeholder="t('termPwPlaceholder')"
            :disabled="frozenSeconds > 0"
            @keyup.enter="confirmSave"
          />
          <button type="button" class="set-btn primary" data-test="sec-confirm" :disabled="frozenSeconds > 0 || saving" @click="confirmSave">{{ t('termConfirm') }}</button>
          <button type="button" class="set-btn" data-test="sec-cancel" @click="cancelSave">{{ t('termCancel') }}</button>
        </div>
        <p v-if="pwError" class="set-danger" data-test="sec-pw-error">{{ t('termPwWrong') }}</p>
        <p v-else-if="saveError" class="set-danger" data-test="sec-save-error">{{ t('termSaveFailed') }}</p>
        <p v-if="frozenSeconds > 0" class="set-danger" data-test="sec-frozen">{{ t('termFrozen', { s: frozenSeconds }) }}</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.term-sec { margin-bottom: 24px; }
.term-sec-card { margin-bottom: 14px; }
.term-sec-radio {
  position: relative; display: inline-block; width: 18px; height: 18px; margin-right: 12px;
  border-radius: 50%; border: 2px solid var(--card-border); flex-shrink: 0;
  transition: border-color 0.2s;
}
.term-sec-radio.on { border-color: var(--accent); }
.term-sec-radio.on::after { content: ''; position: absolute; inset: 3px; border-radius: 50%; background: var(--accent); }
.term-sec-minutes { max-width: 96px; }
.term-sec-save { display: flex; align-items: center; gap: 12px; }
.term-sec-saved { font-size: 12px; color: var(--fg-muted); }
.term-sec-confirm-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.term-sec-pw { max-width: 220px; }
</style>
