import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'
import { useToast } from '../../../stores/toast'

const blob: Record<string, unknown> = {}
const state = { usb: false, usbCalls: [] as unknown[], usbFail: false, driveModel: '' }

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: async () => ({ ...blob }),
      setCustomStorage: async (_k: string, d: Record<string, unknown>) => { Object.assign(blob, d) },
    },
    sys: {
      getUsbStatus: async () => state.usb,
      toggleUsbAutoMount: async (p: { state: string }) => {
        state.usbCalls.push(p)
        if (state.usbFail) throw new Error('boom')
      },
      hardwareInfo: async () => ({ arch: 'arm64', drive_model: state.driveModel }),
    },
  },
}))

import UsbAutoMountRow from './UsbAutoMountRow.vue'
import SwitchRow from './SwitchRow.vue'
// 用「导入组件本身」而不是 findComponent({name:'AlertDialog'}):
// AlertDialog.vue 没有 defineOptions({name}),而它是 sp7/sp8 也会碰的共享文件,
// 为了测试去改它会白增合并冲突面。
import AlertDialog from '../../../components/ui/AlertDialog.vue'
import { __resetSystemConfigQueue } from '../../util/systemConfig'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

beforeEach(() => {
  setActivePinia(createPinia())
  for (const k of Object.keys(blob)) delete blob[k]
  state.usb = false; state.usbCalls = []; state.usbFail = false; state.driveModel = ''
  __resetSystemConfigQueue()
})

describe('UsbAutoMountRow', () => {
  const mountIt = () => mount(UsbAutoMountRow, { global: { plugins: [i18n] } })

  it('挂载后开关反映后端状态("True" 已在包里归一成布尔)', async () => {
    state.usb = true
    const w = mountIt()
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })

  it('挂载**不**下发 toggle(加载 ≠ 用户操作)', async () => {
    state.usb = true
    mountIt()
    await flushPromises()
    expect(state.usbCalls).toEqual([])
  })

  it('拨开下发 state:on,并立刻乐观翻转', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(state.usbCalls).toEqual([{ state: 'on' }])
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })

  it('拨关下发 state:off', async () => {
    state.usb = true
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(state.usbCalls).toEqual([{ state: 'off' }])
  })

  it('下发失败时开关弹回原状态(Vue2 是 fire-and-forget,失败后界面在骗人)', async () => {
    state.usbFail = true
    const toast = useToast()
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('false')
    // 评审 fix round 2 · Important:此前只验证了开关弹回,没验证真的提示了用户 ——
    // 漏写 toast.show(...) 或写错 i18n key 都不会让上面那句失败。
    expect(toast.toasts).toHaveLength(1)
    expect(toast.msg).toBe(i18n.global.t('settingsSaveFailed'))
  })

  it('树莓派 + 开启时给出启动失败警告(对位 Vue2 L1791-1797)', async () => {
    state.driveModel = 'Raspberry Pi 5 Model B'
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    // Vue2 译文写的是 "Raspberry Pi" 而不是「树莓派」,断言跟着译文走
    expect(w.text()).toContain('Raspberry Pi')
  })

  it('非树莓派不给警告', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.text()).not.toContain('Raspberry Pi')
  })

  it('关闭时即使是树莓派也不给警告(警告只针对「开启」)', async () => {
    state.driveModel = 'Raspberry Pi 5'
    state.usb = true
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.text()).not.toContain('Raspberry Pi')
  })

  // 交错防护回归测试(不在 brief 里,但外层任务描述明确要求):挂在真实网络延迟下,
  // 慢的初次加载不能在 resolve 时把用户已经做出的翻动冲回去。
  // 两个坑都要避开:①不能先 flushPromises 等 load 落定再翻(那样证明不了任何东西);
  // ②"旧值"必须是发起加载那一刻的快照,不能等用户翻完之后才去读共享 mock 状态
  // (那样它已经不是"旧"值了,不加防护也会通过)。
  it('交错防护:onMounted 的 getUsbStatus 慢于用户翻动时不覆盖(USB)', async () => {
    const svc = await import('@nimotech/nimoos-service')
    let resolveLoad: (v: boolean) => void = () => {}
    const pending = new Promise<boolean>((res) => { resolveLoad = res })
    // 加载发起时刻服务端快照是 false —— 在用户翻动**之前**就捕获好这个值
    const staleValue = state.usb // false
    vi.spyOn(svc.service.sys, 'getUsbStatus').mockReturnValueOnce(pending)
    const w = mountIt()
    // 不 flushPromises 等 load 落定 —— load 仍处于 pending,用户先翻开关
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(state.usbCalls).toEqual([{ state: 'on' }])
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
    // 现在才让"慢"的加载用翻动前捕获的旧值 resolve —— 模拟网络延迟回包
    resolveLoad(staleValue)
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })
})

describe('SwitchRow —— 推荐应用(无确认)', () => {
  const mountIt = () => mount(SwitchRow, {
    props: { field: 'recommend_switch', labelKey: 'settingsRecommendApps' },
    global: { plugins: [i18n] },
  })

  it('挂载后反映服务端值,默认 true(对位 Vue2 L942)', async () => {
    const w = mountIt()
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })

  it('拨动直接落库,只写自己那一个字段', async () => {
    blob.rss_switch = true
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(blob.recommend_switch).toBe(false)
    expect(blob.rss_switch).toBe(true)
  })

  it('落库失败时弹回', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.users, 'setCustomStorage').mockRejectedValueOnce(new Error('boom'))
    const toast = useToast()
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
    // 评审 fix round 2 · Important:此前只验证了开关弹回,没验证真的提示了用户。
    expect(toast.toasts).toHaveLength(1)
    expect(toast.msg).toBe(i18n.global.t('settingsSaveFailed'))
  })

  // 交错防护回归测试(同 UsbAutoMountRow 那条,不在 brief 里但外层任务描述明确要求)。
  it('交错防护:onMounted 的 readSystemConfig 慢于用户翻动时不覆盖(推荐应用)', async () => {
    const svc = await import('@nimotech/nimoos-service')
    let resolveLoad: (v: Record<string, unknown>) => void = () => {}
    const pending = new Promise<Record<string, unknown>>((res) => { resolveLoad = res })
    // 加载发起时刻服务端快照是空 blob(合并默认值后 recommend_switch = true)——
    // 在用户翻动**之前**就捕获好这个"旧"快照
    const staleSnapshot = { ...blob }
    vi.spyOn(svc.service.users, 'getCustomStorage').mockReturnValueOnce(pending)
    const w = mountIt()
    // 不 flushPromises 等 load 落定 —— load 仍处于 pending,用户先关掉开关(默认开)
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(blob.recommend_switch).toBe(false)
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('false')
    // 现在才让"慢"的加载用翻动前捕获的旧快照 resolve
    resolveLoad(staleSnapshot)
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('false')
  })
})

describe('SwitchRow —— 新闻流(开启需确认,对位 Vue2 rssConfirm L1696-1715)', () => {
  const mountIt = () => mount(SwitchRow, {
    props: {
      field: 'rss_switch', labelKey: 'settingsNewsFeed',
      confirmTitleKey: 'settingsNewsFeedTitle',
      confirmMsgKey: 'settingsNewsFeedConfirm',
      confirmOkKey: 'settingsAccept',
    },
    global: { plugins: [i18n] },
  })

  it('默认关(对位 Vue2 L944 rss_switch:false)', async () => {
    const w = mountIt()
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('false')
  })

  it('拨开先弹确认,未确认前不落库、开关不翻', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.findComponent(AlertDialog).props('open')).toBe(true)
    expect(blob.rss_switch).toBeUndefined()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('false')
  })

  it('确认后才落库并翻开', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    w.findComponent(AlertDialog).vm.$emit('confirm')
    await flushPromises()
    expect(blob.rss_switch).toBe(true)
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })

  it('取消确认:保持关闭且不落库', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    w.findComponent(AlertDialog).vm.$emit('update:open', false)
    await flushPromises()
    expect(blob.rss_switch).toBeUndefined()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('false')
  })

  // 评审 fix round 2 · Minor:此前 onToggle 一打开确认弹窗就把 touched 置 true,
  // 无论用户是否真的确认。场景:服务端 rss_switch=true,hydrate 还没返回(行先显示
  // 默认关),用户拨开触发确认弹窗后又取消 —— 取消不应该让 touched 卡死;迟到的
  // hydrate 必须仍能把行拉到服务端真实值(true),而不是永远停在用户从没确认过的关。
  it('交错防护:确认弹窗被取消不应卡死 touched,迟到的 hydrate 仍生效', async () => {
    const svc = await import('@nimotech/nimoos-service')
    let resolveLoad: (v: Record<string, unknown>) => void = () => {}
    const pending = new Promise<Record<string, unknown>>((res) => { resolveLoad = res })
    // 服务端真实值:rss_switch = true。加载发起时刻捕获,hydrate 迟到时用这份。
    const staleSnapshot = { rss_switch: true }
    vi.spyOn(svc.service.users, 'getCustomStorage').mockReturnValueOnce(pending)

    const w = mountIt()
    // hydrate 还卡在 pending,用户先拨开(触发确认弹窗,不落库、不翻)
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.findComponent(AlertDialog).props('open')).toBe(true)

    // 用户取消确认
    w.findComponent(AlertDialog).vm.$emit('update:open', false)
    await flushPromises()
    expect(blob.rss_switch).toBeUndefined()

    // hydrate 才姗姗来迟地返回服务端真实值
    resolveLoad(staleSnapshot)
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })

  it('关闭方向**不**弹确认,直接落库(对位 Vue2:!rss_switch 时直接 saveData)', async () => {
    blob.rss_switch = true
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.findComponent(AlertDialog).props('open')).toBe(false)
    expect(blob.rss_switch).toBe(false)
  })
})
