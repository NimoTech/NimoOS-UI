import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLayoutStore } from './layout'
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
      { kind: 'widget', key: 'health', c: 1, r: 1, w: 2, h: 2 }, // 已下线
      { kind: 'app', key: 'files', c: 3, r: 1, w: 1, h: 1 },
    ]))
    const s = useLayoutStore()
    s.loadInitial()
    expect(s.items).toHaveLength(1)
    expect(s.items[0].key).toBe('files')
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

describe('autoPin', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })

  it('新应用:图标 1×1 上桌;声明 widget 的再落一块 appwidget', () => {
    const s = useLayoutStore()
    s.replaceAll([])
    s.autoPin([dl('my-dl', { w: 3, h: 2 })], DIMS)
    const icon = s.items.find((it) => it.kind === 'app' && it.key === 'my-dl')
    const widget = s.items.find((it) => it.kind === 'appwidget' && it.key === 'my-dl')
    expect(icon).toMatchObject({ w: 1, h: 1 })
    expect(widget).toMatchObject({ w: 3, h: 2 })
  })

  it('已 seen 不重复上桌(含用户手删场景)', () => {
    const s = useLayoutStore()
    s.replaceAll([])
    s.autoPin([dl('a')], DIMS)
    const id = s.items.find((it) => it.key === 'a')!.id
    s.remove(id) // 用户手删
    s.autoPin([dl('a')], DIMS)
    expect(s.items.filter((it) => it.key === 'a')).toHaveLength(0)
  })

  it('容器消失:桌面项移除 + 清 seen,重来会再次上桌', () => {
    const s = useLayoutStore()
    s.replaceAll([])
    s.autoPin([dl('a', { w: 2, h: 2 })], DIMS)
    expect(s.items.filter((it) => it.key === 'a')).toHaveLength(2)
    s.autoPin([], DIMS) // 容器被 docker rm
    expect(s.items.filter((it) => it.key === 'a')).toHaveLength(0)
    s.autoPin([dl('a')], DIMS) // 重新 run
    expect(s.items.filter((it) => it.kind === 'app' && it.key === 'a')).toHaveLength(1)
  })

  it('seen 持久化到 localStorage', () => {
    const s = useLayoutStore()
    s.replaceAll([])
    s.autoPin([dl('a')], DIMS)
    expect(JSON.parse(localStorage.getItem('nimoos-home-seen-apps-v1')!)).toContain('a')
  })

  it('桌面满:图标放不下也记 seen,不反复尝试', () => {
    const s = useLayoutStore()
    // 12×8 全占满
    const full = [] as never[]
    for (let r = 1; r <= 8; r++) for (let c = 1; c <= 12; c++) full.push({ kind: 'app', key: `f${c}-${r}`, c, r, w: 1, h: 1 } as never)
    s.replaceAll(full)
    s.autoPin([dl('a')], DIMS)
    expect(s.items.filter((it) => it.key === 'a')).toHaveLength(0)
    expect(JSON.parse(localStorage.getItem('nimoos-home-seen-apps-v1')!)).toContain('a')
  })
})
