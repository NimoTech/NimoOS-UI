import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, nextTick } from 'vue'

// Fake Sortable.create — capture calls/options and return a spy-able fake
// instance so we can assert lifecycle (destroy called on refresh/destroy)
// without touching a real DOM drag implementation.
const mockCreate = vi.fn()
vi.mock('sortablejs', () => ({
  default: { create: (...args: unknown[]) => mockCreate(...args) },
}))

import { useAlbumDragSort } from '../useAlbumDragSort'

type FakeOptions = {
  animation: number
  ghostClass: string
  forceFallback: boolean
  fallbackOnBody: boolean
  onStart: () => void
  onEnd: () => void
}

describe('useAlbumDragSort', () => {
  let destroyMocks: Array<ReturnType<typeof vi.fn>>
  let lastOptions: FakeOptions | undefined

  beforeEach(() => {
    mockCreate.mockReset()
    destroyMocks = []
    lastOptions = undefined
    mockCreate.mockImplementation((_el: HTMLElement, options: FakeOptions) => {
      lastOptions = options
      const destroy = vi.fn()
      destroyMocks.push(destroy)
      return { destroy }
    })
  })

  function makeContainer(): HTMLElement {
    const el = document.createElement('div')
    // Deliberately out of alphabetical order, plus one tile missing
    // data-id and one non-.tile child — both must be excluded from the
    // read-out order (brief: ".tile[data-id]", filter null).
    el.innerHTML = `
      <div class="tile" data-id="b"></div>
      <div class="tile"></div>
      <div class="not-a-tile" data-id="z"></div>
      <div class="tile" data-id="c"></div>
      <div class="tile" data-id="a"></div>
    `
    return el
  }

  it('enabled()===false 时 refresh() 不创建实例', () => {
    const container = ref<HTMLElement | null>(makeContainer())
    const s = useAlbumDragSort({ container, enabled: () => false, onOrder: vi.fn() })
    s.refresh()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('enabled()===true 且容器存在时创建一次,options 精确等于五项(不多不少)', () => {
    const container = ref<HTMLElement | null>(makeContainer())
    const s = useAlbumDragSort({ container, enabled: () => true, onOrder: vi.fn() })
    s.refresh()

    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockCreate.mock.calls[0][0]).toBe(container.value)

    const opts = mockCreate.mock.calls[0][1] as Record<string, unknown>
    expect(Object.keys(opts).sort()).toEqual(
      ['animation', 'fallbackOnBody', 'forceFallback', 'ghostClass', 'onEnd', 'onStart'].sort(),
    )
    expect(opts.animation).toBe(150)
    expect(opts.ghostClass).toBe('tile-drag-ghost')
    expect(opts.forceFallback).toBe(true)
    expect(opts.fallbackOnBody).toBe(true)
    expect(typeof opts.onStart).toBe('function')
    expect(typeof opts.onEnd).toBe('function')
  })

  it('连续两次 refresh():前一个实例的 destroy() 恰好被调用一次(不泄漏)', () => {
    const container = ref<HTMLElement | null>(makeContainer())
    const s = useAlbumDragSort({ container, enabled: () => true, onOrder: vi.fn() })
    s.refresh()
    s.refresh()
    expect(mockCreate).toHaveBeenCalledTimes(2)
    expect(destroyMocks[0]).toHaveBeenCalledTimes(1)
    // Second (current) instance must still be alive — not destroyed yet.
    expect(destroyMocks[1]).not.toHaveBeenCalled()
  })

  it('container.value===null 时 refresh() 不抛错、不创建', () => {
    const container = ref<HTMLElement | null>(null)
    const s = useAlbumDragSort({ container, enabled: () => true, onOrder: vi.fn() })
    expect(() => s.refresh()).not.toThrow()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('destroy() 幂等:连调两次不抛,且底层 destroy 只调一次', () => {
    const container = ref<HTMLElement | null>(makeContainer())
    const s = useAlbumDragSort({ container, enabled: () => true, onOrder: vi.fn() })
    s.refresh()
    expect(() => {
      s.destroy()
      s.destroy()
    }).not.toThrow()
    expect(destroyMocks[0]).toHaveBeenCalledTimes(1)
  })

  it('onStart 置 isDragging()=true;onEnd 从 DOM 读序调 onOrder(过滤 null/非-.tile)', () => {
    const container = ref<HTMLElement | null>(makeContainer())
    const onOrder = vi.fn()
    const s = useAlbumDragSort({ container, enabled: () => true, onOrder })
    s.refresh()

    expect(s.isDragging()).toBe(false)
    lastOptions!.onStart()
    expect(s.isDragging()).toBe(true)

    lastOptions!.onEnd()
    // DOM order, not evt.oldIndex/newIndex — b/c/a matches the markup order
    // above, with the id-less tile and the non-.tile element excluded.
    expect(onOrder).toHaveBeenCalledTimes(1)
    expect(onOrder).toHaveBeenCalledWith(['b', 'c', 'a'])
  })

  it('守卫时序回归:onEnd 后、nextTick 之前 isDragging() 仍为 true;nextTick 后才变 false', async () => {
    const container = ref<HTMLElement | null>(makeContainer())
    const onOrder = vi.fn()
    const s = useAlbumDragSort({ container, enabled: () => true, onOrder })
    s.refresh()

    lastOptions!.onStart()
    lastOptions!.onEnd()

    // The guard must survive the current microtask/click — this is the
    // exact regression the Vue2 comment ("Guard the post-drop click so a
    // drag doesn't also toggle selection") protects against. If the
    // implementation flips dragging=false synchronously inside onEnd
    // instead of inside nextTick(), this assertion fails.
    expect(s.isDragging()).toBe(true)
    expect(onOrder).toHaveBeenCalled() // order callback fires before the flag clears

    await nextTick()
    expect(s.isDragging()).toBe(false)
  })

  // SP15-P1-T6: the Moments band reuses this composable instead of a second Sortable
  // wrapper. The item selector and the two class names become optional, defaulting to
  // today's hardcoded album-page values, so the album page needs no edit. Nested inside
  // this describe (rather than a sibling) so it gets makeContainer and the beforeEach's
  // mockCreate reset/implementation for free.
  describe('SP15-P1-T6: optional selector/class overrides', () => {
    it('defaults are unchanged when the new options are omitted (.tile[data-id] + tile-drag-ghost)', () => {
      // The existing cases above already cover the default path end to end; this one only
      // pins down that the defaults themselves were not touched.
      const container = ref<HTMLElement | null>(makeContainer())
      const s = useAlbumDragSort({ container, enabled: () => true, onOrder: vi.fn() })
      s.refresh()
      expect(mockCreate).toHaveBeenLastCalledWith(container.value, expect.objectContaining({ ghostClass: 'tile-drag-ghost' }))
      s.destroy()
    })

    it('passes overrides through to Sortable, and reads DOM order using the custom selector', () => {
      const container = document.createElement('div')
      container.innerHTML = '<div class="mo-card" data-id="b"></div><div class="mo-card" data-id="a"></div>'
      const el = ref<HTMLElement | null>(container)
      const onOrder = vi.fn()
      const s = useAlbumDragSort({
        container: el, enabled: () => true, onOrder,
        itemSelector: '.mo-card[data-id]', ghostClass: 'mo-drag-ghost', chosenClass: 'mo-drag-chosen',
      })
      s.refresh()
      const opts = mockCreate.mock.calls[mockCreate.mock.calls.length - 1][1] as FakeOptions & { chosenClass?: string }
      expect(opts).toMatchObject({ ghostClass: 'mo-drag-ghost', chosenClass: 'mo-drag-chosen' })
      opts.onEnd()
      expect(onOrder).toHaveBeenCalledWith(['b', 'a'])
      s.destroy()
    })
  })
})
