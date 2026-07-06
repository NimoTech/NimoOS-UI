<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { component as VViewer } from 'v-viewer'
import 'viewerjs/dist/viewer.css'
import ViewerShell from './ViewerShell.vue'
import { filterImages, imageIndex } from './imageNav'
import type { FileEntry } from '../stores/files'

const props = defineProps<{ item: FileEntry; list: FileEntry[] }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'download', entry: FileEntry): void }>()
const { t } = useI18n()

const items = filterImages(props.list.length ? props.list : [props.item])
const index = ref(imageIndex(items, props.item))
const current = computed(() => items[index.value] ?? props.item)
const srcArray = computed(() => [service.file.fileUrl(current.value.path)])

// ViewerJS options:全关原生 chrome(忠于 Vue2 ImageViewer.vue viewerOptions)
const viewerOptions = {
  button: false,
  toolbar: false,
  title: false,
  navbar: false,
  backdrop: false,
  transition: false,
  inline: true,
  initialViewIndex: 0,
}

// v-viewer v3 组件 `inited` 事件回传的是底层 viewerjs 实例本身(zoom/rotate/reset/show 等方法齐全)。
let viewerInst: { zoom: (n: number) => void; rotate: (n: number) => void; reset: () => void; show: () => void } | null = null
function inited(v: typeof viewerInst) {
  viewerInst = v
  viewerInst?.show()
}

const disablePrev = computed(() => index.value === 0)
const disableNext = computed(() => index.value === items.length - 1)
function prev() {
  if (index.value > 0) index.value--
}
function next() {
  if (index.value < items.length - 1) index.value++
}

// 工具栏 5s 无操作自动隐藏(忠于 Vue2 onMouseMove)
const isMoving = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null
function onMouseMove() {
  isMoving.value = true
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    isMoving.value = false
    hideTimer = null
  }, 5000)
}

function onKey(e: KeyboardEvent) {
  if (e.code === 'ArrowRight') next()
  else if (e.code === 'ArrowLeft') prev()
}
onMounted(() => {
  window.addEventListener('keyup', onKey)
  onMouseMove()
})
onBeforeUnmount(() => {
  window.removeEventListener('keyup', onKey)
  if (hideTimer) clearTimeout(hideTimer)
})
</script>

<template>
  <ViewerShell :title="current.name" downloadable @close="emit('close')" @download="emit('download', current)">
    <div class="img-wrap" @mousemove="onMouseMove" @touchmove="onMouseMove">
      <div v-if="isMoving" class="img-toolbar">
        <button class="tb-item" :class="{ disabled: disablePrev }" :title="t('filesViewerPrev')" @click="prev">‹</button>
        <button class="tb-item" :title="t('filesViewerZoomIn')" @click="viewerInst?.zoom(0.1)">＋</button>
        <button class="tb-item" :title="t('filesViewerRotate')" @click="viewerInst?.rotate(90)">⟳</button>
        <button class="tb-item" :title="t('filesViewerReset')" @click="viewerInst?.reset()">⤢</button>
        <button class="tb-item" :title="t('filesViewerZoomOut')" @click="viewerInst?.zoom(-0.1)">－</button>
        <button class="tb-item" :class="{ disabled: disableNext }" :title="t('filesViewerNext')" @click="next">›</button>
      </div>
      <VViewer :images="srcArray" :options="viewerOptions" class="viewer" @inited="inited">
        <template #default="{ images }">
          <img v-for="src in images" :key="src" :src="src" alt="image" />
        </template>
      </VViewer>
    </div>
  </ViewerShell>
</template>

<style scoped>
.img-wrap {
  width: 100%;
  height: 100%;
  position: relative;
}
.viewer {
  width: 100%;
  height: 100%;
}
.viewer :deep(.viewer-canvas) {
  background-image: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='50' viewBox='0 0 16 16'%3E%3Cpath fill='%23ccc' d='M8 6.5A1.5 1.5 0 1 0 8 9.5A1.5 1.5 0 1 0 8 6.5z' fill-opacity='0.1'/%3E%3C/svg%3E");
  background-color: transparent;
  background-repeat: repeat;
}
.img-toolbar {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 10px;
  background: rgb(49, 49, 54);
}
.tb-item {
  width: 34px;
  height: 34px;
  border: none;
  background: transparent;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  border-radius: 6px;
}
.tb-item:hover {
  background: rgba(255, 255, 255, 0.15);
}
.tb-item.disabled {
  opacity: 0.35;
  pointer-events: none;
}
</style>
