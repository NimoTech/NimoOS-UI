<script setup lang="ts">
// Right-click on empty desktop -> Change wallpaper. Ports Vue2
// components/wallpaper/ContextMenu.vue, including its gate: a right-click that
// landed on a tile is not a desktop click and must fall through to the browser
// (Vue2 checked for the `contextmenu-canvas` class at :50; New-UI's equivalent
// signal is "the target is inside a .grid-item").
import { ContextMenuItem } from 'reka-ui'
import { useI18n } from 'vue-i18n'
import ContextMenu from '../../components/ui/ContextMenu.vue'
import { useWallpaperStore } from '../../stores/wallpaper'

const { t } = useI18n()
const wp = useWallpaperStore()

function onContextMenu(e: MouseEvent) {
  const el = e.target as HTMLElement | null
  if (el?.closest('.grid-item')) {
    // Stop reka-ui's trigger from seeing it; the browser menu stays available.
    e.stopPropagation()
  }
}

function onChangeWallpaper() {
  wp.openDialog()
}

defineExpose({ onChangeWallpaper })
</script>

<template>
  <ContextMenu>
    <div class="desktop-ctx-host" @contextmenu.capture="onContextMenu">
      <slot />
    </div>
    <template #menu>
      <ContextMenuItem class="ui-ctx-item ctx-change-wallpaper" @select="onChangeWallpaper">
        {{ t('wpChangeWallpaper') }}
      </ContextMenuItem>
    </template>
  </ContextMenu>
</template>

<style scoped>
/* Must not introduce a new box: useGridMeasure reads GridCanvas's own root
   element and the dock offset, so this host must not add a box of its own. */
.desktop-ctx-host { display: contents; }
</style>
