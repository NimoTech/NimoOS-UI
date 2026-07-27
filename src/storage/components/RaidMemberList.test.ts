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
})
