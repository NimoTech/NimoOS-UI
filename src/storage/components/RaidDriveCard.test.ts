import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RaidDriveCard from './RaidDriveCard.vue'

const disk = { path: '/dev/sda', size: 1000, disk_type: 'SSD', health: 'true' }

describe('RaidDriveCard', () => {
  it('点卡片 → emit toggle', async () => {
    const w = mount(RaidDriveCard, { props: { disk, selected: false } })
    await w.trigger('click')
    expect(w.emitted('toggle')).toHaveLength(1)
  })

  it('selected=true → 勾选圈显示选中态', () => {
    const w = mount(RaidDriveCard, { props: { disk, selected: true } })
    expect(w.find('.rdc-check--on').exists()).toBe(true)
  })

  it('selected=false → 勾选圈不显示选中态', () => {
    const w = mount(RaidDriveCard, { props: { disk, selected: false } })
    expect(w.find('.rdc-check--on').exists()).toBe(false)
  })

  it('风险盘(health="false") → 标记风险态', () => {
    const risky = { ...disk, health: 'false' }
    const w = mount(RaidDriveCard, { props: { disk: risky, selected: false } })
    expect(w.classes()).toContain('rdc--risk')
  })

  it('健康盘 → 不标记风险态', () => {
    const w = mount(RaidDriveCard, { props: { disk, selected: false } })
    expect(w.classes()).not.toContain('rdc--risk')
  })

  it('容量显示走 fmtSize', () => {
    const w = mount(RaidDriveCard, { props: { disk, selected: false } })
    expect(w.text()).toContain('1000 B')
  })

  it('groupKey 传入 → 渲染分组色条', () => {
    const w = mount(RaidDriveCard, { props: { disk, selected: false, groupKey: 'group-a' } })
    expect(w.find('.rdc-stripe').exists()).toBe(true)
  })

  it('无 groupKey → 不渲染分组色条', () => {
    const w = mount(RaidDriveCard, { props: { disk, selected: false } })
    expect(w.find('.rdc-stripe').exists()).toBe(false)
  })
})
