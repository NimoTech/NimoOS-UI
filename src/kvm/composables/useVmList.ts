import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { service } from '@nimotech/nimoos-service'
import type { KvmVM, KvmCreateVMRequest, KvmUpdateVMRequest } from '@nimotech/nimoos-service'
import { useMessageBus } from '../../composables/useMessageBus'
import { preserveSpice } from '../util/spicePreserve'

// KVM 列表数据层。视觉/交互无关,纯状态 + 数据获取 + MessageBus 接线。
// 逐字对 NimoOS-UI/src/components/KVM/KVMFullPage.vue 的 Data Layer + sockets + 电源动作段落
// (行号已按本仓库当前版本核对一遍,brief 草稿里的行号普遍偏前几行,下面注释用核对过的行号)。

/** 从 err 里取错误文案。照抄 Vue2 getErrMsg(KVMFullPage.vue:841-844)剥掉开头的 `[xxx] ` 前缀这一步;
 * 不做 $t() 国际化(那是视图层的事,这里只返回原文/i18n key,调用处自己决定要不要 t())。 */
function errText(e: unknown, fallback: string): string {
  const raw = (e instanceof Error && e.message) || fallback
  return raw.replace(/^\[.*?\]\s*/, '')
}

export function useVmList() {
  const vms: Ref<KvmVM[]> = ref([])
  const selectedVM: Ref<KvmVM | null> = ref(null)
  const isLoading = ref(false)
  const processing: Ref<Set<string>> = ref(new Set())
  const lastError = ref('')
  // ejectInstallMedia 自己的重入标记(评审复审修复,见下方 ejectInstallMedia 内注释)——
  // 不与 processing 共用,不需要响应式(没有 UI 消费它),纯内部去重用途。
  const ejectingIds = new Set<string>()

  const runningCount: ComputedRef<number> = computed(
    () => vms.value.filter((v) => v.state === 'running').length,
  )

  // 必修②(全分支终审):restart 期间用来协调"HTTP 响应 vs kvm:vm_started 事件"谁先到——
  // 见下方 restart() 与 kvm:vm_started 处理器内的详细注释。非响应式,纯内部协调用途,
  // 不需要 UI 消费,同 ejectingIds 的写法(就地一个 Set,不抽公共 guard)。
  const restartPending = new Set<string>()

  // SP16 Task 8:restart 把重连交给 kvm:vm_started 是有意的——VM 刚重启时 VNC 端口通常
  // 还没监听,立刻重连必失败,还会把 vncError 永久钉在屏上(见 restart() 里的完整推导)。
  // 但 MessageBus 掉线时那个事件永远不会到,断开之后就再没有任何人连回来:控制台一片黑,
  // 界面上没有一句解释,用户只能自己猜要重选 VM。这个计时器就是那种情况的地板。
  // 它**故意不重连** —— 重连就把事件交接本来要避免的失败又请回来了 —— 只负责让页面说一声。
  const RECONNECT_STALL_MS = 20_000
  const stallTimers = new Map<string, ReturnType<typeof setTimeout>>()
  let stalledCb: (() => void) | undefined
  function onVncReconnectStalled(cb: () => void): void { stalledCb = cb }

  function clearStallTimer(id: string): void {
    const t = stallTimers.get(id)
    if (t) { clearTimeout(t); stallTimers.delete(id) }
  }

  // 就地代际守卫:每次 fetchVMs 自增,回写前比对是否仍是最新一次调用。
  // 记忆记过「别抽公共 guard」的教训——就地写,别为了复用抽象出个 helper。
  let listEpoch = 0
  // fetchVM 自己的代际守卫(评审 5.2 补):同一思路,防止连点多台 VM /连点同一台 VM 两次时,
  // 先发但迟到的详情响应覆盖后发已经写入的数据。与 listEpoch 各管一段,不合并成一个公共 guard。
  let vmFetchEpoch = 0
  let alive = true

  function findVm(id: string): KvmVM | undefined {
    return vms.value.find((v) => v.id === id)
  }

  // 单回调槽,不是数组——本任务的消费方只有 ConsoleStage 一个(brief 明确要求)。
  let connectCb: ((vm: KvmVM) => void) | null = null
  let disconnectCb: (() => void) | null = null
  function onVncShouldConnect(cb: (vm: KvmVM) => void) { connectCb = cb }
  function onVncShouldDisconnect(cb: () => void) { disconnectCb = cb }

  /** 照 Vue2 setVMState(KVMFullPage.vue:936-940):同时改列表项与 selectedVM。
   * vms 存对象数组、selectedVM 指向数组里的同一个对象引用,所以这里既要改 vm 也要改
   * selectedVM——两者多数情况下是同一个对象,但 selectVM 详情合并等路径不保证一定同引用,
   * 照 Vue2 两处都写更稳妥。 */
  function setVMState(id: string, state: KvmVM['state']) {
    const vm = findVm(id)
    if (vm) vm.state = state
    if (selectedVM.value?.id === id) selectedVM.value.state = state
  }

  async function fetchVMs(): Promise<void> {
    isLoading.value = true
    const myEpoch = ++listEpoch
    try {
      const res = await service.kvm.getVMList()
      if (!alive || myEpoch !== listEpoch) return // 过期守卫:更晚的调用已经写过了,这份迟到结果丢弃
      const oldSelected = selectedVM.value
      vms.value = res.data
      if (oldSelected) {
        const fresh = findVm(oldSelected.id)
        selectedVM.value = fresh ? preserveSpice(fresh, oldSelected) : null
        if (fresh && selectedVM.value) {
          // preserveSpice 可能返回新对象,把它换回列表里的那一项,保持“同一个引用”的约定。
          const idx = vms.value.findIndex((v) => v.id === fresh.id)
          if (idx !== -1) vms.value[idx] = selectedVM.value
        }
      } else if (vms.value.length > 0) {
        // ⚠️ 与 Vue2 的偏离(SP9-P5 登记,评审已核实通过):Vue2 fetchVMs(:898-899)这里
        // 调用 this.selectVM(this.vms[0]),会再触发一次 fetchVM→getVM 详情请求。但后端
        // ListVMs(NimoOS-KVM vm_service.go:245)与 GetVM(:270)返回的都是 model.VM 全量
        // 副本、字段集完全同构——不合并不丢任何字段,再打一次详情请求纯属冗余的网络往返。
        // 用户显式点选仍然照 Vue2 走 selectVM()→fetchVM() 的详情合并(见下方 selectVM)。
        // P5 无创建向导分支(:901 showCreateVM),空列表就走空态,创建弹窗留给 P6。
        selectedVM.value = vms.value[0]
      } else {
        selectedVM.value = null
      }
    } catch {
      if (!alive || myEpoch !== listEpoch) return
      vms.value = []
    } finally {
      if (alive && myEpoch === listEpoch) isLoading.value = false
    }
  }

  async function fetchVM(id: string): Promise<void> {
    const myVmEpoch = ++vmFetchEpoch
    try {
      const fresh = await service.kvm.getVM(id)
      if (!alive || myVmEpoch !== vmFetchEpoch) return // 过期守卫:更晚一次 fetchVM 已经写过了,这份迟到结果丢弃
      const idx = vms.value.findIndex((v) => v.id === id)
      const target = idx !== -1 ? vms.value[idx] : (selectedVM.value?.id === id ? selectedVM.value : null)
      // 照 Vue2 fetchVM(:912-913 / :925-926):`Object.keys(fresh).forEach(key => { if
      // (key !== 'id') this.$set(...) })`——逐字段覆盖但显式跳过 id。这里同样保留原对象的
      // id,只用 fresh 的其它字段覆盖,不能整个对象替换(否则 id 会被 fresh.id 冲掉,
      // fresh.id 理论上等于传入的 id,但不能假设调用方/后端一定保证一致)。
      const withId: KvmVM = target ? { ...fresh, id: target.id } : fresh
      const merged = preserveSpice(withId, target)
      if (idx !== -1) vms.value[idx] = merged
      if (selectedVM.value?.id === id) selectedVM.value = merged
    } catch (e) {
      // Vue2(:933)失败只 console.warn,不清空选中、不置 lastError——保留原行为。
      console.warn('[KVM] Failed to refresh VM info:', e)
    }
  }

  async function selectVM(vm: KvmVM): Promise<void> {
    selectedVM.value = vm
    await fetchVM(vm.id)
  }

  // ===================== MessageBus 事件(照 Vue2 sockets:768-829) =====================
  const bus = useMessageBus()
  const unsubs: (() => void)[] = []

  function vmIdOf(props: unknown): string | undefined {
    if (props && typeof props === 'object') {
      const v = (props as Record<string, unknown>).vm_id
      if (typeof v === 'string' && v) return v
    }
    return undefined
  }

  unsubs.push(bus.on('kvm:vm_created', () => { void fetchVMs() }))

  unsubs.push(bus.on('kvm:vm_deleted', (props) => {
    const id = vmIdOf(props)
    if (id) {
      vms.value = vms.value.filter((v) => v.id !== id)
      if (selectedVM.value?.id === id) selectedVM.value = null
    } else {
      void fetchVMs()
    }
  }))

  unsubs.push(bus.on('kvm:vm_started', (props) => {
    const id = vmIdOf(props)
    if (id) {
      setVMState(id, 'running')
      if (selectedVM.value?.id === id) connectCb?.(selectedVM.value)
      // 必修②:这个事件可能是"restart 已经完成"的信号,也可能比 restart 自己的 HTTP
      // 响应更早到达(后端 RestartVMWithForce = StopVM+StartVM,两者各自异步发布事件,
      // 与 HTTP 响应几乎同时,顺序未定——见 restart() 里的完整解释)。不管是哪种情况,
      // 只要这里已经重新建过连接,就清掉 restartPending 标记:告诉 restart() 的
      // onSuccess"不用你再断开一次了,画面已经是新的了"。
      restartPending.delete(id)
      clearStallTimer(id) // 重连落地了,没什么要警告的
    } else {
      void fetchVMs()
    }
  }))

  unsubs.push(bus.on('kvm:vm_stopped', (props) => {
    const id = vmIdOf(props)
    if (id) {
      setVMState(id, 'stopped')
      if (selectedVM.value?.id === id) disconnectCb?.()
    } else {
      void fetchVMs()
    }
  }))

  unsubs.push(bus.on('kvm:vm_paused', (props) => {
    const id = vmIdOf(props)
    if (id) {
      setVMState(id, 'paused')
      if (selectedVM.value?.id === id) disconnectCb?.()
    } else {
      void fetchVMs()
    }
  }))

  unsubs.push(bus.on('kvm:vm_resumed', (props) => {
    const id = vmIdOf(props)
    if (id) {
      setVMState(id, 'running')
      if (selectedVM.value?.id === id) connectCb?.(selectedVM.value)
    } else {
      void fetchVMs()
    }
  }))

  unsubs.push(bus.on('kvm:vm_autostart_changed', () => { void fetchVMs() }))

  function dispose(): void {
    alive = false
    stallTimers.forEach((t) => clearTimeout(t))
    stallTimers.clear()
    unsubs.forEach((off) => off())
    unsubs.length = 0
  }

  // ===================== 电源动作 =====================
  // 模板一致:processing.add(id) → 请求 → 乐观改 state(+ VNC 回调)→ catch 写 lastError →
  // finally processing.delete(id)。照 Vue2 startVM/stopVM/pauseVM/resumeVM/wakeupVM
  // (KVMFullPage.vue:1530-1607)——toast 文案是视图层的事,这里只留 lastError 给上层展示。

  // 返回值(必修①,全分支终审新增):true=这次调用成功,false=失败或 dispose 后短路。
  // 与 ejectInstallMedia 同样的理由——调用方(KvmPage.vue)要知道"这次调用到底成不成功"
  // 才能决定要不要弹成功 toast,而 lastError 是多个动作共用的单一 ref,await 结束后再去
  // 读它会有"串味"风险(见 ejectInstallMedia 顶部注释、评审二轮修复)。返回值天然只属于
  // "这次调用",不会被任何并发操作污染。
  async function runAction(
    vm: KvmVM,
    action: (id: string) => Promise<unknown>,
    onSuccess: (vm: KvmVM) => void,
    failFallback: string,
  ): Promise<boolean> {
    processing.value.add(vm.id)
    try {
      await action(vm.id)
      if (!alive) return false // dispose 之后到达的结果不再写 state、不触发 VNC 回调(评审 3);对已卸载的调用方也谈不上"成功"
      onSuccess(vm)
      lastError.value = ''
      return true
    } catch (e) {
      if (!alive) return false
      lastError.value = errText(e, failFallback)
      return false
    } finally {
      processing.value.delete(vm.id)
    }
  }

  async function start(vm: KvmVM): Promise<boolean> {
    return runAction(vm, (id) => service.kvm.startVM(id), (v) => {
      setVMState(v.id, 'running')
      if (selectedVM.value?.id === v.id) connectCb?.(selectedVM.value)
    }, 'kvmFailedToStart')
  }

  async function stop(vm: KvmVM): Promise<boolean> {
    return runAction(vm, (id) => service.kvm.stopVM(id), (v) => {
      setVMState(v.id, 'stopped')
      if (selectedVM.value?.id === v.id) disconnectCb?.()
    }, 'kvmFailedToStop')
  }

  async function restart(vm: KvmVM): Promise<boolean> {
    // ⚠️ 与 Vue2 的偏离(SP9-P5 登记):Vue2 restartVM(:1557-1571)在请求返回后立刻
    // disconnectVNC() + connectVNC()。VM 刚重启,VNC 端口大概率还没监听,connect 必失败,
    // 于是 vncError 被永久写死在屏上、且不会自愈。这里只断开,重连交给 kvm:vm_started
    // 事件兜底(后端确实会发,NimoOS-KVM/common/constants.go:17)。界面表现不变,只是不再卡在错误态。
    //
    // ⚠️ 必修②(全分支终审,2026-08-02):上面那条偏离本身没错,但原实现假设"HTTP 响应
    // 必然先于 kvm:vm_started 事件到达"——这个假设不成立。终审核了后端:
    // NimoOS-KVM/service/vm_service.go:575-583 的 RestartVMWithForce = StopVM + StartVM,
    // 两者各自 `go PublishVMEvent`(:566/:535),事件与 HTTP 响应几乎同时发出,顺序未定。
    // 如果事件先到:kvm:vm_started 处理器已经用 connectCb 建好了新连接;这里的 onSuccess
    // 如果还无条件 disconnectCb(),会把刚建好的连接又拆掉——而 vm_started 只发一次,
    // 此后不会再有事件触发重连,用户看到的是永久黑屏,只能重选 VM 自救。
    //
    // 修法:用 restartPending 这个 Set 协调"这次断开还要不要做"。进 restart() 时把
    // vm.id 记进去;kvm:vm_started 处理器一旦真的重连了,会把 id 从这个 Set 删掉(见该
    // 处理器注释)。onSuccess 只在 vm.id **仍然**留在 restartPending 里(说明事件还没到、
    // 没人抢先重连过)时才断开——事件已抢先重连的情况下这里什么都不做,保留事件建立的
    // 连接。两种到达顺序都收敛到"最终连着"这个正确状态,不再有能把新连接拆掉的路径。
    restartPending.add(vm.id)
    try {
      return await runAction(vm, (id) => service.kvm.restartVM(id), (v) => {
        setVMState(v.id, 'running')
        if (restartPending.has(v.id) && selectedVM.value?.id === v.id) {
          disconnectCb?.()
          // 断开了、且重连的责任已经完全交给 kvm:vm_started ⇒ 起一个地板计时器。
          clearStallTimer(v.id)
          stallTimers.set(v.id, setTimeout(() => {
            stallTimers.delete(v.id)
            if (alive && selectedVM.value?.id === v.id) stalledCb?.()
          }, RECONNECT_STALL_MS))
        }
      }, 'kvmFailedToRestart')
    } finally {
      restartPending.delete(vm.id)
    }
  }

  async function pause(vm: KvmVM): Promise<boolean> {
    return runAction(vm, (id) => service.kvm.pauseVM(id), (v) => {
      setVMState(v.id, 'paused')
      if (selectedVM.value?.id === v.id) disconnectCb?.()
    }, 'kvmFailedToPause')
  }

  async function resume(vm: KvmVM): Promise<boolean> {
    return runAction(vm, (id) => service.kvm.resumeVM(id), (v) => {
      setVMState(v.id, 'running')
      if (selectedVM.value?.id === v.id) connectCb?.(selectedVM.value)
    }, 'kvmFailedToResume')
  }

  async function wakeup(vm: KvmVM): Promise<boolean> {
    return runAction(vm, (id) => service.kvm.wakeupVM(id), (v) => {
      setVMState(v.id, 'running')
      if (selectedVM.value?.id === v.id) connectCb?.(selectedVM.value)
    }, 'kvmFailedToResume')
  }

  // 返回值(必修①,同 runAction):true=成功(此时 vm.autostart 已经是翻转后的新值,
  // 调用方可以直接读 vm.autostart 来决定 toast 文案是"开"还是"已关闭"),false=失败/
  // dispose 后短路。
  async function toggleAutostart(vm: KvmVM): Promise<boolean> {
    // ⚠️ 与 Vue2 的偏离(SP9-P5 登记,评审 2):Vue2 toggleAutoStart(:1516-1528)先记
    // originalValue,await 成功后才写 vm.autostart = newValue(:1522),catch 里再把
    // vm.autostart 改回 originalValue(:1525)。但这个写入顺序下,失败分支根本没写过新值——
    // vm.autostart 本来就还是 originalValue,catch 里那句“回滚”是死代码(照抄这段逻辑没有
    // 任何可观察效果,已用删测试验证过)。这里按“界面照 Vue2、逻辑照正确”只保留有意义的部分:
    // 失败时不写 autostart(本就是原值),只置 lastError;不做“先乐观写、失败再改回”的真实回滚
    // (那会让开关先跳一下再弹回,是另一种可见行为,违反界面 1:1)。
    processing.value.add(vm.id)
    try {
      const next = !vm.autostart
      await service.kvm.setAutostart(vm.id, next)
      if (!alive) return false // dispose 之后到达的结果不再写 state(评审 3)
      vm.autostart = next
      if (selectedVM.value?.id === vm.id) selectedVM.value.autostart = next
      lastError.value = ''
      return true
    } catch (e) {
      if (!alive) return false
      lastError.value = errText(e, 'kvmFailedToSaveSettings')
      return false
    } finally {
      processing.value.delete(vm.id)
    }
  }

  // 返回值(必修①,同 runAction):true=成功,false=失败/dispose 后短路。
  async function remove(vm: KvmVM): Promise<boolean> {
    // 照 Vue2 deleteVM(:1609-1620)。
    try {
      await service.kvm.deleteVM(vm.id)
      if (!alive) return false // dispose 之后到达的结果不再写 state(评审 3)
      vms.value = vms.value.filter((v) => v.id !== vm.id)
      if (selectedVM.value?.id === vm.id) selectedVM.value = null
      lastError.value = ''
      return true
    } catch (e) {
      if (!alive) return false
      lastError.value = errText(e, 'kvmFailedToDelete')
      return false
    }
  }

  // 返回值:''=没有错误(成功 / 重入被挡 / dispose 后短路),非空=这次调用失败的文案。
  // ⚠️ 复审二轮修复(Important #2,2026-08-02):原先只把结果写进共享的 `lastError`,
  // 调用方(KvmPage.vue)在 await 结束后再去读 `lastError.value`——但 `lastError` 是
  // `runAction`/`toggleAutostart`/`remove`/`ejectInstallMedia` **共用的单一 ref**。若
  // eject 在途期间,用户对**另一台 VM**触发了电源动作,而那个动作恰好在这段 await 的
  // 微任务缝隙里 resolve 并写了 `lastError`,eject 自己明明成功了,却会读到那条不相干
  // 的错误——"串味"。改成把这次调用的结果**作为返回值直接交出去**,调用方用返回值,
  // 不再读共享 ref,错误天然只属于"这次调用",不可能被任何并发操作污染。
  // 仍然保留写 `lastError`(与其它电源动作一致,供 `consoleErrorKey` 的兜底展示路径
  // 消费——那条路径的语义没变,只是不再是安装横幅错误展示的唯一来源)。
  async function ejectInstallMedia(vm: KvmVM): Promise<string> {
    // 照 Vue2 handleInstallationFinished(:862-877):setBootFromDisk(true) 后整表刷新。
    // 补上 Vue2 (:862-864)`if (!vm || this.finishingInstall) return` 的重入守卫(评审 4:
    // 初版漏了,连点两次会并发发两次 setBootFromDisk + 两次整表刷新)。
    //
    // ⚠️ 复审修复:重入标记**必须独立**于 processing,不能复用。processing 是
    // runAction/toggleAutostart/remove 共用的、只按 vm.id 去重的状态。如果 eject 复用它
    // 会有两个方向的问题:(1) 某个电源动作在途时(processing 里已有这个 id)点 eject,
    // 会被误判成"已在进行"直接 return——setBootFromDisk 根本不发,还不写 lastError,
    // 用户看到的是点了没反应,而且是跨动作误拦、完全静默;(2) 反过来,电源动作的
    // finally { processing.value.delete(vm.id) } 会在 eject 仍在途时提前把 id 移除,
    // eject 自己的"进行中"状态被过早清掉,重入守卫失效。Vue2 的 finishingInstall
    // 本来就是一个独立标志、不与电源动作共享状态,这里同样给 eject 一个独立的 Set。
    //
    // 重入被挡时返回 ''(不是错误——这次调用根本没做任何事,没有"这次调用的错误"可言,
    // 真正在跑的那次调用会在它自己 resolve 时给出准确结果;调用方也有自己的 ejectBusy
    // 守卫防止真的并发调用到这里,这层是双保险)。
    if (ejectingIds.has(vm.id)) return ''
    ejectingIds.add(vm.id)
    try {
      await service.kvm.setBootFromDisk(vm.id, true)
      // dispose 之后到达的结果不再写 state、不再补打整表刷新(评审 3)。返回 ''——
      // 组件多半已经卸载,没有地方显示这个结果,也没必要假装"有错误"或"无错误"。
      if (!alive) return ''
      lastError.value = ''
      await fetchVMs()
      return ''
    } catch (e) {
      if (!alive) return '' // 同上,dispose 后不再纠结"到底算不算错误",直接短路
      // 评审修复(2026-08-02):fallback 键从 'kvmFailedToEjectMedia' 改成 'kvmEjectFailed'——
      // 两者译文本来就完全相同(见 i18n 分片里的注释),纯属 T3 当时为了跟其它电源动作
      // 共用的 "kvmFailedToXxx" 命名家族对齐而起的重复键。评审要求 KvmPage 层内联展示
      // 这条错误时消费 'kvmEjectFailed',顺手把 fallback 也切过去,'kvmFailedToEjectMedia'
      // 因此变成真正的死键,已从两个 i18n 分片里删掉(不再有任何地方引用)。
      const msg = errText(e, 'kvmEjectFailed')
      lastError.value = msg
      return msg
    } finally {
      ejectingIds.delete(vm.id)
    }
  }

  // P6 Task 8(创建流程接线):照 Vue2 createVM(:1475-1492)的成功/失败两支——校验本身
  // 已经下沉到 CreateVmDialog 内部的 validateCreateVm(硬约束 7:弹窗内联,不到这层),
  // 这里只管"发请求 → 成功刷新列表 → 返回结果"。
  //
  // 返回值契约(''=成功,非空=这次调用失败的文案)与 remove/toggleAutostart/
  // ejectInstallMedia 表面一致,但**故意不写共享的 `lastError`**——理由同
  // useKvmHostInfo.save()(评审 Important #3 那条注释):create 失败只该显示在创建
  // 弹窗自己的内联 `.cv-error`(CreateVmDialog 的 submitError prop)里。如果这里也写
  // `lastError`,用户在"已选中某台 VM、控制台正常显示"的状态下打开创建弹窗、新建失败,
  // 这条与当前控制台毫无关系的报错会顺着 `consoleErrorKey` 的兜底路径(KvmPage.vue)
  // 串到选中 VM 的控制台占位区上——一次纯粹的视觉污染,不是"串味"防不住,是压根不该
  // 往共享状态里写。`alive` 守卫仍然要:请求发出后组件可能已经 dispose(比如提交在途
  // 时整页跳走),那时不该再触发一次 `fetchVMs()`。
  async function create(payload: KvmCreateVMRequest): Promise<string> {
    try {
      await service.kvm.createVM(payload)
      if (!alive) return ''
      await fetchVMs()
      return ''
    } catch (e) {
      if (!alive) return ''
      return errText(e, 'kvmFailedToCreate')
    }
  }

  // P6 Task 9(VM 设置弹窗接线):照 Vue2 saveSettings(:1494-1514)的成功/失败两支——
  // 表单校验/networkMode 折算已经下沉到 VmSettingsDialog 内部(硬约束 7:弹窗内联,
  // 不到这层),这里只管"发请求 → 成功回写可见字段 → 返回结果"。
  //
  // 返回值契约(''=成功,非空=这次调用失败的文案)与 create 表面一致,但**同样故意
  // 不写共享的 `lastError`**——理由同 create() 顶部注释(评审 Important #3 那条的同一个
  // 道理):保存失败只该显示在 VM 设置弹窗自己的内联 `.cv-error`(submitError prop)里。
  // 如果这里也写 `lastError`,会顺着 consoleErrorKey 的兜底路径(KvmPage.vue)串到
  // 当前选中 VM 的控制台占位区上——纯粹的视觉污染,不是"串味"防不住,是压根不该往
  // 共享状态里写。
  //
  // 成功后 Object.assign 回写"可见字段"(照 Vue2 saveSettings :1503-1508 的字段集合,
  // **不含 disk**——disk 输入框在弹窗里本来就是 disabled,值不会变,Vue2 那条回写语句
  // 本身也没有这个字段)。写法照 setVMState/toggleAutostart 的既有惯例:`vm` 参数、
  // `vms` 列表里同 id 的那一项、`selectedVM` 三者理论上多数时候是同一个对象引用,但不
  // 保证一定同引用(见 setVMState 顶部注释),三处都写更稳妥——哪怕其中两处恰好是
  // 同一个引用,重复 Object.assign 也是幂等的,不会有副作用。
  async function update(vm: KvmVM, patch: KvmUpdateVMRequest): Promise<string> {
    try {
      await service.kvm.updateVM(vm.id, patch)
      if (!alive) return '' // dispose 之后到达的结果不再写 state(评审 3 的既有惯例)
      const visible: Partial<KvmVM> = {
        name: patch.name,
        vcpu: patch.vcpu,
        memory: patch.memory,
        iso: patch.iso,
        bootFromDisk: patch.bootFromDisk,
        firmware: patch.firmware,
        networkMode: patch.networkMode,
        networkInterface: patch.networkInterface,
      }
      Object.assign(vm, visible)
      const inList = findVm(vm.id)
      if (inList && inList !== vm) Object.assign(inList, visible)
      if (selectedVM.value && selectedVM.value.id === vm.id && selectedVM.value !== vm) {
        Object.assign(selectedVM.value, visible)
      }
      return ''
    } catch (e) {
      if (!alive) return ''
      return errText(e, 'kvmFailedToSaveSettings')
    }
  }

  return {
    vms,
    selectedVM,
    isLoading,
    runningCount,
    processing,
    lastError,
    fetchVMs,
    fetchVM,
    selectVM,
    start,
    stop,
    restart,
    pause,
    resume,
    wakeup,
    toggleAutostart,
    remove,
    ejectInstallMedia,
    create,
    update,
    onVncShouldConnect,
    onVncShouldDisconnect,
    onVncReconnectStalled,
    dispose,
  }
}
