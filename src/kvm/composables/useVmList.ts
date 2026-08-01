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

  const runningCount: ComputedRef<number> = computed(
    () => vms.value.filter((v) => v.state === 'running').length,
  )

  // 就地代际守卫:每次 fetchVMs 自增,回写前比对是否仍是最新一次调用。
  // 记忆记过「别抽公共 guard」的教训——就地写,别为了复用抽象出个 helper。
  let listEpoch = 0
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
        // ⚠️ 与 Vue2 的偏离(SP9-P5 登记):Vue2 fetchVMs(:898-899)这里调用
        // this.selectVM(this.vms[0]),会再触发一次 fetchVM→getVM 详情请求。但
        // GET /v1/kvm/vms 列表接口本身已经返回完整的 KvmVM 字段(与 GET /vms/:id 同构,
        // 详见 spicePreserve.ts 注释),首次自动选中不需要再打一次详情请求去覆盖刚拿到
        // 的新鲜数据——直接从这次列表结果里取。这也避免了自动选中和调用方 await 之间
        // 出现一段不受调用方控制的额外异步窗口(被测试用交错路径逮到过)。用户显式点选
        // 仍然照 Vue2 走 selectVM()→fetchVM() 的详情合并(见下方 selectVM)。
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
    try {
      const fresh = await service.kvm.getVM(id)
      if (!alive) return
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
      onSuccess(vm)
      lastError.value = ''
    } catch (e) {
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
    // 照 Vue2 toggleAutoStart(:1516-1528):先记原值,乐观翻转失败则回滚。
    const original = vm.autostart
    const next = !original
    processing.value.add(vm.id)
    try {
      await service.kvm.setAutostart(vm.id, next)
      vm.autostart = next
      if (selectedVM.value?.id === vm.id) selectedVM.value.autostart = next
      lastError.value = ''
    } catch (e) {
      vm.autostart = original
      if (selectedVM.value?.id === vm.id) selectedVM.value.autostart = original
      lastError.value = errText(e, 'kvmFailedToSaveSettings')
    } finally {
      processing.value.delete(vm.id)
    }
  }

  async function remove(vm: KvmVM): Promise<void> {
    // 照 Vue2 deleteVM(:1609-1620)。
    try {
      await service.kvm.deleteVM(vm.id)
      vms.value = vms.value.filter((v) => v.id !== vm.id)
      if (selectedVM.value?.id === vm.id) selectedVM.value = null
      lastError.value = ''
    } catch (e) {
      lastError.value = errText(e, 'kvmFailedToDelete')
    }
  }

  async function ejectInstallMedia(vm: KvmVM): Promise<void> {
    // 照 Vue2 handleInstallationFinished(:862-877):setBootFromDisk(true) 后整表刷新。
    try {
      await service.kvm.setBootFromDisk(vm.id, true)
      lastError.value = ''
      await fetchVMs()
    } catch (e) {
      lastError.value = errText(e, 'kvmFailedToEjectMedia')
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
