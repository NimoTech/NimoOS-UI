<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal,
  DropdownMenuContent, DropdownMenuItem,
} from 'reka-ui'

const emit = defineEmits<{ (e: 'connect-network'): void }>()
const { t } = useI18n()
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger class="add-mount-btn" :aria-label="t('filesMountAdd')">＋</DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent class="add-mount-menu" :side-offset="4" align="start">
        <DropdownMenuItem class="add-mount-item" @select="emit('connect-network')">
          {{ t('filesMountConnectNetwork') }}
        </DropdownMenuItem>
        <!-- 云盘驱动项在 P5b 追加 -->
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<style scoped>
.add-mount-btn { width: 24px; height: 24px; border: none; border-radius: 8px; background: var(--chip-bg, rgba(255,255,255,0.06)); color: var(--fg); font-size: 16px; line-height: 1; cursor: pointer; }
.add-mount-btn:hover { background: var(--chip-hover, rgba(255,255,255,0.12)); }
.add-mount-menu { min-width: 180px; padding: 6px; border-radius: 12px; background: var(--popup-bg, rgba(20,23,35,0.95)); border: 1px solid var(--card-border, rgba(255,255,255,0.12)); backdrop-filter: blur(20px); box-shadow: 0 16px 40px rgba(0,0,0,0.45); z-index: 1000; }
.add-mount-item { padding: 8px 12px; border-radius: 8px; font-size: 13px; color: var(--fg); cursor: pointer; outline: none; }
.add-mount-item[data-highlighted] { background: var(--chip-bg, rgba(255,255,255,0.08)); }
</style>
