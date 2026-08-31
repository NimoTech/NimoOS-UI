// SmartViewActivityFeed.vue — activity feed, right panel segment 4 of the smart view details page.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import type { SmartViewActivity } from '../../stores/smartViews'

const svc = vi.hoisted(() => ({
  photos: {
    thumbnailUrl: vi.fn((id: string | number, size = 'large') => `mock://thumb/${id}/${size}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import SmartViewActivityFeed from '../SmartViewActivityFeed.vue'
import smartViewActivityFeedRaw from '../SmartViewActivityFeed.vue?raw'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function act(overrides: Partial<SmartViewActivity> = {}): SmartViewActivity {
  return { id: 'a1', eventType: 'created', detail: '', assetIds: [], occurredAt: '2026-07-31T00:00:00Z', ...overrides }
}

function mountFeed(activity: SmartViewActivity[], now?: number, i18n = makeI18n()) {
  return mount(SmartViewActivityFeed, { props: { activity, now }, global: { plugins: [i18n] } })
}

function ownWarnCalls(warnSpy: ReturnType<typeof vi.spyOn>): unknown[][] {
  return (warnSpy.mock.calls as unknown[][]).filter((c) => typeof c[0] === 'string' && c[0].startsWith('[photos-smartviews]'))
}

beforeEach(() => {
  svc.photos.thumbnailUrl.mockClear()
})

describe('One case each for 6 eventTypes', () => {
  it('created → photosSvSmartViewCreated', () => {
    const w = mountFeed([act({ eventType: 'created' })])
    expect(w.text()).toContain(zh.photosSvSmartViewCreated)
  })

  it('updated → photosSvConditionsSettingsUpdated', () => {
    const w = mountFeed([act({ eventType: 'updated' })])
    expect(w.text()).toContain(zh.photosSvConditionsSettingsUpdated)
  })

  it('matched (1 photo) → main sentence + bold text key photosSvActOneMatchedBold', () => {
    const w = mountFeed([act({ eventType: 'matched', assetIds: ['p1'] })])
    expect(w.text()).toContain(zh.photosSvActOneMatchedBold)
    expect(w.find('.sv-activity-text b').exists()).toBe(true)
  })

  // The zh_CN.json string wraps the entire phrase "3 new photos" in <b>, not just the number —
  // symmetric with the single-photo line (<b>1 new photo</b>), otherwise adjacent lines would
  // have one with the entire phrase bold and one with only the number bold, which is self-contradictory.
  it('matched (3 photos) → entire phrase "3 new photos" is inside <b> (symmetric with single-photo form)', () => {
    const w = mountFeed([act({ eventType: 'matched', assetIds: ['p1', 'p2', 'p3'] })])
    expect(w.find('.sv-activity-text b').text()).toBe(zh.photosSvActNMatchedBold.replace('{n}', '3'))
    expect(w.find('.sv-activity-text b').text()).toBe('3 张新照片')
  })

  it('Single-photo and multi-photo lines rendered adjacently ⇒ both <b> wrap entire phrase, forms consistent', () => {
    const w = mountFeed([
      act({ id: 'a1', eventType: 'matched', assetIds: ['p1'] }),
      act({ id: 'a2', eventType: 'matched', assetIds: ['p1', 'p2', 'p3', 'p4', 'p5'] }),
    ])
    const bolds = w.findAll('.sv-activity-text b')
    expect(bolds).toHaveLength(2)
    expect(bolds[0]!.text()).toBe('1 张新照片')
    expect(bolds[1]!.text()).toBe('5 张新照片')
  })

  it('exported with detail', () => {
    const w = mountFeed([act({ eventType: 'exported', detail: 'ZIP' })])
    expect(w.text()).toContain(zh.photosSvExportedDetail.replace('{detail}', 'ZIP'))
  })

  it('exported without detail → use photosSvExportFile as fallback (copied from Vue2 :276)', () => {
    const w = mountFeed([act({ eventType: 'exported', detail: '' })])
    expect(w.text()).toContain(zh.photosSvExportedDetail.replace('{detail}', zh.photosSvExportFile))
  })

  it('renamed → photosSvSmartViewRenamed', () => {
    const w = mountFeed([act({ eventType: 'renamed' })])
    expect(w.text()).toContain(zh.photosSvSmartViewRenamed)
  })
})

// ── converted_from_album (the reverse transition of convertFromAlbum) ──
describe('converted_from_album', () => {
  const NOW = '2026-07-31T00:00:00Z'

  it('renders the converted-from-album event, with the locked-in count when available', () => {
    const w = mountFeed([act({ id: '1', eventType: 'converted_from_album', assetIds: ['a', 'b'], occurredAt: NOW })])
    expect(w.text()).toContain(zh.photosSvActConvertedFromAlbumN.replace('{n}', '2'))
  })

  it('falls back to the count-free wording when the event carries no asset ids', () => {
    const w = mountFeed([act({ id: '1', eventType: 'converted_from_album', assetIds: [], occurredAt: NOW })])
    expect(w.text()).toContain(zh.photosSvActConvertedFromAlbum)
    // The count-bearing variant's suffix (everything past the shared prefix) must not leak
    // into the count-free branch -- derived from the locale module, not a literal.
    const countSuffix = zh.photosSvActConvertedFromAlbumN.slice(zh.photosSvActConvertedFromAlbum.length)
    expect(w.text()).not.toContain(countSuffix.replace('{n}', '0'))
    expect(w.text()).not.toContain(countSuffix.replace('{n}', '2'))
  })

  it('still drops genuinely unknown event types', () => {
    const w = mountFeed([act({ id: '1', eventType: 'no_such_thing', assetIds: [], occurredAt: NOW })])
    expect(w.findAll('[data-test="sv-activity-row"]')).toHaveLength(0)
  })
})

describe('Unknown eventType (deviation: Vue2 :278 exposes internal enum values to user, here changed to skip + warn)', () => {
  it('Appears alone → that line does not render, console.warn exactly once (filtered by prefix)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mountFeed([act({ eventType: 'bogus' })])
    expect(w.findAll('[data-test="sv-activity-row"]')).toHaveLength(0)
    expect(ownWarnCalls(warnSpy)).toHaveLength(1)
    warnSpy.mockRestore()
  })

  it('Unknown mixed with known → known ones still render, warn exactly once', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mountFeed([act({ id: 'a1', eventType: 'created' }), act({ id: 'a2', eventType: 'zzz' })])
    expect(w.findAll('[data-test="sv-activity-row"]')).toHaveLength(1)
    expect(ownWarnCalls(warnSpy)).toHaveLength(1)
    warnSpy.mockRestore()
  })
})

describe('No v-html directives (matched two cases use <i18n-t> named slots)', () => {
  it('<template> block contains no v-html directive usage', () => {
    const m = /<template>([\s\S]*?)<\/template>/.exec(smartViewActivityFeedRaw)
    expect(m, 'No <template> block found').not.toBeNull()
    expect(m![1]).not.toMatch(/v-html\s*=/)
  })
})

describe('Thumbnails', () => {
  it('assetIds with 5 items → renders only 3 img, thumbnailUrl parameters are (id, "large")', () => {
    const w = mountFeed([act({ eventType: 'matched', assetIds: ['p1', 'p2', 'p3', 'p4', 'p5'] })])
    const imgs = w.findAll('.sv-activity-thumbs img')
    expect(imgs).toHaveLength(3)
    expect(svc.photos.thumbnailUrl).toHaveBeenCalledWith('p1', 'large')
    expect(svc.photos.thumbnailUrl).toHaveBeenCalledWith('p3', 'large')
    expect(svc.photos.thumbnailUrl).not.toHaveBeenCalledWith('p4', 'large')
    expect(svc.photos.thumbnailUrl).not.toHaveBeenCalledWith('p5', 'large')
  })

  it('assetIds is empty → 0 img + 1 placeholder block', () => {
    const w = mountFeed([act({ eventType: 'created', assetIds: [] })])
    expect(w.findAll('.sv-activity-thumbs img')).toHaveLength(0)
    expect(w.find('[data-test="sv-activity-placeholder"]').exists()).toBe(true)
  })
})

describe('Empty state (Vue2 has no empty state, copied as-is)', () => {
  it('activity is empty array → .sv-activity renders but 0 rows inside', () => {
    const w = mountFeed([])
    expect(w.find('[data-test="sv-activity-feed"]').exists()).toBe(true)
    expect(w.findAll('[data-test="sv-activity-row"]')).toHaveLength(0)
  })
})

describe('Time: now prop can be overridden', () => {
  it('Item from 30 seconds ago → displays photosSvRelMinutes value', () => {
    const now = new Date('2026-07-31T00:05:00Z').getTime()
    const occurredAt = new Date(now - 30_000).toISOString()
    const w = mountFeed([act({ eventType: 'created', occurredAt })], now)
    expect(w.find('.sv-activity-time').text()).toBe(zh.photosSvRelMinutes.replace('{n}', '1'))
  })
})
