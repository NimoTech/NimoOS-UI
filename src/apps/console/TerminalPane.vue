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
/* flex 填满父容器剩余空间(AppConsolePage 定高布局给分母);min-height 兜底极矮视口 */
.term-wrap { position: relative; flex: 1 1 auto; min-height: 320px; border-radius: 12px; overflow: hidden; background: var(--console-bg); }
.term-wrap.fullscreen { position: fixed; inset: 0; z-index: 200; height: auto; border-radius: 0; }
/* 右侧贴边(inset-right 0):让 xterm 滚动条和 YAML/日志一样落在框边,
   由拇指自身 3px 透明边框提供与边框的间距;上下左 8px 是内容呼吸边距 */
.term-host { position: absolute; inset: 8px 0 8px 8px; }
/* 滚动条与 YAML/日志同一套观感:拇指 token 固定亮色(全局滚动条色随主题翻转,深底上会隐形)、
   宽 16/边 5(拇指两侧各留 5px);track margin 8px + host 上下 inset 8px = 距框 16px,与 YAML/日志的 16px 对齐 */
.term-host :deep(.xterm-viewport) { scrollbar-width: thin; scrollbar-color: var(--console-scroll-thumb) transparent; }
.term-host :deep(.xterm-viewport)::-webkit-scrollbar { width: 16px; height: 16px; }
.term-host :deep(.xterm-viewport)::-webkit-scrollbar-track { background: transparent; margin: 8px; }
.term-host :deep(.xterm-viewport)::-webkit-scrollbar-thumb { background: var(--console-scroll-thumb); border: 5px solid transparent; background-clip: padding-box; border-radius: 8px; }
.term-host :deep(.xterm-viewport)::-webkit-scrollbar-thumb:hover { background: var(--console-scroll-thumb-hover); background-clip: padding-box; }
.term-fs { position: absolute; top: 8px; right: 12px; z-index: 10; background: transparent; border: none; color: var(--console-fg); opacity: .5; cursor: pointer; }
.term-fs:hover { opacity: 1; }
.term-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 12px; align-items: center; justify-content: center; color: var(--console-fg); background: color-mix(in srgb, var(--console-bg) 82%, transparent); }
.term-reconnect { padding: 6px 18px; border-radius: 9px; border: 1px solid var(--card-border); background: var(--chip-bg-hi); color: var(--fg); cursor: pointer; }
</style>
