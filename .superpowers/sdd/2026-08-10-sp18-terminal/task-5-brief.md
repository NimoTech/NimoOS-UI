### Task 5: `useTerminalWindows` composable

**Files:**
- Create: `src/terminal/useTerminalWindows.ts`
- Test: `src/terminal/useTerminalWindows.test.ts`

**Interfaces:**
- Consumes: `service.terminal.listWindows/newWindow/selectWindow/closeWindow/renameWindow` (Task 2), `statusOf` (Task 4).
- Produces (consumed by Task 7):

```ts
export function useTerminalWindows(onAuthLost: () => void): {
  windows: Ref<TerminalWindow[]>
  start(): void; stop(): void
  select(i: number): Promise<void>; create(): Promise<void>
  close(i: number): Promise<void>; rename(i: number, name: string): Promise<void>
}
```

- [ ] **Step 1: Write the failing tests**

Create `src/terminal/useTerminalWindows.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const listWindows = vi.fn()
const newWindow = vi.fn()
const selectWindow = vi.fn()
const closeWindow = vi.fn()
const renameWindow = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    terminal: {
      listWindows: () => listWindows(),
      newWindow: () => newWindow(),
      selectWindow: (i: number) => selectWindow(i),
      closeWindow: (i: number) => closeWindow(i),
      renameWindow: (i: number, name: string) => renameWindow(i, name),
    },
  },
}))

import { useTerminalWindows } from './useTerminalWindows'

function httpErr(status?: number) {
  const e = new Error('http') as Error & { response?: { status: number; data: unknown } }
  if (status !== undefined) e.response = { status, data: {} }
  return e
}

const WINS = [
  { index: 0, name: 'zsh', active: true },
  { index: 1, name: 'build', active: false },
]

beforeEach(() => {
  vi.useFakeTimers()
  for (const f of [listWindows, newWindow, selectWindow, closeWindow, renameWindow]) f.mockReset().mockResolvedValue(undefined)
  listWindows.mockResolvedValue(WINS)
})
afterEach(() => { vi.useRealTimers() })

describe('useTerminalWindows', () => {
  it('start refreshes immediately then polls every 3s', async () => {
    const w = useTerminalWindows(() => {})
    w.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(w.windows.value).toEqual(WINS)
    await vi.advanceTimersByTimeAsync(3000)
    expect(listWindows).toHaveBeenCalledTimes(2)
    w.stop()
    await vi.advanceTimersByTimeAsync(9000)
    expect(listWindows).toHaveBeenCalledTimes(2)
  })

  it('mutations refresh the list; a 401 anywhere reports auth loss', async () => {
    const onAuthLost = vi.fn()
    const w = useTerminalWindows(onAuthLost)
    await w.select(1)
    expect(selectWindow).toHaveBeenCalledWith(1)
    expect(listWindows).toHaveBeenCalledTimes(1) // refresh after the mutation
    selectWindow.mockRejectedValue(httpErr(401))
    await w.select(0)
    expect(onAuthLost).toHaveBeenCalledTimes(1)
  })

  it('closing the last window (409) is silently ignored', async () => {
    const onAuthLost = vi.fn()
    closeWindow.mockRejectedValue(httpErr(409))
    const w = useTerminalWindows(onAuthLost)
    await w.close(0)
    expect(onAuthLost).not.toHaveBeenCalled()
  })

  it('rename trims and skips the call entirely for an all-whitespace name', async () => {
    const w = useTerminalWindows(() => {})
    await w.rename(1, '   ')
    expect(renameWindow).not.toHaveBeenCalled()
    await w.rename(1, '  dev  ')
    expect(renameWindow).toHaveBeenCalledWith(1, 'dev')
  })

  it('a poll response landing after stop() must not repopulate the list', async () => {
    let release!: (v: unknown) => void
    listWindows.mockReturnValueOnce(new Promise((res) => { release = res }))
    const w = useTerminalWindows(() => {})
    w.start() // refresh now in flight
    w.stop()
    release(WINS)
    await vi.advanceTimersByTimeAsync(0)
    expect(w.windows.value).toEqual([]) // stale response discarded (spec §4-1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/terminal/useTerminalWindows.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/terminal/useTerminalWindows.ts`:

```ts
import { ref } from 'vue'
import { service, type TerminalWindow } from '@nimotech/nimoos-service'
import { statusOf } from './terminalHttp'

// tmux window tabs: 3s poll + the four mutations, ported from Vue2 Terminal.vue.
// Any 401 means the ticket died (expiry / service restart / policy change) —
// surfaced through onAuthLost so the owner locks the page. All other errors are
// best-effort silent (1:1 Vue2; closing the last window answers 409 by design).
// Registered deviation (spec §4-1): responses landing after stop() are discarded
// via an epoch counter.
export function useTerminalWindows(onAuthLost: () => void) {
  const windows = ref<TerminalWindow[]>([])
  let timer: ReturnType<typeof setInterval> | undefined
  let epoch = 0

  async function refresh() {
    const myEpoch = epoch
    try {
      const list = await service.terminal.listWindows()
      if (myEpoch !== epoch) return
      windows.value = Array.isArray(list) ? list : []
    } catch (e) {
      if (myEpoch !== epoch) return
      if (statusOf(e) === 401) onAuthLost()
    }
  }

  function start() {
    stop()
    void refresh()
    timer = setInterval(() => { void refresh() }, 3000)
  }

  function stop() {
    epoch++
    if (timer) { clearInterval(timer); timer = undefined }
    windows.value = []
  }

  async function run(op: () => Promise<unknown>) {
    const myEpoch = epoch
    try {
      await op()
      if (myEpoch === epoch) await refresh()
    } catch (e) {
      if (myEpoch !== epoch) return
      if (statusOf(e) === 401) onAuthLost()
      // anything else (incl. 409 on the last window) is silently ignored, 1:1 Vue2
    }
  }

  const select = (i: number) => run(() => service.terminal.selectWindow(i))
  const create = () => run(() => service.terminal.newWindow())
  const close = (i: number) => run(() => service.terminal.closeWindow(i))
  async function rename(i: number, name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    await run(() => service.terminal.renameWindow(i, trimmed))
  }

  return { windows, start, stop, select, create, close, rename }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/terminal/useTerminalWindows.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/useTerminalWindows.ts src/terminal/useTerminalWindows.test.ts
git commit -m "feat(terminal): window tabs composable with 3s poll and auth-loss callback"
```

---

