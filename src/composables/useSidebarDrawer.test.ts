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

  it('Narrow screen init: isNarrow reflects matchMedia.matches', () => {
    mqMatches = true
    stubMatchMedia()
    const d = useSidebarDrawer()
    expect(d.isNarrow.value).toBe(true)
    expect(d.open.value).toBe(false)
  })

  it('toggle/close: toggle drawer open/close', () => {
    mqMatches = true
    stubMatchMedia()
    const d = useSidebarDrawer()
    d.toggle()
    expect(d.open.value).toBe(true)
    d.close()
    expect(d.open.value).toBe(false)
  })

  it('Widen to exit narrow screen → open forced to false', () => {
    mqMatches = true
    stubMatchMedia()
    const d = useSidebarDrawer()
    d.toggle()
    fireChange(false)
    expect(d.isNarrow.value).toBe(false)
    expect(d.open.value).toBe(false)
  })

  it('Multiple calls share the same state (module singleton)', () => {
    mqMatches = true
    stubMatchMedia()
    const a = useSidebarDrawer()
    const b = useSidebarDrawer()
    a.toggle()
    expect(b.open.value).toBe(true)
  })

  it('No matchMedia (bare jsdom environment) degrades to desktop mode and does not throw', () => {
    // Do not stub — jsdom has no window.matchMedia by default
    const d = useSidebarDrawer()
    expect(d.isNarrow.value).toBe(false)
    d.toggle() // Should not throw
    expect(d.open.value).toBe(true)
  })
})
