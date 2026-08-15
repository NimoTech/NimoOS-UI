<script setup lang="ts">
import { ref, watch, useTemplateRef, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import lottie from 'lottie-web'
import { useAuth } from '../composables/useAuth'
import { useValidation } from '../composables/useValidation'
import { useLocaleStore } from '../stores/locale'
import { initialLocale, type Locale } from '../i18n/locale'
import doneData from '../assets/done.json'

const { t } = useI18n()
const router = useRouter()
const { registerAndLogin } = useAuth()
const { required, minLen, sameAs } = useValidation()
const localeStore = useLocaleStore()
// Same source of truth as i18n/index.ts, so the pre-selected chip always matches the
// language the page is actually rendering in.
const chosenLang = ref<Locale>(initialLocale())
function pickLang(l: Locale) {
  chosenLang.value = l
  localeStore.setLocale(l)
}

const step = ref(1)
const username = ref('')
const password = ref('')
const confirmation = ref('')
const error = ref('')
const busy = ref(false)
const showPassword = ref(false)
const showConfirm = ref(false)
const doneEl = useTemplateRef<HTMLElement>('doneEl')

function validate(): boolean {
  const uErr = required(username.value)
  const pErr = required(password.value) || minLen(6)(password.value)
  const cErr = sameAs(() => password.value)(confirmation.value)
  if (uErr || pErr || cErr) { error.value = t(uErr || pErr || cErr!); return false }
  return true
}

async function create() {
  if (busy.value) return
  error.value = ''
  if (!validate()) return
  busy.value = true
  try {
    const key = sessionStorage.getItem('init_key') || ''
    await registerAndLogin(username.value, password.value, key)
    await localeStore.persist(chosenLang.value)
    step.value = 3
  } catch (e) {
    error.value = (e as Error)?.message || t('welcomeRegisterFailed')
  } finally {
    busy.value = false
  }
}

// Once step 3 is mounted, play the completion animation and navigate to the home page when it ends
let anim: ReturnType<typeof lottie.loadAnimation> | null = null
watch([step, doneEl], ([s, el]) => {
  if (s === 3 && el) {
    anim = lottie.loadAnimation({ container: el, renderer: 'svg', loop: false, autoplay: true, animationData: doneData })
    anim.addEventListener('complete', () => router.push('/'))
  }
})

onUnmounted(() => {
  anim?.destroy()
  anim = null
})
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <div v-if="step === 1" class="welcome-step1">
        <h2 class="welcome-title">{{ t('welcomeTitle') }}</h2>
        <p class="welcome-sub">{{ t('welcomeSubtitle') }}</p>
        <button class="auth-btn welcome-go" @click="step = 2">{{ t('welcomeGo') }}</button>
      </div>

      <div v-else-if="step === 2" class="welcome-step2">
        <h2 class="welcome-title">{{ t('welcomeCreateAccount') }}</h2>
        <div class="welcome-lang">
          <span class="auth-label">{{ t('welcomeLanguage') }}</span>
          <div class="welcome-lang-btns">
            <button type="button" class="welcome-lang-zh"
                    :class="{ active: chosenLang === 'zh_cn' }" @click="pickLang('zh_cn')">简体中文</button>
            <button type="button" class="welcome-lang-en"
                    :class="{ active: chosenLang === 'en_us' }" @click="pickLang('en_us')">English</button>
          </div>
        </div>
        <p v-if="error" class="login-error">{{ error }}</p>
        <label class="auth-label" for="welcome-username">{{ t('authUsername') }}</label>
        <input id="welcome-username" class="auth-input welcome-username" v-model="username" type="text"
               autocomplete="username" @keyup.enter="create" />
        <label class="auth-label" for="welcome-password">{{ t('authPassword') }}</label>
        <div class="welcome-password-field">
          <input id="welcome-password" class="auth-input welcome-password" v-model="password"
                 :type="showPassword ? 'text' : 'password'" autocomplete="new-password" @keyup.enter="create" />
          <button type="button" class="welcome-reveal" :aria-label="showPassword ? 'Hide password' : 'Show password'"
                  @click="showPassword = !showPassword">{{ showPassword ? '🙈' : '👁' }}</button>
        </div>
        <label class="auth-label" for="welcome-confirm">{{ t('welcomeConfirmPassword') }}</label>
        <div class="welcome-password-field">
          <input id="welcome-confirm" class="auth-input welcome-confirm" v-model="confirmation"
                 :type="showConfirm ? 'text' : 'password'" autocomplete="new-password" @keyup.enter="create" />
          <button type="button" class="welcome-reveal" :aria-label="showConfirm ? 'Hide password' : 'Show password'"
                  @click="showConfirm = !showConfirm">{{ showConfirm ? '🙈' : '👁' }}</button>
        </div>
        <button class="auth-btn welcome-create" :disabled="busy" @click="create">{{ t('welcomeCreate') }}</button>
      </div>

      <div v-else class="welcome-step3">
        <h2 class="welcome-title">{{ t('welcomeDone') }}</h2>
        <div ref="doneEl" class="welcome-done-anim"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page { min-height: 100vh; min-height: 100dvh; display: flex; align-items: center; justify-content: center; }
.auth-card {
  width: 24rem; max-width: calc(100vw - 3rem); padding: 2.75rem 2.5rem;
  display: flex; flex-direction: column; gap: 0.5rem; text-align: center;
  background: var(--popup-bg); backdrop-filter: blur(18px);
  border: 1px solid var(--card-border); border-radius: 22px;
  color: var(--fg); box-shadow: var(--card-shadow-hi);
  animation: itemIn 0.4s ease both;
}
.welcome-title { font-size: 1.5rem; font-weight: 700; }
.welcome-sub { opacity: 0.75; margin-bottom: 1rem; }
.welcome-step2 { text-align: left; }
.auth-label { font-size: 0.8rem; opacity: 0.75; margin-top: 0.5rem; display: block; }
.auth-input {
  width: 100%; padding: 0.6rem 0.8rem; border-radius: 12px; border: 1px solid var(--card-border);
  background: var(--inner-bg); color: var(--fg); outline: none; box-sizing: border-box;
}
.auth-input:focus { border-color: var(--card-border); }
.welcome-password-field { position: relative; display: flex; }
.welcome-password-field .auth-input { padding-right: 2.4rem; }
.welcome-reveal {
  position: absolute; right: 0.4rem; top: 50%; transform: translateY(-50%);
  width: 1.8rem; height: 1.8rem; display: flex; align-items: center; justify-content: center;
  background: transparent; border: none; cursor: pointer; font-size: 0.95rem;
  color: var(--fg); opacity: 0.75; padding: 0; line-height: 1;
}
.welcome-reveal:hover { opacity: 1; }
.auth-btn {
  margin-top: 1.25rem; padding: 0.7rem 1.5rem; border: none; border-radius: 14px; cursor: pointer;
  background: var(--accent, #3b82f6); color: var(--on-accent); font-weight: 600;
}
.auth-btn:disabled { opacity: 0.6; cursor: default; }
.login-error {
  background: rgba(220, 38, 38, 0.22); border: 1px solid rgba(220, 38, 38, 0.5); /* theme-exception: error state needs dedicated token */
  color: #fecaca; /* theme-exception: error text color needs dedicated token */ padding: 0.5rem 0.75rem; border-radius: 12px; font-size: 0.85rem;
}
.welcome-done-anim { width: 120px; height: 120px; margin: 1rem auto 0; }
.welcome-lang { margin: 0.25rem 0 0.5rem; }
.welcome-lang-btns { display: flex; gap: 0.5rem; margin-top: 0.35rem; }
.welcome-lang-btns button {
  flex: 1; padding: 0.45rem 0.5rem; border-radius: 10px; cursor: pointer;
  background: var(--chip-bg); color: var(--fg);
  border: 1px solid var(--chip-border);
}
.welcome-lang-btns button.active { border-color: var(--accent, #3b82f6); background: var(--accent-soft); }
</style>
