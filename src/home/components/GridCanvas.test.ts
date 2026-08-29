import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useLayoutStore } from '../stores/layout'
import GridCanvas from './GridCanvas.vue'

describe('GridCanvas', () => {
  // This suite mounts the clock widget without calling initService(), so
  // useHostTimezone's fetch rejects and its .catch() deliberately logs a
  // warning (see useHostTimezone.ts). That warning is expected here, not a
  // regression, so it is stubbed for the duration of this file only.
  let warn: ReturnType<typeof vi.spyOn>
  beforeAll(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterAll(() => { warn.mockRestore() })

  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })

  it('renders one positioned GridItem per layout item', async () => {
    const s = useLayoutStore()
    s.replaceAll([
      { kind: 'widget', key: 'clock', c: 1, r: 1, w: 2, h: 2 },
      { kind: 'app', key: 'files', c: 11, r: 1, w: 1, h: 1 },
    ])
    const w = mount(GridCanvas)
    const cells = w.findAll('[data-id]')
    expect(cells).toHaveLength(2)
    const clock = w.get('[data-kind="widget"]')
    // grid-column start column = c
    expect(clock.attributes('style')).toContain('grid-column: 1 / span 2')
    expect(clock.attributes('style')).toContain('grid-row: 1 / span 2')
    expect(clock.text()).toContain('时间')
  })
})
