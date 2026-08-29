<!--
  1:1 ported from Vue2 src/views/AI/Agent/blocks/BlockRenderer.vue — full BLOCK_MAP
  (SP8-P1b Task 8: restore the degraded state from P1a where only "md" remained, complete all 20 dispatch types).
  terminal/semantic_search point to stubs created in Task 8 (Task 9 adds the real implementations), the remaining 17 are genuinely ported
  from this task. Unmapped block.type still uses gray degradation chip (P1a behavior retained).
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
import JudgeStatusCard from './JudgeStatusCard.vue'

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
  judge: JudgeStatusCard,
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
