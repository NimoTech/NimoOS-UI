// Task 10 (SP7-P5 People): PersonHero.vue — People detail page hero section. Pure display + emit, does not touch store,
// only mocks two URL builders from @nimotech/nimoos-service (following the existing mock in PersonAvatar.test.ts).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'

const svc = vi.hoisted(() => ({
  photos: {
    thumbnailUrl: vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`),
    personFaceThumbnailUrl: vi.fn((id: string | number, ver?: string | number | null) =>
      ver ? `mock://face/${id}?v=${ver}` : `mock://face/${id}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PersonHero from '../PersonHero.vue'
// Final review Important 5 style assertion: jsdom does not compute cascading styles and cannot read the actual clipping behavior of overflow,
// so we can only do structural assertions on the raw <style> text (following precedent from color-guard.test.ts / PersonAssetGrid.test.ts).
import personHeroRaw from '../PersonHero.vue?raw'
import type { Person } from '../../util/peopleView'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function person(overrides: Partial<Person> = {}): Person {
  return {
    id: 'p1',
    name: 'Sara',
    confidence: 0.9,
    count: 12,
    favorite: false,
    relation: '',
    coverFaceId: null,
    heroAssetId: null,
    firstSeen: null,
    lastSeen: null,
    placesCount: 0,
    ...overrides,
  }
}

const mounted: VueWrapper[] = []
function mountHero(props: { person: Person; relationCount: number; placesCount: number }, i18n = makeI18n()) {
  const w = mount(PersonHero, {
    props,
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
  mounted.push(w)
  return w
}

beforeEach(() => {
  document.body.innerHTML = ''
  svc.photos.thumbnailUrl.mockClear()
  svc.photos.personFaceThumbnailUrl.mockClear()
})
afterEach(() => {
  for (const w of mounted.splice(0)) w.unmount()
})

describe('PersonHero.vue — Background layer three-way', () => {
  it('Has heroAssetId → background uses thumbnailUrl(heroAssetId, "large")', () => {
    const w = mountHero({ person: person({ heroAssetId: 'asset9', coverFaceId: 'face1' }), relationCount: 0, placesCount: 0 })
    expect(svc.photos.thumbnailUrl).toHaveBeenCalledWith('asset9', 'large')
    const bg = w.get('[data-test="hero-bg"]')
    expect(bg.attributes('style') || '').toContain('mock://thumb/asset9/large')
    expect(w.find('[data-test="hero-root"]').attributes('data-fallback')).toBe('false')
  })

  it('No heroAssetId but has coverFaceId → background uses personFaceThumbnailUrl', () => {
    const w = mountHero({ person: person({ coverFaceId: 'face1' }), relationCount: 0, placesCount: 0 })
    expect(svc.photos.personFaceThumbnailUrl).toHaveBeenCalledWith('p1', 'face1')
    const bg = w.get('[data-test="hero-bg"]')
    expect(bg.attributes('style') || '').toContain('mock://face/p1?v=face1')
    expect(w.find('[data-test="hero-root"]').attributes('data-fallback')).toBe('false')
  })

  it('Neither exists → data-fallback=true, use gradient fallback class instead of background image', () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    expect(w.find('[data-test="hero-root"]').attributes('data-fallback')).toBe('true')
    const bg = w.get('[data-test="hero-bg"]')
    expect(bg.classes()).toContain('is-fallback')
    // No background image URL — style attribute should not contain background-image
    expect(bg.attributes('style') || '').not.toContain('background-image')
    // Fallback mode does not render darkening overlay (ref Vue2 :1424–1426)
    expect(w.find('[data-test="hero-scrim"]').exists()).toBe(false)
  })
})

describe('PersonHero.vue — Statistics', () => {
  it('All four stat numbers are correct', () => {
    const w = mountHero({ person: person({ count: 1234 }), relationCount: 7, placesCount: 3 })
    expect(w.get('[data-test="hero-stat-photos"] .v').text()).toBe('1,234')
    expect(w.get('[data-test="hero-stat-places"] .v').text()).toBe('3')
    expect(w.get('[data-test="hero-stat-appears"] .v').text()).toBe('7')
  })

  it('When count=0, display 0 (not empty string)', () => {
    const w = mountHero({ person: person({ count: 0 }), relationCount: 0, placesCount: 0 })
    expect(w.get('[data-test="hero-stat-photos"] .v').text()).toBe('0')
  })

  it('When firstSeen is null → year and month are both empty, not NaN/Invalid Date', () => {
    const w = mountHero({ person: person({ firstSeen: null }), relationCount: 0, placesCount: 0 })
    const text = w.get('[data-test="hero-stat-first-seen"] .v').text()
    expect(text).toBe('')
    expect(text).not.toContain('NaN')
    expect(text).not.toContain('Invalid')
  })

  it('When firstSeen is unparseable string → also empty, not Invalid Date', () => {
    const w = mountHero({ person: person({ firstSeen: 'not-a-date' }), relationCount: 0, placesCount: 0 })
    const text = w.get('[data-test="hero-stat-first-seen"] .v').text()
    expect(text).not.toContain('Invalid')
    expect(text).not.toContain('NaN')
  })

  it('When firstSeen is valid → year + localized short month (under zh_cn locale, do not force-append English period)', () => {
    const w = mountHero({ person: person({ firstSeen: '2020-03-15T00:00:00Z' }), relationCount: 0, placesCount: 0 })
    const text = w.get('[data-test="hero-stat-first-seen"] .v').text()
    expect(text).toContain('2020')
    expect(text).toContain('3月')
    expect(text).not.toContain('.')
  })

  it('Deviation note 9: when locale=en_us, month uses English short name (no longer hardcode Vue2\'s literal \'en\')', () => {
    const w = mountHero(
      { person: person({ firstSeen: '2020-03-15T00:00:00Z' }), relationCount: 0, placesCount: 0 },
      makeI18n('en_us'),
    )
    const text = w.get('[data-test="hero-stat-first-seen"] .v').text()
    expect(text).toContain('2020')
    expect(text).toContain('Mar')
  })
})

describe('PersonHero.vue — Simple click emit', () => {
  it('Click back → emit back', async () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-back"]').trigger('click')
    expect(w.emitted('back')).toHaveLength(1)
  })

  it('Click favorite star → emit toggle-fav', async () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-fav"]').trigger('click')
    expect(w.emitted('toggle-fav')).toHaveLength(1)
  })

  it('Click create album → emit make-album', async () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-make-album"]').trigger('click')
    expect(w.emitted('make-album')).toHaveLength(1)
  })

  it('Click background → emit open-hero-picker', async () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-background"]').trigger('click')
    expect(w.emitted('open-hero-picker')).toHaveLength(1)
  })

  // Final review Minor 7: hero back button copy is t('photosPeople') ("People"), per Vue2 :6 $t('People');
  // photosPersonBack ("Back to People") is the copy for the back button in the **person not found** empty state, two different strings.
  it("Back button text/aria both use t('photosPeople') (not photosPersonBack)", () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    const back = w.get('[data-test="hero-back"]')
    expect(back.attributes('aria-label')).toBe(zh.photosPeople)
    expect(back.text()).toBe(zh.photosPeople)
  })

  // Final review Minor 6/7: hero must not show the three long copy strings from "dialog title".
  it("Edit menu two items use short verb keys, favorite title uses 'Mark as favorite'", async () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    expect(w.get('[data-test="hero-fav"]').attributes('title')).toBe(zh.photosPersonMarkFavorite)
    await w.get('[data-test="hero-edit-trigger"]').trigger('click')
    expect(w.get('[data-test="hero-edit-rename"]').text()).toBe(zh.photosPersonMenuRename)
    expect(w.get('[data-test="hero-edit-merge"]').text()).toBe(zh.photosPersonMenuMergeInto)
    // Negative: those two dialog title strings should not appear in the menu
    expect(w.get('[data-test="hero-edit-menu"]').text()).not.toContain(zh.photosPersonRename)
    expect(w.get('[data-test="hero-edit-menu"]').text()).not.toContain(zh.photosPersonMergeInto)
  })

  it("When favorited, title switches to photosUnfavorite", () => {
    const w = mountHero({ person: person({ favorite: true }), relationCount: 0, placesCount: 0 })
    expect(w.get('[data-test="hero-fav"]').attributes('title')).toBe(zh.photosUnfavorite)
  })
})

describe('PersonHero.vue — Edit menu', () => {
  it('Click trigger button opens menu, click each of three items emits corresponding event and closes menu', async () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-edit-trigger"]').trigger('click')
    expect(w.find('[data-test="hero-edit-menu"]').exists()).toBe(true)

    await w.get('[data-test="hero-edit-rename"]').trigger('click')
    expect(w.emitted('rename')).toHaveLength(1)
    expect(w.find('[data-test="hero-edit-menu"]').exists()).toBe(false)
  })

  it('Merge into another person → emit merge', async () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-edit-trigger"]').trigger('click')
    await w.get('[data-test="hero-edit-merge"]').trigger('click')
    expect(w.emitted('merge')).toHaveLength(1)
  })

  it('Delete person → emit delete', async () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-edit-trigger"]').trigger('click')
    await w.get('[data-test="hero-edit-delete"]').trigger('click')
    expect(w.emitted('delete')).toHaveLength(1)
  })
})

describe('PersonHero.vue — Relation group dropdown', () => {
  it('Four items render, current item has checkmark', async () => {
    const w = mountHero({ person: person({ relation: 'friend' }), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-relation-trigger"]').trigger('click')
    const options = w.findAll('[data-test="hero-relation-option"]')
    expect(options).toHaveLength(4)
    expect(options.map((o) => o.attributes('data-value'))).toEqual(['', 'family', 'friend', 'work'])
    const active = options.find((o) => o.attributes('data-value') === 'friend')
    expect(active?.attributes('data-active')).toBe('true')
    expect(active?.find('[data-test="hero-relation-check"]').exists()).toBe(true)
    const inactive = options.find((o) => o.attributes('data-value') === 'family')
    expect(inactive?.attributes('data-active')).toBe('false')
    expect(inactive?.find('[data-test="hero-relation-check"]').exists()).toBe(false)
  })

  it('When relation is empty string → None item has checkmark', async () => {
    const w = mountHero({ person: person({ relation: '' }), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-relation-trigger"]').trigger('click')
    const options = w.findAll('[data-test="hero-relation-option"]')
    const noneOpt = options.find((o) => o.attributes('data-value') === '')
    expect(noneOpt?.attributes('data-active')).toBe('true')
  })

  it('Click an item → emit pick-relation with correct value and close menu', async () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-relation-trigger"]').trigger('click')
    const options = w.findAll('[data-test="hero-relation-option"]')
    const workOpt = options.find((o) => o.attributes('data-value') === 'work')
    await workOpt!.trigger('click')
    expect(w.emitted('pick-relation')).toEqual([['work']])
    expect(w.find('[data-test="hero-relation-menu"]').exists()).toBe(false)
  })

  it('Click None item → emit pick-relation with empty string', async () => {
    const w = mountHero({ person: person({ relation: 'family' }), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-relation-trigger"]').trigger('click')
    const options = w.findAll('[data-test="hero-relation-option"]')
    const noneOpt = options.find((o) => o.attributes('data-value') === '')
    await noneOpt!.trigger('click')
    expect(w.emitted('pick-relation')).toEqual([['']])
  })
})

describe('PersonHero.vue — Close interaction for both menus', () => {
  it('Click elsewhere on document → both menus close', async () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-edit-trigger"]').trigger('click')
    await w.get('[data-test="hero-relation-trigger"]').trigger('click')
    expect(w.find('[data-test="hero-edit-menu"]').exists()).toBe(true)
    expect(w.find('[data-test="hero-relation-menu"]').exists()).toBe(true)

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="hero-edit-menu"]').exists()).toBe(false)
    expect(w.find('[data-test="hero-relation-menu"]').exists()).toBe(false)
  })

  it('Press Esc (dispatched at document level, bubbles:true) → both menus close', async () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-edit-trigger"]').trigger('click')
    await w.get('[data-test="hero-relation-trigger"]').trigger('click')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="hero-edit-menu"]').exists()).toBe(false)
    expect(w.find('[data-test="hero-relation-menu"]').exists()).toBe(false)
  })

  it('Click inside menu does not close (mousedown inside wrap)', async () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-edit-trigger"]').trigger('click')
    await w.get('[data-test="hero-edit-menu"]').trigger('mousedown')
    await w.vm.$nextTick()
    expect(w.find('[data-test="hero-edit-menu"]').exists()).toBe(true)
  })

  it('After unmount, document no longer has mousedown/keydown listeners from this component (compare function refs, remove in pairs)', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    const addedMousedown = addSpy.mock.calls.find((c) => c[0] === 'mousedown') as [string, EventListener] | undefined
    const addedKeydown = addSpy.mock.calls.find((c) => c[0] === 'keydown') as [string, EventListener] | undefined
    expect(addedMousedown).toBeDefined()
    expect(addedKeydown).toBeDefined()

    const removeSpy = vi.spyOn(document, 'removeEventListener')
    w.unmount()
    // Remove from mounted array to avoid duplicate unmount in afterEach
    const idx = mounted.indexOf(w)
    if (idx >= 0) mounted.splice(idx, 1)

    expect(removeSpy).toHaveBeenCalledWith('mousedown', addedMousedown![1])
    expect(removeSpy).toHaveBeenCalledWith('keydown', addedKeydown![1])
    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})

// — Final review Important 5: two dropdowns must not be clipped by ancestor overflow —
describe('PersonHero.vue — Dropdown clipping boundary', () => {
  // First strip CSS comments: the comments in these rules happen to explain the reasoning behind `overflow: hidden`,
  // and without stripping we'd match comment text as declarations.
  const style = (/<style[^>]*>([\s\S]*?)<\/style>/i.exec(personHeroRaw)?.[1] ?? '')
    .replace(/\/\*[\s\S]*?\*\//g, '')

  function rule(selector: string): string {
    const m = new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`).exec(style)
    expect(m, `Cannot find rule block ${selector}`).toBeTruthy()
    return (m as RegExpExecArray)[1]
  }

  it('.person-hero **must not** have overflow (else menus anchored to absolute will be completely clipped, z-index is useless)', () => {
    expect(style).not.toBe('')
    expect(rule('.person-hero')).not.toMatch(/overflow\s*:/)
  })

  it('Clipping responsibility is on .hero-clip: it has overflow:hidden and fills hero', () => {
    const clip = rule('.hero-clip')
    expect(clip).toMatch(/overflow\s*:\s*hidden/)
    expect(clip).toMatch(/position\s*:\s*absolute/)
    expect(clip).toMatch(/inset\s*:\s*0/)
  })

  it('Blurred background and darkening overlay both inside .hero-clip (else blur(40px)+scale(1.2) overflows to grid below)', () => {
    const w = mountHero({
      person: person({ coverFaceId: 'f1' }),
      relationCount: 1,
      placesCount: 1,
    })
    const clip = w.get('[data-test="hero-clip"]')
    expect(clip.find('[data-test="hero-bg"]').exists()).toBe(true)
    expect(clip.find('[data-test="hero-scrim"]').exists()).toBe(true)
    // Menu is not inside clipping layer — it is a descendant of .person-hero but not of .hero-clip.
    expect(clip.find('[data-test="hero-edit-wrap"]').exists()).toBe(false)
  })

  it('Menu is hung outside clipping layer (under hero root), after opening all three items render', async () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-edit-trigger"]').trigger('click')
    const menu = w.get('[data-test="hero-edit-menu"]')
    expect(menu.element.closest('[data-test="hero-clip"]')).toBeNull()
    expect(w.findAll('[data-test="hero-edit-menu"] button')).toHaveLength(3)
  })
})

// User acceptance addition: unnamed people can now navigate from list page menu "View these photos" to detail page (Vue2 had no such path,
// so Vue2 :22 directly renders person.name, empty name was just blank, nobody managed it). Now that there's an entry, there must be a fallback
// title, else hero shows an empty title + rename button, user cannot tell who this is.
describe('PersonHero.vue — Fallback title for unnamed person', () => {
  it('When name is empty string → hero title shows photosPersonUnnamedTitle', () => {
    const w = mountHero({ person: person({ name: '' }), relationCount: 0, placesCount: 0 })
    expect(w.get('[data-test="hero-name"]').text()).toBe('未命名人物')
  })

  it('When name is only whitespace → also use fallback (not render spaces)', () => {
    const w = mountHero({ person: person({ name: '   ' }), relationCount: 0, placesCount: 0 })
    expect(w.get('[data-test="hero-name"]').text()).toBe('未命名人物')
  })

  it('When name exists, display as-is, fallback does not apply', () => {
    const w = mountHero({ person: person({ name: 'Sara' }), relationCount: 0, placesCount: 0 })
    expect(w.get('[data-test="hero-name"]').text()).toBe('Sara')
  })
})
