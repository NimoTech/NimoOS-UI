<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import StorageShell from '../storage/components/StorageShell.vue'
import DriveCard from '../storage/components/DriveCard.vue'
import { useStorageStore } from '../storage/stores/storage'
import { useDiskHotplug } from '../composables/useDiskHotplug'

const store = useStorageStore()
const { t } = useI18n()

useDiskHotplug(() => store.loadAll())
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
