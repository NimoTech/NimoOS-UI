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
      <!-- 复用右键文件菜单的非 scoped 样式(ui/ContextMenu.vue):Portal 传送到 body 的内容
           拿不到 scoped 属性,自定义 scoped 背景会失效显透明;非 scoped 的 ui-ctx-* 可靠生效。 -->
      <DropdownMenuContent class="ui-ctx-content" :side-offset="4" align="start">
        <DropdownMenuItem class="ui-ctx-item" @select="emit('connect-network')">
          {{ t('filesMountConnectNetwork') }}
        </DropdownMenuItem>
        <template v-if="drivers.length">
          <DropdownMenuSeparator class="ui-ctx-sep" />
          <DropdownMenuItem
            v-for="d in drivers"
            :key="d.name"
            class="ui-ctx-item"
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
.add-mount-btn:hover { background: var(--chip-bg-hi); }
</style>

<style>
/* 驱动图标在 Portal 传送的菜单内容里(同 ui-ctx-* 一样),用非 scoped 才可靠生效。 */
.add-mount-driver-icon { width: 16px; height: 16px; object-fit: contain; }
</style>
