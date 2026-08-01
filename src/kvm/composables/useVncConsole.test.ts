import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import type { KvmVM } from '@nimotech/nimoos-service'

// ⚠️ 对 brief 草稿的必要修正(纯 vitest 机制问题,非逻辑偏离):brief 给的写法是
// `class FakeRFB {...}` 声明在文件顶层、`vi.mock` 单独调用引用它。但 vi.mock() 会被
// vitest 整体提升到文件最顶部先执行(先于其它 import/顶层语句),而 class 声明不像
// function 声明那样提升——提升后的 vi.mock 工厂函数会在 `class FakeRFB` 这行真正执行
// 之前就去读 `FakeRFB` 标识符,直接报 "Cannot access 'FakeRFB' before initialization"
// (已用原始写法验证过这个报错)。修法:把类和用来收集实例的数组一起放进 `vi.hoisted()`
// ——它的回调体本身也会被提升,但是作为一个整体同步执行,不存在跨语句的时序问题。
// 断言、行为、测试用例本身一个字都没改。
const { instances, FakeRFB } = vi.hoisted(() => {
  class FakeRFB {
    handlers: Record<string, (() => void)[]> = {}
    disconnected = false
    sent: [number, boolean | null][] = []
    cad = 0
    constructor(public el: unknown, public url: string, public opts: unknown) { instances.push(this) }
    addEventListener(ev: string, cb: () => void) { (this.handlers[ev] ||= []).push(cb) }
    fire(ev: string) { (this.handlers[ev] || []).forEach((h) => h()) }
    disconnect() { this.disconnected = true }
    sendKey(k: number, _c: unknown, down: boolean | null = null) { this.sent.push([k, down]) }
    sendCtrlAltDel() { this.cad++ }
  }
  const instances: InstanceType<typeof FakeRFB>[] = []
  return { instances, FakeRFB }
})
vi.mock('@novnc/novnc', () => ({ default: FakeRFB }))

const getVNC = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({ service: { get kvm() { return { getVNC } } } }))

import { useVncConsole } from './useVncConsole'

const VM = (over: Partial<KvmVM> = {}) => ({ id: 'vm-1', state: 'running', ...over } as KvmVM)
const host = () => ref(document.createElement('div'))
// tsconfig 的 lib 是 ES2020,没有 Array.prototype.at(与 RaidDriveBay.test.ts /
// RaidMatrix.test.ts 的既有写法同款理由),brief 草稿里的 `.at(-1)` 在这里等价替换。
const last = <T,>(arr: T[]): T => arr[arr.length - 1]

beforeEach(() => {
  instances.length = 0
  getVNC.mockReset()
  getVNC.mockResolvedValue({ vncPort: 5900, vncWebsocketPort: 5700, spicePort: 5901, spiceTlsPort: 0 })
})

describe('connect', () => {
  it('用 vncWebsocketPort 拼 ws url,直连 location.hostname', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    expect(instances[0].url).toBe(`ws://${window.location.hostname}:5700`)
    expect(instances[0].opts).toEqual({ scaleViewport: true, resizeSession: false })
  })

  it('没有 websocket 口时回退 vncPort', async () => {
    getVNC.mockResolvedValue({ vncPort: 5900, vncWebsocketPort: 0, spicePort: 0, spiceTlsPort: 0 })
    const c = useVncConsole(host())
    await c.connect(VM())
    expect(instances[0].url).toBe(`ws://${window.location.hostname}:5900`)
  })

  it('两个端口都没有 → 报端口不可用,不建连接', async () => {
    getVNC.mockResolvedValue({ vncPort: 0, vncWebsocketPort: 0, spicePort: 0, spiceTlsPort: 0 })
    const c = useVncConsole(host())
    await c.connect(VM())
    expect(instances).toHaveLength(0)
    expect(c.errorKey.value).toBe('kvmVncPortUnavailable')
  })

  it('getVNC 失败 → 报获取失败', async () => {
    getVNC.mockRejectedValue(new Error('404'))
    const c = useVncConsole(host())
    await c.connect(VM())
    expect(c.errorKey.value).toBe('kvmVncFetchFailed')
    expect(c.connected.value).toBe(false)
  })

  it('VM 不是 running 时直接不连', async () => {
    const c = useVncConsole(host())
    await c.connect(VM({ state: 'stopped' }))
    expect(getVNC).not.toHaveBeenCalled()
    expect(instances).toHaveLength(0)
  })

  it('RFB 触发 connect/disconnect 事件时同步 connected', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    instances[0].fire('connect'); expect(c.connected.value).toBe(true)
    instances[0].fire('disconnect'); expect(c.connected.value).toBe(false)
  })

  it('重复 connect 会先销毁上一个 RFB', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    await c.connect(VM())
    expect(instances[0].disconnected).toBe(true)
    expect(instances).toHaveLength(2)
  })

  it('连接前把容器里残留的 canvas 清掉', async () => {
    const h = host()
    h.value!.appendChild(document.createElement('canvas'))
    const c = useVncConsole(h)
    await c.connect(VM())
    expect(h.value!.querySelectorAll('canvas')).toHaveLength(0)
  })

  it('把 spice 端口通过回调交出去(composable 不直接改列表)', async () => {
    const c = useVncConsole(host())
    const onSpice = vi.fn()
    c.onSpicePorts(onSpice)
    await c.connect(VM())
    expect(onSpice).toHaveBeenCalledWith('vm-1', { spicePort: 5901, spiceTlsPort: 0 })
  })
})

describe('代际守卫(修 Vue2 缺失:快速切换 VM 会把旧机器的画面接到新容器上)', () => {
  it('前一次 getVNC 迟到返回时不得建立连接', async () => {
    let slowResolve: (v: unknown) => void = () => {}
    getVNC
      .mockImplementationOnce(() => new Promise((r) => { slowResolve = r }))
      .mockResolvedValueOnce({ vncPort: 0, vncWebsocketPort: 5701, spicePort: 0, spiceTlsPort: 0 })
    const c = useVncConsole(host())
    const slow = c.connect(VM({ id: 'a' }))
    await c.connect(VM({ id: 'b' }))
    slowResolve({ vncPort: 0, vncWebsocketPort: 5700, spicePort: 0, spiceTlsPort: 0 })
    await slow
    expect(instances).toHaveLength(1)
    expect(instances[0].url).toContain('5701')     // 只有后发那次生效
  })

  it('dispose 之后迟到的 getVNC 不建连接', async () => {
    let r: (v: unknown) => void = () => {}
    getVNC.mockImplementationOnce(() => new Promise((x) => { r = x }))
    const c = useVncConsole(host())
    const p = c.connect(VM())
    c.dispose()
    r({ vncPort: 0, vncWebsocketPort: 5700, spicePort: 0, spiceTlsPort: 0 })
    await p
    expect(instances).toHaveLength(0)
  })
})

describe('修饰键与按键', () => {
  it('toggleModifier 按下再抬起,状态跟着翻转', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    c.toggleModifier('ctrl')
    expect(c.modifiers.value.ctrl).toBe(true)
    expect(last(instances[0].sent)).toEqual([0xffe3, true])
    c.toggleModifier('ctrl')
    expect(c.modifiers.value.ctrl).toBe(false)
    expect(last(instances[0].sent)).toEqual([0xffe3, false])
  })

  it('四个修饰键的 keysym 正确(Vue2 :1015-1035)', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    c.toggleModifier('alt'); expect(last(instances[0].sent)[0]).toBe(0xffe9)
    c.toggleModifier('shift'); expect(last(instances[0].sent)[0]).toBe(0xffe1)
    c.toggleModifier('win'); expect(last(instances[0].sent)[0]).toBe(0xffeb)
  })

  it('disconnect 时把按下的修饰键全部释放(否则卡在按下态)', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    c.toggleModifier('ctrl'); c.toggleModifier('alt')
    const rfb = instances[0]
    c.disconnect()
    expect(rfb.sent.filter(([, d]) => d === false).map(([k]) => k).sort()).toEqual([0xffe3, 0xffe9].sort())
    expect(c.modifiers.value.ctrl).toBe(false)
    expect(c.modifiers.value.alt).toBe(false)
  })

  it('sendKey 直接透传', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    c.sendKey(0xff09)
    expect(last(instances[0].sent)).toEqual([0xff09, null])
  })

  it('sendCtrlAltDel 调 RFB 的专用方法并清空所有修饰键状态', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    c.toggleModifier('ctrl')
    c.sendCtrlAltDel()
    expect(instances[0].cad).toBe(1)
    expect(c.modifiers.value.ctrl).toBe(false)
  })

  it('没有连接时按键调用是空操作,不抛', () => {
    const c = useVncConsole(host())
    expect(() => { c.sendKey(0xff09); c.sendCtrlAltDel(); c.toggleModifier('ctrl') }).not.toThrow()
  })

  it('RFB.sendKey 抛异常时被吞掉、不冒泡(照 Vue2 的 try/catch)', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    instances[0].sendKey = () => { throw new Error('socket closed') }
    expect(() => c.sendKey(0xff1b)).not.toThrow()
  })
})
