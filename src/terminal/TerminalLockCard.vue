<script setup lang="ts">
// Lock overlay card, 1:1 with Vue2's .lock-card except: theme tokens instead of
// hardcoded dark values (spec §1 decision 1), plus a subtitle spelling out that
// the tmux session survives the lock (backend Known Boundary ③, spec §4-3).
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

// submitting mirrors the composable's in-flight guard: the double-emit
// (Enter + click) is deduped there; disabling here is the visual half.
defineProps<{ pwError: boolean; frozenSeconds: number; submitting: boolean }>()
const emit = defineEmits<{ submit: [pw: string] }>()
const { t } = useI18n()
const password = ref('')

function submit() { emit('submit', password.value) }
</script>

<template>
  <div class="term-lock">
    <div class="lock-card">
      <p class="lock-title">{{ t('termLockedTitle') }}</p>
      <p class="lock-resume" data-test="lock-resume">{{ t('termLockedResume') }}</p>
      <input
        data-test="pw-input"
        v-model="password"
        type="password"
        class="lock-input"
        :placeholder="t('termPwPlaceholder')"
        :disabled="submitting || frozenSeconds > 0"
        @keyup.enter="submit"
      />
      <p v-if="pwError" class="lock-error" data-test="pw-error">{{ t('termPwWrong') }}</p>
      <p v-if="frozenSeconds > 0" class="lock-error" data-test="pw-frozen">{{ t('termFrozen', { s: frozenSeconds }) }}</p>
      <button data-test="pw-submit" type="button" class="lock-submit" :disabled="submitting || frozenSeconds > 0" @click="submit">
        {{ t('termUnlock') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* @import '../settings/styles/settings.css' does not resolve inside a scoped
 * style block in the test DOM (getComputedStyle showed the UA default, not the
 * imported rule) — style .lock-submit locally with the same tokens
 * .set-btn.primary uses instead, per the task brief's fallback instruction. */
.term-lock {
  position: absolute; inset: 0; z-index: 10;
  display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--console-bg) 82%, transparent);
}
.lock-card {
  width: 320px; padding: 24px; border-radius: 16px;
  background: var(--card-bg); border: 1px solid var(--card-border); color: var(--fg);
}
.lock-title { margin: 0 0 6px; font-size: 15px; font-weight: 600; }
.lock-resume { margin: 0 0 14px; font-size: 12px; color: var(--fg-muted); }
.lock-input {
  width: 100%; box-sizing: border-box; padding: 8px 10px; font-size: 13px;
  color: var(--fg); background: var(--chip-bg); border: 1px solid var(--card-border);
  border-radius: 9px; outline: none;
}
.lock-input:focus { border-color: var(--accent); }
.lock-error { margin: 8px 0 0; font-size: 12px; color: var(--danger-fg); }
.lock-submit {
  margin-top: 14px; width: 100%; padding: 5px 14px;
  border-radius: 999px; border: 1px solid var(--accent);
  background: var(--accent); color: var(--on-accent);
  cursor: pointer; font: inherit; font-size: 13px;
}
.lock-submit:hover:not(:disabled) { filter: brightness(1.08); }
.lock-submit:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
