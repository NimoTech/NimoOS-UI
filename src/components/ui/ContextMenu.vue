<script setup lang="ts">
import { ContextMenuRoot, ContextMenuTrigger, ContextMenuPortal, ContextMenuContent } from 'reka-ui'
</script>

<template>
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent class="ui-ctx-content" :collision-padding="8">
        <slot name="menu" />
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>

<style>
/* 非 scoped:菜单项样式给消费方(FileContextMenu)组装的 ContextMenuItem 复用 */
.ui-ctx-content {
  min-width: 190px; padding: 6px; border-radius: 14px; z-index: 120;
  background: var(--card-bg, rgba(30,32,44,0.96)); border: 1px solid var(--card-border, rgba(255,255,255,0.12));
  box-shadow: 0 18px 48px rgba(0,0,0,0.5); color: var(--fg);
}
.ui-ctx-item {
  display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 9px;
  font-size: 13px; cursor: pointer; user-select: none; outline: none;
}
.ui-ctx-item[data-highlighted] { background: var(--chip-bg-hi, rgba(255,255,255,0.14)); }
.ui-ctx-item.danger { color: #ff8a8a; }
.ui-ctx-sep { height: 1px; margin: 5px 4px; background: var(--card-border, rgba(255,255,255,0.1)); }
</style>
