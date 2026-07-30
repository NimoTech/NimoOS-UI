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
      :data-tier="t.tier"
      role="status"
      aria-live="polite"
    >{{ t.text }}</div>
  </transition-group>
</template>
<script setup lang="ts">
import { useToast } from '../stores/toast'
import { useAiTheme } from '../ai/stores/aiTheme'
const toast = useToast()
const aiTheme = useAiTheme()
</script>
<style scoped>
/* bottom-anchored stack: newest sits at the original spot, older ones push up */
/* z-index:提示条是最顶层反馈,必须盖过全仓所有浮层 —— 弹窗遮罩 .sk-modal-bg 是 1100,
   AI 区 SearchImageLightbox/SearchFileDrawer 是 10000、SearchFullResults 是 9999。
   原值 60 会被任何弹窗挡住(2026-07-30 用户在「创建令牌」弹窗里点复制,提示条看不到)。
   本元素 pointer-events: none,置顶不会拦截任何点击。守卫见 AppToast.test.ts 末条。 */
.toast-stack { position: fixed; z-index: 10100; left: 50%; bottom: 118px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; }
.toast { padding: 10px 18px; border: 1px solid var(--chip-border); border-radius: 999px; background: var(--toast-bg); color: var(--toast-fg, var(--fg)); font-size: 13px; pointer-events: none; backdrop-filter: var(--blur); white-space: nowrap; }
/* SP8-P1c2 Task 6: severity tiers. 'info' (the default/omitted case) keeps the
   base .toast rule above untouched — existing show(text)/show(text, ms) call
   sites across the app render identically to before this task. */
.toast[data-tier="warning"] { background: var(--toast-warn-bg); color: var(--toast-warn-fg); }
.toast[data-tier="danger"] { background: var(--toast-danger-bg); color: var(--toast-danger-fg); }

/* Vue <transition-group> enter/leave + smooth reflow as items stack/unstack */
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s, transform 0.2s var(--ease, ease); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(12px); }
.toast-move { transition: transform 0.2s var(--ease, ease); }
</style>
