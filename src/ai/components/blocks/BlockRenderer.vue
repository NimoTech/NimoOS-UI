<!--
  1:1 移植自 Vue2 src/views/AI/Agent/blocks/BlockRenderer.vue —— 全量 BLOCK_MAP
  (SP8-P1b Task 8:恢复 P1a 里被压成"只有 md"的降级态,补齐全部 20 个分发类型)。
  terminal/semantic_search 指向 Task 8 建的 stub(Task 9 补真身),其余 17 个是本任务
  1:1 移植的真实渲染器。未映射的 block.type 仍走灰色降级 chip(P1a 行为保留)。
-->
<script setup lang="ts">
import { computed, type Component } from 'vue'
import ThinkingBlock from './ThinkingBlock.vue'
import ToolCard from './ToolCard.vue'
import MarkdownBlock from './MarkdownBlock.vue'
import ConfirmCard from './ConfirmCard.vue'
import PermissionRequestCard from './PermissionRequestCard.vue'
import MaxTurnsCard from './MaxTurnsCard.vue'
import ImageGridCard from './ImageGridCard.vue'
import VideoCard from './VideoCard.vue'
import FileListCard from './FileListCard.vue'
import SearchResultsCard from './SearchResultsCard.vue'
import ProgressCard from './ProgressCard.vue'
import StorageCard from './StorageCard.vue'
import ActionsRow from './ActionsRow.vue'
import TerminalCard from './TerminalCard.vue'
import SemanticSearchCard from './SemanticSearchCard.vue'
import PhotoGridCard from './PhotoGridCard.vue'
import McpPermissionCard from './McpPermissionCard.vue'
import McpCallCard from './McpCallCard.vue'
import McpWarningCard from './McpWarningCard.vue'
import McpInstallCard from './McpInstallCard.vue'
import McpElicitFormCard from './McpElicitFormCard.vue'
import McpElicitUrlCard from './McpElicitUrlCard.vue'

interface Block {
  type: string
  text?: string
  [key: string]: unknown
}

const props = defineProps<{ block: Block }>()

const BLOCK_MAP: Record<string, Component> = {
  thinking: ThinkingBlock,
  tool: ToolCard,
  md: MarkdownBlock,
  confirm: ConfirmCard,
  access_request: PermissionRequestCard,
  max_turns: MaxTurnsCard,
  imggrid: ImageGridCard,
  video: VideoCard,
  filelist: FileListCard,
  search: SearchResultsCard,
  progress: ProgressCard,
  storage: StorageCard,
  actions: ActionsRow,
  terminal: TerminalCard,
  semantic_search: SemanticSearchCard,
  photo_grid: PhotoGridCard,
  mcp_confirm: McpPermissionCard,
  mcp_call: McpCallCard,
  mcp_warning: McpWarningCard,
  mcp_install: McpInstallCard,
  mcp_elicit_form: McpElicitFormCard,
  mcp_elicit_url: McpElicitUrlCard,
}

const resolved = computed(() => BLOCK_MAP[props.block.type] || null)
</script>

<template>
  <component :is="resolved" v-if="resolved" v-bind="block" />
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
