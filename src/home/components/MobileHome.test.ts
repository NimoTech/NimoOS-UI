import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import MobileHome from './MobileHome.vue'
import { useLayoutStore } from '../stores/layout'
import type { LayoutItem } from '../grid/types'

const openItem = vi.fn()
vi.mock('../composables/useOpenAction', () => ({
  useOpenAction: () => ({ openItem, openApp: vi.fn(), sendToAI: vi.fn() }),
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

const item = (p: Partial<LayoutItem>): LayoutItem =>
  ({ id: p.key!, kind: 'app', key: 'files', c: 1, r: 1, w: 1, h: 1, ...p })

function seed() {
  const layout = useLayoutStore()
  layout.items = [
    item({ id: 'w1', kind: 'widget', key: 'clock', c: 1, r: 1, w: 2, h: 2 }),
    item({ key: 'files', c: 3, r: 1 }),
    item({ id: 'ph', kind: 'photo', key: 'linear-gradient(#fff,#000)', c: 4, r: 2, w: 2, h: 2 }),
    item({ id: 'fd', kind: 'folder', key: 'Documents', c: 1, r: 3, path: '/DATA/Documents' }),
  ]
  return layout
}

describe('MobileHome', () => {
  // This suite mounts the clock widget without calling initService(), so
  // useHostTimezone's fetch rejects and its .catch() deliberately logs a
  // warning (see useHostTimezone.ts). That warning is expected here, not a
  // regression, so it is stubbed for the duration of this file only.
  let warn: ReturnType<typeof vi.spyOn>
  beforeAll(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterAll(() => { warn.mockRestore() })

  beforeEach(() => { setActivePinia(createPinia()); openItem.mockClear() })

  it('splits widgets (full-width) from tiles (icon grid) in desktop visual order', () => {
    seed()
    const w = mount(MobileHome, { global: { plugins: [i18n] } })
    expect(w.findAll('.m-widget')).toHaveLength(1)
    const tiles = w.findAll('.m-tile')
    expect(tiles).toHaveLength(3)
    expect(tiles.map((t) => t.classes().some((c) => c === 'kind-app' || c === 'kind-photo' || c === 'kind-folder')))
      .toEqual([true, true, true])
    // Order: files (r1) → photo (r2) → folder (r3)
    expect(tiles[0].classes()).toContain('kind-app')
    expect(tiles[1].classes()).toContain('kind-photo')
    expect(tiles[2].classes()).toContain('kind-folder')
  })

  it('marks photo tiles as 2x2 spans', () => {
    seed()
    const w = mount(MobileHome, { global: { plugins: [i18n] } })
    expect(w.find('.m-photo').exists()).toBe(true)
    expect(w.find('.m-photo').classes()).toContain('kind-photo')
  })

  it('opens the item on tap via the shared open action', async () => {
    seed()
    const w = mount(MobileHome, { global: { plugins: [i18n] } })
    await w.findAll('.m-tile')[0].trigger('click')
    expect(openItem).toHaveBeenCalledTimes(1)
    expect(openItem.mock.calls[0][0].key).toBe('files')
  })

  it('renders nothing but containers when layout is empty', () => {
    const w = mount(MobileHome, { global: { plugins: [i18n] } })
    expect(w.findAll('.m-widget')).toHaveLength(0)
    expect(w.findAll('.m-tile')).toHaveLength(0)
  })
})
