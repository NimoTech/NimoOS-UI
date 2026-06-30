<template>
  <div v-if="isReal" class="photo-thumb has-img"><img :src="src" alt="" loading="lazy" /></div>
  <div v-else class="photo-thumb" :style="{ background: gradient }" />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { LayoutItem } from '../grid/types'
import { usePhotosStore } from '../stores/photos'
import { isAssetId } from '../util/isAssetId'
import { PHOTO_PLACEHOLDERS } from '../grid/defaultLayout'
const props = defineProps<{ item: LayoutItem }>()
const store = usePhotosStore()
const isReal = computed(() => isAssetId(props.item.key))
const src = computed(() => store.thumbnailUrl(props.item.key))
const gradient = computed(() => (isAssetId(props.item.key) ? PHOTO_PLACEHOLDERS[0] : props.item.key))
</script>
<style scoped>
.photo-thumb { width: 100%; height: 100%; border-radius: 14px; overflow: hidden; background-size: cover; background-position: center; }
.photo-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
</style>
