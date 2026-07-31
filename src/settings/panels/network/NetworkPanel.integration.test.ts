import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount, DOMWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'
import type { NetworkInterfaceConfig, NetworkInterfaceUpdate } from '@nimotech/nimoos-service'

// ── 真机 fixture(curl 实证 2026-07-31;只留界面用到的字段)────────────────────
const HTTP_NET = [
  { name: 'enp2s0', state: 'up', addr: '192.168.1.143', speed: 1000, max_speed: 1000 },
  { name: 'enp4s0', state: 'down', addr: '', speed: 0, max_speed: 1000 },
  { name: 'wlp1s0', state: 'down', addr: '', speed: 0, max_speed: 0 },
]
const CONFIGS: NetworkInterfaceConfig[] = [
  { name: 'enp2s0', type: 'ethernet', is_virtual: false, mac: '', state: '', ipv4: { method: 'dhcp' } },
  { name: 'enp4s0', type: 'ethernet', is_virtual: false, mac: '', state: '', ipv4: { method: 'dhcp' } },
]

const api = {
  configs: CONFIGS as NetworkInterfaceConfig[] | null,
  net: HTTP_NET as unknown,
  getCalls: 0,
  putCalls: [] as NetworkInterfaceUpdate[],
  putError: null as unknown,
}
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    network: {
      getInterfaces: async () => { api.getCalls++; return Array.isArray(api.configs) ? api.configs : [] },
      updateInterface: async (cfg: NetworkInterfaceUpdate) => {
        api.putCalls.push(cfg)
        if (api.putError) throw api.putError
      },
      scanWifi: async () => [],
    },
    sys: {
      getUtilization: async () => ({ cpu: null, mem: null, disk: null, gpu: null, net: api.net, usb: null }),
    },
  },
  parseUtil: (raw: Record<string, unknown>) => ({
    cpu: null, mem: null, disk: null, gpu: null, usb: null,
    net: typeof raw.sys_net === 'string' ? JSON.parse(raw.sys_net as string) : raw.sys_net,
  }),
  networkErrorText: (e: unknown) =>
    (e as { response?: { data?: { error?: string } } })?.response?.data?.error,
}))

// MessageBus:把注册的 handler 抓出来,测试里手动喂推送
let busHandler: ((props: unknown) => void) | null = null
vi.mock('../../../composables/useMessageBus', () => ({
  useMessageBus: () => ({
    on: (_e: string, cb: (props: unknown) => void) => { busHandler = cb; return () => { busHandler = null } },
  }),
}))

import NetworkPanel from '../NetworkPanel.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
const body = () => new DOMWrapper(document.body)
const mountIt = () => mount(NetworkPanel, { global: { plugins: [i18n] }, attachTo: document.body })

beforeEach(() => {
  setActivePinia(createPinia())
  api.configs = CONFIGS; api.net = HTTP_NET; api.getCalls = 0; api.putCalls = []; api.putError = null
  busHandler = null
  document.body.innerHTML = ''
})

describe('NetworkPanel —— 列表装配', () => {
  it('三行:enp2s0(up/1 Gbps/DHCP+IP)、enp4s0(down)、wlp1s0(config 里没有也要在)', async () => {
    const w = mountIt(); await flushPromises()
    const rows = w.findAll('.set-net-row')
    expect(rows).toHaveLength(3)
    expect(rows[0].text()).toContain('enp2s0')
    expect(rows[0].text()).toContain('1 Gbps')
    expect(rows[0].text()).toContain('192.168.1.143')
    expect(rows[0].get('.set-net-dot').classes()).toContain('up')
    expect(rows[2].text()).toContain('wlp1s0')
    expect(rows[2].text()).toContain('Wi-Fi')
    w.unmount()
  })

  it('小标题是「连接」', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.text()).toContain('连接')
    w.unmount()
  })

  it('config 端点返回 null 也不炸,列表照出(降级)', async () => {
    api.configs = null
    const w = mountIt(); await flushPromises()
    expect(w.findAll('.set-net-row')).toHaveLength(3)
    expect(w.find('.set-net-empty').exists()).toBe(false)
    w.unmount()
  })
})

describe('NetworkPanel —— 5 秒实时流(用户 2026-07-31 拍板接上)', () => {
  it('推送到达后 IP / 状态跟着变', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.findAll('.set-net-row')[1].text()).not.toContain('10.0.0.9')

    busHandler!({ sys_net: JSON.stringify([
      { name: 'enp2s0', state: 'up', addr: '192.168.1.143', speed: 1000, max_speed: 0 },
      { name: 'enp4s0', state: 'up', addr: '10.0.0.9', speed: 100, max_speed: 0 },
      { name: 'wlp1s0', state: 'down', addr: '', speed: 0, max_speed: 0 },
    ]) })
    await flushPromises()
    const rows = w.findAll('.set-net-row')
    expect(rows[1].text()).toContain('10.0.0.9')
    expect(rows[1].get('.set-net-dot').classes()).toContain('up')
    w.unmount()
  })

  it('⚠️ 推送里 max_speed 恒 0,速率标签**不许**变形(MaxSpeedMemo 生效)', async () => {
    // 造一个 2.5G 上限、协商在 1G 的口 —— 这是本机看不出来、别的机器一定会闪的形态
    api.net = [{ name: 'enp2s0', state: 'up', addr: '192.168.1.143', speed: 1000, max_speed: 2500 }]
    const w = mountIt(); await flushPromises()
    expect(w.findAll('.set-net-row')[0].text()).toContain('1 Gbps / 2.5 Gbps')

    busHandler!({ sys_net: JSON.stringify([
      { name: 'enp2s0', state: 'up', addr: '192.168.1.143', speed: 1000, max_speed: 0 },
    ]) })
    await flushPromises()
    expect(w.findAll('.set-net-row')[0].text()).toContain('1 Gbps / 2.5 Gbps')
    w.unmount()
  })
})

describe('NetworkPanel —— 切模式两步流程(Vue2 switchWifiMode :2199-2234)', () => {
  const WIFI_CFG: NetworkInterfaceConfig[] = [
    ...CONFIGS,
    {
      name: 'wlp1s0', type: 'wifi', is_virtual: false, mac: '', state: '', zone: 'wan',
      ipv4: { method: 'dhcp' }, wireless: { mode: 'client' }, hybridCapable: true,
    },
  ]

  async function openSwitchConfirm(target: 'ap' | 'concurrent' = 'ap') {
    api.configs = WIFI_CFG
    const w = mountIt(); await flushPromises()
    // reka 菜单在 jsdom 里不便真开 → 直接触发子组件事件(第三行是 wlp1s0)
    const row = w.findAllComponents({ name: 'NetworkIfaceRow' })[2]
    row.vm.$emit('switchMode', target)
    await flushPromises()
    return w
  }

  it('先弹确认框,文案带目标模式与网卡名', async () => {
    const w = await openSwitchConfirm()
    expect(body().text()).toContain('切换模式')
    expect(body().text()).toContain('切换到 热点？这将改变 wlp1s0 的工作模式。')
    expect(api.putCalls).toEqual([])
    w.unmount()
  })

  it('点取消:一个 PUT 都不发,配置弹窗不开', async () => {
    const w = await openSwitchConfirm()
    await body().findAll('.ui-dialog-footer .ui-btn')[0].trigger('click') // 第一个是 Cancel
    await flushPromises()
    expect(api.putCalls).toEqual([])
    expect(body().find('.set-net-save').exists()).toBe(false)
    w.unmount()
  })

  it('点确认:先裸切 {name, wireless:{mode}},再打开配置弹窗,并重取 config', async () => {
    const w = await openSwitchConfirm()
    const before = api.getCalls
    await body().findAll('.ui-dialog-footer .ui-btn')[1].trigger('click')
    await flushPromises()
    expect(api.putCalls).toEqual([{ name: 'wlp1s0', wireless: { mode: 'ap' } }])
    expect(api.getCalls).toBeGreaterThan(before)
    expect(body().find('.set-net-save').exists()).toBe(true)   // 配置弹窗开了
    expect(body().find('.set-net-apssid').exists()).toBe(true) // 且已经是热点表单
    w.unmount()
  })

  it('裸切失败:**不开配置弹窗** —— 移植纪律 #3(Vue2 只 console.error 就继续开)', async () => {
    api.putError = { response: { data: { error: 'failed to apply gateway rules' } } }
    const w = await openSwitchConfirm()
    await body().findAll('.ui-dialog-footer .ui-btn')[1].trigger('click')
    await flushPromises()
    expect(body().find('.set-net-save').exists()).toBe(false)
    w.unmount()
  })

  it('切混合模式:配置弹窗以 concurrent 双 tab 打开', async () => {
    const w = await openSwitchConfirm('concurrent')
    await body().findAll('.ui-dialog-footer .ui-btn')[1].trigger('click')
    await flushPromises()
    expect(api.putCalls).toEqual([{ name: 'wlp1s0', wireless: { mode: 'concurrent' } }])
    expect(body().findAll('.set-net-tab').map((t) => t.text())).toEqual(['Wi-Fi', '热点'])
    w.unmount()
  })
})

describe('NetworkPanel —— 编辑与保存后刷新', () => {
  it('行的 edit 事件打开配置弹窗(标题按类型派生)', async () => {
    const w = mountIt(); await flushPromises()
    w.findAllComponents({ name: 'NetworkIfaceRow' })[0].vm.$emit('edit')
    await flushPromises()
    expect(body().get('.ui-dialog-title').text()).toBe('以太网 - enp2s0')
    w.unmount()
  })

  it('弹窗 saved:重取 config(不再有 Vue2 那个 4×2s 轮询 —— 实时流已经在刷 addr)', async () => {
    const w = mountIt(); await flushPromises()
    const before = api.getCalls
    w.findComponent({ name: 'NetworkIfaceConfigDialog' }).vm.$emit('saved')
    await flushPromises()
    expect(api.getCalls).toBe(before + 1)
    w.unmount()
  })
})

describe('NetworkPanel —— 空态', () => {
  it('utilization 没给 net 时显示「未找到网络接口」', async () => {
    api.net = null
    const w = mountIt(); await flushPromises()
    expect(w.get('.set-net-empty').text()).toContain('未找到网络接口')
    w.unmount()
  })
})
