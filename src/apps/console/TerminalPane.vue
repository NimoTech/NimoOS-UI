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
      theme: { background: '#1e1e1e' }, // xterm JS 主题对象吃不到 CSS var,与 --console-bg 保持同值
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
.term-wrap { position: relative; height: 480px; border-radius: 12px; overflow: hidden; background: var(--console-bg); }
.term-wrap.fullscreen { position: fixed; inset: 0; z-index: 200; height: auto; border-radius: 0; }
.term-host { position: absolute; inset: 8px; }
.term-fs { position: absolute; top: 8px; right: 12px; z-index: 10; background: transparent; border: none; color: var(--console-fg); opacity: .5; cursor: pointer; }
.term-fs:hover { opacity: 1; }
.term-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 12px; align-items: center; justify-content: center; color: var(--console-fg); background: color-mix(in srgb, var(--console-bg) 82%, transparent); }
.term-reconnect { padding: 6px 18px; border-radius: 9px; border: 1px solid var(--card-border); background: var(--chip-bg-hi); color: var(--fg); cursor: pointer; }
</style>
