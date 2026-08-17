import { describe, it, expect, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useClickOutside } from './useClickOutside'

// Vue2 shell/ModelPicker.vue:52-63 — a locally-registered `click-outside`
// directive with `bind`/`unbind` hooks. Those hook names don't exist on Vue 3
// components, so ported as a composable (onMounted/onUnmounted using
// equivalent semantics: attach document `mousedown` listener while mounted,
// detach on unmount).
function makeHost(handler: () => void) {
  return defineComponent({
    setup() {
      const el = ref<HTMLElement | null>(null)
      useClickOutside(el, handler)
      return () => h('div', { ref: el }, [h('button', 'inside')])
    },
  })
}

describe('useClickOutside', () => {
  it('external mousedown triggers handler; mousedown inside element does not', async () => {
    const handler = vi.fn()
    const w = mount(makeHost(handler), { attachTo: document.body })

    await w.find('button').trigger('mousedown')
    expect(handler).not.toHaveBeenCalled()

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(handler).toHaveBeenCalledTimes(1)

    w.unmount()
  })

  it('after unmount, listener on document is removed, no longer triggers handler', () => {
    const handler = vi.fn()
    const w = mount(makeHost(handler), { attachTo: document.body })
    w.unmount()

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(handler).not.toHaveBeenCalled()
  })
})
