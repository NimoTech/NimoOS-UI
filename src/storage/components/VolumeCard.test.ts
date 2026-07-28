import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VolumeCard from './VolumeCard.vue'

const VOL = {
  uuid: 'u1', name: 'NimoOS-HD', isSystem: false, fsType: 'ext4',
  size: 512110190592, availSize: 384614653440, usedSize: 127495537152, usePercent: 25,
  driveName: 'nvme0n1p7', path: '/dev/nvme0n1p7', mountPoint: '/', disk: '/dev/nvme0n1',
}

describe('VolumeCard', () => {
  it('渲染名称、文件系统、已用/总量', () => {
    const w = mount(VolumeCard, { props: { volume: VOL } })
    expect(w.text()).toContain('NimoOS-HD')
    expect(w.text()).toContain('EXT4')
    expect(w.text()).toContain('119 GB') // fmtSize(127495537152):≥100 取整 → "119 GB"
    expect(w.text()).toContain('477 GB') // fmtSize(512110190592) → "477 GB"
  })
  it('进度条按占用率上色分级', () => {
    const ok = mount(VolumeCard, { props: { volume: VOL } })
    expect(ok.find('.vc-fill.ok').exists()).toBe(true)
    const warn = mount(VolumeCard, { props: { volume: { ...VOL, usePercent: 85 } } })
    expect(warn.find('.vc-fill.warn').exists()).toBe(true)
    const danger = mount(VolumeCard, { props: { volume: { ...VOL, usePercent: 95 } } })
    expect(danger.find('.vc-fill.danger').exists()).toBe(true)
  })
  it('系统卷:显示 OS 徽标、无移除按钮、无格式化按钮', () => {
    const w = mount(VolumeCard, { props: { volume: { ...VOL, isSystem: true } } })
    expect(w.find('.vc-os').exists()).toBe(true)
    expect(w.find('.vc-act.danger').exists()).toBe(false)
    expect(w.find('.vc-act').exists()).toBe(false)
  })
  it('非系统卷:点移除按钮 emit unmount', async () => {
    const w = mount(VolumeCard, { props: { volume: VOL } })
    await w.find('.vc-act.danger').trigger('click')
    expect(w.emitted('unmount')).toHaveLength(1)
  })
  it('非系统卷:点格式化按钮 emit format', async () => {
    const w = mount(VolumeCard, { props: { volume: VOL } })
    const fmtBtn = w.findAll('.vc-act').find((b) => !b.classes('danger'))!
    await fmtBtn.trigger('click')
    expect(w.emitted('format')).toHaveLength(1)
  })
})
