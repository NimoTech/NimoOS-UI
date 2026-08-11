import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLayoutStore } from '../stores/layout'
import { useAddPanel, __resetAddPanelForTest } from './useAddPanel'
const DIMS = { cols: 12, rows: 8 }

describe('useAddPanel', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); __resetAddPanelForTest() })
  it('pinToFree adds an app at the first free slot', () => {
    const layout = useLayoutStore(); layout.replaceAll([]) // 空网格
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
    const ok = ap.spawnPlace({ kind: 'app', key: 'vm', w: 1, h: 1 } as any, 1, 1) // 占 files 处 → files 让位
    expect(ok).toBe(true)
    expect(layout.items.some((i) => i.key === 'vm' && i.c === 1 && i.r === 1)).toBe(true)
    expect(layout.items.some((i) => i.key === 'files')).toBe(true) // files 还在(让位)
  })
  it('appWidgetUsed 反映桌面上的 appwidget;pinToFree 拒绝重复 appwidget', () => {
    const layout = useLayoutStore()
    layout.replaceAll([])
    const ap = useAddPanel({ cols: 12, rows: 8 })
    expect(ap.appWidgetUsed('my-dl')).toBe(false)
    expect(ap.pinToFree({ kind: 'appwidget', key: 'my-dl', w: 2, h: 2 })).toBe(true)
    expect(ap.appWidgetUsed('my-dl')).toBe(true)
    expect(ap.pinToFree({ kind: 'appwidget', key: 'my-dl', w: 2, h: 2 })).toBe(false)
  })
  it('同一 app 第二次 pinToFree 被拒并 toast', () => {
    const layout = useLayoutStore(); layout.replaceAll([])
    vi.spyOn(layout, 'save').mockImplementation(() => {})
    const { pinToFree } = useAddPanel(DIMS)
    expect(pinToFree({ kind: 'app', key: 'jellyfin', w: 1, h: 1 } as any)).toBe(true)
    expect(pinToFree({ kind: 'app', key: 'jellyfin', w: 1, h: 1 } as any)).toBe(false)
    expect(layout.items.filter((i) => i.kind === 'app' && i.key === 'jellyfin')).toHaveLength(1)
  })
  it('同一 folder(按 path 判等)第二次 spawnPlace 被拒', () => {
    const layout = useLayoutStore(); layout.replaceAll([])
    vi.spyOn(layout, 'save').mockImplementation(() => {})
    const { spawnPlace } = useAddPanel(DIMS)
    const desc = { kind: 'folder' as const, key: 'docs', path: '/DATA/docs', w: 1, h: 1 } as any
    expect(spawnPlace(desc, 1, 1)).toBe(true)
    expect(spawnPlace(desc, 2, 1)).toBe(false)
  })
})
