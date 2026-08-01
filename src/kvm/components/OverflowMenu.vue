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

defineExpose({ reset })
</script>

<template>
  <div class="overflow-dropdown">
    <button v-if="canPowerOn(vm)" class="dropdown-item" type="button" @click="direct('start')">
      <span>{{ t('kvmPowerOn') }}</span>
    </button>

    <button v-if="canShutDown(vm)" class="dropdown-item" type="button" @click="confirmThenEmit('stop')">
      <span :class="{ 'confirm-text-danger': isPending('stop') }">
        {{ isPending('stop') ? t('kvmAreYouSure') : t('kvmForceShutDown') }}
      </span>
    </button>

    <button v-if="canRestart(vm)" class="dropdown-item" type="button" @click="confirmThenEmit('restart')">
      <span :class="{ 'confirm-text-danger': isPending('restart') }">
        {{ isPending('restart') ? t('kvmAreYouSure') : t('kvmForceRestart') }}
      </span>
    </button>

    <button v-if="canPause(vm)" class="dropdown-item" type="button" @click="direct('pause')">
      <span>{{ t('kvmPause') }}</span>
    </button>

    <button v-if="canResume(vm)" class="dropdown-item" type="button" @click="direct('resume')">
      <span>{{ t('kvmResume') }}</span>
    </button>

    <button v-if="canWakeUp(vm)" class="dropdown-item" type="button" @click="direct('wakeup')">
      <span>{{ t('kvmWakeUp') }}</span>
    </button>

    <button class="dropdown-item" type="button" :disabled="processing" @click="direct('autostart')">
      <span class="toggle-indicator" :class="{ on: vm.autostart }"></span>
      <span>{{ t('kvmAutoStart') }}</span>
    </button>

    <div v-if="showDeleteDivider(vm)" class="dropdown-divider"></div>

    <button v-if="canDelete(vm)" class="dropdown-item is-danger" type="button" @click="confirmThenEmit('delete')">
      <span>{{ isPending('delete') ? t('kvmAreYouSure') : t('kvmDelete') }}</span>
    </button>
  </div>
</template>
