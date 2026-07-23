<!--
  1a 版:对齐 Vue2 src/views/AI/Agent/blocks/BlockRenderer.vue 的分发结构,
  但 BLOCK_MAP 只落 `md`——其余全部类型统一走灰色降级 chip。
  1b 换回全量渲染器(ThinkingBlock/ToolCard/ConfirmCard/... 全套)。
-->
<script setup lang="ts">
import { computed } from 'vue'
import MarkdownBlock from './MarkdownBlock.vue'

interface Block {
  type: string
  text?: string
  [key: string]: unknown
}

const props = defineProps<{ block: Block }>()

const isMarkdown = computed(() => props.block.type === 'md')
</script>

<template>
  <MarkdownBlock v-if="isMarkdown" :text="block.text" />
  <!-- 1b: full BLOCK_MAP -->
  <span v-else class="block-chip">[{{ block.type }}]</span>
</template>

<style scoped>
.block-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--r-pill, 999px);
  font-size: 12px;
  background: var(--bg-chip);
  color: var(--text-tertiary);
}
</style>
