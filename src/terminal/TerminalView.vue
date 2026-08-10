<script setup lang="ts">
// /terminal — iframe over the ticket-gated ttyd proxy. Assembly layer only:
// the session machine lives in useTerminalSession, the tab strip logic in
// useTerminalWindows; this file owns the DOM (iframe, activity listeners,
// beforeunload) and the AreaShell chrome (spec §1 decision 2).
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AreaShell from '../components/shell/AreaShell.vue'
import TerminalTabs from './TerminalTabs.vue'
import TerminalLockCard from './TerminalLockCard.vue'
import { useTerminalSession } from './useTerminalSession'
import { useTerminalWindows } from './useTerminalWindows'

const { t } = useI18n()
const router = useRouter()

const { state, mode, frameSrc, pwError, submitting, frozenSeconds, warning, provision, submitPassword, notifyActivity, lock, maybeDeleteSession, dispose } = useTerminalSession()
const windows = useTerminalWindows(lock)

const frame = ref<HTMLIFrameElement | null>(null)
// Same four events Vue2 watches, in capture phase so the iframe chrome can't
// swallow them before we see them.
const ACT_EVENTS = ['keydown', 'mousedown', 'wheel', 'touchstart'] as const
let windowBound = false
let frameDocBound = false

function onAct() { notifyActivity() }

function bindWindowActivity() {
  if (windowBound) return
  ACT_EVENTS.forEach((ev) => window.addEventListener(ev, onAct, true))
  windowBound = true
}

// The iframe document only exists after it actually navigates to /v1/terminal/
// (at bind time it is still the blank pre-navigation document) — 1:1 with
// Vue2's onFrameLoad timing fix.
function onFrameLoad() {
  if (state.value !== 'ready' || mode.value !== 'idle' || frameDocBound) return
  try {
    const doc = frame.value?.contentWindow?.document
    if (!doc) return
    ACT_EVENTS.forEach((ev) => doc.addEventListener(ev, onAct, true))
    frameDocBound = true
  } catch { /* same-origin normally; ignore as a fallback (1:1 Vue2) */ }
}

function unbindActivity() {
  if (windowBound) {
    ACT_EVENTS.forEach((ev) => window.removeEventListener(ev, onAct, true))
    windowBound = false
  }
  if (frameDocBound) {
    try {
      const doc = frame.value?.contentWindow?.document
      if (doc) ACT_EVENTS.forEach((ev) => doc.removeEventListener(ev, onAct, true))
    } catch { /* frame already gone — nothing to unbind */ }
    frameDocBound = false
  }
}

watch([state, mode], ([st, m]) => {
  if (st === 'ready') {
    windows.start()
    if (m === 'idle') bindWindowActivity()
  } else {
    windows.stop()
    unbindActivity()
  }
})

// on_open sessions are single-use: closing the tab returns the ticket too.
function onBeforeUnload() { maybeDeleteSession() }

onMounted(() => {
  window.addEventListener('beforeunload', onBeforeUnload)
  void provision()
})
onUnmounted(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  windows.stop()
  unbindActivity()
  dispose()
})
</script>

<template>
  <AreaShell :title="t('appTerminal')">
    <div class="term-page">
      <!-- Desktop-only back affordance: AreaShell's own bar (with back-home) only
           renders on narrow screens, and /terminal has no sidebar to host one. -->
      <button class="term-back" type="button" @click="router.push('/')">‹ {{ t('areaBackHome') }}</button>
      <header class="term-head">
        <h2 class="term-title">{{ t('appTerminal') }}</h2>
        <TerminalTabs
          v-if="state === 'ready'"
          class="term-head-tabs"
          :windows="windows.windows.value"
          @select="windows.select"
          @create="windows.create"
          @close="windows.close"
          @rename="windows.rename"
        />
      </header>
      <div class="term-stage">
        <div v-if="state === 'loading'" class="term-hint" data-test="term-loading">{{ t('termLoading') }}</div>
        <div v-else-if="state === 'forbidden'" class="term-hint" data-test="term-forbidden">{{ t('termAdminOnly') }}</div>
        <div v-else-if="state === 'error'" class="term-hint" data-test="term-error">
          <span>{{ t('termUnavailable') }}</span>
          <button type="button" class="term-retry" data-test="term-retry" @click="provision()">{{ t('termRetry') }}</button>
        </div>
        <TerminalLockCard v-else-if="state === 'locked'" :pw-error="pwError" :frozen-seconds="frozenSeconds" :submitting="submitting" @submit="submitPassword" />
        <iframe v-show="state === 'ready'" ref="frame" class="term-frame" :src="frameSrc" title="NimoOS Terminal" @load="onFrameLoad" />
        <div v-if="warning" class="term-warn" data-test="term-warn">{{ t('termIdleWarn') }}</div>
      </div>
    </div>
  </AreaShell>
</template>

<style scoped>
/* App-style fixed-height layout (tabs + stage, no long document content):
   height:100% gives the stage a definite denominator so the iframe can fill
   the remaining space — same lesson as AppConsolePage's .apps-layout. */
.term-page { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.term-back {
  align-self: flex-start; margin-bottom: 14px; font-size: 13px;
  border: 0; background: transparent; color: var(--fg-muted); cursor: pointer; padding: 0;
}
.term-back:hover { color: var(--fg); }
/* AreaShell's narrow-screen bar already carries back-home — avoid doubling it. */
@media (max-width: 768px) { .term-back { display: none; } }
.term-head { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; min-width: 0; }
.term-title { margin: 0; font-size: 18px; font-weight: 600; color: var(--fg); }
.term-head-tabs { margin-left: auto; min-width: 0; }
/* The stage is the one intentionally constant-dark surface on the page:
   ttyd's terminal inside the iframe cannot be tokenized (third-party
   exception, --console-* tokens), so the stage matches it in both themes. */
.term-stage {
  position: relative; flex: 1 1 auto; min-height: 320px;
  border-radius: 12px; overflow: hidden; background: var(--console-bg);
}
.term-frame { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: block; }
.term-hint {
  position: absolute; inset: 0; display: flex; flex-direction: column; gap: 12px;
  align-items: center; justify-content: center; color: var(--console-fg);
}
.term-retry {
  padding: 6px 18px; border-radius: 9px; border: 1px solid var(--card-border);
  background: var(--chip-bg-hi); color: var(--fg); cursor: pointer; font-size: 13px;
}
.term-warn {
  position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 20;
  padding: 6px 14px; border-radius: 9px; font-size: 13px;
  background: var(--warn-bg); color: var(--warn-fg); border: 1px solid var(--warn-border);
  backdrop-filter: blur(8px);
}
</style>
