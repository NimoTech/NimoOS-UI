<!-- 1:1 ported from Vue2 src/views/AI/Agent/blocks/FileListCard.vue -->
<script setup lang="ts">
import AgentIcon from '../icons/AgentIcon.vue'

interface FileListItem {
  name?: string
  path?: string
  modified?: string
  size?: string
  kind?: string
}

withDefaults(
  defineProps<{ title?: string; subtitle?: string; files?: FileListItem[] }>(),
  { title: '', subtitle: '', files: () => [] },
)
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div class="card-head-icon" style="background: var(--accent-soft); color: var(--accent)">
        <AgentIcon name="folder" :size="14" />
      </div>
      <div style="flex: 1">
        <div class="card-title">{{ title }}</div>
        <div class="card-sub">{{ subtitle }}</div>
      </div>
    </div>
    <div class="filelist">
      <div v-for="(f, i) in (files || [])" :key="i" class="fileitem">
        <div class="fileicon">
          <div class="fileicon-tag" :data-kind="f.kind">{{ (f.kind || '').toUpperCase() }}</div>
        </div>
        <div class="fileinfo">
          <div class="filename">{{ f.name }}</div>
          <div class="filemeta">
            <span>{{ f.path }}</span>
            <template v-if="f.modified"> · <span>{{ f.modified }}</span></template>
          </div>
        </div>
        <div class="filesize">{{ f.size }}</div>
      </div>
    </div>
  </div>
</template>
