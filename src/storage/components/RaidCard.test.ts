import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import type { RaidStatus } from '@nimotech/nimoos-service'
import RaidCard from './RaidCard.vue'
import zh from '../../i18n/zh_cn'
import type { RaidArray } from '../util/raidView'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountCard = (array: Record<string, unknown>, status?: Record<string, unknown>) =>
  mount(RaidCard, {
    props: { array: array as unknown as RaidArray, status: status as unknown as RaidStatus | undefined },
    global: { plugins: [i18n] },
  })

describe('RaidCard', () => {
  it('renders name and the RAID {level} badge', () => {
    const w = mountCard({ id: 1, name: 'md0', level: 1, state: 'active' })
    expect(w.text()).toContain('md0')
    expect(w.text()).toContain('RAID 1')
  })
  it('healthy state: severity=ok badge class', () => {
    const w = mountCard({ id: 1, name: 'a', level: 1, state: 'active' }, { live_state: 'active', state: 'active', rebuild_pct: 0, members: [], total_bytes: 0, used_bytes: 0, free_bytes: 0 })
    expect(w.find('.rc-badge.ok').exists()).toBe(true)
  })
  // Denominator regression: when degraded, the live-member row count (one empty slot row +
  // one faulty-drive row) is 1 more than the array's actual number of drive slots — the
  // denominator must come from the member_disks count recorded in the database, otherwise a
  // 3-drive array with 1 bad drive would show "2/4".
  it('degraded RAID5: online-disk denominator uses the member_disks count, not the live-member row count', () => {
    const w = mountCard(
      { id: 1, name: 'a', level: 5, state: 'degraded', member_disks: [{}, {}, {}] },
      { live_state: 'clean, degraded', state: 'degraded', rebuild_pct: -1, total_bytes: 0, used_bytes: 0, free_bytes: 0,
        members: [
          { path: '', state: 'removed', number: 0 },
          { path: '/dev/sdb', state: 'active sync', number: 1 },
          { path: '/dev/sdc', state: 'active sync', number: 3 },
          { path: '/dev/sda', state: 'faulty', number: 0 },
        ] },
    )
    expect(w.find('.rc-online').text()).toContain('2/3')
    expect(w.find('.rc-online').text()).not.toContain('2/4')
  })
  it('falls back to the live-member row count when member_disks is missing (does not show x/0)', () => {
    const w = mountCard(
      { id: 1, name: 'a', level: 1, state: 'active' },
      { live_state: 'active', state: 'active', rebuild_pct: 0, total_bytes: 0, used_bytes: 0, free_bytes: 0,
        members: [
          { path: '/dev/sda', state: 'active sync', number: 0 },
          { path: '/dev/sdb', state: 'active sync', number: 1 },
        ] },
    )
    expect(w.find('.rc-online').text()).toContain('2/2')
  })
  // One square = one array drive slot. When degraded, mdadm reports one extra row for "a faulty
  // drive kicked out of its slot" — without filtering by slot, you'd get 4 squares while the
  // text still says "2/3", contradicting the denominator on the same card.
  it('degraded RAID5: square count = array slot count (3), not the member row count (4)', () => {
    const w = mountCard(
      { id: 1, name: 'a', level: 5, state: 'degraded', member_disks: [{}, {}, {}] },
      { live_state: 'clean, degraded', state: 'degraded', rebuild_pct: -1, total_bytes: 0, used_bytes: 0, free_bytes: 0,
        members: [
          { path: '/dev/sdd', state: 'active sync', number: 4, slot: 0 },
          { path: '', state: 'removed', number: 1, slot: 1 },
          { path: '/dev/sdc', state: 'active sync', number: 3, slot: 2 },
          { path: '/dev/sdb', state: 'faulty', number: 1, slot: -1 },
        ] },
    )
    const sq = w.findAll('.rc-sq')
    expect(sq.length).toBe(3)
    // Only 1 failure mark (the vacated slot), not 2 — 2 would read as "two drives went bad"
    expect(w.findAll('.rc-sq.fail').length).toBe(1)
    expect(w.findAll('.rc-sq.ok').length).toBe(2)
    // Square count matches the text denominator
    expect(w.find('.rc-online').text()).toContain('2/3')
  })
  it('older backend without slot → squares fall back to rendering per member row (never zero)', () => {
    const w = mountCard(
      { id: 1, name: 'a', level: 1, state: 'active', member_disks: [{}, {}] },
      { live_state: 'active', state: 'active', rebuild_pct: 0, total_bytes: 0, used_bytes: 0, free_bytes: 0,
        members: [
          { path: '/dev/sda', state: 'active sync', number: 0 },
          { path: '/dev/sdb', state: 'active sync', number: 1 },
        ] },
    )
    expect(w.findAll('.rc-sq').length).toBe(2)
  })
  it('degraded state: severity=danger', () => {
    const w = mountCard({ id: 1, name: 'a', level: 1, state: 'degraded' }, { live_state: 'degraded', state: 'degraded', rebuild_pct: 0, members: [], total_bytes: 0, used_bytes: 0, free_bytes: 0 })
    expect(w.find('.rc-badge.danger').exists()).toBe(true)
  })
  it('rebuilding state: shows the progress percentage', () => {
    const w = mountCard({ id: 1, name: 'a', level: 1, state: 'rebuilding' }, { live_state: 'recovering', rebuild_pct: 42.37, rebuild_finish: '2min', rebuild_speed: '100M/s', members: [], total_bytes: 0, used_bytes: 0, free_bytes: 0 })
    expect(w.find('.rc-badge.info').exists()).toBe(true)
    expect(w.text()).toContain('42.4') // rebuild_pct keeps one decimal place
  })
  // rebuild_eta_seconds (2026-08-12 contract): during bitmap incremental sync, the kernel's
  // rebuild_finish is computed from bytes copied so far and balloons to weeks — the card must
  // prefer the honest estimate based on positional progress rate.
  it('rebuilding state prefers rebuild_eta_seconds: shows "about … remaining", not the inflated kernel string', () => {
    const w = mountCard(
      { id: 1, name: 'a', level: 1, state: 'rebuilding' },
      { live_state: 'recovering', rebuild_pct: 42, rebuild_finish: '18926.6min', rebuild_eta_seconds: 35 * 60, members: [], total_bytes: 0, used_bytes: 0, free_bytes: 0 },
    )
    expect(w.text()).toContain('剩余约 35 分钟')
    expect(w.text()).not.toContain('18926')
  })
  it('capacity used/total uses fmtSize', () => {
    const w = mountCard({ id: 1, name: 'a', level: 1, state: 'active' }, { live_state: 'active', total_bytes: 2147483648, used_bytes: 1073741824, free_bytes: 1073741824, members: [], rebuild_pct: 0 })
    expect(w.text()).toMatch(/1(\.0)?\s?GB/i) // fmtSize(1073741824)
  })
  it('clicking the card emits select', async () => {
    const w = mountCard({ id: 5, name: 'a', level: 1, state: 'active' })
    await w.find('.raid-card').trigger('click')
    expect(w.emitted('select')).toBeTruthy()
  })
  it('member squares: each of active/faulty/rebuild', () => {
    const w = mountCard({ id: 1, name: 'a', level: 1, state: 'degraded' }, {
      live_state: 'degraded', rebuild_pct: 0, total_bytes: 0, used_bytes: 0, free_bytes: 0,
      members: [
        { path: '/dev/sda', state: 'active sync', number: 0 },
        { path: '/dev/sdb', state: 'faulty', number: 1 },
      ],
    })
    expect(w.findAll('.rc-sq.ok').length).toBe(1)
    expect(w.findAll('.rc-sq.fail').length).toBe(1)
  })
  // reattachable_members (2026-08-12 contract): when degraded and one of this array's member
  // drives has been plugged back in, the card shows a re-add hint (the action entry point is on
  // the detail page). Identity prefers serial; path is only the fallback when serial is absent.
  it('reattachable_members non-empty: shows the re-add hint, prefers serial', () => {
    const w = mountCard(
      { id: 1, name: 'a', level: 5, state: 'degraded' },
      { live_state: 'degraded', state: 'degraded', rebuild_pct: 0, members: [], total_bytes: 0, used_bytes: 0, free_bytes: 0,
        reattachable_members: [
          { path: '/dev/sdc', serial: 'WD-XYZ123', role: 'Active device 1', last_update: 'Wed Aug 12 03:43:02 2026' },
          { path: '/dev/sdd', serial: '', role: 'Active device 2', last_update: 'Wed Aug 12 03:43:02 2026' },
        ] },
    )
    const hint = w.find('.rc-reattach')
    expect(hint.exists()).toBe(true)
    expect(hint.text()).toContain('WD-XYZ123, /dev/sdd') // serial preferred, falls back to path when absent
  })
  it('no reattachable_members (healthy array/older backend) renders no hint', () => {
    const w = mountCard(
      { id: 1, name: 'a', level: 5, state: 'degraded' },
      { live_state: 'degraded', state: 'degraded', rebuild_pct: 0, members: [], total_bytes: 0, used_bytes: 0, free_bytes: 0 },
    )
    expect(w.find('.rc-reattach').exists()).toBe(false)
  })
})
