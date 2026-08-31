// PlaceInsights.vue — "Nimo Discovery" insight card section.
// Covers the "write failing tests" checklist: one card per backend shape x4 +
// no v-html + named slot bold verification + unknown key skips card(deviation from registry 8) +
// three icon branches + empty state doesn't render.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import type { PlaceInsight } from '../../stores/places'

import PlaceInsights from '../PlaceInsights.vue'
// Raw source code text(Vite `?raw`): zero v-html assertion can only read <script>/<template>
// source text(after jsdom mount cannot get 'whether v-html directive is written in source' info),
// same as PersonRelationsTab counterexample's existing precedent.
import placeInsightsRaw from '../PlaceInsights.vue?raw'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function mountInsights(insights: PlaceInsight[], i18n = makeI18n()) {
  return mount(PlaceInsights, {
    props: { insights },
    global: { plugins: [i18n] },
  })
}

const mostPhotographed: PlaceInsight = {
  ico: 'sparkles', key: 'photos.places.insight.mostPhotographed', params: { count: 42 },
}
const topSpot: PlaceInsight = {
  ico: 'sparkles', key: 'photos.places.insight.topSpot', params: { spot: '西湖', count: 12 },
}
const companions: PlaceInsight = {
  ico: 'person', key: 'photos.places.insight.companions', params: { names: ['小明', '小红'] },
}
const home: PlaceInsight = {
  ico: 'home', key: 'photos.places.insight.home', params: { trips: 5, count: 88 },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Empty state', () => {
  it('insights is empty array → entire section doesn\'t render', () => {
    const w = mountInsights([])
    expect(w.find('.detail-section').exists()).toBe(false)
    expect(w.find('.insights').exists()).toBe(false)
  })
})

describe('Four backend shapes — copy and interpolation replacement', () => {
  it('mostPhotographed: {count} is replaced, card contains no <b>', () => {
    const w = mountInsights([mostPhotographed])
    const card = w.find('.insight-card')
    expect(card.exists()).toBe(true)
    expect(card.text()).toContain('42')
    expect(card.text()).not.toContain('{count}')
    expect(card.find('b').exists()).toBe(false)
  })

  it('topSpot: copy contains location name and count, {spot}/{count} both replaced, <b> text is exactly location name(proves slot is used not string concat)', () => {
    const w = mountInsights([topSpot])
    const card = w.find('.insight-card')
    expect(card.text()).toContain('西湖')
    expect(card.text()).toContain('12')
    expect(card.text()).not.toContain('{spot}')
    expect(card.text()).not.toContain('{count}')
    expect(card.find('b').text()).toBe('西湖')
  })

  it('companions: <b> text is joinCompanionNames concatenation result("小明 · 小红")', () => {
    const w = mountInsights([companions])
    const card = w.find('.insight-card')
    expect(card.find('b').text()).toBe('小明 · 小红')
  })

  it('home: <b> text is photosPlacesInsightHomeBase value("大本营"), {trips}/{count} both replaced', () => {
    const w = mountInsights([home])
    const card = w.find('.insight-card')
    expect(card.find('b').text()).toBe('大本营')
    expect(card.text()).toContain('5')
    expect(card.text()).toContain('88')
    expect(card.text()).not.toContain('{trips}')
    expect(card.text()).not.toContain('{count}')
  })
})

describe('No v-html(spec §7c-4 hard requirement)', () => {
  it('<template> block contains no v-html directive usage(<script> doc comments may literally mention the word, only check template block)', () => {
    const m = /<template>([\s\S]*?)<\/template>/.exec(placeInsightsRaw)
    expect(m, '<template> block not found').not.toBeNull()
    expect(m![1]).not.toMatch(/v-html\s*=/)
  })
})

// Note: warnSpy intercepts global console.warn—test environment itself stacks a separate i18n instance
// from makeI18n() in this file on top of the global i18n plugin in vitest.setup.ts at each mount,
// vue-i18n's install() for i18n-t/i18n-n/i18n-d/`v-t` duplicate registration each prints a
// "[Vue warn]: ... has already been registered" noise(unrelated to component logic, any test in this
// repo that first actually renders <i18n-t> triggers this, verified by source inspection—not a defect
// introduced by this task).
// Assertion only counts calls with the component's own `[photos-places] unknown insight key...` prefix,
// doesn't do global console.warn call count, avoids being flagged by framework noise.
function ownWarnCalls(warnSpy: ReturnType<typeof vi.spyOn>): unknown[][] {
  return (warnSpy.mock.calls as unknown[][]).filter((c) => typeof c[0] === 'string' && c[0].startsWith('[photos-places]'))
}

describe('Unknown key — deviation from registry 8', () => {
  it('Unknown key appears alone → card doesn\'t render, console.warn called once', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mountInsights([{ ico: 'sparkles', key: 'photos.places.insight.zzz', params: { count: 1 } }])
    // Empty section: the only insight is unknown key, after filtering the entire section should be empty.
    expect(w.find('.detail-section').exists()).toBe(false)
    expect(ownWarnCalls(warnSpy)).toHaveLength(1)
    warnSpy.mockRestore()
  })

  it('Unknown key mixed in four known ones → still renders 4 cards, warn exactly once', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mountInsights([
      mostPhotographed, topSpot, companions, home,
      { ico: 'sparkles', key: 'photos.places.insight.zzz', params: {} },
    ])
    expect(w.findAll('.insight-card')).toHaveLength(4)
    expect(ownWarnCalls(warnSpy)).toHaveLength(1)
    warnSpy.mockRestore()
  })
})

describe('Icon three branches', () => {
  it('ico=sparkles → data-test=insight-ico-sparkles', () => {
    const w = mountInsights([mostPhotographed])
    expect(w.find('[data-test="insight-ico-sparkles"]').exists()).toBe(true)
  })

  it('ico=person → data-test=insight-ico-person', () => {
    const w = mountInsights([companions])
    expect(w.find('[data-test="insight-ico-person"]').exists()).toBe(true)
  })

  it('ico=home → data-test=insight-ico-home', () => {
    const w = mountInsights([home])
    expect(w.find('[data-test="insight-ico-home"]').exists()).toBe(true)
  })

  it('Unknown ico → falls back to sparkles', () => {
    const w = mountInsights([{ ico: 'bogus', key: 'photos.places.insight.mostPhotographed', params: { count: 1 } }])
    expect(w.find('[data-test="insight-ico-sparkles"]').exists()).toBe(true)
    expect(w.find('[data-test="insight-ico-person"]').exists()).toBe(false)
    expect(w.find('[data-test="insight-ico-home"]').exists()).toBe(false)
  })
})

describe('Also holds under English locale(parameter replacement is locale-agnostic)', () => {
  it('topSpot English copy contains location name and count', () => {
    const w = mountInsights([topSpot], makeI18n('en_us'))
    const card = w.find('.insight-card')
    expect(card.text()).toContain('西湖')
    expect(card.text()).toContain('12')
    expect(card.find('b').text()).toBe('西湖')
  })
})
