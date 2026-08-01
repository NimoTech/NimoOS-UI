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

onMounted(() => { void s.fetchVMs() })
onUnmounted(() => { s.dispose(); vnc.dispose() })

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
        </div>
      </main>
    </div>

    <ProgressOverlay v-if="progress" :title="progress.title" :message="progress.message" />
  </div>
</template>
