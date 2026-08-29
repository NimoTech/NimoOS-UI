import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const setCustomStorage: MockedFunction<(key: string, data: unknown) => Promise<unknown>> = vi.fn(async () => ({}))
const getCustomStorage: MockedFunction<(key: string) => Promise<unknown>> = vi.fn(async () => null)
vi.mock('@nimotech/nimoos-service', async () => {
  const actual = await vi.importActual<typeof import('@nimotech/nimoos-service')>('@nimotech/nimoos-service')
  return {
    ...actual,
    service: {
      users: {
        setCustomStorage: (key: string, data: unknown) => setCustomStorage(key, data),
        getCustomStorage: (key: string) => getCustomStorage(key)
      }
    }
  }
})
import { useLayoutStore } from './layout'
import { useAppsStore } from './apps'
import { DEFAULT } from '../grid/defaultLayout'
import type { DesktopAppDecl } from './apps'

describe('useLayoutStore', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })

  it('loadInitial falls back to DEFAULT (tagged with ids) when no localStorage', () => {
    const s = useLayoutStore()
    s.loadInitial()
    expect(s.items).toHaveLength(DEFAULT.length)
    expect(s.items.every((i) => typeof i.id === 'string' && i.id.startsWith('i'))).toBe(true)
  })

  it('loadInitial sanitizes unknown widget keys from stored layout', () => {
    localStorage.setItem('nimoos-home-layout-v2', JSON.stringify([
      { kind: 'widget', key: 'health', c: 1, r: 1, w: 2, h: 2 }, // retired
      { kind: 'app', key: 'files', c: 3, r: 1, w: 1, h: 1 },
    ]))
    const s = useLayoutStore()
    s.loadInitial()
    expect(s.items).toHaveLength(1)
    expect(s.items[0].key).toBe('files')
  })

  it('loadInitial respects a saved empty layout (user cleared the desktop)', () => {
    localStorage.setItem('nimoos-home-layout-v2', '[]')
    const s = useLayoutStore()
    s.loadInitial()
    expect(s.items).toHaveLength(0)
  })

  it('loadInitial still falls back to DEFAULT when a saved layout sanitizes to nothing', () => {
    // All retired widgets: this is not a deliberate user clear, fall back to the default desktop
    localStorage.setItem('nimoos-home-layout-v2', JSON.stringify([
      { kind: 'widget', key: 'health', c: 1, r: 1, w: 2, h: 2 },
    ]))
    const s = useLayoutStore()
    s.loadInitial()
    expect(s.items).toHaveLength(DEFAULT.length)
  })

  it('loadServer applies a server-side empty layout (cleared on another device)', async () => {
    const s = useLayoutStore()
    s.loadInitial()
    expect(s.items.length).toBeGreaterThan(0)
    getCustomStorage.mockResolvedValueOnce([])
    await s.loadServer()
    expect(s.items).toHaveLength(0)
  })

  it('loadServer keeps current items when the key was never saved (backend returns "")', async () => {
    const s = useLayoutStore()
    s.loadInitial()
    const before = s.items.length
    getCustomStorage.mockResolvedValueOnce('')
    await s.loadServer()
    expect(s.items).toHaveLength(before)
  })

  it('serialize strips id', () => {
    const s = useLayoutStore(); s.loadInitial()
    expect(s.serialize()[0]).not.toHaveProperty('id')
  })

  it('remove drops the item by id', () => {
    const s = useLayoutStore(); s.loadInitial()
    const id = s.items[0].id
    s.remove(id)
    expect(s.items.find((i) => i.id === id)).toBeUndefined()
  })

  it('pin appends a tagged item', () => {
    const s = useLayoutStore(); s.loadInitial()
    const before = s.items.length
    s.pin({ kind: 'app', key: 'vm', c: 1, r: 1, w: 1, h: 1 })
    expect(s.items).toHaveLength(before + 1)
    expect(s.items[s.items.length - 1].id).toMatch(/^i\d+$/)
  })
})

const DIMS = { cols: 12, rows: 8 }
const dl = (key: string, widget?: { w: number; h: number }): DesktopAppDecl => ({ key, widget })

describe('sweepGone / evict force (desktop and app list stay in sync after uninstall)', () => {
  // Isolate each test's pinia + localStorage, same as the sibling autoPin describes below —
  // without this, sweepGone's own save()/saveLocal() leak pruned layouts across tests via
  // localStorage, and a later test's loadInitial() silently inherits an earlier test's cuts.
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); vi.useFakeTimers() })
  afterEach(() => vi.useRealTimers())

  it('manually pinned tiles: removed after grace period, kept during it', () => {
    const s = useLayoutStore(); s.loadInitial()
    s.pin({ kind: 'app', key: 'test-nginx', c: 1, r: 1, w: 1, h: 1 })
    s.sweepGone(['files']) // first absence: only starts the clock
    expect(s.items.some((i) => i.kind === 'app' && i.key === 'test-nginx')).toBe(true)
    vi.advanceTimersByTime(46_000)
    s.sweepGone(['files']) // absent past the grace period: removed
    expect(s.items.some((i) => i.kind === 'app' && i.key === 'test-nginx')).toBe(false)
  })

  it('tiles still in app list are not cleared, and absence timer resets', () => {
    const s = useLayoutStore(); s.loadInitial()
    s.pin({ kind: 'app', key: 'jellyfin', c: 1, r: 1, w: 1, h: 1 })
    s.sweepGone([]) // blip: one all-empty round, starts the clock
    s.sweepGone(['jellyfin']) // recovered: clock resets
    vi.advanceTimersByTime(46_000)
    s.sweepGone([]) // absent again: only restarts the clock, no removal
    expect(s.items.some((i) => i.kind === 'app' && i.key === 'jellyfin')).toBe(true)
  })

  it('evict(force) immediately removes manually pinned tiles (not seen); defaults still exempt', () => {
    const s = useLayoutStore(); s.loadInitial()
    s.pin({ kind: 'app', key: 'test-nginx', c: 1, r: 1, w: 1, h: 1 })
    s.evict('test-nginx')
    expect(s.items.some((i) => i.kind === 'app' && i.key === 'test-nginx')).toBe(true) // exempted by the seen guard
    s.evict('test-nginx', { force: true })
    expect(s.items.some((i) => i.kind === 'app' && i.key === 'test-nginx')).toBe(false)
  })

  it('removes the KVM tile once the service has been missing for the grace period, and only that tile', () => {
    // The default layout already carries a `vm` tile, so loadInitial() is enough to
    // reproduce what a machine without KVM installed sees on first load. `live` only
    // needs to omit 'vm' -- it stands in for the other system app keys the app grid
    // would still report, kept short deliberately.
    const s = useLayoutStore(); s.loadInitial()
    const live = ['files', 'storage', 'settings', 'appstore']
    s.sweepGone(live) // first absence: only starts the clock
    expect(s.items.some((i) => i.kind === 'app' && i.key === 'vm')).toBe(true)
    expect(s.items.some((i) => i.kind === 'app' && i.key === 'files')).toBe(true)
    vi.advanceTimersByTime(46_000)
    s.sweepGone(live) // absent past the grace period: removed
    expect(s.items.some((i) => i.kind === 'app' && i.key === 'vm')).toBe(false)
    // Selectivity: a tile that IS in `live` must survive the very same sweep --
    // without this, the test would equally pass if sweepGone swept every desktop
    // tile it didn't recognise, proving nothing specific to 'vm'.
    expect(s.items.some((i) => i.kind === 'app' && i.key === 'files')).toBe(true)
  })

  it('evict(force) on a confirmed-unreachable KVM tile is immediate (no timer needed), and the tile can be pinned back manually afterward', () => {
    // This is the fast path Home.vue's refreshApps() takes as soon as apps.kvmAvailable
    // flips to false -- unlike the sweep above, it needs no grace period and no timer
    // advance at all.
    const s = useLayoutStore(); s.loadInitial()
    expect(s.items.some((i) => i.kind === 'app' && i.key === 'vm')).toBe(true)
    s.evict('vm', { force: true })
    expect(s.items.some((i) => i.kind === 'app' && i.key === 'vm')).toBe(false)
    // Once KVM answers again, the apps store re-lists 'vm' in `order` (see apps.test.ts
    // "brings the tile back once KVM answers again"), which is what makes it show up in
    // the Add Apps panel (AddPanel.vue iterates appsStore.order); from there the user
    // pins it back exactly like any other tile -- evict(force) clears `seen` too, so
    // there is no stale bookkeeping left over to block the re-add.
    s.pin({ kind: 'app', key: 'vm', c: 1, r: 1, w: 1, h: 1 })
    expect(s.items.some((i) => i.kind === 'app' && i.key === 'vm')).toBe(true)
  })
})

describe('autoPin', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    setCustomStorage.mockClear()
    getCustomStorage.mockClear()
    vi.useFakeTimers()
  })
  afterEach(() => { vi.useRealTimers() })

  it('new app: icon 1x1 placed on desktop; declared widget also placed as appwidget', () => {
    const s = useLayoutStore()
    s.replaceAll([])
    s.autoPin([dl('my-dl', { w: 3, h: 2 })], DIMS)
    const icon = s.items.find((it) => it.kind === 'app' && it.key === 'my-dl')
    const widget = s.items.find((it) => it.kind === 'appwidget' && it.key === 'my-dl')
    expect(icon).toMatchObject({ w: 1, h: 1 })
    expect(widget).toMatchObject({ w: 3, h: 2 })
  })

  it('seen apps do not re-pin (including user manual delete)', () => {
    const s = useLayoutStore()
    s.replaceAll([])
    s.autoPin([dl('a')], DIMS)
    const id = s.items.find((it) => it.key === 'a')!.id
    s.remove(id) // user deletes manually
    s.autoPin([dl('a')], DIMS)
    expect(s.items.filter((it) => it.key === 'a')).toHaveLength(0)
  })

  it('container disappears (absent past grace period): desktop items removed + seen cleared, re-pins when returns', () => {
    const s = useLayoutStore()
    s.replaceAll([])
    s.autoPin([dl('a', { w: 2, h: 2 }), dl('b')], DIMS)
    expect(s.items.filter((it) => it.key === 'a')).toHaveLength(2)
    expect(s.items.filter((it) => it.key === 'b')).toHaveLength(1)
    s.autoPin([dl('b')], DIMS) // a stopped/removed; first absence only marks, no removal
    expect(s.items.filter((it) => it.key === 'a')).toHaveLength(2)
    vi.advanceTimersByTime(60_000)
    s.autoPin([dl('b')], DIMS) // absent past the grace period, cleaned up
    expect(s.items.filter((it) => it.key === 'a')).toHaveLength(0)
    expect(s.items.filter((it) => it.key === 'b')).toHaveLength(1)
    s.autoPin([dl('a'), dl('b')], DIMS) // a runs again
    expect(s.items.filter((it) => it.kind === 'app' && it.key === 'a')).toHaveLength(1)
  })

  it('single absence (docker blip) does not clear desktop, timer resets on recovery', () => {
    const s = useLayoutStore()
    s.replaceAll([])
    s.autoPin([dl('a')], DIMS)
    s.autoPin([], DIMS) // blip: one all-empty round
    expect(s.items.filter((it) => it.key === 'a')).toHaveLength(1)
    s.autoPin([dl('a')], DIMS) // recovered, absence clock should reset
    vi.advanceTimersByTime(60_000)
    s.autoPin([dl('a')], DIMS) // present the whole time, must not be removed
    expect(s.items.filter((it) => it.key === 'a')).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem('nimoos-home-seen-apps-v1')!)).toContain('a')
  })

  it('deleting the last desktop app (decls empty) can still be cleaned up after grace period, no permanent lingering', () => {
    const s = useLayoutStore()
    s.replaceAll([])
    s.autoPin([dl('a', { w: 2, h: 2 })], DIMS)
    expect(s.items.filter((it) => it.key === 'a')).toHaveLength(2)
    s.autoPin([], DIMS) // first all-empty round: only marks
    expect(s.items.filter((it) => it.key === 'a')).toHaveLength(2)
    vi.advanceTimersByTime(60_000)
    s.autoPin([], DIMS) // continuously absent past the grace period: cleaned up
    expect(s.items.filter((it) => it.key === 'a')).toHaveLength(0)
    expect(JSON.parse(localStorage.getItem('nimoos-home-seen-apps-v1')!)).not.toContain('a')
  })

  it('explicitly stopped apps (stoppedKeys) are cleaned up immediately, no grace period', () => {
    const s = useLayoutStore()
    s.replaceAll([])
    s.autoPin([dl('a', { w: 2, h: 2 })], DIMS)
    expect(s.items.filter((it) => it.key === 'a')).toHaveLength(2)
    // Backend explicitly reports a as stopped (exited): cleared on the first poll, no absence grace needed
    s.autoPin([], DIMS, ['a'])
    expect(s.items.filter((it) => it.key === 'a')).toHaveLength(0)
    expect(JSON.parse(localStorage.getItem('nimoos-home-seen-apps-v1')!)).not.toContain('a')
  })

  it('seen is persisted to localStorage', () => {
    const s = useLayoutStore()
    s.replaceAll([])
    s.autoPin([dl('a')], DIMS)
    expect(JSON.parse(localStorage.getItem('nimoos-home-seen-apps-v1')!)).toContain('a')
  })

  it('desktop full: icon still recorded in seen even if it does not fit, no retry attempts', () => {
    const s = useLayoutStore()
    // fill the entire 12×8 grid
    const full = [] as never[]
    for (let r = 1; r <= 8; r++) for (let c = 1; c <= 12; c++) full.push({ kind: 'app', key: `f${c}-${r}`, c, r, w: 1, h: 1 } as never)
    s.replaceAll(full)
    s.autoPin([dl('a')], DIMS)
    expect(s.items.filter((it) => it.key === 'a')).toHaveLength(0)
    expect(JSON.parse(localStorage.getItem('nimoos-home-seen-apps-v1')!)).toContain('a')
  })

  it('evict immediately removes icon + widget and clears seen (can re-pin when reappears)', () => {
    const s = useLayoutStore()
    s.replaceAll([])
    s.autoPin([dl('tasklist', { w: 2, h: 2 })], DIMS)
    expect(s.items.filter((i) => i.key === 'tasklist')).toHaveLength(2) // app + appwidget

    s.evict('tasklist')
    expect(s.items.filter((i) => i.key === 'tasklist')).toHaveLength(0)

    // seen is cleared: a container with the same name must auto-pin again when it reappears
    s.autoPin([dl('tasklist', { w: 2, h: 2 })], DIMS)
    expect(s.items.filter((i) => i.key === 'tasklist')).toHaveLength(2)
  })

  it('evict does not harm other items and does not error when no match', () => {
    const s = useLayoutStore()
    s.replaceAll([])
    s.autoPin([dl('other')], DIMS)
    s.evict('nonexistent')
    expect(s.items.filter((i) => i.key === 'other')).toHaveLength(1)
  })

  it('evict does not touch manual/system icons not in seen', () => {
    const s = useLayoutStore()
    s.replaceAll([])
    // Manually place a system icon; it never goes through autoPin, so it is not in seen
    s.pin({ kind: 'app', key: 'files', c: 0, r: 0, w: 1, h: 1 })
    expect(s.items.filter((i) => i.key === 'files')).toHaveLength(1)
    // evict must not affect non-seen icons
    s.evict('files')
    expect(s.items.filter((i) => i.key === 'files')).toHaveLength(1)
  })

  it('autoPin does not duplicate app tile with same key already on desktop (manually pinned before seen)', () => {
    const s = useLayoutStore()
    s.replaceAll([])
    s.pin({ kind: 'app', key: 'jellyfin', c: 1, r: 1, w: 1, h: 1 }) // manually pinned, not in seen
    s.autoPin([dl('jellyfin')], DIMS)
    expect(s.items.filter((i) => i.kind === 'app' && i.key === 'jellyfin')).toHaveLength(1)
    // seen must be backfilled, otherwise the next round would try again
    expect(JSON.parse(localStorage.getItem('nimoos-home-seen-apps-v1')!)).toContain('jellyfin')
  })
})

describe('autoPin range tightening self-heal (appwidget size clamped to current range)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    setCustomStorage.mockClear()
    getCustomStorage.mockClear()
    vi.useFakeTimers()
  })
  afterEach(() => { vi.useRealTimers() })

  function seedWidget(key: string, w: number, h: number, range?: { minw?: number; minh?: number; maxw?: number; maxh?: number }) {
    useAppsStore().setApps([
      { name: key, desktop: true, status: 'running', port: '1', widget: { path: '/w', w, h, ...range } },
    ] as never)
  }

  it('legitimate user resize (still within current range) not overwritten by autoPin', () => {
    seedWidget('a', 2, 2, { maxw: 4, maxh: 4 })
    const s = useLayoutStore()
    s.replaceAll([])
    s.autoPin([dl('a', { w: 2, h: 2 })], DIMS)
    const w0 = s.items.find((it) => it.kind === 'appwidget' && it.key === 'a')!
    s.applyPlan([{ id: w0.id, c: w0.c, r: w0.r, w: 3, h: 3 }]) // user manually resizes to 3×3 (still within the 2..4 range)
    s.autoPin([dl('a', { w: 2, h: 2 })], DIMS) // another poll with the range unchanged
    const w1 = s.items.find((it) => it.kind === 'appwidget' && it.key === 'a')!
    expect(w1).toMatchObject({ w: 3, h: 3, c: w0.c, r: w0.r })
  })

  it('after container tightens range, persisted size exceeds bounds (needs shrink): shrink in place', () => {
    seedWidget('a', 4, 4, { maxw: 4, maxh: 4 })
    const s = useLayoutStore()
    s.replaceAll([])
    s.autoPin([dl('a', { w: 4, h: 4 })], DIMS)
    const w0 = s.items.find((it) => it.kind === 'appwidget' && it.key === 'a')!
    expect(w0).toMatchObject({ w: 4, h: 4 })
    seedWidget('a', 4, 4, { maxw: 2, maxh: 2 }) // container tightens: max 4×4 → 2×2
    s.autoPin([dl('a', { w: 4, h: 4 })], DIMS)
    const w1 = s.items.find((it) => it.kind === 'appwidget' && it.key === 'a')!
    expect(w1).toMatchObject({ w: 2, h: 2, c: w0.c, r: w0.r })
  })

  it('container raises min (needs expand) and no collision in place: expand in place', () => {
    seedWidget('a', 2, 1, { minw: 2, minh: 1, maxw: 4, maxh: 4 })
    const s = useLayoutStore()
    s.replaceAll([])
    s.autoPin([dl('a', { w: 2, h: 1 })], DIMS)
    const w0 = s.items.find((it) => it.kind === 'appwidget' && it.key === 'a')!
    expect(w0).toMatchObject({ w: 2, h: 1 })
    seedWidget('a', 2, 1, { minw: 3, minh: 2, maxw: 4, maxh: 4 }) // container locks in a raised minimum
    s.autoPin([dl('a', { w: 2, h: 1 })], DIMS)
    const w1 = s.items.find((it) => it.kind === 'appwidget' && it.key === 'a')!
    expect(w1).toMatchObject({ w: 3, h: 2, c: w0.c, r: w0.r })
  })

  it('after expand, collision with neighbor in place: find new position and move', () => {
    seedWidget('a', 2, 1, { minw: 2, minh: 1, maxw: 4, maxh: 4 })
    const s = useLayoutStore()
    s.replaceAll([])
    s.autoPin([dl('a', { w: 2, h: 1 })], DIMS)
    const w0 = s.items.find((it) => it.kind === 'appwidget' && it.key === 'a')!
    // Place a blocker right against the widget's right edge; growing in place must overlap it
    s.pin({ kind: 'app', key: 'blocker', c: w0.c + w0.w, r: w0.r, w: 1, h: 1 })
    seedWidget('a', 2, 1, { minw: 3, minh: 1, maxw: 4, maxh: 4 })
    s.autoPin([dl('a', { w: 2, h: 1 })], DIMS)
    const w1 = s.items.find((it) => it.kind === 'appwidget' && it.key === 'a')!
    expect(w1.w).toBe(3)
    expect(w1.h).toBe(1)
    expect(w1.c !== w0.c || w1.r !== w0.r).toBe(true) // relocated, no overlap with the blocker
    expect(s.items.filter((it) => it.key === 'blocker')).toHaveLength(1)
  })
})
