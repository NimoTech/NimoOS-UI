<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import StorageShell from '../storage/components/StorageShell.vue'
import DriveCard from '../storage/components/DriveCard.vue'
import { useStorageStore } from '../storage/stores/storage'
import { useMessageBus } from '../composables/useMessageBus'

const store = useStorageStore()
const { t } = useI18n()
const bus = useMessageBus()

// MessageBus handler 不可阻塞(buffer=1):500ms 防抖后刷新(Vue2 MountList 先例)
let hotplugTimer: number | undefined
function onHotplug() {
  clearTimeout(hotplugTimer)
  hotplugTimer = window.setTimeout(() => {
    store.loadAll()
  }, 500)
}

let offAdd: (() => void) | undefined
let offRemove: (() => void) | undefined
onMounted(() => {
  store.loadAll()
  offAdd = bus.on('local-storage:disk:added', onHotplug)
  offRemove = bus.on('local-storage:disk:removed', onHotplug)
})
onUnmounted(() => {
  offAdd?.()
  offRemove?.()
  clearTimeout(hotplugTimer)
})
</script>

<template>
  <StorageShell>
    <div v-if="store.loading && !store.drives.length" class="st-hint">{{ t('storageLoading') }}</div>
    <p v-else-if="!store.drives.length" class="st-hint">{{ t('storageDrivesEmpty') }}</p>
    <div v-else>
      <DriveCard v-for="d in store.drives" :key="d.name" :drive="d" />
    </div>
  </StorageShell>
</template>

<style scoped>
.st-hint { padding: 40px 0; text-align: center; color: var(--fg-muted); font-size: 14px; }
</style>
