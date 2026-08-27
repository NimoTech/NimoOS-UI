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
import { selectionPreview } from './selectionPreview'
import { decodeOsc52, writeClipboard, type XtermLike } from './osc52'

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

// ── Copy-on-select ──────────────────────────────────────────────────────────
// ttyd's client exposes its xterm instance as `window.term` inside the iframe
// (same origin: /v1/terminal/). Two paths, because the session runs in tmux
// with `mouse on`:
//  • plain drag → tmux owns the selection; on release it emits OSC 52 with the
//    text (see osc52.ts), which we catch via xterm's parser hook;
//  • shift+drag → xterm's own selection; read it with getSelection() on mouseup.
// Either way the text goes to the clipboard and the "Copied: …" pill below
// tells the user what actually landed there.
let selDoc: Document | null = null
let oscHandle: { dispose(): void } | null = null
let termPoll: ReturnType<typeof setInterval> | undefined
const copied = ref('')
let copiedTimer: ReturnType<typeof setTimeout> | undefined

function showCopied(text: string) {
  copied.value = t('termCopied', { text: selectionPreview(text) })
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => { copied.value = '' }, 2200)
}

function frameTerm(): XtermLike | undefined {
  try { return (frame.value?.contentWindow as (Window & { term?: XtermLike }) | null | undefined)?.term } catch { return undefined }
}

async function copyToClipboard(text: string, doc: Document, term: XtermLike | undefined) {
  try {
    await writeClipboard(text, doc)
    // the execCommand fallback focused a temporary textarea; hand focus back
    // to the terminal so the user can keep typing.
    term?.focus?.()
    showCopied(text)
  } catch { /* clipboard unavailable — selection still highlighted, nothing to report */ }
}

async function onFrameMouseUp(e: MouseEvent) {
  if (e.button !== 0) return // right-click menus / middle-click paste must not re-copy
  const term = frameTerm()
  const text = term?.getSelection?.() ?? ''
  if (!text || !selDoc) return
  await copyToClipboard(text, selDoc, term)
}

function onOsc52(data: string): boolean {
  const text = decodeOsc52(data)
  if (!text || !selDoc) return false
  void copyToClipboard(text, selDoc, frameTerm())
  return true
}

// ttyd constructs the xterm instance from its own script after the document
// loads, so `window.term` may not exist yet at the iframe's load event — poll
// briefly until it does, then hook OSC 52 once.
function bindOsc52() {
  clearInterval(termPoll)
  let tries = 0
  const attempt = () => {
    const term = frameTerm()
    if (term?.parser?.registerOscHandler) {
      clearInterval(termPoll); termPoll = undefined
      oscHandle = term.parser.registerOscHandler(52, onOsc52)
    } else if (++tries >= 50) { clearInterval(termPoll); termPoll = undefined }
  }
  attempt()
  if (!oscHandle) termPoll = setInterval(attempt, 100)
}

function bindSelectionCopy(doc: Document) {
  // same document loading again (or a load that fired before ttyd created
  // `window.term`): keep the mouseup hook, just make sure OSC 52 is attached.
  if (selDoc === doc) { if (!oscHandle) bindOsc52(); return }
  unbindSelectionCopy()
  doc.addEventListener('mouseup', onFrameMouseUp)
  selDoc = doc
  bindOsc52()
}

function unbindSelectionCopy() {
  clearInterval(termPoll); termPoll = undefined
  try { oscHandle?.dispose() } catch { /* terminal already torn down */ }
  oscHandle = null
  if (!selDoc) return
  try { selDoc.removeEventListener('mouseup', onFrameMouseUp) } catch { /* document already torn down */ }
  selDoc = null
}

// The iframe document only exists after it actually navigates to /v1/terminal/
// (at bind time it is still the blank pre-navigation document) — 1:1 with
// Vue2's onFrameLoad timing fix.
function onFrameLoad() {
  if (state.value !== 'ready') return
  let doc: Document | null | undefined
  try { doc = frame.value?.contentWindow?.document } catch { doc = null /* same-origin normally; ignore as a fallback (1:1 Vue2) */ }
  if (!doc) return
  bindSelectionCopy(doc)
  if (mode.value !== 'idle' || frameDocBound) return
  ACT_EVENTS.forEach((ev) => doc!.addEventListener(ev, onAct, true))
  frameDocBound = true
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
    unbindSelectionCopy()
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
  clearTimeout(copiedTimer)
  windows.stop()
  unbindActivity()
  unbindSelectionCopy()
  dispose()
})
</script>

<template>
  <AreaShell :title="t('appTerminal')">
    <div class="term-page">
      <!-- One-row chrome: back-home (desktop only — AreaShell's own narrow-screen
           bar already carries it, and /terminal has no sidebar to host one)
           followed directly by the tmux window tabs. No page title: the tabs
           are the identity of the page and every vertical pixel goes to the
           terminal. -->
      <header class="term-head">
        <button class="term-back" type="button" data-test="term-back" @click="router.push('/')">‹ {{ t('areaBackHome') }}</button>
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
        <transition name="term-copied">
          <div v-if="copied" class="term-copied" data-test="term-copied" role="status" aria-live="polite">{{ copied }}</div>
        </transition>
      </div>
    </div>
  </AreaShell>
</template>

<style scoped>
/* App-style fixed-height layout (tabs + stage, no long document content):
   height:100% gives the stage a definite denominator so the iframe can fill
   the remaining space — same lesson as AppConsolePage's .apps-layout. */
.term-page { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.term-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; min-width: 0; }
.term-back {
  flex: 0 0 auto; font-size: 13px; white-space: nowrap;
  border: 0; background: transparent; color: var(--fg-muted); cursor: pointer; padding: 0;
}
.term-back:hover { color: var(--fg); }
/* AreaShell's narrow-screen bar already carries back-home — avoid doubling it. */
@media (max-width: 768px) { .term-back { display: none; } }
/* Tabs sit right after the back button and take the rest of the row; min-width:0
   lets the strip scroll horizontally instead of pushing the row wider. */
.term-head-tabs { flex: 1 1 auto; min-width: 0; }
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
/* Copy-on-select confirmation: bottom-right of the stage, over the terminal,
   never interactive. Uses the console tokens (same values in both themes, like
   the stage itself) so it reads the same everywhere; monospace echoes the
   copied command. */
.term-copied {
  position: absolute; right: 14px; bottom: 14px; z-index: 20; max-width: min(70%, 560px);
  padding: 6px 12px; border-radius: 9px; font-size: 12px; line-height: 1.5;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  background: var(--console-bg); color: var(--console-fg); border: 1px solid var(--border);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; pointer-events: none;
  backdrop-filter: blur(8px);
}
.term-copied-enter-active, .term-copied-leave-active { transition: opacity 0.18s, transform 0.18s ease; }
.term-copied-enter-from, .term-copied-leave-to { opacity: 0; transform: translateY(6px); }
</style>
