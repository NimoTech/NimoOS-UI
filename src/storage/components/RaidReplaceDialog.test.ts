import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RaidReplaceDialog from './RaidReplaceDialog.vue'
import zh from '../../i18n/zh_cn'
import type { ReplaceTarget, CandidateDiskLike } from '../util/raidReplace'
import type { DiskRaidInfo } from '@nimotech/nimoos-service'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// attachTo: document.body mount (reka-ui Portal teleports to body) — same lesson as
// RaidDeleteDialog.test.ts/FormatDialog.test.ts in this directory: body must be cleared between tests.
beforeEach(() => {
  document.body.innerHTML = ''
})

const RESIDUE: DiskRaidInfo = {
  role: 'residue', array_name: 'zimaos:fc5616382c017331', array_uuid: 'u-1', level: 'raid5',
  registered: false, active: false,
  created_at: 'Thu Aug  6 21:54:49 2026', updated_at: 'Fri Aug  7 00:29:17 2026',
}
const disks: CandidateDiskLike[] = [
  { path: '/dev/sda', size: 1000, serial: 'S-A' },
  { path: '/dev/sdb', size: 2000, serial: 'S-B', raid: RESIDUE },
  { path: '/dev/sdc', size: 3000, serial: 'S-C' },
]
// In-place faulty disk: path is trustworthy, label = path
const faultyTarget: ReplaceTarget = { path: '/dev/sdc', serial: 'S-C', label: '/dev/sdc' }
// Pulled disk: path is empty (cached path is untrustworthy), label = serial
const pulledTarget: ReplaceTarget = { path: '', serial: 'OLD-4', label: 'OLD-4' }

const flush = () => new Promise((r) => setTimeout(r))
const q = <T extends Element>(sel: string) => document.body.querySelector<T>(sel)
async function pick(value: string) {
  const select = q<HTMLSelectElement>('.rrd-select')!
  select.value = value
  select.dispatchEvent(new Event('change'))
  await flush()
}

describe('RaidReplaceDialog', () => {
  const mountIt = (props: Record<string, unknown> = {}) =>
    mount(RaidReplaceDialog, {
      props: { open: true, raidId: 7, target: faultyTarget, disks, ...props },
      global: { plugins: [i18n] },
      attachTo: document.body,
    })

  it('candidate disks are filtered through filterReplacementCandidates: excludes the disk being replaced by serial', async () => {
    mountIt()
    await flush()
    const values = Array.from(q<HTMLSelectElement>('.rrd-select')!.options).map((o) => o.value).filter(Boolean)
    expect(values).toEqual(['/dev/sda', '/dev/sdb'])
  })

  it('pulled disk (target.path empty): faulty disk shows the serial, and a new disk sitting on the old path is not excluded', async () => {
    mountIt({ target: pulledTarget })
    await flush()
    // The faulty disk is shown inside a disabled <input>; value doesn't end up in textContent, so it must be checked via .value separately
    const input = q<HTMLInputElement>('.rrd-input')!
    expect(input.value).toBe('OLD-4')
    expect(input.disabled).toBe(true)
    const values = Array.from(q<HTMLSelectElement>('.rrd-select')!.options).map((o) => o.value).filter(Boolean)
    expect(values).toEqual(['/dev/sda', '/dev/sdb', '/dev/sdc'])
  })

  it('confirm button is disabled until a new disk is selected, then enabled', async () => {
    mountIt()
    await flush()
    expect(q<HTMLButtonElement>('.rrd-ok')!.disabled).toBe(true)
    await pick('/dev/sda')
    expect(q<HTMLButtonElement>('.rrd-ok')!.disabled).toBe(false)
  })

  it('selecting a non-residue disk and confirming → directly emits confirm({newDiskPath, wipeResidue:false}), no second confirmation', async () => {
    const w = mountIt()
    await flush()
    await pick('/dev/sda')
    q<HTMLButtonElement>('.rrd-ok')!.click()
    expect(w.emitted('confirm')).toHaveLength(1)
    expect(w.emitted('confirm')![0]).toEqual([{ newDiskPath: '/dev/sda', wipeResidue: false }])
  })

  it('residue disk option gets a warning flag + shows its owning array explanation once selected', async () => {
    mountIt()
    await flush()
    const residueOption = Array.from(q<HTMLSelectElement>('.rrd-select')!.options).find((o) => o.value === '/dev/sdb')!
    expect(residueOption.textContent).toContain('RAID 残留')
    expect(q('.rrd-residue-hint')).toBeNull()
    await pick('/dev/sdb')
    expect(q('.rrd-residue-hint')!.textContent).toContain('zimaos:fc5616382c017331')
  })

  it('selecting a residue disk and confirming → first shows the wipe confirmation (naming the array/created/last-active), only emits wipeResidue:true after confirming', async () => {
    const w = mountIt()
    await flush()
    await pick('/dev/sdb')
    q<HTMLButtonElement>('.rrd-ok')!.click()
    await flush()
    // Step one: does not emit, switches to the wipe confirmation
    expect(w.emitted('confirm')).toBeUndefined()
    const msg = q('.rrd-wipe-msg')!
    expect(msg.textContent).toContain('zimaos:fc5616382c017331')
    expect(msg.textContent).toContain('Thu Aug  6 21:54:49 2026')
    expect(msg.textContent).toContain('Fri Aug  7 00:29:17 2026')
    // Step two: wipe and rebuild
    q<HTMLButtonElement>('.rrd-wipe')!.click()
    expect(w.emitted('confirm')![0]).toEqual([{ newDiskPath: '/dev/sdb', wipeResidue: true }])
  })

  it('the wipe confirmation step can be cancelled: returns to the disk-selection step, no emit', async () => {
    const w = mountIt()
    await flush()
    await pick('/dev/sdb')
    q<HTMLButtonElement>('.rrd-ok')!.click()
    await flush()
    q<HTMLButtonElement>('.rrd-cancel')!.click()
    await flush()
    expect(q('.rrd-wipe-msg')).toBeNull()
    expect(q<HTMLSelectElement>('.rrd-select')).not.toBeNull()
    expect(w.emitted('confirm')).toBeUndefined()
  })

  it('both opening and closing clear the selected new disk and the confirmation step', async () => {
    const w = mountIt()
    await flush()
    await pick('/dev/sdb')
    q<HTMLButtonElement>('.rrd-ok')!.click()
    await flush()
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    await flush()
    expect(q('.rrd-wipe-msg')).toBeNull()
    expect(q<HTMLSelectElement>('.rrd-select')!.value).toBe('')
  })

  it('confirm button is disabled while busy', async () => {
    mountIt({ busy: true })
    await flush()
    await pick('/dev/sda')
    expect(q<HTMLButtonElement>('.rrd-ok')!.disabled).toBe(true)
  })

  it('the faulty disk is shown read-only as target.label (an in-place disk = live path)', async () => {
    mountIt()
    await flush()
    const input = q<HTMLInputElement>('.rrd-input')!
    expect(input.value).toBe('/dev/sdc')
    expect(input.disabled).toBe(true)
  })
})
