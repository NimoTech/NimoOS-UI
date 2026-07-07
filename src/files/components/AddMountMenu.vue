<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type CloudDriver } from '@nimotech/nimoos-service'
import { driverIconUrl } from '../util/cloudAuth'
import {
  DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal,
  DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from 'reka-ui'

const emit = defineEmits<{ (e: 'connect-network'): void; (e: 'connect-cloud', driver: CloudDriver): void }>()
const { t } = useI18n()

const drivers = ref<CloudDriver[]>([])
const origin = window.location.origin
onMounted(async () => {
  try { drivers.value = await service.driver.listDrivers() } catch { drivers.value = [] }
})
function iconFor(d: CloudDriver): string { return driverIconUrl(d.icon, origin) }
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger class="add-mount-btn" :aria-label="t('filesMountAdd')">＋</DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent class="add-mount-menu" :side-offset="4" align="start">
        <DropdownMenuItem class="add-mount-item" @select="emit('connect-network')">
          {{ t('filesMountConnectNetwork') }}
        </DropdownMenuItem>
        <template v-if="drivers.length">
          <DropdownMenuSeparator class="add-mount-sep" />
          <DropdownMenuItem
            v-for="d in drivers"
            :key="d.name"
            class="add-mount-item add-mount-driver"
            @select="emit('connect-cloud', d)"
          >
            <img class="add-mount-driver-icon" :src="iconFor(d)" alt="" />
            {{ t('filesMountConnectCloud', { name: d.name }) }}
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<style scoped>
.add-mount-btn { width: 24px; height: 24px; border: none; border-radius: 8px; background: var(--chip-bg, rgba(255,255,255,0.06)); color: var(--fg); font-size: 16px; line-height: 1; cursor: pointer; }
.add-mount-btn:hover { background: var(--chip-hover, rgba(255,255,255,0.12)); }
.add-mount-menu { min-width: 180px; padding: 6px; border-radius: 12px; background: var(--popup-bg, rgba(20,23,35,0.95)); border: 1px solid var(--card-border, rgba(255,255,255,0.12)); backdrop-filter: blur(20px); box-shadow: 0 16px 40px rgba(0,0,0,0.45); z-index: 1000; }
.add-mount-item { padding: 8px 12px; border-radius: 8px; font-size: 13px; color: var(--fg); cursor: pointer; outline: none; }
.add-mount-item[data-highlighted] { background: var(--chip-bg, rgba(255,255,255,0.08)); }
.add-mount-sep { height: 1px; margin: 6px 4px; background: var(--card-border, rgba(255,255,255,0.12)); }
.add-mount-driver { display: flex; align-items: center; gap: 8px; }
.add-mount-driver-icon { width: 16px; height: 16px; object-fit: contain; }
</style>
