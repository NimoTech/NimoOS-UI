import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'
import NetworkIfaceRow from './NetworkIfaceRow.vue'
import type { MergedIface } from '../../util/netMerge'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

// The menu renders through reka DropdownMenuPortal, and the real DropdownMenuItem injects
// MenuRootContext (stubbing out Root alone causes mounting to throw "must be used within
// MenuRoot") → following the precedent in InstalledAppCard.test.ts, stub Root/Trigger/Portal/
// Content/Item together and only verify this layer of conditional logic — "which items
// render + clicking emits"; leave overlay positioning and keyboard navigation to real-device
// checks.
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

describe('NetworkIfaceRow —— display (maps to Vue2 SettingsPanel.vue L500-577)', () => {
  it('ethernet: type name "以太网" + interface-name tag + speed tag + DHCP+IP tag', () => {
    const w = mountRow()
    expect(w.text()).toContain('以太网')
    const tags = w.findAll('.set-net-tag').map((t) => t.text())
    expect(tags[0]).toBe('enp2s0')
    expect(tags[1]).toBe('1 Gbps')
    expect(tags[2]).toContain('DHCP')
    expect(tags[2]).toContain('192.168.1.143')
  })

  it('the static-IP tag prefix is Static (Vue2 hardcodes the English literal, kept as-is)', () => {
    const w = mountRow({ dhcp: false, addr: '192.168.1.250' })
    expect(w.findAll('.set-net-tag')[2].text()).toContain('Static')
  })

  it('state=up carries .up on the status dot, down does not', () => {
    expect(mountRow({ state: 'up' }).get('.set-net-dot').classes()).toContain('up')
    expect(mountRow({ state: 'down' }).get('.set-net-dot').classes()).not.toContain('up')
  })

  it('an interface with speed=0 does not render the speed tag; an interface with empty addr does not render the IP tag', () => {
    const w = mountRow({ speed: 0, maxSpeed: 0, addr: '' })
    const tags = w.findAll('.set-net-tag')
    expect(tags).toHaveLength(1)
    expect(tags[0].text()).toBe('enp2s0')
  })

  it('shows both segments when maxSpeed is greater than speed', () => {
    expect(mountRow({ speed: 1000, maxSpeed: 2500 }).findAll('.set-net-tag')[1].text()).toBe('1 Gbps / 2.5 Gbps')
  })

  it('wifi shows the type name based on mode', () => {
    expect(mountRow({ name: 'wlp1s0', type: 'wifi' }).text()).toContain('Wi-Fi')
    expect(mountRow({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'ap' } }).text()).toContain('热点')
    expect(mountRow({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'concurrent' } }).text())
      .toContain('Wi-Fi + 热点')
  })

  it('virtual interface: shows "虚拟网络", **has no menu button**, has a spacer to keep alignment', () => {
    const w = mountRow({ name: 'docker0', isVirtual: true, type: 'bridge' })
    expect(w.text()).toContain('虚拟网络')
    expect(w.find('.menu-trigger').exists()).toBe(false)
    expect(w.find('.set-net-menu-spacer').exists()).toBe(true)
  })
})

describe('NetworkIfaceRow —— menu items vary by mode (Vue2 L545-573 comment table)', () => {
  it('non-wireless (no wireless in config): only "编辑"', () => {
    const items = mountRow().findAll('.menu-item').map((i) => i.text())
    expect(items).toEqual(['编辑'])
  })

  it('ap: "编辑" + "切换到 Wi-Fi" (no hybrid item when hybridCapable=false)', () => {
    const items = mountRow({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'ap' } })
      .findAll('.menu-item').map((i) => i.text())
    expect(items).toEqual(['编辑', '切换到 Wi-Fi'])
  })

  it('client: "编辑" + "切换到热点"', () => {
    const items = mountRow({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' } })
      .findAll('.menu-item').map((i) => i.text())
    expect(items).toEqual(['编辑', '切换到热点'])
  })

  it('client + hybridCapable: one extra item, "切换到混合模式"', () => {
    const items = mountRow({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' }, hybridCapable: true })
      .findAll('.menu-item').map((i) => i.text())
    expect(items).toEqual(['编辑', '切换到热点', '切换到混合模式'])
  })

  it('concurrent: only "编辑" (even when hybridCapable)', () => {
    const items = mountRow({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'concurrent' }, hybridCapable: true })
      .findAll('.menu-item').map((i) => i.text())
    expect(items).toEqual(['编辑'])
  })

  it('clicking "编辑" emits edit; clicking a switch item emits switchMode with the target mode', async () => {
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
