import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import TimeMachineDeck from './TimeMachineDeck.vue'
import TimeMachineCard from './TimeMachineCard.vue'
import { DECK_WINDOW } from '../util/timeMachineMath'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
// Labels are distinct so a card can be identified from its rendered text: the card stopped
// rendering the snapshot's own time (that moved to the bottom of the screen), and the label is now
// the only per-snapshot text on its face.
const mkItem = (i: number) => ({
  id: i, name: `snap-${i}`, label: `L${i}`, typeKind: 'auto' as const, typeLabelKey: 'snapTypeAuto',
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
  // 🔴 The reason the flip animates at all. buildVisibleStack is front-first by contract, but
  // rendering that order made Vue relocate the outgoing card from child position 0 to position 5
  // on every selection change, and a re-inserted node has no before-change style, so the browser
  // snapped it to its end state instead of transitioning. Measured in a real browser before the
  // fix: 110px -> 1045px within one frame. Cards must therefore render in stable snapshot order;
  // stacking is z-index's job, not DOM order's.
  it('renders cards in stable snapshot order, so a selection change never relocates a node', async () => {
    const w = mountIt({ selectedIndex: 3 })
    // The card declares a narrower item type than the deck hands it (it stopped rendering the
    // snapshot's own date/time), but the object passed at runtime is the full DeckItem -- so the
    // cast goes through unknown deliberately rather than pretending the declared type has a name.
    const order = () => w.findAllComponents(TimeMachineCard).map((c) => (c.props('item') as unknown as { name: string }).name)
    // ITEMS are named snap-0 .. snap-7 in snapshot order.
    const before = order()
    expect(before).toEqual([...before].sort((a, b) => Number(a.slice(5)) - Number(b.slice(5))))
    // Step one snapshot: every card that survives the window must keep its relative position.
    await w.setProps({ selectedIndex: 4 })
    const after = order()
    const survivors = before.filter((n) => after.includes(n))
    expect(survivors).toEqual(after.filter((n) => survivors.includes(n)))
    // ... and the front card is not the first child any more, which is the whole point.
    const front = w.findAllComponents(TimeMachineCard).findIndex((c) => c.props('state') === 'front')
    expect(front).toBeGreaterThan(0)
  })
  it('Selected card is is-front', () => {
    const front = mountIt().findAll('.tm-card').filter((c) => c.classes().includes('is-front'))
    expect(front).toHaveLength(1)
    expect(front[0].text()).toContain('L3')
  })
  it('Click behind card only changes selection, does not enter', async () => {
    const w = mountIt()
    // Must be qualified with is-behind: depth-2 exists on both sides of the deck (a card two
    // behind, and one two flips into the past), and since cards render in stable snapshot order
    // the past one comes first in the DOM -- an unqualified .depth-2 picked that one up, whose
    // clicks are deliberately ignored, so the case failed for the wrong reason.
    const behind = w.findAll('.tm-card.is-behind').find((c) => c.classes().includes('depth-2'))!
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
  // A folder click on a card must steer the deck, not the card underneath it. The front card is
  // the only one whose grid is interactive: rear cards render no grid at all, and a 'past' card
  // is mid-flight still painting the snapshot the user just left.
  it('forwards open-dir from the front card', async () => {
    const w = mountIt()
    const front = w.findAllComponents(TimeMachineCard).find((c) => c.props('state') === 'front')!
    front.vm.$emit('open-dir', { path: '/s/sub', name: 'sub', is_dir: true })
    await w.vm.$nextTick()
    expect(w.emitted('open-dir')).toHaveLength(1)
  })
  it('ignores open-dir coming from a card that is flying out', async () => {
    const w = mountIt()
    const past = w.findAllComponents(TimeMachineCard).find((c) => c.props('state') === 'past')!
    past.vm.$emit('open-dir', { path: '/s/sub', name: 'sub', is_dir: true })
    await w.vm.$nextTick()
    expect(w.emitted('open-dir')).toBeUndefined()
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
    const behindFour = w.findAll('.tm-card').find((c) => c.text().includes('L4'))!
    const behindFourEl = behindFour.element
    await w.setProps({ selectedIndex: 4 })
    const front = w.findAll('.tm-card').find((c) => c.classes().includes('is-front'))!
    expect(front.text()).toContain('L4')
    expect(front.element).toBe(behindFourEl)
  })
})
