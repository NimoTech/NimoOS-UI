### Task 5: xterm 依赖 + TerminalPane 薄壳

**Files:**
- Modify: `NimoOS-New-UI/package.json`(pnpm add)
- Modify: `NimoOS-New-UI/src/styles/theme.css`(console token)
- Create: `NimoOS-New-UI/src/apps/console/TerminalPane.vue`
- Test: `NimoOS-New-UI/src/apps/console/TerminalPane.test.ts`

**Interfaces:**
- Consumes: T4 `TerminalSocket`/`TerminalStatus`;`refreshAccessToken`(共享包)。
- Produces(T7 消费):`<TerminalPane :container-id="id" />`,无 emit;组件自持连接生命周期(mount 连,unmount 断)。

- [ ] **Step 1: 装依赖**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm add @xterm/xterm@^5.5.0 @xterm/addon-fit@^0.10.0 @xterm/addon-attach@^0.11.0
```

(新包名带 @xterm scope;Vue2 用的旧 `xterm@4` 已废弃,不沿用。)

- [ ] **Step 2: theme.css 加 token**(终端语义固定深色,浅色主题下也不变——跟 Vue2 一致;字面量集中在 token 文件合法)

```css
  /* P6 终端/日志控制台(终端语义固定深色,不随主题翻转) */
  --console-bg: #1e1e1e;
  --console-fg: #d4d4d4;
```

- [ ] **Step 3: 写冒烟测试**(mock 掉 @xterm 三件——jsdom 无 canvas;仅验生命周期接线与断线 UI)

```ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

const termMock = { open: vi.fn(), loadAddon: vi.fn(), dispose: vi.fn(), cols: 80, rows: 24 }
vi.mock('@xterm/xterm', () => ({ Terminal: vi.fn(() => termMock) }))
vi.mock('@xterm/addon-fit', () => ({ FitAddon: vi.fn(() => ({ fit: vi.fn(), dispose: vi.fn() })) }))
vi.mock('@xterm/addon-attach', () => ({ AttachAddon: vi.fn(() => ({ dispose: vi.fn() })) }))

let statusCb: ((s: string) => void) | null = null
const connectMock = vi.fn().mockResolvedValue(null)
vi.mock('./terminalSocket', () => ({
  TerminalSocket: vi.fn((deps: { onStatus: (s: string) => void }) => {
    statusCb = deps.onStatus
    return { connect: connectMock, close: vi.fn() }
  }),
  buildTerminalWsUrl: vi.fn(),
}))

import TerminalPane from './TerminalPane.vue'

it('挂载即连接;断开后显示重连按钮,点击再连', async () => {
  const w = mount(TerminalPane, { props: { containerId: 'c1' }, global: { mocks: { $t: (k: string) => k } } })
  await nextTick()
  expect(connectMock).toHaveBeenCalledTimes(1)
  statusCb?.('closed')
  await nextTick()
  const btn = w.find('[data-test="term-reconnect"]')
  expect(btn.exists()).toBe(true)
  await btn.trigger('click')
  expect(connectMock).toHaveBeenCalledTimes(2)
})
```

(i18n 挂法照仓里现有组件测试惯例——多数用真 i18n 实例,照抄邻近测试的 global 配置,别用 $t mock 如果惯例不是这样。)

- [ ] **Step 4: 跑测试确认失败** → Expected: FAIL(组件不存在)。

- [ ] **Step 5: 实现 `TerminalPane.vue`**

```vue
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
```

i18n 新 key(zh/en 同步;`appsConsole*` 其余 key 在 T7 一起对账):

```ts
  // zh_cn
  appsConsoleFullscreen: '全屏', appsConsoleDisconnected: '连接已断开', appsConsoleReconnect: '重新连接', appsConsoleConnecting: '连接中…',
  // en_us
  appsConsoleFullscreen: 'Fullscreen', appsConsoleDisconnected: 'Connection closed', appsConsoleReconnect: 'Reconnect', appsConsoleConnecting: 'Connecting…',
```

- [ ] **Step 6: 跑全量确认通过** → `pnpm test -- --run && pnpm exec vue-tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml src/styles/theme.css src/apps/console/TerminalPane.vue src/apps/console/TerminalPane.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(apps-console): TerminalPane(xterm 三件新依赖,断线手动重连,全屏)"
```

---

