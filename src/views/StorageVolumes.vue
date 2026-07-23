<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import StorageShell from '../storage/components/StorageShell.vue'
import VolumeCard from '../storage/components/VolumeCard.vue'
import UnmountDialog from '../storage/components/UnmountDialog.vue'
import CreateStorageDialog from '../storage/components/CreateStorageDialog.vue'
import FormatDialog from '../storage/components/FormatDialog.vue'
import { useStorageStore } from '../storage/stores/storage'
import { useDiskHotplug } from '../composables/useDiskHotplug'
import { computeNextStorageName, DEFAULT_STORAGE_NAME } from '../storage/util/storageNaming'
import type { StorageVolume } from '../storage/util/storageMap'

const store = useStorageStore()
const { t } = useI18n()

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

const createOpen = ref(false)
// 存储名与 RAID 名共享命名空间(Vue2 allUsedNames 同款)
const defaultName = computed(() =>
  computeNextStorageName(DEFAULT_STORAGE_NAME, [
    ...store.volumes.map((v) => v.name),
    ...store.raidNames,
  ]),
)
async function doCreate(payload: { path: string; name: string; format: boolean }) {
  const ok = await store.createStorage(payload)
  if (ok) createOpen.value = false
}

const formatOpen = ref(false)
const pendingFormat = ref<StorageVolume | null>(null)
function askFormat(v: StorageVolume) {
  pendingFormat.value = v
  formatOpen.value = true
}
async function doFormat(password: string) {
  if (!pendingFormat.value) return
  // 契约:path=分区路径,volume=挂载点(Vue2 formatStorage 同款)
  const ok = await store.formatVolume({
    path: pendingFormat.value.path,
    volume: pendingFormat.value.mountPoint,
    password,
  })
  if (ok) formatOpen.value = false
}

useDiskHotplug(() => store.loadAll())
</script>

<template>
  <StorageShell>
    <div class="sv-toolbar">
      <button
        class="sv-create"
        type="button"
        :disabled="!store.availDisks.length"
        :title="store.availDisks.length ? '' : t('storageCreateNoDisk')"
        @click="createOpen = true"
      >
        {{ t('storageCreate') }}
      </button>
    </div>
    <div v-if="store.loading && !store.volumes.length" class="st-hint">{{ t('storageLoading') }}</div>
    <p v-else-if="!store.volumes.length" class="st-hint">{{ t('storageVolumesEmpty') }}</p>
    <div v-else>
      <VolumeCard
        v-for="v in store.volumes"
        :key="v.uuid || v.path"
        :volume="v"
        @unmount="askUnmount(v)"
        @format="askFormat(v)"
      />
    </div>
    <CreateStorageDialog
      v-model:open="createOpen"
      :disks="store.availDisks"
      :default-name="defaultName"
      :busy="store.creating"
      @confirm="doCreate"
    />
    <FormatDialog v-model:open="formatOpen" :name="pendingFormat?.name || ''" :busy="store.formatting" @confirm="doFormat" />
    <UnmountDialog v-model:open="dialogOpen" :name="pending?.name || ''" :busy="store.unmounting" @confirm="doUnmount" />
  </StorageShell>
</template>

<style scoped>
.st-hint { padding: 40px 0; text-align: center; color: var(--fg-muted); font-size: 14px; }
.sv-toolbar { display: flex; justify-content: flex-end; margin-bottom: 14px; }
.sv-create {
  padding: 7px 18px; border-radius: 999px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px;
}
.sv-create:hover:not(:disabled) { background: var(--chip-bg-hi); }
.sv-create:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
