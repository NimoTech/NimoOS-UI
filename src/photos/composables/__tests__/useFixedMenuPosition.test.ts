import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref, nextTick, defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useFixedMenuPosition } from '../useFixedMenuPosition'

// Mounting a host component is what gives onBeforeUnmount an owner instance; calling the
// composable bare would warn and silently skip the teardown path this suite must cover.
function mountHost(rect: Partial<DOMRect>) {
  const open = ref(false)
  const btnRef = ref<HTMLElement | null>(null)
  let menuStyle!: ReturnType<typeof useFixedMenuPosition>['menuStyle']
  const Host = defineComponent({
    setup() {
      const el = document.createElement('button')
      el.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}), ...rect }) as DOMRect
      btnRef.value = el
      menuStyle = useFixedMenuPosition(open, btnRef).menuStyle
      return () => h('div')
    },
  })
  const wrapper = mount(Host)
  return { open, wrapper, get style() { return menuStyle.value } }
}

afterEach(() => { vi.restoreAllMocks() })

describe('useFixedMenuPosition', () => {
  it('opens downward and right-aligns to the button when there is room below', async () => {
    window.innerHeight = 1000
    window.innerWidth = 1200
    const h1 = mountHost({ top: 100, bottom: 130, right: 900 })
    h1.open.value = true
    await nextTick()
    expect(h1.style.position).toBe('fixed')
    expect(h1.style.top).toBe('136px')          // rect.bottom + 6
    expect(h1.style.right).toBe('300px')        // innerWidth - rect.right
    expect(h1.style.bottom).toBeUndefined()
    expect(h1.style.zIndex).toBe(260)
  })

  it('flips upward when the space below is smaller than the estimate and the space above is larger', async () => {
    window.innerHeight = 1000
    window.innerWidth = 1200
    // spaceBelow = 1000 - 900 = 100 < 340, and rect.top (870) > 100 -> flip
    const h1 = mountHost({ top: 870, bottom: 900, right: 900 })
    h1.open.value = true
    await nextTick()
    expect(h1.style.bottom).toBe('136px')        // innerHeight - rect.top + 6
    expect(h1.style.top).toBeUndefined()
  })

  it('does not flip when the space below is short but the space above is even shorter', async () => {
    window.innerHeight = 400
    window.innerWidth = 1200
    // spaceBelow = 400 - 300 = 100 < 340, but rect.top (270) > 100 -> flips.
    // Use a genuinely smaller top to prove the second half of the condition is load-bearing.
    const h1 = mountHost({ top: 50, bottom: 300, right: 900 })
    h1.open.value = true
    await nextTick()
    expect(h1.style.top).toBe('306px')
    expect(h1.style.bottom).toBeUndefined()
  })

  it('closes the menu on a scroll anywhere in the page, including inside a scroll container', async () => {
    const h1 = mountHost({ top: 100, bottom: 130, right: 900 })
    h1.open.value = true
    await nextTick()
    // capture-phase listener: dispatching on an inner node must still reach it
    const inner = document.createElement('div')
    document.body.appendChild(inner)
    inner.dispatchEvent(new Event('scroll', { bubbles: false }))
    await nextTick()
    expect(h1.open.value).toBe(false)
  })

  it('closes the menu on resize', async () => {
    const h1 = mountHost({ top: 100, bottom: 130, right: 900 })
    h1.open.value = true
    await nextTick()
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(h1.open.value).toBe(false)
  })

  it('removes its listeners when the menu closes, so a later scroll cannot touch state', async () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const h1 = mountHost({ top: 100, bottom: 130, right: 900 })
    h1.open.value = true
    await nextTick()
    h1.open.value = false
    await nextTick()
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function), true)
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  it('removes its listeners on unmount while still open', async () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const h1 = mountHost({ top: 100, bottom: 130, right: 900 })
    h1.open.value = true
    await nextTick()
    h1.wrapper.unmount()
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function), true)
  })

  it('is a no-op when the trigger ref is null', async () => {
    const open = ref(false)
    const btnRef = ref<HTMLElement | null>(null)
    let style!: ReturnType<typeof useFixedMenuPosition>['menuStyle']
    const Host = defineComponent({
      setup() { style = useFixedMenuPosition(open, btnRef).menuStyle; return () => h('div') },
    })
    mount(Host)
    open.value = true
    await nextTick()
    expect(style.value).toEqual({})
  })
})
