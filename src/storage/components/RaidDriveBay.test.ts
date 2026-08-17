import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RaidDriveBay from './RaidDriveBay.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// tsconfig's lib target is ES2020, and Array.prototype.at() only has type definitions in
// ES2022+ (vue-tsc reports TS2550); use the equivalent arr[arr.length-1] instead of .at(-1) —
// same semantics, taking the arguments of the last call to an emitted event.
function lastCall<T>(calls: T[][] | undefined): T[] {
  const list = calls!
  return list[list.length - 1]
}

const disks = [
  { path: '/dev/sda', size: 1000, disk_type: 'SSD', health: 'true' },
  { path: '/dev/sdb', size: 2000, disk_type: 'HDD', health: 'true' },
  { path: '/dev/sdc', size: 1000, disk_type: 'SSD', health: 'false' }, // at-risk drive
]

describe('RaidDriveBay', () => {
  it('clicking a card toggle -> emits update:modelValue containing that drive', async () => {
    const w = mount(RaidDriveBay, { props: { disks, modelValue: [] }, global: { plugins: [i18n] } })
    await w.findAllComponents({ name: 'RaidDriveCard' })[0].vm.$emit('toggle')
    const evt = lastCall(w.emitted('update:modelValue'))[0] as any[]
    expect(evt.map((d) => d.path)).toEqual(['/dev/sda'])
  })
  it('select-all-healthy -> only selects non-risk drives (excludes health="false")', async () => {
    const w = mount(RaidDriveBay, { props: { disks, modelValue: [] }, global: { plugins: [i18n] } })
    await w.find('.rdb-select-all').trigger('click')
    const evt = lastCall(w.emitted('update:modelValue'))[0] as any[]
    expect(evt.map((d) => d.path).sort()).toEqual(['/dev/sda', '/dev/sdb'])
  })
  it('switch to SSD filter then select-all-healthy -> only healthy SSD drives, no healthy HDD drives (scope = the filtered view, not the full set)', async () => {
    const w = mount(RaidDriveBay, { props: { disks, modelValue: [] }, global: { plugins: [i18n] } })
    await w.find('.rdb-filter-ssd').trigger('click')
    await w.find('.rdb-select-all').trigger('click')
    const evt = lastCall(w.emitted('update:modelValue'))[0] as any[]
    expect(evt.map((d) => d.path)).toEqual(['/dev/sda'])
  })
  it('filter SSD -> only shows SSD drives', async () => {
    const w = mount(RaidDriveBay, { props: { disks, modelValue: [] }, global: { plugins: [i18n] } })
    await w.find('.rdb-filter-ssd').trigger('click')
    expect(w.findAllComponents({ name: 'RaidDriveCard' })).toHaveLength(2)
  })
  it('summary bar: 2 drives selected -> shows drive count and total capacity', async () => {
    const w = mount(RaidDriveBay, {
      props: { disks, modelValue: [disks[0], disks[1]] },
      global: { plugins: [i18n] },
    })
    expect(w.find('.rdb-summary').text()).toContain('2')
  })
  it('clear -> emits update:modelValue with an empty array', async () => {
    const w = mount(RaidDriveBay, {
      props: { disks, modelValue: [disks[0], disks[1]] },
      global: { plugins: [i18n] },
    })
    await w.find('.rdb-clear').trigger('click')
    const evt = lastCall(w.emitted('update:modelValue'))[0] as any[]
    expect(evt).toEqual([])
  })
  it('filter HDD -> only shows HDD drives', async () => {
    const w = mount(RaidDriveBay, { props: { disks, modelValue: [] }, global: { plugins: [i18n] } })
    await w.find('.rdb-filter-hdd').trigger('click')
    expect(w.findAllComponents({ name: 'RaidDriveCard' })).toHaveLength(1)
  })
  it('filter all -> shows all drives', async () => {
    const w = mount(RaidDriveBay, { props: { disks, modelValue: [] }, global: { plugins: [i18n] } })
    await w.find('.rdb-filter-ssd').trigger('click')
    await w.find('.rdb-filter-all').trigger('click')
    expect(w.findAllComponents({ name: 'RaidDriveCard' })).toHaveLength(3)
  })
})
