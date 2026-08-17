import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RaidMemberList from './RaidMemberList.vue'
import zh from '../../i18n/zh_cn'
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

describe('RaidMemberList', () => {
  it('non-RAID10: renders members flat', () => {
    const w = mount(RaidMemberList, { props: { level: 1, members: [
      { path: '/dev/sda', state: 'active sync', number: 0 },
      { path: '/dev/sdb', state: 'faulty', number: 1 },
    ] }, global: { plugins: [i18n] } })
    expect(w.findAll('.rml-row').length).toBe(2)
    expect(w.text()).toContain('/dev/sda')
  })
  it('RAID10: pairs mirrors by slot (not by the mdadm device number)', () => {
    // After a disk replacement, the new member has number=4 but occupies slot 3: grouping by number would produce a phantom third pair (old bug).
    const w = mount(RaidMemberList, { props: { level: 10, members: [
      { path: '/dev/sdd', state: 'active sync set-A', number: 0, slot: 0 },
      { path: '/dev/sdc', state: 'active sync set-B', number: 1, slot: 1 },
      { path: '/dev/sda', state: 'active sync set-A', number: 2, slot: 2 },
      { path: '/dev/sdb', state: 'spare rebuilding', number: 4, slot: 3 },
    ] }, global: { plugins: [i18n] } })
    expect(w.findAll('.rml-pair').length).toBe(2)
    const pairPaths = w.findAll('.rml-pair').map((p) => p.findAll('.rml-path').map((n) => n.text()))
    expect(pairPaths).toEqual([['/dev/sdd', '/dev/sdc'], ['/dev/sda', '/dev/sdb']])
  })
  it('RAID10 old backend (members without slot) → falls back to flat rendering, does not render as 0 rows', () => {
    const w = mount(RaidMemberList, { props: { level: 10, members: [
      { path: '/dev/sda', state: 'active sync set-A', number: 0 },
      { path: '/dev/sdb', state: 'active sync set-B', number: 1 },
    ] }, global: { plugins: [i18n] } })
    expect(w.findAll('.rml-pair').length).toBe(0)
    expect(w.findAll('.rml-row').length).toBe(2)
  })
  it('a rebuilding member shows rebuild_pct', () => {
    const w = mount(RaidMemberList, { props: { level: 1, members: [
      { path: '/dev/sda', state: 'spare rebuilding', number: 0, rebuild_pct: 33 },
    ] }, global: { plugins: [i18n] } })
    expect(w.text()).toContain('33')
  })
  it('degraded array: a faulty member row renders .rml-replace, clicking emits replace-disk (the path of that disk)', async () => {
    const w = mount(RaidMemberList, { props: { level: 1, isDegraded: true, members: [
      { path: '/dev/sda', state: 'active sync', number: 0 },
      { path: '/dev/sdb', state: 'faulty', number: 1 },
    ] }, global: { plugins: [i18n] } })
    const buttons = w.findAll('.rml-replace')
    expect(buttons.length).toBe(1)
    await buttons[0].trigger('click')
    expect(w.emitted('replace-disk')).toHaveLength(1)
    expect(w.emitted('replace-disk')![0]).toEqual(['/dev/sdb'])
  })
  it('non-degraded array: a faulty member row also has no replace button', () => {
    const w = mount(RaidMemberList, { props: { level: 1, isDegraded: false, members: [
      { path: '/dev/sdb', state: 'faulty', number: 1 },
    ] }, global: { plugins: [i18n] } })
    expect(w.findAll('.rml-replace').length).toBe(0)
  })
  it('degraded array: a non-faulty member row has no replace button', () => {
    const w = mount(RaidMemberList, { props: { level: 1, isDegraded: true, members: [
      { path: '/dev/sda', state: 'active sync', number: 0 },
    ] }, global: { plugins: [i18n] } })
    expect(w.findAll('.rml-replace').length).toBe(0)
  })

  // members shape taken from an on-device run on 2026-07-30: after --fail on sda in a 3-disk RAID5, the backend
  // (pkg/mdadm ParseDetail) produces 4 rows — one for the vacated slot (removed, empty path, slot=0)
  // and one for the faulty disk kicked out of its slot (faulty, /dev/sda, slot=-1).
  // **Must include slot**: the merge logic relies on it to determine "this bad disk has left its slot"; a fixture
  // that omits slot would silently take the no-merge branch, and the test would no longer exercise the shape the backend actually sends.
  const degradedRaid5 = [
    { path: '', state: 'removed', number: 0, slot: 0 },
    { path: '/dev/sdb', state: 'active sync', number: 1, slot: 1 },
    { path: '/dev/sdc', state: 'active sync', number: 3, slot: 2 },
    { path: '/dev/sda', state: 'faulty', number: 0, slot: -1 },
  ]

  it('degraded RAID5: the empty slot and the bad disk merge into one row, a 3-disk array is 3 rows', () => {
    const w = mount(RaidMemberList, { props: { level: 5, isDegraded: true, members: degradedRaid5 },
      global: { plugins: [i18n] } })
    const paths = w.findAll('.rml-path').map((n) => n.text())
    expect(paths).toEqual(['槽位 0 · /dev/sda', '/dev/sdb', '/dev/sdc'])
    expect(paths.some((p) => p === '')).toBe(false)
  })

  it('merged row copy calls out 「ejected」, explaining why the slot is empty', () => {
    const w = mount(RaidMemberList, { props: { level: 5, isDegraded: true, members: degradedRaid5 },
      global: { plugins: [i18n] } })
    const labels = w.findAll('.rml-label').map((n) => n.text())
    expect(labels).toEqual(['故障（已弹出）', '活动', '活动'])
    // only one row is in the faulty state — two rows would read as "two disks are bad"
    expect(labels.filter((l) => l.includes('故障')).length).toBe(1)
  })

  it('degraded RAID5: the replace button is attached to the merged row, passing the device path of the bad disk', async () => {
    const w = mount(RaidMemberList, { props: { level: 5, isDegraded: true, members: degradedRaid5 },
      global: { plugins: [i18n] } })
    const buttons = w.findAll('.rml-replace')
    expect(buttons.length).toBe(1)
    expect(buttons[0].element.closest('.rml-row')!.textContent).toContain('/dev/sda')
    await buttons[0].trigger('click')
    expect(w.emitted('replace-disk')![0]).toEqual(['/dev/sda'])
  })

  // keep rows separate when unique pairing is impossible: a few extra rows beat labeling the slot number on the wrong disk.
  it('RAID6 double failure: two empty slots + two bad disks → does not merge, shown as separate rows', () => {
    const w = mount(RaidMemberList, { props: { level: 6, isDegraded: true, members: [
      { path: '', state: 'removed', number: 0, slot: 0 },
      { path: '', state: 'removed', number: 1, slot: 1 },
      { path: '/dev/sdc', state: 'active sync', number: 3, slot: 2 },
      { path: '/dev/sdd', state: 'active sync', number: 4, slot: 3 },
      { path: '/dev/sda', state: 'faulty', number: 0, slot: -1 },
      { path: '/dev/sdb', state: 'faulty', number: 1, slot: -1 },
    ] }, global: { plugins: [i18n] } })
    expect(w.findAll('.rml-row').length).toBe(6)
    const paths = w.findAll('.rml-path').map((n) => n.text())
    expect(paths).toEqual(['槽位 0', '槽位 1', '/dev/sdc', '/dev/sdd', '/dev/sda', '/dev/sdb'])
    // Since 2026-08-11, an empty-slot row also has a replace entry (a pulled-disk scenario has no faulty row): 2 bad disks + 2 empty slots
    expect(w.findAll('.rml-replace').length).toBe(4)
  })

  // Changed 2026-08-11: an empty-slot row also gets a replace entry — a physically pulled disk has no faulty row,
  // only this placeholder row is left; without an entry the user could never replace the disk. The emitted path
  // is an empty string, and the parent view uses findReplaceTarget to identify the pulled disk by serial (see StorageRaidDetail.vue).
  it('physically pulled disk (only an empty slot, no bad disk row) → shows the slot number + replace entry, emits an empty path', async () => {
    const w = mount(RaidMemberList, { props: { level: 5, isDegraded: true, members: [
      { path: '', state: 'removed', number: 1, slot: 1 },
      { path: '/dev/sdb', state: 'active sync', number: 1, slot: 0 },
    ] }, global: { plugins: [i18n] } })
    expect(w.findAll('.rml-path').map((n) => n.text())).toEqual(['槽位 1', '/dev/sdb'])
    const buttons = w.findAll('.rml-replace')
    expect(buttons.length).toBe(1)
    await buttons[0].trigger('click')
    expect(w.emitted('replace-disk')![0]).toEqual([''])
  })

  it('RAID10: an ejected, unmerged row (slot<0) is rendered flat after the mirror pairs, not stuffed into the wrong pair', () => {
    // Double failure: two empty-slot rows + two ejected bad disks — mergeVacatedSlot cannot pair them uniquely, so it does not merge;
    // the empty-slot rows occupy their slots inside a pair, the bad-disk rows (slot=-1) fit into no pair and must still be visible (with a replace button).
    const w = mount(RaidMemberList, { props: { level: 10, isDegraded: true, members: [
      { path: '', state: 'removed', number: 0, slot: 0 },
      { path: '', state: 'removed', number: 2, slot: 2 },
      { path: '/dev/sdb', state: 'active sync', number: 1, slot: 1 },
      { path: '/dev/sdd', state: 'active sync', number: 3, slot: 3 },
      { path: '/dev/sda', state: 'faulty', number: 4, slot: -1 },
      { path: '/dev/sdc', state: 'faulty', number: 5, slot: -1 },
    ] }, global: { plugins: [i18n] } })
    expect(w.findAll('.rml-pair').length).toBe(2)
    expect(w.findAll('.rml-row').length).toBe(6)
    const looseRows = w.findAll('.rml-row').filter((r) => !r.element.closest('.rml-pair'))
    expect(looseRows.map((r) => r.find('.rml-path').text())).toEqual(['/dev/sda', '/dev/sdc'])
    expect(w.findAll('.rml-replace').length).toBe(4) // 2 empty slots + 2 bad disks
  })
})
