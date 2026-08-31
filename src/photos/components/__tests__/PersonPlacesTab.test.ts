// PersonPlacesTab.vue — places tab of person detail page
// (mini map + Top5 legend + all places chip strip). Pure display, no emits, no store mutations.
// Follows the Vue 2 panel's src/views/Photos/PhotosPersonDetail.vue:157-183 section by section.
import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import PersonPlacesTab from '../PersonPlacesTab.vue'
import PhotosMiniMap from '../PhotosMiniMap.vue'
import type { PersonPlace } from '../../util/peopleView'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

const mounted: VueWrapper[] = []
function mountTab(props: { places: PersonPlace[]; personName: string }) {
  const w = mount(PersonPlacesTab, { props, global: { plugins: [makeI18n()] } })
  mounted.push(w)
  return w
}

afterEach(() => {
  for (const w of mounted.splice(0)) w.unmount()
})

// Six different places, each appearing once (all counts equal, stable sorting preserves
// original order), to pin down the distinction between "legend has only 5, chip strip has all 6".
function sixPlaces(): PersonPlace[] {
  return Array.from({ length: 6 }, (_, i) => ({
    placeName: `Place${i}`, latitude: 10 + i, longitude: 20 + i,
  }))
}

describe('PersonPlacesTab.vue', () => {
  it('renders section title (per Vue2 :160 interpolation of person.name) + subtitle (:161)', () => {
    const w = mountTab({ places: [], personName: 'Sara' })
    const title = w.get('.detail-section-title')
    expect(title.text()).toContain('Sara')
    expect(title.text()).toContain('去过的地方')
    expect(w.get('.detail-section-title .sub').text()).toBe('你在此人所有照片中拍摄过的地点')
  })

  it('when personName is empty, title falls back to photosPersonThisPerson, no empty-name placeholder appears', () => {
    const w = mountTab({ places: [], personName: '' })
    const title = w.get('.detail-section-title')
    // Chinese translation is "{name} 去过的地方" as-is (there is already one space between
    // name and the following text, per zh_CN.json original translation, not a bug). With empty
    // name fallback it should read as "这个人 去过的地方"; the key is no "double space" or
    // "leading whitespace" artifacts indicating fallback failed.
    expect(title.text()).toContain('这个人 去过的地方')
    expect(title.text()).not.toMatch(/\s{2,}/)
    expect(title.text()).not.toMatch(/^\s/)
  })

  it('legend only renders Top5 (6th place does not appear in legend)', () => {
    const w = mountTab({ places: sixPlaces(), personName: 'Sara' })
    const legendRows = w.get('.legend').findAll('.row')
    expect(legendRows).toHaveLength(5)
    expect(w.get('.legend').text()).not.toContain('Place5')
    for (let i = 0; i < 5; i++) expect(w.get('.legend').text()).toContain(`Place${i}`)
  })

  it('chip strip renders all places (including 6th)', () => {
    const w = mountTab({ places: sixPlaces(), personName: 'Sara' })
    const chips = w.get('.place-strip').findAll('.place-chip')
    expect(chips).toHaveLength(6)
    expect(w.get('.place-strip').text()).toContain('Place5')
  })

  it('each chip in strip uses photosPeoplePhotosCount phrase to show count, not bare number', () => {
    const w = mountTab({ places: sixPlaces(), personName: 'Sara' })
    const first = w.get('.place-strip').findAll('.place-chip')[0]
    expect(first.text()).toContain('1 张照片')
  })

  it('map receives points length = valid coordinates count (places without coordinates filtered out)', () => {
    const places: PersonPlace[] = [
      { placeName: 'A', latitude: 1, longitude: 2 },
      { placeName: 'B', latitude: null, longitude: null },
      { placeName: 'C' },
    ]
    const w = mountTab({ places, personName: 'Sara' })
    const map = w.getComponent(PhotosMiniMap)
    expect(map.props('points')).toHaveLength(1)
  })

  it('when places is empty → PhotosMiniMap receives non-empty emptyText, and legend is not rendered', () => {
    const w = mountTab({ places: [], personName: 'Sara' })
    const map = w.getComponent(PhotosMiniMap)
    expect(map.props('emptyText')).toBeTruthy()
    expect(map.props('emptyText')).toContain('Sara')
    expect(w.find('.legend').exists()).toBe(false)
  })

  it('when personName is empty, empty state copy falls back to "这个人" (per Vue2 person.name || $t("this person"))', () => {
    const w = mountTab({ places: [], personName: '' })
    const map = w.getComponent(PhotosMiniMap)
    expect(map.props('emptyText')).toContain('这个人')
  })

  it('map point colors follow group colors, 7-color cycle boundary is consistent across the entire chain', () => {
    const places = Array.from({ length: 8 }, (_, i) => ({
      placeName: `P${i}`, latitude: i, longitude: i,
    }))
    const w = mountTab({ places, personName: 'Sara' })
    const map = w.getComponent(PhotosMiniMap)
    const pts = map.props('points') as Array<{ color: string }>
    expect(pts).toHaveLength(8)
    expect(pts[0].color).toBe(pts[7].color) // indices 0 and 7 both fall into PALETTE[0]
  })
})
