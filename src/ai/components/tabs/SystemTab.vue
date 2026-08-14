<!--
  1:1 port from Vue2 src/views/AI/Agent/tabs/SystemTab.vue (56 lines). SP8-P1c2 Task 11.

  User-approved intentional divergence (brief explicitly states): Vue2 `mounted` fetches
  `/sys/utilization` once and never refreshes; here changed to use New-UI's ready-made real-time
  channel `useUtilization()` (first frame HTTP + MessageBus `nimoos:system:utilization` continuous
  push) to drive 2x2 tile `systemTiles` values. Storage bar still one-time fetch (capacity doesn't
  need real-time, same as Vue2); data source fetched in `AgentPage.vue` `onMounted` via
  `service.disks.list()`, transformed via `toStoragePayload` and passed as `storage` prop (Task 13
  will actually connect this prop to rendered `AgentRightPanel` — this task only ensures component
  itself is independently testable).

  Vue2 bug fix (project decision 2026-07-27 "porting discipline · UI matches Vue2, logic is correct") —
  CPU tile value bug detailed in `../../util/systemTiles.ts` header comment: Vue2 treats scalar
  `cpu.percent` as array using `.length` check, causing CPU tile to always show "—". Fixed in pure
  function and recorded in report.

  `useUtilization()` mount/unmount subscriptions managed by composable itself (`onMounted`
  fetchOnce+subscribe, `onUnmounted` unsubscribe). This component is `AgentRightPanel`
  `v-else-if="tab === 'system'"` branch; switching tabs unmounts/remounts: each remount
  does fetchOnce again + resubscribes, unmount unsubscribes — composable internally uses local
  closure variable `off` to hold current subscription cancel function, doesn't accumulate listeners
  across mount periods, repeated mount/unmount doesn't leak (SystemTab.test.ts "tiles update with
  real-time data" case indirectly verifies subscription works; Pinia store itself is singleton,
  retains last data across mount periods, intentional — when user switches away from System tab
  and back, tiles should keep values from last screen, not be blank).
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUtilization } from '../../../composables/useUtilization'
import { systemTiles } from '../../util/systemTiles'
import type { StoragePayload } from '../../util/toStoragePayload'
import StorageCard from '../blocks/StorageCard.vue'

withDefaults(
  defineProps<{ storage?: StoragePayload | null }>(),
  { storage: null },
)

const { t } = useI18n()
const utilStore = useUtilization()
const tiles = computed(() => systemTiles(utilStore.data))
</script>

<template>
  <div>
    <div style="font-size: 12px; color: var(--text-tertiary); margin-bottom: 10px;
                font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px">
      {{ t('aiSysHeader') }}
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px">
      <div v-for="m in tiles" :key="m.labelKey"
           style="padding: 10px 12px; border-radius: 12px; background: var(--bg-elevated); border: 1px solid var(--line-faint)">
        <div style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.4px; font-weight: 600">
          {{ t(m.labelKey) }}
        </div>
        <div style="font-size: 18px; font-weight: 600; letter-spacing: -0.02em; margin-top: 2px; font-variant-numeric: tabular-nums">
          {{ m.value }}
        </div>
        <div style="font-size: 11px; color: var(--text-tertiary)">
          {{ m.subKey ? t(m.subKey, m.subParams || {}) : (m.subText || '') }}
        </div>
      </div>
    </div>

    <StorageCard v-if="storage" v-bind="storage" />
    <div v-else style="padding: 16px; text-align: center; color: var(--text-tertiary); font-size: 12px">
      {{ t('aiStorageUnavailable') }}
    </div>
  </div>
</template>
