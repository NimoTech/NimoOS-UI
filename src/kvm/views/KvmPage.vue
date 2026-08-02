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
import { useVmList } from '../composables/useVmList'
import { useVncConsole } from '../composables/useVncConsole'
import { isWindowsGuest } from '../util/vmState'
import type { KvmVM } from '@nimotech/nimoos-service'

const { t } = useI18n()

// Vue2 isSidebarCollapsed = sidebarCollapsed && !sidebarHover ——
// 折叠后鼠标移上去临时展开,移开又收回。照抄(KVMFullPage.vue:689-690)。
const sidebarCollapsed = ref(false)
const sidebarHover = ref(false)
const collapsed = computed(() => sidebarCollapsed.value && !sidebarHover.value)

const s = useVmList()

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
  document.addEventListener('fullscreenchange', handleFullscreenChange)
})
onUnmounted(() => {
  s.dispose()
  vnc.dispose()
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
const CONFIRM_ACTIONS: Record<string, { run: (vm: KvmVM) => Promise<void>; titleKey: string; shortKey: string }> = {
  stop: { run: (vm) => s.stop(vm), titleKey: 'kvmStopping', shortKey: 'kvmStoppingShort' },
  restart: { run: (vm) => s.restart(vm), titleKey: 'kvmRestarting', shortKey: 'kvmRestartingShort' },
  delete: { run: (vm) => s.remove(vm), titleKey: 'kvmDeleting', shortKey: 'kvmDeletingShort' },
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

  const confirmed = CONFIRM_ACTIONS[name]
  if (confirmed) {
    progress.value = { title: t(confirmed.titleKey), message: `${vm.name} ${t(confirmed.shortKey)}...` }
    try {
      await confirmed.run(vm)
    } finally {
      progress.value = null
    }
    return
  }

  switch (name) {
    case 'start': await s.start(vm); break
    case 'pause': await s.pause(vm); break
    case 'resume': await s.resume(vm); break
    case 'wakeup': await s.wakeup(vm); break
    case 'autostart': await s.toggleAutostart(vm); break
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
        <!-- ‹ 是临时占位单色符号(禁 emoji),后续任务(T4/T8)换成 Vue2 同款 collapse svg 图标。 -->
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
      />

      <main class="kvm-main">
        <div v-if="!s.selectedVM.value" class="main-empty">
          <div class="empty-icon-ring">
            <!-- ▭ 是临时占位单色符号(禁 emoji),后续任务换成 Vue2 同款空态图标。 -->
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
  </div>
</template>
