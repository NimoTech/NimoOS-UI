# 已停止应用:灰显 + 点击启动流程 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 已停止的容器应用在 Dock/添加面板灰显;点击弹"是否启动"确认框,确认后同弹窗转旋转圈"正在启动…",running 后弹窗消失、当前页跳转到应用页面。

**Architecture:** 判定收敛到 apps store 的 `isStopped()`;弹窗状态是模块级单例 composable(`useStartApp`),`StartAppDialog.vue`(复用 `ui/Dialog.vue`)只是它的视图,挂在 Home.vue。启动走共享包 `NimoOS-Service` 的 `service.apps.start()`(已完成),之后每秒轮询 appgrid 直到 running。

**Tech Stack:** Vue 3 `<script setup>` + Pinia + reka-ui Dialog + vitest(fake timers)。

**Spec:** `docs/superpowers/specs/2026-07-17-stopped-app-start-flow-design.md`

## Global Constraints

- 所有可见颜色必须用 theme token(`var(--…)`),禁止色值字面量;`opacity`/`filter: grayscale()` 不是颜色,可用。
- 新增 i18n 键必须同时进 `src/i18n/zh_cn.ts` 和 `en_us.ts`(parity 测试强制)。
- 包管理器 pnpm;部署只能 `./scripts/deploy.sh`。
- 共享包改动后须 `cd ../NimoOS-Service && pnpm build`(已做)。

## 已落地部分(无需重做,Task 6 统一提交)

- `NimoOS-Service`:`apps.start()` + 3 条测试,已 build(82 项全过)。**未 commit**(独立 git 仓库)。
- New-UI:store `isStopped()`、`useOpenAction` 改 prompt 路径、Dock/AddPanel 的 `.is-stopped` 类绑定、Home.vue 挂 `StartAppDialog`。
- **需重写**:`useStartApp.ts`(现为废弃的"预开空白标签页"版)、`StartAppDialog.vue`(现为 AlertDialog 单态版)。

---

### Task 1: i18n 文案键

**Files:**
- Modify: `src/i18n/zh_cn.ts:281`(`openAppNotRunning` 所在行)
- Modify: `src/i18n/en_us.ts:282`

**Interfaces:**
- Produces: i18n 键 `startAppTitle/startAppMessage/startAppConfirm/startAppCancel/startAppStarting/startAppStarted/startAppFailed`(后续 Task 直接 `t()` 引用)

- [ ] **Step 1: 替换 zh_cn.ts 中的 openAppNotRunning**

```ts
    // ── 主页:打开动作 ──
    startAppTitle: '启动应用',
    startAppMessage: '「{name}」已停止,是否启动?',
    startAppConfirm: '启动',
    startAppCancel: '取消',
    startAppStarting: '正在启动 {name}…',
    startAppStarted: '{name} 已启动',
    startAppFailed: '{name} 启动失败',
```

(删除 `openAppNotRunning: '{name}:未运行,请到应用页启动',`)

- [ ] **Step 2: 替换 en_us.ts 中的 openAppNotRunning**

```ts
    // ── Home: open action ──
    startAppTitle: 'Start app',
    startAppMessage: '"{name}" is stopped. Start it now?',
    startAppConfirm: 'Start',
    startAppCancel: 'Cancel',
    startAppStarting: 'Starting {name}…',
    startAppStarted: '{name} started',
    startAppFailed: 'Failed to start {name}',
```

- [ ] **Step 3: 跑 parity 测试确认两文件键一致**

Run: `pnpm vitest run src/i18n/parity.test.ts`
Expected: PASS

---

### Task 2: apps store `isStopped()` 测试补齐

**Files:**
- Modify: `src/home/stores/apps.test.ts`(实现已在 `apps.ts`,只补测试)

**Interfaces:**
- Produces: `useAppsStore().isStopped(key: string): boolean` — status 存在且 ≠ 'running' 且非系统/LinkApp 为 true

- [ ] **Step 1: 写测试(加到 apps.test.ts 末尾)**

```ts
describe('isStopped', () => {
  it('exited/dead/unknown 容器应用算已停止', () => {
    const s = useAppsStore()
    s.setApps([
      { name: 'a', status: 'exited' },
      { name: 'b', status: 'dead' },
      { name: 'c', status: 'unknown' },
    ] as any)
    expect(s.isStopped('a')).toBe(true)
    expect(s.isStopped('b')).toBe(true)
    expect(s.isStopped('c')).toBe(true)
  })
  it('running / 缺省 status / 系统应用 / LinkApp / 不存在的 key 都不算', () => {
    const s = useAppsStore()
    s.setApps([
      { name: 'run', status: 'running' },
      { name: 'nostatus' },
      { name: 'link', status: 'exited', app_type: 'LinkApp' },
    ] as any)
    expect(s.isStopped('run')).toBe(false)
    expect(s.isStopped('nostatus')).toBe(false)
    expect(s.isStopped('link')).toBe(false)
    expect(s.isStopped('files')).toBe(false) // 系统应用
    expect(s.isStopped('ghost')).toBe(false) // 不存在
  })
})
```

- [ ] **Step 2: 跑测试**

Run: `pnpm vitest run src/home/stores/apps.test.ts`
Expected: PASS(实现已存在)

---

### Task 3: 重写 `useStartApp.ts`(两态 + 同页跳转)

**Files:**
- Rewrite: `src/home/composables/useStartApp.ts`
- Create: `src/home/composables/useStartApp.test.ts`

**Interfaces:**
- Consumes: `service.apps.start({name, app_type})`(NimoOS-Service,已完成);`useAppsStore().loadGrid()/app()`
- Produces:
  - `appUrl(a: AppMeta): string | null`
  - `useStartApp()` → `{ state: Ref<{key: string; phase: 'confirm'|'starting'} | null>, prompt(key), dismiss(), confirm(opts?): Promise<boolean> }`
  - `__resetStartAppForTest()`
  - `ConfirmOpts = { pollMs?, timeoutMs?, navigate?: (url: string) => void }`

- [ ] **Step 1: 写完整实现**

```ts
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { useAppsStore, type AppMeta } from '../stores/apps'
import { useToast } from '../../stores/toast'
import { i18n } from '../../i18n'

/** 容器应用的网页地址;没有可打开的页面时返回 null */
export function appUrl(a: AppMeta): string | null {
  if (!a.port && !a.index) return null
  const scheme = a.scheme || 'http'
  const host = a.hostname || window.location.hostname
  const port = a.port ? ':' + a.port : ''
  return `${scheme}://${host}${port}${a.index || '/'}`
}

export interface StartState { key: string; phase: 'confirm' | 'starting' }
export interface ConfirmOpts {
  pollMs?: number
  timeoutMs?: number
  /** 注入以便测试;默认当前页跳转 */
  navigate?: (url: string) => void
}

// 模块级单例:弹窗状态由所有调用方共享(同 useDock/useAddPanel 模式),
// 视图是 Home.vue 里的 StartAppDialog。
const state = ref<StartState | null>(null)
// 启动态中用户收起弹窗 → 启动继续但完成后不再自动跳转(spec §2.5)
let navigateOnSuccess = true

/** Reset singleton state — call in test beforeEach */
export function __resetStartAppForTest() {
  state.value = null
  navigateOnSuccess = true
}

export function useStartApp() {
  const apps = useAppsStore()
  const toast = useToast()
  const t = i18n.global.t

  function prompt(key: string) {
    if (state.value) return // 已有确认框/启动流程,不叠加
    state.value = { key, phase: 'confirm' }
  }

  /** 关闭弹窗(取消按钮 / Esc / 点遮罩)。启动态下只是"收起",流程继续。 */
  function dismiss() {
    if (!state.value) return
    if (state.value.phase === 'starting') navigateOnSuccess = false
    state.value = null
  }

  async function confirm(opts: ConfirmOpts = {}): Promise<boolean> {
    if (state.value?.phase !== 'confirm') return false
    const key = state.value.key
    const meta = apps.app(key)
    if (!meta) { state.value = null; return false }
    state.value = { key, phase: 'starting' }
    navigateOnSuccess = true
    const navigate = opts.navigate ?? ((url: string) => { window.location.href = url })
    try {
      await service.apps.start({ name: key, app_type: meta.app_type })
      const pollMs = opts.pollMs ?? 1000
      const deadline = Date.now() + (opts.timeoutMs ?? 30_000)
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, pollMs))
        await apps.loadGrid().catch(() => {})
        const cur = apps.app(key)
        if (cur?.status === 'running') {
          const url = appUrl(cur)
          const shouldNavigate = navigateOnSuccess && url
          state.value = null
          if (shouldNavigate) navigate(url)
          else toast.show(t('startAppStarted', { name: cur.name }))
          return true
        }
      }
      throw new Error('timeout')
    } catch (e) {
      console.warn('[home] start app', key, e)
      state.value = null
      toast.show(t('startAppFailed', { name: meta.name }), 4000)
      return false
    }
  }

  return { state, prompt, dismiss, confirm }
}
```

- [ ] **Step 2: 写测试**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAppsStore } from '../stores/apps'
import { useStartApp, appUrl, __resetStartAppForTest } from './useStartApp'

vi.mock('@nimotech/nimoos-service', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>()
  return { ...mod, service: { apps: { start: vi.fn(async () => {}), getGrid: vi.fn(async () => []) } } }
})
import { service } from '@nimotech/nimoos-service'

beforeEach(() => {
  setActivePinia(createPinia())
  __resetStartAppForTest()
  vi.clearAllMocks()
})

const stopped = { name: 'jf', status: 'exited', app_type: 'v2app', port: 8096, index: '/web' }

describe('useStartApp', () => {
  it('appUrl:有 port/index 拼地址,都没有返回 null', () => {
    expect(appUrl({ port: 8096, index: '/web', hostname: 'h' } as any)).toBe('http://h:8096/web')
    expect(appUrl({ name: 'x' } as any)).toBe(null)
  })

  it('prompt 进入 confirm 态;dismiss 清空', () => {
    const sa = useStartApp()
    sa.prompt('jf')
    expect(sa.state.value).toEqual({ key: 'jf', phase: 'confirm' })
    sa.dismiss()
    expect(sa.state.value).toBe(null)
  })

  it('confirm:调 start → 轮询到 running → 关弹窗并跳转', async () => {
    const apps = useAppsStore()
    apps.setApps([stopped] as any)
    ;(service.apps.getGrid as any).mockResolvedValue([{ ...stopped, status: 'running' }])
    const nav = vi.fn()
    const sa = useStartApp()
    sa.prompt('jf')
    const ok = await sa.confirm({ pollMs: 1, timeoutMs: 100, navigate: nav })
    expect(ok).toBe(true)
    expect(service.apps.start).toHaveBeenCalledWith({ name: 'jf', app_type: 'v2app' })
    expect(sa.state.value).toBe(null)
    expect(nav).toHaveBeenCalledWith('http://localhost:8096/web')
  })

  it('启动态中 dismiss:完成后不跳转', async () => {
    const apps = useAppsStore()
    apps.setApps([stopped] as any)
    ;(service.apps.getGrid as any).mockResolvedValue([{ ...stopped, status: 'running' }])
    const nav = vi.fn()
    const sa = useStartApp()
    sa.prompt('jf')
    const p = sa.confirm({ pollMs: 5, timeoutMs: 100, navigate: nav })
    sa.dismiss() // 用户收起"正在启动…"弹窗
    expect(await p).toBe(true)
    expect(nav).not.toHaveBeenCalled()
  })

  it('超时:关弹窗、返回 false、不跳转', async () => {
    const apps = useAppsStore()
    apps.setApps([stopped] as any)
    ;(service.apps.getGrid as any).mockResolvedValue([stopped]) // 一直 exited
    const nav = vi.fn()
    const sa = useStartApp()
    sa.prompt('jf')
    expect(await sa.confirm({ pollMs: 1, timeoutMs: 20, navigate: nav })).toBe(false)
    expect(sa.state.value).toBe(null)
    expect(nav).not.toHaveBeenCalled()
  })
})
```

注意:`apps.loadGrid()` 内部调用 `service.apps.getGrid`,mock 里两个方法都要提供。jsdom 的 `window.location.hostname` 是 `localhost`。

- [ ] **Step 3: 跑测试**

Run: `pnpm vitest run src/home/composables/useStartApp.test.ts`
Expected: PASS(5 条)

---

### Task 4: `useOpenAction` 测试重写(stopped → prompt)

**Files:**
- Modify: `src/home/composables/useOpenAction.test.ts`(实现已改完:stopped 分支调 `startApp.prompt(key)`,`notify` 参数已删)

**Interfaces:**
- Consumes: `useStartApp().state`、`__resetStartAppForTest()`

- [ ] **Step 1: 重写两条 stopped 测试,删 notify 相关**

把原 `stopped container app notifies instead of opening` 和 `default notify surfaces a toast for a stopped app` 两条替换为:

```ts
  it('stopped container app opens the start prompt instead of a URL', () => {
    const s = useAppsStore()
    s.setApps([{ name: 'jf', status: 'exited' }] as any)
    const { openApp } = useOpenAction()
    openApp('jf')
    expect(opens.length).toBe(0)
    expect(useStartApp().state.value).toEqual({ key: 'jf', phase: 'confirm' })
  })
  it('running app without port/index does nothing (no prompt, no open)', () => {
    const s = useAppsStore()
    s.setApps([{ name: 'jf', status: 'running' }] as any)
    const { openApp } = useOpenAction()
    openApp('jf')
    expect(opens.length).toBe(0)
    expect(useStartApp().state.value).toBe(null)
  })
```

顶部 import 增加 `import { useStartApp, __resetStartAppForTest } from './useStartApp'`,删 `useToast` import;`beforeEach` 里加 `__resetStartAppForTest()`。

**注意**:running-无地址 应用现在也不该弹 prompt——检查 `useOpenAction.ts` 的 else 分支,必须先判 `a.status && a.status !== 'running'` 才 prompt(spec §2.1 修正),否则第二条测试红。实现如不符,改为:

```ts
    const url = appUrl(a)
    if (a.status === 'running' && url) {
      window.open(url, '_blank', 'noopener')
    } else if (!a.status || a.status !== 'running') {
      // 未运行(exited/dead/unknown…):不开网页,弹"是否启动"确认框
      if (a.status) startApp.prompt(key)
    }
```

简化后等价逻辑(推荐):

```ts
    const url = appUrl(a)
    if (a.status === 'running') {
      if (url) window.open(url, '_blank', 'noopener')
    } else if (a.status) {
      startApp.prompt(key) // 未运行:弹"是否启动"(StartAppDialog)
    }
```

(`a.status` 缺省的非容器来源维持无动作,与灰显判定一致。)

- [ ] **Step 2: 跑测试**

Run: `pnpm vitest run src/home/composables/useOpenAction.test.ts`
Expected: PASS

---

### Task 5: `StartAppDialog.vue` 两态弹窗 + Dock 灰显样式

**Files:**
- Rewrite: `src/home/components/StartAppDialog.vue`
- Modify: `src/styles/theme.css:452` 附近(`.dock-app:hover` 规则旁)
- Modify: `src/home/components/AppTile.vue:2`(内联判定换 `isStopped`)

**Interfaces:**
- Consumes: `useStartApp().state/dismiss/confirm`、`ui/Dialog.vue`(默认插槽 + footer 插槽)、Task 1 的 i18n 键

- [ ] **Step 1: 重写 StartAppDialog.vue**

```vue
<template>
  <Dialog :open="!!sa.state.value" :title="t('startAppTitle')" @update:open="(v: boolean) => { if (!v) sa.dismiss() }">
    <template v-if="sa.state.value?.phase === 'confirm'">
      <p class="sa-msg">{{ t('startAppMessage', { name: appName }) }}</p>
    </template>
    <template v-else>
      <div class="sa-starting">
        <span class="sa-spinner" />
        <span class="sa-msg">{{ t('startAppStarting', { name: appName }) }}</span>
      </div>
    </template>
    <template v-if="sa.state.value?.phase === 'confirm'" #footer>
      <button class="sa-btn" @click="sa.dismiss()">{{ t('startAppCancel') }}</button>
      <button class="sa-btn sa-primary" @click="sa.confirm()">{{ t('startAppConfirm') }}</button>
    </template>
  </Dialog>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from '../../components/ui/Dialog.vue'
import { useStartApp } from '../composables/useStartApp'
import { useAppsStore } from '../stores/apps'

const { t } = useI18n()
const sa = useStartApp()
const apps = useAppsStore()
const appName = computed(() => {
  const k = sa.state.value?.key
  return (k && apps.app(k)?.name) || k || ''
})
</script>
<style scoped>
.sa-msg { font-size: 14px; color: var(--fg-muted); margin: 0; }
.sa-starting { display: flex; align-items: center; gap: 12px; padding: 6px 0; }
/* 与 SearchDialog .spinner 同款:--ring-track 底圈 + --accent 顶弧 */
.sa-spinner { flex: 0 0 auto; width: 24px; height: 24px; border-radius: 50%; border: 3px solid var(--ring-track); border-top-color: var(--accent); animation: sa-spin 0.8s linear infinite; }
@keyframes sa-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .sa-spinner { animation-duration: 1.6s; } }
.sa-btn { padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px; }
.sa-primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); font-weight: 600; }
</style>
```

- [ ] **Step 2: theme.css 加 Dock 灰显(`.dock-app:hover .dock-ic` 规则后)**

```css
/* 已停止的应用:整体灰显(与桌面 AppTile.stopped、AddPanel .is-stopped 同款) */
.dock-app.is-stopped { opacity: 0.45; filter: grayscale(0.6); }
```

- [ ] **Step 3: AppTile.vue 复用 isStopped**

第 2 行改为:

```vue
  <div class="app-tile" :class="{ stopped: store.isStopped(item.key) }">
```

- [ ] **Step 4: 跑 home 相关组件测试**

Run: `pnpm vitest run src/home`
Expected: PASS(若 AppTile.test.ts 对 stopped 类有断言,行为等价应仍绿;红了先读断言再修)

---

### Task 6: 全量验证 + 提交(两个仓库)

- [ ] **Step 1: 全量测试 + 类型检查**

Run: `pnpm test && pnpm exec vue-tsc --noEmit`
Expected: 全绿、无类型错误

- [ ] **Step 2: 提交 NimoOS-Service**

```bash
cd ../NimoOS-Service && git add src/apps.ts src/apps.test.ts && git commit -m "feat(apps): start() 启动已停止应用(v2 compose / v1 container 双端点)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 3: 提交 New-UI**

```bash
cd ../NimoOS-New-UI && git add -A src docs && git commit -m "feat(home): 已停止应用灰显 + 点击弹启动确认框,启动后自动打开页面

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 4: 部署**

Run: `./scripts/deploy.sh`
Expected: `Deployed to /var/lib/nimoos/www/app/`;浏览器 `/app/` 验收:停止一个应用 → Dock/添加面板图标 ~2s 内变灰 → 点击弹确认框 → 启动 → 旋转圈 → 跳转应用页。
