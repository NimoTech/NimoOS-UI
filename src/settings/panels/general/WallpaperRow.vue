<script setup lang="ts">
// Settings > General > Wallpaper. Mirrors Vue2 SettingsPanel.vue L102-116.
// SP11 pays off debt D5: the button used to be disabled with a hint saying the
// new UI had no wallpaper system. It now opens the app-level picker, which is
// mounted in App.vue because settings is its own route and the desktop entries
// live under a different one.
import { useI18n } from 'vue-i18n'
import SettingsRow from '../../components/SettingsRow.vue'
import { useWallpaperStore } from '../../../stores/wallpaper'
const { t } = useI18n()
const wp = useWallpaperStore()
</script>

<template>
  <SettingsRow :label="t('settingsWallpaper')">
    <template #control>
      <button class="set-btn" type="button" @click="wp.openDialog()">{{ t('settingsWallpaperChange') }}</button>
    </template>
  </SettingsRow>
</template>
