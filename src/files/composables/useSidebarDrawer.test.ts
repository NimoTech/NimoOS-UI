import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSidebarDrawer, __resetSidebarDrawerForTest } from './useSidebarDrawer'

type Listener = (e: { matches: boolean }) => void
let listeners: Listener[]
let mqMatches: boolean

function stubMatchMedia() {
  vi.stubGlobal('matchMedia', (media: string) => ({
    matches: mqMatches,
    media,
    addEventListener: (_: string, fn: Listener) => { listeners.push(fn) },
    removeEventListener: (_: string, fn: Listener) => { listeners = listeners.filter((l) => l !== fn) },
  }))
}
function fireChange(matches: boolean) { listeners.forEach((fn) => fn({ matches })) }

describe('useSidebarDrawer', () => {
  beforeEach(() => {
    __resetSidebarDrawerForTest()
    vi.unstubAllGlobals()
    listeners = []
    mqMatches = false
  })

  it('窄屏初始:isNarrow 反映 matchMedia.matches', () => {
    mqMatches = true
    stubMatchMedia()
    const d = useSidebarDrawer()
    expect(d.isNarrow.value).toBe(true)
    expect(d.open.value).toBe(false)
  })

  it('toggle/close 开合抽屉', () => {
    mqMatches = true
    stubMatchMedia()
    const d = useSidebarDrawer()
    d.toggle()
    expect(d.open.value).toBe(true)
    d.close()
    expect(d.open.value).toBe(false)
  })

  it('拉宽离开窄屏 → open 强制归 false', () => {
    mqMatches = true
    stubMatchMedia()
    const d = useSidebarDrawer()
    d.toggle()
    fireChange(false)
    expect(d.isNarrow.value).toBe(false)
    expect(d.open.value).toBe(false)
  })

  it('多次调用共享同一状态(模块单例)', () => {
    mqMatches = true
    stubMatchMedia()
    const a = useSidebarDrawer()
    const b = useSidebarDrawer()
    a.toggle()
    expect(b.open.value).toBe(true)
  })

  it('无 matchMedia(jsdom 裸环境)退化为桌面态且不抛错', () => {
    // 不 stub —— jsdom 默认没有 window.matchMedia
    const d = useSidebarDrawer()
    expect(d.isNarrow.value).toBe(false)
    d.toggle() // 不应抛错
    expect(d.open.value).toBe(true)
  })
})
