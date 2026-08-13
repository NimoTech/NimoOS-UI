<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { AttachAddon } from '@xterm/addon-attach'
import '@xterm/xterm/css/xterm.css'
import { refreshAccessToken } from '@nimotech/nimoos-service'
import { TerminalSocket, type TerminalStatus } from './terminalSocket'

const props = defineProps<{ containerId: string }>()
const { t } = useI18n()
const host = ref<HTMLElement | null>(null)
const status = ref<TerminalStatus>('idle')
const fullscreen = ref(false)

let term: Terminal | null = null
let fit: FitAddon | null = null
let attach: AttachAddon | null = null
let sock: TerminalSocket | null = null

function makeDeps() {
  return {
    getToken: () => localStorage.getItem('access_token'),
    getExpiresAt: () => { const raw = localStorage.getItem('expires_at'); return raw != null && raw !== '' ? Number(raw) : null },
    refresh: () => refreshAccessToken(),
    now: () => Date.now(),
    wsBase: () => `${location.protocol.startsWith('https') ? 'wss:' : 'ws:'}//${location.host}`,
    makeSocket: (url: string) => new WebSocket(url),
    onStatus: (s: TerminalStatus) => { status.value = s },
  }
}

async function connect() {
  if (!host.value) return
  if (!term) {
    term = new Terminal({
      fontSize: 13, cursorBlink: true, cursorStyle: 'underline',
      fontFamily: 'Consolas, Monaco, monospace',
      theme: { background: '#1e1e1e' }, // xterm's JS theme object can't read CSS vars; keep in sync with --console-bg
    })
    fit = new FitAddon()
    term.loadAddon(fit)
    term.open(host.value)
  }
  fit?.fit()
  attach?.dispose(); attach = null
  sock = new TerminalSocket(makeDeps())
  const ws = await sock.connect(props.containerId, term.cols, term.rows)
  if (ws && term) { attach = new AttachAddon(ws); term.loadAddon(attach) }
}

function toggleFullscreen() { fullscreen.value = !fullscreen.value; requestAnimationFrame(() => fit?.fit()) }

onMounted(() => { void connect() })
onBeforeUnmount(() => { sock?.close(); attach?.dispose(); term?.dispose() })
</script>

<template>
  <div class="term-wrap" :class="{ fullscreen }">
    <button class="term-fs" type="button" data-test="term-fs" :aria-label="t('appsConsoleFullscreen')" @click="toggleFullscreen">⛶</button>
    <div ref="host" class="term-host" />
    <div v-if="status === 'closed'" class="term-overlay">
      <p>{{ t('appsConsoleDisconnected') }}</p>
      <button type="button" data-test="term-reconnect" class="term-reconnect" @click="connect()">{{ t('appsConsoleReconnect') }}</button>
    </div>
    <div v-else-if="status === 'connecting'" class="term-overlay">{{ t('appsConsoleConnecting') }}</div>
  </div>
</template>

<style scoped>
/* flex fills the parent's remaining space (AppConsolePage's fixed-height layout provides the denominator); min-height guards very short viewports */
.term-wrap { position: relative; flex: 1 1 auto; min-height: 320px; border-radius: 12px; overflow: hidden; background: var(--console-bg); }
.term-wrap.fullscreen { position: fixed; inset: 0; z-index: 200; height: auto; border-radius: 0; }
/* Inset 10px on all four sides so the scrollbar moves away from the rounded frame along with
   the content. Native/standard scrollbars always hug the scroll container's edge and there is
   no property for "distance from the border" — insetting the whole scroll container is the only
   cross-browser approach (2026-07-22 real-device lesson: theme.css sets standard
   scrollbar-width/color on *, so Chrome 121+ disables all ::-webkit-scrollbar customization;
   the width/track margins tuned before that were dead code) */
/* xterm height snaps to whole rows; the panel height remainder (0 to one row) piles up below
   the grid, pushing the scrollbar's bottom end visibly farther from the frame than the right
   side; column flex with vertical centering splits the remainder evenly top/bottom so all four
   margins look symmetric */
.term-host { position: absolute; inset: 10px; display: flex; flex-direction: column; justify-content: center; }
/* Use a fixed light token for the thumb on this dark panel: the global scrollbar color flips with the theme, and in the light theme a dark thumb on a dark background is invisible */
.term-host :deep(.xterm-viewport) { scrollbar-width: thin; scrollbar-color: var(--console-scroll-thumb) transparent; }
.term-fs { position: absolute; top: 8px; right: 12px; z-index: 10; background: transparent; border: none; color: var(--console-fg); opacity: .5; cursor: pointer; }
.term-fs:hover { opacity: 1; }
.term-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 12px; align-items: center; justify-content: center; color: var(--console-fg); background: color-mix(in srgb, var(--console-bg) 82%, transparent); }
.term-reconnect { padding: 6px 18px; border-radius: 9px; border: 1px solid var(--card-border); background: var(--chip-bg-hi); color: var(--fg); cursor: pointer; }
</style>
