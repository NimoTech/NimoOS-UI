import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DriveCard from './DriveCard.vue'
import type { PhysicalDrive } from '../util/storageMap'
import type { DiskRaidInfo } from '@nimotech/nimoos-service'

// The detail dialog teleports to body via reka-ui Portal (same lesson as RaidReplaceDialog.test.ts
// in this directory): asserting dialog content must query document.body; body must be cleared between tests.
beforeEach(() => {
  document.body.innerHTML = ''
})

const DRIVE: PhysicalDrive = {
  name: 'nvme0n1', model: 'WPBSNM8-512GTP', size: 512110190592, diskType: 'SSD',
  healthy: true, health: 'true', temperature: 35,
  serial: 'WD-WCC4J2JXS3YH', path: '/dev/nvme0n1', diskById: 'nvme-WPBSNM8-512GTP_123',
  powerOnHours: 2494,
  children: [{ name: 'nvme0n1p1', format: 'btrfs', size: 512000000000, usedBytes: 763134341120, mountPoint: '/media/x' }],
  raid: null,
}
const MEMBER_RAID: DiskRaidInfo = {
  role: 'member', array_name: 'raid10', array_uuid: 'u-1', level: 'raid10',
  md_device: '/dev/md127', registered: true, active: true,
}
const RESIDUE_RAID: DiskRaidInfo = {
  role: 'residue', array_name: 'zimaos:fc5616382c017331', array_uuid: 'u-2', level: 'raid5',
  registered: false, active: false,
  created_at: 'Thu Aug  6 21:54:49 2026', updated_at: 'Fri Aug  7 00:29:17 2026',
}

const mountIt = (drive: PhysicalDrive = DRIVE) =>
  mount(DriveCard, { props: { drive }, attachTo: document.body })

describe('DriveCard', () => {
  it('renders name/model/capacity/type', () => {
    const w = mountIt()
    expect(w.text()).toContain('nvme0n1')
    expect(w.text()).toContain('WPBSNM8-512GTP')
    expect(w.text()).toContain('SSD')
    expect(w.text()).toContain('477 GB') // fmtSize(512110190592): rounds to an integer at ≥100 → "477 GB"
  })
  it('health state: healthy=true shows success-styled text, false shows danger text', () => {
    const ok = mountIt()
    expect(ok.find('.dc-health.ok').exists()).toBe(true)
    const bad = mountIt({ ...DRIVE, healthy: false, health: 'false' })
    expect(bad.find('.dc-health.bad').exists()).toBe(true)
  })
  it('temperature: shows °C/°F when >0, otherwise N/A', () => {
    const w = mountIt()
    expect(w.text()).toContain('35°C')
    expect(w.text()).toContain('95.0°F')
    const na = mountIt({ ...DRIVE, temperature: 0 })
    expect(na.text()).toContain('N/A')
  })
  it('serial number + power-on duration (pohDisplay: <1000h as-is, ≥1000h converted to years with one decimal place)', () => {
    const w = mountIt({ ...DRIVE, powerOnHours: 950 })
    expect(w.text()).toContain('WD-WCC4J2JXS3YH')
    expect(w.text()).toContain('950h')
    const old = mountIt({ ...DRIVE, powerOnHours: 26280 })
    expect(old.text()).toContain('3.0yr')
    // No power-on data → this section is not shown
    const none = mountIt({ ...DRIVE, powerOnHours: 0 })
    expect(none.text()).not.toContain('通电时间')
  })
  it('RAID identity tag: member → neutral tag (level · array name); residue → warning tag; clean disk has no tag', () => {
    const member = mountIt({ ...DRIVE, raid: MEMBER_RAID })
    expect(member.find('.dc-tag').exists()).toBe(true)
    expect(member.find('.dc-tag').text()).toBe('RAID10 · raid10')
    expect(member.find('.dc-tag.warn').exists()).toBe(false)
    const residue = mountIt({ ...DRIVE, raid: RESIDUE_RAID })
    expect(residue.find('.dc-tag.warn').text()).toContain('RAID 残留')
    const clean = mountIt()
    expect(clean.find('.dc-tag').exists()).toBe(false)
  })
  it('clicking the card opens the detail dialog: full identity + partition table', async () => {
    const w = mountIt()
    await w.trigger('click')
    await new Promise((r) => setTimeout(r))
    const body = document.body.textContent || ''
    expect(body).toContain('磁盘详情')
    expect(body).toContain('/dev/nvme0n1')
    expect(body).toContain('nvme-WPBSNM8-512GTP_123') // disk_by_id
    expect(body).toContain('WD-WCC4J2JXS3YH')
    // Partition row: name/format/mount point/used
    expect(body).toContain('nvme0n1p1')
    expect(body).toContain('btrfs')
    expect(body).toContain('/media/x')
  })
  it('detail dialog health three-state: strict string comparison, "false" shows damaged, empty string shows — (cannot use a truthy check)', async () => {
    const w = mountIt({ ...DRIVE, health: 'false', healthy: false })
    await w.trigger('click')
    await new Promise((r) => setTimeout(r))
    expect(document.body.querySelector('.ddd-val.bad')!.textContent).toContain('损坏')
    expect(document.body.querySelector('.ddd-val.ok')).toBeNull()
  })
  it('detail dialog residue: warning box names the residual array + creation/last-active time', async () => {
    const w = mountIt({ ...DRIVE, raid: RESIDUE_RAID })
    await w.trigger('click')
    await new Promise((r) => setTimeout(r))
    const box = document.body.querySelector('.ddd-raid.warn')!
    expect(box).not.toBeNull()
    expect(box.textContent).toContain('zimaos:fc5616382c017331')
    expect(box.textContent).toContain('Thu Aug  6 21:54:49 2026')
    expect(box.textContent).toContain('Fri Aug  7 00:29:17 2026')
  })
  it('detail dialog member: neutral box states the array/level/md device', async () => {
    const w = mountIt({ ...DRIVE, raid: MEMBER_RAID })
    await w.trigger('click')
    await new Promise((r) => setTimeout(r))
    const box = document.body.querySelector('.ddd-raid.info')!
    expect(box).not.toBeNull()
    expect(box.textContent).toContain('RAID10')
    expect(box.textContent).toContain('raid10')
    expect(box.textContent).toContain('/dev/md127')
  })
})
