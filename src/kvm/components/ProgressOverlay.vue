<script setup lang="ts">
// 不可取消的进度遮罩。对位 Vue2 :495-514 的 `<b-modal :can-cancel="false">` + `<b-message>`
// ("正在停止/重启/删除虚拟机"那个转圈弹窗)。New-UI 没有 buefy,自绘。
//
// can-cancel=false 的落地方式:整个组件没有任何点击处理器 —— 遮罩本身、卡片,点哪里
// 都不会关闭,唯一的关闭方式是父组件在动作结束后不再渲染本组件(v-if 撤走)。
//
// ⚠️ Teleport 到 body(硬约束 6 要求写清楚判断):.kvm-page 是层叠上下文(T2 为压过
// 全局氛围光层加的 position:relative + z-index:1)。若本组件渲染在 .kvm-page 内部,
// 它相对 body 级兄弟(AppToast 的 z-index:60、components/ui/Dialog.vue 一类弹窗的
// z-index:1000)的有效层级会被整体钳在 1 —— 盖不住它们。Vue2 的 b-modal 本身就是
// buefy 挂在 body 下的(不是 kvm-full-page 的子节点),这里 Teleport 是还原 Vue2 实际
// 挂载位置,不是新增行为。停/重启/删除是"不可撤销"的操作,遮罩期间应该霸屏,
// 不能被恰好路过的全局 toast/弹窗盖住或被误当成还能操作背后的东西。
// <Teleport> 是内置模板组件,不需要 import。
defineProps<{ title: string; message: string }>()
</script>

<template>
  <Teleport to="body">
    <div class="kvm-progress-overlay">
      <div class="kvm-progress-card">
        <div class="kvm-progress-title">
          <span>{{ title }}</span>
          <span class="kvm-spinner" aria-hidden="true"></span>
        </div>
        <div class="kvm-progress-msg">{{ message }}</div>
      </div>
    </div>
  </Teleport>
</template>
