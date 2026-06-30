import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLayoutStore } from '../stores/layout'
import { useAddPanel } from './useAddPanel'
const DIMS = { cols: 12, rows: 8 }

describe('useAddPanel', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })
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
})
