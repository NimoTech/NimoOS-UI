<script setup lang="ts">
import VueOfficeDocx from '@vue-office/docx'
import '@vue-office/docx/lib/index.css'
import { useI18n } from 'vue-i18n'
import ViewerShell from './ViewerShell.vue'
import { useOfficeBytes } from './useOfficeBytes'
import type { FileEntry } from '../stores/files'

const props = defineProps<{ item: FileEntry; list: FileEntry[] }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'download', entry: FileEntry): void }>()
const { t } = useI18n()
const { state, buffer, onRendered, onRenderError } = useOfficeBytes(props.item)
</script>

<template>
  <ViewerShell :title="props.item.name" downloadable @close="emit('close')" @download="emit('download', props.item)">
    <div class="office-body">
      <div v-if="state === 'loading'" class="viewer-status">{{ t('filesViewerLoading') }}</div>
      <div v-else-if="state === 'error'" class="viewer-status">
        <p>{{ t('filesViewerError') }}</p>
        <button type="button" class="chip" @click="emit('download', props.item)">{{ t('filesViewerDownloadInstead') }}</button>
      </div>
      <div v-show="state !== 'error'" class="office-scroll">
        <VueOfficeDocx v-if="buffer" :src="buffer" @rendered="onRendered" @error="onRenderError" />
      </div>
    </div>
  </ViewerShell>
</template>
