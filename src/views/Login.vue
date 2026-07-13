<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useValidation } from '../composables/useValidation'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const { login } = useAuth()
const { required, minLen } = useValidation()

const avatarSrc = '/v1/users/image?path=/var/lib/nimoos/1/avatar.png'
const username = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)
const showPassword = ref(false)

onMounted(() => {
  const raw = localStorage.getItem('user')
  if (raw) {
    try { username.value = JSON.parse(raw).username || '' } catch { /* ignore */ }
  }
})

function validate(): boolean {
  const uErr = required(username.value)
  const pErr = required(password.value) || minLen(6)(password.value)
  if (uErr || pErr) { error.value = t(uErr || pErr!); return false }
  return true
}

async function submit() {
  if (busy.value) return
  error.value = ''
  if (!validate()) return
  busy.value = true
  try {
    await login(username.value, password.value)
    const r = route.query.redirect
    const target = (Array.isArray(r) ? r[0] : r) || '/'
    router.push(target)
  } catch (e) {
    error.value = (e as Error)?.message || t('authLoginFailed')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <img class="auth-avatar" :src="avatarSrc"
           @error="($event.target as HTMLImageElement).style.visibility = 'hidden'" alt="" />
      <p v-if="error" class="login-error">{{ error }}</p>
      <label class="auth-label" for="login-username">{{ t('authUsername') }}</label>
      <input id="login-username" class="auth-input login-username" v-model="username" type="text" autocomplete="username"
             @keyup.enter="submit" />
      <label class="auth-label" for="login-password">{{ t('authPassword') }}</label>
      <div class="login-password-field">
        <input id="login-password" class="auth-input login-password" v-model="password"
               :type="showPassword ? 'text' : 'password'" autocomplete="current-password"
               @keyup.enter="submit" />
        <button type="button" class="login-reveal" :aria-label="showPassword ? 'Hide password' : 'Show password'"
                @click="showPassword = !showPassword">{{ showPassword ? '🙈' : '👁' }}</button>
      </div>
      <button class="auth-btn login-submit" :disabled="busy" @click="submit">{{ t('authLogin') }}</button>
    </div>
  </div>
</template>

<style scoped>
.auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
.auth-card {
  width: 22rem; max-width: calc(100vw - 3rem); padding: 2.5rem 2.25rem;
  display: flex; flex-direction: column; gap: 0.5rem;
  background: var(--popup-bg); backdrop-filter: blur(18px);
  border: 1px solid var(--card-border); border-radius: 22px;
  color: var(--fg); box-shadow: var(--card-shadow-hi);
  animation: itemIn 0.4s ease both;
}
.auth-avatar { width: 88px; height: 88px; border-radius: 50%; object-fit: cover; align-self: center; margin-bottom: 0.75rem; }
.auth-label { font-size: 0.8rem; opacity: 0.75; margin-top: 0.5rem; }
.auth-input {
  padding: 0.6rem 0.8rem; border-radius: 12px; border: 1px solid var(--card-border);
  background: var(--inner-bg); color: var(--fg); outline: none;
}
.auth-input:focus { border-color: var(--card-border); }
.login-password-field { position: relative; display: flex; }
.login-password-field .login-password { flex: 1; padding-right: 2.4rem; }
.login-reveal {
  position: absolute; right: 0.4rem; top: 50%; transform: translateY(-50%);
  width: 1.8rem; height: 1.8rem; display: flex; align-items: center; justify-content: center;
  background: transparent; border: none; cursor: pointer; font-size: 0.95rem;
  color: var(--fg); opacity: 0.75; padding: 0; line-height: 1;
}
.login-reveal:hover { opacity: 1; }
.auth-btn {
  margin-top: 1.25rem; padding: 0.7rem; border: none; border-radius: 14px; cursor: pointer;
  background: var(--accent, #3b82f6); color: var(--on-accent); font-weight: 600;
}
.auth-btn:disabled { opacity: 0.6; cursor: default; }
.login-error {
  background: rgba(220, 38, 38, 0.22); border: 1px solid rgba(220, 38, 38, 0.5); /* theme-exception: error state needs dedicated token */
  color: #fecaca; /* theme-exception: error text color needs dedicated token */ padding: 0.5rem 0.75rem; border-radius: 12px; font-size: 0.85rem;
}
</style>
