<script setup lang="ts">
// KVM 区主页(路由 /kvm)。视觉 1:1 对 Vue2 components/KVM/KVMFullPage.vue。
// P5 = 列表 + 控制台 + 电源;P6 补创建向导 / VM 设置 / 快照 / 全局设置。
//
// ⚠️ 本区**固定深色,不跟随全局主题** —— Vue2 该页是写死的深色控制台配色,
// --kvm-* token 在两个主题块里同值(见 styles/theme.sp9.css 注释)。
import { ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import '../styles/kvm.css'
import VmSidebar from '../components/VmSidebar.vue'
import ConsoleHeader from '../components/ConsoleHeader.vue'
import ConsoleStage from '../components/ConsoleStage.vue'
import SendKeyToolbar from '../components/SendKeyToolbar.vue'
import InstallBanner from '../components/InstallBanner.vue'
import SpiceInfoBar from '../components/SpiceInfoBar.vue'
import ProgressOverlay from '../components/ProgressOverlay.vue'
import KvmGlobalSettingsDialog from '../components/KvmGlobalSettingsDialog.vue'
import OsSelector from '../components/OsSelector.vue'
import CreateVmDialog from '../components/CreateVmDialog.vue'
import { useVmList } from '../composables/useVmList'
import { useVncConsole } from '../composables/useVncConsole'
import { useIsoList } from '../composables/useIsoList'
import { useKvmHostInfo } from '../composables/useKvmHostInfo'
import { isWindowsGuest } from '../util/vmState'
import { useToast } from '../../stores/toast'
import type { KvmVM, KvmCreateVMRequest } from '@nimotech/nimoos-service'
import type { SelectedOs } from '../components/OsSelector.vue'

const { t, te } = useI18n()
// 必修①(全分支终审):Vue2 六个电源动作 + toggleAutoStart + deleteVM +
// handleInstallationFinished 成功时都会弹一条 buefy toast——这里是唯一的消费点
// (useVmList.ts 的注释一直说"toast 是视图层的事",但视图层此前根本没接,是未申报的
// 偏离,现在补上)。New-UI 的全局 toast 是 useToast()(src/stores/toast.ts),各处
// 弹窗/内联报错都走它,这里同样复用,不新造机制。
const toast = useToast()

// Vue2 isSidebarCollapsed = sidebarCollapsed && !sidebarHover ——
// 折叠后鼠标移上去临时展开,移开又收回。照抄(KVMFullPage.vue:689-690)。
const sidebarCollapsed = ref(false)
const sidebarHover = ref(false)
const collapsed = computed(() => sidebarCollapsed.value && !sidebarHover.value)

// Task 2:左栏齿轮 → 全局设置弹窗。KvmGlobalSettingsDialog 挂载在模板底部,
// 常驻(不是 v-if),用 v-model:open 控制显隐——组件内部的 watch(props.open) 靠这个
// 开关驱动每次打开都重新 fetch(见该组件顶部注释)。
const globalSettingsOpen = ref(false)

const s = useVmList()

// ===================== 创建流程接线(P6 Task 8) =====================
// isoList/hostInfo 必须由 KvmPage 创建、随页面生命周期存活(见 useIsoList.ts 顶部
// 注释)——OsSelector/CreateVmDialog 都是纯展示层,自己不创建这两个 composable。
// ⚠️ 跨任务依赖(Task 7 评审专门点出来要保证的一条):下面模板里 `<OsSelector>` 与
// `<CreateVmDialog>` 的 `:isos` 必须传同一份 `isoList.isos.value`——CreateVmDialog
// 内部 watch(form.osTemplate) 用 osTemplateDefaults(id, props.isos) 查模板,如果两边
// 拿到的 isos 不是同一份,用户在 OsSelector 里选中的模板 id 在创建弹窗里查不到,参数
// 联动(推荐 vcpu/memory/disk)会静默失效。
const isoList = useIsoList()
const hostInfo = useKvmHostInfo()

const createOpen = ref(false)
const osSelectorOpen = ref(false)
const selectedOs = ref<SelectedOs | null>(null)
const creating = ref(false)
const createError = ref('')

// 照 Vue2 handleOSSelect/onOSSelect 的下载三态提示(OSSelector.vue:165/:173/:1421)——
// 下载进度订阅在 isoList 里(常驻,不随弹窗开合断续),这里只管弹 toast。
isoList.onDownloadDone((row) => toast.show(`${row.name} ${t('kvmToastDownloaded')}`))
isoList.onDownloadFailed(() => toast.show(t('kvmDownloadFailed')))

function onOsSelect(os: SelectedOs): void {
  selectedOs.value = os
}

// 打开创建弹窗(点「添加虚拟机」/ 空列表自动弹 都走这里)。照 Vue2 showCreateVM
// (:1155-1157)`this.selectedOS = null` 这一步——避免上一次开了弹窗但没提交就关掉时
// 残留的选择,串到这一次新弹窗里(默认值/宿主机规格改读 useKvmHostInfo 已有的一份,
// 不在这里再拉一次 getSettings,见 CreateVmDialog.vue 顶部「改正确偏离 #2」)。
function openCreateDialog(): void {
  selectedOs.value = null
  createOpen.value = true
}

// 空列表自动弹创建弹窗(照 Vue2 fetchVMs :898-902)。⚠️ 只在"首次拉到空"时弹一次,
// 不在每次刷新后重弹——Vue2 是在 fetchVMs 内部直接判的,而 fetchVMs 只在 mounted 与
// MessageBus 事件里调用,所以 Vue2 天然只有"首次拉到空"这一个入口会触发。New-UI 把
// 这个决定挪到一个独立的 watch(s.isLoading)上,如果照直觉不加任何限制,后续任何一次
// 由 MessageBus 事件触发的 fetchVMs()(比如另一个客户端删光了所有 VM)都会把这个弹窗
// 重新弹出来——即便用户刚刚手动关掉过它。用一次性标志 autoOpenedCreate 显式表达"只弹
// 一次"这条约束,避免将来加新的刷新触发点时不知不觉复发。
let autoOpenedCreate = false
watch(() => s.isLoading.value, (loading) => {
  if (!loading && !autoOpenedCreate && s.vms.value.length === 0) {
    autoOpenedCreate = true
    openCreateDialog()
  }
})

async function onCreateSubmit(payload: KvmCreateVMRequest): Promise<void> {
  creating.value = true
  createError.value = ''
  try {
    const err = await s.create(payload)
    // CreateVmDialog 的 `submitError` 契约(Task 7 已定,与 InstallBanner/ConsoleStage
    // 的 `error-key` 不同):组件内部直接原样渲染,不自己做 te()/t() 判定——它旁边的
    // `localError` 本来就已经是 `t(err.key)` 过的文本,两者要保持"同一个位置显示的都是
    // 已解析好的文本"这个一致性。这里补上判定,避免把 create() 的 i18n 键名 fallback
    // (如 'kvmFailedToCreate')裸传进去,在弹窗里显示成键名而不是中文。
    createError.value = err && te(err) ? t(err) : err
    if (createError.value === '') {
      toast.show(t('kvmToastVmCreated'))
      createOpen.value = false
      selectedOs.value = null
    }
  } finally {
    creating.value = false
  }
}

// ===================== VNC 控制台接线(Task 6) =====================
// ConsoleStage 是真正持有 canvas 挂载点(hostEl)的组件,但 useVncConsole 在 setup 阶段
// 就要拿到一个 Ref——那时候 ConsoleStage 大概率还没挂载(选中 VM 之前右侧是空态)。
// 用 watchEffect 把 ConsoleStage 暴露出来的 hostEl 镜像进这个 ref,始终指向"当前
// ConsoleStage 实例的挂载点"(没有 ConsoleStage 时为 null)。
const stageRef = ref<InstanceType<typeof ConsoleStage> | null>(null)
const hostEl = ref<HTMLElement | null>(null)
watchEffect(() => { hostEl.value = stageRef.value?.hostEl ?? null })
const vnc = useVncConsole(hostEl)

// spice 端口写回(照 Vue2 connectVNC :974-983):同时改列表项和 selectedVM。
// useVncConsole 自己不碰 vms 列表(brief 约定),写回交给数据层的调用方——这里。
vnc.onSpicePorts((vmId, ports) => {
  const inList = s.vms.value.find((v) => v.id === vmId)
  if (inList) {
    inList.spicePort = ports.spicePort
    inList.spiceTlsPort = ports.spiceTlsPort
  }
  if (s.selectedVM.value?.id === vmId) {
    s.selectedVM.value.spicePort = ports.spicePort
    s.selectedVM.value.spiceTlsPort = ports.spiceTlsPort
  }
})

// 电源动作(start/stop/pause/resume/wakeup/restart)的 connect/disconnect 时机由
// useVmList 内部决定(setVMState 之后调用这两个回调),这里只负责把回调接到 useVncConsole
// 的 connect/disconnect 上。
s.onVncShouldConnect((vm) => { void vnc.connect(vm) })
s.onVncShouldDisconnect(() => { vnc.disconnect() })

// 切换选中的 VM 时照 Vue2 watch selectedVM(:747-758)的后半段:只在"换成了不同一台
// VM"时才 connect/disconnect,同一台 VM 原地改 state(电源动作/MessageBus 事件)不
// 走这里,那是上面两个回调的事。前半段的 spice 提示气泡定时器(spiceInfoDismissed/
// spiceTimer)属于 spice-info-bar,Task 6 当时未实现,Task 8 在下面单独一段补上
// (没有合并进这个 watch,是因为下面那段还要在"没有切换 VM、id 没变"的情况下也不
// 触发——同一个 watch 回调很难同时表达"只在 id 变化时 connect/disconnect"和"id 变化
// 就重置计时器"这两条不完全相同的判据,拆开写更清楚,brief Step 3 的示例代码也是
// 拆成独立 watch)。
watch(() => s.selectedVM.value, (newVM, oldVM) => {
  if (!newVM) { vnc.disconnect(); return }
  if (oldVM?.id !== newVM.id) {
    if (newVM.state === 'running') void vnc.connect(newVM)
    else vnc.disconnect()
  }
})

// ===================== 安装横幅 + SPICE 提示条(Task 8) =====================
// 照 Vue2 watch selectedVM 的前半段(:748-752):切换 VM 时复位"已关闭"标记并重置
// 180 秒自动收起的计时器。之所以拆成独立的 watch(而不是塞进上面那个),见上面那段
// 注释的解释。
const hostname = window.location.hostname // 照 Vue2 hostname computed(:707-709),运行期间不变,不需要 ref。
const spiceDismissed = ref(false)
// 评审 Important #2 修复(2026-08-02):切换 VM 时这条也要清掉——上一台 VM 的 eject
// 失败提示不该跟着挪到新选中的 VM 头上("安装横幅内联报错"是本次评审新补的展示位,
// 详见 InstallBanner 组件顶部注释;这里同一个 watch 里一并清,理由与 spiceDismissed
// 复位相同,不单独开一个 watch)。
const ejectError = ref('')
let spiceTimer: ReturnType<typeof setTimeout> | undefined
watch(() => s.selectedVM.value?.id, () => {
  spiceDismissed.value = false
  ejectError.value = ''
  clearTimeout(spiceTimer)
  if (s.selectedVM.value) spiceTimer = setTimeout(() => { spiceDismissed.value = true }, 180_000)
})

// 安装横幅:照 Vue2 :142(v-if="selectedVM && selectedVM.state === 'running' &&
// !selectedVM.bootFromDisk && selectedVM.iso")。
const showInstallBanner = computed(() => {
  const vm = s.selectedVM.value
  return !!vm && vm.state === 'running' && !vm.bootFromDisk && !!vm.iso
})

// SPICE 提示条:照 Vue2 :157(v-if="selectedVM?.spicePort > 0 && selectedVM?.bootFromDisk
// && !spiceInfoDismissed")。
const showSpiceBar = computed(() => {
  const vm = s.selectedVM.value
  return !!vm && vm.spicePort > 0 && vm.bootFromDisk && !spiceDismissed.value
})

const isWindowsGuestSelected = computed(() => isWindowsGuest(s.selectedVM.value))

// 照 Vue2 handleInstallationFinished(:862-877):setBootFromDisk(true) 后整表刷新,
// 这部分逻辑已经在 useVmList.ejectInstallMedia 里实现好了(含它自己独立的重入守卫
// ejectingIds)。这里的 ejectBusy 是**视图层自己的**按钮忙碌态 ref——brief 明确要求
// 不要嫁接 useVmList 内部那个非响应式的 ejectingIds(它只是纯内部去重用的普通 Set,
// 不是 ref,模板读它不会触发重渲染,`InstallBanner` 的 `is-loading` 类会因此永远
// 显示不出来)。两层守卫各司其职:ejectingIds 挡"同一台 VM 并发发两次请求",
// ejectBusy 挡"这个按钮的 loading 视觉要不要显示、按钮点击时要不要被 InstallBanner
// 自己的 onClick 拦下"——功能上有重叠但不是同一份状态,不能互相替代。
const ejectBusy = ref(false)
async function onEjectFinish(): Promise<void> {
  const vm = s.selectedVM.value
  if (!vm || ejectBusy.value) return
  ejectBusy.value = true
  ejectError.value = '' // 新一轮点击先清掉上一次的报错,免得失败一次后永久卡在错误态
  try {
    // 评审二轮修复(Important #2):不再读共享的 s.lastError——那是 runAction/
    // toggleAutostart/remove/ejectInstallMedia 共用的单一 ref,若 eject 在途期间用户对
    // **另一台 VM** 触发了电源动作、恰好在这段 await 的微任务缝隙里 resolve 并写了
    // lastError,原来的写法会把那条不相干的错误显示到这台 VM 的安装横幅上("串味",
    // 见 useVmList.test.ts 里的回归测试)。ejectInstallMedia 现在把结果直接作为返回值
    // 交出来(''=成功,非空=这次调用失败的文案),错误天然只属于"这次调用",不会被
    // 任何并发操作污染。
    ejectError.value = await s.ejectInstallMedia(vm)
    // 必修①:成功也要弹 toast(Vue2 handleInstallationFinished :867-870,固定整句文案,
    // 不像电源动作那样拼 vm.name)。ejectInstallMedia 的返回值契约是 ''=成功/被重入守卫
    // 挡下/dispose 后短路,非空=失败文案(见该函数顶部注释)。这里能安全地把 '' 当成功
    // 处理——本函数入口的 `ejectBusy` 已经保证同一时刻只有一次调用在途,不会撞上"被
    // 重入守卫挡下"的分支;唯一的另一种可能是组件已经卸载(dispose),此时弹不弹 toast
    // 都没有观众,不影响正确性。
    if (ejectError.value === '') toast.show(t('kvmEjectSuccess'))
  } finally {
    ejectBusy.value = false
  }
}

// ===================== SendKey 悬浮工具条 + 全屏(Task 7) =====================
// 照 Vue2 `.console-display` 上的 @mouseenter/@mouseleave/@mousemove(:154,:1140-1153)
// + toggleFullscreen/handleFullscreenChange(:1120-1133,2026-08-02 核对)。
//
// 评审订正(Important #1,记录一下弯路):最初版本用 `<Teleport :to="hostEl">` 把工具条
// 塞进 ConsoleStage 内部的 `.console-display` 节点,鼠标事件也用父组件手写
// `addEventListener` 挂在 hostEl 上——理由是 brief 的 Files 清单没列 ConsoleStage.vue。
// 评审指出这是过度谨慎:brief 清单是"预计会改哪些"不是禁止改动的边界,而 ConsoleStage
// 加一个 `<slot />` + 转发三个鼠标事件(见该文件)比 Teleport + 手写生命周期管理更简单、
// 风险面更小——不需要再自己维护"hostEl 节点变化时摘/挂监听"这一整套(`watch(hostEl,...)`
// + `attachConsoleListeners`/`detachConsoleListeners`,已删除),框架的插槽/事件系统
// 本身就保证了这一点。现在 SendKeyToolbar 作为 `<ConsoleStage>` 的 slot 内容传入,鼠标
// 事件通过 ConsoleStage 转发的 `@console-enter`/`@console-leave`/`@console-move` 接收。
const sendKeyVisible = ref(false)
const toolbarHover = ref(false)
const isFullscreen = ref(false)

// 只在选中的 VM 处于 running 时,工具条才可能出现——对应 Vue2 模板上的
// `v-if="sendKeyVisible && selectedVM.state === 'running'"`(:195)。即便 sendKeyVisible
// 因为 onConsoleEnter 被设成 true,非 running 状态下这里仍然是 false,工具条不会渲染
// (下面 onConsoleEnter 与 Vue2 一样不做状态判断,靠这个 computed 兜底,细节见该函数注释)。
const showSendKeyToolbar = computed(
  () => sendKeyVisible.value && s.selectedVM.value?.state === 'running',
)

// 照 Vue2 :154 `@mouseenter="sendKeyVisible = true"`——注意这里刻意不判断 VM 状态,
// Vue2 原文本身就没判断(只有 leave/move 两个方法内部才判断),1:1 照抄,交给上面的
// showSendKeyToolbar 在渲染层兜底。
function onConsoleEnter(): void {
  sendKeyVisible.value = true
}

// 照 Vue2 onConsoleLeave(:1140-1142)。
function onConsoleLeave(): void {
  if (!toolbarHover.value && s.selectedVM.value?.state === 'running') sendKeyVisible.value = false
}

// 照 Vue2 onConsoleMove(:1144-1153):鼠标在容器内的横坐标进入右侧 80px 就显示,
// 否则(且没有停在工具条上)就隐藏。e.currentTarget 是 ConsoleStage 内部绑定
// @mousemove 的那个 `.console-display` 节点本身(原生事件转发不改变 currentTarget),
// 与 Vue2 逐条等价。
function onConsoleMove(e: MouseEvent): void {
  if (s.selectedVM.value?.state !== 'running') return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  if (mouseX >= rect.width - 80) {
    sendKeyVisible.value = true
  } else if (!toolbarHover.value) {
    sendKeyVisible.value = false
  }
}

// 照 Vue2 toggleFullscreen(:1120-1128):已在全屏就退出,否则对 hostEl 请求全屏,
// 成功后强制显示一次工具条。两者都吞掉 rejection(用户拒绝全屏权限等场景不需要报错)。
function toggleFullscreen(): void {
  const el = hostEl.value
  if (!el) return
  if (!document.fullscreenElement) {
    el.requestFullscreen()
      .then(() => { isFullscreen.value = true; sendKeyVisible.value = true })
      .catch(() => {})
  } else {
    document.exitFullscreen().catch(() => {})
  }
}

// 照 Vue2 handleFullscreenChange(:1130-1133):同步 isFullscreen,进入全屏且 VM
// running 时强制显示工具条(用户可能是按 F11/Esc 之外的系统级手势触发,不一定经过
// 上面的 toggleFullscreen)。
function handleFullscreenChange(): void {
  isFullscreen.value = !!document.fullscreenElement
  if (isFullscreen.value && s.selectedVM.value?.state === 'running') sendKeyVisible.value = true
}

onMounted(() => {
  void s.fetchVMs()
  void isoList.fetch()
  void hostInfo.fetch()
  document.addEventListener('fullscreenchange', handleFullscreenChange)
})
onUnmounted(() => {
  s.dispose()
  vnc.dispose()
  isoList.dispose()
  hostInfo.dispose()
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  clearTimeout(spiceTimer) // Task 8:brief snippet 里独立的 onUnmounted,合并进这里,免得挂两个。
})

function isProcessing(vm: KvmVM | null): boolean {
  return !!vm && s.processing.value.has(vm.id)
}

// 控制台占位区要显示的错误:VNC 连接错误(useVncConsole)优先,没有的话落回电源动作的
// lastError(Task 5 就定下的"控制台内联显示、不弹 toast"约定,见下面 ConsoleStage 的
// error-key 消费处)。两种来源都可能是"i18n key"或"已解析好的原文",由 ConsoleStage
// 内部统一用 te()/t() 判定,这里只管拼优先级。
const consoleErrorKey = computed(() => vnc.errorKey.value || s.lastError.value)

// ===================== 电源动作接线 =====================
// 照 Vue2 confirmStopVM/confirmRestartVM/confirmDeleteVM(:1327-1359):stop/restart/delete
// 三项确认通过后先挂进度遮罩、await 动作、finally 摘遮罩;其余动作(start/pause/resume/
// wakeup/autostart)不显示遮罩,直接 await。
//
// progress 的 title 是完整句子(评审已核实与 Vue2 逐字相同:progressTitle = $t('Stopping VM')
// → zh_CN.json = "正在停止虚拟机" = kvmStopping,不是偏离)。
// message 才是之前漏掉的部分:Vue2 = `${vm.name} ${$t('stopping')}...`(zh_CN.json
// "stopping"="停止中"),这里补上 kvmStoppingShort/kvmRestartingShort/kvmDeletingShort
// 三个"动词进行时"短语键,拼回 `${vm.name} ${t(shortKey)}...`,与 Vue2 逐字对齐,不再是
// 有意的切法偏离(上一轮报告里那条"切法改了"的申报是错的,已订正)。
// toastKey(必修①新增):成功后弹 toast 用的"动词过去时"后缀,拼法逐字对 Vue2
// `${vm.name} ${$t('stopped'/'restarted'/'deleted')}`(KVMFullPage.vue:1548/1564/1614)。
const CONFIRM_ACTIONS: Record<
  string,
  { run: (vm: KvmVM) => Promise<boolean>; titleKey: string; shortKey: string; toastKey: string }
> = {
  stop: { run: (vm) => s.stop(vm), titleKey: 'kvmStopping', shortKey: 'kvmStoppingShort', toastKey: 'kvmToastStopped' },
  restart: { run: (vm) => s.restart(vm), titleKey: 'kvmRestarting', shortKey: 'kvmRestartingShort', toastKey: 'kvmToastRestarted' },
  delete: { run: (vm) => s.remove(vm), titleKey: 'kvmDeleting', shortKey: 'kvmDeletingShort', toastKey: 'kvmToastDeleted' },
}

const progress = ref<{ title: string; message: string } | null>(null)

// lastError 的渲染契约(评审 Important #1,Task 6 起挪进了 ConsoleStage 内部统一处理):
// useVmList 的 errText() 返回值有两种来源——(a) 后端 Error.message 原文(有意义的排障
// 信息),(b) 非 Error 值时的 8 个 i18n **键名** fallback(如 'kvmFailedToStart')。
// useVncConsole 的 errorKey 同样如此(要么是固定 i18n key,要么在 Vue2 里等价的原文)。
// 裸渲染会把 (b) 的键名原样喷给用户,所以两种来源都统一交给 consoleErrorKey → ConsoleStage
// 内部的 te()/t() 判定(同 VmListItem.vue 处理未注册 state key 的写法),这里不用再重复
// 判断一遍。
//
// 与 Vue2 的偏离(已申报):Vue2 电源动作 catch 恒显示固定译文,从不显示后端原文
// (KVMFullPage.vue :1537-1539 等,每个 catch 里只 $t 一句固定文案,e 本身被丢弃)。
// 这里保留"后端 message 优先,缺失时才回退固定译文"的设定——依据本项目既有约定
// (P1 期定:弹窗/内联报错优先显示后端 message,对排障有用;Vue2 一律显示"操作失败"
// 属于信息损失,不值得照抄)。

async function onAction(name: string): Promise<void> {
  const vm = s.selectedVM.value
  if (!vm) return
  // 必修①:提前存一份名字给 toast 用——delete 成功后 vm 会从列表里移除、selectedVM
  // 也会被清空,但 `vm`/`vmName` 是这次调用自己捕获的局部变量,不受那些状态变化影响。
  const vmName = vm.name

  const confirmed = CONFIRM_ACTIONS[name]
  if (confirmed) {
    progress.value = { title: t(confirmed.titleKey), message: `${vm.name} ${t(confirmed.shortKey)}...` }
    let ok = false
    try {
      ok = await confirmed.run(vm)
    } finally {
      progress.value = null
    }
    // 必修①:只有成功才弹 toast——失败分支已经有 lastError 走内联展示(见上面大段
    // 注释的"渲染契约"),Vue2 失败也是走自己的错误 toast,不需要在这里重复处理。
    if (ok) toast.show(`${vmName} ${t(confirmed.toastKey)}`)
    return
  }

  switch (name) {
    case 'start':
      if (await s.start(vm)) toast.show(`${vmName} ${t('kvmToastStarted')}`)
      break
    case 'pause':
      if (await s.pause(vm)) toast.show(`${vmName} ${t('kvmToastPaused')}`)
      break
    case 'resume':
      if (await s.resume(vm)) toast.show(`${vmName} ${t('kvmToastResumed')}`)
      break
    case 'wakeup':
      // Vue2 wakeupVM 成功同样弹 'resumed'(KVMFullPage.vue:1603),不是单独的"已唤醒"
      // 文案——已核对源码确认,不是笔误照抄(见 i18n 分片里 kvmToastResumed 的注释)。
      if (await s.wakeup(vm)) toast.show(`${vmName} ${t('kvmToastResumed')}`)
      break
    case 'autostart': {
      const ok = await s.toggleAutostart(vm)
      // 成功后 vm.autostart 已经是翻转后的新值(useVmList.toggleAutostart 的返回值
      // 契约见该函数顶部注释),直接读它决定 On/Off 文案,不需要另外记一份"取反前的值"。
      if (ok) toast.show(`${vmName} ${t('kvmAutoStart')} ${t(vm.autostart ? 'kvmAutoStartOn' : 'kvmAutoStartOff')}`)
      break
    }
    default: break
  }
}
</script>

<template>
  <div class="kvm-page">
    <div class="kvm-content">
      <button
        class="kvm-sidebar-toggle"
        :class="{ collapsed }"
        :aria-label="t('kvmToggleSidebar')"
        @click="sidebarCollapsed = !sidebarCollapsed"
      >
        <!-- ‹ 是单色文字符号占位(禁 emoji)——Vue2 用的是 casa 图标字体的 collapse svg
             图标,New-UI 没有那套字体。与 ConsoleHeader.vue 的 ⚙/⋮、SendKeyToolbar.vue
             的 ⊞ 等同一批占位债务,等统一换真图标那批一起收(清理项5,全分支终审订正:
             此前写的"后续任务 T4/T8 换图标"已过时——T4/T8 早做完了,没有换)。 -->
        <span class="toggle-icon" aria-hidden="true">‹</span>
      </button>

      <VmSidebar
        :vms="s.vms.value"
        :selected-id="s.selectedVM.value?.id ?? null"
        :running-count="s.runningCount.value"
        :is-loading="s.isLoading.value"
        :collapsed="collapsed"
        @mouseenter="sidebarHover = true"
        @mouseleave="sidebarHover = false"
        @select="s.selectVM"
        @open-global-settings="globalSettingsOpen = true"
        @add-vm="openCreateDialog"
      />

      <main class="kvm-main">
        <div v-if="!s.selectedVM.value" class="main-empty">
          <div class="empty-icon-ring">
            <!-- ▭ 是单色文字符号占位(禁 emoji)——同上面 ‹ 一批占位债务,等统一换真
                 图标那批一起收,不是本任务遗漏。 -->
            <span class="main-empty-icon" aria-hidden="true">▭</span>
          </div>
          <h3>{{ t('kvmSelectVmTitle') }}</h3>
          <p>{{ t('kvmSelectVmHint') }}</p>
        </div>

        <div v-else class="vm-console-container">
          <ConsoleHeader
            :vm="s.selectedVM.value"
            :processing="isProcessing(s.selectedVM.value)"
            @action="onAction"
          />

          <!-- 安装横幅是 `.vm-console-container` 的直接子节点,console-header 和
               ConsoleStage(console-display)之间——照 Vue2 模板 :142 的 DOM 位置。 -->
          <InstallBanner
            v-if="showInstallBanner"
            :busy="ejectBusy"
            :error-key="ejectError"
            @finish="onEjectFinish"
          />

          <ConsoleStage
            ref="stageRef"
            :vm="s.selectedVM.value"
            :connected="vnc.connected.value"
            :error-key="consoleErrorKey"
            :processing="isProcessing(s.selectedVM.value)"
            @start="onAction('start')"
            @resume="onAction('resume')"
            @console-enter="onConsoleEnter"
            @console-leave="onConsoleLeave"
            @console-move="onConsoleMove"
          >
            <!-- SPICE 提示条与 SendKey 工具条一样作为 ConsoleStage 的 slot 内容传入
                 (DOM 层级与 Vue2 完全一致——两者都是 `.console-display` 的直接子节点,
                 `position:absolute` 的定位基准也是它)。⚠️ 与 Vue2 的偏离(DOM 顺序,
                 已申报):Vue2 里 spice-info-bar 排在 console-placeholder **前面**,这里
                 因为 ConsoleStage 内部先渲染 console-placeholder 再渲染 `<slot />`,顺序
                 反过来了。视觉上没有影响——两者都是显式 z-index 的 position:absolute
                 元素(spice-info-bar: 30,console-placeholder: 1),层叠顺序由 z-index
                 决定,不看 DOM 顺序,详见 SpiceInfoBar 组件与 kvm.css 里
                 `.spice-info-bar` 段的注释。 -->
            <transition name="spice-toast">
              <SpiceInfoBar
                v-if="showSpiceBar"
                :hostname="hostname"
                :spice-port="s.selectedVM.value?.spicePort ?? 0"
                :is-windows-guest="isWindowsGuestSelected"
                @close="spiceDismissed = true"
              />
            </transition>
            <transition name="sendkey-slide">
              <SendKeyToolbar
                v-if="showSendKeyToolbar"
                :modifiers="vnc.modifiers.value"
                :is-fullscreen="isFullscreen"
                @mouseenter="toolbarHover = true"
                @mouseleave="toolbarHover = false"
                @toggle="vnc.toggleModifier"
                @key="vnc.sendKey"
                @ctrl-alt-del="vnc.sendCtrlAltDel"
                @fullscreen="toggleFullscreen"
              />
            </transition>
          </ConsoleStage>
        </div>
      </main>
    </div>

    <ProgressOverlay v-if="progress" :title="progress.title" :message="progress.message" />

    <!-- @saved(评审指出的真缺陷修复,P6 Task 8):KvmGlobalSettingsDialog 自己持有独立
         一份 useKvmHostInfo() 实例(Task 2 的隔离设计,保存前用本地副本编辑,取消不
         污染共享 state)。这份 `hostInfo` 是另一份独立实例,喂给下面 CreateVmDialog 的
         `:defaults`——两者互不知道对方的存在,保存成功只更新了弹窗自己那份,这份如果
         不重新 fetch,创建弹窗预填的默认 vCPU/内存会停在保存前的旧值上。不把 hostInfo
         当 props 传进弹窗(会破坏 Task 2 已评审通过的本地副本隔离边界),而是让弹窗
         保存成功后 emit 一次,这里收到后重新拉一次自己那份。 -->
    <KvmGlobalSettingsDialog v-model:open="globalSettingsOpen" @saved="void hostInfo.fetch()" />

    <!-- P6 Task 8:创建弹窗 + ISO 选择器。⚠️ 两处 `:isos` 必须传同一份
         `isoList.isos.value`(见上面脚本段的跨任务依赖注释),不能各自另开一份。
         OsSelector 的 z-base=920 叠在 CreateVmDialog(默认 900)之上,与 Vue2
         b-modal 的层级顺序一致。 -->
    <CreateVmDialog
      v-model:open="createOpen"
      :host="hostInfo.host.value"
      :defaults="hostInfo.settings.value"
      :isos="isoList.isos.value"
      :selected-os="selectedOs"
      :creating="creating"
      :submit-error="createError"
      @open-os-selector="osSelectorOpen = true"
      @submit="onCreateSubmit"
    />
    <OsSelector
      v-model:open="osSelectorOpen"
      :isos="isoList.isos.value"
      @select="onOsSelect"
      @download="isoList.download"
      @need-wait="toast.show(t('kvmWaitForDownload'))"
    />
  </div>
</template>
