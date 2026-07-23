import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
vi.mock('@nimotech/nimoos-service', () => ({ service: { photos: { recordView: vi.fn(() => Promise.resolve()) } } }))
import { service } from '@nimotech/nimoos-service'
import { useLightbox } from '../useLightbox'
const P = (id: string, extra: Record<string, unknown> = {}) => ({ id, isVideo: false, ...extra }) as any

describe('useLightbox 开合/翻页', () => {
  let back: any, push: any
  beforeEach(() => {
    useLightbox().__resetForTest()
    back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    push = vi.spyOn(window.history, 'pushState')
  })
  afterEach(() => vi.restoreAllMocks())

  it('openAt 打开、定位当前项、pushState 一次、recordView', () => {
    const lb = useLightbox()
    lb.openAt(P('b'), [P('a'), P('b'), P('c')])
    expect(lb.open.value).toBe(true)
    expect(lb.index.value).toBe(1)
    expect(lb.current.value?.id).toBe('b')
    expect(push).toHaveBeenCalledTimes(1)
    expect(service.photos.recordView).toHaveBeenCalledWith('b')
  })
  it('list 为空退化为单项', () => {
    const lb = useLightbox(); lb.openAt(P('x'), [])
    expect(lb.list.value.map((p) => p.id)).toEqual(['x'])
  })
  it('prev/next 边界钳制,不再 pushState', () => {
    const lb = useLightbox(); lb.openAt(P('a'), [P('a'), P('b')])
    push.mockClear()
    lb.prev(); expect(lb.index.value).toBe(0) // 已在头,不动
    lb.next(); expect(lb.index.value).toBe(1)
    lb.next(); expect(lb.index.value).toBe(1) // 已在尾
    expect(push).not.toHaveBeenCalled()
  })
  it('close 复位并 history.back 一次', () => {
    const lb = useLightbox(); lb.openAt(P('a'), [P('a')])
    lb.close()
    expect(lb.open.value).toBe(false)
    expect(back).toHaveBeenCalledTimes(1)
  })
  it('popstate(返回键)只关灯箱,不调 history.back', () => {
    const lb = useLightbox(); lb.openAt(P('a'), [P('a')])
    back.mockClear()
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(lb.open.value).toBe(false)
    expect(back).not.toHaveBeenCalled()
  })
  it('视频 startMs 仅在 isVideo && >0 时保留', () => {
    const lb = useLightbox()
    lb.openAt(P('v', { isVideo: true }), [], 4200); expect(lb.startMs.value).toBe(4200)
    lb.__resetForTest(); lb.openAt(P('p'), [], 4200); expect(lb.startMs.value).toBe(0)
  })
  it('query trim 存入 searchQuery', () => {
    const lb = useLightbox(); lb.openAt(P('a'), [], 0, '  hello  ')
    expect(lb.searchQuery.value).toBe('hello')
  })

  describe('goTo 跳转', () => {
    it('范围内跳转成功:goTo(2) 三项列表 → index=2,current 是第三项', () => {
      const lb = useLightbox()
      lb.openAt(P('a'), [P('a'), P('b'), P('c')])
      push.mockClear()
      lb.goTo(2)
      expect(lb.index.value).toBe(2)
      expect(lb.current.value?.id).toBe('c')
      expect(push).not.toHaveBeenCalled()
    })
    it('越界下 goTo(-1) → index 不变', () => {
      const lb = useLightbox()
      lb.openAt(P('a'), [P('a'), P('b')])
      push.mockClear()
      lb.goTo(-1)
      expect(lb.index.value).toBe(0)
      expect(push).not.toHaveBeenCalled()
    })
    it('越界上 goTo(99) → index 不变', () => {
      const lb = useLightbox()
      lb.openAt(P('a'), [P('a'), P('b'), P('c')])
      push.mockClear()
      lb.goTo(99)
      expect(lb.index.value).toBe(0) // 仍在 openAt 后的位置
      expect(push).not.toHaveBeenCalled()
    })
  })
})
