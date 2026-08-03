<script setup lang="ts">
// 溢出菜单(⋮)。视觉 1:1 对 Vue2 components/KVM/KVMFullPage.vue :102-136
// (v-if="showOverflowMenu" 那个 .overflow-dropdown 块)。
//
// 菜单开关(showOverflowMenu)不归本组件管 —— 父组件 ConsoleHeader 用 v-if 控制本组件
// 的挂载/卸载,本组件只管"菜单里点了哪一项"这一层逻辑。
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { KvmVM } from '@nimotech/nimoos-service'
import {
  canPowerOn, canShutDown, canRestart, canPause, canResume, canWakeUp,
  canDelete, showDeleteDivider,
} from '../util/vmState'

const props = defineProps<{ vm: KvmVM; processing: boolean }>()
const emit = defineEmits<{ action: [name: string] }>()

const { t } = useI18n()

// 就地二次确认(2026-08-02 拍板,照 Vue2 confirmStopVM/confirmRestartVM/confirmDeleteVM
// :1322-1365 + resetPendingConfirm :1135-1137)。
//
// 确认目标用非响应式的闭包变量存(P4 教训:响应式变量在弹窗关闭动画期间可能被外部
// 提前清空,导致"第二次点击"读到的确认目标已经是空值,误判成"重新进入待确认"而不是
// "确认执行")。真正的判断逻辑(isPending)只读这两个普通变量;`tick` 是一个不参与
// 判断、只用来告诉 Vue "该重渲染了"的 ref —— 模板里的 isPending() 调用会读它建立响应式
// 依赖,但决策本身完全基于上面两个非响应式变量,不依赖 Vue 什么时候把 ref 同步好。
let pendingAction = ''
let pendingId = ''
const tick = ref(0)

function isPending(action: string): boolean {
  void tick.value
  return pendingAction === action && pendingId === props.vm.id
}

function setPending(action: string, id: string) {
  pendingAction = action
  pendingId = id
  tick.value++
}

function reset() {
  setPending('', '')
}

/** 需要二次确认的三项(stop/restart/delete)。第一次点存目标,第二次点(目标一致)才 emit。 */
function confirmThenEmit(action: string) {
  if (isPending(action)) {
    reset()
    emit('action', action)
  } else {
    setPending(action, props.vm.id)
  }
}

/** 一次点直接执行的项(start/pause/resume/wakeup/autostart)。
 * 照 Vue2 每个直接动作按钮上的 `resetPendingConfirm(); xxxVM(...); showOverflowMenu=false`——
 * 关菜单交给父组件(收到 action 事件后自己关),这里只负责清掉别的项可能挂着的待确认态。 */
function direct(action: string) {
  reset()
  emit('action', action)
}

// 清理项8(全分支终审):这里曾经 `defineExpose({ reset })`,给 ConsoleHeader 在关菜单
// 时显式调用。T5 评审已经证实那几处调用是死代码并删掉了(v-if 卸载天然带走
// pendingAction/pendingId,见 ConsoleHeader.vue 顶部注释),`reset` 从那以后就没有任何
// 外部消费方——只剩自己文件里的单测在调用它,是纯粹为了测试暴露内部实现的 YAGNI 残留。
// 已去掉 defineExpose,`reset` 保留为内部函数(confirmThenEmit/direct 仍然要用)。

// Task 8 补:Vue2 每一项前面都有一个 b-icon(图标+文字版式,:103-133),T5 当时只搬了
// 文字。New-UI 没有 casa 图标字体,按本区既有惯例(⚙/⋮/‹ 等单色文字符号占位,禁 emoji)
// 补上——符号本身不是对应图标的精确复刻,是占位手法的延续,"每项都有图标"这个版式
// 意图才是 1:1 的部分。自动启动一项 Vue2 本来就没有 b-icon(那颗 toggle-indicator 圆点
// 本身就是它的"图标"),故不额外加符号,原样保留。
// ⚠️ 这条注释特意放在 script 块而不是 <template> 里根 div 的正上方——Vue 3 编译器会把
// "模板级注释 + 根元素"识别成两个根节点的 Fragment(见 VmSidebar 组件同一处踩坑的详细
// 记录),放在 script 里就不会污染模板的单根结构。
</script>

<template>
  <div class="overflow-dropdown">
    <button v-if="canPowerOn(vm)" class="dropdown-item" type="button" @click="direct('start')">
      <span class="dropdown-icon" aria-hidden="true">▶</span>
      <span>{{ t('kvmPowerOn') }}</span>
    </button>

    <button v-if="canShutDown(vm)" class="dropdown-item" type="button" @click="confirmThenEmit('stop')">
      <span class="dropdown-icon" aria-hidden="true">⊘</span>
      <span :class="{ 'confirm-text-danger': isPending('stop') }">
        {{ isPending('stop') ? t('kvmAreYouSure') : t('kvmForceShutDown') }}
      </span>
    </button>

    <button v-if="canRestart(vm)" class="dropdown-item" type="button" @click="confirmThenEmit('restart')">
      <span class="dropdown-icon" aria-hidden="true">↻</span>
      <span :class="{ 'confirm-text-danger': isPending('restart') }">
        {{ isPending('restart') ? t('kvmAreYouSure') : t('kvmForceRestart') }}
      </span>
    </button>

    <button v-if="canPause(vm)" class="dropdown-item" type="button" @click="direct('pause')">
      <span class="dropdown-icon" aria-hidden="true">‖</span>
      <span>{{ t('kvmPause') }}</span>
    </button>

    <button v-if="canResume(vm)" class="dropdown-item" type="button" @click="direct('resume')">
      <span class="dropdown-icon" aria-hidden="true">▶</span>
      <span>{{ t('kvmResume') }}</span>
    </button>

    <button v-if="canWakeUp(vm)" class="dropdown-item" type="button" @click="direct('wakeup')">
      <span class="dropdown-icon" aria-hidden="true">▶</span>
      <span>{{ t('kvmWakeUp') }}</span>
    </button>

    <button class="dropdown-item" type="button" :disabled="processing" @click="direct('autostart')">
      <span class="toggle-indicator" :class="{ on: vm.autostart }"></span>
      <span>{{ t('kvmAutoStart') }}</span>
    </button>

    <div v-if="showDeleteDivider(vm)" class="dropdown-divider"></div>

    <button v-if="canDelete(vm)" class="dropdown-item is-danger" type="button" @click="confirmThenEmit('delete')">
      <!-- 评审 Minor 修复:原用 × 与 SpiceInfoBar 的关闭按钮同一个字符,同页面同符不同义。
           改用 ⊟(方框减号,与 ⊘/⊞ 同一个 Mathematical Operators 区块,已用截图核对过
           清晰单色渲染),语义上"移除/减去"比借用关闭按钮的 × 更贴切。 -->
      <span class="dropdown-icon" aria-hidden="true">⊟</span>
      <span>{{ isPending('delete') ? t('kvmAreYouSure') : t('kvmDelete') }}</span>
    </button>
  </div>
</template>
