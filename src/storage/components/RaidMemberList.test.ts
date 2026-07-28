import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RaidMemberList from './RaidMemberList.vue'
import zh from '../../i18n/zh_cn'
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

describe('RaidMemberList', () => {
  it('非 RAID10:平铺渲染成员', () => {
    const w = mount(RaidMemberList, { props: { level: 1, members: [
      { path: '/dev/sda', state: 'active sync', number: 0 },
      { path: '/dev/sdb', state: 'faulty', number: 1 },
    ] }, global: { plugins: [i18n] } })
    expect(w.findAll('.rml-row').length).toBe(2)
    expect(w.text()).toContain('/dev/sda')
  })
  it('RAID10:按镜像对分组', () => {
    const w = mount(RaidMemberList, { props: { level: 10, members: [
      { path: '/dev/sdb', state: 'active sync set-B', number: 1 },
      { path: '/dev/sda', state: 'active sync set-A', number: 0 },
      { path: '/dev/sdd', state: 'active sync set-B', number: 3 },
      { path: '/dev/sdc', state: 'active sync set-A', number: 2 },
    ] }, global: { plugins: [i18n] } })
    expect(w.findAll('.rml-pair').length).toBe(2)
  })
  it('重建中成员显示 rebuild_pct', () => {
    const w = mount(RaidMemberList, { props: { level: 1, members: [
      { path: '/dev/sda', state: 'spare rebuilding', number: 0, rebuild_pct: 33 },
    ] }, global: { plugins: [i18n] } })
    expect(w.text()).toContain('33')
  })
  it('degraded 阵列:faulty 成员行渲染 .rml-replace,点击 emit replace-disk(该盘 path)', async () => {
    const w = mount(RaidMemberList, { props: { level: 1, isDegraded: true, members: [
      { path: '/dev/sda', state: 'active sync', number: 0 },
      { path: '/dev/sdb', state: 'faulty', number: 1 },
    ] }, global: { plugins: [i18n] } })
    const buttons = w.findAll('.rml-replace')
    expect(buttons.length).toBe(1)
    await buttons[0].trigger('click')
    expect(w.emitted('replace-disk')).toHaveLength(1)
    expect(w.emitted('replace-disk')![0]).toEqual(['/dev/sdb'])
  })
  it('非 degraded 阵列:faulty 成员行也无替换按钮', () => {
    const w = mount(RaidMemberList, { props: { level: 1, isDegraded: false, members: [
      { path: '/dev/sdb', state: 'faulty', number: 1 },
    ] }, global: { plugins: [i18n] } })
    expect(w.findAll('.rml-replace').length).toBe(0)
  })
  it('degraded 阵列:非 faulty 成员行无替换按钮', () => {
    const w = mount(RaidMemberList, { props: { level: 1, isDegraded: true, members: [
      { path: '/dev/sda', state: 'active sync', number: 0 },
    ] }, global: { plugins: [i18n] } })
    expect(w.findAll('.rml-replace').length).toBe(0)
  })

  // members 形状取自 2026-07-28 真机:3 盘 RAID5 对 sda 打 --fail 后,后端
  // (pkg/mdadm ParseDetail)产出 4 条 —— 空出来的槽位(removed,path 为空)
  // 与被踢掉的故障盘(faulty,/dev/sda)各一条。
  const degradedRaid5 = [
    { path: '', state: 'removed', number: 0 },
    { path: '/dev/sdb', state: 'active sync', number: 1 },
    { path: '/dev/sdc', state: 'active sync', number: 3 },
    { path: '/dev/sda', state: 'faulty', number: 0 },
  ]

  it('降级 RAID5:空槽位显示槽位号而不是空白', () => {
    const w = mount(RaidMemberList, { props: { level: 5, isDegraded: true, members: degradedRaid5 },
      global: { plugins: [i18n] } })
    const paths = w.findAll('.rml-path').map((n) => n.text())
    expect(paths).toEqual(['槽位 0', '/dev/sdb', '/dev/sdc', '/dev/sda'])
    expect(paths.some((p) => p === '')).toBe(false)
  })

  it('降级 RAID5:只有 1 行标「故障」,空槽位标「已移除」', () => {
    const w = mount(RaidMemberList, { props: { level: 5, isDegraded: true, members: degradedRaid5 },
      global: { plugins: [i18n] } })
    const labels = w.findAll('.rml-label').map((n) => n.text())
    expect(labels).toEqual(['已移除', '活动', '活动', '故障'])
    expect(labels.filter((l) => l === '故障').length).toBe(1)
  })

  it('降级 RAID5:替换按钮只挂在有设备路径的故障盘上', () => {
    const w = mount(RaidMemberList, { props: { level: 5, isDegraded: true, members: degradedRaid5 },
      global: { plugins: [i18n] } })
    const buttons = w.findAll('.rml-replace')
    expect(buttons.length).toBe(1)
    expect(buttons[0].element.closest('.rml-row')!.textContent).toContain('/dev/sda')
  })
})
