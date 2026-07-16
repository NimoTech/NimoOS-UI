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
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    setCustomStorage.mockClear()
    getCustomStorage.mockClear()
    vi.useFakeTimers()
  })
  afterEach(() => { vi.useRealTimers() })

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

  it('容器消失(缺席满宽限期):桌面项移除 + 清 seen,重来会再次上桌', () => {
    const s = useLayoutStore()
    s.replaceAll([])
    s.autoPin([dl('a', { w: 2, h: 2 }), dl('b')], DIMS)
    expect(s.items.filter((it) => it.key === 'a')).toHaveLength(2)
    expect(s.items.filter((it) => it.key === 'b')).toHaveLength(1)
    s.autoPin([dl('b')], DIMS) // a 停止/删除,第一次缺席只标记,不清
    expect(s.items.filter((it) => it.key === 'a')).toHaveLength(2)
    vi.advanceTimersByTime(60_000)
    s.autoPin([dl('b')], DIMS) // 缺席满宽限期,清理
    expect(s.items.filter((it) => it.key === 'a')).toHaveLength(0)
    expect(s.items.filter((it) => it.key === 'b')).toHaveLength(1)
    s.autoPin([dl('a'), dl('b')], DIMS) // a 重新 run
    expect(s.items.filter((it) => it.kind === 'app' && it.key === 'a')).toHaveLength(1)
  })

  it('单次缺席(docker 抖动)不清桌,恢复后重置计时', () => {
    const s = useLayoutStore()
    s.replaceAll([])
    s.autoPin([dl('a')], DIMS)
    s.autoPin([], DIMS) // 抖动:一次全空
    expect(s.items.filter((it) => it.key === 'a')).toHaveLength(1)
    s.autoPin([dl('a')], DIMS) // 恢复,缺席计时应重置
    vi.advanceTimersByTime(60_000)
    s.autoPin([dl('a')], DIMS) // 一直在场,不应被清
    expect(s.items.filter((it) => it.key === 'a')).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem('nimoos-home-seen-apps-v1')!)).toContain('a')
  })

  it('删掉最后一个 desktop 应用(decls 全空)也能在宽限期后清理,不再永久残留', () => {
    const s = useLayoutStore()
    s.replaceAll([])
    s.autoPin([dl('a', { w: 2, h: 2 })], DIMS)
    expect(s.items.filter((it) => it.key === 'a')).toHaveLength(2)
    s.autoPin([], DIMS) // 第一次全空:只标记
    expect(s.items.filter((it) => it.key === 'a')).toHaveLength(2)
    vi.advanceTimersByTime(60_000)
    s.autoPin([], DIMS) // 持续缺席满宽限期:清理
    expect(s.items.filter((it) => it.key === 'a')).toHaveLength(0)
    expect(JSON.parse(localStorage.getItem('nimoos-home-seen-apps-v1')!)).not.toContain('a')
  })

  it('明确停止(stoppedKeys)的应用立即清理,不等宽限期', () => {
    const s = useLayoutStore()
    s.replaceAll([])
    s.autoPin([dl('a', { w: 2, h: 2 })], DIMS)
    expect(s.items.filter((it) => it.key === 'a')).toHaveLength(2)
    // 后端明确报告 a 已停止(exited):第一次轮询就清,无需缺席宽限
    s.autoPin([], DIMS, ['a'])
    expect(s.items.filter((it) => it.key === 'a')).toHaveLength(0)
    expect(JSON.parse(localStorage.getItem('nimoos-home-seen-apps-v1')!)).not.toContain('a')
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

  it('evict 立即移除图标+小组件并清 seen(重新出现可再上桌)', () => {
    const s = useLayoutStore()
    s.replaceAll([])
    s.autoPin([dl('tasklist', { w: 2, h: 2 })], DIMS)
    expect(s.items.filter((i) => i.key === 'tasklist')).toHaveLength(2) // app + appwidget

    s.evict('tasklist')
    expect(s.items.filter((i) => i.key === 'tasklist')).toHaveLength(0)

    // seen 已清:同名容器再出现要能重新自动上桌
    s.autoPin([dl('tasklist', { w: 2, h: 2 })], DIMS)
    expect(s.items.filter((i) => i.key === 'tasklist')).toHaveLength(2)
  })

  it('evict 不误伤其他项且无匹配时不报错', () => {
    const s = useLayoutStore()
    s.replaceAll([])
    s.autoPin([dl('other')], DIMS)
    s.evict('nonexistent')
    expect(s.items.filter((i) => i.key === 'other').length).toBeGreaterThan(0)
  })
})
