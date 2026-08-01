import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { service } from '@nimotech/nimoos-service'
import type { KvmVM } from '@nimotech/nimoos-service'
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
    unsubs.forEach((off) => off())
    unsubs.length = 0
  }

  // ===================== 电源动作 =====================
  // 模板一致:processing.add(id) → 请求 → 乐观改 state(+ VNC 回调)→ catch 写 lastError →
  // finally processing.delete(id)。照 Vue2 startVM/stopVM/pauseVM/resumeVM/wakeupVM
  // (KVMFullPage.vue:1530-1607)——toast 文案是视图层的事,这里只留 lastError 给上层展示。

  async function runAction(
    vm: KvmVM,
    action: (id: string) => Promise<unknown>,
    onSuccess: (vm: KvmVM) => void,
    failFallback: string,
  ): Promise<void> {
    processing.value.add(vm.id)
    try {
      await action(vm.id)
      if (!alive) return // dispose 之后到达的结果不再写 state、不触发 VNC 回调(评审 3)
      onSuccess(vm)
      lastError.value = ''
    } catch (e) {
      if (!alive) return
      lastError.value = errText(e, failFallback)
    } finally {
      processing.value.delete(vm.id)
    }
  }

  async function start(vm: KvmVM): Promise<void> {
    await runAction(vm, (id) => service.kvm.startVM(id), (v) => {
      setVMState(v.id, 'running')
      if (selectedVM.value?.id === v.id) connectCb?.(selectedVM.value)
    }, 'kvmFailedToStart')
  }

  async function stop(vm: KvmVM): Promise<void> {
    await runAction(vm, (id) => service.kvm.stopVM(id), (v) => {
      setVMState(v.id, 'stopped')
      if (selectedVM.value?.id === v.id) disconnectCb?.()
    }, 'kvmFailedToStop')
  }

  async function restart(vm: KvmVM): Promise<void> {
    // ⚠️ 与 Vue2 的偏离(SP9-P5 登记):Vue2 restartVM(:1557-1571)在请求返回后立刻
    // disconnectVNC() + connectVNC()。VM 刚重启,VNC 端口大概率还没监听,connect 必失败,
    // 于是 vncError 被永久写死在屏上、且不会自愈。这里只断开,重连交给 kvm:vm_started
    // 事件兜底(后端确实会发,NimoOS-KVM/common/constants.go:17)。界面表现不变,只是不再卡在错误态。
    await runAction(vm, (id) => service.kvm.restartVM(id), (v) => {
      setVMState(v.id, 'running')
      if (selectedVM.value?.id === v.id) disconnectCb?.()
    }, 'kvmFailedToRestart')
  }

  async function pause(vm: KvmVM): Promise<void> {
    await runAction(vm, (id) => service.kvm.pauseVM(id), (v) => {
      setVMState(v.id, 'paused')
      if (selectedVM.value?.id === v.id) disconnectCb?.()
    }, 'kvmFailedToPause')
  }

  async function resume(vm: KvmVM): Promise<void> {
    await runAction(vm, (id) => service.kvm.resumeVM(id), (v) => {
      setVMState(v.id, 'running')
      if (selectedVM.value?.id === v.id) connectCb?.(selectedVM.value)
    }, 'kvmFailedToResume')
  }

  async function wakeup(vm: KvmVM): Promise<void> {
    await runAction(vm, (id) => service.kvm.wakeupVM(id), (v) => {
      setVMState(v.id, 'running')
      if (selectedVM.value?.id === v.id) connectCb?.(selectedVM.value)
    }, 'kvmFailedToResume')
  }

  async function toggleAutostart(vm: KvmVM): Promise<void> {
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
      if (!alive) return // dispose 之后到达的结果不再写 state(评审 3)
      vm.autostart = next
      if (selectedVM.value?.id === vm.id) selectedVM.value.autostart = next
      lastError.value = ''
    } catch (e) {
      if (!alive) return
      lastError.value = errText(e, 'kvmFailedToSaveSettings')
    } finally {
      processing.value.delete(vm.id)
    }
  }

  async function remove(vm: KvmVM): Promise<void> {
    // 照 Vue2 deleteVM(:1609-1620)。
    try {
      await service.kvm.deleteVM(vm.id)
      if (!alive) return // dispose 之后到达的结果不再写 state(评审 3)
      vms.value = vms.value.filter((v) => v.id !== vm.id)
      if (selectedVM.value?.id === vm.id) selectedVM.value = null
      lastError.value = ''
    } catch (e) {
      if (!alive) return
      lastError.value = errText(e, 'kvmFailedToDelete')
    }
  }

  async function ejectInstallMedia(vm: KvmVM): Promise<void> {
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
    if (ejectingIds.has(vm.id)) return
    ejectingIds.add(vm.id)
    try {
      await service.kvm.setBootFromDisk(vm.id, true)
      if (!alive) return // dispose 之后到达的结果不再写 state、不再补打整表刷新(评审 3)
      lastError.value = ''
      await fetchVMs()
    } catch (e) {
      if (!alive) return
      lastError.value = errText(e, 'kvmFailedToEjectMedia')
    } finally {
      ejectingIds.delete(vm.id)
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
    onVncShouldConnect,
    onVncShouldDisconnect,
    dispose,
  }
}
