import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RaidDriveCard from './RaidDriveCard.vue'

const disk = { path: '/dev/sda', size: 1000, disk_type: 'SSD', health: 'true' }

// 真机逐字取值(2026-07-30,`curl -s http://127.0.0.1/v1/disks` 的 data.avail[0],raidlab 假盘):
// {"name":"sda","size":536870912,"model":"scsi_debug","health":"","temperature":38,
//  "power_on_time":0,"disk_type":"SSD","need_format":true,"serial":"2000","path":"/dev/sda", ...}
// health 是空串(后端 avail 赋值顺序缺陷),temperature/power_on_time/disk_type 都有值。
const LIVE_AVAIL_SDA = {
  path: '/dev/sda', size: 536870912, model: 'scsi_debug',
  health: '', temperature: 38, power_on_time: 0, disk_type: 'SSD',
}

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

  // ── 健康信息展示(补迁 Vue2 RaidDriveCard.vue:23-46 的常规信息展示,非故障模拟器)──
  it('健康色点常显:真机 avail 盘(health 空串、38°C)也有色点,分级为 good', () => {
    const w = mount(RaidDriveCard, { props: { disk: LIVE_AVAIL_SDA, selected: false } })
    expect(w.find('.rdc-dot').exists()).toBe(true)
    expect(w.find('.rdc-dot--good').exists()).toBe(true)
  })

  it('健康分下降 → 色点降级(46°C 且 35000h → bad)', () => {
    const worn = { ...LIVE_AVAIL_SDA, temperature: 46, power_on_time: 35000 }
    const w = mount(RaidDriveCard, { props: { disk: worn, selected: false } })
    expect(w.find('.rdc-dot--bad').exists()).toBe(true)
    expect(w.find('.rdc-dot--good').exists()).toBe(false)
  })

  it('悬浮提示含型号 / 温度 / 通电时间 / 健康分百分比', () => {
    const w = mount(RaidDriveCard, { props: { disk: LIVE_AVAIL_SDA, selected: false } })
    const tip = w.find('.rdc-tip')
    expect(tip.exists()).toBe(true)
    expect(tip.text()).toContain('scsi_debug')
    expect(tip.text()).toContain('温度')
    expect(tip.text()).toContain('38°C')
    expect(tip.text()).toContain('通电时间')
    expect(tip.text()).toContain('100%')
  })

  it('通电时长为 0(真机假盘)→ 显示 "-",不显示 0h', () => {
    const w = mount(RaidDriveCard, { props: { disk: LIVE_AVAIL_SDA, selected: false } })
    expect(w.find('.rdc-tip-poh').text()).toBe('-')
  })

  it('健康分进度条宽度 = 分数百分比', () => {
    const w = mount(RaidDriveCard, { props: { disk: { ...LIVE_AVAIL_SDA, temperature: 42 }, selected: false } })
    expect(w.find('.rdc-tip-bar-fill').attributes('style')).toContain('width: 85%')
    expect(w.find('.rdc-tip').text()).toContain('85%')
  })

  it('SMART 未过("false")→ 风险边框 + 色点 bad + 0%', () => {
    const w = mount(RaidDriveCard, { props: { disk: { ...LIVE_AVAIL_SDA, health: 'false' }, selected: false } })
    expect(w.classes()).toContain('rdc--risk')
    expect(w.find('.rdc-dot--bad').exists()).toBe(true)
    expect(w.find('.rdc-tip').text()).toContain('0%')
  })

  it('温度缺值 → 显示 "-"(不显示 0°C)', () => {
    const w = mount(RaidDriveCard, { props: { disk: { path: '/dev/sdz', size: 1 }, selected: false } })
    expect(w.find('.rdc-tip-temp').text()).toBe('-')
  })

  // 2026-08-11:后端把带外来阵列残留超块的盘放进 avail(residue),可选但要打警告标;
  // 本机阵列成员(member)后端已剔除,不会出现在候选里。
  it('residue 盘 → 渲染 RAID 残留警告标(title 点名归属阵列)', () => {
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

  it('干净盘 → 无残留警告标', () => {
    const w = mount(RaidDriveCard, { props: { disk, selected: false } })
    expect(w.find('.rdc-residue').exists()).toBe(false)
  })
})

// 层叠守卫。jsdom 不做布局也不算层叠上下文,这个缺陷只能靠文本断言钉住:
// `.rdc:hover` 的 transform 会让被悬停的卡片成为层叠上下文,把提示的 z-index 关在卡片内部,
// 于是提示被后续卡片/下方区块盖住(2026-07-30 实盘反馈)。解法是给 .rdc:hover 自身抬层 ——
// 谁把这句 z-index 删了,提示就会重新被挡住,故在此留一条负向守卫。
describe('RaidDriveCard 悬浮提示层叠', () => {
  it('.rdc:hover 规则里必须声明 z-index(否则 transform 造出的层叠上下文会埋掉提示)', async () => {
    const files = import.meta.glob('./RaidDriveCard.vue', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    const src = Object.values(files)[0]
    const hoverRule = /\.rdc:hover\s*\{([^}]*)\}/.exec(src)
    expect(hoverRule, '找不到 .rdc:hover 规则').not.toBeNull()
    expect(hoverRule![1]).toMatch(/z-index\s*:/)
  })
})

// 配色守卫不在此重复:src/styles/color-guard.test.ts 已全仓扫描所有 .vue 的 <style>。
