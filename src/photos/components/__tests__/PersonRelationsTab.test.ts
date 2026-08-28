// Task 13 (SP7-P5 People): PersonRelationsTab.vue — People detail page "Relations" tab.
// Follows the Vue 2 panel's src/views/Photos/PhotosPersonDetail.vue:187–227 section by section:
// relation graph section (section title + legend + PersonRelGraph) / co-occurrence list (sorted by count descending + bar chart) /
// Nimo's insights card (v-html sentence assembly, no "Deep Dive" button at bottom, belongs to SP8).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import type { PersonRelation } from '../../composables/usePersonDetail'
import type { Person, PlaceGroup } from '../../util/peopleView'
import { useAgentStore } from '../../../ai/stores/agentStore'
import { useAskNimo } from '../../composables/useAskNimo'

const svc = vi.hoisted(() => ({
  photos: {
    personFaceThumbnailUrl: vi.fn(
      (id: string | number, ver?: string | number | null) =>
        `mock://face/${id}${ver != null && ver !== '' ? `?v=${ver}` : ''}`,
    ),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PersonRelationsTab from '../PersonRelationsTab.vue'
import PersonRelGraph from '../PersonRelGraph.vue'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function P(over: Partial<Person> = {}): Person {
  return {
    id: 'me', name: '小明', confidence: 1, count: 10, favorite: false, relation: '',
    coverFaceId: null, heroAssetId: null, firstSeen: null, lastSeen: null, placesCount: 0,
    ...over,
  }
}
const PG = (name: string, count = 1): PlaceGroup => ({ name, count, color: '#000' })

const mounted: VueWrapper[] = []
function mountTab(props: { relations: PersonRelation[]; person: Person | null; places: PlaceGroup[] }) {
  const w = mount(PersonRelationsTab, { props, global: { plugins: [makeI18n()] } })
  mounted.push(w)
  return w
}

afterEach(() => {
  for (const w of mounted.splice(0)) w.unmount()
})

describe('PersonRelationsTab.vue', () => {
  it('Render relation graph section title + subtitle + legend (ref Vue2 :189–197)', () => {
    const w = mountTab({ relations: [], person: P(), places: [] })
    const titles = w.findAll('.detail-section-title')
    expect(titles[0].text()).toContain('关系图谱')
    expect(titles[0].get('.sub').text()).toBe('连线粗细 = 共同出现次数')
    const legend = w.get('.legend')
    expect(legend.text()).toContain('频繁 (200+)')
    expect(legend.text()).toContain('偶尔')
  })

  it('Render co-occurrence section title (ref Vue2 :202, no subtitle)', () => {
    const w = mountTab({ relations: [], person: P(), places: [] })
    const titles = w.findAll('.detail-section-title')
    expect(titles[1].text()).toBe('共同出现')
  })

  it('Pass through relations/person to PersonRelGraph, and forward its open-person event outward', async () => {
    const relations: PersonRelation[] = [{ personId: 7, name: 'Z', count: 3 }]
    const w = mountTab({ relations, person: P(), places: [] })
    const graph = w.getComponent(PersonRelGraph)
    expect(graph.props('relations')).toEqual(relations)
    expect(graph.props('person')).toEqual(P())
    graph.vm.$emit('open-person', 7)
    expect(w.emitted('open-person')).toEqual([[7]])
  })

  it('Co-occurrence list sorted by count descending (ref :530–532 sortedRelations)', () => {
    const relations: PersonRelation[] = [
      { personId: 1, name: 'A', count: 5 },
      { personId: 2, name: 'B', count: 50 },
      { personId: 3, name: 'C', count: 20 },
    ]
    const w = mountTab({ relations, person: P(), places: [] })
    const rows = w.findAll('.rel-row')
    expect(rows).toHaveLength(3)
    expect(rows[0].text()).toContain('B')
    expect(rows[1].text()).toContain('C')
    expect(rows[2].text()).toContain('A')
  })

  // Task 6 fix round 1 (coordinator finding, plain coverage addition — code already verified
  // correct against Vue2 PR#137, so this is GREEN immediately, no RED theater): the rel-row
  // Unnamed-person fallback (PersonRelationsTab.vue:122) had no covering assertion.
  it('a relation with an empty name → the list row renders the Unnamed person fallback copy', () => {
    const relations: PersonRelation[] = [{ personId: 5, name: '', count: 2 }]
    const w = mountTab({ relations, person: P(), places: [] })
    expect(w.get('.rel-row .nm').text()).toBe(zh.photosPersonUnnamedTitle)
  })

  it('Bar width ratio is correct (max item 100%, ref :533–536 relMax)', () => {
    const relations: PersonRelation[] = [
      { personId: 1, name: 'A', count: 25 },
      { personId: 2, name: 'B', count: 100 },
    ]
    const w = mountTab({ relations, person: P(), places: [] })
    const bars = w.findAll('.rel-row .bar > div')
    // After sorting, B(100) is first → 100%, A(25) is after → 25%.
    expect(bars[0].attributes('style')).toContain('width: 100%')
    expect(bars[1].attributes('style')).toContain('width: 25%')
  })

  it('Each co-occurrence row uses 36px PersonAvatar (ref photos-people.scss:547–548 .rel-row .av, brief originally said 32px is a typo, use Vue2 source as truth), do not manually construct avatar URL', () => {
    const relations: PersonRelation[] = [{ personId: 9, name: 'A', coverFaceId: 'f9', count: 1 }]
    const w = mountTab({ relations, person: P(), places: [] })
    const img = w.get('.rel-row [data-test="avatar-img"]')
    expect(img.attributes('src')).toBe('mock://face/9?v=f9')
    expect(svc.photos.personFaceThumbnailUrl).toHaveBeenCalledWith(9, 'f9')
  })

  it('Co-occurrence count phrase uses photosPersonPhotosTogether({n}), not bare number concatenation', () => {
    const relations: PersonRelation[] = [{ personId: 1, name: 'A', count: 7 }]
    const w = mountTab({ relations, person: P(), places: [] })
    expect(w.get('.rel-row .ct').text()).toBe('共同出现 7 张照片')
  })

  it('Click co-occurrence row → emit open-person with personId (ref :208 $emit)', async () => {
    const relations: PersonRelation[] = [{ personId: 33, name: 'A', count: 1 }]
    const w = mountTab({ relations, person: P(), places: [] })
    await w.get('.rel-row').trigger('click')
    expect(w.emitted('open-person')).toEqual([[33]])
  })

  it('Insights card title = photosPersonNimoRead, body renders <b> tag (v-html active)', () => {
    const relations: PersonRelation[] = [{ personId: 1, name: '小红', count: 1 }]
    const w = mountTab({ relations, person: P({ name: '小明' }), places: [PG('北京'), PG('上海')] })
    expect(w.get('.rel-insight-card .hd').text()).toContain('Nimo 的解读')
    const p = w.get('[data-test="insight-text"]')
    expect(p.html()).toContain('<b>')
    expect(p.text()).toContain('小红')
    expect(p.text()).toContain('北京')
    expect(p.text()).toContain('上海')
  })

  it('Two sentence parts joined by space (ref :584 parts.join(\' \'))', () => {
    const relations: PersonRelation[] = [{ personId: 1, name: '小红', count: 1 }]
    const w = mountTab({ relations, person: P({ name: '小明' }), places: [PG('北京')] })
    const text = w.get('[data-test="insight-text"]').text()
    expect(text).toBe('小明 最常与 小红 一起出现。 他们的照片集中在 北京。')
  })

  it('No relations and no places → insights card falls to InsightNone single sentence', () => {
    const w = mountTab({ relations: [], person: P({ name: '小明' }), places: [] })
    expect(w.get('[data-test="insight-text"]').text()).toBe('小明 的照片还不够多，暂无法生成洞察。')
  })

  it('nimoReadParts uses relations[0] not the first after sorting (ref :573, key regression)', () => {
    // The one with higher count is at array position 2, but relations[0] is what determines the "most frequently appears" phrasing.
    const relations: PersonRelation[] = [
      { personId: 1, name: '小红', count: 1 },
      { personId: 2, name: '小刚', count: 100 },
    ]
    const w = mountTab({ relations, person: P({ name: '小明' }), places: [] })
    expect(w.get('[data-test="insight-text"]').text()).toContain('小红')
    expect(w.get('[data-test="insight-text"]').text()).not.toContain('小刚')
  })

  it('HTML special chars in person names are escaped in v-html output (XSS hardening, better than Vue2 bare interpolation)', () => {
    const relations: PersonRelation[] = [{ personId: 1, name: '<img src=x onerror=alert(1)>', count: 1 }]
    const w = mountTab({ relations, person: P({ name: '小明' }), places: [] })
    const html = w.get('[data-test="insight-text"]').html()
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img')
  })

  // Task 8 (Plan D): previously deferred and unrendered in SP8, now added back here per Vue2
  // PhotosPersonDetail.vue:228-230 — the click is a no-op (wiring belongs to Plan G), this only
  // adds the render + visuals first.
  it('renders the Deep Dive button at the bottom of the insights card; clicking it does not emit (opens Ask Nimo instead, no navigation)', async () => {
    // Preflight F-13: this it()'s own stub -- openWith() below calls ensureNimoAgentInit(), and
    // this test file has no beforeEach of Plan G's own to rely on, so the stub goes right here.
    setActivePinia(createPinia())
    const agent = useAgentStore('photos')
    agent.loadAvailableModels = vi.fn(async () => {})
    agent.createSession = vi.fn(async () => { agent.activeSessionId = 's0' })
    agent.deleteSession = vi.fn(async () => {})
    agent.setSessionTitle = vi.fn(async () => {})
    useAskNimo().__resetForTests()

    const w = mountTab({ relations: [{ personId: 1, name: 'A', count: 1 }], person: P(), places: [] })
    const btn = w.get('.nimo-btn')
    expect(btn.attributes('data-test')).toBe('rel-insight-dig-deeper')
    expect(btn.text()).toBe(zh.photosPersonDigDeeper)
    await btn.trigger('click')
    // The one business emit (open-person) shouldn't fire — a no-op business-wise, no navigation.
    expect(w.emitted('open-person')).toBeUndefined()
  })

  // Task 15 (Plan G): wires the previously no-op onDigDeeper to useAskNimo().openWith() with
  // Vue2's exact canned prompt (PhotosPersonDetail.vue:228-230).
  it('clicking "Dig deeper" opens Ask Nimo with the canned tell-me-more prompt', async () => {
    // Re-check F-13: same rationale as above -- this it()'s own stub.
    setActivePinia(createPinia())
    const agent = useAgentStore('photos')
    agent.loadAvailableModels = vi.fn(async () => {})
    agent.createSession = vi.fn(async () => { agent.activeSessionId = 's0' })
    agent.deleteSession = vi.fn(async () => {})
    agent.setSessionTitle = vi.fn(async () => {})
    useAskNimo().__resetForTests()

    const w = mountTab({ relations: [{ personId: 1, name: 'A', count: 1 }], person: P({ name: '小明' }), places: [] })
    await w.get('[data-test="rel-insight-dig-deeper"]').trigger('click')
    expect(useAskNimo().popupOpen.value).toBe(true)
    expect(useAskNimo().prefill.value).toContain('多告诉我一些关于')
    expect(useAskNimo().prefill.value).toContain('小明')
  })

  it('No bare color literals in template (hex or rgba()/hsla() function form, fallback assertion)', () => {
    // Review Important correction: like PersonRelGraph.test.ts, original regex missed function-form colors.
    const w = mountTab({
      relations: [{ personId: 1, name: 'A', count: 1 }],
      person: P(),
      places: [PG('北京'), PG('上海')],
    })
    expect(w.html()).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\s*\(/)
  })
})

// User acceptance addition (batch with PersonHero fallback title): unnamed people can now enter detail page, insights card
// sentence templates all carry {name} placeholders; bare person.name renders as " photos not enough…" with leading space artifact.
// Places tab (PersonPlacesTab.vue:51) long ago uses `personName || photosPersonThisPerson` fallback, but relations tab missed the same treatment —
// filled here, two tabs have aligned fallback coverage.
describe('PersonRelationsTab.vue — Insights card fallback for unnamed person', () => {
  it('name is empty + no relations no places → insights sentence uses "this person" not empty placeholder', () => {
    const w = mountTab({
      relations: [],
      person: P({ name: '' }),
      places: [],
    })
    const text = w.get('[data-test="insight-text"]').text()
    expect(text).toContain('这个人 的照片还不够多')
    expect(text).not.toMatch(/^\s/)
  })

  it('When name is only whitespace → also use fallback', () => {
    const w = mountTab({ relations: [], person: P({ name: '  ' }), places: [] })
    expect(w.get('[data-test="insight-text"]').text()).toContain('这个人 的照片还不够多')
  })

  it('When name exists, substitute as-is, fallback does not apply', () => {
    const w = mountTab({ relations: [], person: P({ name: 'Sara' }), places: [] })
    expect(w.get('[data-test="insight-text"]').text()).toContain('Sara 的照片还不够多')
  })
})
