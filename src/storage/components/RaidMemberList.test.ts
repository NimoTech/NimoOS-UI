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
  it('RAID10:按槽位分镜像对(不按 mdadm 设备编号 number)', () => {
    // 换盘后新成员 number=4 但占槽位 3:按 number 分组会造出幽灵第三对(旧 bug)。
    const w = mount(RaidMemberList, { props: { level: 10, members: [
      { path: '/dev/sdd', state: 'active sync set-A', number: 0, slot: 0 },
      { path: '/dev/sdc', state: 'active sync set-B', number: 1, slot: 1 },
      { path: '/dev/sda', state: 'active sync set-A', number: 2, slot: 2 },
      { path: '/dev/sdb', state: 'spare rebuilding', number: 4, slot: 3 },
    ] }, global: { plugins: [i18n] } })
    expect(w.findAll('.rml-pair').length).toBe(2)
    const pairPaths = w.findAll('.rml-pair').map((p) => p.findAll('.rml-path').map((n) => n.text()))
    expect(pairPaths).toEqual([['/dev/sdd', '/dev/sdc'], ['/dev/sda', '/dev/sdb']])
  })
  it('RAID10 老后端(成员不带 slot)→ 退回平铺渲染,不渲染成 0 行', () => {
    const w = mount(RaidMemberList, { props: { level: 10, members: [
      { path: '/dev/sda', state: 'active sync set-A', number: 0 },
      { path: '/dev/sdb', state: 'active sync set-B', number: 1 },
    ] }, global: { plugins: [i18n] } })
    expect(w.findAll('.rml-pair').length).toBe(0)
    expect(w.findAll('.rml-row').length).toBe(2)
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

  // members 形状取自 2026-07-30 真机:3 盘 RAID5 对 sda 打 --fail 后,后端
  // (pkg/mdadm ParseDetail)产出 4 条 —— 腾空的槽位(removed,path 为空、slot=0)
  // 与被踢出槽位的故障盘(faulty,/dev/sda,slot=-1)各一条。
  // **必须带 slot**:合并逻辑靠它判断"这块坏盘已离开槽位",漏掉 slot 的 fixture
  // 会静静地走不合并分支,测的就不是后端真实发来的形状了。
  const degradedRaid5 = [
    { path: '', state: 'removed', number: 0, slot: 0 },
    { path: '/dev/sdb', state: 'active sync', number: 1, slot: 1 },
    { path: '/dev/sdc', state: 'active sync', number: 3, slot: 2 },
    { path: '/dev/sda', state: 'faulty', number: 0, slot: -1 },
  ]

  it('降级 RAID5:空槽位与坏盘合并成一行,3 盘阵列就是 3 行', () => {
    const w = mount(RaidMemberList, { props: { level: 5, isDegraded: true, members: degradedRaid5 },
      global: { plugins: [i18n] } })
    const paths = w.findAll('.rml-path').map((n) => n.text())
    expect(paths).toEqual(['槽位 0 · /dev/sda', '/dev/sdb', '/dev/sdc'])
    expect(paths.some((p) => p === '')).toBe(false)
  })

  it('合并行文案点出「已弹出」,解释槽位为什么空着', () => {
    const w = mount(RaidMemberList, { props: { level: 5, isDegraded: true, members: degradedRaid5 },
      global: { plugins: [i18n] } })
    const labels = w.findAll('.rml-label').map((n) => n.text())
    expect(labels).toEqual(['故障（已弹出）', '活动', '活动'])
    // 只有一行是故障态 —— 两行会读成"坏了两块盘"
    expect(labels.filter((l) => l.includes('故障')).length).toBe(1)
  })

  it('降级 RAID5:替换按钮挂在合并行上,传的是坏盘设备路径', async () => {
    const w = mount(RaidMemberList, { props: { level: 5, isDegraded: true, members: degradedRaid5 },
      global: { plugins: [i18n] } })
    const buttons = w.findAll('.rml-replace')
    expect(buttons.length).toBe(1)
    expect(buttons[0].element.closest('.rml-row')!.textContent).toContain('/dev/sda')
    await buttons[0].trigger('click')
    expect(w.emitted('replace-disk')![0]).toEqual(['/dev/sda'])
  })

  // 无法唯一配对时保持分行:多几行胜过把槽位号标在错的盘上。
  it('RAID6 双故障:两个空槽位 + 两块坏盘 → 不合并,分行显示', () => {
    const w = mount(RaidMemberList, { props: { level: 6, isDegraded: true, members: [
      { path: '', state: 'removed', number: 0, slot: 0 },
      { path: '', state: 'removed', number: 1, slot: 1 },
      { path: '/dev/sdc', state: 'active sync', number: 3, slot: 2 },
      { path: '/dev/sdd', state: 'active sync', number: 4, slot: 3 },
      { path: '/dev/sda', state: 'faulty', number: 0, slot: -1 },
      { path: '/dev/sdb', state: 'faulty', number: 1, slot: -1 },
    ] }, global: { plugins: [i18n] } })
    expect(w.findAll('.rml-row').length).toBe(6)
    const paths = w.findAll('.rml-path').map((n) => n.text())
    expect(paths).toEqual(['槽位 0', '槽位 1', '/dev/sdc', '/dev/sdd', '/dev/sda', '/dev/sdb'])
    // 2026-08-11 起空槽位行也有替换入口(拔盘场景没有 faulty 行):2 坏盘 + 2 空槽位
    expect(w.findAll('.rml-replace').length).toBe(4)
  })

  // 2026-08-11 改:空槽位行也给替换入口 —— 物理拔掉的盘没有 faulty 行,只剩这条
  // 占位行;不给入口用户就永远换不了盘。emit 的 path 是空串,由父视图用
  // findReplaceTarget 按 serial 识别被拔的盘(见 StorageRaidDetail.vue)。
  it('物理拔盘(只有空槽位、无坏盘行)→ 显示槽位号 + 替换入口,emit 空 path', async () => {
    const w = mount(RaidMemberList, { props: { level: 5, isDegraded: true, members: [
      { path: '', state: 'removed', number: 1, slot: 1 },
      { path: '/dev/sdb', state: 'active sync', number: 1, slot: 0 },
    ] }, global: { plugins: [i18n] } })
    expect(w.findAll('.rml-path').map((n) => n.text())).toEqual(['槽位 1', '/dev/sdb'])
    const buttons = w.findAll('.rml-replace')
    expect(buttons.length).toBe(1)
    await buttons[0].trigger('click')
    expect(w.emitted('replace-disk')![0]).toEqual([''])
  })

  it('RAID10:被弹出且未合并的行(slot<0)平铺在镜像对之后,不塞进错误的对', () => {
    // 双故障:两条空槽位 + 两块被弹出的坏盘 —— mergeVacatedSlot 无法唯一配对,不合并;
    // 空槽位行占槽进对,坏盘行(slot=-1)进不了任何对,必须仍然可见(带替换按钮)。
    const w = mount(RaidMemberList, { props: { level: 10, isDegraded: true, members: [
      { path: '', state: 'removed', number: 0, slot: 0 },
      { path: '', state: 'removed', number: 2, slot: 2 },
      { path: '/dev/sdb', state: 'active sync', number: 1, slot: 1 },
      { path: '/dev/sdd', state: 'active sync', number: 3, slot: 3 },
      { path: '/dev/sda', state: 'faulty', number: 4, slot: -1 },
      { path: '/dev/sdc', state: 'faulty', number: 5, slot: -1 },
    ] }, global: { plugins: [i18n] } })
    expect(w.findAll('.rml-pair').length).toBe(2)
    expect(w.findAll('.rml-row').length).toBe(6)
    const looseRows = w.findAll('.rml-row').filter((r) => !r.element.closest('.rml-pair'))
    expect(looseRows.map((r) => r.find('.rml-path').text())).toEqual(['/dev/sda', '/dev/sdc'])
    expect(w.findAll('.rml-replace').length).toBe(4) // 2 空槽位 + 2 坏盘
  })
})
