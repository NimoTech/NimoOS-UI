import { ref } from 'vue'
import type { Ref } from 'vue'
import RFB from '@novnc/novnc'
import { service } from '@nimotech/nimoos-service'
import type { KvmVM, KvmVncInfo } from '@nimotech/nimoos-service'

// noVNC 控制台生命周期。逐字对 NimoOS-UI/src/components/KVM/KVMFullPage.vue
// disconnectVNC(:944-954)/connectVNC(:956-1018)/toggleModifier(:1020-1029)/
// releaseModifiers(:1031-1040)/sendKey(:1042-1046)/sendCtrlAltDel(:1048-1053)
// (2026-08-02 核对,brief 草稿行号偏前)。
//
// `rfb` 特意是闭包里的裸变量、不包 ref() —— 同 Vue2 把 rfbInstance 放在组件 data 之外
// 一个模块级普通变量的理由一致:RFB 内部持有 WebSocket/canvas 等复杂又频繁变动的对象,
// 没有任何消费方需要它响应式,包一层只会让 Vue 试图深度代理内部结构,徒增开销。

type Modifiers = { ctrl: boolean; alt: boolean; shift: boolean; win: boolean }
type SpicePorts = { spicePort: number; spiceTlsPort: number }

const MODIFIER_KEYSYM: Record<keyof Modifiers, number> = {
  ctrl: 0xffe3,
  alt: 0xffe9,
  shift: 0xffe1,
  win: 0xffeb,
}

export function useVncConsole(hostEl: Ref<HTMLElement | null>) {
  const connected = ref(false)
  const errorKey = ref('')
  const modifiers = ref<Modifiers>({ ctrl: false, alt: false, shift: false, win: false })

  let rfb: RFB | null = null
  // 代际计数器。每次 connect() 自增并记下 myGen;await 之后比对 gen 是否还是自己发起的
  // 那一次,不是就丢弃结果。
  //
  // ⚠️ 与 Vue2 的偏离(SP9-P5 登记):Vue2 connectVNC(:956-1018)拿到 /vnc 响应后直接建连,
  // 完全没有代际判定。快速切换 VM 时,先发的那次请求可能晚于后发的一次到达,于是把 A
  // 机器的画面接到了已经切到 B 的容器上(且 B 刚建好的 RFB 又被 A 的迟到结果覆盖)。
  // 这里加 gen 守卫,过期的结果一律丢弃,不产生任何副作用(既不建连、也不报错、更不
  // 动 errorKey/connected —— 那些字段这一刻属于"更新的一次"调用,迟到者没资格覆盖)。
  let gen = 0

  let spiceCb: ((vmId: string, ports: SpicePorts) => void) | null = null
  /** spice 端口只通过这个回调交给调用方(KvmPage/useVmList),composable 自己不摸 vms 列表
   * ——保持"数据层归数据层管"的既有约定(同 useVmList 的 onVncShouldConnect 写法)。 */
  function onSpicePorts(cb: (vmId: string, ports: SpicePorts) => void): void {
    spiceCb = cb
  }

  /** 只销毁旧 RFB 实例 + 清掉容器里残留的 canvas,不碰 modifiers/connected/errorKey——
   * 对应 Vue2 connectVNC 里 `new RFB` 前那几行(:995-998)。这几行只是给"马上要建的新
   * 连接"腾地方,不是一次真正意义上的断开,所以不能等价于下面完整的 disconnect()。 */
  function destroyRfb(): void {
    if (rfb) {
      rfb.disconnect()
      rfb = null
    }
    hostEl.value?.querySelectorAll('canvas').forEach((c) => c.remove())
  }

  /** 照 Vue2 releaseModifiers(:1031-1040):把当前按下的修饰键逐个发送释放事件。 */
  function releaseModifiers(): void {
    if (!rfb) return
    ;(Object.keys(modifiers.value) as (keyof Modifiers)[]).forEach((k) => {
      if (modifiers.value[k]) {
        rfb!.sendKey(MODIFIER_KEYSYM[k], null, false)
        modifiers.value[k] = false
      }
    })
  }

  /** 照 Vue2 disconnectVNC(:944-954):先放开修饰键(否则卡在按下态),再销毁连接。
   *
   * ⚠️ 与 Vue2 的偏离(SP9-P5 登记,代际守卫的延伸):这里额外让 gen 前进一步。Vue2
   * 完全没有代际概念,disconnectVNC 只负责清理"已经建立"的连接。但这个实现里
   * disconnect() 还会被外部直接调用(VM 停止事件、组件卸载的 dispose()),如果那一刻
   * 正好有一个 connect() 还在 await getVNC() 的路上,不前进 gen 的话它稍后拿到结果时
   * 会看见 gen 没变、误以为自己仍是"最新一次",于是在用户已经明确要求断开之后又把画面
   * 重新接上。前进 gen 让这类迟到的 connect() 在下面 connect() 内部的守卫处被丢弃。 */
  function disconnect(): void {
    releaseModifiers()
    gen += 1
    destroyRfb()
    connected.value = false
    errorKey.value = ''
  }

  async function connect(vm: KvmVM): Promise<void> {
    // 1: 不是运行态直接断开返回(Vue2 :960-963)。
    if (vm.state !== 'running') {
      disconnect()
      return
    }

    // 2: 自增代际,记下这一次调用专属的世代号。
    const myGen = ++gen
    errorKey.value = '' // Vue2 :965

    let info: KvmVncInfo
    try {
      // 3
      info = await service.kvm.getVNC(vm.id)
    } catch {
      // 迟到的失败结果不该覆盖后来者已经写下的状态(同代际守卫的思路)。
      if (myGen !== gen) return
      disconnect()
      errorKey.value = 'kvmVncFetchFailed'
      return
    }

    // 4: 代际守卫——见文件顶部注释,修 Vue2 缺失的必要修正。
    if (myGen !== gen) return

    // 5: spice 端口只通过回调交出去,不在这里直接改 vms 列表(brief 约定)。
    spiceCb?.(vm.id, { spicePort: info.spicePort, spiceTlsPort: info.spiceTlsPort })

    // 6: brief 草稿写的是 `wsPort ?? vncPort`,但后端 vncWebsocketPort 缺席时给的是数字
    // 0(不是 null/undefined),`??` 对 0 不会 fallback,会拼出 `ws://host:0`。这里按
    // Vue2 原文(:991-993 的三元表达式,真值判断)用 `||`,0 才会正确让位给 vncPort。
    const wsPort = info.vncWebsocketPort
    const vncPort = info.vncPort
    if (!wsPort && !vncPort) {
      disconnect()
      errorKey.value = 'kvmVncPortUnavailable'
      return
    }

    // 7: ⚠️ 浏览器直连宿主机端口,不走网关、无鉴权(本机 ws 口是 5700)。
    const wsUrl = `ws://${window.location.hostname}:${wsPort || vncPort}`

    // 8: 销毁旧 RFB + 清残留 canvas,再建新连接(Vue2 :995-1004)。
    destroyRfb()
    const host = hostEl.value
    if (!host) {
      // 评审 Minor:正常流程下 ConsoleStage 已经挂载好了,这条分支理论上不该触发——
      // 但万一触发,旧连接已经被上面 destroyRfb() 销毁,不出声的话就是"悄悄断线、
      // 什么都不说"。加一句 warn,至少排障时能看出原因(不写进 errorKey,因为这不是
      // 用户能通过界面文案理解/处理的错误,是前端自身的挂载时序问题)。
      console.warn('[KVM] connect(): host element missing, skip RFB construction')
      return
    }

    // 评审 Important #1:Vue2 connectVNC(:999-1013)把 `new RFB(...)` + 两个
    // addEventListener 整个包在 try/catch 里,失败时 `this.vncError = e.message`。
    // 这里漏了这层是未申报的偏离——HTTPS 页面下 `new WebSocket('ws://…')` 会**同步抛
    // SecurityError**(混合内容策略),URL 非法同理。没有 try/catch 的话,这次 connect()
    // 调用方(KvmPage 里两处都是 `void vnc.connect(...)`,没人接 rejection)会导致一个
    // 未处理的 promise rejection,用户只看到空白占位层,什么线索都没有。照 Vue2 补上。
    //
    // errorKey 这里装的是**原始异常信息**(e.message),不是 i18n key——ConsoleStage
    // 渲染处本来就是 `te(errorKey) ? t(errorKey) : errorKey` 的写法,te() 对任意非法
    // key 的字符串天然返回 false,原始异常信息会直接原样显示,不会被误当成键名喷出来。
    try {
      rfb = new RFB(host, wsUrl)

      // 申报偏离(用户 2026-08-03 真机验收后拍板,两条一起)——
      //
      // ⚠️ 大前提:RFB 构造函数**只读** credentials / shared / repeaterID / wsProtocols
      // 四项(core/rfb.js:28-32),其余选项一律静默忽略;scaleViewport / resizeSession /
      // showDotCursor 全是构造后才生效的存取器属性(:345-371),默认全 false(:299-302)。
      // Vue2(:1001-1004)把 scaleViewport:true / resizeSession:false 写在构造参数里,
      // 因此**这两项在旧 UI 里从来没生效过**。探针(真 noVNC 连真机 5700 口)实测:照
      // Vue2 写法连上后 scaleViewport 恒为 false、画布 style.cursor 恒为 "none"。
      // 所以这里不再传那个恒被忽略的选项对象,改为构造后逐项赋值。
      //
      // ① 光标:客户机不下发光标图案时(QEMU + Alpine 文本控制台正是如此),noVNC 在连上
      //    那一刻(:577-578,attach 完立即 _refreshCursor)拿空图案去更新,走
      //    core/util/cursor.js:80 的 w/h===0 分支 → clear() → 给画布写内联 `cursor: none`,
      //    鼠标一进黑框就隐形,连右缘 80px 唤出工具条都不好瞄。赋 true 后 noVNC 补画一个
      //    小圆点;客户机自绘光标时 _shouldShowDotCursor()(:3033)返回 false,仍用客户机
      //    的光标,不会双光标。
      // ② 缩放:Vue2 传 true 的本意就是要缩放适配窗口(只是没生效),这里让它真的生效,
      //    高分辨率客户机的画面才不会超出框只看得到左上角。
      // ③ resizeSession 显式赋 false:与 Vue2 的意图一致(不要求客户机改分辨率),值本身
      //    就是 noVNC 默认值,写出来是为了让三项开关在同一处一目了然。
      rfb.showDotCursor = true
      rfb.scaleViewport = true
      rfb.resizeSession = false

      // 9
      rfb.addEventListener('connect', () => { connected.value = true })
      rfb.addEventListener('disconnect', () => { connected.value = false })
    } catch (e) {
      rfb = null
      errorKey.value = e instanceof Error ? e.message : String(e)
    }
  }

  /** 照 Vue2 toggleModifier(:1020-1029)。 */
  function toggleModifier(name: keyof Modifiers): void {
    if (!rfb) return
    const next = !modifiers.value[name]
    rfb.sendKey(MODIFIER_KEYSYM[name], null, next)
    modifiers.value[name] = next
  }

  /** 照 Vue2 sendKey(:1042-1046):RFB 抛异常时吞掉、只 warn,不冒泡。 */
  function sendKey(keysym: number): void {
    if (!rfb) return
    try {
      rfb.sendKey(keysym, null)
    } catch (e) {
      console.warn('[KVM] sendKey failed:', e)
    }
  }

  /** 照 Vue2 sendCtrlAltDel(:1048-1053):先清空全部修饰键状态,再调用专用方法。 */
  function sendCtrlAltDel(): void {
    if (!rfb) return
    modifiers.value = { ctrl: false, alt: false, shift: false, win: false }
    try {
      rfb.sendCtrlAltDel()
    } catch (e) {
      console.warn('[KVM] sendCtrlAltDel failed:', e)
    }
  }

  function dispose(): void {
    disconnect()
  }

  return {
    connected,
    errorKey,
    modifiers,
    connect,
    disconnect,
    toggleModifier,
    sendKey,
    sendCtrlAltDel,
    onSpicePorts,
    dispose,
  }
}
