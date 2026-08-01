<script setup lang="ts">
// 控制台头(VM 名/OS 图标/状态点 + 设置/更多两个动作按钮)。
// 视觉 1:1 对 Vue2 components/KVM/KVMFullPage.vue :79-140(console-header 整块)。
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { KvmVM } from '@nimotech/nimoos-service'
import { stateLabelKey } from '../util/vmState'
import { osIconFor } from '../util/format'
import OverflowMenu from './OverflowMenu.vue'

const props = defineProps<{ vm: KvmVM; processing: boolean }>()
const emit = defineEmits<{ action: [name: string] }>()

const { t, te } = useI18n()

// 状态文字:同 VmListItem 的写法(T4 已用过),未注册的 key(crashed/missing)原样显示。
const stateKey = computed(() => stateLabelKey(props.vm.state))
const stateText = computed(() => (te(stateKey.value) ? t(stateKey.value) : stateKey.value))

// 溢出菜单开关。用 v-if(不是 v-show)挂载/卸载 OverflowMenu —— 每次重新打开都是全新实例,
// 内部的 pendingAction/pendingId 自然是空的。
//
// 评审 Minor 修复(选 (b)):之前 toggleMenu/handleOutsideClick/watch 三处都额外调用了
// `overflowRef.value?.reset()`,变异验证证明这是死代码——菜单关闭统一走 `menuOpen.value
// = false`,而 OverflowMenu 挂在 `v-if="menuOpen"` 下,一旦 menuOpen 变 false 整个组件
// 实例连同它内部的 pendingAction/pendingId 一起被销毁,根本不存在"关闭动画期间用户还能
// 瞥见一帧确认文字"这种窗口(v-if 不是 v-show,没有过渡动画,销毁是同步的下一次 patch)。
// 上一版注释里"照 Vue2 toggleOverflowMenu 需要显式 resetPendingConfirm"这句站不住:
// Vue2 的菜单是**常驻 DOM**、用 `v-if="showOverflowMenu"` 控制显隐但 pendingConfirmAction
// 是父组件(KVMFullPage)自己的 data,不随子节点销毁而清空,所以 Vue2 必须显式清;这里
// 确认态是 OverflowMenu 自己的内部状态,天然随组件销毁而清空,不需要再叫一次。已删掉
// 三处死调用,`overflowRef`/`defineExpose({ reset })` 的调用方也一并去掉(OverflowMenu
// 自己仍导出 reset() 并有独立测试覆盖,只是 ConsoleHeader 不再需要调用它)。
const menuOpen = ref(false)
const wrapperEl = ref<HTMLElement | null>(null)

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

// 照 Vue2 handleOutsideClick(:1108-1111):点 dropdown-wrapper 外部时关闭菜单。
function handleOutsideClick(e: MouseEvent) {
  if (menuOpen.value && wrapperEl.value && !wrapperEl.value.contains(e.target as Node)) {
    menuOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleOutsideClick))
onUnmounted(() => document.removeEventListener('click', handleOutsideClick))

// 切换 VM 时菜单一起清空(Task 5 brief 就地二次确认契约的第 4 条:"确认态"本身随
// OverflowMenu 卸载自动清空,这里只需要把菜单关掉)。
watch(() => props.vm.id, () => {
  menuOpen.value = false
})

// 菜单里点了某一项:透传给父组件,并关菜单(照 Vue2 每个 dropdown-item 点击表达式里
// 末尾都带的 `showOverflowMenu=false`)。
function onMenuAction(name: string) {
  emit('action', name)
  menuOpen.value = false
}
</script>

<template>
  <div class="console-header">
    <div class="console-title">
      <img :src="osIconFor(vm.os)" class="console-os-icon" :alt="vm.os" />
      <div>
        <h3>{{ vm.name }}</h3>
        <div class="console-status">
          <span class="status-dot" :class="vm.state"></span>
          <span class="status-text">{{ stateText }}</span>
        </div>
      </div>
    </div>
    <div class="console-actions">
      <!-- 硬约束 5:系统设置入口 P6 才实现,P5 恒 disabled + title 说明("即将上线"),
           不照 Vue2 的 canEditSettings 切换 tooltip 文案(那套逻辑连同"设置弹窗"本身都是
           P6 的活)。⚙ 是单色文字符号(禁 emoji),与 VmSidebar 的齿轮同款占位手法。 -->
      <button
        class="action-btn"
        type="button"
        disabled
        :title="t('kvmComingSoon')"
        :aria-label="t('kvmSettings')"
      >
        <span aria-hidden="true">⚙</span>
      </button>
      <div class="dropdown-wrapper" ref="wrapperEl">
        <button
          class="action-btn"
          type="button"
          :title="t('kvmMore')"
          :aria-label="t('kvmMore')"
          @click="toggleMenu"
        >
          <span aria-hidden="true">⋮</span>
        </button>
        <OverflowMenu
          v-if="menuOpen"
          :vm="vm"
          :processing="processing"
          @action="onMenuAction"
        />
      </div>
    </div>
  </div>
</template>
