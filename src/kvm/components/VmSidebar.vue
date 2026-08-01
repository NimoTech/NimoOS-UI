<script setup lang="ts">
// 左侧栏:头部(logo+标题+运行计数+齿轮)+ VM 列表 + 底部添加按钮。
// 视觉 1:1 对 Vue2 components/KVM/KVMFullPage.vue:10-67(<aside class="kvm-sidebar">…</aside>)。
//
// 折叠(collapsed)由父组件 KvmPage 算好传入,这里只负责把它反映到根元素的 class 上——
// 折叠态展开/收起的鼠标 hover 逻辑不属于本组件,KvmPage 直接在 <VmSidebar> 标签上挂
// @mouseenter/@mouseleave,Vue 3 对未声明为 emits 的原生 DOM 事件监听器会自动落到
// 单根组件的根元素上(attrs fallthrough),不需要本组件显式转发。
import type { KvmVM } from '@nimotech/nimoos-service'
import { useI18n } from 'vue-i18n'
import VmListItem from './VmListItem.vue'
import kvmLogo from '../assets/kvm.svg'

defineProps<{
  vms: KvmVM[]
  selectedId: string | null
  runningCount: number
  isLoading: boolean
  collapsed: boolean
}>()
defineEmits<{ select: [vm: KvmVM] }>()

const { t } = useI18n()
</script>

<template>
  <aside class="kvm-sidebar" :class="{ collapsed }">
    <header class="kvm-header">
      <div class="kvm-header-left">
        <img :src="kvmLogo" class="kvm-logo" alt="KVM" />
        <div class="kvm-header-text">
          <h2 class="kvm-title">{{ t('kvmTitle') }}</h2>
          <span class="kvm-status">
            <span class="status-dot" :class="{ running: runningCount > 0 }"></span>
            {{ runningCount }} / {{ vms.length }} {{ t('kvmRunningSuffix') }}
          </span>
        </div>
      </div>
      <div class="kvm-header-right">
        <!-- 齿轮=全局设置入口,P6 才实现;拍板要求形状先立起来但 disabled + title 说明。
             ⚙ 是单色文字符号(非 emoji),色值走 .kvm-settings-btn 的 color token。 -->
        <button
          class="kvm-settings-btn"
          type="button"
          disabled
          :title="t('kvmComingSoon')"
          :aria-label="t('kvmSettings')"
        >
          <span aria-hidden="true">⚙</span>
        </button>
      </div>
    </header>

    <div class="vm-list">
      <div v-if="vms.length === 0 && !isLoading" class="empty-state">
        <!-- ⬚ 占位符(禁 emoji),后续任务换成 Vue2 同款 remote-desktop-outline 图标。 -->
        <span class="empty-icon" aria-hidden="true">⬚</span>
        <p class="empty-text">{{ t('kvmNoVms') }}</p>
      </div>

      <VmListItem
        v-for="vm in vms"
        :key="vm.id"
        :vm="vm"
        :active="selectedId === vm.id"
        @select="$emit('select', vm)"
      />
    </div>

    <!-- 添加虚拟机=P6 才实现;同样先立形状,disabled + title 说明(拍板 2026-08-02)。 -->
    <button class="add-vm-btn" type="button" disabled :title="t('kvmComingSoon')">
      <span aria-hidden="true">+</span>
      <span>{{ t('kvmAddVm') }}</span>
    </button>
  </aside>
</template>
