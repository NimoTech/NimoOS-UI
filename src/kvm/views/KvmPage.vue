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

const { t } = useI18n()

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
// progress 的 title/message 拆法与 Vue2 不同(已申报偏离):Vue2 是"固定标题(Stopping VM)+
// 拼字符串的动态 message(`${vm.name} stopping...`)"。这里 zh_cn.sp9.ts 的 kvmStopping/
// kvmRestarting/kvmDeleting 已经是"正在停止/重启/删除虚拟机"这种完整句子(不是可拼接的
// 动词片段,见 task-5-report.md 的 i18n 核对表),所以改成 title=完整句子、message=vm 名,
// 卡片读起来是"正在停止虚拟机 / sp9-alpine-test",信息不丢,只是标题/正文的切法变了。
const CONFIRM_ACTIONS: Record<string, { run: (vm: KvmVM) => Promise<void>; titleKey: string }> = {
  stop: { run: (vm) => s.stop(vm), titleKey: 'kvmStopping' },
  restart: { run: (vm) => s.restart(vm), titleKey: 'kvmRestarting' },
  delete: { run: (vm) => s.remove(vm), titleKey: 'kvmDeleting' },
}

const progress = ref<{ title: string; message: string } | null>(null)

async function onAction(name: string): Promise<void> {
  const vm = s.selectedVM.value
  if (!vm) return

  const confirmed = CONFIRM_ACTIONS[name]
  if (confirmed) {
    progress.value = { title: t(confirmed.titleKey), message: vm.name }
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
              <p v-if="s.lastError.value" class="console-hint is-error">{{ s.lastError.value }}</p>
            </div>
          </div>
        </div>
      </main>
    </div>

    <ProgressOverlay v-if="progress" :title="progress.title" :message="progress.message" />
  </div>
</template>
