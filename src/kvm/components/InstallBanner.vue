<script setup lang="ts">
// Installation banner: shown when the selected VM is running but has not yet switched back
// to disk boot (bootFromDisk=false) and an ISO is attached, prompting the user to click
// the button to switch back to disk boot after the ISO finishes installing the system.
// Visual 1:1 match with Vue2 components/KVM/KVMFullPage.vue template :142-149 + styles
// :3096-3147 — note that the styles are in the **second, non-scoped** `<style lang="scss">`
// block at the end of the Vue2 file (first `<style scoped>` at :1657, global block at :2875),
// not something you can find at will in the scoped block; noted separately here to avoid
// looking up the wrong place when translating Vue2 sources next time.
//
// This is the only light-colored block on the entire page (the --kvm-banner-* series of
// tokens are light-blue background, defined in theme.sp9.css in T2 phase but unused at
// the time; this task is the first to consume them). Display condition is computed by the
// parent component (KvmPage) and controlled via v-if mounting; this component only handles
// rendering + click callback.
//
// WARNING: Review Important #1 fix (2026-08-02): eject failure was completely silent before —
// `useVmList` writes the failure reason into the shared `lastError`, but that inline error
// only renders in ConsoleStage's `console-placeholder` (`v-if="!connected"`); the banner's
// display condition requires `state==='running'`, at which point T6 has already auto-established
// a VNC connection, `connected` is always true, the placeholder does not render at all,
// so `lastError` is written but has nowhere to be displayed. Vue2 pops a red toast here;
// following the "inline display in console, no toast" convention established in KVM since T5,
// we changed this to add a line of error text **inside the banner** (Vue2 has no such element,
// this is a new display location — without toast, there must be somewhere to put this message,
// not just decorative).
//
// errorKey follows the same convention as ConsoleStage's error-key: could be an i18n key
// (like 'kvmEjectFailed') or already-parsed raw text returned from the backend; in both cases
// use te()/t() to determine — same as the existing consoleErrorKey pattern in KvmPage.vue,
// keeping KVM error display logic consistent across the entire area.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ busy: boolean; errorKey?: string }>()
const emit = defineEmits<{ finish: [] }>()

const { t, te } = useI18n()

const errorText = computed(() => {
  const key = props.errorKey
  if (!key) return ''
  return te(key) ? t(key) : key
})

// ⚠️ Deviation from Vue2 (correcting logic, not copying bugs — already reported): Vue2's `.is-loading`
// relies only on CSS `pointer-events: none` to block mouse clicks (:3127-3130), with no
// disabled attribute on the button itself. Keyboard users tabbing to the button and pressing
// Enter/Space trigger click events unaffected by pointer-events; in theory, with finishingInstall
// true, handleInstallationFinished could be called repeatedly (the method itself has an
// `if (this.finishingInstall) return` fallback, but that's separate from "whether clicks are blocked
// at the click-handler level"; belt-and-braces approach doesn't conflict). Here we check busy
// directly in the click handler and decide whether to emit; no native disabled attribute is added
// (disabled brings Vue2-absent default visuals to most browsers — e.g. fainter default cursor/
// focus styles; not 1:1; pure JS check doesn't affect any visuals).
function onClick(): void {
  if (!props.busy) emit('finish')
}
</script>

<template>
  <div class="installation-banner">
    <div class="banner-content">
      <!-- ℹ is a monochrome text symbol placeholder (no emoji), corresponding to Vue2's
           b-icon icon="information-outline". Pure decoration; the text itself already conveys
           the information, no additional aria-label needed. -->
      <span aria-hidden="true">ℹ</span>
      <span>{{ t('kvmInstallingFromIso') }}</span>
    </div>
    <button
      type="button"
      class="banner-btn"
      :class="{ 'is-loading': busy }"
      @click="onClick"
    >
      {{ t('kvmFinishedInstalling') }}
    </button>
    <!-- New element (Vue2 didn't have this; added per review request — see script comment above):
         inline error message when eject fails. flex-basis:100% makes it take a full line when
         present, without affecting the single-line layout when there's no error. -->
    <p v-if="errorText" class="banner-error">{{ errorText }}</p>
  </div>
</template>
