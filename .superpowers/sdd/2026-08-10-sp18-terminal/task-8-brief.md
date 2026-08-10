### Task 8: desktop tile (admin-only + service probe)

**Files:**
- Create: `src/home/apps/icons/terminal.svg` (copied from Vue2)
- Modify: `src/home/apps/systemApps.ts`
- Modify: `src/home/stores/apps.ts`
- Modify: `src/home/composables/useOpenAction.ts`
- Test: `src/home/stores/apps.test.ts` (extend)

**Interfaces:**
- Consumes: `service.terminal.getSettings()` (Task 2), `useSessionStore().isAdmin` (`src/stores/session.ts`), route `/terminal` (Task 7), i18n key `appTerminal` (Task 3).
- Produces: system tile `key: 'terminal'` that renders only for admins on machines where the terminal service answers.

- [ ] **Step 1: Copy the Vue2 icon**

```bash
git --git-dir=/home/nimo/NimoTech/NimoOS-UI/.git show FETCH_HEAD:src/assets/img/app/terminal.svg > src/home/apps/icons/terminal.svg
```

Verify it is non-empty SVG: `head -c 200 src/home/apps/icons/terminal.svg`.

- [ ] **Step 2: Write the failing tests**

Extend `src/home/stores/apps.test.ts`. The existing `vi.mock('@nimotech/nimoos-service', …)` block at the top must gain a terminal stub — change it to:

```ts
const getGrid = vi.fn()
const getKvmSettings = vi.fn()
const getTerminalSettings = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    apps: { getGrid: () => getGrid() },
    kvm: { getSettings: () => getKvmSettings() },
    terminal: { getSettings: () => getTerminalSettings() },
  },
}))
```

Then append a describe block (helpers: an axios-shaped error and an admin localStorage seed):

```ts
function httpErr(status?: number) {
  const e = new Error('http') as Error & { response?: { status: number } }
  if (status !== undefined) e.response = { status }
  return e
}

describe('terminal tile gating (SP18)', () => {
  beforeEach(() => {
    localStorage.setItem('user', JSON.stringify({ username: 'nimo', role: 'admin' }))
    getGrid.mockResolvedValue([])
    getKvmSettings.mockResolvedValue({})
  })
  afterEach(() => localStorage.removeItem('user'))

  it('renders the tile before the probe answers (null must read as available)', () => {
    const s = useAppsStore()
    expect(s.order).toContain('terminal')
  })

  it('keeps the tile when the probe answers 403 — a 403 proves the service is alive', async () => {
    getTerminalSettings.mockRejectedValue(httpErr(403))
    const s = useAppsStore()
    await s.loadGrid()
    expect(s.order).toContain('terminal')
  })

  it('drops the tile when the route is not registered (404) or the network fails', async () => {
    getTerminalSettings.mockRejectedValue(httpErr(404))
    const s = useAppsStore()
    await s.loadGrid()
    expect(s.order).not.toContain('terminal')

    getTerminalSettings.mockRejectedValue(httpErr())
    await s.loadGrid()
    expect(s.order).not.toContain('terminal')
  })

  it('hides the tile from non-admins regardless of the probe', async () => {
    localStorage.setItem('user', JSON.stringify({ username: 'guest', role: 'user' }))
    getTerminalSettings.mockResolvedValue({ mode: 'off', idle_minutes: 15 })
    const s = useAppsStore()
    await s.loadGrid()
    expect(s.order).not.toContain('terminal')
  })
})
```

Note the store is created per test AFTER seeding localStorage — `useSessionStore().isAdmin` re-reads localStorage lazily, but keep the seed-before-create order anyway so the initial `setApps([])` also sees it.

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run src/home/stores/apps.test.ts`
Expected: the four new tests FAIL (`'terminal'` never in `order`); every pre-existing test still PASSES.

- [ ] **Step 4: Implement**

`src/home/apps/systemApps.ts` — extend the interface and the list:

```ts
import iconTerminal from './icons/terminal.svg'
// interface gains two members:
export interface SystemApp {
  key: string; name: string; label: string; cls: string; glyph: string; icon: string
  requiresService?: 'kvm' | 'terminal'
  /** Frontend-filtered, 1:1 with Vue2 builtInApps' adminOnly Terminal entry. */
  adminOnly?: true
}
// glyph for the no-image fallback, same single-path style as the G table:
//   terminal: '<path d="M4.5 5.5h15a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17V7a1.5 1.5 0 0 1 1.5-1.5Z"/><path d="m7 9.5 3 2.5-3 2.5M12.5 14.5H17"/>'
// list gains a final entry (appended last so existing persisted grids keep their order):
  { key: 'terminal', name: 'Terminal', label: 'appTerminal', cls: 'ic-terminal', glyph: G.terminal, icon: iconTerminal, requiresService: 'terminal', adminOnly: true },
```

(`.ic-terminal` gradient already exists in `theme.css:732` — do not add another.)

`src/home/stores/apps.ts` — mirror the kvm probe wholesale:

```ts
// next to kvmAvailable (same null-means-unprobed contract and comment style):
const terminalAvailable = ref<boolean | null>(null)

// setApps' system filter grows the two new conditions:
    SYSTEM_APPS
      .filter((s) =>
        (s.requiresService !== 'kvm' || kvmAvailable.value !== false)
        && (s.requiresService !== 'terminal' || terminalAvailable.value !== false)
        && (!s.adminOnly || session.isAdmin))

// with, at store-setup top (next to the other store composition):
  const session = useSessionStore()
// and the import:
import { useSessionStore } from '../../stores/session'

/** Probe the optional terminal service. Unlike probeKvm, an auth-shaped refusal
 *  (401/403) still proves the service is registered and answering — ttyd may
 *  simply be talking to a non-admin. Only "route not there" (404), server
 *  errors and network failures count as not installed (spec §3.3). */
  async function probeTerminal(): Promise<boolean> {
    try {
      await service.terminal.getSettings()
      return true
    } catch (e) {
      const st = (e as { response?: { status?: number } })?.response?.status
      return st === 401 || st === 403
    }
  }

// loadGrid gains the parallel probe:
  async function loadGrid() {
    const [list, links, kvmOk, termOk] = await Promise.all([
      service.apps.getGrid(),
      listLinkApps().catch(() => []),
      probeKvm(),
      probeTerminal(),
    ])
    kvmAvailable.value = kvmOk
    terminalAvailable.value = termOk
    setApps(list || [], links)
  }
```

Export `terminalAvailable` from the store return object alongside `kvmAvailable` (check how `kvmAvailable` is exposed and mirror it exactly).

`src/home/composables/useOpenAction.ts` — inside the `a.system` branch, next to the knowledge line:

```ts
      // Terminal: SP18 in-app route. Like knowledge above, Vue2 no longer exists
      // on-device (retired 08-07), so there is no fallback target and no
      // strangler:disabled flag — the tile always routes into this app.
      if (key === 'terminal') { router.push('/terminal'); return }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/home/stores/apps.test.ts src/home/`
Expected: ALL PASS — including every pre-existing home test (layout/grid tests must not be disturbed by the appended tile; if a layout test pins the tile count, read its intent and update the expectation only if it plainly enumerates system apps).

- [ ] **Step 6: Commit**

```bash
git add src/home/apps/icons/terminal.svg src/home/apps/systemApps.ts src/home/stores/apps.ts src/home/composables/useOpenAction.ts src/home/stores/apps.test.ts
git commit -m "feat(home): admin-only terminal tile gated by a service probe"
```

---

