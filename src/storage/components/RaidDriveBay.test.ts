import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RaidDriveBay from './RaidDriveBay.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// tsconfig lib 目标为 ES2020,Array.prototype.at() 需 ES2022+ 才有类型定义(vue-tsc 报 TS2550);
// 用等价的 arr[arr.length-1] 代替 .at(-1),语义不变(取 emitted 事件最后一次调用的参数)。
function lastCall<T>(calls: T[][] | undefined): T[] {
  const list = calls!
  return list[list.length - 1]
}

const disks = [
  { path: '/dev/sda', size: 1000, disk_type: 'SSD', health: 'true' },
  { path: '/dev/sdb', size: 2000, disk_type: 'HDD', health: 'true' },
  { path: '/dev/sdc', size: 1000, disk_type: 'SSD', health: 'false' }, // 风险盘
]

describe('RaidDriveBay', () => {
  it('点卡片 toggle → emit update:modelValue 含该盘', async () => {
    const w = mount(RaidDriveBay, { props: { disks, modelValue: [] }, global: { plugins: [i18n] } })
    await w.findAllComponents({ name: 'RaidDriveCard' })[0].vm.$emit('toggle')
    const evt = lastCall(w.emitted('update:modelValue'))[0] as any[]
    expect(evt.map((d) => d.path)).toEqual(['/dev/sda'])
  })
  it('全选健康 → 只选非风险盘(排除 health="false")', async () => {
    const w = mount(RaidDriveBay, { props: { disks, modelValue: [] }, global: { plugins: [i18n] } })
    await w.find('.rdb-select-all').trigger('click')
    const evt = lastCall(w.emitted('update:modelValue'))[0] as any[]
    expect(evt.map((d) => d.path).sort()).toEqual(['/dev/sda', '/dev/sdb'])
  })
  it('过滤 SSD → 只显示 SSD 盘', async () => {
    const w = mount(RaidDriveBay, { props: { disks, modelValue: [] }, global: { plugins: [i18n] } })
    await w.find('.rdb-filter-ssd').trigger('click')
    expect(w.findAllComponents({ name: 'RaidDriveCard' })).toHaveLength(2)
  })
  it('汇总条:已选 2 盘 → 显示盘数与容量合计', async () => {
    const w = mount(RaidDriveBay, {
      props: { disks, modelValue: [disks[0], disks[1]] },
      global: { plugins: [i18n] },
    })
    expect(w.find('.rdb-summary').text()).toContain('2')
  })
  it('清空 → emit update:modelValue 空数组', async () => {
    const w = mount(RaidDriveBay, {
      props: { disks, modelValue: [disks[0], disks[1]] },
      global: { plugins: [i18n] },
    })
    await w.find('.rdb-clear').trigger('click')
    const evt = lastCall(w.emitted('update:modelValue'))[0] as any[]
    expect(evt).toEqual([])
  })
  it('过滤 HDD → 只显示 HDD 盘', async () => {
    const w = mount(RaidDriveBay, { props: { disks, modelValue: [] }, global: { plugins: [i18n] } })
    await w.find('.rdb-filter-hdd').trigger('click')
    expect(w.findAllComponents({ name: 'RaidDriveCard' })).toHaveLength(1)
  })
  it('全部过滤 → 显示全部盘', async () => {
    const w = mount(RaidDriveBay, { props: { disks, modelValue: [] }, global: { plugins: [i18n] } })
    await w.find('.rdb-filter-ssd').trigger('click')
    await w.find('.rdb-filter-all').trigger('click')
    expect(w.findAllComponents({ name: 'RaidDriveCard' })).toHaveLength(3)
  })
})
