import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'
import NetworkIfaceRow from './NetworkIfaceRow.vue'
import type { MergedIface } from '../../util/netMerge'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

// 菜单经 reka DropdownMenuPortal 渲染,且真实 DropdownMenuItem 会 inject MenuRootContext
// (stub 掉 Root 后挂载会抛 "must be used within MenuRoot")→ 照 InstalledAppCard.test.ts 的
// 先例把 Root/Trigger/Portal/Content/Item 一起 stub,只验「渲染哪些项 + 点击 emit」这层条件
// 逻辑;浮层定位与键盘导航留实机看。
const MenuRootStub = { template: '<div class="menu-root"><slot /></div>' }
const PassThroughStub = { template: '<div><slot /></div>' }
const TriggerStub = { template: '<button class="menu-trigger"><slot /></button>' }
const ItemStub = { emits: ['select'], template: '<div class="menu-item" @click="$emit(\'select\')"><slot /></div>' }

function row(p: Partial<MergedIface> = {}): MergedIface {
  return {
    name: 'enp2s0', state: 'up', speed: 1000, maxSpeed: 1000, addr: '192.168.1.143', dhcp: true,
    isVirtual: false, zone: '', type: 'ethernet', ipv4: { method: 'dhcp' }, wireless: null, hybridCapable: false,
    ...p,
  }
}

function mountRow(iface: Partial<MergedIface> = {}) {
  return mount(NetworkIfaceRow, {
    props: { iface: row(iface) },
    global: {
      plugins: [i18n],
      stubs: {
        DropdownMenuRoot: MenuRootStub, DropdownMenuTrigger: TriggerStub,
        DropdownMenuPortal: PassThroughStub, DropdownMenuContent: PassThroughStub,
        DropdownMenuItem: ItemStub,
      },
    },
  })
}

describe('NetworkIfaceRow —— 展示(对位 Vue2 SettingsPanel.vue L500-577)', () => {
  it('以太网:类型名「以太网」+ 网卡名标签 + 速率标签 + DHCP+IP 标签', () => {
    const w = mountRow()
    expect(w.text()).toContain('以太网')
    const tags = w.findAll('.set-net-tag').map((t) => t.text())
    expect(tags[0]).toBe('enp2s0')
    expect(tags[1]).toBe('1 Gbps')
    expect(tags[2]).toContain('DHCP')
    expect(tags[2]).toContain('192.168.1.143')
  })

  it('静态 IP 的标签前缀是 Static(Vue2 写死英文字面量,照留)', () => {
    const w = mountRow({ dhcp: false, addr: '192.168.1.250' })
    expect(w.findAll('.set-net-tag')[2].text()).toContain('Static')
  })

  it('state=up 时状态点带 .up,down 时不带', () => {
    expect(mountRow({ state: 'up' }).get('.set-net-dot').classes()).toContain('up')
    expect(mountRow({ state: 'down' }).get('.set-net-dot').classes()).not.toContain('up')
  })

  it('speed=0 的口不渲染速率标签;addr 空的口不渲染 IP 标签', () => {
    const w = mountRow({ speed: 0, maxSpeed: 0, addr: '' })
    const tags = w.findAll('.set-net-tag')
    expect(tags).toHaveLength(1)
    expect(tags[0].text()).toBe('enp2s0')
  })

  it('maxSpeed 大于 speed 时显示两段', () => {
    expect(mountRow({ speed: 1000, maxSpeed: 2500 }).findAll('.set-net-tag')[1].text()).toBe('1 Gbps / 2.5 Gbps')
  })

  it('wifi 按模式显示类型名', () => {
    expect(mountRow({ name: 'wlp1s0', type: 'wifi' }).text()).toContain('Wi-Fi')
    expect(mountRow({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'ap' } }).text()).toContain('热点')
    expect(mountRow({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'concurrent' } }).text())
      .toContain('Wi-Fi + 热点')
  })

  it('虚拟口:显示「虚拟网络」、**没有菜单按钮**、有占位保持对齐', () => {
    const w = mountRow({ name: 'docker0', isVirtual: true, type: 'bridge' })
    expect(w.text()).toContain('虚拟网络')
    expect(w.find('.menu-trigger').exists()).toBe(false)
    expect(w.find('.set-net-menu-spacer').exists()).toBe(true)
  })
})

describe('NetworkIfaceRow —— 菜单项按模式变化(Vue2 L545-573 的注释表)', () => {
  it('非无线(config 无 wireless):只有「编辑」', () => {
    const items = mountRow().findAll('.menu-item').map((i) => i.text())
    expect(items).toEqual(['编辑'])
  })

  it('ap:编辑 + 切换到 Wi-Fi(hybridCapable=false 时无混合项)', () => {
    const items = mountRow({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'ap' } })
      .findAll('.menu-item').map((i) => i.text())
    expect(items).toEqual(['编辑', '切换到 Wi-Fi'])
  })

  it('client:编辑 + 切换到热点', () => {
    const items = mountRow({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' } })
      .findAll('.menu-item').map((i) => i.text())
    expect(items).toEqual(['编辑', '切换到热点'])
  })

  it('client + hybridCapable:多一项「切换到混合模式」', () => {
    const items = mountRow({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' }, hybridCapable: true })
      .findAll('.menu-item').map((i) => i.text())
    expect(items).toEqual(['编辑', '切换到热点', '切换到混合模式'])
  })

  it('concurrent:只有「编辑」(即使 hybridCapable)', () => {
    const items = mountRow({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'concurrent' }, hybridCapable: true })
      .findAll('.menu-item').map((i) => i.text())
    expect(items).toEqual(['编辑'])
  })

  it('点「编辑」emit edit;点切换项 emit switchMode 带目标模式', async () => {
    const w = mountRow({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' }, hybridCapable: true })
    const items = w.findAll('.menu-item')
    await items[0].trigger('click')
    expect(w.emitted('edit')).toBeTruthy()
    await items[1].trigger('click')
    expect(w.emitted('switchMode')![0]).toEqual(['ap'])
    await items[2].trigger('click')
    expect(w.emitted('switchMode')![1]).toEqual(['concurrent'])
  })
})
