<script setup lang="ts">
import { ref, computed } from 'vue'
import { service } from '@nimotech/nimoos-service'
import type { FileEntry } from '../stores/files'
import { iconNameFor, iconUrl } from '../util/icons'
import { isImageEntry } from '../util/isImage'
import { useInView } from '../composables/useInView'

const props = defineProps<{ entry: FileEntry }>()
const el = ref<HTMLElement | null>(null)
const inView = useInView(el)
const errored = ref(false)
const showThumb = computed(() => isImageEntry(props.entry) && inView.value && !errored.value)
</script>

<template>
  <span ref="el" class="file-thumb">
    <img v-if="showThumb" class="thumb-img" :src="service.image.thumbUrl(props.entry.path)" alt="" @error="errored = true" />
    <img v-else class="thumb-icon" :src="iconUrl(iconNameFor(props.entry))" alt="" />
  </span>
</template>

<style scoped>
/* 尺寸由父级类名(.tile-icon / .file-icon)给到本组件根元素;这里只管填充与裁切 */
.file-thumb { display: inline-flex; align-items: center; justify-content: center; overflow: hidden; }
.thumb-img { width: 100%; height: 100%; object-fit: cover; border-radius: 6px; }
.thumb-icon { width: 100%; height: 100%; object-fit: contain; }
</style>
