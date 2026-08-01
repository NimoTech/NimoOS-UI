import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VmSidebar from './VmSidebar.vue'
import { i18n } from '../../i18n'
import type { KvmVM } from '@nimotech/nimoos-service'

const VM = (id: string, state = 'running') => ({ id, name: id, state, vcpu: 1, memory: 512, os: 'linux' } as KvmVM)
const mk = (props: Partial<InstanceType<typeof VmSidebar>['$props']> = {}) =>
  mount(VmSidebar, {
    props: { vms: [VM('a'), VM('b', 'stopped')], selectedId: 'a', runningCount: 1, isLoading: false, collapsed: false, ...props },
    global: { plugins: [i18n] },
  })

describe('VmSidebar', () => {
  it('头部显示 "1 / 2 运行中"', () => {
    expect(mk().get('.kvm-status').text().replace(/\s+/g, ' ')).toContain('1 / 2 运行中')
  })

  it('有运行中的机器时头部状态点亮起', () => {
    expect(mk().get('.kvm-status .status-dot').classes()).toContain('running')
    expect(mk({ runningCount: 0 }).get('.kvm-status .status-dot').classes()).not.toContain('running')
  })

  it('渲染出每台 VM', () => {
    expect(mk().findAll('.vm-list-item')).toHaveLength(2)
  })

  it('点某台 emit select 并带上那台的对象', async () => {
    const w = mk()
    await w.findAll('.vm-list-item')[1].trigger('click')
    expect((w.emitted('select')![0][0] as KvmVM).id).toBe('b')
  })

  it('空列表且已加载完 → 显示空态文案', () => {
    expect(mk({ vms: [], runningCount: 0 }).text()).toContain('暂无虚拟机')
  })

  it('加载中且列表为空 → 不显示空态(照 Vue2 v-if="vms.length===0 && !isLoading")', () => {
    expect(mk({ vms: [], runningCount: 0, isLoading: true }).text()).not.toContain('暂无虚拟机')
  })

  it('Add VM 按钮渲染但禁用,带 title 说明(P6 才实现)', () => {
    const btn = mk().get('.add-vm-btn')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.attributes('title')).toContain('即将上线')
  })

  it('头部齿轮(全局设置)同样渲染但禁用', () => {
    const btn = mk().get('.kvm-settings-btn')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.attributes('aria-label')).toBeTruthy()
  })

  it('collapsed 透传到根元素', () => {
    expect(mk({ collapsed: true }).classes()).toContain('collapsed')
  })

  // 评审 Important 补测:selectedId 是「谁高亮」的唯一依据,此前没有用例断言过
  // 这一跳(VmListItem.test.ts 只测了 prop→class,这里只数过行数/emit),
  // 评审变异 `:active="false"` 能全绿放行。这里锁住 selectedId 指向谁、谁才带
  // active 类,并且换一个 id 后高亮跟着移动。
  it('selectedId 指向谁,谁就带 active 类(且只有它)', () => {
    const items = mk({ selectedId: 'a' }).findAll('.vm-list-item')
    expect(items[0].classes()).toContain('active')
    expect(items[1].classes()).not.toContain('active')
  })

  it('selectedId 换一台,高亮跟着移动', () => {
    const items = mk({ selectedId: 'b' }).findAll('.vm-list-item')
    expect(items[0].classes()).not.toContain('active')
    expect(items[1].classes()).toContain('active')
  })
})
