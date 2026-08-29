<script setup lang="ts">
// Change-password form — corresponds to Vue2 AccountPanel state 3 (:723-744) +
// savePassword (:415-440).
//
// ⛔ Submitting this form makes the backend run chpasswd, **writing /etc/shadow**
// (NimoOS-UserService route/v1/user.go:403), and both SSH and web login read /etc/shadow —
// this changes the device owner's own login credentials, **and cannot be undone**.
// It has never actually been submitted for real during development (plan D table /
// debt D26); coverage relies on unit tests.
//
// 🔧 Plan C1 corrects two pieces of Vue2 behavior (not free-form changes):
//   ① Vue2 puts the failure message into a `b-notification` with auto-close (it disappears
//      on its own, and the user may not have seen it) → changed to a persistent inline
//      .set-danger, cleared only on the next submit (C6: dialog/form errors don't use a
//      toast).
//   ② Vue2 shows **no feedback at all** on success, just goto(1) → the success toast is
//      supplied by the host (consistent with "change avatar").
// Validation: Vue2 relies on vee-validate's required/min:5 plus its own confirmation
// comparison inside savePassword. Here validation is done by hand (New-UI has no
// vee-validate), in the order empty → mismatch, equivalent to Vue2's visible behavior.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import '../../styles/settings.css'

const { t } = useI18n()

const oriPassword = ref('')
const password = ref('')
const confirmation = ref('')
const error = ref('')
const busy = ref(false)

async function submit(): Promise<boolean> {
  if (busy.value) return false
  error.value = ''
  if (!oriPassword.value || !password.value || !confirmation.value) {
    error.value = t('settingsAccFillAllFields')
    return false
  }
  if (password.value !== confirmation.value) {
    error.value = t('settingsAccPwdMismatch')
    return false
  }
  busy.value = true
  try {
    await service.users.changePassword(oriPassword.value, password.value)
    oriPassword.value = ''
    password.value = ''
    confirmation.value = ''
    return true
  } catch (e) {
    const r = e as { response?: { data?: { message?: string } }; message?: string }
    error.value = r?.response?.data?.message || r?.message || String(e)
    return false
  } finally {
    busy.value = false
  }
}
defineExpose({ submit })
</script>

<template>
  <div class="set-acc-pwd">
    <!-- Honeypot: keeps the browser from autofilling the username somewhere else (Vue2 :725, this inline style copied verbatim) -->
    <input
      type="text" autocomplete="username" aria-hidden="true" tabindex="-1"
      style="position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0;"
    >

    <p v-if="error" class="set-danger" data-test="acc-pwd-error">{{ error }}</p>

    <!-- Wrapped in .set-net-field: otherwise it inherits .set-input's width:92px (plan C7, actually got clipped this way in P2) -->
    <div class="set-net-field">
      <input
        v-model="oriPassword" class="set-input" type="password" autocomplete="new-password"
        :disabled="busy" :placeholder="t('settingsAccOriPassword')" data-test="acc-pwd-ori"
      >
    </div>
    <div class="set-net-field">
      <input
        v-model="password" class="set-input" type="password" autocomplete="new-password"
        :disabled="busy" :placeholder="t('settingsAccNewPassword')" data-test="acc-pwd-new"
      >
    </div>
    <div class="set-net-field">
      <input
        v-model="confirmation" class="set-input" type="password" autocomplete="new-password"
        :disabled="busy" :placeholder="t('settingsAccConfirmNewPassword')" data-test="acc-pwd-cfm"
      >
    </div>
  </div>
</template>

<style scoped>
.set-acc-pwd { position: relative; display: flex; flex-direction: column; gap: 14px; max-width: 420px; }
</style>
