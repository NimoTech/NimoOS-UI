import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import type { RaidStatus } from '@nimotech/nimoos-service'
import RaidCard from './RaidCard.vue'
import zh from '../../i18n/zh_cn'
import type { RaidArray } from '../util/raidView'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountCard = (array: Record<string, unknown>, status?: Record<string, unknown>) =>
  mount(RaidCard, {
    props: { array: array as unknown as RaidArray, status: status as unknown as RaidStatus | undefined },
    global: { plugins: [i18n] },
  })

describe('RaidCard', () => {
  it('渲染名称与 RAID {level} 徽章', () => {
    const w = mountCard({ id: 1, name: 'md0', level: 1, state: 'active' })
    expect(w.text()).toContain('md0')
    expect(w.text()).toContain('RAID 1')
  })
  it('健康态:severity=ok 徽章类', () => {
    const w = mountCard({ id: 1, name: 'a', level: 1, state: 'active' }, { live_state: 'active', state: 'active', rebuild_pct: 0, members: [], total_bytes: 0, used_bytes: 0, free_bytes: 0 })
    expect(w.find('.rc-badge.ok').exists()).toBe(true)
  })
  // 分母回归:降级时活体成员条数(空槽位 + 故障盘各一条)比阵列实际盘位多 1,
  // 分母必须取数据库登记的 member_disks 条数,否则 3 盘阵列坏 1 块会显示 "2/4"。
  it('降级 RAID5:在线磁盘分母取 member_disks 条数,不取活体成员条数', () => {
    const w = mountCard(
      { id: 1, name: 'a', level: 5, state: 'degraded', member_disks: [{}, {}, {}] },
      { live_state: 'clean, degraded', state: 'degraded', rebuild_pct: -1, total_bytes: 0, used_bytes: 0, free_bytes: 0,
        members: [
          { path: '', state: 'removed', number: 0 },
          { path: '/dev/sdb', state: 'active sync', number: 1 },
          { path: '/dev/sdc', state: 'active sync', number: 3 },
          { path: '/dev/sda', state: 'faulty', number: 0 },
        ] },
    )
    expect(w.find('.rc-online').text()).toContain('2/3')
    expect(w.find('.rc-online').text()).not.toContain('2/4')
  })
  it('member_disks 缺失时回退活体成员条数(不显示 x/0)', () => {
    const w = mountCard(
      { id: 1, name: 'a', level: 1, state: 'active' },
      { live_state: 'active', state: 'active', rebuild_pct: 0, total_bytes: 0, used_bytes: 0, free_bytes: 0,
        members: [
          { path: '/dev/sda', state: 'active sync', number: 0 },
          { path: '/dev/sdb', state: 'active sync', number: 1 },
        ] },
    )
    expect(w.find('.rc-online').text()).toContain('2/2')
  })
  // 一个方块 = 一个阵列盘位。降级时 mdadm 多报一条"被踢出槽位的故障盘",
  // 不按槽位过滤就会出现 4 个方块却同时写「2/3」,同一张卡上分母自相矛盾。
  it('降级 RAID5:方块数 = 阵列盘位数(3),不是成员行数(4)', () => {
    const w = mountCard(
      { id: 1, name: 'a', level: 5, state: 'degraded', member_disks: [{}, {}, {}] },
      { live_state: 'clean, degraded', state: 'degraded', rebuild_pct: -1, total_bytes: 0, used_bytes: 0, free_bytes: 0,
        members: [
          { path: '/dev/sdd', state: 'active sync', number: 4, slot: 0 },
          { path: '', state: 'removed', number: 1, slot: 1 },
          { path: '/dev/sdc', state: 'active sync', number: 3, slot: 2 },
          { path: '/dev/sdb', state: 'faulty', number: 1, slot: -1 },
        ] },
    )
    const sq = w.findAll('.rc-sq')
    expect(sq.length).toBe(3)
    // 只有 1 个红 ✕(空出来的槽位),不是 2 个 —— 2 个会读成"坏了两块盘"
    expect(w.findAll('.rc-sq.fail').length).toBe(1)
    expect(w.findAll('.rc-sq.ok').length).toBe(2)
    // 方块数与文字分母一致
    expect(w.find('.rc-online').text()).toContain('2/3')
  })
  it('老后端不带 slot → 方块退回按成员行渲染(不变成 0 个)', () => {
    const w = mountCard(
      { id: 1, name: 'a', level: 1, state: 'active', member_disks: [{}, {}] },
      { live_state: 'active', state: 'active', rebuild_pct: 0, total_bytes: 0, used_bytes: 0, free_bytes: 0,
        members: [
          { path: '/dev/sda', state: 'active sync', number: 0 },
          { path: '/dev/sdb', state: 'active sync', number: 1 },
        ] },
    )
    expect(w.findAll('.rc-sq').length).toBe(2)
  })
  it('降级态:severity=danger', () => {
    const w = mountCard({ id: 1, name: 'a', level: 1, state: 'degraded' }, { live_state: 'degraded', state: 'degraded', rebuild_pct: 0, members: [], total_bytes: 0, used_bytes: 0, free_bytes: 0 })
    expect(w.find('.rc-badge.danger').exists()).toBe(true)
  })
  it('重建态:显示进度百分比', () => {
    const w = mountCard({ id: 1, name: 'a', level: 1, state: 'rebuilding' }, { live_state: 'recovering', rebuild_pct: 42.37, rebuild_finish: '2min', rebuild_speed: '100M/s', members: [], total_bytes: 0, used_bytes: 0, free_bytes: 0 })
    expect(w.find('.rc-badge.info').exists()).toBe(true)
    expect(w.text()).toContain('42.4') // rebuild_pct 保留 0.1
  })
  // rebuild_eta_seconds(2026-08-12 契约):位图增量同步时内核 rebuild_finish 按已拷贝
  // 字节算、会膨胀到几周 —— 卡片必须优先按位置推进速率的诚实估算。
  it('重建态优先 rebuild_eta_seconds:显示「剩余约 …」,不显示内核膨胀串', () => {
    const w = mountCard(
      { id: 1, name: 'a', level: 1, state: 'rebuilding' },
      { live_state: 'recovering', rebuild_pct: 42, rebuild_finish: '18926.6min', rebuild_eta_seconds: 35 * 60, members: [], total_bytes: 0, used_bytes: 0, free_bytes: 0 },
    )
    expect(w.text()).toContain('剩余约 35 分钟')
    expect(w.text()).not.toContain('18926')
  })
  it('容量 used/total 用 fmtSize', () => {
    const w = mountCard({ id: 1, name: 'a', level: 1, state: 'active' }, { live_state: 'active', total_bytes: 2147483648, used_bytes: 1073741824, free_bytes: 1073741824, members: [], rebuild_pct: 0 })
    expect(w.text()).toMatch(/1(\.0)?\s?GB/i) // fmtSize(1073741824)
  })
  it('点击卡片 emit select', async () => {
    const w = mountCard({ id: 5, name: 'a', level: 1, state: 'active' })
    await w.find('.raid-card').trigger('click')
    expect(w.emitted('select')).toBeTruthy()
  })
  it('成员方块:active/faulty/rebuild 各类', () => {
    const w = mountCard({ id: 1, name: 'a', level: 1, state: 'degraded' }, {
      live_state: 'degraded', rebuild_pct: 0, total_bytes: 0, used_bytes: 0, free_bytes: 0,
      members: [
        { path: '/dev/sda', state: 'active sync', number: 0 },
        { path: '/dev/sdb', state: 'faulty', number: 1 },
      ],
    })
    expect(w.findAll('.rc-sq.ok').length).toBe(1)
    expect(w.findAll('.rc-sq.fail').length).toBe(1)
  })
  // reattachable_members(2026-08-12 契约):降级且本阵列成员盘已插回时,卡上给出
  // 可收回提示(动作入口在详情页)。身份首选 serial,path 只是无 serial 时的兜底。
  it('reattachable_members 非空:显示可收回提示,serial 优先', () => {
    const w = mountCard(
      { id: 1, name: 'a', level: 5, state: 'degraded' },
      { live_state: 'degraded', state: 'degraded', rebuild_pct: 0, members: [], total_bytes: 0, used_bytes: 0, free_bytes: 0,
        reattachable_members: [
          { path: '/dev/sdc', serial: 'WD-XYZ123', role: 'Active device 1', last_update: 'Wed Aug 12 03:43:02 2026' },
          { path: '/dev/sdd', serial: '', role: 'Active device 2', last_update: 'Wed Aug 12 03:43:02 2026' },
        ] },
    )
    const hint = w.find('.rc-reattach')
    expect(hint.exists()).toBe(true)
    expect(hint.text()).toContain('WD-XYZ123, /dev/sdd') // serial 优先,缺席退 path
  })
  it('无 reattachable_members(健康阵列/老后端)不渲染提示', () => {
    const w = mountCard(
      { id: 1, name: 'a', level: 5, state: 'degraded' },
      { live_state: 'degraded', state: 'degraded', rebuild_pct: 0, members: [], total_bytes: 0, used_bytes: 0, free_bytes: 0 },
    )
    expect(w.find('.rc-reattach').exists()).toBe(false)
  })
})
