<script setup lang="ts">
// Settings · Storage. **Authorized deviation #3** (spec §5.5, user sign-off 2026-07-31):
//   Vue2 rebuilds a whole overview/system-disk/storage-list/recycle-bin stack in this tab,
//   and SP6 has already fully migrated that stack to the /storage route page. Reimplementing
//   it here would mean maintaining the same feature in two places → so this tab only holds
//   **one capacity overview card + one "open storage" entry card**, which navigates to /storage.
//
// The capacity math is copied verbatim from Vue2 SettingsPanel.vue:1139-1171 (the 8%
// system-disk heuristic), to keep the numbers consistent with the old UI:
//   storageTotal = sum of all partition sizes; storageOsUsed = system partition
//   min(usedSize, size*0.08); storageDataUsed = the rest of used space;
//   storageAvail = total - used. This does not call raid.list() to filter out RAID
//   volumes — Vue2's calculation here reads the raw /v1/storage list directly and does
//   not exclude RAID volumes, which is a different accounting basis from the SP6
//   /storage page (useStorageStore, which dedupes via raid.list). This tab follows Vue2.
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import SettingsSection from '../components/SettingsSection.vue'
import { mapVolumes, type StorageVolume } from '../../storage/util/storageMap'
import { renderSize } from '../../files/util/format'
import '../styles/settings.css'

const { t } = useI18n()
const router = useRouter()
const volumes = ref<StorageVolume[]>([])
const loaded = ref(false)

const total = computed(() => volumes.value.reduce((s, v) => s + v.size, 0))
const osUsed = computed(() =>
  volumes.value.reduce((s, v) => (v.isSystem ? s + Math.min(v.usedSize, v.size * 0.08) : s), 0),
)
const dataUsed = computed(() =>
  volumes.value.reduce(
    (s, v) => s + (v.isSystem ? v.usedSize - Math.min(v.usedSize, v.size * 0.08) : v.usedSize),
    0,
  ),
)
const avail = computed(() => total.value - osUsed.value - dataUsed.value)
const osPct = computed(() => (total.value ? (osUsed.value / total.value) * 100 : 0))
const dataPct = computed(() => (total.value ? (dataUsed.value / total.value) * 100 : 0))

// Inline guard (not extracted into a shared helper): prevents a late-arriving response
// from writing back into a ref after the component has unmounted mid-request.
let alive = true
onUnmounted(() => { alive = false })

onMounted(async () => {
  try {
    const vols = mapVolumes(await service.storage.list({ system: 'show' }))
    if (!alive) return // Component already unmounted, do not write back
    volumes.value = vols
  } catch {
    if (!alive) return
    volumes.value = []
  } finally {
    if (alive) loaded.value = true
  }
})
</script>

<template>
  <SettingsSection :title="t('settingsTabStorage')">
    <!-- Review Important #3: while the fetch is in flight (!loaded) it must not fall through
         to the v-else branch below and render the overview card — that would show a bogus
         reading (0 Bytes available + an empty progress bar), not a neutral empty state. Add
         an explicit loading-state branch, gated on the finally of the try/catch/finally in
         onMounted (loaded=true lands regardless of success or failure), the same convergence
         basis as AppsPanel's "both endpoints have settled". -->
    <div v-if="!loaded" class="set-skeleton">{{ t('settingsNetLoading') }}</div>
    <div v-else-if="!volumes.length" class="set-empty">{{ t('settingsStoreNoStorage') }}</div>
    <div v-else class="set-card set-store-overview">
      <div class="set-store-head">
        <span class="set-row-label">{{ t('settingsStoreTotal') }}</span>
        <span class="set-row-sub">{{ renderSize(avail) }} {{ t('settingsStoreAvailable') }}</span>
      </div>
      <div class="set-store-bar">
        <div class="set-store-seg-os" :style="{ width: osPct + '%' }" />
        <div class="set-store-seg-data" :style="{ width: dataPct + '%' }" />
      </div>
      <div class="set-store-legend">
        <span><i class="set-store-legend-dot set-store-seg-os" />{{ t('settingsStoreSystem') }}</span>
        <span><i class="set-store-legend-dot set-store-seg-data" />{{ t('settingsStoreFiles') }}</span>
        <span>{{ renderSize(osUsed + dataUsed) }} / {{ renderSize(total) }}</span>
      </div>
    </div>

    <button class="set-list-item clickable set-store-entry" type="button" @click="router.push('/storage')">
      <span class="set-row-text">
        <span class="set-row-label">{{ t('settingsStoreEntryTitle') }}</span>
        <span class="set-row-sub">{{ t('settingsStoreEntrySub') }}</span>
      </span>
      <span class="set-chevron" aria-hidden="true">›</span>
    </button>
  </SettingsSection>
</template>
