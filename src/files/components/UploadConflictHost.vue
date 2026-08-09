<script setup lang="ts">
// Renders the upload-conflict prompt at app level (App.vue mounts it next to
// AppToast). It deliberately owns no logic: every decision still lives in
// useUploadConflicts, this only gives the dialog a home that outlives the files
// view -- see the store's comment for why that matters (SP12 Plan B ticket E).
import FileConflictDialog from './FileConflictDialog.vue'
import { useUploadConflictsStore } from '../stores/uploadConflicts'

const conflicts = useUploadConflictsStore()
</script>

<template>
  <FileConflictDialog
    :open="conflicts.dialog.open"
    :name="conflicts.dialog.name"
    :target-path="conflicts.dialog.targetPath"
    :is-dir="conflicts.dialog.isDir"
    :allow-merge="conflicts.dialog.allowMerge"
    :queue-index="conflicts.dialog.queueIndex"
    :queue-total="conflicts.dialog.queueTotal"
    @choose="conflicts.onChoose"
    @cancel="conflicts.onCancel"
  />
</template>
