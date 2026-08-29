import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ContextMenu from './ContextMenu.vue'

describe('ui/ContextMenu', () => {
  it('renders trigger area default slot', () => {
    const w = mount(ContextMenu, { slots: { default: '<div class="trigger">row</div>' } })
    expect(w.find('.trigger').exists()).toBe(true)
  })

  // Files Time Machine Task 15: does a right-click inside the scaled
  // `.tm-fwin--active` window (`transform: scale(0.82)`, TimeMachineStage.vue) open this menu AT
  // the cursor, or offset -- the same class of bug Vue2's own ContextMenu.vue needed
  // `compensateFixedPosition` to fix (see that file's own header comment: Buefy's `append-to-body`
  // only relocates the POPUP, but still positions it off a still-nested, still-transformed
  // trigger element's `getBoundingClientRect()`, and a CSS `transform` on an ancestor establishes
  // a new containing block for that trigger's own `position: fixed` -- the exact mismatch that
  // needed compensating).
  //
  // Traced through reka-ui@2.10.1's own source (node_modules/.../ContextMenu/ContextMenuTrigger.js,
  // MenuPortal.js, Teleport.js) rather than guessed:
  //  1. `ContextMenuTrigger`'s `handleOpen` reads the native `contextmenu` event's own
  //     `event.clientX`/`event.clientY` -- viewport coordinates a CSS transform on any ancestor
  //     never touches -- into a pure-JS "virtual element" whose `getBoundingClientRect()` just
  //     echoes those two numbers back. This is NOT `someDomNode.getBoundingClientRect()` (which
  //     WOULD reflect an ancestor's scale/containing-block quirks) -- it never reads any live DOM
  //     box at all.
  //  2. `ContextMenuPortal` -> `MenuPortal` -> reka-ui's own `Teleport` component teleports the
  //     actual popup content to `document.body` by default (`to: props.to ?? ... ?? 'body'`) --
  //     an ACTUAL DOM reparent (Vue's native `<Teleport>`), not Buefy's `append-to-body` division
  //     between "the popup DOM moves" and "the position math still reads the old trigger's rect".
  //     Since `<body>` itself carries no transform, its child's `position: fixed` computes against
  //     the true viewport with no containing-block reinterpretation.
  //  3. `PopperContent` positions using `positionStrategy: 'fixed'` computed algebraically from the
  //     virtual anchor above -- never from a transformed ancestor's box.
  //  Conclusion: no compensation is needed, and none was ported (`compensateMenuPosition` does not
  //  exist in this codebase; grep confirms) -- the mechanism that made Vue2's bug possible (a
  //  transformed ancestor's containing-block reinterpreting a nested trigger's own `position:
  //  fixed`) simply never applies here, on either side (anchor math or popup placement).
  //
  // jsdom does not implement real CSS transform/layout math, so this cannot prove pixel-perfect
  // production geometry by itself -- it CAN prove the concrete claim above: the resulting position
  // is a pure function of the click's own (clientX, clientY), with no dependency on any ancestor
  // element's box at all. If it depended on an ancestor's (possibly transformed) rect the way
  // Vue2's trigger did, wrapping the SAME trigger in a scaled ancestor could only leave the result
  // unchanged by coincidence (jsdom's own rects are always zeroed either way); what this test adds
  // beyond that reasoning is a concrete regression guard on the wiring itself, valid regardless of
  // jsdom's layout limitations: this component never introduces its own transform-aware anchor
  // logic that Vue2's compensation ported here would then need to feed.
  describe('P3: click-anchored position is independent of an ancestor CSS transform', () => {
    let hosts: HTMLElement[] = []
    afterEach(() => {
      for (const h of hosts) h.remove()
      hosts = []
      document.body.innerHTML = ''
    })

    // The load-bearing geometry lives on floating-ui's own wrapper element
    // (`[data-reka-popper-content-wrapper]`, a DIRECT child of `document.body`, sibling to
    // `.ui-ctx-content`) -- confirmed by inspecting the real rendered DOM: it carries
    // `position: fixed; ...; transform: translate(<x>px, <y>px)` computed from the click point;
    // `.ui-ctx-content` itself only carries static `--reka-context-menu-content-*` CSS custom
    // property declarations, never position values. Asserting against the wrapper (not the
    // content element) is what makes this test non-vacuous.
    async function openMenuUnderTransform(scaled: boolean) {
      const host = document.createElement('div')
      if (scaled) host.style.transform = 'scale(0.82)' // TM_WINDOW_SCALE (timeMachineMath.ts)
      document.body.appendChild(host)
      hosts.push(host)
      const w = mount(ContextMenu, {
        attachTo: host,
        slots: { default: '<div class="trigger">row</div>', menu: '<div class="item">Item</div>' },
      })
      await w.find('.trigger').trigger('contextmenu', { clientX: 400, clientY: 300 })
      await flushPromises()
      const content = document.body.querySelector('.ui-ctx-content') as HTMLElement | null
      expect(content, 'menu content did not open/teleport to body').toBeTruthy()
      const wrapper = content!.closest('[data-reka-popper-content-wrapper]') as HTMLElement | null
      expect(wrapper, 'popper positioning wrapper not found').toBeTruthy()
      return { w, host, content: content!, wrapper: wrapper! }
    }

    it('opens the menu at all (trigger -> Portal -> body wiring works end to end)', async () => {
      const { content } = await openMenuUnderTransform(false)
      expect(content.textContent).toContain('Item')
    })

    it('the popup Teleports to document.body, escaping the transformed ancestor entirely (a true DOM reparent, not merely a visual offset)', async () => {
      const { wrapper, host } = await openMenuUnderTransform(true)
      expect(wrapper.parentElement).toBe(document.body)
      expect(host.contains(wrapper)).toBe(false)
    })

    it('the position wrapper anchors on the raw click point (clientX/clientY), off by exactly the configured 2px side-offset', async () => {
      const { wrapper } = await openMenuUnderTransform(false)
      // side-offset: 2 (ContextMenu.vue's own ContextMenuContent, "right"/2px in reka-ui's
      // ContextMenuContent.js) -- side flips to "left" when there's more room there, so the
      // observed offset can land on either axis; either way it must be a SMALL, fixed constant
      // away from the exact click point (400, 300), not a scaled/mis-anchored value.
      const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(wrapper.style.transform)
      expect(m, `no translate() in wrapper transform: ${wrapper.style.transform}`).toBeTruthy()
      const [, x, y] = m!
      expect(Math.abs(Number(x) - 400)).toBeLessThanOrEqual(2)
      expect(Math.abs(Number(y) - 300)).toBeLessThanOrEqual(2)
    })

    it('the SAME click point yields the SAME resulting wrapper geometry whether or not an ancestor is transformed', async () => {
      const plain = await openMenuUnderTransform(false)
      const plainStyle = plain.wrapper.getAttribute('style')
      plain.w.unmount()
      document.body.innerHTML = ''

      const scaled = await openMenuUnderTransform(true)
      const scaledStyle = scaled.wrapper.getAttribute('style')

      expect(scaledStyle).toBe(plainStyle)
    })
  })
})
