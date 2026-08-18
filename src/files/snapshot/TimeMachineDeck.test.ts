import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import TimeMachineDeck from './TimeMachineDeck.vue'
import { DECK_WINDOW } from '../util/timeMachineMath'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mkItem = (i: number) => ({
  id: i, name: `snap-${i}`, label: '', typeKind: 'auto' as const, typeLabelKey: 'snapTypeAuto',
  time: `0${i}:00`, createdAt: '', flatIndex: i, dayLabelText: '今天',
})
const ITEMS = Array.from({ length: 8 }, (_, i) => mkItem(i))
const mountIt = (props = {}) =>
  mount(TimeMachineDeck, { props: { items: ITEMS, selectedIndex: 3, ...props }, global: { plugins: [i18n] } })

describe('TimeMachineDeck', () => {
  // Review fix (Important): window size comes from the DECK_WINDOW constant (no more separate
  // 5/2 literals) — assertions compute from the constant too, so the preview-fetch window in
  // TimeMachineOverlay (see the same-named case) and the render window here always compute the
  // same number; changing the window size updates both sides together, so "the front card
  // can't get thumbnails" cannot happen.
  it('Only render cards in the visible window (depth cards back + past cards fly away), not all 8', () => {
    expect(mountIt().findAll('.tm-card')).toHaveLength(DECK_WINDOW.depth + DECK_WINDOW.past)
  })
  it('Number of flying-away cards exactly equals DECK_WINDOW.past (pin only the past side to prevent depth/past swap)', () => {
    const past = mountIt().findAll('.tm-card').filter((c) => c.classes().includes('is-past'))
    expect(past).toHaveLength(DECK_WINDOW.past)
  })
  // The two cases above use the shared 8-item ITEMS + selectedIndex:3, where the depth side is
  // capped by the array boundary (length 8) rather than by DECK_WINDOW.depth itself — this case
  // switches to data long enough (15 items) with the selection in the middle (not touching
  // either boundary), so the front+behind count exactly equals DECK_WINDOW.depth and isn't
  // conflated with boundary coincidences like 8-3=5 (pinning the depth side on its own).
  it('front+behind card count exactly equals DECK_WINDOW.depth (data long enough, not touching array boundary)', () => {
    const longItems = Array.from({ length: 15 }, (_, i) => mkItem(i))
    const w = mount(TimeMachineDeck, { props: { items: longItems, selectedIndex: 7 }, global: { plugins: [i18n] } })
    const frontOrBehind = w.findAll('.tm-card').filter((c) => !c.classes().includes('is-past'))
    expect(frontOrBehind).toHaveLength(DECK_WINDOW.depth)
  })
  it('Selected card is is-front', () => {
    const front = mountIt().findAll('.tm-card').filter((c) => c.classes().includes('is-front'))
    expect(front).toHaveLength(1)
    expect(front[0].text()).toContain('03:00')
  })
  it('Click behind card only changes selection, does not enter', async () => {
    const w = mountIt()
    const behind = w.findAll('.tm-card').find((c) => c.classes().includes('depth-2'))!
    await behind.trigger('click')
    expect(w.emitted('select')?.[0]?.[0]).toBe(5)
    expect(w.emitted('enter')).toBeUndefined()
  })
  it('Click the front card = enter (consistent with real Time Machine)', async () => {
    const w = mountIt()
    await w.findAll('.tm-card').find((c) => c.classes().includes('is-front'))!.trigger('click')
    expect(w.emitted('enter')).toHaveLength(1)
    expect(w.emitted('select')).toBeUndefined()
  })
  it('Flying-away cards do not consume clicks (pointer-events: none guaranteed by CSS, assertion no emit here)', async () => {
    const w = mountIt()
    const past = w.findAll('.tm-card').find((c) => c.classes().includes('is-past'))!
    await past.trigger('click')
    expect(w.emitted('enter')).toBeUndefined()
    expect(w.emitted('select')).toBeUndefined()
  })
  it('Empty list renders 0 cards and does not error', () => {
    expect(mountIt({ items: [] }).findAll('.tm-card')).toHaveLength(0)
  })
  it('key uses snapshot name (reuse same DOM batch on selection change for smooth transition)', async () => {
    // Note: the original draft's assertion "array element 0 still exists after the update" was
    // hollow — position 0 is always the is-front card, so even if the key were wrongly bound to
    // depth/index instead of name, the depth-0 slot itself always exists and the assertion
    // would pass falsely. Changed to follow a specific snapshot (snap-4): at selectedIndex=3 it
    // is a behind card and after selectedIndex=4 it should be promoted to is-front — and it
    // must be the **same** DOM node, not another node that "happens to be at depth-0". If the
    // key were switched to depth, this would genuinely fail (the depth-0 slot would be reused
    // for a different item instead of the snap-4 node being moved to its new position).
    const w = mountIt()
    const behindFour = w.findAll('.tm-card').find((c) => c.text().includes('04:00'))!
    const behindFourEl = behindFour.element
    await w.setProps({ selectedIndex: 4 })
    const front = w.findAll('.tm-card').find((c) => c.classes().includes('is-front'))!
    expect(front.text()).toContain('04:00')
    expect(front.element).toBe(behindFourEl)
  })
})
