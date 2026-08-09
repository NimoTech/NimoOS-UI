// SP15-P1-T4: MomentCard.vue — ported line-by-line from Vue2 899af59b:PhotosSmartViewsView.vue:367-433
// inline component MomentCard. Each of the five collage shapes gets its own assertion on
// img count and order.
//
// Does not build its own createI18n instance (a deviation from the plan brief's literal
// code, made for a repo-wide reason, not a whim): vitest.setup.ts already installs the
// src/i18n singleton into `config.global.plugins` for every mount. @vue/test-utils
// concatenates that with any plugin array passed via `global.plugins` on an individual
// mount() call rather than replacing it, so a second createI18n() would get installed on
// the very same app alongside the global one, and vue-i18n's install() unconditionally
// registers its components/directives — producing "already registered" warnings on every
// mount (see the identical fix-round-1 comment in PhotosToolbar.test.ts:7-12, and the
// project memory note "New-UI 测试别另建 createI18n"). Locale switching for the two 'en_us'
// assertions below instead flips the shared singleton's locale ref directly.
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n } from '../../../i18n'

const svc = vi.hoisted(() => ({
  photos: { thumbnailUrl: vi.fn((id: string, size: string) => `mock://${id}/${size}`) },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import MomentCard from '../MomentCard.vue'
import type { Moment } from '../../stores/moments'
import type { MomentSize, MomentTemplate } from '../../util/momentLayout'

function fullMoment(over: Partial<Moment> = {}): Moment {
  return {
    id: 'm1', title: 'Bozeman', subtitle: 'Nov 2016', place: 'Bozeman',
    recipeKey: 'trip:1', coverAssetId: 'c1', featuredAssetIds: ['f1', 'f2'],
    assetCount: 42, addedThisWeek: 3, coverRatio: 1.5,
    timeFrom: '', timeTo: '', updatedAt: '', ...over,
  }
}

// Typing correction vs. the plan brief: `size`/`template` are typed as the real prop
// types (not plain `string`), otherwise `vue-tsc --noEmit` fails even though vitest
// itself doesn't care.
function mountCard(
  over: Partial<Moment> = {},
  size: MomentSize = 'standard',
  template: MomentTemplate = 'T1',
  locale: 'zh_cn' | 'en_us' = 'zh_cn',
) {
  i18n.global.locale.value = locale
  return mount(MomentCard, { props: { moment: fullMoment(over), size, template } })
}

describe('collage shapes', () => {
  it('T1 / T2 / T4 render three images: cover + two featured, fixed order', () => {
    for (const tpl of ['T1', 'T2', 'T4'] as MomentTemplate[]) {
      const w = mountCard({}, 'standard', tpl)
      const srcs = w.findAll('.mo-collage img').map((i) => i.attributes('src'))
      expect(srcs).toEqual(['mock://c1/large', 'mock://f1/large', 'mock://f2/large'])
      expect(w.find('.sv-collage-main').exists()).toBe(true)
    }
  })

  it('T3 renders two images: cover + the sole featured asset', () => {
    const w = mountCard({ featuredAssetIds: ['f1'] }, 'standard', 'T3')
    expect(w.findAll('.mo-collage img').map((i) => i.attributes('src')))
      .toEqual(['mock://c1/large', 'mock://f1/large'])
  })

  it('single renders only the cover, and attaches mo-collage-single', () => {
    const w = mountCard({ featuredAssetIds: [] }, 'standard', 'single')
    expect(w.findAll('.mo-collage img')).toHaveLength(1)
    expect(w.find('.mo-collage').classes()).toContain('mo-collage-single')
  })

  it('does not render an img with an undefined src when featured ids run short (does not copy Vue2\'s out-of-bounds index)', () => {
    // The Vue2 template hard-indexes featured_asset_ids[0]/[1] in the T1 branch; with only
    // 1 entry, the second <img>'s src is undefined and the browser fires a spurious request
    // resolved against the current page. This test skips the missing slot instead.
    const w = mountCard({ featuredAssetIds: ['f1'] }, 'standard', 'T1')
    const srcs = w.findAll('.mo-collage img').map((i) => i.attributes('src'))
    expect(srcs.every((s) => typeof s === 'string' && s.length > 0)).toBe(true)
  })
})

describe('size classes', () => {
  it('wide / tall attach mo-card-wide / mo-card-tall respectively; standard attaches neither', () => {
    expect(mountCard({}, 'wide').find('.mo-card').classes()).toContain('mo-card-wide')
    expect(mountCard({}, 'tall').find('.mo-card').classes()).toContain('mo-card-tall')
    const std = mountCard({}, 'standard').find('.mo-card').classes()
    expect(std).not.toContain('mo-card-wide')
    expect(std).not.toContain('mo-card-tall')
  })

  it('data-id lands on the card root (drag reorder reads it off DOM order)', () => {
    expect(mountCard().find('.mo-card').attributes('data-id')).toBe('m1')
  })
})

describe('meta row', () => {
  it('type pill maps recipeKey prefix to one of four buckets', () => {
    expect(mountCard({ recipeKey: 'trip:1' }, 'standard', 'T1', 'en_us').text()).toContain('Trip')
    expect(mountCard({ recipeKey: 'profile:pets' }, 'standard', 'T1', 'en_us').text()).toContain('Pets')
    expect(mountCard({ recipeKey: 'profile:family' }, 'standard', 'T1', 'en_us').text()).toContain('Family')
    expect(mountCard({ recipeKey: 'theme:food' }, 'standard', 'T1', 'en_us').text()).toContain('Theme')
  })

  it('does not render the green badge when addedThisWeek is 0', () => {
    expect(mountCard({ addedThisWeek: 0 }).find('.mo-week-badge').exists()).toBe(false)
    expect(mountCard({ addedThisWeek: 2 }).find('.mo-week-badge').exists()).toBe(true)
  })

  it('does not render the place pill when place is empty', () => {
    expect(mountCard({ place: '' }).findAll('.sv-cond')).toHaveLength(1) // only the type pill remains
  })

  it('asset count uses locale thousands separators (not a bare toLocaleString)', () => {
    expect(mountCard({ assetCount: 12345 }, 'standard', 'T1', 'en_us').text()).toContain('12,345')
  })
})

describe('interaction', () => {
  it('click emits open with only the id', async () => {
    const w = mountCard()
    await w.find('.mo-card').trigger('click')
    expect(w.emitted('open')).toEqual([['m1']])
  })
})
