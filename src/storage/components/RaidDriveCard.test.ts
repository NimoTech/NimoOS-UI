import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RaidDriveCard from './RaidDriveCard.vue'

const disk = { path: '/dev/sda', size: 1000, disk_type: 'SSD', health: 'true' }

// Verbatim value captured from a real device (2026-07-30, `curl -s http://127.0.0.1/v1/disks` data.avail[0], a raidlab fake disk):
// {"name":"sda","size":536870912,"model":"scsi_debug","health":"","temperature":38,
//  "power_on_time":0,"disk_type":"SSD","need_format":true,"serial":"2000","path":"/dev/sda", ...}
// health is an empty string (a defect in the backend's avail assignment order); temperature/power_on_time/disk_type all have values.
const LIVE_AVAIL_SDA = {
  path: '/dev/sda', size: 536870912, model: 'scsi_debug',
  health: '', temperature: 38, power_on_time: 0, disk_type: 'SSD',
}

describe('RaidDriveCard', () => {
  it('clicking the card → emits toggle', async () => {
    const w = mount(RaidDriveCard, { props: { disk, selected: false } })
    await w.trigger('click')
    expect(w.emitted('toggle')).toHaveLength(1)
  })

  it('selected=true → the check circle shows the selected state', () => {
    const w = mount(RaidDriveCard, { props: { disk, selected: true } })
    expect(w.find('.rdc-check--on').exists()).toBe(true)
  })

  it('selected=false → the check circle does not show the selected state', () => {
    const w = mount(RaidDriveCard, { props: { disk, selected: false } })
    expect(w.find('.rdc-check--on').exists()).toBe(false)
  })

  it('a risky disk (health="false") → marked as risky', () => {
    const risky = { ...disk, health: 'false' }
    const w = mount(RaidDriveCard, { props: { disk: risky, selected: false } })
    expect(w.classes()).toContain('rdc--risk')
  })

  it('a healthy disk → not marked as risky', () => {
    const w = mount(RaidDriveCard, { props: { disk, selected: false } })
    expect(w.classes()).not.toContain('rdc--risk')
  })

  it('capacity display goes through fmtSize', () => {
    const w = mount(RaidDriveCard, { props: { disk, selected: false } })
    expect(w.text()).toContain('1000 B')
  })

  it('groupKey passed in → renders the group color stripe', () => {
    const w = mount(RaidDriveCard, { props: { disk, selected: false, groupKey: 'group-a' } })
    expect(w.find('.rdc-stripe').exists()).toBe(true)
  })

  it('no groupKey → does not render the group color stripe', () => {
    const w = mount(RaidDriveCard, { props: { disk, selected: false } })
    expect(w.find('.rdc-stripe').exists()).toBe(false)
  })

  // ── health info display (backfilling the regular info display from Vue2 RaidDriveCard.vue:23-46, not a fault simulator) ──
  it('health dot always shown: a real-device avail disk (empty health string, 38°C) also has a dot, graded good', () => {
    const w = mount(RaidDriveCard, { props: { disk: LIVE_AVAIL_SDA, selected: false } })
    expect(w.find('.rdc-dot').exists()).toBe(true)
    expect(w.find('.rdc-dot--good').exists()).toBe(true)
  })

  it('health score drops → the dot downgrades (46°C and 35000h → bad)', () => {
    const worn = { ...LIVE_AVAIL_SDA, temperature: 46, power_on_time: 35000 }
    const w = mount(RaidDriveCard, { props: { disk: worn, selected: false } })
    expect(w.find('.rdc-dot--bad').exists()).toBe(true)
    expect(w.find('.rdc-dot--good').exists()).toBe(false)
  })

  it('the hover tooltip includes model / temperature / power-on time / health score percentage', () => {
    const w = mount(RaidDriveCard, { props: { disk: LIVE_AVAIL_SDA, selected: false } })
    const tip = w.find('.rdc-tip')
    expect(tip.exists()).toBe(true)
    expect(tip.text()).toContain('scsi_debug')
    expect(tip.text()).toContain('温度')
    expect(tip.text()).toContain('38°C')
    expect(tip.text()).toContain('通电时间')
    expect(tip.text()).toContain('100%')
  })

  it('power-on duration is 0 (real-device fake disk) → shows "-", not 0h', () => {
    const w = mount(RaidDriveCard, { props: { disk: LIVE_AVAIL_SDA, selected: false } })
    expect(w.find('.rdc-tip-poh').text()).toBe('-')
  })

  it('health score progress bar width = the score percentage', () => {
    const w = mount(RaidDriveCard, { props: { disk: { ...LIVE_AVAIL_SDA, temperature: 42 }, selected: false } })
    expect(w.find('.rdc-tip-bar-fill').attributes('style')).toContain('width: 85%')
    expect(w.find('.rdc-tip').text()).toContain('85%')
  })

  it('SMART not passing ("false") → risk border + bad dot + 0%', () => {
    const w = mount(RaidDriveCard, { props: { disk: { ...LIVE_AVAIL_SDA, health: 'false' }, selected: false } })
    expect(w.classes()).toContain('rdc--risk')
    expect(w.find('.rdc-dot--bad').exists()).toBe(true)
    expect(w.find('.rdc-tip').text()).toContain('0%')
  })

  it('temperature missing → shows "-" (not 0°C)', () => {
    const w = mount(RaidDriveCard, { props: { disk: { path: '/dev/sdz', size: 1 }, selected: false } })
    expect(w.find('.rdc-tip-temp').text()).toBe('-')
  })

  // 2026-08-11: the backend puts disks carrying a foreign array's residual superblock into avail (residue), selectable but flagged with a warning;
  // local array members have already been excluded by the backend and will not appear in the candidates.
  it('a residue disk → renders the RAID residue warning tag (title names the owning array)', () => {
    const residue = {
      role: 'residue' as const, array_name: 'zimaos:fc5616382c017331', array_uuid: 'u', level: 'raid5',
      registered: false, active: false,
    }
    const w = mount(RaidDriveCard, { props: { disk: { ...disk, raid: residue }, selected: false } })
    const tag = w.find('.rdc-residue')
    expect(tag.exists()).toBe(true)
    expect(tag.text()).toContain('RAID 残留')
    expect(tag.attributes('title')).toContain('zimaos:fc5616382c017331')
  })

  it('a clean disk → no residue warning tag', () => {
    const w = mount(RaidDriveCard, { props: { disk, selected: false } })
    expect(w.find('.rdc-residue').exists()).toBe(false)
  })
})

// Stacking-context guard. jsdom does not do layout and does not compute stacking contexts, so this defect can only be
// pinned down with a text assertion: the transform on `.rdc:hover` turns the hovered card into a stacking context, trapping
// the tooltip's z-index inside the card, so the tooltip gets covered by subsequent cards / sections below (real-device feedback,
// 2026-07-30). The fix is to raise .rdc:hover itself — whoever deletes this z-index line will make the tooltip get
// covered again, hence this negative guard left here.
describe('RaidDriveCard hover tooltip stacking', () => {
  it('.rdc:hover rule must declare z-index (otherwise the stacking context created by transform will bury the tooltip)', async () => {
    const files = import.meta.glob('./RaidDriveCard.vue', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    const src = Object.values(files)[0]
    const hoverRule = /\.rdc:hover\s*\{([^}]*)\}/.exec(src)
    expect(hoverRule, 'could not find the .rdc:hover rule').not.toBeNull()
    expect(hoverRule![1]).toMatch(/z-index\s*:/)
  })
})

// The color guard is not duplicated here: src/styles/color-guard.test.ts already scans the <style> of every .vue file across the repo.
