<script setup lang="ts">
// 左侧栏:头部(logo+标题+运行计数+齿轮)+ VM 列表 + 底部添加按钮。
// 视觉 1:1 对 Vue2 components/KVM/KVMFullPage.vue:10-67(<aside class="kvm-sidebar">…</aside>)。
//
// 折叠(collapsed)由父组件 KvmPage 算好传入,这里只负责把它反映到根元素的 class 上——
// 折叠态展开/收起的鼠标 hover 逻辑不属于本组件,KvmPage 直接在 <VmSidebar> 标签上挂
// @mouseenter/@mouseleave,Vue 3 对未声明为 emits 的原生 DOM 事件监听器会自动落到
// 单根组件的根元素上(attrs fallthrough),不需要本组件显式转发。
//
// 根元素上的 `active` 类驱动窄屏抽屉可见性(kvm.css 里 ≤768px 的独立媒体查询,桌宽下
// 这个类不产生任何视觉效果)。Task 8 收尾修的 Vue2 遗留 bug:Vue2 窄屏抽屉的触发类从来
// 没被真正 add/remove 过(死代码,详见 kvm.css `.kvm-sidebar.active` 规则上方的注释),
// 这里复用已有的 `collapsed` 状态,窄屏下 `active = !collapsed`——默认展开,点同一个
// 折叠按钮收起。
// ⚠️ 踩坑记录:这条注释原本写在 <template> 里、`<aside>` 根标签的正上方,结果 Vue 3
// 编译器把"模板级注释 + 根元素"识别成了两个根节点的 Fragment(Vue 默认保留注释 vnode,
// 不会因为是注释就不计入根节点数),导致 @vue/test-utils 的 wrapper 根变成一个包装用的
// 合成 <div>,`wrapper.classes()` 从此再也读不到 aside 上的任何 class(已用调试脚本
// 实测确认,不是 test-utils 的行为盲区,是模板真的多了一个根)。挪到这里(script 块的
// 普通注释,不会被编译进模板)就没这个问题,组件依然是单一 <aside> 根。
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
// P6 Task 8:'add-vm' 解禁——照 Vue2 `@click="showCreateVM"`(:61-64)。本组件只负责
// 转发点击,重置 selectedOS / 打开弹窗的决定权在父组件(KvmPage.openCreateDialog)。
defineEmits<{ select: [vm: KvmVM]; 'open-global-settings': []; 'add-vm': [] }>()

const { t } = useI18n()
</script>

<template>
  <aside class="kvm-sidebar" :class="{ collapsed, active: !collapsed }">
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
        <!-- 齿轮=全局设置入口(Task 2 解禁)。⚙ 是单色文字符号(非 emoji),
             色值走 .kvm-settings-btn 的 color token。 -->
        <button
          class="kvm-settings-btn"
          type="button"
          :title="t('kvmSettings')"
          :aria-label="t('kvmSettings')"
          @click="$emit('open-global-settings')"
        >
          <span aria-hidden="true">⚙</span>
        </button>
      </div>
    </header>

    <div class="vm-list">
      <div v-if="vms.length === 0 && !isLoading" class="empty-state">
        <!-- ⬚ 是单色文字符号占位(禁 emoji)——Vue2 用的是 remote-desktop-outline 图标
             字体,New-UI 没有那套字体。与 KvmPage.vue 的 ‹/▭、ConsoleHeader.vue 的 ⚙/⋮
             同一批占位债务,等统一换真图标那批一起收(清理项5,不是本任务遗漏)。 -->
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

    <!-- 添加虚拟机(P6 Task 8 解禁,照 Vue2 :61-64)。kvm.css 里 .add-vm-btn:disabled /
         :hover:not(:disabled) 两条规则原样保留——按钮已经不会再进入 disabled 态,但规则
         本身仍然正确(硬约束,任务说明明确要求不要删)。 -->
    <button class="add-vm-btn" type="button" @click="$emit('add-vm')">
      <span aria-hidden="true">+</span>
      <span>{{ t('kvmAddVm') }}</span>
    </button>
  </aside>
</template>
