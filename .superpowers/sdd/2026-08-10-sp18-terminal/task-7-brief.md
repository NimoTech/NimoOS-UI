### Task 7: `TerminalView` assembly + route

**Files:**
- Create: `src/terminal/TerminalView.vue`
- Modify: `src/router/index.ts` (import + one route after the `/kvm` line)
- Test: `src/terminal/TerminalView.test.ts`

**Interfaces:**
- Consumes: `useTerminalSession` (Task 4), `useTerminalWindows` (Task 5), `TerminalTabs`/`TerminalLockCard` (Task 6), `AreaShell` (`src/components/shell/AreaShell.vue`, prop `title: string`), i18n keys (Task 3).
- Produces: route `{ path: '/terminal', name: 'terminal', component: TerminalView }` — Task 8's tile navigates here.

- [ ] **Step 1: Write the failing tests**

Create `src/terminal/TerminalView.test.ts` (drives the real composables through a mocked service — the view is the only DOM layer, so its tests pin state→render wiring and lifecycle side effects):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const createSession = vi.fn()
const keepalive = vi.fn()
const deleteSession = vi.fn()
const listWindows = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    terminal: {
      createSession: (pw?: string) => createSession(pw),
      keepalive: () => keepalive(),
      deleteSession: () => deleteSession(),
      listWindows: () => listWindows(),
      newWindow: vi.fn(),
      selectWindow: vi.fn(),
      closeWindow: vi.fn(),
      renameWindow: vi.fn(),
    },
  },
}))
// The view only calls router.push('/') from the back button; a spy router keeps
// the test free of the full route table.
const push = vi.fn()
vi.mock('vue-router', async (orig) => ({ ...(await orig<object>()), useRouter: () => ({ push }) }))

import TerminalView from './TerminalView.vue'

function httpErr(status?: number, data?: unknown) {
  const e = new Error('http') as Error & { response?: { status: number; data: unknown } }
  if (status !== undefined) e.response = { status, data }
  return e
}

beforeEach(() => {
  createSession.mockReset()
  keepalive.mockReset().mockResolvedValue(undefined)
  deleteSession.mockReset().mockResolvedValue(undefined)
  listWindows.mockReset().mockResolvedValue([{ index: 0, name: 'zsh', active: true }])
  push.mockReset()
})

describe('TerminalView', () => {
  it('renders the forbidden hint on 403', async () => {
    createSession.mockRejectedValue(httpErr(403))
    const w = mount(TerminalView)
    await flushPromises()
    expect(w.find('[data-test="term-forbidden"]').exists()).toBe(true)
    expect(w.find('iframe').isVisible()).toBe(false)
  })

  it('renders the error hint with a retry button that re-provisions', async () => {
    createSession.mockRejectedValueOnce(httpErr())
    const w = mount(TerminalView)
    await flushPromises()
    expect(w.find('[data-test="term-error"]').exists()).toBe(true)
    createSession.mockResolvedValue({ mode: 'off', idle_minutes: 15 })
    await w.find('[data-test="term-retry"]').trigger('click')
    await flushPromises()
    expect(w.find('iframe').isVisible()).toBe(true)
  })

  it('when ready, shows the iframe pointed at the ticket-gated proxy and the window tabs', async () => {
    createSession.mockResolvedValue({ mode: 'off', idle_minutes: 15 })
    const w = mount(TerminalView)
    await flushPromises()
    const frame = w.find('iframe')
    expect(frame.attributes('src')).toBe('/v1/terminal/')
    expect(w.findAll('[data-test="win-tab"]')).toHaveLength(1)
  })

  it('shows the lock card when the policy demands a password', async () => {
    createSession.mockRejectedValue(httpErr(401, { password_required: true, mode: 'on_open', idle_minutes: 15 }))
    const w = mount(TerminalView)
    await flushPromises()
    expect(w.find('[data-test="pw-input"]').exists()).toBe(true)
  })

  it('returns the on_open ticket when unmounted', async () => {
    createSession.mockResolvedValue({ mode: 'on_open', idle_minutes: 15 })
    const w = mount(TerminalView)
    await flushPromises()
    w.unmount()
    expect(deleteSession).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/terminal/TerminalView.test.ts`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement `TerminalView.vue`**

```vue
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

const { state, mode, frameSrc, pwError, frozenSeconds, warning, provision, submitPassword, notifyActivity, lock, maybeDeleteSession, dispose } = useTerminalSession()
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
        <TerminalLockCard v-else-if="state === 'locked'" :pw-error="pwError" :frozen-seconds="frozenSeconds" @submit="submitPassword" />
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
```

- [ ] **Step 4: Register the route**

In `src/router/index.ts`, add the import next to `KvmPage`:

```ts
import TerminalView from '../terminal/TerminalView.vue'
```

and the route directly after the `/kvm` line (before the `/files/:path(.*)*` catch-all, same reasoning as the comment above `/kvm`):

```ts
  // SP18: admin-only web terminal (ttyd iframe). Same catch-all caveat as /kvm above.
  { path: '/terminal', name: 'terminal', component: TerminalView },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/terminal/TerminalView.test.ts src/router/index.test.ts`
Expected: PASS. `router/index.test.ts` asserts route-source line order for photos routes — the new line after `/kvm` must not disturb it; if it fails, read that test's header comment before touching anything.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/TerminalView.vue src/terminal/TerminalView.test.ts src/router/index.ts
git commit -m "feat(terminal): /terminal page assembling session, tabs and ttyd iframe"
```

---

