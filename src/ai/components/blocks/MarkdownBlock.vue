<!-- 1:1 ported from Vue2 src/views/AI/Agent/blocks/MarkdownBlock.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '../../markdown/renderMarkdown'

const props = withDefaults(defineProps<{ text?: string }>(), { text: '' })
const html = computed(() => renderMarkdown(props.text))
</script>

<template>
  <div class="md" v-html="html" />
</template>
