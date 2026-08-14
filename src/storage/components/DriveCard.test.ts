import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DriveCard from './DriveCard.vue'
import type { PhysicalDrive } from '../util/storageMap'
import type { DiskRaidInfo } from '@nimotech/nimoos-service'

// 详情弹窗经 reka-ui Portal Teleport 到 body(同目录 RaidReplaceDialog.test.ts 同款教训):
// 断言弹窗内容须查 document.body,测试间清空 body。
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
  it('渲染名称/型号/容量/类型', () => {
    const w = mountIt()
    expect(w.text()).toContain('nvme0n1')
    expect(w.text()).toContain('WPBSNM8-512GTP')
    expect(w.text()).toContain('SSD')
    expect(w.text()).toContain('477 GB') // fmtSize(512110190592):≥100 取整 → "477 GB"
  })
  it('健康态:healthy=true 绿色文案,false 危险文案', () => {
    const ok = mountIt()
    expect(ok.find('.dc-health.ok').exists()).toBe(true)
    const bad = mountIt({ ...DRIVE, healthy: false, health: 'false' })
    expect(bad.find('.dc-health.bad').exists()).toBe(true)
  })
  it('温度:>0 显示 °C/°F,否则 N/A', () => {
    const w = mountIt()
    expect(w.text()).toContain('35°C')
    expect(w.text()).toContain('95.0°F')
    const na = mountIt({ ...DRIVE, temperature: 0 })
    expect(na.text()).toContain('N/A')
  })
  it('序列号 + 通电时长(pohDisplay:<1000h 原样,≥1000h 换算年一位小数)', () => {
    const w = mountIt({ ...DRIVE, powerOnHours: 950 })
    expect(w.text()).toContain('WD-WCC4J2JXS3YH')
    expect(w.text()).toContain('950h')
    const old = mountIt({ ...DRIVE, powerOnHours: 26280 })
    expect(old.text()).toContain('3.0yr')
    // 无通电数据不显示该段
    const none = mountIt({ ...DRIVE, powerOnHours: 0 })
    expect(none.text()).not.toContain('通电时间')
  })
  it('RAID 身份标:member → 中性标(级别 · 阵列名);residue → 警告标;干净盘无标', () => {
    const member = mountIt({ ...DRIVE, raid: MEMBER_RAID })
    expect(member.find('.dc-tag').exists()).toBe(true)
    expect(member.find('.dc-tag').text()).toBe('RAID10 · raid10')
    expect(member.find('.dc-tag.warn').exists()).toBe(false)
    const residue = mountIt({ ...DRIVE, raid: RESIDUE_RAID })
    expect(residue.find('.dc-tag.warn').text()).toContain('RAID 残留')
    const clean = mountIt()
    expect(clean.find('.dc-tag').exists()).toBe(false)
  })
  it('点卡片开详情弹窗:完整身份 + 分区表', async () => {
    const w = mountIt()
    await w.trigger('click')
    await new Promise((r) => setTimeout(r))
    const body = document.body.textContent || ''
    expect(body).toContain('磁盘详情')
    expect(body).toContain('/dev/nvme0n1')
    expect(body).toContain('nvme-WPBSNM8-512GTP_123') // disk_by_id
    expect(body).toContain('WD-WCC4J2JXS3YH')
    // 分区行:名称/格式/挂载点/已用
    expect(body).toContain('nvme0n1p1')
    expect(body).toContain('btrfs')
    expect(body).toContain('/media/x')
  })
  it('详情弹窗健康三态:严格比较字符串,"false" 显示损坏、空串显示 —(不可真值判断)', async () => {
    const w = mountIt({ ...DRIVE, health: 'false', healthy: false })
    await w.trigger('click')
    await new Promise((r) => setTimeout(r))
    expect(document.body.querySelector('.ddd-val.bad')!.textContent).toContain('损坏')
    expect(document.body.querySelector('.ddd-val.ok')).toBeNull()
  })
  it('详情弹窗 residue:警告框点名残留阵列 + 创建/最后活动时间', async () => {
    const w = mountIt({ ...DRIVE, raid: RESIDUE_RAID })
    await w.trigger('click')
    await new Promise((r) => setTimeout(r))
    const box = document.body.querySelector('.ddd-raid.warn')!
    expect(box).not.toBeNull()
    expect(box.textContent).toContain('zimaos:fc5616382c017331')
    expect(box.textContent).toContain('Thu Aug  6 21:54:49 2026')
    expect(box.textContent).toContain('Fri Aug  7 00:29:17 2026')
  })
  it('详情弹窗 member:中性框写明阵列/级别/md 设备', async () => {
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
