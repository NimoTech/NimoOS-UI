// P6b-T4: PlaceSpotDialog.vue — Place detail shooting spot dialog (embedded card, not floating layer).
// Corresponds item-by-item to task-4-brief.md "required test checklist". Pure display + emit, does not touch store — only mocks
// thumbnailUrl from @nimotech/nimoos-service (following existing mock technique from PlacesRail.test.ts / PersonHero.test.ts).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import type { PlaceSpot } from '../../stores/places'

const thumbnailUrl = vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
vi.mock('@nimotech/nimoos-service', () => ({
  service: { photos: { thumbnailUrl: (...a: unknown[]) => (thumbnailUrl as (...a: unknown[]) => string)(...a) } },
}))

import PlaceSpotDialog from '../PlaceSpotDialog.vue'
import placeSpotDialogRaw from '../PlaceSpotDialog.vue?raw'
import { extractStyleBlock, winningHoverBackground } from './cssCascade'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function spot(overrides: Partial<PlaceSpot> = {}): PlaceSpot {
  return {
    key: 's1', name: 'West Lake', lon: 120.1551, lat: 30.2741, count: 12, thumb: 't-1',
    ...overrides,
  }
}

function mountDialog(props: { spot?: PlaceSpot, busy?: boolean } = {}, i18n = makeI18n()) {
  return mount(PlaceSpotDialog, {
    props: { spot: spot(), busy: false, ...props },
    global: { plugins: [i18n] },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  thumbnailUrl.mockImplementation((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
})

// — Structure inventory (structure specs A.1–A.7) —
describe('Structure inventory', () => {
  it('Render head / close button / name row / pencil button / coords row / stat row / thumbs / bottom full-width button', () => {
    const w = mountDialog()
    expect(w.find('.spot-dialog-head').exists()).toBe(true)
    expect(w.find('.icon-btn').exists()).toBe(true)
    expect(w.find('.spot-dialog-name').exists()).toBe(true)
    expect(w.find('.spot-rename-btn').exists()).toBe(true)
    expect(w.find('.spot-dialog-coords').exists()).toBe(true)
    expect(w.find('.spot-dialog-stat').exists()).toBe(true)
    expect(w.find('.spot-dialog-thumbs').exists()).toBe(true)
    expect(w.find('.spot-dialog-btn').exists()).toBe(true)
  })
})

// — Coords row: formatSpotCoords (deviation note 16) —
describe('Coords row uses formatSpotCoords', () => {
  it('Northern hemisphere East longitude → N · E', () => {
    const w = mountDialog({ spot: spot({ lat: 30.2741, lon: 120.1551 }) })
    expect(w.find('.spot-dialog-coords').text()).toContain('30.274° N · 120.155° E')
  })

  it('Southern hemisphere West longitude → S and W (component-side guard, do not hardcode Vue2\'s N/E)', () => {
    const w = mountDialog({ spot: spot({ lat: -33.8688, lon: -43.1729 }) })
    const t = w.find('.spot-dialog-coords').text()
    expect(t).toContain('33.869° S')
    expect(t).toContain('43.173° W')
  })

  it('lat=NaN → coords row does not render', () => {
    const w = mountDialog({ spot: spot({ lat: Number.NaN }) })
    expect(w.find('.spot-dialog-coords').exists()).toBe(false)
  })
})

// — Enter/exit edit mode —
describe('Pencil enters edit mode', () => {
  it('Click pencil → input appears, initial value equals current name, non-edit row disappears', async () => {
    const w = mountDialog({ spot: spot({ name: 'West Lake' }) })
    await w.find('.spot-rename-btn').trigger('click')
    expect(w.find('.spot-dialog-name').exists()).toBe(false)
    const input = w.find('.spot-rename-input')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('West Lake')
  })
})

describe('Edit mode: disabled rules', () => {
  it('When name is blank (only spaces), save button disabled', async () => {
    const w = mountDialog()
    await w.find('.spot-rename-btn').trigger('click')
    await w.find('.spot-rename-input').setValue('   ')
    expect((w.find('.spot-rename-save').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('When busy=true, both save button and reset button disabled', async () => {
    const w = mountDialog({ busy: true })
    await w.find('.spot-rename-btn').trigger('click')
    await w.find('.spot-rename-input').setValue('New Name')
    expect((w.find('.spot-rename-save').element as HTMLButtonElement).disabled).toBe(true)
    expect((w.find('.spot-dialog-reset').element as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('Submit / Cancel / Esc', () => {
  it('Enter submits emit rename with trimmed name', async () => {
    const w = mountDialog()
    await w.find('.spot-rename-btn').trigger('click')
    await w.find('.spot-rename-input').setValue('  New Name  ')
    await w.find('.spot-rename-input').trigger('keyup.enter')
    expect(w.emitted('rename')).toEqual([['New Name']])
  })

  it('Click save also emits rename with trimmed name', async () => {
    const w = mountDialog()
    await w.find('.spot-rename-btn').trigger('click')
    await w.find('.spot-rename-input').setValue('  New Name  ')
    await w.find('.spot-rename-save').trigger('click')
    expect(w.emitted('rename')).toEqual([['New Name']])
  })

  it('Click cancel → return to non-edit mode and do not emit', async () => {
    const w = mountDialog()
    await w.find('.spot-rename-btn').trigger('click')
    await w.find('.spot-rename-input').setValue('New Name')
    await w.find('.spot-rename-cancel').trigger('click')
    expect(w.find('.spot-dialog-name').exists()).toBe(true)
    expect(w.find('.spot-rename-input').exists()).toBe(false)
    expect(w.emitted('rename')).toBeUndefined()
  })

  it('Press Esc → return to non-edit mode and do not emit', async () => {
    const w = mountDialog()
    await w.find('.spot-rename-btn').trigger('click')
    await w.find('.spot-rename-input').setValue('New Name')
    await w.find('.spot-rename-input').trigger('keyup.esc')
    expect(w.find('.spot-dialog-name').exists()).toBe(true)
    expect(w.find('.spot-rename-input').exists()).toBe(false)
    expect(w.emitted('rename')).toBeUndefined()
  })
})

describe('Exit edit mode when props.spot.key changes (ref Vue2 watch :303)', () => {
  it('Enter edit mode first, then switch to another spot → input disappears', async () => {
    const w = mountDialog({ spot: spot({ key: 's1', name: 'A' }) })
    await w.find('.spot-rename-btn').trigger('click')
    expect(w.find('.spot-rename-input').exists()).toBe(true)
    await w.setProps({ spot: spot({ key: 's2', name: 'B' }) })
    expect(w.find('.spot-rename-input').exists()).toBe(false)
    expect(w.find('.spot-dialog-name').exists()).toBe(true)
  })
})

describe('Do not keep a copy (deviation note 7)', () => {
  it('After rename props.spot.name changes, non-edit mode directly shows new name', async () => {
    const w = mountDialog({ spot: spot({ key: 's1', name: 'Old Name' }) })
    expect(w.find('.spot-dialog-name .one-line').text()).toBe('Old Name')
    await w.setProps({ spot: spot({ key: 's1', name: '新名' }) })
    expect(w.find('.spot-dialog-name .one-line').text()).toBe('新名')
  })
})

// — Review fix I2 (fix round 1): after successful rename/reset must exit edit mode, source from Vue2
// saveSpotName :495–516 — success exits immediately, failure (name unchanged) keeps edit mode. —
describe('Edit mode after successful/failed rename (review fix I2)', () => {
  it('Rename succeeds (parent passes new name) → exit edit mode', async () => {
    const w = mountDialog({ spot: spot({ key: 's1', name: 'Old Name' }) })
    await w.find('.spot-rename-btn').trigger('click')
    expect(w.find('.spot-rename-input').exists()).toBe(true)
    await w.setProps({ spot: spot({ key: 's1', name: 'New Name' }) })
    expect(w.find('.spot-rename-input').exists()).toBe(false)
    expect(w.find('.spot-dialog-name .one-line').text()).toBe('New Name')
  })

  it('Rename fails (name unchanged) → still in edit mode', async () => {
    const w = mountDialog({ spot: spot({ key: 's1', name: 'Old Name' }) })
    await w.find('.spot-rename-btn').trigger('click')
    expect(w.find('.spot-rename-input').exists()).toBe(true)
    // Container/store request failed: parent prop passes back same name unchanged (even though new object reference).
    await w.setProps({ spot: spot({ key: 's1', name: 'Old Name' }) })
    expect(w.find('.spot-rename-input').exists()).toBe(true)
  })
})

// — D8: Reset to default name (net-new, no Vue2 equivalent) —
describe('D8 Reset to default name', () => {
  it('Click "Reset to default name" → emit reset-name, zero parameters', async () => {
    const w = mountDialog()
    await w.find('.spot-rename-btn').trigger('click')
    await w.find('.spot-dialog-reset').trigger('click')
    expect(w.emitted('reset-name')).toEqual([[]])
  })

  it('Button text comes from photosPlacesSpotResetName', async () => {
    const w = mountDialog({}, makeI18n('en_us'))
    await w.find('.spot-rename-btn').trigger('click')
    expect(w.find('.spot-dialog-reset').text()).toBe('Reset to default name')
  })
})

// — Thumbnails —
describe('Thumbnails', () => {
  it('Click thumbnail → emit open-photo with spot.thumb', async () => {
    const w = mountDialog({ spot: spot({ thumb: 'thumb-x' }) })
    await w.find('.spot-dialog-thumbs img').trigger('click')
    expect(w.emitted('open-photo')).toEqual([['thumb-x']])
  })

  it('When thumb is empty string, img does not render', () => {
    const w = mountDialog({ spot: spot({ thumb: '' }) })
    expect(w.find('.spot-dialog-thumbs img').exists()).toBe(false)
  })

  it('Thumbnail src comes from service.photos.thumbnailUrl', () => {
    mountDialog({ spot: spot({ thumb: 'thumb-x' }) })
    expect(thumbnailUrl).toHaveBeenCalledWith('thumb-x', 'small')
  })
})

// — Bottom button / Close —
describe('Bottom full-width button / Close', () => {
  it('Click bottom full-width button → emit open-library', async () => {
    const w = mountDialog()
    await w.find('.spot-dialog-btn').trigger('click')
    expect(w.emitted('open-library')).toHaveLength(1)
  })

  it('Click close → emit close', async () => {
    const w = mountDialog()
    await w.find('.icon-btn').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })
})

// — Hover cascade (.spot-dialog-btn) —
describe('Hover state background', () => {
  it('.spot-dialog-btn hover background belongs to rule with :hover', () => {
    const style = extractStyleBlock(placeSpotDialogRaw)
    const win = winningHoverBackground(style, ['spot-dialog-btn'])
    expect(win.selector).toContain(':hover')
  })
})

// — Review fix I1 (fix round 1): `.one-line` is not a global utility class in this repo (each SFC is a scoped island),
// previously was an inactive shell class — after filling in three-line-clamp pieces need programmatic assertions to pin down,
// prevent future maintainers from silently losing it when reshaping styles (same root cause as T3's missing backdrop-filter). —
describe('.one-line single-line ellipsis (review fix I1)', () => {
  it('.spot-dialog-name .one-line rule contains text-overflow: ellipsis', () => {
    const style = extractStyleBlock(placeSpotDialogRaw)
    const m = /\.spot-dialog-name \.one-line\s*\{([^}]*)\}/.exec(style)
    expect(m, 'Cannot find .spot-dialog-name .one-line rule').not.toBeNull()
    expect(m![1]).toMatch(/text-overflow:\s*ellipsis/)
  })
})
