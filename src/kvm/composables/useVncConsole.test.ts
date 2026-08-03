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
// 评审 Important #1 追加:需要能让"构造 RFB"本身抛错(模拟 HTTPS 页面下
// `new WebSocket('ws://…')` 同步抛 SecurityError 那类真实场景),所以给 FakeRFB 加了
// 一个"消费一次就自动清空"的可控异常开关,同样放进 vi.hoisted 里(闭包变量,构造函数
// 引用它没有 TDZ 问题——因为真正的读取发生在测试运行时,那时模块早已求值完毕)。
const { instances, FakeRFB, setRfbConstructError } = vi.hoisted(() => {
  let constructError: Error | null = null
  class FakeRFB {
    handlers: Record<string, (() => void)[]> = {}
    disconnected = false
    // 真 RFB 上这三项都是**构造后才能赋的存取器属性**(core/rfb.js:345-371),构造函数
    // 只认 credentials/shared/repeaterID/wsProtocols 四项、其余一律忽略(:28-32)。
    // 所以桩这里也做成实例字段,默认值与真库一致(:299-302 全是 false),这样"写进构造
    // 参数里"这种无效写法会被测试逮住——2026-08-03 真机验收就栽在这上面。
    showDotCursor = false
    scaleViewport = false
    resizeSession = false
    sent: [number, boolean | null][] = []
    cad = 0
    constructor(public el: unknown, public url: string, public opts: unknown) {
      if (constructError) {
        const e = constructError
        constructError = null // 消费一次即清空,不污染后续测试
        throw e
      }
      instances.push(this)
    }
    addEventListener(ev: string, cb: () => void) { (this.handlers[ev] ||= []).push(cb) }
    fire(ev: string) { (this.handlers[ev] || []).forEach((h) => h()) }
    disconnect() { this.disconnected = true }
    sendKey(k: number, _c: unknown, down: boolean | null = null) { this.sent.push([k, down]) }
    sendCtrlAltDel() { this.cad++ }
  }
  const instances: InstanceType<typeof FakeRFB>[] = []
  return { instances, FakeRFB, setRfbConstructError: (e: Error | null) => { constructError = e } }
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
  setRfbConstructError(null)
  getVNC.mockReset()
  getVNC.mockResolvedValue({ vncPort: 5900, vncWebsocketPort: 5700, spicePort: 5901, spiceTlsPort: 0 })
})

describe('connect', () => {
  it('用 vncWebsocketPort 拼 ws url,直连 location.hostname', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    expect(instances[0].url).toBe(`ws://${window.location.hostname}:5700`)
  })

  // 申报偏离(用户 2026-08-03 真机验收后拍板,两条一起)——
  //
  // ⚠️ 大前提:RFB 构造函数只读 credentials / shared / repeaterID / wsProtocols 四项
  // (core/rfb.js:28-32),**其余选项一律静默忽略**。scaleViewport / resizeSession /
  // showDotCursor 全是构造后才生效的存取器属性(:345-371)。Vue2(:1001-1004)把
  // scaleViewport / resizeSession 写在构造参数里,所以**这两项在旧 UI 里从来没生效过**;
  // 我的第一版修复也犯了同样的错(把 showDotCursor 写进构造参数),真机复验依旧隐形。
  // 探针(真 noVNC 连真机 5700)实测:照 Vue2 写法连上后 scaleViewport 恒为 false。
  //
  // ① showDotCursor:客户机不下发光标图案时(QEMU + Alpine 文本控制台就是),noVNC 在
  //    连上那一刻(:577-578 attach 后立即 _refreshCursor)拿空图案去更新,走
  //    core/util/cursor.js:80 的 w/h===0 分支 → clear() → 给画布写死内联 `cursor: none`,
  //    鼠标一进黑框就隐形。赋 true 后改画小圆点;客户机自绘光标时 _shouldShowDotCursor()
  //    (:3033)返回 false,仍用客户机的,不会双光标。
  // ② scaleViewport:Vue2 的本意就是要缩放适配窗口(它传了 true,只是没生效),现在
  //    改成属性赋值让它真的生效。高分辨率客户机的画面会缩放到框内完整显示。
  //
  // 这三条断言守的就是"赋在实例上而不是写进构造参数",别顺手改回去。
  it('三个 RFB 开关都在构造后赋到实例上(写进构造参数会被 noVNC 静默忽略)', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    expect(instances[0].showDotCursor).toBe(true)
    expect(instances[0].scaleViewport).toBe(true)
    expect(instances[0].resizeSession).toBe(false)
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

  // 评审 Important #1:Vue2 connectVNC(:999-1013)把 `new RFB(...)` 包在 try/catch
  // 里,失败时把 e.message 写进错误态显示。HTTPS 页面下 `new WebSocket('ws://…')`
  // 会同步抛 SecurityError(混合内容),之前这版没有这层 try/catch,会变成一个没人接的
  // rejection,用户只看到空白占位层。
  it('RFB 构造抛错时(如混合内容 SecurityError)照 Vue2 把原因写进错误态,不留空白', async () => {
    setRfbConstructError(new Error('Mixed Content: The page was loaded over HTTPS...'))
    const c = useVncConsole(host())
    await c.connect(VM())
    expect(c.errorKey.value).toBe('Mixed Content: The page was loaded over HTTPS...')
    expect(c.connected.value).toBe(false)
    expect(instances).toHaveLength(0) // 构造抛出,没有留下一个"半成品"实例
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

  // 评审 Important #2:代际守卫在 catch(getVNC 失败)分支里也有一行(useVncConsole.ts
  // 里 `catch { if (myGen !== gen) return; ... }`),但之前完全没有测试覆盖它——评审
  // 删掉这一行后,本文件 + KvmPage.test.ts 共 31 例照样全绿。这行不是防御性冗余:少了它,
  // VM A 迟到的 getVNC **失败**会调 disconnect(),把 VM B 刚建好的 RFB 销毁、还弹出
  // "获取 VNC 信息失败",这正是本任务要修的那类竞态,只是走的是失败路径而不是成功路径。
  it('前一次 getVNC 的失败迟到返回时,不得断开已经建立的新连接、不得写错误态', async () => {
    let slowReject: (e: unknown) => void = () => {}
    getVNC
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { slowReject = reject }))
      .mockResolvedValueOnce({ vncPort: 0, vncWebsocketPort: 5701, spicePort: 0, spiceTlsPort: 0 })
    const c = useVncConsole(host())
    const slow = c.connect(VM({ id: 'a' })) // 先发,后面会失败
    await c.connect(VM({ id: 'b' })) // 后发,立刻成功建连
    expect(instances).toHaveLength(1)

    slowReject(new Error('404')) // a 的迟到失败结果这时才到达
    await slow // connect() 内部自己 catch,不会向外抛,这里只是等它把这一轮跑完

    // b 已经建好的连接必须原封不动地留着,错误态也不该被 a 的迟到失败污染。
    expect(instances).toHaveLength(1)
    expect(instances[0].disconnected).toBe(false)
    expect(c.errorKey.value).toBe('')
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

  // 评审 Minor:这条判别力确实接近零(`if (!rfb) return` 删掉后大概率也不会抛,只是
  // 静默地空跑或者报别的错)。留着的理由:它把"connect() 之前调用这几个方法必须是安全的
  // no-op"这条 API 契约写成了一条可执行的用例——ConsoleHeader/快捷键将来接进来时,如果
  // 谁在 VNC 未连接的窗口期误触发了发送按键,这里先立此存照。判别力低不等于没价值,
  // 保留,不删。
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
