import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLayoutStore } from '../stores/layout'
import { useAddPanel, __resetAddPanelForTest } from './useAddPanel'
const DIMS = { cols: 12, rows: 8 }

describe('useAddPanel', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); __resetAddPanelForTest() })
  it('pinToFree adds an app at the first free slot', () => {
    const layout = useLayoutStore(); layout.replaceAll([]) // empty grid
    vi.spyOn(layout, 'save').mockImplementation(() => {})
    const ap = useAddPanel(DIMS)
    ap.pinToFree({ kind: 'app', key: 'vm', w: 1, h: 1 } as any)
    expect(layout.items).toHaveLength(1)
    expect(layout.items[0]).toMatchObject({ kind: 'app', key: 'vm', c: 1, r: 1 })
  })
  it('widget uniqueness: pinning an existing widget is a no-op', () => {
    const layout = useLayoutStore(); layout.replaceAll([{ kind: 'widget', key: 'cpu', c: 1, r: 1, w: 4, h: 2 }])
    vi.spyOn(layout, 'save').mockImplementation(() => {})
    const ap = useAddPanel(DIMS)
    ap.pinToFree({ kind: 'widget', key: 'cpu', w: 4, h: 2 } as any)
    expect(layout.items.filter((i) => i.key === 'cpu')).toHaveLength(1)
  })
  it('spawnPlace displaces others and adds at target', () => {
    const layout = useLayoutStore(); layout.replaceAll([{ kind: 'app', key: 'files', c: 1, r: 1, w: 1, h: 1 }])
    vi.spyOn(layout, 'save').mockImplementation(() => {})
    const ap = useAddPanel(DIMS)
    const ok = ap.spawnPlace({ kind: 'app', key: 'vm', w: 1, h: 1 } as any, 1, 1) // occupies files position → files yields
    expect(ok).toBe(true)
    expect(layout.items.some((i) => i.key === 'vm' && i.c === 1 && i.r === 1)).toBe(true)
    expect(layout.items.some((i) => i.key === 'files')).toBe(true) // files still present (yielded)
  })
  it('appWidgetUsed reflects appwidgets on desktop; pinToFree rejects duplicate appwidgets', () => {
    const layout = useLayoutStore()
    layout.replaceAll([])
    const ap = useAddPanel({ cols: 12, rows: 8 })
    expect(ap.appWidgetUsed('my-dl')).toBe(false)
    expect(ap.pinToFree({ kind: 'appwidget', key: 'my-dl', w: 2, h: 2 })).toBe(true)
    expect(ap.appWidgetUsed('my-dl')).toBe(true)
    expect(ap.pinToFree({ kind: 'appwidget', key: 'my-dl', w: 2, h: 2 })).toBe(false)
  })
  it('second pinToFree of the same app is rejected with toast', () => {
    const layout = useLayoutStore(); layout.replaceAll([])
    vi.spyOn(layout, 'save').mockImplementation(() => {})
    const { pinToFree } = useAddPanel(DIMS)
    expect(pinToFree({ kind: 'app', key: 'jellyfin', w: 1, h: 1 } as any)).toBe(true)
    expect(pinToFree({ kind: 'app', key: 'jellyfin', w: 1, h: 1 } as any)).toBe(false)
    expect(layout.items.filter((i) => i.kind === 'app' && i.key === 'jellyfin')).toHaveLength(1)
  })
  it('second spawnPlace of the same folder (by path equality) is rejected', () => {
    const layout = useLayoutStore(); layout.replaceAll([])
    vi.spyOn(layout, 'save').mockImplementation(() => {})
    const { spawnPlace } = useAddPanel(DIMS)
    const desc = { kind: 'folder' as const, key: 'docs', path: '/DATA/docs', w: 1, h: 1 } as any
    expect(spawnPlace(desc, 1, 1)).toBe(true)
    expect(spawnPlace(desc, 2, 1)).toBe(false)
  })
})
