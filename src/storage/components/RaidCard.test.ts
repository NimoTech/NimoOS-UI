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
  it('降级态:severity=danger', () => {
    const w = mountCard({ id: 1, name: 'a', level: 1, state: 'degraded' }, { live_state: 'degraded', state: 'degraded', rebuild_pct: 0, members: [], total_bytes: 0, used_bytes: 0, free_bytes: 0 })
    expect(w.find('.rc-badge.danger').exists()).toBe(true)
  })
  it('重建态:显示进度百分比', () => {
    const w = mountCard({ id: 1, name: 'a', level: 1, state: 'rebuilding' }, { live_state: 'recovering', rebuild_pct: 42.37, rebuild_finish: '2min', rebuild_speed: '100M/s', members: [], total_bytes: 0, used_bytes: 0, free_bytes: 0 })
    expect(w.find('.rc-badge.info').exists()).toBe(true)
    expect(w.text()).toContain('42.4') // rebuild_pct 保留 0.1
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
})
