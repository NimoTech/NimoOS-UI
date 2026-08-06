<template>
  <!-- SP8-P2b 验收第 3 轮(2026-07-30):AI 区在前台时,给自己套上 AI 的 toast 作用域与
       明暗。不这么做的话本组件读的是全局蓝黑主题的半透明白底 + 白字,画在 AI 浅色页面上
       完全看不见(AI 区所有 toast 都收不到反馈)。根因与 token 取值见
       src/ai/stores/aiTheme.ts 的 aiSurfaces 注释、样式在 tokens.scss 的 .ai-toast-scope。
       不在 AI 区时两个绑定都不生效 —— 桌面/文件/应用区观感零变化(用户明确要求)。 -->
  <transition-group
    name="toast" tag="div" class="toast-stack"
    :class="{ 'ai-toast-scope': aiTheme.aiSurfaceActive }"
    :data-theme="aiTheme.aiSurfaceActive ? aiTheme.theme : undefined"
  >
    <div
      v-for="t in toast.toasts"
      :key="t.id"
      class="toast"
      :class="{ 'has-action': t.action }"
      :data-tier="t.tier"
      role="status"
      aria-live="polite"
    >
      {{ t.text }}
      <button v-if="t.action" type="button" class="toast-action" @click="onAction(t)">{{ t.action.label }}</button>
    </div>
  </transition-group>
</template>
<script setup lang="ts">
import { useToast, type ToastItem } from '../stores/toast'
import { useAiTheme } from '../ai/stores/aiTheme'
const toast = useToast()
const aiTheme = useAiTheme()
// Undo-style toasts (Task 9) should fire once and disappear immediately,
// rather than waiting out the remaining auto-dismiss timer.
function onAction(t: ToastItem) {
  t.action?.onClick()
  toast.dismiss(t.id)
}
</script>
<style scoped>
/* bottom-anchored stack: newest sits at the original spot, older ones push up */
/* z-index —— **toast 必须高于全仓所有浮层**(层级阶梯见 docs/THEMING.md §8)。
   原值 60 时,任何"失败了但刻意保留弹窗让用户重试"的路径都看不到失败原因:遮罩
   (.pd-scrim / .cad-overlay = 220、ui-dialog-overlay = 1000、弹窗面板 = 1001、
   .sk-modal-bg = 1100)都在 toast 之上,且带 backdrop-filter,toast 被整片模糊压死
   —— 用户以为按钮没响应,反复重试(2026-07-30 用户在「创建令牌」弹窗里点复制复现)。
   【SP8-P6-T3 合流】取 sp8 的 10100 而非 master 的 1100:AI 区随本次合流进入主干,
   它的 SearchImageLightbox / SearchFileDrawer 坐在 10000、SearchFullResults 9999,
   1100 会被它们压住。10100 是"高于全仓最高的 10000、且留出余量"的最小安全值。
   本元素 pointer-events: none,置顶不会拦截任何点击。守卫见 AppToast.test.ts 末条。 */
.toast-stack { position: fixed; z-index: 10100; left: 50%; bottom: 118px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; }
.toast { display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border: 1px solid var(--chip-border); border-radius: 999px; background: var(--toast-bg); color: var(--toast-fg, var(--fg)); font-size: 13px; pointer-events: none; backdrop-filter: var(--blur); white-space: nowrap; }
/* SP8-P1c2 Task 6: severity tiers. 'info' (the default/omitted case) keeps the
   base .toast rule above untouched — existing show(text)/show(text, ms) call
   sites across the app render identically to before this task. */
.toast[data-tier="warning"] { background: var(--toast-warn-bg); color: var(--toast-warn-fg); }
.toast[data-tier="danger"] { background: var(--toast-danger-bg); color: var(--toast-danger-fg); }
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
