import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount, DOMWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'
import type { WifiScanResult, NetworkInterfaceUpdate } from '@nimotech/nimoos-service'
import type { MergedIface } from '../../util/netMerge'

// curl 实证 2026-07-31 的扫描结果(取两条)
const NETS: WifiScanResult[] = [
  { ssid: 'NIMO_Network', bssid: '60:a3:e3:a9:db:05', signal: -45, channel: 11, secure: true, connected: false },
  { ssid: 'tongda-zy', bssid: 'cc:ba:6f:ad:e6:6c', signal: -39, channel: 2, secure: true, connected: false },
]

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void }
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const net = {
  scanCalls: [] as string[],
  putCalls: [] as NetworkInterfaceUpdate[],
  scanResult: null as null | Promise<WifiScanResult[]>,
  putError: null as unknown,
  /** 非 null 时 PUT 会挂在这个 promise 上,由测试手动 resolve —— 用来验「保存中禁用」 */
  putGate: null as null | Promise<void>,
}
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    network: {
      scanWifi: (iface: string) => { net.scanCalls.push(iface); return net.scanResult ?? Promise.resolve(NETS) },
      updateInterface: async (cfg: NetworkInterfaceUpdate) => {
        net.putCalls.push(cfg)
        if (net.putGate) await net.putGate
        if (net.putError) throw net.putError
      },
    },
  },
  // 与包内真实实现等价(network 域错误体是 {"error": …})
  networkErrorText: (e: unknown) => {
    const d = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
    return typeof d === 'string' && d.trim() ? d.trim() : undefined
  },
}))

import NetworkIfaceConfigDialog from './NetworkIfaceConfigDialog.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
// Dialog 经 reka DialogPortal teleport 到 body → attachTo + 查 document(DeviceInfoDialog.test.ts 先例)
const body = () => new DOMWrapper(document.body)

function iface(p: Partial<MergedIface> = {}): MergedIface {
  return {
    name: 'enp2s0', state: 'up', speed: 1000, maxSpeed: 1000, addr: '192.168.1.143', dhcp: true,
    isVirtual: false, zone: '', type: 'ethernet', ipv4: { method: 'dhcp' }, wireless: null, hybridCapable: false,
    ...p,
  }
}

function mountDlg(
  over: Partial<MergedIface> | null = {},
  opts: { switchMode?: 'ap' | 'client' | 'concurrent'; switchTab?: 'hybrid' } = {},
) {
  return mount(NetworkIfaceConfigDialog, {
    props: { open: true, iface: over === null ? null : iface(over), ...opts },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
}

beforeEach(() => {
  net.scanCalls = []; net.putCalls = []; net.scanResult = null; net.putError = null; net.putGate = null
  document.body.innerHTML = ''
})

describe('标题按类型派生 —— 移植纪律 #5(Vue2 写死 "Wi-Fi - <name>")', () => {
  it('以太网 → 「以太网 - enp2s0」', async () => {
    const w = mountDlg(); await flushPromises()
    expect(body().get('.ui-dialog-title').text()).toBe('以太网 - enp2s0')
    w.unmount()
  })

  it('Wi-Fi 客户端 → 「Wi-Fi - wlp1s0」', async () => {
    const w = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' } }); await flushPromises()
    expect(body().get('.ui-dialog-title').text()).toBe('Wi-Fi - wlp1s0')
    w.unmount()
  })

  it('热点 → 「热点 - wlp1s0」;混合 → 「Wi-Fi + 热点 - wlp1s0」', async () => {
    const ap = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'ap' } }); await flushPromises()
    expect(body().get('.ui-dialog-title').text()).toBe('热点 - wlp1s0')
    ap.unmount()
    document.body.innerHTML = ''

    const cc = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'concurrent' } }); await flushPromises()
    expect(body().get('.ui-dialog-title').text()).toBe('Wi-Fi + 热点 - wlp1s0')
    cc.unmount()
  })
})

describe('分支渲染', () => {
  it('以太网:zone 三项 + IPv4 分配;选 static 出现四个字段', async () => {
    const w = mountDlg(); await flushPromises()
    const zone = body().get('.set-net-zone')
    expect(zone.findAll('option').map((o) => o.text())).toEqual(['无', 'LAN', 'WAN'])
    expect(body().find('.set-net-ip').exists()).toBe(false)
    await body().get('.set-net-method').setValue('static')
    expect(body().find('.set-net-ip').exists()).toBe(true)
    expect(body().find('.set-net-dns').exists()).toBe(true)
    w.unmount()
  })

  it('Thunderbolt:有静态说明、四个字段,**没有** IPv4 分配下拉', async () => {
    const w = mountDlg({ name: 'tb0', type: 'thunderbolt', ipv4: null }); await flushPromises()
    expect(body().text()).toContain('Thunderbolt 静态 IP 配置')
    expect(body().find('.set-net-method').exists()).toBe(false)
    expect(body().find('.set-net-ip').exists()).toBe(true)
    w.unmount()
  })

  it('Wi-Fi client:渲染 WifiForm 并**自动扫描一次**(Vue2 L289-292)', async () => {
    const w = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' } }); await flushPromises()
    expect(net.scanCalls).toEqual(['wlp1s0'])
    expect(body().findAll('.set-wifi-row')).toHaveLength(2)
    w.unmount()
  })

  it('Wi-Fi ap:渲染 HotspotForm,**不扫描**', async () => {
    const w = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'ap' } }); await flushPromises()
    expect(net.scanCalls).toEqual([])
    expect(body().find('.set-net-apssid').exists()).toBe(true)
    w.unmount()
  })

  it('concurrent:两个 tab,默认 Wi-Fi;点热点 tab 切到 HotspotForm', async () => {
    const w = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'concurrent' } }); await flushPromises()
    const tabs = body().findAll('.set-net-tab')
    expect(tabs.map((tb) => tb.text())).toEqual(['Wi-Fi', '热点'])
    expect(body().find('.set-wifi-list').exists()).toBe(true)
    await tabs[1].trigger('click')
    expect(body().find('.set-net-apssid').exists()).toBe(true)
    w.unmount()
  })

  it('未配置的 Wi-Fi:两个引导按钮;点「连接 WiFi」→ 切 client 并触发扫描', async () => {
    const w = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: null, ipv4: null }); await flushPromises()
    expect(body().text()).toContain('此 Wi-Fi 接口尚未配置')
    const btns = body().findAll('.set-net-choose .set-btn')
    expect(btns.map((b) => b.text())).toEqual(['连接 WiFi', '创建热点'])
    await btns[0].trigger('click'); await flushPromises()
    expect(net.scanCalls).toEqual(['wlp1s0'])
    expect(body().find('.set-wifi-list').exists()).toBe(true)
    w.unmount()
  })

  it('未配置的 Wi-Fi:点「创建热点」→ 切 ap、预填默认 SSID、不扫描', async () => {
    const w = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: null, ipv4: null }); await flushPromises()
    await body().findAll('.set-net-choose .set-btn')[1].trigger('click'); await flushPromises()
    expect(net.scanCalls).toEqual([])
    expect((body().get('.set-net-apssid').element as HTMLInputElement).value).toBe('NimoOS-Hotspot')
    w.unmount()
  })
})

describe('保存', () => {
  it('以太网 dhcp:PUT 的 payload 是 {name, zone, ipv4:{method:"dhcp"}},随后 emit saved 并关窗', async () => {
    const w = mountDlg(); await flushPromises()
    await body().get('.set-net-save').trigger('click'); await flushPromises()
    expect(net.putCalls).toEqual([{ name: 'enp2s0', zone: '', ipv4: { method: 'dhcp' } }])
    expect(w.emitted('saved')).toBeTruthy()
    const openEvents = w.emitted('update:open')!
    expect(openEvents[openEvents.length - 1]).toEqual([false])
    w.unmount()
  })

  it('失败:**弹窗内联** .set-danger 显示后端 error 文本,窗不关', async () => {
    net.putError = { response: { data: { error: 'failed to apply gateway rules: nft not found' } } }
    const w = mountDlg(); await flushPromises()
    await body().get('.set-net-save').trigger('click'); await flushPromises()
    expect(body().get('.set-danger').text()).toBe('failed to apply gateway rules: nft not found')
    expect(w.emitted('update:open')).toBeFalsy()
    expect(w.emitted('saved')).toBeFalsy()
    w.unmount()
  })

  it('失败但后端没给 error 文本 → 回落本地文案', async () => {
    net.putError = new Error('network down')
    const w = mountDlg(); await flushPromises()
    await body().get('.set-net-save').trigger('click'); await flushPromises()
    expect(body().get('.set-danger').text()).toBe('应用设置失败')
    w.unmount()
  })

  it('wifi 未配置模式点保存 → 内联「没有可保存的配置」,**一个 PUT 都不发**', async () => {
    const w = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: null, ipv4: null }); await flushPromises()
    await body().get('.set-net-save').trigger('click'); await flushPromises()
    expect(net.putCalls).toEqual([])
    expect(body().get('.set-danger').text()).toBe('没有可保存的配置')
    w.unmount()
  })

  it('保存在途时两个按钮都禁用(防连点重复 PUT),落定后恢复', async () => {
    const gate = deferred<void>()
    net.putGate = gate.promise
    const w = mountDlg(); await flushPromises()
    expect(body().get('.set-net-save').attributes('disabled')).toBeUndefined()

    await body().get('.set-net-save').trigger('click'); await flushPromises()
    expect(body().get('.set-net-save').attributes('disabled')).toBeDefined()
    expect(body().get('.set-net-cancel').attributes('disabled')).toBeDefined()
    // 在途期间再点也不会发第二个 PUT
    await body().get('.set-net-save').trigger('click'); await flushPromises()
    expect(net.putCalls).toHaveLength(1)

    gate.resolve(); await flushPromises()
    expect(w.emitted('saved')).toBeTruthy()
    w.unmount()
  })
})

describe('扫描与断连', () => {
  it('扫描失败:内联报错,scanning 复位(移植纪律 #4:Vue2 早退分支不复位)', async () => {
    net.scanResult = Promise.reject({ response: { data: { error: 'invalid interface name: "0bad"' } } })
    const w = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' } }); await flushPromises()
    expect(body().get('.set-danger').text()).toBe('invalid interface name: "0bad"')
    expect(body().get('.set-net-scan-btn').attributes('disabled')).toBeUndefined()
    w.unmount()
  })

  it('扫描返回 null(后端 200+null 已由包退化成 [])→ 空态提示,不炸', async () => {
    net.scanResult = Promise.resolve([])
    const w = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' } }); await flushPromises()
    expect(body().text()).toContain('点击扫描查看可用网络')
    w.unmount()
  })

  it('已保存的 SSID 没出现在扫描结果里 → 补一条置顶且标已连接(Vue2 L354-357)', async () => {
    const w = mountDlg({
      name: 'wlp1s0', type: 'wifi',
      wireless: { mode: 'client', ssid: 'HiddenNet', password: 'p' },
    })
    await flushPromises()
    const rows = body().findAll('.set-wifi-row')
    expect(rows[0].text()).toContain('HiddenNet')
    expect(rows[0].text()).toContain('已连接')
    expect(rows).toHaveLength(3)
    w.unmount()
  })

  it('⚠️ 过期守卫:换网卡重开后,上一张网卡那次扫描的迟到结果不许覆盖新的(newui-async-stale-guard)', async () => {
    // 注:扫描在途时扫描按钮是 disabled 的(VTU 也不会给 disabled 元素派发事件),
    // 所以「同一张网卡连点两次扫描」不是真实路径。真实的竞态是**关掉弹窗换另一张网卡打开**
    // (watch 里 scanGen++),此时前一次 2.3 秒的扫描仍在飞。
    const slow = deferred<WifiScanResult[]>()
    net.scanResult = slow.promise
    const w = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client' } })
    await flushPromises() // wlp1s0 的扫描在飞,列表还空
    expect(body().findAll('.set-wifi-row')).toHaveLength(0)

    // 换到另一张 wifi 卡,这次扫描立刻返回一条
    net.scanResult = Promise.resolve([NETS[1]])
    await w.setProps({ iface: iface({ name: 'wlp2s0', type: 'wifi', wireless: { mode: 'client' } }) })
    await flushPromises()
    expect(net.scanCalls).toEqual(['wlp1s0', 'wlp2s0'])
    expect(body().findAll('.set-wifi-row')).toHaveLength(1)
    expect(body().get('.set-wifi-ssid').text()).toBe('tongda-zy')

    // wlp1s0 那次的结果现在才落定 —— 不许把 wlp2s0 的结果冲掉
    slow.resolve(NETS)
    await flushPromises()
    expect(body().findAll('.set-wifi-row')).toHaveLength(1)
    expect(body().get('.set-wifi-ssid').text()).toBe('tongda-zy')
    w.unmount()
  })

  it('断连:PUT 出去的是 {mode:"client", ssid:"", password:""},并清空表单 SSID 后重扫', async () => {
    net.scanResult = Promise.resolve([{ ...NETS[0], connected: true }])
    const w = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client', ssid: 'NIMO_Network' } })
    await flushPromises()
    net.scanResult = Promise.resolve([])
    await body().get('.set-wifi-disconnect').trigger('click'); await flushPromises()
    expect(net.putCalls).toEqual([{ name: 'wlp1s0', wireless: { mode: 'client', ssid: '', password: '' } }])
    expect(net.scanCalls).toEqual(['wlp1s0', 'wlp1s0'])
    w.unmount()
  })

  it('断连失败:内联报错', async () => {
    net.scanResult = Promise.resolve([{ ...NETS[0], connected: true }])
    const w = mountDlg({ name: 'wlp1s0', type: 'wifi', wireless: { mode: 'client', ssid: 'NIMO_Network' } })
    await flushPromises()
    net.putError = { response: { data: { error: 'boom' } } }
    await body().get('.set-wifi-disconnect').trigger('click'); await flushPromises()
    expect(body().get('.set-danger').text()).toBe('boom')
    w.unmount()
  })
})

describe('重新打开时重置', () => {
  it('第二次为另一张网卡打开时,表单与错误都重置(不带上一次的脏值)', async () => {
    net.putError = { response: { data: { error: 'boom' } } }
    const w = mountDlg(); await flushPromises()
    await body().get('.set-net-save').trigger('click'); await flushPromises()
    expect(body().find('.set-danger').exists()).toBe(true)

    await w.setProps({ open: false }); await flushPromises()
    await w.setProps({ open: true, iface: iface({ name: 'enp4s0', addr: '', state: 'down' }) })
    await flushPromises()
    expect(body().find('.set-danger').exists()).toBe(false)
    expect(body().get('.ui-dialog-title').text()).toBe('以太网 - enp4s0')
    w.unmount()
  })
})
