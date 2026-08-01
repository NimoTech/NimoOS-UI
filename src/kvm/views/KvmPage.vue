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
import ProgressOverlay from '../components/ProgressOverlay.vue'
import { useVmList } from '../composables/useVmList'
import { useVncConsole } from '../composables/useVncConsole'
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
// spiceTimer)属于 spice-info-bar,不在 Task 6 范围内,未实现。
watch(() => s.selectedVM.value, (newVM, oldVM) => {
  if (!newVM) { vnc.disconnect(); return }
  if (oldVM?.id !== newVM.id) {
    if (newVM.state === 'running') void vnc.connect(newVM)
    else vnc.disconnect()
  }
})

// ===================== SendKey 悬浮工具条 + 全屏(Task 7) =====================
// 照 Vue2 `.console-display` 上的 @mouseenter/@mouseleave/@mousemove(:154,:1140-1153)
// + toggleFullscreen/handleFullscreenChange(:1120-1133,2026-08-02 核对)。
//
// ⚠️ 与 Vue2 模板写法的偏离(架构层面,不是逻辑偏离,已申报):Vue2 把这三个事件直接
// 写在 `.console-display` 的模板标签上,因为那个 div 和 toggleFullscreen/onConsoleMove
// 这些方法同属一个组件。这里 `.console-display` 是 ConsoleStage 组件内部渲染的节点,
// KvmPage 自己的模板里没有这个标签可以挂 @mouseenter——但 KvmPage 已经通过上面的
// `hostEl`(watchEffect 镜像 ConsoleStage 暴露出来的同一个真实 DOM 节点)拿到了它,
// 所以改用原生 addEventListener 挂在 hostEl 上,语义与 Vue2 逐条相同,只是绑定手法从
// 模板属性变成了 JS 调用。选择让 KvmPage(而不是 ConsoleStage)持有这套状态机,是因为
// sendKeyVisible/isFullscreen 同时还要驱动 SendKeyToolbar 的 v-if 和 Teleport 挂载,
// 两者本就该在同一处维护,brief 也明确把这两个 ref 摆在 KvmPage。
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
// 否则(且没有停在工具条上)就隐藏。
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

function attachConsoleListeners(el: HTMLElement): void {
  el.addEventListener('mouseenter', onConsoleEnter)
  el.addEventListener('mouseleave', onConsoleLeave)
  el.addEventListener('mousemove', onConsoleMove)
}
function detachConsoleListeners(el: HTMLElement): void {
  el.removeEventListener('mouseenter', onConsoleEnter)
  el.removeEventListener('mouseleave', onConsoleLeave)
  el.removeEventListener('mousemove', onConsoleMove)
}
// hostEl 在 ConsoleStage 挂载/卸载时变化(选中/取消选中 VM 都可能触发),每次换成新节点
// 都要先摘旧的监听再挂新的,避免残留监听指向一个已经不在文档树里的旧节点。
watch(hostEl, (newEl, oldEl) => {
  if (oldEl) detachConsoleListeners(oldEl)
  if (newEl) attachConsoleListeners(newEl)
})

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
  if (hostEl.value) detachConsoleListeners(hostEl.value)
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

          <ConsoleStage
            ref="stageRef"
            :vm="s.selectedVM.value"
            :connected="vnc.connected.value"
            :error-key="consoleErrorKey"
            :processing="isProcessing(s.selectedVM.value)"
            @start="onAction('start')"
            @resume="onAction('resume')"
          />

          <!-- Teleport 到 hostEl(即 ConsoleStage 内部真正的 `.console-display` 节点)——
               见上面脚本注释:只有这样 `.sendkey-toolbar` 的绝对定位才能相对
               `.console-display` 计算,与 Vue2 的 DOM 层级(工具条是它的直接子节点)
               保持一致。`v-if="hostEl"` 防止 ConsoleStage 还没挂载时 Teleport 目标为空。 -->
          <Teleport v-if="hostEl" :to="hostEl">
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
          </Teleport>
        </div>
      </main>
    </div>

    <ProgressOverlay v-if="progress" :title="progress.title" :message="progress.message" />
  </div>
</template>
