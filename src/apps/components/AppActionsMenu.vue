<script setup lang="ts">
import {
  DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuContent,
} from 'reka-ui'
defineProps<{ ariaLabel: string }>()
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger class="ui-drop-trigger" :aria-label="ariaLabel">⋮</DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent class="ui-drop-content" :collision-padding="8" :side-offset="4" align="end">
        <slot name="menu" />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<style>
/* 非 scoped:Content 经 Portal 渲染到 body,scoped 属性够不到(ContextMenu.vue 先例);
   菜单项样式给消费方组装的 DropdownMenuItem 复用 */
.ui-drop-trigger {
  width: 28px; height: 28px; border-radius: 8px; border: none; cursor: pointer;
  background: transparent; color: var(--fg-muted); font-size: 16px; line-height: 1;
}
.ui-drop-trigger:hover { background: var(--chip-bg-hi); color: var(--fg); }
.ui-drop-content {
  min-width: 170px; padding: 6px; border-radius: 14px; z-index: 120;
  background: var(--popup-bg); border: 1px solid var(--card-border); backdrop-filter: blur(20px);
  box-shadow: var(--card-shadow-hi); color: var(--fg);
}
.ui-drop-item {
  display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 9px;
  font-size: 13px; cursor: pointer; user-select: none; outline: none;
}
.ui-drop-item[data-highlighted] { background: var(--chip-bg-hi); }
.ui-drop-item.danger { color: #ff8a8a; /* theme-exception: danger 文字色沿 ui-ctx-item.danger 既有例外 */ }
.ui-drop-sep { height: 1px; margin: 5px 4px; background: var(--card-border); }
</style>
