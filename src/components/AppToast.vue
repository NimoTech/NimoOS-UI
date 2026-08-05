<template>
  <transition-group name="toast" tag="div" class="toast-stack">
    <div
      v-for="t in toast.toasts" :key="t.id" class="toast" :class="{ 'has-action': t.action }"
      role="status" aria-live="polite"
    >
      {{ t.text }}
      <button v-if="t.action" type="button" class="toast-action" @click="onAction(t)">{{ t.action.label }}</button>
    </div>
  </transition-group>
</template>
<script setup lang="ts">
import { useToast, type ToastItem } from '../stores/toast'
const toast = useToast()
// Undo-style toasts (Task 9) should fire once and disappear immediately,
// rather than waiting out the remaining auto-dismiss timer.
function onAction(t: ToastItem) {
  t.action?.onClick()
  toast.dismiss(t.id)
}
</script>
<style scoped>
/* bottom-anchored stack: newest sits at the original spot, older ones push up */
/* z-index 1100 —— **toast 必须高于全仓所有模态遮罩**(层级阶梯见 docs/THEMING.md §8)。
   原值 60 时,任何"失败了但刻意保留弹窗让用户重试"的路径都看不到失败原因:遮罩
   (.pd-scrim / .cad-overlay = 220、ui-dialog-overlay = 1000、弹窗面板 = 1001)都在
   toast 之上,且带 backdrop-filter,toast 被整片模糊压死 —— 用户以为按钮没响应,反复重试。
   1100 是"高于当前最高的 1001、且仍留出余量"的最小安全值(改动前已 grep 全仓 z-index 用法)。
   新增浮层时不得在 1100 及以上落座,除非它比 toast 更该被看见。 */
.toast-stack { position: fixed; z-index: 1100; left: 50%; bottom: 118px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; }
.toast { display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border: 1px solid var(--chip-border); border-radius: 999px; background: var(--toast-bg); color: var(--toast-fg, var(--fg)); font-size: 13px; pointer-events: none; backdrop-filter: var(--blur); white-space: nowrap; }
/* only toasts carrying an action need to intercept clicks; plain status pills
   stay pointer-events:none so they never block content underneath */
.toast.has-action { pointer-events: auto; }
.toast-action {
  padding: 3px 11px; border-radius: 999px; border: 1px solid var(--accent-soft-bd);
  background: var(--accent-soft); color: var(--accent-text); font: inherit; font-size: 12px; font-weight: 600;
  cursor: pointer; pointer-events: auto;
}
.toast-action:hover { background: var(--accent-soft-2); }

/* Vue <transition-group> enter/leave + smooth reflow as items stack/unstack */
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s, transform 0.2s var(--ease, ease); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(12px); }
.toast-move { transition: transform 0.2s var(--ease, ease); }
</style>
