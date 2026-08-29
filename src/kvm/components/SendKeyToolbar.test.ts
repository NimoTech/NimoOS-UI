import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SendKeyToolbar from './SendKeyToolbar.vue'
import { i18n } from '../../i18n'

// Floating toolbar (modifier keys/Tab/Esc/Ctrl+Alt+Del/fullscreen). Visually 1:1 with Vue2
// components/KVM/KVMFullPage.vue `.sendkey-toolbar` template (:195-223, verified 2026-08-02).
// This component only handles rendering + emit; hover show/hide rules and fullscreen state itself belong to KvmPage.vue (see comments there).

const MODS = { ctrl: false, alt: false, shift: false, win: false }
const mk = (p: Record<string, unknown> = {}) =>
  mount(SendKeyToolbar, { props: { modifiers: MODS, isFullscreen: false, ...p }, global: { plugins: [i18n] } })

describe('SendKeyToolbar', () => {
  it('Renders 8 buttons: four modifier keys + Tab + Esc + Ctrl+Alt+Del + fullscreen', () => {
    expect(mk().findAll('.sendkey-btn')).toHaveLength(8)
  })
  it('Clicking Ctrl emits toggle("ctrl")', async () => {
    const w = mk()
    await w.findAll('.sendkey-btn')[0].trigger('click')
    expect(w.emitted('toggle')![0]).toEqual(['ctrl'])
  })
  it('When modifier key is pressed, button gets active class', () => {
    expect(mk({ modifiers: { ...MODS, alt: true } }).findAll('.sendkey-btn')[1].classes()).toContain('active')
  })
  it('Tab / Esc emit key with correct keysym', async () => {
    const w = mk()
    const btns = w.findAll('.sendkey-btn')
    await btns[4].trigger('click'); expect(w.emitted('key')![0]).toEqual([0xff09])
    await btns[5].trigger('click'); expect(w.emitted('key')![1]).toEqual([0xff1b])
  })
  it('Ctrl+Alt+Del emits ctrlAltDel', async () => {
    const w = mk()
    await w.findAll('.sendkey-btn')[6].trigger('click')
    expect(w.emitted('ctrlAltDel')).toHaveLength(1)
  })
  it('Fullscreen button emits fullscreen, icon toggles based on isFullscreen', async () => {
    const w = mk()
    await w.findAll('.sendkey-btn')[7].trigger('click')
    expect(w.emitted('fullscreen')).toHaveLength(1)
    expect(mk({ isFullscreen: true }).get('.sendkey-btn--fullscreen img').attributes('alt'))
      .not.toBe(mk({ isFullscreen: false }).get('.sendkey-btn--fullscreen img').attributes('alt'))
  })
  it('Every button has title (hover tooltip), Win and icon buttons also have aria-label', () => {
    const w = mk()
    w.findAll('.sendkey-btn').forEach((b) => expect(b.attributes('title')).toBeTruthy())
    expect(w.findAll('.sendkey-btn')[3].attributes('aria-label')).toBeTruthy()
    expect(w.get('.sendkey-btn--fullscreen').attributes('aria-label')).toBeTruthy()
  })
})
