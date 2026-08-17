import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { useSidebarCollapse, __resetSidebarCollapseForTests } from './useSidebarCollapse'
import { useSidebarDrawer, __resetSidebarDrawerForTest } from '../../composables/useSidebarDrawer'

const COLLAPSE_KEY = 'nimo_photos_sidebar_collapsed'

describe('useSidebarCollapse', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetSidebarCollapseForTests()
    __resetSidebarDrawerForTest()
  })
  afterEach(() => {
    __resetSidebarCollapseForTests()
    __resetSidebarDrawerForTest()
  })

  it('defaults to false (expanded) when nothing is stored', () => {
    const { collapsed } = useSidebarCollapse()
    expect(collapsed.value).toBe(false)
  })

  it("reads '1' from localStorage as collapsed=true on first use", () => {
    localStorage.setItem(COLLAPSE_KEY, '1')
    const { collapsed } = useSidebarCollapse()
    expect(collapsed.value).toBe(true)
  })

  it('any non-"1" stored value reads as collapsed=false', () => {
    localStorage.setItem(COLLAPSE_KEY, '0')
    const { collapsed } = useSidebarCollapse()
    expect(collapsed.value).toBe(false)
  })

  it('toggle() on desktop (isNarrow=false) flips collapsed and persists', async () => {
    const drawer = useSidebarDrawer()
    drawer.isNarrow.value = false
    const { collapsed, toggle } = useSidebarCollapse()
    expect(collapsed.value).toBe(false)
    toggle()
    await nextTick()
    expect(collapsed.value).toBe(true)
    expect(localStorage.getItem(COLLAPSE_KEY)).toBe('1')
    toggle()
    await nextTick()
    expect(collapsed.value).toBe(false)
    expect(localStorage.getItem(COLLAPSE_KEY)).toBe('0')
  })

  it('toggle() on narrow viewport (isNarrow=true) delegates to the sidebar drawer instead of flipping collapsed', () => {
    const drawer = useSidebarDrawer()
    drawer.isNarrow.value = true
    const { collapsed, toggle } = useSidebarCollapse()
    expect(drawer.open.value).toBe(false)
    toggle()
    expect(drawer.open.value).toBe(true)
    expect(collapsed.value).toBe(false)
  })

  it('two consumers share one live collapsed instance (module-level singleton — cross-view sync)', () => {
    const a = useSidebarCollapse()
    const b = useSidebarCollapse()
    expect(a.collapsed).toBe(b.collapsed)
    a.toggle()
    expect(b.collapsed.value).toBe(true)
  })

  it('__resetSidebarCollapseForTests() re-reads localStorage on next use', () => {
    const a = useSidebarCollapse()
    a.toggle()
    expect(a.collapsed.value).toBe(true)
    __resetSidebarCollapseForTests()
    localStorage.setItem(COLLAPSE_KEY, '0')
    const b = useSidebarCollapse()
    expect(b.collapsed.value).toBe(false)
  })
})
