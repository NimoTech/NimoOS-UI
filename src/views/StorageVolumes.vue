<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import StorageShell from '../storage/components/StorageShell.vue'
import VolumeCard from '../storage/components/VolumeCard.vue'
import UnmountDialog from '../storage/components/UnmountDialog.vue'
import { useStorageStore } from '../storage/stores/storage'
import { useMessageBus } from '../composables/useMessageBus'
import type { StorageVolume } from '../storage/util/storageMap'

const store = useStorageStore()
const { t } = useI18n()
const bus = useMessageBus()

const dialogOpen = ref(false)
const pending = ref<StorageVolume | null>(null)
function askUnmount(v: StorageVolume) {
  pending.value = v
  dialogOpen.value = true
}
async function doUnmount(password: string) {
  if (!pending.value) return
  const ok = await store.unmount(pending.value.disk, password)
  if (ok) dialogOpen.value = false
}

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
    <div v-if="store.loading && !store.volumes.length" class="st-hint">{{ t('storageLoading') }}</div>
    <p v-else-if="!store.volumes.length" class="st-hint">{{ t('storageVolumesEmpty') }}</p>
    <div v-else>
      <VolumeCard v-for="v in store.volumes" :key="v.uuid || v.path" :volume="v" @unmount="askUnmount(v)" />
    </div>
    <UnmountDialog v-model:open="dialogOpen" :name="pending?.name || ''" :busy="store.unmounting" @confirm="doUnmount" />
  </StorageShell>
</template>

<style scoped>
.st-hint { padding: 40px 0; text-align: center; color: var(--fg-muted); font-size: 14px; }
</style>
