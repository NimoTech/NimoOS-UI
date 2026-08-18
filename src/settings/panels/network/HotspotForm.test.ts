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

describe('HotspotForm -- mirrors Vue2 HotspotForm.vue (69 lines)', () => {
  it('SSID is pre-filled with NimoOS-Hotspot, edits write back into form', async () => {
    const { w, form } = mountForm()
    const ssid = w.get('.set-net-apssid')
    expect((ssid.element as HTMLInputElement).value).toBe('NimoOS-Hotspot')
    await ssid.setValue('MyHotspot')
    expect(form.wireless.apSsid).toBe('MyHotspot')
  })

  it('password writes into form.wireless.apPassword (Vue2 also uses plain-text type=text)', async () => {
    const { w, form } = mountForm()
    await w.get('.set-net-appw').setValue('12345678')
    expect(form.wireless.apPassword).toBe('12345678')
    expect(w.get('.set-net-appw').attributes('type')).toBe('text')
  })

  it('ap mode: band is a three-option dropdown (Auto / 2.4GHz=6 / 5GHz=36), selected value is written as a number', async () => {
    const { w, form } = mountForm('ap')
    const band = w.get('.set-net-band')
    expect(band.findAll('option').map((o) => o.text())).toEqual(['自动', '2.4GHz', '5GHz'])
    await band.setValue('36')
    expect(form.wireless.channel).toBe(36)
    expect(typeof form.wireless.channel).toBe('number')
  })

  it('concurrent mode: band becomes a disabled "Auto" read-only field (follows the client, kept in sync by the watchdog)', () => {
    const { w } = mountForm('concurrent')
    expect(w.find('.set-net-band').exists()).toBe(false)
    const fixed = w.get('.set-net-band-auto')
    expect(fixed.attributes('disabled')).toBeDefined()
    expect((fixed.element as HTMLInputElement).value).toBe('自动')
  })

  it('advanced settings are collapsed by default; expanding in ap mode shows a disabled zone (always LAN) plus four IP fields', async () => {
    const { w, form } = mountForm('ap')
    expect(w.find('.set-net-ip').exists()).toBe(false)
    await w.get('.set-net-adv').trigger('click')

    const zone = w.get('.set-net-zone')
    expect(zone.attributes('disabled')).toBeDefined()
    expect(zone.findAll('option').map((o) => o.text())).toEqual(['LAN'])

    expect((w.get('.set-net-ip').element as HTMLInputElement).value).toBe('192.168.22.1')
    expect((w.get('.set-net-mask').element as HTMLInputElement).value).toBe('255.255.255.0')
    await w.get('.set-net-dns').setValue('8.8.8.8')
    expect(form.dnsText).toBe('8.8.8.8') // Porting discipline #1: no longer a child component's private ref
  })

  it('concurrent mode advanced settings **do not** have a zone row (managed over on the Wi-Fi tab)', async () => {
    const { w } = mountForm('concurrent')
    await w.get('.set-net-adv').trigger('click')
    expect(w.find('.set-net-zone').exists()).toBe(false)
    expect(w.find('.set-net-ip').exists()).toBe(true)
  })
})
