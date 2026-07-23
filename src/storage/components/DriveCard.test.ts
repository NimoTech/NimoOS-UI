import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DriveCard from './DriveCard.vue'

const DRIVE = { name: 'nvme0n1', model: 'WPBSNM8-512GTP', size: 512110190592, diskType: 'SSD', healthy: true, temperature: 35 }

describe('DriveCard', () => {
  it('渲染名称/型号/容量/类型', () => {
    const w = mount(DriveCard, { props: { drive: DRIVE } })
    expect(w.text()).toContain('nvme0n1')
    expect(w.text()).toContain('WPBSNM8-512GTP')
    expect(w.text()).toContain('SSD')
    expect(w.text()).toContain('477 GB') // fmtSize(512110190592):≥100 取整 → "477 GB"
  })
  it('健康态:healthy=true 绿色文案,false 危险文案', () => {
    const ok = mount(DriveCard, { props: { drive: DRIVE } })
    expect(ok.find('.dc-health.ok').exists()).toBe(true)
    const bad = mount(DriveCard, { props: { drive: { ...DRIVE, healthy: false } } })
    expect(bad.find('.dc-health.bad').exists()).toBe(true)
  })
  it('温度:>0 显示 °C/°F,否则 N/A', () => {
    const w = mount(DriveCard, { props: { drive: DRIVE } })
    expect(w.text()).toContain('35°C')
    expect(w.text()).toContain('95.0°F')
    const na = mount(DriveCard, { props: { drive: { ...DRIVE, temperature: 0 } } })
    expect(na.text()).toContain('N/A')
  })
})
