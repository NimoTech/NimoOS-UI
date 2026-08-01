<script setup lang="ts">
// KVM 区主页(路由 /kvm)。视觉 1:1 对 Vue2 components/KVM/KVMFullPage.vue。
// P5 = 列表 + 控制台 + 电源;P6 补创建向导 / VM 设置 / 快照 / 全局设置。
//
// ⚠️ 本区**固定深色,不跟随全局主题** —— Vue2 该页是写死的深色控制台配色,
// --kvm-* token 在两个主题块里同值(见 styles/theme.sp9.css 注释)。
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import '../styles/kvm.css'
import VmSidebar from '../components/VmSidebar.vue'
import ConsoleHeader from '../components/ConsoleHeader.vue'
import ProgressOverlay from '../components/ProgressOverlay.vue'
import { useVmList } from '../composables/useVmList'
import type { KvmVM } from '@nimotech/nimoos-service'

const { t, te } = useI18n()

// Vue2 isSidebarCollapsed = sidebarCollapsed && !sidebarHover ——
// 折叠后鼠标移上去临时展开,移开又收回。照抄(KVMFullPage.vue:689-690)。
const sidebarCollapsed = ref(false)
const sidebarHover = ref(false)
const collapsed = computed(() => sidebarCollapsed.value && !sidebarHover.value)

const s = useVmList()
onMounted(() => { void s.fetchVMs() })
onUnmounted(() => s.dispose())

function isProcessing(vm: KvmVM | null): boolean {
  return !!vm && s.processing.value.has(vm.id)
}

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

// lastError 的渲染契约(评审 Important #1):useVmList 的 errText() 返回值有两种来源——
// (a) 后端 Error.message 原文(有意义的排障信息),(b) 非 Error 值时的 8 个 i18n **键名**
// fallback(如 'kvmFailedToStart')。裸渲染会把 (b) 的键名原样喷给用户。用 te() 判断:
// 命中已注册的 i18n key 就 t() 一下,否则原样显示(同 VmListItem.vue 处理未注册
// state key 的写法)。注意方向不能反——不能把后端返回的正常文本误当 key 去 t()
// (te() 对任意非 key 字符串本来就返回 false,天然安全)。
//
// 与 Vue2 的偏离(已申报):Vue2 电源动作 catch 恒显示固定译文,从不显示后端原文
// (KVMFullPage.vue :1537-1539 等,每个 catch 里只 $t 一句固定文案,e 本身被丢弃)。
// 这里保留"后端 message 优先,缺失时才回退固定译文"的设定——依据本项目既有约定
// (P1 期定:弹窗/内联报错优先显示后端 message,对排障有用;Vue2 一律显示"操作失败"
// 属于信息损失,不值得照抄)。
const lastErrorText = computed(() => {
  const raw = s.lastError.value
  return raw && te(raw) ? t(raw) : raw
})

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

          <!-- 控制台主体(VNC 画布/开机按钮)归后续任务;Task 5 只需要把动作失败的
               lastError 内联显示出来(硬约束 9:不用 toast)。 -->
          <div class="console-display">
            <div class="console-placeholder">
              <p v-if="s.lastError.value" class="console-hint is-error">{{ lastErrorText }}</p>
            </div>
          </div>
        </div>
      </main>
    </div>

    <ProgressOverlay v-if="progress" :title="progress.title" :message="progress.message" />
  </div>
</template>
