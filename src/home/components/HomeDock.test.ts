import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useAppsStore } from '../stores/apps'
import { __resetDockForTest } from '../composables/useDock'
import HomeDock from './HomeDock.vue'

// P8 cutover:dock 的 files 图标改应用内 router.push,需 mock 路由单例(vi.mock 会被提升到 import 前)。
vi.mock('../../router', () => ({ router: { push: vi.fn() } }))
import { router } from '../../router'

beforeEach(() => {
  setActivePinia(createPinia()); localStorage.clear(); __resetDockForTest()
  Object.defineProperty(window, 'location', { configurable: true, value: { hostname: 'h', set href(_v: string) {}, get href() { return '' } } })
  vi.mocked(router.push).mockClear()
})

describe('HomeDock', () => {
  it('renders favorite dock apps with labels', () => {
    useAppsStore()
    const w = mount(HomeDock)
    const labels = w.findAll('.dock-app').map((b) => b.text())
    expect(labels.join(' ')).toContain('文件')
    expect(w.findAll('.dock-app').length).toBeGreaterThanOrEqual(5)
  })
  it('clicking allApps toggles expanded (more zone shows settings)', async () => {
    useAppsStore()
    const w = mount(HomeDock)
    await w.get('.dock-toggle').trigger('click')
    expect(w.text()).toContain('设置') // settings 在 more 区
  })

  // ── 展开态点击直接打开(spec 2026-07-17-dock-expanded-click-open)──
  // capture 生效期间浏览器会把 click 派发给 capture 元素而不是图标按钮,
  // 所以"按下就抓指针"= 展开态点击全哑。锁死"越过拖动阈值才抓"这一不变量。
  it('expanded: pointerdown alone does NOT capture the pointer; crossing the drag threshold does', async () => {
    useAppsStore()
    const w = mount(HomeDock)
    await w.get('.dock-toggle').trigger('click')
    const nav = w.get('nav').element as HTMLElement
    const captured: number[] = []
    nav.setPointerCapture = ((id: number) => { captured.push(id) }) as never
    await w.get('.dock-app[data-app="settings"]').trigger('pointerdown', { pointerId: 7, clientX: 100, clientY: 100 })
    expect(captured.length).toBe(0) // 纯点击不被劫持
    const move = new Event('pointermove') as PointerEvent
    Object.assign(move, { pointerId: 7, clientX: 120, clientY: 100 }) // 越过 5px 阈值
    window.dispatchEvent(move)
    expect(captured).toEqual([7]) // 真拖动才接管
    const up = new Event('pointerup') as PointerEvent
    Object.assign(up, { pointerId: 7, clientX: 120, clientY: 100 })
    window.dispatchEvent(up)
  })

  // SP9-P8 cutover:settings 从整页跳 /#/legacy 改成应用内 router.push('/settings')。
  // 断言方式与 useOpenAction.test.ts 同一套(那里是单元级,这里是 dock 点击链路级)。
  it('expanded: clicking an app opens it and auto-collapses the dock', async () => {
    useAppsStore()
    const hrefs: string[] = []
    Object.defineProperty(window, 'location', { configurable: true, value: { hostname: 'h', set href(v: string) { hrefs.push(v) }, get href() { return '' } } })
    const w = mount(HomeDock)
    await w.get('.dock-toggle').trigger('click')
    expect(w.get('.dock-toggle').attributes('aria-expanded')).toBe('true')
    await w.get('.dock-app[data-app="settings"]').trigger('click')
    expect(router.push).toHaveBeenCalledWith('/settings')
    expect(hrefs.length).toBe(0)
    expect(w.get('.dock-toggle').attributes('aria-expanded')).toBe('false')
  })

  // 回退可逆也要在 dock 这条链路上验一次:flag 命中时仍整页跳老桌面,且 dock 照样收起。
  it('expanded: 回退 flag strangler:disabled:/settings==1 时 settings 仍整页跳 /#/legacy', async () => {
    useAppsStore()
    localStorage.setItem('strangler:disabled:/settings', '1')
    const hrefs: string[] = []
    Object.defineProperty(window, 'location', { configurable: true, value: { hostname: 'h', set href(v: string) { hrefs.push(v) }, get href() { return '' } } })
    const w = mount(HomeDock)
    await w.get('.dock-toggle').trigger('click')
    await w.get('.dock-app[data-app="settings"]').trigger('click')
    expect(hrefs[0]).toBe('/#/legacy')
    expect(router.push).not.toHaveBeenCalled()
    expect(w.get('.dock-toggle').attributes('aria-expanded')).toBe('false')
  })

  it('collapsed: clicking a fav app opens it without toggling expanded', async () => {
    useAppsStore()
    const hrefs: string[] = []
    Object.defineProperty(window, 'location', { configurable: true, value: { hostname: 'h', set href(v: string) { hrefs.push(v) }, get href() { return '' } } })
    const w = mount(HomeDock)
    await w.get('.dock-app[data-app="files"]').trigger('click')
    expect(router.push).toHaveBeenCalledWith('/files')
    expect(hrefs.length).toBe(0)
    expect(w.get('.dock-toggle').attributes('aria-expanded')).toBe('false')
  })
})

// ── 手机端:固定 5 位 + 全部应用抽屉(spec 2026-07-18-mobile-home-launcher 增量)──
describe('HomeDock mobile (≤720px)', () => {
  const stubMobile = () =>
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {},
    }))
  afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = '' })

  it('caps the dock at 5 slots (4 favs + all-apps) and drops the more-zone', () => {
    stubMobile(); useAppsStore()
    const w = mount(HomeDock)
    expect(w.findAll('.dock-app')).toHaveLength(5)
    expect(w.find('.dock-more').exists()).toBe(false)
    expect(w.find('.dock-sep').exists()).toBe(false)
    w.unmount()
  })

  it('tapping all-apps opens a multi-row sheet with every app; tapping one closes it', async () => {
    stubMobile(); useAppsStore()
    const w = mount(HomeDock)
    await w.get('.dock-toggle').trigger('click')
    const sheet = document.body.querySelector('.allapps-sheet')
    expect(sheet).not.toBeNull()
    // 全量 = fav(5) + more(≥1,含设置),多于 dock 条上的 4+1
    expect(sheet!.querySelectorAll('.dock-app').length).toBeGreaterThanOrEqual(6)
    ;(sheet!.querySelector('.dock-app') as HTMLElement).click()
    await w.vm.$nextTick()
    expect(document.body.querySelector('.allapps-sheet')).toBeNull()
    w.unmount()
  })

  it('desktop keeps the horizontal expand behavior (no sheet)', async () => {
    useAppsStore() // 无 matchMedia stub → isMobile=false
    const w = mount(HomeDock)
    await w.get('.dock-toggle').trigger('click')
    expect(document.body.querySelector('.allapps-sheet')).toBeNull()
    expect(w.find('.dock-more').exists()).toBe(true)
    w.unmount()
  })
})
