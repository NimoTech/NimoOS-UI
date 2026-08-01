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
// 内部的 pendingAction/pendingId 自然是空的,不需要额外操心"上次留下的确认态"。
const menuOpen = ref(false)
const wrapperEl = ref<HTMLElement | null>(null)
const overflowRef = ref<InstanceType<typeof OverflowMenu> | null>(null)

// 照 Vue2 toggleOverflowMenu(:1115-1117):即将关闭时先清一次确认态(v-if 卸载本身也会
// 清,这里额外调用是为了在"卸载真正发生前"就把待确认文字换回去,避免收起动画期间
// 用户还能瞥见一帧"你确定吗？"——本组件没有收起过渡动画,这里保留只是照抄语义,不是
// 观测到了这个问题才加的防御。
function toggleMenu() {
  if (menuOpen.value) overflowRef.value?.reset()
  menuOpen.value = !menuOpen.value
}

// 照 Vue2 handleOutsideClick(:1108-1111):点 dropdown-wrapper 外部时关闭菜单 + 清确认态。
function handleOutsideClick(e: MouseEvent) {
  if (menuOpen.value && wrapperEl.value && !wrapperEl.value.contains(e.target as Node)) {
    overflowRef.value?.reset()
    menuOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleOutsideClick))
onUnmounted(() => document.removeEventListener('click', handleOutsideClick))

// 切换 VM 时菜单与确认态一起清空(Task 5 brief 就地二次确认契约的第 4 条)。
watch(() => props.vm.id, () => {
  overflowRef.value?.reset()
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
          ref="overflowRef"
          :vm="vm"
          :processing="processing"
          @action="onMenuAction"
        />
      </div>
    </div>
  </div>
</template>
