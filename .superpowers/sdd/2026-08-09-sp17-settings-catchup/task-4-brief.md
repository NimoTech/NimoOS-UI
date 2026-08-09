### Task 4: KVM 磁贴按服务可用性门控(Vue2 #125)

**Files:**
- Modify: `src/home/apps/systemApps.ts:13`(接口)与 `:31`(vm 条目)
- Modify: `src/home/stores/apps.ts:26-73`
- Test: `src/home/apps/systemApps.test.ts`、`src/home/stores/apps.test.ts`

**Interfaces:**
- Consumes: `service.kvm.getSettings()`(包里已有,`packages/service/src/kvm.ts:265`)。
- Produces: `SystemApp.requiresService?: 'kvm'`;apps store 多一个 `loadGrid()` 内部探活,对外签名不变(`Home.vue` 不用改)。

- [ ] **Step 1: 写失败测试**

`src/home/apps/systemApps.test.ts` 追加:

```ts
describe('SYSTEM_APPS -- optional services (SP17 #125)', () => {
  it('kvm is the only tile gated on a service being reachable', () => {
    const gated = SYSTEM_APPS.filter((a) => a.requiresService)
    expect(gated.map((a) => a.key)).toEqual(['vm'])
    expect(gated[0].requiresService).toBe('kvm')
  })
})
```

`src/home/stores/apps.test.ts` 追加一个新 describe(本文件现在没有 service mock,**mock 要加在文件顶部**,与既有用例共存 —— 既有用例只调 `setApps`,不打接口,不受影响):

```ts
// at the top of the file, next to the other imports
const getGrid = vi.fn()
const getKvmSettings = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    apps: { getGrid: () => getGrid() },
    kvm: { getSettings: () => getKvmSettings() },
  },
}))
vi.mock('../../apps/util/linkApps', () => ({ listLinkApps: () => Promise.resolve([]) }))
```

```ts
describe('KVM tile gating (SP17 #125)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getGrid.mockReset(); getKvmSettings.mockReset()
    getGrid.mockResolvedValue([])
  })

  it('keeps the tile before the probe has answered -- the first frame must not flicker', () => {
    const s = useAppsStore()
    expect(s.app('vm')).toBeDefined() // store init calls setApps([]) with no probe result yet
  })

  it('keeps the tile when the KVM service answers', async () => {
    getKvmSettings.mockResolvedValue({ cpuCores: 6 })
    const s = useAppsStore()
    await s.loadGrid()
    expect(s.app('vm')).toBeDefined()
    expect(s.order).toContain('vm')
  })

  it('drops the tile when the KVM service is unreachable, without failing the load', async () => {
    getKvmSettings.mockRejectedValue(new Error('ECONNREFUSED'))
    const s = useAppsStore()
    await expect(s.loadGrid()).resolves.toBeUndefined()
    expect(s.app('vm')).toBeUndefined()
    expect(s.order).not.toContain('vm')
    expect(s.app('files')).toBeDefined() // the other system tiles are untouched
  })

  it('brings the tile back once KVM answers again', async () => {
    getKvmSettings.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ cpuCores: 6 })
    const s = useAppsStore()
    await s.loadGrid()
    expect(s.app('vm')).toBeUndefined()
    await s.loadGrid()
    expect(s.app('vm')).toBeDefined()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/home/apps/systemApps.test.ts src/home/stores/apps.test.ts`
Expected: FAIL —— `requiresService` 不存在(类型错 + 断言红);门控用例里 `vm` 恒存在。

- [ ] **Step 3: 给静态表加声明**

`src/home/apps/systemApps.ts`:

```ts
// `requiresService` marks a tile that only belongs on this machine when the named
// service is actually reachable -- KVM is optional and is not installed everywhere.
// The static entry deliberately carries no status: the apps store decides both
// visibility and status once the probe has answered (Vue 2 #125).
export interface SystemApp {
  key: string; name: string; label: string; cls: string; glyph: string; icon: string
  requiresService?: 'kvm'
}
```

`vm` 条目改成:

```ts
  { key: 'vm', name: 'KVM', label: 'appVm', cls: 'ic-vm', glyph: G.vm, icon: iconVm, requiresService: 'kvm' },
```

- [ ] **Step 4: 在 store 里探活并过滤**

`src/home/stores/apps.ts`:

1. 在 `const apps = ref…` 附近加状态:

```ts
  // null = not probed yet. Unknown must render as "available": the store calls
  // setApps([]) at init so the desktop has its system tiles before any request has
  // been made, and hiding the tile there would make it blink out and back in.
  const kvmAvailable = ref<boolean | null>(null)
```

2. `setApps` 里那段 `SYSTEM_APPS.forEach(...)` 改成先过滤:

```ts
    SYSTEM_APPS
      .filter((s) => s.requiresService !== 'kvm' || kvmAvailable.value !== false)
      .forEach((s) => {
        map[s.key] = { name: s.label, cls: s.cls, glyph: s.glyph, icon: s.icon, system: true, status: 'running' }
        ord.push(s.key)
      })
```

3. 加探活函数并接进 `loadGrid()`:

```ts
  /** Any failure -- not registered with the gateway, unreachable, timing out -- means
   *  "not available" here. It is not an error worth surfacing: a machine without KVM
   *  installed is the normal case (Vue 2 AppSection.checkKvmAvailability). */
  async function probeKvm(): Promise<boolean> {
    try {
      await service.kvm.getSettings()
      return true
    } catch {
      return false
    }
  }

  async function loadGrid() {
    const [list, links, kvmOk] = await Promise.all([
      service.apps.getGrid(),
      listLinkApps().catch(() => []),
      probeKvm(),
    ])
    kvmAvailable.value = kvmOk
    setApps(list || [], links)
  }
```

`Home.vue` 一行都不用改:它在 `loadGrid()` **成功之后**才调 `layout.sweepGone(Object.keys(apps.apps))`,`vm` 不在 map 里就自动进 45 秒缺席宽限期,与容器应用被卸载走同一条通路。

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm exec vitest run src/home/apps/systemApps.test.ts src/home/stores/apps.test.ts`
Expected: 全部 PASS

- [ ] **Step 6: 钉住桌面磁贴确实会被清掉**

`src/home/stores/layout.test.ts` 的 `sweepGone / evict force` 那个 describe 里追加(该 describe 已 `vi.useFakeTimers()`):

```ts
  it('removes the KVM tile once the service has been missing for the grace period', () => {
    // The default layout already carries a `vm` tile, so loadInitial() is enough to
    // reproduce what a machine without KVM installed sees on first load.
    const s = useLayoutStore(); s.loadInitial()
    const live = ['files', 'storage', 'photos', 'ai', 'knowledge', 'settings', 'appstore']
    s.sweepGone(live) // first absence: only starts the clock
    expect(s.items.some((i) => i.kind === 'app' && i.key === 'vm')).toBe(true)
    vi.advanceTimersByTime(46_000)
    s.sweepGone(live) // absent past the grace period: removed
    expect(s.items.some((i) => i.kind === 'app' && i.key === 'vm')).toBe(false)
  })
```

形状照抄同 describe 里既有的两个用例(`s.loadInitial()` + `s.sweepGone([...])`,断言带 `i.kind === 'app'`),不用 `replaceAll`。

Run: `pnpm exec vitest run src/home/stores/layout.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/home
git commit -m "feat(home): hide the KVM tile when the service is not reachable

KVM is optional and is not installed on every machine, yet the tile was
injected unconditionally with a hardcoded running status. The probe runs
with the app grid load; an unknown result still renders the tile so the
first frame does not blink, and a confirmed absence lets the existing
sweep reclaim the tile after its grace period."
```

---

