<!--
  LarkSection — Feishu (Lark) account binding via lark-cli's device flow.
  Ported 1:1 from Vue2 src/views/AI/Settings/sections/LarkSection.vue.

  [D2 declaration] Component-local refs + service.ai direct calls, same as
  ChannelsSection. Vue2's $buefy.dialog.confirm → shared AlertDialog; the
  clipboard helper → useCopyFeedback. Styles (`.lark-*`) moved into
  settings-styles.scss per the zero-<style> section convention.
-->
<template>
  <div class="set-inner">
    <div class="set-page-head">
      <h1 class="set-h1">{{ t('aiCfgLark') }}</h1>
      <p class="set-desc">{{ t('aiCfgLarkDesc') }}</p>
    </div>

    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgLark') }}</div>
      </div>
      <div class="sk-section-body">
        <div v-if="loading && phase === 'unbound'" class="set-note">{{ t('aiCfgLoadingDots') }}</div>

        <!-- unbound -->
        <div v-else-if="phase === 'unbound'" class="lark-cta">
          <button class="sk-btn primary" :disabled="busy" data-test="lark-bind" @click="onBind">
            <AgentIcon name="cloud" :size="14" /> {{ t('aiCfgLarkBind') }}
          </button>
        </div>

        <!-- starting / await_verify / polling: the backend can jump straight
             from starting to polling on a re-bind, skipping await_verify
             entirely, so the verify link is gated on verifyUrl itself —
             never on the phase name. -->
        <div v-else-if="inProgress" class="lark-flow">
          <div class="lark-waiting">
            <span class="lark-spin"></span> {{ t('aiCfgLarkAwaitVerify') }}
          </div>
          <template v-if="verifyUrl">
            <div class="set-copy">
              <input class="set-input full mono" :value="verifyUrl" readonly data-test="lark-verify-url" />
              <button
                class="set-copybtn"
                :class="{ done: copiedKey === 'verify' }"
                @click="copy('verify', verifyUrl)"
              >
                <AgentIcon :name="copiedKey === 'verify' ? 'check' : 'copy'" :size="13" />
                {{ t('aiCopy') }}
              </button>
            </div>
            <div class="lark-open">
              <button class="sk-btn ghost" @click="openVerify">
                <AgentIcon name="external" :size="13" /> {{ t('aiCfgLarkVerifyOpen') }}
              </button>
            </div>
          </template>
        </div>

        <!-- bound -->
        <div v-else-if="phase === 'bound'" class="tok-row">
          <span class="tok-ic"><AgentIcon name="cloud" :size="16" /></span>
          <div class="tok-body">
            <div class="tok-name" data-test="lark-identity">{{ identityLabel(identity) }}</div>
            <div v-if="tokenStatusLabel(identity)" class="tok-meta">
              <span>{{ tokenStatusLabel(identity) }}</span>
            </div>
          </div>
          <button class="tok-del" :disabled="busy" data-test="lark-unbind" @click="confirmUnbindOpen = true">
            <AgentIcon name="trash" :size="13" /> {{ t('aiCfgLarkUnbind') }}
          </button>
        </div>

        <!-- failed -->
        <div v-else-if="phase === 'failed'" class="lark-failed">
          <p class="lark-status err" data-test="lark-error">{{ error }}</p>
          <div v-if="isNotInstalledError(error)" class="set-banner warn">
            <span class="ico"><AgentIcon name="grid" :size="12" /></span>
            <span>
              {{ t('aiCfgLarkNotInstalledHint') }}
              <a href="#" class="lark-tb-link" @click.prevent="goToToolbox">{{
                t('aiCfgLarkGoToToolbox')
              }}</a>
            </span>
          </div>
          <button class="sk-btn primary" :disabled="busy" data-test="lark-retry" @click="onBind">
            <AgentIcon name="refresh" :size="13" /> {{ t('aiCfgLarkRetry') }}
          </button>
        </div>

        <details v-if="log" class="lark-log">
          <summary>{{ t('aiCfgLarkLogLabel') }}</summary>
          <pre>{{ log }}</pre>
        </details>
      </div>
    </div>

    <AlertDialog
      v-model:open="confirmUnbindOpen"
      :title="t('aiCfgLarkUnbind')"
      :message="t('aiCfgLarkUnbindConfirm')"
      :confirm-text="t('aiCfgLarkUnbind')"
      :cancel-text="t('aiCancel')"
      destructive
      @confirm="onUnbind"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import { useToast } from '../../../../stores/toast'
import { useCopyFeedback } from '../../../composables/useCopyFeedback'
import AgentIcon from '../../icons/AgentIcon.vue'
import AlertDialog from '../../../../components/ui/AlertDialog.vue'

const { t } = useI18n()
const toast = useToast()
const router = useRouter()
const { copiedKey, copy } = useCopyFeedback()

const IN_PROGRESS_PHASES = ['starting', 'await_verify', 'polling']
const POLL_MAX_MS = 10 * 60 * 1000

// Test seam, same shape as ToolboxSection's.
const props = withDefaults(defineProps<{ pollIntervalMs?: number }>(), {
  pollIntervalMs: 3000,
})

interface LarkIdentity {
  [k: string]: unknown
}

const loading = ref(false)
const busy = ref(false)
const phase = ref('unbound')
const verifyUrl = ref('')
const identity = ref<LarkIdentity | null>(null)
const error = ref('')
const log = ref('')
const confirmUnbindOpen = ref(false)

const inProgress = computed(() => IN_PROGRESS_PHASES.indexOf(phase.value) !== -1)

const destroyed = ref(false)
onBeforeUnmount(() => {
  destroyed.value = true
})

async function load() {
  loading.value = true
  try {
    const d = ((await service.ai.getLarkBinding()) || {}) as Record<string, unknown>
    // GET never fails server-side (phase=unbound is the fallback there); a
    // transport error just leaves the last-known state on screen rather than
    // flashing something misleading.
    phase.value = (d.phase as string) || 'unbound'
    verifyUrl.value = (d.verify_url as string) || ''
    identity.value = (d.identity as LarkIdentity) || null
    error.value = (d.error as string) || ''
    log.value = (d.log as string) || ''
  } catch {
    /* keep last-known state */
  } finally {
    loading.value = false
  }
}

async function pollStatus(pred: (p: string) => boolean, tries?: number) {
  const max = tries ?? Math.ceil(POLL_MAX_MS / props.pollIntervalMs)
  for (let i = 0; i < max; i++) {
    if (destroyed.value) return false
    // Sleep FIRST: the caller already has a fresh load() in hand, and an
    // immediate re-load would skip right past the await_verify state the
    // user needs on screen (the verify URL) whenever the backend advances
    // quickly.
    await new Promise((r) => setTimeout(r, props.pollIntervalMs))
    await load()
    if (pred(phase.value)) return true
  }
  return false
}

async function onBind() {
  busy.value = true
  error.value = ''
  try {
    await service.ai.startLarkBinding()
    await pollStatus((p) => p === 'bound' || p === 'failed')
  } catch {
    phase.value = 'failed'
    error.value = t('aiCfgLarkBindStartFailed')
  } finally {
    busy.value = false
  }
}

async function onUnbind() {
  busy.value = true
  try {
    await service.ai.deleteLarkBinding()
    phase.value = 'unbound'
    verifyUrl.value = ''
    identity.value = null
    error.value = ''
    log.value = ''
  } catch {
    toast.show(t('aiCfgLarkUnbindFailed'), 3000, 'danger')
  } finally {
    busy.value = false
  }
}

function isNotInstalledError(err: string) {
  return !!err && /not installed/i.test(err)
}

function goToToolbox() {
  void router.push({ path: '/ai/settings', query: { section: 'toolbox' } })
}

function identityLabel(id: LarkIdentity | null) {
  // The real lark-cli `whoami` envelope is camelCase and nests the display
  // name under `onBehalfOf` ({"onBehalfOf":{"userName":"...","openId":"..."}}),
  // not the flat snake_case `name` this originally assumed — read both
  // shapes so the bound row shows the actual Feishu account, not the
  // generic fallback. `name` is kept last for any envelope that does carry
  // a flat display name.
  const d = (id || {}) as Record<string, any>
  const onBehalf = (d.onBehalfOf || d.on_behalf_of || {}) as Record<string, any>
  const name =
    d.user_name || d.userName || onBehalf.userName || onBehalf.user_name || d.name || ''
  const tenant = d.tenant_key || d.tenantKey || ''
  if (!name && !tenant) return t('aiCfgLarkBoundGeneric')
  return tenant ? `${name} · ${tenant}` : name
}

function tokenStatusLabel(id: LarkIdentity | null) {
  const d = (id || {}) as Record<string, any>
  return (d.token_status || d.tokenStatus || '') as string
}

function openVerify() {
  if (verifyUrl.value) window.open(verifyUrl.value, '_blank')
}

onMounted(() => {
  void load().then(() => {
    if (inProgress.value) void pollStatus((p) => p === 'bound' || p === 'failed')
  })
})
</script>
