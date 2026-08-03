import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'
import HotspotForm from './HotspotForm.vue'
import { hydrateForm, type IfaceFormState } from '../../util/ifaceForm'
import type { MergedIface } from '../../util/netMerge'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

function apIface(mode: 'ap' | 'concurrent' = 'ap'): MergedIface {
  return {
    name: 'wlp1s0', state: 'down', speed: 0, maxSpeed: 0, addr: '', dhcp: false, isVirtual: false,
    zone: '', type: 'wifi', ipv4: null, wireless: { mode }, hybridCapable: true,
  }
}

function mountForm(mode: 'ap' | 'concurrent' = 'ap') {
  const form: IfaceFormState = hydrateForm(apIface(mode))
  const w = mount(HotspotForm, { props: { form }, global: { plugins: [i18n] } })
  return { w, form }
}

describe('HotspotForm —— 对位 Vue2 HotspotForm.vue(69 行)', () => {
  it('SSID 预填 NimoOS-Hotspot,改动写进 form', async () => {
    const { w, form } = mountForm()
    const ssid = w.get('.set-net-apssid')
    expect((ssid.element as HTMLInputElement).value).toBe('NimoOS-Hotspot')
    await ssid.setValue('MyHotspot')
    expect(form.wireless.apSsid).toBe('MyHotspot')
  })

  it('密码写进 form.wireless.apPassword(Vue2 也是明文 type=text)', async () => {
    const { w, form } = mountForm()
    await w.get('.set-net-appw').setValue('12345678')
    expect(form.wireless.apPassword).toBe('12345678')
    expect(w.get('.set-net-appw').attributes('type')).toBe('text')
  })

  it('ap 模式:频段是三项下拉(自动 / 2.4GHz=6 / 5GHz=36),选值写成数字', async () => {
    const { w, form } = mountForm('ap')
    const band = w.get('.set-net-band')
    expect(band.findAll('option').map((o) => o.text())).toEqual(['自动', '2.4GHz', '5GHz'])
    await band.setValue('36')
    expect(form.wireless.channel).toBe(36)
    expect(typeof form.wireless.channel).toBe('number')
  })

  it('concurrent 模式:频段变成禁用的「自动」只读框(跟随客户端,watchdog 同步)', () => {
    const { w } = mountForm('concurrent')
    expect(w.find('.set-net-band').exists()).toBe(false)
    const fixed = w.get('.set-net-band-auto')
    expect(fixed.attributes('disabled')).toBeDefined()
    expect((fixed.element as HTMLInputElement).value).toBe('自动')
  })

  it('高级设置默认折叠;ap 模式点开有禁用的 zone(恒 LAN)+ 四个 IP 字段', async () => {
    const { w, form } = mountForm('ap')
    expect(w.find('.set-net-ip').exists()).toBe(false)
    await w.get('.set-net-adv').trigger('click')

    const zone = w.get('.set-net-zone')
    expect(zone.attributes('disabled')).toBeDefined()
    expect(zone.findAll('option').map((o) => o.text())).toEqual(['LAN'])

    expect((w.get('.set-net-ip').element as HTMLInputElement).value).toBe('192.168.22.1')
    expect((w.get('.set-net-mask').element as HTMLInputElement).value).toBe('255.255.255.0')
    await w.get('.set-net-dns').setValue('8.8.8.8')
    expect(form.dnsText).toBe('8.8.8.8') // 移植纪律 #1:不再是子组件私有 ref
  })

  it('concurrent 模式的高级设置里**没有** zone 行(由 Wi-Fi tab 那边管)', async () => {
    const { w } = mountForm('concurrent')
    await w.get('.set-net-adv').trigger('click')
    expect(w.find('.set-net-zone').exists()).toBe(false)
    expect(w.find('.set-net-ip').exists()).toBe(true)
  })
})
