// PlaceVisitHistory.vue — Visit history timeline on the place detail panel.
// Covers the "write failing tests" required list: structure audit / current branching /
// three visit-stats v-if semantics / save-trip non-bubbling (@click.stop) / open-photo D9 main guard
// (list = that visit's own thumbs) / section header .more singular/plural / last vertical line hidden (programmatic) /
// keyframes pulseDot exists (programmatic) / color compliance (three current rules use only --place-current-trip,
// no literal rgba(/#).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import type { PlaceVisit } from '../../stores/places'

const thumbnailUrl = vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
vi.mock('@nimotech/nimoos-service', () => ({
  service: { photos: { thumbnailUrl: (...a: unknown[]) => (thumbnailUrl as (...a: unknown[]) => string)(...a) } },
}))

import PlaceVisitHistory from '../PlaceVisitHistory.vue'
// Raw source text (Vite `?raw`): last vertical line hidden / keyframes / color compliance three assertion groups
// can only read <style> original text (jsdom does not compute cascading styles), same as existing precedent
// in PlaceDetailPanel.test.ts / PlaceInsights.test.ts.
import placeVisitHistoryRaw from '../PlaceVisitHistory.vue?raw'
import { extractStyleBlock } from './cssCascade'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function visit(overrides: Partial<PlaceVisit> = {}): PlaceVisit {
  return {
    when: 'Mar 2026', from: '2026-03-01', to: '2026-03-07', current: false,
    days: 7, photos: 42, faces: [], spots: 3, thumbs: ['t1', 't2', 't3'],
    ...overrides,
  }
}

function mountHistory(visits: PlaceVisit[], trips = 1, i18n = makeI18n()) {
  return mount(PlaceVisitHistory, {
    props: { visits, trips },
    global: { plugins: [i18n] },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  thumbnailUrl.mockImplementation((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
})

// ── structure audit (brief structure spec 1-2)────────────────────────────────────────────
describe('structure audit', () => {
  it('section always renders (no v-if), two visits → 2 .visit-card, each contains five child structures', () => {
    const w = mountHistory([visit(), visit({ current: true, when: 'Jul 2026' })])
    expect(w.find('.detail-section').exists()).toBe(true)
    const cards = w.findAll('.visit-card')
    expect(cards).toHaveLength(2)
    for (const card of cards) {
      expect(card.find('.visit-rail').exists()).toBe(true)
      expect(card.find('.visit-dot').exists()).toBe(true)
      expect(card.find('.visit-body').exists()).toBe(true)
      expect(card.find('.visit-head').exists()).toBe(true)
      expect(card.find('.visit-stats').exists()).toBe(true)
      expect(card.find('.visit-thumbs').exists()).toBe(true)
    }
  })

  it('when visits is empty array → section still renders (title present), no .visit-card', () => {
    const w = mountHistory([], 0)
    expect(w.find('.detail-section').exists()).toBe(true)
    expect(w.find('h4').exists()).toBe(true)
    expect(w.findAll('.visit-card')).toHaveLength(0)
  })
})

// ── current branching (brief required cases)───────────────────────────────────────────
describe('current vs non-current', () => {
  it('current=true: .visit-card has .is-current, .visit-dot data-current="true", shows .visit-pill with "本次旅行" text, no .visit-len', () => {
    const w = mountHistory([visit({ current: true })])
    const card = w.find('.visit-card')
    expect(card.classes()).toContain('is-current')
    expect(card.find('.visit-dot').attributes('data-current')).toBe('true')
    const pill = card.find('.visit-pill')
    expect(pill.exists()).toBe(true)
    expect(pill.text()).toContain('本次旅行')
    expect(card.find('.visit-len').exists()).toBe(false)
  })

  it('current=false: .visit-card no .is-current, .visit-dot data-current="false", no .visit-pill, .visit-len text contains day count', () => {
    const w = mountHistory([visit({ current: false, days: 9 })])
    const card = w.find('.visit-card')
    expect(card.classes()).not.toContain('is-current')
    expect(card.find('.visit-dot').attributes('data-current')).toBe('false')
    expect(card.find('.visit-pill').exists()).toBe(false)
    const len = card.find('.visit-len')
    expect(len.exists()).toBe(true)
    expect(len.text()).toContain('9')
  })
})

// ── .visit-stats three v-if semantics (brief required cases)────────────────────────────
describe('.visit-stats', () => {
  it('photo count in <b> tag', () => {
    const w = mountHistory([visit({ photos: 42 })])
    const b = w.find('.visit-stats b')
    expect(b.exists()).toBe(true)
    expect(b.text()).toBe('42')
  })

  it('faces non-empty → shows "与" + joined names', () => {
    const w = mountHistory([visit({ faces: ['小明', '小红'] })])
    const stats = w.find('.visit-stats')
    expect(stats.text()).toContain('与')
    expect(stats.text()).toContain('小明 · 小红')
  })

  it('faces is empty array → no "与", no name concatenation', () => {
    const w = mountHistory([visit({ faces: [] })])
    const stats = w.find('.visit-stats')
    expect(stats.text()).not.toContain('与')
  })

  it('spots is 0 (falsy) → place count does not appear (per Vue2 v-if="v.spots" semantics)', () => {
    const w = mountHistory([visit({ spots: 0 })])
    expect(w.find('.visit-stats').text()).not.toContain('个地点')
  })

  it('spots non-0 → place count appears', () => {
    const w = mountHistory([visit({ spots: 5 })])
    expect(w.find('.visit-stats').text()).toContain('5')
    expect(w.find('.visit-stats').text()).toContain('个地点')
  })
})

// ── save-trip non-bubbling (brief required case, pin @click.stop)────────────────────────
describe('save trip button', () => {
  it('click → emit save-trip with that visit object, event does not bubble to .visit-card', async () => {
    const v = visit({ when: 'Apr 2026' })
    const w = mountHistory([v])
    const cardEl = w.find('.visit-card').element
    const cardSpy = vi.fn()
    cardEl.addEventListener('click', cardSpy)
    await w.find('.visit-save-btn').trigger('click')
    expect(w.emitted('save-trip')).toEqual([[v]])
    expect(cardSpy).not.toHaveBeenCalled()
  })
})

// ── open-photo D9 main guard (brief required case)────────────────────────────────
describe('thumbnail click — D9 main guard', () => {
  it('click 2nd thumbnail of a visit → emit open-photo with (thumbs[1], that visit\'s own thumbs), not another\'s, not single', async () => {
    const vA = visit({ when: 'Mar 2026', thumbs: ['a1', 'a2', 'a3'] })
    const vB = visit({ when: 'Jul 2026', thumbs: ['b1', 'b2', 'b3'] })
    const w = mountHistory([vA, vB])
    const cards = w.findAll('.visit-card')
    const imgsA = cards[0].findAll('.visit-thumbs img')
    await imgsA[1].trigger('click')
    expect(w.emitted('open-photo')).toEqual([['a2', ['a1', 'a2', 'a3']]])

    const imgsB = cards[1].findAll('.visit-thumbs img')
    await imgsB[0].trigger('click')
    expect(w.emitted('open-photo')![1]).toEqual(['b1', ['b1', 'b2', 'b3']])
  })
})

// ── section header .more singular/plural (brief required case)──────────────────────────────────────
describe('section header .more', () => {
  it('is static text (not button), trips=1 → singular key', () => {
    const w = mountHistory([], 1)
    const more = w.find('h4 .more')
    expect(more.exists()).toBe(true)
    expect(more.element.tagName).not.toBe('BUTTON')
    expect(more.text()).toContain('1')
    expect(more.text()).toContain('次旅行')
  })

  it('trips=3 → plural key (Chinese both keys same value, verify with en_us locale that key actually changed)', () => {
    const wZh = mountHistory([], 3)
    expect(wZh.find('h4 .more').text()).toContain('3')

    const wEn = mountHistory([], 3, makeI18n('en_us'))
    expect(wEn.find('h4 .more').text()).toContain('trips')
    const wEn1 = mountHistory([], 1, makeI18n('en_us'))
    expect(wEn1.find('h4 .more').text()).toContain('trip')
    expect(wEn1.find('h4 .more').text()).not.toContain('trips')
  })
})

// ── Review I1: "save trip" button icon must be album glyph (Vue2 PhotosIcon.vue
// name="album"), previously mistakenly drawn as image glyph (rect rx=2 + circle + diagonal line).──────────
describe('icon glyph source (review I1)', () => {
  it('.visit-save-btn is album glyph (rect rx="3" + polyline), not image glyph', () => {
    const m = /class="visit-save-btn"[\s\S]*?>([\s\S]*?)<\/button>/.exec(placeVisitHistoryRaw)
    expect(m, '.visit-save-btn not found').not.toBeNull()
    expect(m![1]).toContain('rx="3"')
    expect(m![1]).toContain('M3 14l5-4 4 3 3-2 6 5')
    expect(m![1]).not.toContain('M21 15l-5-5L5 21')
    expect(m![1]).not.toContain('cx="8.5"')
  })
})

// ── programmatic style assertions (brief required cases)─────────────────────────────────────────
describe('style block — last vertical line hidden / keyframes / color compliance', () => {
  const style = extractStyleBlock(placeVisitHistoryRaw)

  it('contains .visit-card:last-child rule, its .visit-rail::before is display: none', () => {
    const re = /\.visit-card:last-child\s+\.visit-rail::before\s*\{([^}]*)\}/
    const m = re.exec(style)
    expect(m, '.visit-card:last-child .visit-rail::before rule not found').not.toBeNull()
    expect(m![1]).toMatch(/display\s*:\s*none/)
  })

  it('contains @keyframes pulseDot', () => {
    expect(style).toMatch(/@keyframes\s+pulseDot\s*\{/)
  })

  it('three current-related rules all reference --place-current-trip, no literal rgba(/#', () => {
    const blocks = [
      /\.visit-dot\[data-current="true"\]\s*\{([^}]*)\}/,
      /\.visit-pill\s*\{([^}]*)\}/,
      /\.visit-card\.is-current\s+\.visit-body\s*\{([^}]*)\}/,
    ]
    for (const re of blocks) {
      const m = re.exec(style)
      expect(m, `rule not found: ${re}`).not.toBeNull()
      const body = m![1]
      expect(body).toContain('--place-current-trip')
      expect(body).not.toMatch(/rgba\(/)
      expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    }
  })
})
